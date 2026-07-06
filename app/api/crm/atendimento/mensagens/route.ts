import { NextRequest, NextResponse } from "next/server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { crmDb as db } from "@/lib/crm/supabase-server";

export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;
  try {
    const leadId = request.nextUrl.searchParams.get("leadId")?.trim();
    if (!leadId) {
      return NextResponse.json({ error: "leadId é obrigatório", mensagens: [] }, { status: 400 });
    }

    const supabase = db();

    // Isolamento de tenant: o lead precisa pertencer ao tenant do chamador (null-safe).
    const { data: leadDono } = await supabase
      .from("hub_leads_crm")
      .select("tenant_id")
      .eq("id", leadId)
      .maybeSingle();
    if (leadDono?.tenant_id && leadDono.tenant_id !== g.ctx.tenantId) {
      return NextResponse.json({ error: "Lead não encontrado", mensagens: [] }, { status: 404 });
    }

    // Busca nas quatro tabelas em paralelo
    const [filaRes, hubRes, jobsRes, ativRes] = await Promise.all([
      // hub_fila_mensagens: mensagens via CRM/fallback/celular/playbook
      supabase
        .from("hub_fila_mensagens")
        .select("id, conteudo, direcao, criado_em, agente_id, metadata, status")
        .eq("lead_id", leadId)
        .order("criado_em", { ascending: true })
        .limit(300),

      // hub_mensagens: mensagens da conversa com LLM engine
      supabase
        .from("hub_mensagens")
        .select("id, conteudo, remetente, agente_id, enviada_em, tipo_conteudo")
        .eq("lead_id", leadId)
        .order("enviada_em", { ascending: true })
        .limit(300),

      // hub_msg_jobs: histórico de inbound (mensagens do lead anteriores ao fix)
      supabase
        .from("hub_msg_jobs")
        .select("id, payload, created_at")
        .eq("lead_id", leadId)
        .in("status", ["done", "processing", "pending", "retry", "dead"])
        .order("created_at", { ascending: true })
        .limit(300),

      // hub_atividades: registros de mensagens humanas e ações da IA
      supabase
        .from("hub_atividades")
        .select("id, descricao, feito_por, feito_por_tipo, criado_em, metadata")
        .eq("lead_id", leadId)
        .eq("tipo", "mensagem")
        .order("criado_em", { ascending: true })
        .limit(300),
    ]);

    // Normaliza hub_msg_jobs (mensagens inbound históricas — payload do worker)
    type JobRow = {
      id: string;
      created_at: string;
      payload?: Record<string, unknown> | null;
    };

    const fromJobs = (jobsRes.data ?? [])
      .filter((j: JobRow) => {
        const txt = String((j.payload?.mensagemFinal ?? j.payload?.mensagem ?? "")).trim();
        return txt.length > 0;
      })
      .map((j: JobRow) => {
        const txt = String((j.payload?.mensagemFinal ?? j.payload?.mensagem ?? "")).trim();
        const ts = String(j.payload?.timestamp ?? j.created_at ?? "");
        return {
          id: `job-${j.id}`,
          conteudo: txt,
          direcao: "entrada" as const,
          criado_em: ts,
          agente_id: undefined as string | undefined,
          metadata: {
            feito_por_tipo: "lead",
            _source: "hub_msg_jobs",
            push_name: j.payload?.pushName ?? null,
          },
        };
      });

    // Normaliza hub_mensagens para o mesmo formato do chat
    type HubMsg = {
      id: string;
      conteudo: string;
      remetente: string;
      agente_id?: string | null;
      enviada_em: string;
      tipo_conteudo?: string | null;
    };

    const fromHub = (hubRes.data ?? []).map((m: HubMsg) => ({
      id: `hm-${m.id}`,
      conteudo: String(m.conteudo ?? ""),
      direcao: m.remetente === "lead" ? "entrada" : "saida",
      criado_em: m.enviada_em,
      agente_id:
        m.agente_id?.trim() ||
        (m.remetente === "ia" ? "ia" : m.remetente === "lead" ? undefined : m.remetente),
      metadata: {
        feito_por_tipo: m.remetente === "ia" ? "ia" : m.remetente === "lead" ? "lead" : "humano",
        _source: "hub_mensagens",
      },
    }));

    // Chave de deduplicação: conteúdo (50 chars) + janela de 2 minutos
    // Evita mostrar a mesma mensagem salva em múltiplas tabelas
    const hubKeys = new Set(
      fromHub.map((m) => {
        const bucket = Math.floor(new Date(m.criado_em).getTime() / 120_000);
        return `${m.conteudo.slice(0, 50)}|${bucket}`;
      })
    );

    // Remove jobs que já estão na fila ou hub_mensagens
    const filaInboundKeys = new Set(
      (filaRes.data ?? [])
        .filter((m: { direcao: string; conteudo: string; criado_em: string }) => m.direcao === "entrada")
        .map((m: { direcao: string; conteudo: string; criado_em: string }) => {
          const bucket = Math.floor(new Date(m.criado_em).getTime() / 120_000);
          return `${String(m.conteudo ?? "").slice(0, 50)}|${bucket}`;
        })
    );
    const fromJobsFiltered = fromJobs.filter((j) => {
      const bucket = Math.floor(new Date(j.criado_em).getTime() / 120_000);
      const key = `${j.conteudo.slice(0, 50)}|${bucket}`;
      return !hubKeys.has(key) && !filaInboundKeys.has(key);
    });

    type FilaMsg = {
      id: string;
      conteudo: string;
      direcao: string;
      criado_em: string;
      agente_id?: string | null;
      metadata?: Record<string, unknown> | null;
      status?: string | null;
    };

    // Deduplicação dentro da própria hub_fila_mensagens (janela 2 min + conteúdo)
    const filaKeys = new Set<string>();
    const fromFila = (filaRes.data ?? [])
      .filter((m: FilaMsg) => {
        const bucket = Math.floor(new Date(m.criado_em).getTime() / 120_000);
        const keyHub = `${String(m.conteudo ?? "").slice(0, 50)}|${bucket}`;
        // filtra duplicatas com hub_mensagens
        if (hubKeys.has(keyHub)) return false;
        // filtra duplicatas dentro da própria fila (ex: inbound salvo duas vezes)
        const keyFila = `${m.direcao}|${keyHub}`;
        if (filaKeys.has(keyFila)) return false;
        filaKeys.add(keyFila);
        return true;
      })
      .map((m: FilaMsg) => ({
        id: `fila-${m.id}`,
        conteudo: String(m.conteudo ?? ""),
        direcao: m.direcao as "entrada" | "saida",
        criado_em: m.criado_em,
        agente_id: m.agente_id ?? undefined,
        metadata: {
          ...(m.metadata && typeof m.metadata === "object" ? m.metadata : {}),
          _source: "hub_fila_mensagens",
          _status: m.status,
        },
      }));

    // Normaliza hub_atividades (mensagens humanas e IA registradas por ação)
    type AtivRow = {
      id: string;
      descricao: string;
      feito_por: string;
      feito_por_tipo?: string | null;
      criado_em: string;
      metadata?: Record<string, unknown> | null;
    };

    const allKeys = new Set<string>();
    [...fromHub, ...fromFila, ...fromJobsFiltered].forEach(m => {
      const bucket = Math.floor(new Date(m.criado_em).getTime() / 120_000);
      allKeys.add(`${String(m.conteudo ?? "").slice(0, 50)}|${bucket}`);
    });

    const fromAtiv = (ativRes.data ?? [])
      .filter((a: AtivRow) => {
        const txt = String(a.descricao ?? "").trim();
        if (!txt) return false;
        // Ignora entradas como "Assumiu atendimento" (não são mensagens de chat)
        if (txt.length < 3 || txt.startsWith("Assumiu") || txt.startsWith("Devolveu") || txt.startsWith("Retomou")) return false;
        const bucket = Math.floor(new Date(a.criado_em).getTime() / 120_000);
        const key = `${txt.slice(0, 50)}|${bucket}`;
        if (allKeys.has(key)) return false;
        allKeys.add(key);
        return true;
      })
      .map((a: AtivRow) => ({
        id: `atv-${a.id}`,
        conteudo: String(a.descricao ?? "").trim(),
        direcao: "saida" as const,
        criado_em: a.criado_em,
        agente_id: a.feito_por ?? undefined,
        metadata: {
          feito_por_tipo: a.feito_por_tipo ?? "ia",
          _source: "hub_atividades",
          ...(a.metadata ?? {}),
        },
      }));

    // Merge + ordena por tempo (quatro fontes)
    const mensagens = [...fromJobsFiltered, ...fromHub, ...fromFila, ...fromAtiv].sort(
      (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()
    );

    return NextResponse.json({ mensagens });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg, mensagens: [] }, { status: 500 });
  }
}
