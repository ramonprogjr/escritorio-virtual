"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowLeft, Bot, Wrench, MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import { CrmButton } from "@/components/crm/CrmButton";
import { ConfirmarAcaoIA } from "@/components/crm/ConfirmarAcaoIA";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { montarPayloadCriacaoAgente } from "@/lib/crm/montar-payload-criacao-agente";
import { HUB_AGENTE_FERRAMENTAS_CATALOGO } from "@/lib/hub/agente-ferramentas-registry";

/** id da ferramenta → título humano (esconder o código; regra da casa "chama pelo nome"). */
const FERRAMENTA_TITULO = new Map(HUB_AGENTE_FERRAMENTAS_CATALOGO.map((f) => [f.id as string, f.titulo]));

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
  const [cargoDesc, setCargoDesc] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  // Ação PESADA (a IA lê a descrição inteira e monta o agente): avisa e confirma antes de consumir.
  const [confirmando, setConfirmando] = useState(false);

  async function gerar() {
    const d = descricao.trim();
    if (d.length < 8 || gerando) {
      if (d.length < 8) setErro("Descreva um pouco mais o que o agente deve fazer.");
      return;
    }
    setGerando(true);
    setErro("");
    // NÃO apaga a proposta atual antes da resposta: se a regeneração falhar (429/402/rede), o dono
    // não perde o blueprint que estava revisando (QA 09/jul). Só substitui no sucesso.
    try {
      const res = await fetch("/api/hub/agentes/blueprint-por-ia", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ descricao: d }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        blueprint?: Blueprint;
        avisos?: string[];
        cargo_desc?: string | null;
        error?: string;
      };
      if (!res.ok || !j.ok || !j.blueprint) {
        setErro(
          res.status === 429
            ? "Muitas gerações seguidas — aguarde um minuto."
            : res.status === 402 || j.error === "sem_creditos"
              ? "Seus créditos de IA acabaram. Recarregue para continuar."
              : res.status === 401 || res.status === 403
                ? "Você não tem permissão para criar agentes — peça ao dono da conta."
                : res.status === 503
                  ? "A IA não está configurada neste ambiente."
                  : j.error === "descricao_curta"
                    ? "Descreva um pouco mais o que o agente deve fazer."
                    : "Não consegui gerar agora. Tente de novo em instantes."
        );
        return;
      }
      setBlueprint(j.blueprint);
      setCargoDesc(j.cargo_desc ?? null);
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
      // QA 09/jul: traduzir o vocabulário do blueprint para o do hub e não perder nada do que o dono revisou.
      // (1) modo: o hub usa 'jobs_internos', não 'interno'. (2) conhecimento: seção válida do catálogo.
      // (3) perguntas: entram NO prompt (o override do system_prompt_base pula o template do cargo).
      const modoHub = blueprint.modo_operacao === "canal_whatsapp" ? "canal_whatsapp" : "jobs_internos";
      const perguntasMd = blueprint.perguntas.length
        ? "\n\n## Perguntas essenciais\n" + blueprint.perguntas.map((p, i) => `${i + 1}. ${p}`).join("\n")
        : "";
      const guardrailWa =
        modoHub === "canal_whatsapp"
          ? "\n\n## Regras de atendimento externo\n- Nunca revele o nome do cargo/função interna ao cliente.\n- Faça as perguntas de forma natural, uma de cada vez."
          : "";
      const instrucao = `${blueprint.prompt || ""}${perguntasMd}${guardrailWa}`.trim();

      const payloadBase = montarPayloadCriacaoAgente({
        nome: blueprint.nome,
        mercados: [],
        personalidade: blueprint.tom ? `## Tom e estilo de comunicação\n\n${blueprint.tom}` : "",
        conhecimentoSecoes: blueprint.conhecimento.length
          ? { empresa: blueprint.conhecimento.map((c) => `- ${c}`).join("\n") }
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
        modoOperacao: modoHub,
        // 'agenda' (paridade com o wizard): interno nasce com ciclo programado PAUSADO (inerte até refinar);
        // 'manual' não existe no servidor e gravava metadata incoerente (QA 09/jul).
        modoExecucao: "agenda",
        agendaIntervalMin: 60,
      });
      const payload = {
        ...payloadBase,
        system_prompt_base: instrucao,
        ...(blueprint.tom ? { tom_voz: blueprint.tom } : {}),
      };

      const res = await fetch("/api/hub/agentes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as { agente_slug?: string; error?: string };
      if (!res.ok || !j.agente_slug) {
        // 400 = validação (mensagem em pt); 5xx = erro cru do banco → não exibir, só logar.
        if (res.status >= 500) {
          console.error("[novo-ia criar]", j.error);
          setErro("Não foi possível criar o agente agora. Tente novamente.");
        } else {
          setErro(j.error || "Não foi possível criar o agente.");
        }
        setCriando(false);
        return;
      }
      // Sucesso: NÃO reabilita o botão — mantém em loading até a navegação trocar de tela (senão um 2º
      // clique durante o carregamento da ficha cria um agente DUPLICADO; o servidor só sufixa o slug). QA 09/jul.
      router.push(`/crm/agentes/${encodeURIComponent(j.agente_slug)}`);
    } catch {
      setErro("Erro de rede ao criar o agente.");
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
        disabled={gerando || criando}
        aria-label="Descreva o que o agente deve fazer"
        rows={4}
        placeholder="Ex.: um atendimento no WhatsApp que qualifica quem quer reformar, pergunta orçamento e prazo, e encaminha para um parceiro."
        className="w-full resize-y rounded-xl border border-obra-borda bg-obra-dark px-4 py-3 text-sm text-obra-texto outline-none placeholder:text-obra-texto-3 focus:border-obra-dourado disabled:opacity-60"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXEMPLOS.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={gerando || criando}
            onClick={() => setDescricao(ex)}
            className="rounded-full border border-obra-borda bg-obra-dark-2 px-2.5 py-1 text-[11px] text-obra-texto-2 hover:border-obra-dourado hover:text-obra-texto disabled:opacity-50"
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
        <CrmButton loading={gerando} disabled={gerando || criando || descricao.trim().length < 8} onClick={() => setConfirmando(true)} leftIcon={<Sparkles size={15} />}>
          {blueprint ? "Gerar de novo" : "Gerar com IA"}
        </CrmButton>
      </div>

      <ConfirmarAcaoIA
        acaoId="blueprint_agente"
        aberto={confirmando}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => { setConfirmando(false); void gerar(); }}
      />

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
            <Campo rotulo="Cargo">{cargoDesc || (blueprint.cargo_slug ? blueprint.cargo_slug.replace(/_/g, " ") : "Sem cargo (só playbook)")}</Campo>
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
                  <span key={f} title={f} className="rounded-full bg-obra-dourado/15 px-2 py-0.5 text-[11px] font-medium text-obra-dourado">
                    {FERRAMENTA_TITULO.get(f) ?? f}
                  </span>
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

          <p className="mt-4 rounded-lg border border-obra-borda bg-obra-dark px-3 py-2 text-[11px] text-obra-texto-3">
            Também será aplicado: {blueprint.modo_operacao === "canal_whatsapp" ? "regras de atendimento seguro no WhatsApp · " : ""}
            horário 08h–22h (seg–sex) · modelo econômico. Tudo ajustável na ficha.
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="m-0 text-[11px] text-obra-texto-3">Você poderá refinar tudo na ficha antes de publicar.</p>
            <CrmButton loading={criando} disabled={gerando} onClick={() => void criar()} leftIcon={<Bot size={15} />}>Criar agente</CrmButton>
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
