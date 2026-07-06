import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import {
  CONHECIMENTO_TITULO_INSERT,
  isConhecimentoSecaoId,
  ordemConhecimentoSecao,
} from "@/lib/hub/conhecimento-secoes";
import { requireCrmGestor, requireCrmSessao } from "@/lib/crm/crm-api-auth";

/**
 * Conhecimento/tarefas do agente (tabela `hub_agente_conhecimento`).
 *
 * Estas secções são gravadas na CRIAÇÃO (wizard, via `conhecimento_secoes`) e
 * até agora «sumiam» da ficha. Esta rota torna-as legíveis e editáveis:
 *   GET → lista as secções (secao, titulo, conteudo, ordem) do agente.
 *   PUT → grava/atualiza UMA secção (upsert manual: a tabela não tem unique
 *         em (agente_slug, secao), só índice — por isso fazemos select→update/insert).
 *
 * Service-role, valida que o agente existe e pertence ao tenant, aditivo.
 */

/** Retorna true se a linha pertence a outro tenant (service-role bypassa RLS). */
function agenteForaDoTenant(
  row: { tenant_id?: string | null } | null | undefined,
  tenantId: string
): boolean {
  if (!row) return false;
  return row.tenant_id != null && String(row.tenant_id) !== tenantId;
}

/** Erro do PostgREST/Postgres quando a própria tabela não existe (base muito antiga). */
function isTabelaConhecimentoMissing(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (!m.includes("hub_agente_conhecimento")) return false;
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find")
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B4 (GET): guard de sessão — qualquer papel CRM ativo pode ler o conhecimento do agente.
  const g = await requireCrmSessao(req);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  // Verificar que o agente pertence ao tenant antes de expor conteúdo.
  const { data: agenteRow } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agenteRow || agenteForaDoTenant(agenteRow as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ secoes: [] });
  }

  const { data, error } = await supabase
    .from("hub_agente_conhecimento")
    .select("secao, titulo, conteudo, ordem, ativo")
    .eq("agente_slug", slug)
    .order("ordem", { ascending: true })
    .limit(50);

  // Tolerância: tabela ausente ou outra falha de leitura NÃO quebra o editor —
  // devolve lista vazia para a UI mostrar o estado vazio amigável.
  if (error) {
    if (isTabelaConhecimentoMissing(error.message)) {
      return NextResponse.json({ secoes: [] });
    }
    console.warn("[hub/agentes/:slug/conhecimento] GET:", slug, error.message);
    return NextResponse.json({ secoes: [] });
  }

  const secoes = (data || []).map((r) => ({
    secao: String(r.secao ?? ""),
    titulo: String(r.titulo ?? "") || "Conhecimento",
    conteudo: String(r.conteudo ?? ""),
    ordem: typeof r.ordem === "number" ? r.ordem : ordemConhecimentoSecao(String(r.secao ?? "")),
    ativo: r.ativo !== false,
  }));

  return NextResponse.json({ secoes });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B4 (PUT): escreve no knowledge base do agente (vira system prompt) — exige gestor.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const secao = typeof body.secao === "string" ? body.secao.trim() : "";
  if (!isConhecimentoSecaoId(secao)) {
    return NextResponse.json(
      { error: "Secção de conhecimento inválida." },
      { status: 400 }
    );
  }
  const conteudo = String(body.conteudo ?? "").trim();
  // Título: usa o enviado (se vier) ou o rótulo canónico da secção.
  const titulo =
    (typeof body.titulo === "string" && body.titulo.trim()) ||
    CONHECIMENTO_TITULO_INSERT[secao];

  const supabase = db();

  // E-B4: valida que o agente existe E pertence ao tenant da sessão.
  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (agErr) {
    return NextResponse.json({ error: agErr.message }, { status: 500 });
  }
  if (!agente || agenteForaDoTenant(agente as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  // Upsert manual: a tabela só tem índice (não unique) em (agente_slug, secao).
  const { data: existente, error: selErr } = await supabase
    .from("hub_agente_conhecimento")
    .select("id")
    .eq("agente_slug", slug)
    .eq("secao", secao)
    .limit(1)
    .maybeSingle();

  if (selErr) {
    if (isTabelaConhecimentoMissing(selErr.message)) {
      return NextResponse.json(
        {
          error:
            "Tabela de conhecimento ainda não existe nesta base. Execute a migração hub_migration_crm e tente de novo.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  if (existente?.id) {
    const { error: upErr } = await supabase
      .from("hub_agente_conhecimento")
      .update({ titulo, conteudo, ativo: true })
      .eq("id", existente.id as string);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  } else {
    const { error: insErr } = await supabase.from("hub_agente_conhecimento").insert({
      agente_slug: slug,
      secao,
      titulo,
      conteudo,
      ordem: ordemConhecimentoSecao(secao),
      ativo: true,
    });
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, secao, titulo });
}
