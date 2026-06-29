import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import {
  isAcaoAprovacao,
  isFaseAprovacaoStatus,
  proximaFaseAprovacao,
  type FaseAprovacaoStatus,
} from "@/lib/crm/aprovacao-projeto";
import {
  carregarFaseDoProjetoTenant,
  projetoDoTenant,
  recalcularAgregadoProjeto,
  SELECT_FASE_BASE,
} from "@/lib/crm/aprovacao-projeto-db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Rota ÚNICA de ação da aprovação do cliente (A1). `body.acao`:
 *   enviar    — pendente/rejeitado(c/ url) → enviado          (422 sem entregavel_url)
 *   reenviar  — rejeitado(c/ url) → enviado (nova versão)     (409 se não-rejeitado · 422 sem url)
 *   responder — enviado → aprovado | rejeitado(+motivo)       (400 sem decisão/motivo · 409 se não-enviado)
 *   anexar    — grava entregavel_url, mantém estado
 *
 * Ao final recalcula o agregado e faz PATCH em hub_projetos.aprovacao_status.
 * Tudo tenant-scoped (faseDoProjetoTenant) e tolerante às colunas SLA do A1.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; faseId: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id, faseId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(faseId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;
  if (!(await projetoDoTenant(supabase, id, tenantId))) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const fase = await carregarFaseDoProjetoTenant(supabase, faseId, id, tenantId);
  if (fase === "sem_tenant") {
    return NextResponse.json(
      { error: "Aprovação indisponível neste ambiente (migração pendente)." },
      { status: 409 }
    );
  }
  if (!fase) return NextResponse.json({ error: "Entregável não encontrado" }, { status: 404 });

  // Aprovação só faz sentido para entregáveis (tipo='fase'). Cômodo não tem fluxo.
  if ((fase.row.tipo ?? "fase") !== "fase") {
    return NextResponse.json(
      { error: "Aprovação só se aplica a entregáveis (não a cômodos do programa)." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const acao = body.acao;
  if (!isAcaoAprovacao(acao)) {
    return NextResponse.json(
      { error: "Ação inválida (use enviar | reenviar | responder | anexar)." },
      { status: 400 }
    );
  }

  const atual: FaseAprovacaoStatus = isFaseAprovacaoStatus(fase.row.aprovacao_status)
    ? fase.row.aprovacao_status
    : "pendente";

  // URL do entregável: a enviada na ação (anexar/enviar/reenviar) ou a já existente.
  const urlEnviada =
    typeof body.entregavel_url === "string" && body.entregavel_url.trim()
      ? body.entregavel_url.trim().slice(0, 2000)
      : null;
  const temUrl = Boolean(urlEnviada || fase.row.entregavel_url);

  const decisao =
    body.decisao === "aprovado" || body.decisao === "rejeitado"
      ? (body.decisao as "aprovado" | "rejeitado")
      : undefined;
  const motivo =
    typeof body.motivo === "string" && body.motivo.trim() ? body.motivo.trim().slice(0, 2000) : undefined;

  const transicao = proximaFaseAprovacao(acao, atual, { temUrl, decisao, motivo });
  if (!transicao.ok) {
    return NextResponse.json({ error: mensagemErro(transicao.erro) }, { status: transicao.http });
  }

  const agora = new Date().toISOString();
  const novoStatus = transicao.novoStatus;

  // Patch base (colunas A0 — sempre existem após A0).
  const patchBase: Record<string, unknown> = {
    aprovacao_status: novoStatus,
    atualizado_em: agora,
  };
  if (urlEnviada) patchBase.entregavel_url = urlEnviada;

  // Patch SLA (colunas A1 — só se disponíveis; cai pro base se faltarem).
  const patchSla: Record<string, unknown> = { ...patchBase };
  if (acao === "enviar" || acao === "reenviar") {
    patchSla.aprovacao_enviado_em = agora;
    patchSla.aprovacao_respondido_em = null;
    patchSla.aprovacao_motivo = null;
  } else if (acao === "responder") {
    patchSla.aprovacao_respondido_em = agora;
    patchSla.aprovacao_motivo = decisao === "rejeitado" ? (motivo ?? null) : null;
  }

  async function aplicar(patch: Record<string, unknown>, select: string) {
    return supabase
      .from("hub_projetos_fases")
      .update(patch)
      .eq("id", faseId)
      .eq("projeto_id", id)
      .eq("tenant_id", tenantId)
      .select(select)
      .maybeSingle();
  }

  let usouSla = fase.slaDisponivel;
  let { data, error } = fase.slaDisponivel
    ? await aplicar(patchSla, SELECT_FASE_BASE)
    : await aplicar(patchBase, SELECT_FASE_BASE);

  // Cinto-e-suspensório: se a coluna SLA sumiu entre o SELECT e o UPDATE, cai pro base.
  if (error && isMissingPgColumn(error)) {
    usouSla = false;
    ({ data, error } = await aplicar(patchBase, SELECT_FASE_BASE));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Entregável não encontrado" }, { status: 404 });

  const agregado = await recalcularAgregadoProjeto(supabase, id, tenantId);

  return NextResponse.json({
    data,
    acao,
    de: atual,
    para: novoStatus,
    aprovacao_projeto: agregado,
    sla_persistido: usouSla,
  });
}

function mensagemErro(codigo: string): string {
  switch (codigo) {
    case "entregavel_sem_arquivo":
      return "Anexe o arquivo do entregável (URL) antes de enviar para aprovação.";
    case "ja_aprovado":
      return "Entregável já aprovado. Use “Reenviar com revisão” para abrir uma nova versão.";
    case "reenvio_so_de_rejeitado":
      return "Só é possível reenviar um entregável rejeitado (ou reabrir um aprovado).";
    case "resposta_so_de_enviado":
      return "A resposta do cliente só se registra em entregável que está aguardando (enviado).";
    case "decisao_invalida":
      return "Informe a decisão do cliente: aprovado ou rejeitado.";
    case "motivo_obrigatorio":
      return "Para registrar uma reprovação, informe o motivo do cliente.";
    default:
      return "Transição de aprovação inválida.";
  }
}
