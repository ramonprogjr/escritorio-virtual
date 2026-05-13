"use client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";

interface Lead {
  id: string;
  nome: string;
  telefone?: string;
  valor_estimado?: number;
  estagio: string;
  origem: string;
  criado_em: string;
  agente_responsavel?: string;
  humano_responsavel?: string;
  score?: number;
}

interface Mensagem {
  id: string;
  conteudo: string;
  direcao: "entrada" | "saida";
  criado_em: string;
  agente_id?: string;
  metadata?: Record<string, unknown>;
}

const STATUS_COR: Record<string, string> = {
  novo: "bg-yellow-500", qualificando: "bg-cyan-500", qualificado: "bg-green-500",
  atendimento: "bg-blue-500", negociando: "bg-purple-500", fechamento: "bg-orange-500",
  ganho: "bg-emerald-500", perdido: "bg-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  novo: "Novo", qualificando: "Qualificando", qualificado: "Qualificado",
  atendimento: "Em Atendimento", negociando: "Negociando",
  fechamento: "Fechamento", ganho: "Ganho", perdido: "Perdido",
};

function AtendimentoContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSlot } = useCrmHeaderSlot();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSel, setLeadSel] = useState<Lead | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [assumido, setAssumido] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const leadsCarregados = useRef(false);

  // Auto-scroll ao fundo quando chegam mensagens
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  // Deep link: ?lead=<id>
  useEffect(() => {
    if (!leadsCarregados.current || leads.length === 0) return;
    const leadId = searchParams.get("lead");
    if (leadId) {
      const found = leads.find(l => l.id === leadId);
      if (found) selecionarLead(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, leads]);

  useEffect(() => {
    setCarregando(true);
    carregarLeads();
    const t = setInterval(carregarLeads, 30000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function carregarLeads() {
    const qs = filtro !== "todos" ? `?estagio=${filtro}` : "";
    const res = await fetch(`/api/crm/atendimento${qs}`, { headers: internalApiHeaders() });
    const json = await res.json();
    setLeads((json.leads ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      nome: (d.nome as string) || "Lead",
      telefone: d.telefone as string,
      estagio: (d.estagio as string) || "novo",
      origem: (d.origem as string) || "whatsapp",
      valor_estimado: d.valor_estimado as number,
      criado_em: d.criado_em as string,
      agente_responsavel: d.agente_responsavel as string,
      humano_responsavel: d.humano_responsavel as string,
      score: d.score as number,
    })));
    leadsCarregados.current = true;
    setCarregando(false);
  }

  const carregarMensagens = useCallback(async (leadId: string) => {
    const { data } = await supabase
      .from("hub_fila_mensagens")
      .select("*")
      .eq("lead_id", leadId)
      .order("criado_em", { ascending: true })
      .limit(100);
    if (data) {
      setMensagens(data.map((m: Record<string, unknown>) => ({
        id: m.id as string,
        conteudo: m.conteudo as string,
        direcao: m.direcao as "entrada" | "saida",
        criado_em: m.criado_em as string,
        agente_id: m.agente_id as string,
        metadata: m.metadata as Record<string, unknown>,
      })));
    }
  }, []);

  function selecionarLead(lead: Lead) {
    setLeadSel(lead);
    setAssumido(!!lead.humano_responsavel);
    setTexto("");
  }

  // Realtime por lead selecionado
  useEffect(() => {
    if (!leadSel) return;
    carregarMensagens(leadSel.id);
    const channel = supabase
      .channel(`atend-${leadSel.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "hub_fila_mensagens",
        filter: `lead_id=eq.${leadSel.id}`,
      }, () => carregarMensagens(leadSel.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [leadSel, carregarMensagens]);

  async function assumirAtendimento() {
    if (!leadSel) return;
    await supabase.from("hub_leads_crm").update({ humano_responsavel: "wendel" }).eq("id", leadSel.id);
    await supabase.from("hub_atividades").insert({
      lead_id: leadSel.id, tipo: "ia_acao",
      descricao: "Atendimento assumido por Wendel",
      feito_por: "wendel", feito_por_tipo: "humano",
    });
    setAssumido(true);
    setLeadSel(prev => prev ? { ...prev, humano_responsavel: "wendel" } : prev);
  }

  async function devolverIA() {
    if (!leadSel) return;
    await supabase.from("hub_leads_crm").update({ humano_responsavel: null }).eq("id", leadSel.id);
    await supabase.from("hub_atividades").insert({
      lead_id: leadSel.id, tipo: "ia_acao",
      descricao: "Atendimento devolvido para a IA",
      feito_por: "wendel", feito_por_tipo: "humano",
    });
    setAssumido(false);
    setLeadSel(prev => prev ? { ...prev, humano_responsavel: undefined } : prev);
  }

  async function enviarMensagem() {
    if (!leadSel || !texto.trim() || enviando) return;
    setEnviando(true);
    const msg = texto.trim();
    setTexto("");
    await supabase.from("hub_fila_mensagens").insert({
      lead_id: leadSel.id, agente_id: "wendel",
      canal: "whatsapp", direcao: "saida",
      conteudo: msg, status: "enviado",
      metadata: { feito_por: "humano", feito_por_nome: "Wendel" },
    });
    await supabase.from("hub_atividades").insert({
      lead_id: leadSel.id, tipo: "mensagem",
      descricao: `Mensagem enviada: ${msg.slice(0, 80)}`,
      feito_por: "wendel", feito_por_tipo: "humano",
    });
    await carregarMensagens(leadSel.id);
    setEnviando(false);
  }

  const rel = (d: string) => {
    const m = (Date.now() - new Date(d).getTime()) / 60000;
    return m < 1 ? "agora" : m < 60 ? `${Math.round(m)}min` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  };

  const filtrados = leads.filter(l =>
    !busca || l.nome.toLowerCase().includes(busca.toLowerCase())
  );

  useEffect(() => {
    setSlot({
      path: pathname,
      subtitle: `${leads.length} conversas ativas`,
      actions: (
        <div className="flex items-center gap-2 rounded-full bg-gray-800 px-3 py-1.5">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          <span className="text-xs font-bold text-green-400">Ariane online</span>
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, leads.length]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950">
      <div className="flex flex-1 overflow-hidden">

        {/* LISTA DE LEADS */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-800">
          <div className="p-3 border-b border-gray-800 space-y-2">
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar lead..."
              className="w-full bg-gray-800 text-white text-xs rounded-lg px-3 py-2 outline-none border border-gray-700 focus:border-orange-500"
            />
            <div className="flex gap-1 flex-wrap">
              {["todos", "novo", "qualificando", "qualificado", "atendimento", "negociando"].map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`text-xs px-2 py-1 rounded-full transition-colors ${filtro === f ? "bg-orange-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                  {f === "todos" ? "Todos" : STATUS_LABEL[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {carregando ? (
              <div className="p-4 text-center text-gray-500 text-xs">Carregando...</div>
            ) : filtrados.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-xs">Nenhum lead</div>
            ) : filtrados.map(lead => (
              <button key={lead.id} onClick={() => selecionarLead(lead)}
                className={`w-full p-3 border-b border-gray-800 text-left hover:bg-gray-800/60 transition-colors ${leadSel?.id === lead.id ? "bg-gray-800 border-l-2 border-l-orange-500" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 flex-shrink-0 rounded-full ${STATUS_COR[lead.estagio] || "bg-gray-500"}`} />
                    <span className="text-white text-xs font-bold truncate">{lead.nome}</span>
                  </div>
                  <span className="text-gray-500 text-xs flex-shrink-0 ml-1">{rel(lead.criado_em)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">{lead.origem}</span>
                  {lead.humano_responsavel && (
                    <span className="text-green-500 text-xs font-medium">● humano</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ÁREA DO CHAT */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {!leadSel ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-gray-500 text-sm">Selecione um lead para atender</p>
                <p className="text-gray-600 text-xs mt-1">{leads.length} conversas ativas</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header do chat */}
              <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <div>
                  <div className="text-white font-bold text-sm">{leadSel.nome}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COR[leadSel.estagio] || "bg-gray-500"}`} />
                    <span className="text-gray-400 text-xs">{STATUS_LABEL[leadSel.estagio] || leadSel.estagio}</span>
                    {leadSel.telefone && (
                      <span className="text-gray-600 text-xs">· {leadSel.telefone}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {assumido ? (
                    <span className="bg-green-900/60 text-green-400 text-xs px-3 py-1.5 rounded-lg font-bold">✓ Atendendo</span>
                  ) : (
                    <button onClick={assumirAtendimento}
                      className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition-colors">
                      Assumir
                    </button>
                  )}
                  <button onClick={() => router.push(`/crm/leads/${leadSel.id}`)}
                    className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                    Ver ficha
                  </button>
                </div>
              </div>

              {/* Mensagens com Realtime */}
              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {mensagens.length === 0 ? (
                  <div className="text-center text-gray-600 text-xs mt-8">Nenhuma mensagem ainda</div>
                ) : mensagens.map(msg => {
                  const entrada = msg.direcao === "entrada";
                  const isHumano = !entrada && msg.agente_id === "wendel";
                  return (
                    <div key={msg.id} className={`flex ${entrada ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-sm flex flex-col gap-0.5 ${entrada ? "items-start" : "items-end"}`}>
                        {!entrada && (
                          <span className="text-gray-600 text-xs mr-1">
                            {isHumano ? "👤 Wendel" : `🤖 ${msg.agente_id || "IA"}`}
                          </span>
                        )}
                        <div className={`px-3 py-2 rounded-2xl text-xs ${
                          entrada
                            ? "bg-gray-800 text-gray-200 rounded-bl-sm"
                            : isHumano
                              ? "bg-orange-700 text-white rounded-br-sm"
                              : "bg-[#003b26] text-white rounded-br-sm"
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                        </div>
                        <span className="text-gray-600 text-xs">{rel(msg.criado_em)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Barra de envio */}
              <div className="flex-shrink-0 p-3 bg-gray-900 border-t border-gray-800">
                {!assumido && (
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-yellow-600 text-xs">A IA está a gerir — assuma para responder manualmente</p>
                    <button onClick={assumirAtendimento}
                      className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded-lg font-bold transition-colors">
                      Assumir
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    disabled={!assumido}
                    placeholder={assumido ? "Digite a resposta… (Enter envia · Shift+Enter nova linha)" : "Assuma o atendimento para escrever"}
                    rows={2}
                    className="flex-1 bg-gray-800 disabled:opacity-40 text-white text-xs rounded-xl px-3 py-2 outline-none resize-none border border-gray-700 focus:border-orange-500 placeholder-gray-600"
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensagem(); }
                    }}
                  />
                  <div className="flex flex-col gap-1">
                    <button onClick={enviarMensagem}
                      disabled={!assumido || !texto.trim() || enviando}
                      className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white px-4 rounded-xl font-bold text-sm transition-colors flex-1">
                      {enviando ? "…" : "→"}
                    </button>
                    <button onClick={devolverIA}
                      disabled={!assumido}
                      className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-1 rounded-xl text-xs transition-colors whitespace-nowrap">
                      ↩ IA
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* PAINEL DIREITO */}
        {leadSel && (
          <div className="w-56 flex-shrink-0 border-l border-gray-800 overflow-y-auto p-3 space-y-4">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">Informações</p>
              <div className="space-y-1.5">
                {[
                  { label: "Status",      value: STATUS_LABEL[leadSel.estagio] || leadSel.estagio },
                  { label: "Origem",      value: leadSel.origem || "—" },
                  { label: "Agente IA",   value: leadSel.agente_responsavel || "sdr" },
                  { label: "Responsável", value: leadSel.humano_responsavel || "IA" },
                  { label: "Score",       value: `${leadSel.score ?? 0}/100` },
                  { label: "Valor",       value: (leadSel.valor_estimado ?? 0) > 0 ? `R$ ${((leadSel.valor_estimado ?? 0) / 1000).toFixed(0)}k` : "—" },
                  { label: "Criado em",   value: new Date(leadSel.criado_em).toLocaleDateString("pt-BR") },
                ].map(i => (
                  <div key={i.label} className="bg-gray-800/60 rounded-lg p-2">
                    <p className="text-gray-500 text-xs">{i.label}</p>
                    <p className="text-white text-xs font-bold capitalize truncate">{i.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">Ações</p>
              <div className="space-y-1.5">
                <button onClick={() => router.push(`/crm/leads/${leadSel.id}`)}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white text-xs py-2 rounded-lg text-left px-3 transition-colors">
                  📋 Ver ficha completa
                </button>
                <button onClick={assumirAtendimento} disabled={assumido}
                  className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-xs py-2 rounded-lg text-left px-3 transition-colors">
                  👤 Assumir atendimento
                </button>
                <button onClick={devolverIA} disabled={!assumido}
                  className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-xs py-2 rounded-lg text-left px-3 transition-colors">
                  🤖 Devolver à IA
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AtendimentoPage() {
  return (
    <Suspense>
      <AtendimentoContent />
    </Suspense>
  );
}
