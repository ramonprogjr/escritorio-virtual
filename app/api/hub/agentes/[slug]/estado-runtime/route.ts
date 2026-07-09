import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { agenteUsaPlaybookMaria } from "@/lib/whatsapp/playbook-flow-maria";
import {
  temReferenciaPlaybookPublicado,
  isPlaybookOnlyAgent,
  type AgenteInstrucaoIdent,
} from "@/lib/hub/agente-instrucao-modo";

/**
 * F1 do plano de agentes (docs/PLANO-AGENTES-CRIAR-EDITAR.md) — VERDADE VISÍVEL.
 * Endpoint SÓ LEITURA que compõe o estado REAL de runtime do agente a partir das MESMAS funções que o
 * runtime usa (agenteUsaPlaybookMaria + helpers de instrução) + a linha de identidade. Zero escrita, zero
 * download de bucket, zero chamada a UAZAPI — risco ~zero. Expõe o buraco mais perigoso de hoje: um agente
 * de atendimento com fluxo PUBLICADO que NÃO roda no WhatsApp porque o roteamento (env Mari-only) não o
 * inclui — hoje isso falha em silêncio. As luzes de conexão UAZAPI e conversas ativas entram numa versão
 * seguinte (fail-open: ausência = "—", nunca bloqueia).
 */

type Luz = {
  chave: string;
  label: string;
  /** ok=verde · alerta=âmbar (funciona mas atenção) · pendente=cinza · off=vermelho */
  estado: "ok" | "alerta" | "pendente" | "off";
  detalhe: string;
};

function agenteForaDoTenant(
  row: { tenant_id?: string | null } | null | undefined,
  tenantId: string
): boolean {
  if (!row) return false;
  return row.tenant_id != null && String(row.tenant_id) !== tenantId;
}

/** Conta ferramentas IA habilitadas, robusto a formatos (array de ids, ou objeto {id: bool|{habilitado}}). */
function contarFerramentasHabilitadas(uso: unknown): number {
  if (Array.isArray(uso)) return uso.filter(Boolean).length;
  if (uso && typeof uso === "object") {
    let n = 0;
    for (const v of Object.values(uso as Record<string, unknown>)) {
      if (v === true) n++;
      else if (v && typeof v === "object" && (v as Record<string, unknown>).habilitado === true) n++;
    }
    return n;
  }
  return 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const g = await requireCrmSessao(req);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, modo_operacao, ativo, arquivado_em, tenant_id, cargo, area, instrucao_modo, playbook_object_path, playbook_public_url, playbook_generated_at, uso_ferramentas_ia, motor_ferramentas_habilitado, mistral_agent_sync_habilitado"
    )
    .eq("agente_slug", slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || agenteForaDoTenant(data as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const row = data as Record<string, unknown>;
  const ident: AgenteInstrucaoIdent = {
    cargo: (row.cargo as string) ?? null,
    area: (row.area as string) ?? null,
    instrucao_modo: (row.instrucao_modo as string) ?? null,
    playbook_object_path: (row.playbook_object_path as string) ?? null,
    playbook_public_url: (row.playbook_public_url as string) ?? null,
  };

  const modo = (typeof row.modo_operacao === "string" && row.modo_operacao.trim()) || "interno";
  const ehAtendimento = modo === "canal_whatsapp";
  const ativo = row.ativo === true;
  const arquivado = row.arquivado_em != null;
  const temPlaybook = temReferenciaPlaybookPublicado(ident);
  const playbookOnly = isPlaybookOnlyAgent(ident);
  const roteamentoRoda = ehAtendimento ? agenteUsaPlaybookMaria(slug) : null;
  const nFerramentas = contarFerramentasHabilitadas(row.uso_ferramentas_ia);

  const luzes: Luz[] = [];

  luzes.push({
    chave: "ativo",
    label: "Agente ativo",
    estado: arquivado ? "off" : ativo ? "ok" : "pendente",
    detalhe: arquivado ? "Arquivado." : ativo ? "Ligado e disponível." : "Pausado — não está trabalhando.",
  });

  if (ehAtendimento) {
    luzes.push({
      chave: "playbook",
      label: "Fluxo de conversa publicado",
      estado: temPlaybook ? "ok" : "pendente",
      detalhe: temPlaybook
        ? "Há um fluxo publicado para este agente."
        : "Ainda sem fluxo publicado — publique pelo editor de fluxo.",
    });
    // A luz-estrela: o fluxo publicado REALMENTE roda no WhatsApp? (roteamento Mari-only por env)
    luzes.push({
      chave: "roteamento",
      label: "Roda no WhatsApp",
      estado: roteamentoRoda ? "ok" : temPlaybook ? "alerta" : "off",
      detalhe: roteamentoRoda
        ? "O roteamento inclui este agente — o fluxo publicado roda no WhatsApp."
        : temPlaybook
          ? "O fluxo está PUBLICADO mas NÃO está roteado para o WhatsApp deste agente — a ativação do roteamento ainda depende de configuração. Sem isso, o fluxo não roda no atendimento."
          : "Roteamento inativo (sem fluxo publicado).",
    });
  } else {
    luzes.push({
      chave: "ferramentas",
      label: "Ferramentas ligadas",
      estado: row.motor_ferramentas_habilitado === true && nFerramentas > 0 ? "ok" : "pendente",
      detalhe:
        row.motor_ferramentas_habilitado === true
          ? `${nFerramentas} ferramenta(s) ligada(s).`
          : "Motor de ferramentas desligado — o agente não age no sistema.",
    });
    luzes.push({
      chave: "instrucao",
      label: playbookOnly ? "Instrução (playbook)" : "Instrução (cargo)",
      estado: temPlaybook || (typeof row.cargo === "string" && row.cargo.trim()) ? "ok" : "pendente",
      detalhe: temPlaybook
        ? "Instruções publicadas."
        : "Instruções vêm do cargo — considere publicar um playbook próprio.",
    });
  }

  // Resumo honesto para o topo do card.
  const problema = luzes.find((l) => l.estado === "off") || luzes.find((l) => l.estado === "alerta");
  const resumo = problema
    ? { estado: problema.estado, mensagem: problema.detalhe }
    : { estado: "ok" as const, mensagem: ehAtendimento ? "Pronto para atender." : "Pronto para trabalhar." };

  return NextResponse.json({
    agente_slug: slug,
    modo_operacao: modo,
    tipo: ehAtendimento ? "atendimento" : "interno",
    ativo,
    arquivado,
    tem_playbook: temPlaybook,
    roteamento_roda: roteamentoRoda,
    ferramentas_ligadas: nFerramentas,
    resumo,
    luzes,
  });
}
