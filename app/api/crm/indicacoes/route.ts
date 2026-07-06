/**
 * Indicar em 1 toque (Fase 1, sem migração) — desenho: docs/DESIGN-INDICAR-1-TOQUE.md.
 *
 * POST = registra a indicação: resolve o INDICADOR (parceiro do usuário logado, senão Hub),
 *   resolve a REGRA de comissão (hub_parceiros.comissao_pct → padrão Hub), DEDUPLICA por telefone
 *   (first-touch imutável: já existe → devolve comprovante de TENTATIVA, não cria/sobrescreve), cria
 *   o LEAD pela via oficial (codigo LED + vínculo de pessoa + rastreio) com o CARIMBO imutável em
 *   metadata.indicacao e dispara hub_eventos. Devolve o comprovante.
 * GET  = "Minhas indicações": leads deste tenant com metadata.indicacao (semáforo por estágio).
 *
 * O lead entra no motor de distribuição normal (EXCLUSIVO, decisão do dono) — o indicador indica o
 * CLIENTE, não escolhe o executor. `registrado_por` (quem apertou) ≠ `indicador` (quem recebe a comissão).
 * A comissão nasce certa no fechamento: a conversão lead→negócio grava o vínculo papel='indicador' e a
 * rpc_apurar_comissoes casa a regra. Carimbo = a PROVA de qual regra valia (dia do fechamento é que vale).
 */
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { registrarEvento } from "@/lib/crm/registrar-evento";
import { normalizarTelefoneLead, montarMetadataLeadMercados, prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { garantirPessoaParaLead } from "@/lib/crm/garantir-pessoa-lead";
import { tenantScopeOrFilter } from "@/lib/tenant-default";

type Indicador = { tipo: "parceiro" | "hub"; id: string | null; nome: string };

async function resolverIndicador(userId: string | null): Promise<{ indicador: Indicador; pct: number | null }> {
  const db = crmDb();
  if (userId) {
    const { data: user } = await db.from("users").select("email").eq("id", userId).maybeSingle();
    const email = typeof user?.email === "string" ? user.email.trim() : "";
    if (email) {
      const { data: parc } = await db.from("hub_parceiros").select("id, nome, comissao_pct").eq("email", email).maybeSingle();
      if (parc?.id) {
        return { indicador: { tipo: "parceiro", id: String(parc.id), nome: String(parc.nome ?? "Parceiro") }, pct: parc.comissao_pct != null ? Number(parc.comissao_pct) : null };
      }
    }
  }
  return { indicador: { tipo: "hub", id: null, nome: "Hub" }, pct: null };
}

export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { data } = await crmDb()
    .from("hub_leads_crm")
    .select("id, nome, telefone, estagio, criado_em, metadata")
    .eq("tenant_id", g.ctx.tenantId)
    .not("metadata->indicacao", "is", null)
    .order("criado_em", { ascending: false })
    .limit(100);

  const indicacoes = (data ?? []).map((l: Record<string, unknown>) => {
    const meta = (l.metadata as Record<string, unknown> | null) ?? {};
    const ind = (meta.indicacao as Record<string, unknown> | undefined) ?? {};
    return {
      lead_id: l.id, indicado_nome: l.nome, indicado_telefone: l.telefone, estagio: l.estagio, criado_em: l.criado_em,
      comprovante_codigo: ind.comprovante_codigo ?? null, indicador_nome: ind.indicador_nome ?? null,
      regra_texto: ind.regra_texto ?? null, resultado: ind.resultado ?? "lead_criado",
    };
  });
  return NextResponse.json({ indicacoes });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const telefoneRaw = typeof body.telefone === "string" ? body.telefone.trim() : "";
  if (nome.length < 2) return NextResponse.json({ error: "Informe o nome de quem você indica (mín. 2 letras)." }, { status: 400 });
  if (!telefoneRaw) return NextResponse.json({ error: "Informe o telefone." }, { status: 400 });
  const telefone = normalizarTelefoneLead(telefoneRaw);
  if (telefone.length < 10 || telefone.length > 13) return NextResponse.json({ error: "Telefone inválido (informe DDD + número)." }, { status: 400 });
  const mercadoRaw = typeof body.mercado === "string" ? body.mercado.trim().toUpperCase() : "";
  const observacao = typeof body.observacao === "string" ? body.observacao.trim() : "";

  const tenantId = g.ctx.tenantId;
  const userId = g.ctx.userId ?? null;
  const db = crmDb();

  const { indicador, pct } = await resolverIndicador(userId);
  const regraTexto = pct != null
    ? `Indicação de cliente: ${pct}% do pote de comissão — regra do seu cadastro; vale a regra do dia do fechamento.`
    : "Sem % cadastrado — a indicação vale; o percentual será definido no negócio.";

  const agora = new Date();
  const codigoBase = `IND-${agora.getFullYear()}-${Math.floor(agora.getTime() / 1000).toString().slice(-6)}`;
  const carimbo = (resultado: string) => ({
    comprovante_codigo: codigoBase, resultado,
    indicador_tipo: indicador.tipo, indicador_id: indicador.id, indicador_nome: indicador.nome,
    registrado_por: userId, regra_pct: pct, regra_texto: regraTexto,
    regra_origem: pct != null ? "regra_parceiro" : "padrao_hub",
    mercado: mercadoRaw || null, observacao: observacao || null, criado_em: agora.toISOString(),
  });

  // DEDUP first-touch (mesmo escopo da rota de leads: tenant + legados sem tenant) — não sobrescreve.
  const { data: existente } = await db
    .from("hub_leads_crm").select("id, nome").eq("telefone", telefone).or(tenantScopeOrFilter(tenantId)).maybeSingle();
  if (existente?.id) {
    await registrarEvento(db, { event_type: "indicacao_duplicada", entity_type: "lead", entity_id: String(existente.id), lead_id: String(existente.id), ator: indicador.nome, payload: { comprovante: codigoBase }, tenant_id: tenantId });
    return NextResponse.json({
      ok: true, resultado: "duplicado", lead_id: String(existente.id), comprovante: carimbo("duplicado"),
      aviso: "Este contato já está no Hub. Sua indicação foi registrada como tentativa (a atribuição do primeiro registro permanece).",
    });
  }

  // Via oficial de criação de lead: pessoa (dedup CPF/telefone) + codigo LED + rastreio.
  const pessoa = await garantirPessoaParaLead(db, tenantId, { telefone, nome, origem: "indicacao", mercados: mercadoRaw ? [mercadoRaw] : [] });
  const metaBase = montarMetadataLeadMercados({ mercados: mercadoRaw ? [mercadoRaw] : [], origem_cadastro: "indicacao" });
  const now = agora.toISOString();
  const rowBase: Record<string, unknown> = {
    nome, telefone, origem: "indicacao", estagio: "novo", score: 50,
    pessoa_id: pessoa.pessoaId, tenant_id: tenantId, criado_em: now, atualizado_em: now,
    metadata: { ...metaBase, indicacao: carimbo("lead_criado") },
  };
  const row = await prepararRowHubLeadInsert(db, rowBase, { pessoa_codigo: pessoa.codigo });

  const { data: lead, error } = await db.from("hub_leads_crm").insert(row).select("id, codigo").single();
  if (error) {
    if (String((error as { code?: string }).code) === "23505") {
      return NextResponse.json({ ok: true, resultado: "duplicado", comprovante: carimbo("duplicado"), aviso: "Este contato acabou de ser registrado no Hub." });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarEvento(db, {
    event_type: "indicacao_registrada", entity_type: "lead", entity_id: String(lead.id),
    lead_id: String(lead.id), ator: indicador.nome,
    payload: { comprovante: codigoBase, indicador_tipo: indicador.tipo, indicador_id: indicador.id, lead_codigo: lead.codigo ?? null },
    tenant_id: tenantId,
  });

  return NextResponse.json({ ok: true, resultado: "lead_criado", lead_id: String(lead.id), comprovante: carimbo("lead_criado") }, { status: 201 });
}
