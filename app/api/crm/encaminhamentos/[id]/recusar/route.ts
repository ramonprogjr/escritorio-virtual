import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { enviarLeadAoParceiro } from "@/lib/crm/notificar-parceiro-lead";
import { registrarEvento } from "@/lib/crm/registrar-evento";

type Params = { params: Promise<{ id: string }> };

type Candidato = {
  parceiro_id: string;
  nome?: string;
  score?: number;
  motivo?: string;
  status_financeiro?: string;
};

/**
 * Cascata de rejeição: fornecedor recusou → oferta ao PRÓXIMO candidato elegível.
 * Marca o encaminhamento atual como 'recusado', acha o próximo candidato (não bloqueado)
 * na lista guardada em criterio_selecao e cria+envia um novo encaminhamento para ele.
 * Se não houver próximo, devolve o lead à fila (qualificado).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const { id } = await params;
  const supabase = crmDb();

  const { data: enc, error } = await supabase
    .from("hub_encaminhamentos")
    .select("id, lead_id, segmento, criterio_selecao, tenant_id, status")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!enc) return NextResponse.json({ error: "Encaminhamento não encontrado." }, { status: 404 });
  if (enc.tenant_id && enc.tenant_id !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Encaminhamento não encontrado." }, { status: 404 });
  }

  let criterio: Record<string, unknown> = {};
  try {
    criterio = JSON.parse(String(enc.criterio_selecao ?? "{}")) as Record<string, unknown>;
  } catch {
    criterio = {};
  }
  const candidatos = (Array.isArray(criterio.candidatos) ? criterio.candidatos : []) as Candidato[];
  const atualId = String(criterio.parceiro_id ?? "");

  await supabase.from("hub_encaminhamentos").update({ status: "recusado" }).eq("id", id);
  await registrarEvento(supabase, {
    event_type: "lead_recusado",
    entity_type: "encaminhamento",
    entity_id: id,
    fornecedor_id: atualId || null,
    lead_id: enc.lead_id as string,
    ator: "humano",
    payload: { parceiro_nome: criterio.parceiro_nome ?? null },
    tenant_id: (enc.tenant_id as string) ?? null,
  });

  const idx = candidatos.findIndex((c) => c.parceiro_id === atualId);
  const proximo = candidatos
    .slice(idx >= 0 ? idx + 1 : 0)
    .find((c) => c.parceiro_id !== atualId && (c.status_financeiro ?? "em_dia") !== "bloqueado");

  if (!proximo) {
    await supabase
      .from("hub_leads_crm")
      .update({ estagio: "qualificado", atualizado_em: new Date().toISOString() })
      .eq("id", enc.lead_id);
    await registrarEvento(supabase, {
      event_type: "lead_sem_proximo",
      entity_type: "lead",
      entity_id: enc.lead_id as string,
      lead_id: enc.lead_id as string,
      ator: "sistema",
      payload: {},
      tenant_id: (enc.tenant_id as string) ?? null,
    });
    return NextResponse.json({ ok: true, proximo: null, mensagem: "Sem próximo candidato — lead voltou à fila." });
  }

  const novoCriterio = JSON.stringify({
    parceiro_id: proximo.parceiro_id,
    parceiro_nome: proximo.nome,
    score: proximo.score,
    motivo: proximo.motivo,
    candidatos,
  });

  const { data: novo, error: novoErr } = await supabase
    .from("hub_encaminhamentos")
    .insert({
      lead_id: enc.lead_id,
      segmento: enc.segmento,
      responsavel_envio: "sistema_cascata",
      sugerido_ia: true,
      validado_humano: true,
      status: "aprovado_envio",
      criterio_selecao: novoCriterio,
      encaminhado_para: proximo.nome,
      tenant_id: enc.tenant_id,
    })
    .select("id")
    .single();

  if (novoErr || !novo?.id) {
    return NextResponse.json({ error: novoErr?.message || "Falha ao recolocar o lead." }, { status: 500 });
  }

  const envio = await enviarLeadAoParceiro(supabase, String(novo.id), { parceiro_id: proximo.parceiro_id });

  await registrarEvento(supabase, {
    event_type: "lead_recolocado",
    entity_type: "encaminhamento",
    entity_id: String(novo.id),
    fornecedor_id: proximo.parceiro_id,
    lead_id: enc.lead_id as string,
    ator: "sistema",
    payload: { parceiro_nome: proximo.nome ?? null, enviado: envio.ok },
    tenant_id: (enc.tenant_id as string) ?? null,
  });

  return NextResponse.json({
    ok: true,
    proximo: { parceiro_id: proximo.parceiro_id, nome: proximo.nome },
    enviado: envio.ok,
  });
}
