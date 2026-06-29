import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import {
  codigoFrenteFromNome,
  disciplinaPorSlug,
  EAP_PRESETS_FALLBACK,
} from "@/lib/obras/eap-presets";

type Params = { params: Promise<{ id: string }> };

const SELECT =
  "id, obra_id, codigo, nome, disciplina_slug, area_label, cor, peso_fisico, peso_financeiro, ativo, ordem, origem";

/**
 * Confirma que a obra pertence ao tenant do caller (RLS está bypassada por service-role,
 * então a checagem explícita é a única proteção multi-tenant). Retorna 404 se não pertence.
 */
async function assertObraDoTenant(
  obraId: string,
  tenantId: string
): Promise<NextResponse | null> {
  const { data } = await crmDb()
    .from("hub_obras")
    .select("id, tenant_id")
    .eq("id", obraId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Obra não encontrada" }, { status: 404 });
  // C1: hub_obras.tenant_id é NULLABLE e o acesso é por service-role (RLS bypassada).
  // tenant_id NULL NÃO pertence a ninguém → tratamos como não-encontrada (evita vazamento).
  if (data.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Obra não encontrada" }, { status: 404 });
  }
  return null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  const { data, error } = await crmDb()
    .from("hub_obra_frentes_eap")
    .select(SELECT)
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId) // defesa em profundidade (frentes nunca são globais)
    .order("ordem", { ascending: true });

  // Tolerância: tabela EAP ainda não existe (migração E0 pendente) → devolve fallback + aviso.
  if (error) {
    if (isMissingPgColumn(error) || /relation .*does not exist/i.test(error.message)) {
      return NextResponse.json({
        data: EAP_PRESETS_FALLBACK,
        migracao_pendente: true,
        aviso: "Personalização de frentes ainda não ativa (migração E0 pendente).",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], migracao_pendente: false });
}

/** POST = adicionar nova frente (entra ativa, no fim da ordem; não mexe nas existentes). */
export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const disciplinaSlug =
    typeof body.disciplina_slug === "string" ? body.disciplina_slug.trim() : "";
  const disc = disciplinaSlug ? disciplinaPorSlug(disciplinaSlug) : undefined;
  const nome = String(body.nome || disc?.label || "").trim();
  if (!nome) return NextResponse.json({ error: "Informe a disciplina ou o nome da frente." }, { status: 400 });

  const supabase = crmDb();

  // ordem = fim da lista; código único dentro da obra.
  const { data: existentes } = await supabase
    .from("hub_obra_frentes_eap")
    .select("codigo, ordem")
    .eq("obra_id", obraId);
  const usados = new Set<string>((existentes ?? []).map((r) => String(r.codigo)));
  const maxOrdem = (existentes ?? []).reduce((m, r) => Math.max(m, Number(r.ordem ?? 0)), -1);

  let codigo = codigoFrenteFromNome(nome, disciplinaSlug || undefined);
  let n = 2;
  const baseCodigo = codigo;
  while (usados.has(codigo)) {
    codigo = `${baseCodigo}${n}`;
    n += 1;
  }

  const { data, error } = await supabase
    .from("hub_obra_frentes_eap")
    .insert({
      obra_id: obraId,
      tenant_id: g.ctx.tenantId,
      codigo,
      nome,
      disciplina_slug: disciplinaSlug || null,
      cor: disc?.cor ?? (typeof body.cor === "string" ? body.cor : null),
      peso_fisico: typeof body.peso_fisico === "number" ? body.peso_fisico : 0,
      peso_financeiro: typeof body.peso_financeiro === "number" ? body.peso_financeiro : 0,
      ativo: true,
      ordem: maxOrdem + 1,
      origem: "manual",
    })
    .select(SELECT)
    .single();

  if (error) {
    if (isMissingPgColumn(error) || /relation .*does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: "Migração E0 pendente: a EAP ainda não pode ser personalizada." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}

/** PATCH = ativar/ocultar, renomear, reordenar ou ajustar peso de uma frente (por id). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const frenteId = String(body.id || "").trim();
  if (!frenteId) return NextResponse.json({ error: "id da frente é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;
  if (typeof body.nome === "string" && body.nome.trim()) patch.nome = body.nome.trim(); // código imutável
  if (typeof body.ordem === "number") patch.ordem = body.ordem;
  if (typeof body.peso_fisico === "number") patch.peso_fisico = body.peso_fisico;
  if (typeof body.peso_financeiro === "number") patch.peso_financeiro = body.peso_financeiro;
  if (typeof body.area_label === "string") patch.area_label = body.area_label.trim() || null;

  const { data, error } = await crmDb()
    .from("hub_obra_frentes_eap")
    .update(patch)
    .eq("id", frenteId)
    .eq("obra_id", obraId) // garante que a frente é da obra do tenant validado
    .select(SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Frente não encontrada" }, { status: 404 });
  return NextResponse.json({ data });
}
