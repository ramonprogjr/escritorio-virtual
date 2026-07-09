"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowLeft, Bot, Wrench, MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import { CrmButton } from "@/components/crm/CrmButton";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { montarPayloadCriacaoAgente } from "@/lib/crm/montar-payload-criacao-agente";

/**
 * F6 — "criar agente com IA" (o diamante). O dono descreve; a IA devolve um blueprint validado contra os
 * catálogos reais; o dono revisa e cria. A criação usa o MESMO montador de payload do wizard (lib F5) +
 * o system_prompt_base/conhecimento do blueprint; aterrissa na ficha para refinar e publicar.
 */

type Blueprint = {
  modo_operacao: "canal_whatsapp" | "interno";
  cargo_slug: string | null;
  nome: string;
  tom: string;
  prompt: string;
  conhecimento: string[];
  ferramentas: string[];
  perguntas: string[];
};

const EXEMPLOS = [
  "Um atendimento no WhatsApp que qualifica quem quer construir ou reformar, perguntando orçamento e prazo, e encaminha para um parceiro.",
  "Um copiloto interno que me ajuda no financeiro a acompanhar contas a receber e cobrar clientes em atraso.",
  "Um agente que cuida do acompanhamento de obras, avisando atrasos e pendências.",
];

export default function NovoAgenteIaPage() {
  const router = useRouter();
  const [descricao, setDescricao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  async function gerar() {
    const d = descricao.trim();
    if (d.length < 8 || gerando) {
      if (d.length < 8) setErro("Descreva um pouco mais o que o agente deve fazer.");
      return;
    }
    setGerando(true);
    setErro("");
    setBlueprint(null);
    setAvisos([]);
    try {
      const res = await fetch("/api/hub/agentes/blueprint-por-ia", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ descricao: d }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; blueprint?: Blueprint; avisos?: string[]; error?: string };
      if (!res.ok || !j.ok || !j.blueprint) {
        setErro(
          res.status === 429
            ? "Muitas gerações seguidas — aguarde um minuto."
            : j.error === "descricao_curta"
              ? "Descreva um pouco mais o que o agente deve fazer."
              : "Não consegui gerar agora. Tente de novo em instantes."
        );
        return;
      }
      setBlueprint(j.blueprint);
      setAvisos(Array.isArray(j.avisos) ? j.avisos : []);
    } catch {
      setErro("Erro de rede ao gerar.");
    } finally {
      setGerando(false);
    }
  }

  async function criar() {
    if (!blueprint || criando) return;
    setCriando(true);
    setErro("");
    try {
      const payloadBase = montarPayloadCriacaoAgente({
        nome: blueprint.nome,
        mercados: [],
        personalidade: blueprint.tom || "",
        conhecimentoSecoes: blueprint.conhecimento.length
          ? { geral: blueprint.conhecimento.map((c) => `- ${c}`).join("\n") }
          : {},
        motorFerramentasHub: blueprint.ferramentas.length > 0,
        mistralProvisionar: false,
        usoFerramentasIa: Object.fromEntries(blueprint.ferramentas.map((f) => [f, true])),
        modeloPreferencia: "mistral",
        somentePlaybook: !blueprint.cargo_slug,
        cargoSlug: blueprint.cargo_slug,
        setorAgente: null,
        hubCicloEstrategia: "padrao",
        hubCiclosVincularIds: [],
        modoOperacao: blueprint.modo_operacao,
        modoExecucao: "manual",
        agendaIntervalMin: 60,
      });
      // O blueprint traz a instrução: sobrepõe o system_prompt_base vazio do wizard.
      const payload = { ...payloadBase, system_prompt_base: blueprint.prompt || "" };

      const res = await fetch("/api/hub/agentes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as { agente_slug?: string; error?: string };
      if (!res.ok || !j.agente_slug) {
        setErro(j.error || "Não foi possível criar o agente.");
        return;
      }
      // Aterrissa na ficha para refinar/publicar (nada é publicado automaticamente).
      router.push(`/crm/agentes/${encodeURIComponent(j.agente_slug)}`);
    } catch {
      setErro("Erro de rede ao criar o agente.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link href="/crm/agentes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-obra-texto-2 hover:text-obra-texto">
        <ArrowLeft size={15} /> Agentes
      </Link>

      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-obra-dourado/15 text-obra-dourado">
          <Sparkles size={20} aria-hidden />
        </span>
        <div>
          <h1 className="m-0 text-xl font-bold text-obra-texto">Criar agente com IA</h1>
          <p className="m-0 mt-0.5 text-sm text-obra-texto-2">Descreva o que o agente deve fazer — a IA monta a configuração e você revisa.</p>
        </div>
      </div>

      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        rows={4}
        placeholder="Ex.: um atendimento no WhatsApp que qualifica quem quer reformar, pergunta orçamento e prazo, e encaminha para um parceiro."
        className="w-full resize-y rounded-xl border border-obra-borda bg-obra-dark px-4 py-3 text-sm text-obra-texto outline-none placeholder:text-obra-texto-3 focus:border-obra-dourado"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXEMPLOS.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setDescricao(ex)}
            className="rounded-full border border-obra-borda bg-obra-dark-2 px-2.5 py-1 text-[11px] text-obra-texto-2 hover:border-obra-dourado hover:text-obra-texto"
          >
            {ex.length > 48 ? ex.slice(0, 47) + "…" : ex}
          </button>
        ))}
      </div>

      {erro && (
        <p role="alert" className="mt-3 rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-xs font-semibold text-[#ff7b72]">
          {erro}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <CrmButton loading={gerando} disabled={descricao.trim().length < 8} onClick={() => void gerar()} leftIcon={<Sparkles size={15} />}>
          {blueprint ? "Gerar de novo" : "Gerar com IA"}
        </CrmButton>
      </div>

      {blueprint && (
        <section className="mt-6 rounded-2xl border border-obra-borda bg-obra-dark-2 p-5">
          <h2 className="m-0 mb-4 flex items-center gap-2 text-base font-semibold text-obra-texto">
            <Bot size={18} className="text-obra-dourado" aria-hidden /> Proposta da IA
          </h2>

          {avisos.length > 0 && (
            <div className="mb-4 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-2">
              {avisos.map((a, i) => (
                <p key={i} className="m-0 flex items-start gap-1.5 text-xs text-obra-texto">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#f59e0b]" aria-hidden /> {a}
                </p>
              ))}
            </div>
          )}

          <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome">{blueprint.nome}</Campo>
            <Campo rotulo="Tipo">{blueprint.modo_operacao === "canal_whatsapp" ? "Atendimento (WhatsApp)" : "Interno (copiloto)"}</Campo>
            <Campo rotulo="Cargo">{blueprint.cargo_slug ?? "Sem cargo (só playbook)"}</Campo>
            <Campo rotulo="Tom">{blueprint.tom || "—"}</Campo>
          </dl>

          {blueprint.prompt && (
            <BlocoLista titulo="Instrução" icone={<MessageSquare size={14} />}>
              <p className="m-0 whitespace-pre-wrap text-sm text-obra-texto">{blueprint.prompt}</p>
            </BlocoLista>
          )}
          {blueprint.ferramentas.length > 0 && (
            <BlocoLista titulo={`Ferramentas (${blueprint.ferramentas.length})`} icone={<Wrench size={14} />}>
              <div className="flex flex-wrap gap-1.5">
                {blueprint.ferramentas.map((f) => (
                  <span key={f} className="rounded-full bg-obra-dourado/15 px-2 py-0.5 text-[11px] font-medium text-obra-dourado">{f}</span>
                ))}
              </div>
            </BlocoLista>
          )}
          {blueprint.perguntas.length > 0 && (
            <BlocoLista titulo="Perguntas de qualificação" icone={<MessageSquare size={14} />}>
              <ul className="m-0 list-disc pl-5 text-sm text-obra-texto-2">
                {blueprint.perguntas.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </BlocoLista>
          )}
          {blueprint.conhecimento.length > 0 && (
            <BlocoLista titulo="O que deve saber" icone={<CheckCircle2 size={14} />}>
              <ul className="m-0 list-disc pl-5 text-sm text-obra-texto-2">
                {blueprint.conhecimento.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </BlocoLista>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="m-0 text-[11px] text-obra-texto-3">Você poderá refinar tudo na ficha antes de publicar.</p>
            <CrmButton loading={criando} onClick={() => void criar()} leftIcon={<Bot size={15} />}>Criar agente</CrmButton>
          </div>
        </section>
      )}
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-obra-borda bg-obra-dark p-3">
      <dt className="m-0 text-[10px] font-bold uppercase tracking-wide text-obra-texto-3">{rotulo}</dt>
      <dd className="m-0 mt-0.5 text-sm text-obra-texto">{children}</dd>
    </div>
  );
}

function BlocoLista({ titulo, icone, children }: { titulo: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="m-0 mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-obra-texto-3">
        <span className="text-obra-dourado">{icone}</span> {titulo}
      </p>
      {children}
    </div>
  );
}
