/**
 * Diário de Obra (RDO) — básico. A tabela hub_obras_diario existia mas NÃO tinha
 * produtor (a aba só lia). A auditoria whole-system (06/jul) apontou "RDO não existe
 * como função". Aqui está a CRIAÇÃO (POST) + histórico (GET). Campos ricos do RDO
 * (efetivo/atividades/materiais/pendências/fotos) = janela do dono (ver
 * docs/JANELA-STORAGE-LOGS-NF.md) — a tela extende quando as colunas existirem.
 *
 * SEGURANÇA (regra sistêmica): crmDb() é service-role (RLS bypassada) → o isolamento
 * depende do filtro no código: `.eq("tenant_id", g.ctx.tenantId)` PURO + posse da obra
 * (404 se o tenant não bate). tenant_id/obra_id vêm da sessão/rota, NUNCA do body.
 * TOLERÂNCIA: tabela ausente → GET responde [] + migracao_pendente; POST responde 503.
 */
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

const SELECT_DIARIO = "id, obra_id, resumo, clima, registrado_por, criado_em";

function ehTabelaAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return isMissingPgColumn(error) || /relation .*does not exist/i.test(error.message ?? "");
}

async function assertObraDoTenant(obraId: string, tenantId: string): Promise<NextResponse | null> {
  const { data } = await crmDb().from("hub_obras").select("id, tenant_id").eq("id", obraId).maybeSingle();
  if (!data || data.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Obra não encontrada" }, { status: 404 });
  }
  return null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  const cfg = crmConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 503 });

  const { id: obraId } = await params;
  const posse = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (posse) return posse;

  const { data, error } = await crmDb()
    .from("hub_obras_diario")
    .select(SELECT_DIARIO)
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) {
    if (ehTabelaAusente(error)) return NextResponse.json({ data: [], migracao_pendente: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  const cfg = crmConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 503 });

  const { id: obraId } = await params;
  const posse = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (posse) return posse;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const resumo = String(body.resumo ?? "").trim();
  if (!resumo) return NextResponse.json({ error: "Escreva o resumo do dia." }, { status: 400 });
  const clima = body.clima != null && String(body.clima).trim() ? String(body.clima).trim() : null;

  const { data, error } = await crmDb()
    .from("hub_obras_diario")
    .insert({ obra_id: obraId, resumo, clima, tenant_id: g.ctx.tenantId })
    .select(SELECT_DIARIO)
    .single();

  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ error: "Diário ainda não ativo (migração pendente — janela do dono)." }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
