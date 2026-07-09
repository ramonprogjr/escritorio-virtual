import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

export async function GET(request: NextRequest) {
  try {
    const sessao = await requireCrmSessao(request);
    if ("error" in sessao) return sessao.error;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const estagio = searchParams.get("estagio");
    const tenantId = sessao.ctx.tenantId;

    let query = supabase
      .from("hub_leads_crm")
      .select(
        "id, nome, telefone, email, origem, estagio, score, valor_estimado, criado_em, atualizado_em, agente_responsavel, humano_responsavel, ultimo_contato, campanha, proxima_acao, data_proxima_acao, interesse_principal, tags, observacoes, metadata"
      )
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false });

    if (estagio && estagio !== "todos") {
      query = query.eq("estagio", estagio);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message, leads: [] }, { status: 500 });
    }

    // INBOX DE VERDADE: anexa a ÚLTIMA mensagem de cada lead (preview) e marca "aguardando resposta"
    // (última mensagem é do cliente = entrada), depois ordena por ATIVIDADE em vez de criado_em.
    // hub_fila_mensagens é o ledger completo (pós-Bloco A). 1 query extra + redução em JS.
    const leads = (data || []) as Record<string, unknown>[];
    const ids = leads.map((l) => String(l.id)).filter(Boolean);
    const ultimaPorLead = new Map<string, { conteudo: string; direcao: string; criado_em: string }>();
    if (ids.length) {
      // Dois ledgers: hub_fila_mensagens (go-forward, tem direcao) + hub_mensagens (legado, direcao
      // derivada de remetente: 'lead' = entrada, resto = saida).
      const [{ data: fila }, { data: hist }] = await Promise.all([
        supabase
          .from("hub_fila_mensagens")
          .select("lead_id, conteudo, direcao, criado_em")
          .in("lead_id", ids)
          .order("criado_em", { ascending: false })
          .limit(1500),
        supabase
          .from("hub_mensagens")
          .select("lead_id, conteudo, remetente, criado_em")
          .in("lead_id", ids)
          .order("criado_em", { ascending: false })
          .limit(1500),
      ]);
      const todas: Array<{ lead_id: string; conteudo: string; direcao: string; criado_em: string }> = [];
      for (const m of (fila || []) as Record<string, unknown>[]) {
        todas.push({
          lead_id: String(m.lead_id ?? ""),
          conteudo: String(m.conteudo ?? ""),
          direcao: String(m.direcao ?? ""),
          criado_em: String(m.criado_em ?? ""),
        });
      }
      for (const m of (hist || []) as Record<string, unknown>[]) {
        const rem = String(m.remetente ?? "").toLowerCase();
        todas.push({
          lead_id: String(m.lead_id ?? ""),
          conteudo: String(m.conteudo ?? ""),
          direcao: rem === "lead" || rem === "cliente" || rem === "contato" ? "entrada" : "saida",
          criado_em: String(m.criado_em ?? ""),
        });
      }
      todas.sort((a, b) => b.criado_em.localeCompare(a.criado_em));
      for (const m of todas) {
        if (m.lead_id && !ultimaPorLead.has(m.lead_id)) {
          ultimaPorLead.set(m.lead_id, { conteudo: m.conteudo, direcao: m.direcao, criado_em: m.criado_em });
        }
      }
    }
    const enriquecidos = leads.map((l) => {
      const u = ultimaPorLead.get(String(l.id));
      return {
        ...l,
        ultima_mensagem: u ? { conteudo: u.conteudo, direcao: u.direcao, criado_em: u.criado_em } : null,
        aguardando_desde: u && u.direcao === "entrada" ? u.criado_em : null,
      };
    });
    enriquecidos.sort((a, b) => {
      const ta = a.ultima_mensagem?.criado_em || String((a as Record<string, unknown>).criado_em || "");
      const tb = b.ultima_mensagem?.criado_em || String((b as Record<string, unknown>).criado_em || "");
      return tb.localeCompare(ta);
    });

    return NextResponse.json({ leads: enriquecidos });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg, leads: [] }, { status: 500 });
  }
}
