"use client";
import React from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import {
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  Contact,
  FileText,
  Info,
  MessageSquare,
  Phone,
  Send,
  User,
  UserCheck,
  X,
} from "lucide-react";

interface Lead {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  valor_estimado?: number;
  estagio: string;
  origem: string;
  criado_em: string;
  agente_responsavel?: string;
  humano_responsavel?: string;
  score?: number;
  ultimo_contato?: string;
  campanha?: string;
  proxima_acao?: string;
  data_proxima_acao?: string;
  interesse_principal?: string;
  tags?: string[];
  observacoes?: unknown;
  metadata?: Record<string, unknown>;
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

/** MANIFEST: verde #003b26, dourado #c9a24a, fundo #0d1117 */
const C = {
  bg: "bg-[#0d1117]",
  bgAlt: "bg-[#0a0e14]",
  border: "border-white/[0.08]",
  gold: "text-[#c9a24a]",
  green: "bg-[#003b26]",
} as const;

type ModoAtend = "todos" | "meus" | "humano" | "ia";

const MODO_LABEL: Record<ModoAtend, string> = {
  todos: "Todos",
  meus: "Meus",
  humano: "Humano",
  ia: "IA",
};

/** Slug do primeiro nome em lowercase — mesmo cálculo do server (atendimento-handoff.ts). */
function slugFromMeta(name?: string | null, email?: string | null): string {
  const n = name?.trim();
  if (n) return n.split(" ")[0].toLowerCase().slice(0, 40);
  const e = email?.trim();
  if (e) return e.split("@")[0].toLowerCase().slice(0, 40);
  return "";
}

function AtendimentoContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSlot } = useCrmHeaderSlot();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;

  // Identidade do operador logado
  const [meuSlug, setMeuSlug] = useState("");
  const [meuNome, setMeuNome] = useState("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSel, setLeadSel] = useState<Lead | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [modoAtend, setModoAtend] = useState<ModoAtend>("todos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagensLoadError, setMensagensLoadError] = useState<string | null>(null);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [sendStrip, setSendStrip] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const leadsCarregados = useRef(false);
  const modoScrollRef = useRef<HTMLDivElement>(null);
  const estagioScrollRef = useRef<HTMLDivElement>(null);

  function scrollChips(ref: React.RefObject<HTMLDivElement | null>, dir: "left" | "right") {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === "right" ? 100 : -100, behavior: "smooth" });
  }

  // ── Resolver operador logado ─────────────────────────────────────────────
  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const meta = user.user_metadata as { name?: string } | undefined;
      const slug = slugFromMeta(meta?.name, user.email);
      const nome = meta?.name?.trim() || user.email?.split("@")[0] || "";
      setMeuSlug(slug);
      setMeuNome(nome);
    });
  }, []);

  // ── Estado derivado do lead selecionado ──────────────────────────────────
  const humanoAtual = leadSel?.humano_responsavel?.trim() || "";
  /** Sou eu o responsável atual */
  const assumido = !!humanoAtual && humanoAtual === meuSlug;
  /** Outro operador (ou celular) está atendendo */
  const outroHumano = !!humanoAtual && humanoAtual !== meuSlug;
  /** Pode escrever */
  const podeEscrever = assumido;

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  // ── Deep link: ?lead=<id> ────────────────────────────────────────────────
  useEffect(() => {
    if (!leadsCarregados.current || leads.length === 0) return;
    const leadId = searchParams.get("lead");
    if (leadId) {
      const found = leads.find(l => l.id === leadId);
      if (found) selecionarLead(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, leads]);

  // ── Polling de leads ─────────────────────────────────────────────────────
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
      email: d.email as string,
      estagio: (d.estagio as string) || "novo",
      origem: (d.origem as string) || "whatsapp",
      valor_estimado: d.valor_estimado as number,
      criado_em: d.criado_em as string,
      agente_responsavel: d.agente_responsavel as string,
      humano_responsavel: d.humano_responsavel as string,
      score: d.score as number,
      ultimo_contato: d.ultimo_contato as string,
      campanha: d.campanha as string,
      proxima_acao: d.proxima_acao as string,
      data_proxima_acao: d.data_proxima_acao as string,
      interesse_principal: d.interesse_principal as string,
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
      observacoes: d.observacoes,
      metadata: (d.metadata && typeof d.metadata === "object" ? d.metadata : undefined) as Record<string, unknown> | undefined,
    })));
    leadsCarregados.current = true;
    setCarregando(false);
  }

  // ── Mensagens ────────────────────────────────────────────────────────────
  const carregarMensagens = useCallback(async (leadId: string, opts?: { quiet?: boolean }) => {
    const quiet = opts?.quiet === true;
    if (!quiet) {
      setMensagensLoadError(null);
      setCarregandoMensagens(true);
    }
    try {
      const res = await fetch(
        `/api/crm/atendimento/mensagens?leadId=${encodeURIComponent(leadId)}`,
        { credentials: "include", headers: internalApiHeaders() }
      );
      const json: { mensagens?: unknown; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensagens([]);
        if (!quiet) setMensagensLoadError(typeof json.error === "string" ? json.error : "Não foi possível carregar as mensagens.");
        return;
      }
      const raw = (json.mensagens ?? []) as Record<string, unknown>[];
      setMensagens(raw.map((m) => ({
        id: String(m.id ?? ""),
        conteudo: String(m.conteudo ?? ""),
        direcao: (m.direcao === "entrada" || m.direcao === "saida" ? m.direcao : "entrada") as "entrada" | "saida",
        criado_em: String(m.criado_em ?? ""),
        agente_id: m.agente_id as string | undefined,
        metadata: (m.metadata && typeof m.metadata === "object" ? m.metadata : undefined) as Record<string, unknown> | undefined,
      })));
      if (!quiet) setMensagensLoadError(null);
    } catch {
      setMensagens([]);
      if (!quiet) setMensagensLoadError("Erro de rede ao carregar mensagens.");
    } finally {
      if (!quiet) setCarregandoMensagens(false);
    }
  }, []);

  function selecionarLead(lead: Lead) {
    setLeadSel(lead);
    setTexto("");
    setSendStrip(null);
    setMensagensLoadError(null);
    setInfoOpen(false);
  }

  // Auto-dismiss strips
  useEffect(() => {
    if (!sendStrip || sendStrip.kind === "error") return;
    const ms = sendStrip.kind === "info" ? 8000 : 4500;
    const t = window.setTimeout(() => setSendStrip(null), ms);
    return () => window.clearTimeout(t);
  }, [sendStrip]);

  useEffect(() => {
    if (!infoOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setInfoOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [infoOpen]);

  // Sincroniza ficha quando lista atualiza
  useEffect(() => {
    if (!leadSel) return;
    const fresh = leads.find((l) => l.id === leadSel.id);
    if (fresh) setLeadSel(fresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, leadSel?.id]);

  // Realtime INSERT em hub_fila_mensagens E hub_mensagens
  useEffect(() => {
    if (!leadSel) {
      setMensagens([]);
      setMensagensLoadError(null);
      setCarregandoMensagens(false);
      return;
    }
    setMensagens([]);
    void carregarMensagens(leadSel.id);
    // Escuta inserções nas duas tabelas onde a conversa é armazenada
    const channel = supabase
      .channel(`atend-${leadSel.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "hub_fila_mensagens",
        filter: `lead_id=eq.${leadSel.id}`,
      }, () => { void carregarMensagens(leadSel.id, { quiet: true }); })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "hub_mensagens",
        filter: `lead_id=eq.${leadSel.id}`,
      }, () => { void carregarMensagens(leadSel.id, { quiet: true }); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [leadSel?.id, carregarMensagens]);

  // ── Assumir via API ───────────────────────────────────────────────────────
  async function assumirAtendimento() {
    if (!leadSel) return;
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/crm/atendimento/assumir", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ leadId: leadSel.id }),
      });
      const json: { ok?: boolean; error?: string; operadorSlug?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendStrip({ kind: "error", text: json.error ?? "Não foi possível assumir o atendimento." });
        return;
      }
      const slug = json.operadorSlug || meuSlug;
      setLeadSel(prev => prev ? { ...prev, humano_responsavel: slug } : prev);
      setLeads(prev => prev.map(l => l.id === leadSel.id ? { ...l, humano_responsavel: slug } : l));
    } catch {
      setSendStrip({ kind: "error", text: "Erro de rede ao assumir." });
    }
  }

  // ── Devolver à IA via API ─────────────────────────────────────────────────
  async function devolverIA() {
    if (!leadSel) return;
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/crm/atendimento/devolver", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ leadId: leadSel.id }),
      });
      const json: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendStrip({ kind: "error", text: json.error ?? "Não foi possível devolver à IA." });
        return;
      }
      setLeadSel(prev => prev ? { ...prev, humano_responsavel: undefined } : prev);
      setLeads(prev => prev.map(l => l.id === leadSel.id ? { ...l, humano_responsavel: undefined } : l));
    } catch {
      setSendStrip({ kind: "error", text: "Erro de rede ao devolver." });
    }
  }

  // ── Enviar mensagem via API ───────────────────────────────────────────────
  async function enviarMensagem() {
    if (!leadSel || !texto.trim() || enviando) return;
    setEnviando(true);
    setSendStrip(null);
    const msg = texto.trim();
    setTexto("");
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/crm/atendimento/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ leadId: leadSel.id, texto: msg }),
      });
      const json: { error?: string; whatsappSkipped?: boolean } = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errText =
          res.status === 502 || res.status === 403
            ? (json.error ?? "Operação não permitida ou serviço indisponível.")
            : (json.error ?? "Não foi possível enviar a mensagem.");
        setTexto(msg);
        setSendStrip({ kind: "error", text: errText });
        return;
      }
      if (json.whatsappSkipped) {
        setSendStrip({
          kind: "info",
          text: "Mensagem registada no CRM. Nada foi enviado ao WhatsApp (dry-run). Configure UAZAPI_BASE_URL + token.",
        });
      } else {
        setSendStrip({ kind: "success", text: "Mensagem enviada." });
      }
      await carregarMensagens(leadSel.id);
    } catch {
      setTexto(msg);
      setSendStrip({ kind: "error", text: "Erro de rede ao enviar." });
    } finally {
      setEnviando(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const rel = (d: string) => {
    const m = (Date.now() - new Date(d).getTime()) / 60000;
    return m < 1 ? "agora" : m < 60 ? `${Math.round(m)}min` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  };

  const formatarDataHora = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const textoObservacoes = (v: unknown): string => {
    if (v == null) return "—";
    if (typeof v === "string") return v.trim() || "—";
    if (Array.isArray(v)) {
      const flat = v.map((x) => String(x ?? "").trim()).filter(Boolean);
      return flat.length ? flat.join(" · ") : "—";
    }
    if (typeof v === "object") {
      const s = JSON.stringify(v);
      return s && s !== "{}" && s !== "[]" ? s : "—";
    }
    return String(v).trim() || "—";
  };

  // ── Leads filtrados (estágio + modo de atendimento + busca) ──────────────
  const leadsFiltrados = useMemo(() => {
    let l = leads;
    if (filtro !== "todos") l = l.filter(x => x.estagio === filtro);
    if (modoAtend === "meus" && meuSlug) l = l.filter(x => x.humano_responsavel === meuSlug);
    if (modoAtend === "humano") l = l.filter(x => !!x.humano_responsavel);
    if (modoAtend === "ia") l = l.filter(x => !x.humano_responsavel);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      l = l.filter(x => x.nome.toLowerCase().includes(q) || (x.telefone ?? "").includes(q));
    }
    return l;
  }, [leads, filtro, modoAtend, meuSlug, busca]);

  const filtrosAtendimento = ["todos", "novo", "qualificando", "qualificado", "atendimento", "negociando"] as const;

  // Header slot
  useEffect(() => {
    setSlot(
      <div className="flex items-center gap-3">
        <span className="text-zinc-400 text-sm hidden sm:inline">
          {carregando ? "A carregar…" : `${leads.length} conversa${leads.length !== 1 ? "s" : ""}`}
        </span>
        {meuNome && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#c9a24a]/25 bg-[#c9a24a]/10 px-3 py-1 text-[11px] text-[#c9a24a] font-medium">
            <UserCheck size={12} strokeWidth={2.5} />
            {meuNome}
          </span>
        )}
      </div>
    );
    return () => setSlot(null);
  }, [setSlot, leads.length, carregando, meuNome, pathname]);

  // ── Modo do lead selecionado ──────────────────────────────────────────────
  /** Badge de modo: label + cor CSS */
  function modoBadge(lead: Lead) {
    const h = lead.humano_responsavel?.trim();
    if (!h) return null;
    if (meuSlug && h === meuSlug) return { label: "Meus", color: "#c9a24a" };
    return { label: h.charAt(0).toUpperCase() + h.slice(1, 12), color: "#22c55e" };
  }

  /** Pílula de modo no chat header */
  function modoHeaderPill() {
    if (!leadSel) return null;
    const h = leadSel.humano_responsavel?.trim();
    if (!h) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-950/50 px-2.5 py-1 text-[11px] text-sky-300 font-medium">
          <Bot size={12} strokeWidth={2.5} aria-hidden />
          IA ativa
        </span>
      );
    }
    if (meuSlug && h === meuSlug) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c9a24a]/40 bg-[#c9a24a]/10 px-2.5 py-1 text-[11px] text-[#c9a24a] font-medium">
          <UserCheck size={12} strokeWidth={2.5} aria-hidden />
          Você atendendo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-600/35 bg-green-950/50 px-2.5 py-1 text-[11px] text-green-300 font-medium">
        <User size={12} strokeWidth={2.5} aria-hidden />
        {h.charAt(0).toUpperCase() + h.slice(1, 20)} atendendo
      </span>
    );
  }

  /** Label remetente de uma msg de saída */
  function labelRemetente(msg: Mensagem): string {
    if (!msg.agente_id) return "IA";
    if (meuSlug && msg.agente_id === meuSlug) return "Você";
    const isIa = !["wendel", "celular"].includes(msg.agente_id) &&
      !leads.find(() => false); // sempre IA se não for slug humano conhecido
    // heurística: se agente_id contém apenas letras simples e está no meuSlug ou humano_responsavel → humano
    const looksHuman =
      msg.metadata?.feito_por_tipo === "humano" ||
      (leadSel?.humano_responsavel && msg.agente_id === leadSel.humano_responsavel);
    if (looksHuman) {
      const nome = String(msg.agente_id);
      return nome.charAt(0).toUpperCase() + nome.slice(1, 20);
    }
    return `IA · ${msg.agente_id}`;
  }

  /** True se a mensagem de saída é de um humano */
  function isMsgHumana(msg: Mensagem): boolean {
    if (msg.metadata?.feito_por_tipo === "humano") return true;
    if (meuSlug && msg.agente_id === meuSlug) return true;
    if (leadSel?.humano_responsavel && msg.agente_id === leadSel.humano_responsavel) return true;
    return false;
  }

  /** True se a mensagem foi enviada por mim */
  function isMsgMinha(msg: Mensagem): boolean {
    return !!meuSlug && msg.agente_id === meuSlug;
  }

  // ── Placeholder do composer ───────────────────────────────────────────────
  function composerPlaceholder(): string {
    if (assumido) return "Escreva a resposta… (Enter envia · Shift+Enter nova linha)";
    if (outroHumano) return `Atendimento com ${humanoAtual} — assuma para escrever`;
    return "Assuma o atendimento para escrever";
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`flex h-full min-h-0 ${C.bg} overflow-hidden`}>

      {/* COLUNA ESQUERDA — Lista de leads */}
      <div
        className={`flex flex-col border-r ${C.border} bg-[#090c11] flex-shrink-0 ${
          isMobile ? (leadSel ? "hidden" : "w-full") : "w-[17rem] xl:w-72"
        }`}
      >
        {/* Topo: título + operador */}
        <div className={`flex items-center justify-between gap-2 border-b ${C.border} px-3 py-3`}>
          <div>
            <p className="text-zinc-100 text-sm font-semibold">Inbox</p>
            <p className="text-zinc-500 text-[11px]">
              {carregando ? "A carregar…" : `${leadsFiltrados.length} / ${leads.length} conversas`}
            </p>
          </div>
          {meuSlug && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full border border-[#c9a24a]/20 bg-[#c9a24a]/8 px-2 py-0.5 text-[10px] text-[#c9a24a]/80 font-medium" title={meuNome}>
              <UserCheck size={10} strokeWidth={2.5} />
              {meuSlug.slice(0, 10)}
            </span>
          )}
        </div>

        {/* Busca */}
        <div className={`px-3 py-2 border-b ${C.border}`}>
          <input
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar lead…"
            className={`w-full bg-black/30 text-zinc-300 text-xs rounded-lg px-3 py-2 outline-none border ${C.border} focus:ring-1 focus:ring-[#c9a24a]/30 placeholder-zinc-600`}
          />
        </div>

        {/* Chips modo de atendimento */}
        <div className={`relative flex items-center border-b ${C.border}`}>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scrollChips(modoScrollRef, "left")}
            className="flex-shrink-0 flex items-center justify-center w-6 h-full pl-1 text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
          <div ref={modoScrollRef} className="flex gap-1 px-1 py-2 overflow-x-auto scrollbar-none flex-1">
            {(["todos", "meus", "humano", "ia"] as ModoAtend[]).map(m => {
              const count =
                m === "todos" ? leads.length
                : m === "meus" ? leads.filter(l => meuSlug && l.humano_responsavel === meuSlug).length
                : m === "humano" ? leads.filter(l => !!l.humano_responsavel).length
                : leads.filter(l => !l.humano_responsavel).length;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModoAtend(m)}
                  className={`flex-shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors border ${
                    modoAtend === m
                      ? m === "meus"
                        ? "border-[#c9a24a]/50 bg-[#c9a24a]/12 text-[#c9a24a]"
                        : m === "humano"
                          ? "border-green-600/40 bg-green-950/40 text-green-300"
                          : m === "ia"
                            ? "border-sky-500/35 bg-sky-950/40 text-sky-300"
                            : "border-white/15 bg-white/8 text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {MODO_LABEL[m]}
                  {count > 0 && (
                    <span className="rounded-full bg-white/10 px-1 py-0 text-[9px] tabular-nums">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Próximo"
            onClick={() => scrollChips(modoScrollRef, "right")}
            className="flex-shrink-0 flex items-center justify-center w-6 h-full pr-1 text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Chips estágio */}
        <div className={`relative flex items-center border-b ${C.border}`}>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scrollChips(estagioScrollRef, "left")}
            className="flex-shrink-0 flex items-center justify-center w-6 h-full pl-1 text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
          <div ref={estagioScrollRef} className="flex gap-1 px-1 py-2 overflow-x-auto scrollbar-none flex-1">
            {filtrosAtendimento.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors border ${
                  filtro === f
                    ? "border-white/15 bg-white/8 text-zinc-100"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {f === "todos" ? `Todos (${leads.length})` : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Próximo"
            onClick={() => scrollChips(estagioScrollRef, "right")}
            className="flex-shrink-0 flex items-center justify-center w-6 h-full pr-1 text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {carregando && leads.length === 0 && (
            <div className="text-center text-zinc-600 text-xs mt-10">A carregar conversas…</div>
          )}
          {!carregando && leadsFiltrados.length === 0 && (
            <div className="text-center text-zinc-600 text-xs mt-10">Nenhuma conversa neste filtro</div>
          )}
          {leadsFiltrados.map(lead => {
            const badge = modoBadge(lead);
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => selecionarLead(lead)}
                className={`min-h-14 w-full px-3 py-3 border-b border-white/[0.05] text-left transition-colors ${
                  leadSel?.id === lead.id
                    ? "bg-[#003b26]/35 border-l-2 border-l-[#c9a24a]"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 flex-shrink-0 rounded-full ring-1 ring-white/10 ${STATUS_COR[lead.estagio] || "bg-gray-500"}`} />
                    <span className="text-zinc-100 text-xs font-semibold truncate">{lead.nome}</span>
                  </div>
                  <span className="text-zinc-600 text-[10px] flex-shrink-0 ml-1 tabular-nums">{rel(lead.criado_em)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-[10px] uppercase tracking-wide truncate mr-2">
                    {lead.origem}
                    {lead.ultimo_contato ? ` · ${rel(lead.ultimo_contato)}` : ""}
                  </span>
                  {badge && (
                    <span
                      className="flex-shrink-0 text-[10px] font-semibold rounded px-1.5 py-0.5"
                      style={{ color: badge.color, background: `${badge.color}18`, border: `1px solid ${badge.color}35` }}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ÁREA DO CHAT */}
      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0e14] ${isMobile && !leadSel ? "hidden" : ""}`}>
        {!leadSel ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center max-w-sm">
              <div
                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#003b26]/30 mb-4 text-[#c9a24a]"
                aria-hidden
              >
                <MessageSquare size={28} strokeWidth={1.75} />
              </div>
              <p className="text-zinc-300 text-sm font-medium">Selecione um lead para atender</p>
              <p className="text-zinc-600 text-xs mt-2">{leads.length} conversas carregadas</p>
            </div>
          </div>
        ) : (
          <>
            {/* Cabeçalho do chat */}
            <div className={`flex flex-shrink-0 items-center justify-between border-b ${C.border} bg-black/20 px-4 py-3`}>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setLeadSel(null)}
                  className="mr-2 flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300"
                  aria-label="Voltar"
                >
                  ←
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-zinc-50 font-semibold text-sm truncate">{leadSel.nome}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COR[leadSel.estagio] || "bg-gray-500"}`} />
                  <span className="text-zinc-500 text-[11px]">{STATUS_LABEL[leadSel.estagio] || leadSel.estagio}</span>
                  {leadSel.telefone && (
                    <span className="text-zinc-600 text-[11px]">· {leadSel.telefone}</span>
                  )}
                  {modoHeaderPill()}
                </div>
              </div>

              {/* Botões de ação */}
              <div className={`flex items-center rounded-xl border ${C.border} bg-black/30 p-1 gap-0.5 flex-shrink-0 shadow-sm shadow-black/20 ml-3`}>
                {assumido ? (
                  <span className={`${C.green} flex items-center gap-1.5 text-white text-[11px] px-3 py-1.5 rounded-lg font-semibold ring-1 ring-white/10`}>
                    <UserCheck size={14} strokeWidth={2} aria-hidden />
                    A atender
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void assumirAtendimento()}
                    className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[#c9a24a] text-[11px] px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    <UserCheck size={14} strokeWidth={2} className="text-[#c9a24a]" aria-hidden />
                    Assumir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/crm/leads/${leadSel.id}`)}
                  className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[#c9a24a] text-[11px] px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <FileText size={14} strokeWidth={2} aria-hidden />
                  Ver ficha
                </button>
                <button
                  type="button"
                  onClick={() => setInfoOpen(true)}
                  className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[#c9a24a] text-[11px] px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <Info size={14} strokeWidth={2} aria-hidden />
                  Info
                </button>
                {assumido && (
                  <button
                    type="button"
                    onClick={() => void devolverIA()}
                    className="flex items-center gap-1.5 bg-sky-950/50 hover:bg-sky-950/70 border border-sky-500/35 text-sky-100 text-[11px] px-3 py-1.5 rounded-lg transition-colors font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    title="Voltar a responder com IA"
                  >
                    <Bot size={14} strokeWidth={2} className="text-sky-300 shrink-0" aria-hidden />
                    Devolver à IA
                  </button>
                )}
              </div>
            </div>

            {/* Mensagens */}
            <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {mensagensLoadError && (
                <div className="rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-[12px] text-red-200/95 mb-3">
                  {mensagensLoadError}
                </div>
              )}
              {carregandoMensagens && mensagens.length === 0 && !mensagensLoadError && (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <div className="w-5 h-5 border-2 border-zinc-600 border-t-[#c9a24a] rounded-full animate-spin" />
                  <span className="text-zinc-600 text-xs">A carregar mensagens…</span>
                </div>
              )}
              {!carregandoMensagens && !mensagensLoadError && mensagens.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-6">
                  <div className="w-10 h-10 rounded-full bg-zinc-800/60 border border-white/[0.07] flex items-center justify-center">
                    <MessageSquare size={18} strokeWidth={1.5} className="text-zinc-600" />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm font-medium">Sem mensagens nesta conversa</p>
                    <p className="text-zinc-700 text-[11px] mt-1 leading-relaxed">
                      Mensagens anteriores ao sistema de histórico não foram preservadas.<br/>
                      Novas mensagens aparecerão aqui em tempo real.
                    </p>
                  </div>
                </div>
              )}

              {(() => {
                // ── Agrupamento e separadores de tempo ────────────────────
                type Tipo = "lead" | "ia" | "voce" | "humano";

                function tipoMsg(msg: Mensagem): Tipo {
                  if (msg.direcao === "entrada") return "lead";
                  if (isMsgMinha(msg)) return "voce";
                  if (isMsgHumana(msg)) return "humano";
                  return "ia";
                }

                function senderKey(msg: Mensagem): string {
                  return `${msg.direcao}-${msg.agente_id ?? ""}`;
                }

                const THEME = {
                  lead:   { avatar: "bg-zinc-700 text-zinc-100",       label: "text-zinc-500", bubble: "bg-[#1e2128] text-zinc-100 border border-white/[0.07]",       tail: "rounded-tl-[4px]" },
                  ia:     { avatar: "bg-[#003b26] text-emerald-300 border border-emerald-500/30", label: "text-emerald-400", bubble: "bg-[#003b26]/80 text-emerald-50 border border-emerald-500/20",  tail: "rounded-tr-[4px]" },
                  voce:   { avatar: "bg-[#c9a24a]/20 text-[#c9a24a] border border-[#c9a24a]/35", label: "text-[#c9a24a]",   bubble: "bg-[#2a1f08]/80 text-[#f4e8c9] border border-[#c9a24a]/25",   tail: "rounded-tr-[4px]" },
                  humano: { avatar: "bg-green-900/60 text-green-300 border border-green-600/30", label: "text-green-400",   bubble: "bg-[#0e1f0e]/80 text-zinc-100 border border-green-600/20",     tail: "rounded-tr-[4px]" },
                } as const;

                function avatarContent(tipo: Tipo, msg: Mensagem) {
                  if (tipo === "ia") return <Bot size={14} strokeWidth={2} />;
                  if (tipo === "voce") return <span className="text-[11px] font-bold">{meuNome?.charAt(0)?.toUpperCase() || "V"}</span>;
                  if (tipo === "humano") return <span className="text-[11px] font-bold">{(msg.agente_id?.charAt(0) || "H").toUpperCase()}</span>;
                  return <span className="text-[11px] font-bold">{leadSel?.nome?.charAt(0)?.toUpperCase() || "L"}</span>;
                }

                function labelText(tipo: Tipo, msg: Mensagem) {
                  if (tipo === "lead") return leadSel?.nome?.split(" ")[0] ?? "Lead";
                  if (tipo === "ia") {
                    const slug = msg.agente_id || "sdr";
                    return `Mari · IA`;
                  }
                  if (tipo === "voce") return `Você · ${meuNome?.split(" ")[0] ?? ""}`.trimEnd().replace(/·\s*$/, "");
                  const h = msg.agente_id || "Humano";
                  return h.charAt(0).toUpperCase() + h.slice(1, 20);
                }

                function fmtHora(iso: string) {
                  const d = new Date(iso);
                  if (Number.isNaN(d.getTime())) return "";
                  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                }

                function fmtDia(iso: string) {
                  const d = new Date(iso);
                  if (Number.isNaN(d.getTime())) return "";
                  const hoje = new Date();
                  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
                  if (d.toDateString() === hoje.toDateString()) return "Hoje";
                  if (d.toDateString() === ontem.toDateString()) return "Ontem";
                  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                }

                const items: React.ReactNode[] = [];
                let lastDia = "";
                let lastKey = "";
                let groupCount = 0;

                mensagens.forEach((msg, idx) => {
                  const tipo = tipoMsg(msg);
                  const t = THEME[tipo];
                  const dir = msg.direcao === "entrada";
                  const key = senderKey(msg);
                  const nextMsg = mensagens[idx + 1];
                  const nextKey = nextMsg ? senderKey(nextMsg) : null;

                  // Separador de dia
                  const dia = fmtDia(msg.criado_em);
                  if (dia && dia !== lastDia) {
                    lastDia = dia;
                    items.push(
                      <div key={`sep-${msg.id}`} className="flex items-center gap-3 py-2 my-1">
                        <div className="flex-1 h-px bg-white/[0.06]" />
                        <span className="text-[10px] text-zinc-600 font-medium px-1 flex-shrink-0">{dia}</span>
                        <div className="flex-1 h-px bg-white/[0.06]" />
                      </div>
                    );
                  }

                  // Primeiro msg do grupo = mostra avatar + label; último = mostra hora
                  const isFirstInGroup = key !== lastKey;
                  const isLastInGroup = key !== nextKey;
                  lastKey = key;
                  if (isFirstInGroup) groupCount = 0;
                  groupCount++;

                  // Margem entre grupos vs dentro do grupo
                  const mt = isFirstInGroup ? "mt-3" : "mt-0.5";

                  items.push(
                    <div key={msg.id} className={`flex gap-2.5 items-end ${dir ? "justify-start" : "justify-end"} ${mt}`}>
                      {/* Avatar esquerda */}
                      {dir && (
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md ${t.avatar} ${isFirstInGroup ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                          {avatarContent(tipo, msg)}
                        </div>
                      )}

                      <div className={`flex flex-col ${dir ? "items-start" : "items-end"} max-w-[min(26rem,78vw)]`}>
                        {/* Label remetente (só no primeiro do grupo) */}
                        {isFirstInGroup && (
                          <span className={`text-[10px] font-semibold mb-1 px-1 flex items-center gap-1 ${t.label}`}>
                            {tipo === "ia" && <Bot size={10} strokeWidth={2.5} />}
                            {tipo === "voce" && <UserCheck size={10} strokeWidth={2.5} />}
                            {tipo === "humano" && <User size={10} strokeWidth={2.5} />}
                            {labelText(tipo, msg)}
                          </span>
                        )}

                        {/* Balão */}
                        <div className={`px-3.5 py-2 rounded-2xl ${t.tail} text-[13px] leading-relaxed shadow-sm ${t.bubble}`}>
                          <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                        </div>

                        {/* Hora (só no último do grupo) */}
                        {isLastInGroup && (
                          <span className="text-zinc-700 text-[10px] tabular-nums mt-0.5 px-1">{fmtHora(msg.criado_em)}</span>
                        )}
                      </div>

                      {/* Avatar direita */}
                      {!dir && (
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md ${t.avatar} ${isFirstInGroup ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                          {avatarContent(tipo, msg)}
                        </div>
                      )}
                    </div>
                  );
                });

                return items;
              })()}
            </div>

            {/* Composer */}
            <div className={`flex-shrink-0 p-3 border-t ${C.border} bg-black/25`}>
              {sendStrip && (
                <div className={`mb-2 rounded-md px-3 py-2 text-[11px] border ${
                  sendStrip.kind === "error"
                    ? "border-red-500/40 bg-red-950/50 text-red-200"
                    : sendStrip.kind === "info"
                      ? "border-amber-500/40 bg-amber-950/40 text-amber-100/95"
                      : "border-[#003b26]/50 bg-[#003b26]/25 text-zinc-200"
                }`}>
                  {sendStrip.text}
                </div>
              )}
              {!podeEscrever && !outroHumano && (
                <div className={`mb-2 flex items-center gap-2 rounded-lg border ${C.border} bg-black/25 px-3 py-2`}>
                  <Bot size={14} strokeWidth={2} className="text-sky-400 shrink-0" />
                  <span className="text-zinc-500 text-[11px]">IA está respondendo por este lead</span>
                  <button
                    type="button"
                    onClick={() => void assumirAtendimento()}
                    className="ml-auto text-[11px] text-[#c9a24a] hover:text-[#e0c068] underline underline-offset-2 font-medium"
                  >
                    Assumir
                  </button>
                </div>
              )}
              {outroHumano && (
                <div className={`mb-2 flex items-center gap-2 rounded-lg border border-green-600/25 bg-green-950/20 px-3 py-2`}>
                  <User size={14} strokeWidth={2} className="text-green-400 shrink-0" />
                  <span className="text-zinc-400 text-[11px]">
                    <span className="text-green-300 font-medium capitalize">{humanoAtual}</span> está atendendo
                  </span>
                  <button
                    type="button"
                    onClick={() => void assumirAtendimento()}
                    className="ml-auto text-[11px] text-[#c9a24a] hover:text-[#e0c068] underline underline-offset-2 font-medium"
                  >
                    Assumir
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-stretch">
                <textarea
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  disabled={!podeEscrever}
                  placeholder={composerPlaceholder()}
                  rows={2}
                  className={`flex-1 bg-black/30 disabled:opacity-40 text-zinc-100 text-xs rounded-xl px-3 py-2.5 outline-none resize-none border ${C.border} focus:ring-1 focus:ring-[#c9a24a]/35 placeholder-zinc-600`}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviarMensagem(); }
                  }}
                />
                <div className={`rounded-xl border ${C.border} bg-black/25 p-1 min-w-[7.5rem] sm:min-w-[8.5rem]`}>
                  <button
                    type="button"
                    onClick={() => void enviarMensagem()}
                    disabled={!podeEscrever || !texto.trim() || enviando}
                    className={`inline-flex w-full min-h-[2.75rem] items-center justify-center gap-1.5 ${C.green} hover:brightness-110 disabled:opacity-40 text-white px-3 py-2.5 rounded-lg font-semibold text-[12px] transition-all`}
                  >
                    {enviando ? (
                      <span className="tabular-nums">…</span>
                    ) : (
                      <>
                        <Send size={15} strokeWidth={2} aria-hidden />
                        Enviar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SIDEOVER: Informações do lead */}
      {leadSel && infoOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={() => setInfoOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.55)", border: "none", padding: 0 }}
          />
          <aside
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0,
              width: "min(420px, 100vw)", zIndex: 60,
              background: "#0a0e14", borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
              display: "flex", flexDirection: "column", minHeight: 0,
            }}
          >
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: 16, background: "linear-gradient(180deg,#121a26 0%, #101722 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: "#c9a24a", fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>ATENDIMENTO</p>
                  <h3 style={{ margin: "3px 0 0", color: "#e6edf3", fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    Informações do lead
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoOpen(false)}
                  style={{ border: "1px solid #344256", background: "#1d2633", color: "#9eb0c8", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  aria-label="Fechar"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {/* Dados do lead */}
              <div style={{ marginBottom: 18 }} className={`rounded-xl border ${C.border} bg-black/25 p-3`}>
                <p className={`${C.gold} text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2`}>
                  <Contact size={14} strokeWidth={2} aria-hidden />
                  Dados do lead
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Nome", value: leadSel.nome || "—" },
                    { label: "Estágio", value: STATUS_LABEL[leadSel.estagio] || leadSel.estagio },
                    { label: "Interesse", value: leadSel.interesse_principal || "—" },
                    { label: "Campanha", value: leadSel.campanha || "—" },
                    { label: "Agente IA", value: leadSel.agente_responsavel || "sdr" },
                    { label: "Score", value: `${leadSel.score ?? 0}/100` },
                    { label: "Valor est.", value: (leadSel.valor_estimado ?? 0) > 0 ? `R$ ${((leadSel.valor_estimado ?? 0) / 1000).toFixed(0)}k` : "—" },
                    { label: "Abertura", value: formatarDataHora(leadSel.criado_em) },
                    { label: "Tags", value: leadSel.tags?.length ? leadSel.tags.join(", ") : "—" },
                    { label: "Observações", value: textoObservacoes(leadSel.observacoes) },
                  ].map((i) => (
                    <div key={i.label} className={`rounded-lg border ${C.border} bg-black/25 px-3 py-2`}>
                      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wide">{i.label}</p>
                      <p className="text-zinc-100 text-[12px] font-medium mt-0.5 leading-snug break-words">{i.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Responsável atual */}
              <div style={{ marginBottom: 18 }} className={`rounded-xl border ${C.border} bg-black/25 p-3`}>
                <p className={`${C.gold} text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2`}>
                  <User size={14} strokeWidth={2} aria-hidden />
                  Responsável atual
                </p>
                <div className="space-y-2">
                  {[
                    {
                      label: "Modo",
                      value: leadSel.humano_responsavel
                        ? `Humano — ${leadSel.humano_responsavel}`
                        : "IA (automático)",
                    },
                    { label: "Agente IA", value: leadSel.agente_responsavel || "sdr" },
                    { label: "Último contato", value: formatarDataHora(leadSel.ultimo_contato) },
                  ].map((i) => (
                    <div key={i.label} className={`rounded-lg border ${C.border} bg-black/25 px-3 py-2`}>
                      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wide">{i.label}</p>
                      <p className="text-zinc-100 text-[12px] font-medium mt-0.5 leading-snug break-words">{i.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contato */}
              <div style={{ marginBottom: 18 }} className={`rounded-xl border ${C.border} bg-black/25 p-3`}>
                <p className={`${C.gold} text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2`}>
                  <Phone size={14} strokeWidth={2} aria-hidden />
                  Contato
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Telefone", value: leadSel.telefone || "—" },
                    { label: "E-mail", value: leadSel.email || "—" },
                  ].map((i) => (
                    <div key={i.label} className={`rounded-lg border ${C.border} bg-black/25 px-3 py-2`}>
                      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wide">{i.label}</p>
                      <p className="text-zinc-100 text-[12px] font-medium mt-0.5 leading-snug break-words">{i.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Qualificação IA */}
              <div style={{ marginBottom: 18 }} className={`rounded-xl border ${C.border} bg-black/25 p-3`}>
                <p className={`${C.gold} text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2`}>
                  <Brain size={14} strokeWidth={2} aria-hidden />
                  Qualificação IA
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Score", value: `${leadSel.score ?? 0}/100` },
                    { label: "Interesse", value: leadSel.interesse_principal || "—" },
                    { label: "Mercado", value: (typeof leadSel.metadata?.mercado === "string" && leadSel.metadata.mercado) || "—" },
                    { label: "1ª mensagem", value: (typeof leadSel.metadata?.primeira_mensagem === "string" && leadSel.metadata.primeira_mensagem) || "—" },
                  ].map((i) => (
                    <div key={i.label} className={`rounded-lg border ${C.border} bg-black/25 px-3 py-2`}>
                      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wide">{i.label}</p>
                      <p className="text-zinc-100 text-[12px] font-medium mt-0.5 leading-snug break-words">{i.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações rápidas */}
              <div className={`rounded-xl border ${C.border} bg-black/25 p-3`}>
                <p className={`${C.gold} text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2`}>
                  <Info size={14} strokeWidth={2} aria-hidden />
                  Ações
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => { void assumirAtendimento(); setInfoOpen(false); }}
                    disabled={assumido}
                    className={`w-full border ${C.border} bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-zinc-100 text-[12px] py-2.5 rounded-lg text-left px-3 transition-colors font-medium inline-flex items-center gap-2`}
                  >
                    <UserCheck size={15} strokeWidth={2} className="text-[#c9a24a]/90 shrink-0" aria-hidden />
                    Assumir atendimento
                  </button>
                  <button
                    type="button"
                    onClick={() => { void devolverIA(); setInfoOpen(false); }}
                    disabled={!assumido}
                    className={`w-full border ${C.border} bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-zinc-100 text-[12px] py-2.5 rounded-lg text-left px-3 transition-colors font-medium inline-flex items-center gap-2`}
                  >
                    <Bot size={15} strokeWidth={2} className="text-sky-400/90 shrink-0" aria-hidden />
                    Devolver à IA
                  </button>
                  <button
                    type="button"
                    onClick={() => { router.push(`/crm/leads/${leadSel.id}`); setInfoOpen(false); }}
                    className={`w-full border ${C.border} bg-white/[0.04] hover:bg-white/[0.08] text-zinc-100 text-[12px] py-2.5 rounded-lg text-left px-3 transition-colors font-medium inline-flex items-center gap-2`}
                  >
                    <FileText size={15} strokeWidth={2} className="text-[#c9a24a]/90 shrink-0" aria-hidden />
                    Ver ficha completa
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
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
