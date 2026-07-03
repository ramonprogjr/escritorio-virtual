import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";

/**
 * Contatos de notificação (quem recebe alertas de novo lead / aprovação / encaminhamento).
 * CRUD atrás de requireCrmGestor + escopo por tenant_id (antes era Supabase anon do browser, sem guard).
 */
const SELECT =
  "id, nome, telefone, email, cargo, canal, ativo, receber_novo_lead, receber_aprovacao, receber_encaminhamento, criado_em";

const CANAIS = new Set(["whatsapp", "email", "ambos"]);

export async function GET(request: NextRequest) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // Princípio "só arquiva": DELETE arquiva via ativo=false → a lista esconde inativos.
  let { data, error } = await crmDb()
    .from("hub_contatos_notificacao")
    .select(SELECT)
    .eq("tenant_id", g.ctx.tenantId)
    .eq("ativo", true)
    .order("nome", { ascending: true });

  // CN1: tabela ainda sem coluna tenant_id (migração multi-tenant não aplicada) → 42703. Sem coluna
  // não há como escopar; com 1 tenant é seguro. Some quando a migração criar a coluna.
  if (error && isMissingPgColumn(error, "tenant_id")) {
    ({ data, error } = await crmDb()
      .from("hub_contatos_notificacao")
      .select(SELECT)
      .eq("ativo", true)
      .order("nome", { ascending: true }));
  }

  if (error) {
    console.error("[contatos] GET falhou:", error.message); // não expõe SQL cru (EN3)
    return NextResponse.json({ error: "Não foi possível carregar os contatos." }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(body.nome || "").trim();
  const telefone = String(body.telefone || "").trim();
  if (!nome) return NextResponse.json({ error: "Informe o nome do contato." }, { status: 400 });
  if (telefone.replace(/\D/g, "").length < 10)
    return NextResponse.json({ error: "Telefone inválido — informe DDD + número." }, { status: 400 });

  const canal = String(body.canal || "whatsapp");
  const row = {
    nome,
    telefone,
    email: body.email ? String(body.email) : null,
    cargo: body.cargo ? String(body.cargo) : null,
    canal: CANAIS.has(canal) ? canal : "whatsapp",
    ativo: body.ativo === false ? false : true,
    receber_novo_lead: body.receber_novo_lead !== false,
    receber_aprovacao: body.receber_aprovacao !== false,
    receber_encaminhamento: body.receber_encaminhamento !== false,
    tenant_id: g.ctx.tenantId,
  };

  let { data, error } = await crmDb()
    .from("hub_contatos_notificacao")
    .insert(row)
    .select(SELECT)
    .single();

  if (error && isMissingPgColumn(error, "tenant_id")) {
    const { tenant_id: _omit, ...semTenant } = row;
    ({ data, error } = await crmDb().from("hub_contatos_notificacao").insert(semTenant).select(SELECT).single());
  }

  if (error) {
    console.error("[contatos] POST falhou:", error.message);
    return NextResponse.json({ error: "Não foi possível salvar o contato." }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
