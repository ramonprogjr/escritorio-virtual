"use client";

/**
 * E7 (Fase 2) — <ArvoreEscopo>: a "planilha viva" (design §4). A MESMA fonte (item de escopo)
 * em 3 níveis colapsáveis: AMBIENTE (seção + subtotal) → DISCIPLINA (cor da EAP) → ITEM
 * (linha densa no desktop, card aninhado no mobile). NÃO é <table> (regra eterna: tabela = relatório).
 *
 * VERBOS (design §4):
 *  - VER: cockpit de 4 KPIs vivos + seletor de LENTE (preço/custo/margem/avanço, uma por vez) + BDI.
 *  - EDITAR: inline Click-and-Go — qtd por stepper; custo em 3 campos (locação/material/MO) com o
 *    preço RECALCULANDO AO VIVO e a FÓRMULA EXPOSTA ("R$ 50 × 1.06 × 17 = R$ 901"). Salva onBlur.
 *  - CONSTRUIR: empty-state com 3 botões — (A) ✨ IA (manual-first, dispara evento do copiloto),
 *    (B) + Ambiente, (C) + item — os manuais GRAVAM via o endpoint de itens (não duplica lógica).
 *
 * PERSONA (decisão 3b): custo/margem só p/ executor|hub; arquiteto não vê a faixa-dinheiro;
 *   prestador vê preço, nunca margem. `somenteLeitura` desliga toda edição.
 *
 * TOLERANTE: migracao_pendente (E7 não aplicada) → aviso honesto + força a lente "avanço"
 *   (funciona sem custo); preço/custo/margem mostram "—" com nota "após aplicar a migração".
 *   Mobile-first; tokens Obra10+ (verde+dourado dark, zero hex fora da marca).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Sparkles,
  DoorOpen,
  Layers,
  X,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Coins,
  Activity,
  Ruler,
} from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { DrawerMedir } from "@/components/crm/obras/DrawerMedir";
import {
  LENTES,
  ROTULO_LENTE,
  lentesDaPersona,
  personaPodeVerCusto,
  personaPodeVerMargem,
  formulaPreco,
  fmtMoeda,
  custoUnitario,
  bdiEfetivo,
  type LenteEscopo,
  type PersonaEscopo,
  type NoAmbiente,
  type NoDisciplina,
  type ItemEscopoCalc,
  type CockpitEscopo,
} from "@/lib/obras/escopo";

const DOURADO = "#c9a24a";
const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";
const BG_DEEP = "#0a140f";
const TXT = "#e6edf3";
const TXT_DIM = "#8aa99a";

type Props = {
  obraId: string;
  lenteInicial?: LenteEscopo;
  /**
   * Persona INICIAL (fallback até o servidor responder). A persona EFETIVA é sempre a que o
   * endpoint /escopo deriva do papel da sessão (server-side) — esta prop nunca a sobrepõe depois
   * de carregar. Default = "prestador" (o mais restrito): nunca expõe custo/margem por omissão.
   */
  persona?: PersonaEscopo;
  somenteLeitura?: boolean;
};

type RespostaEscopo = {
  migracao_pendente?: boolean;
  aviso?: string | null;
  persona?: PersonaEscopo;
  bdi_obra?: number;
  ambientes?: NoAmbiente[];
  cockpit?: CockpitEscopo;
};

// ── BDIs comuns (seletor do header — Click-and-Go, sem digitar) ────────────────
const BDIS_COMUNS = [1.0, 1.06, 1.1, 1.155, 1.2, 1.25];

export function ArvoreEscopo({
  obraId,
  lenteInicial = "avanco",
  persona: personaInicial = "prestador",
  somenteLeitura = false,
}: Props) {
  const [carregando, setCarregando] = useState(true);
  const [pendente, setPendente] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [bdiObra, setBdiObra] = useState<number>(1.0);
  const [ambientes, setAmbientes] = useState<NoAmbiente[]>([]);
  const [cockpit, setCockpit] = useState<CockpitEscopo>({
    total_orcado: 0,
    custo: 0,
    margem_pct: null,
    avanco: 0,
    itens: 0,
  });
  // Persona EFETIVA: começa no fallback seguro (prop) e é substituída pela do servidor ao carregar.
  // Nunca é um default 'executor' de prop — a verdade vem do endpoint (derivada do papel da sessão).
  const [persona, setPersona] = useState<PersonaEscopo>(personaInicial);

  const lentesDisp = useMemo(() => lentesDaPersona(persona), [persona]);
  const [lente, setLente] = useState<LenteEscopo>(
    lentesDaPersona(personaInicial).includes(lenteInicial) ? lenteInicial : "avanco"
  );
  // BDI exibido no header (vem da obra; o seletor reflete a escolha localmente p/ a fórmula).
  const [bdiHeader, setBdiHeader] = useState<number>(1.0);

  // GET /escopo: depende SÓ de obraId (não de `lente`) — senão re-fetcha a cada troca de lente
  // (duplo-fetch). O ajuste de lente por `pendente`/persona mora em useEffects separados (abaixo).
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/escopo`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json()) as RespostaEscopo;
      const pend = !!json.migracao_pendente;
      setPendente(pend);
      setAviso(json.aviso ?? null);
      setBdiObra(json.bdi_obra ?? 1.0);
      setBdiHeader(json.bdi_obra ?? 1.0);
      setAmbientes(json.ambientes ?? []);
      setCockpit(
        json.cockpit ?? { total_orcado: 0, custo: 0, margem_pct: null, avanco: 0, itens: 0 }
      );
      // Persona vem do servidor (autoritativa). Sem ela na resposta, mantém o fallback seguro.
      if (json.persona) setPersona(json.persona);
    } catch {
      setAmbientes([]);
    } finally {
      setCarregando(false);
    }
  }, [obraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Ajuste de lente isolado (sem re-fetch): sem E7 a faixa-dinheiro mostra "—" → força "avanço";
  // e se a persona efetiva não tem a lente atual (ex.: arquiteto só "avanço"), corrige.
  useEffect(() => {
    if (pendente && lente !== "avanco") {
      setLente("avanco");
      return;
    }
    if (!lentesDisp.includes(lente)) setLente("avanco");
  }, [pendente, lentesDisp, lente]);

  // BDI do header: PERSISTE em hub_obras.bdi_fator (tolerante a E7). Enquanto não gravou no banco
  // (migração pendente ou erro), o seletor mostra "simulação" — sem mentir que ficou salvo.
  const [bdiSimulacao, setBdiSimulacao] = useState(false);
  const salvarBdi = useCallback(
    async (novo: number) => {
      setBdiHeader(novo); // reflete na fórmula imediatamente (responsivo)
      try {
        const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...internalApiHeaders() },
          body: JSON.stringify({ bdi_fator: novo }),
        });
        const json = (await res.json()) as { bdi_gravado?: boolean };
        const gravou = res.ok && json.bdi_gravado === true;
        setBdiSimulacao(!gravou);
        if (gravou) {
          setBdiObra(novo); // vira a base da obra; recarrega a árvore com o novo preço
          void carregar();
        }
      } catch {
        setBdiSimulacao(true); // rede falhou → é simulação local, honesto
      }
    },
    [obraId, carregar]
  );

  const totalItens = useMemo(
    () => ambientes.reduce((acc, a) => acc + a.subtotal.itens_raiz, 0),
    [ambientes]
  );

  // Drawer "Medir" (E7c): item selecionado para medição formal. null = fechado.
  const [itemMedir, setItemMedir] = useState<ItemEscopoCalc | null>(null);

  if (carregando) {
    return <p className="p-4 text-sm text-[#8b949e]">Carregando escopo…</p>;
  }

  // Empty-state (CONSTRUIR): 3 caminhos.
  if (totalItens === 0) {
    return (
      <div className="flex flex-col gap-4">
        <CockpitHeader cockpit={cockpit} lente={lente} pendente={pendente} />
        <EmptyEscopo
          obraId={obraId}
          somenteLeitura={somenteLeitura}
          onCriou={() => void carregar()}
        />
        {pendente ? <AvisoMigracao aviso={aviso} /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <CockpitHeader cockpit={cockpit} lente={lente} pendente={pendente} />

      {/* Controles: seletor de LENTE (uma por vez) + seletor de BDI + + item */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SeletorLente
          lente={lente}
          disponiveis={lentesDisp}
          pendente={pendente}
          onMudar={setLente}
        />
        <div className="flex items-center gap-2">
          <SeletorBdi
            valor={bdiHeader}
            onMudar={salvarBdi}
            desabilitado={somenteLeitura}
            simulacao={bdiSimulacao}
          />
          {!somenteLeitura ? (
            <BotaoNovoItem obraId={obraId} onCriou={() => void carregar()} compacto />
          ) : null}
        </div>
      </div>

      {pendente ? <AvisoMigracao aviso={aviso} /> : null}

      {/* Árvore: AMBIENTE → DISCIPLINA → ITEM */}
      <div className="flex flex-col gap-3">
        {ambientes.map((amb) => (
          <SecaoAmbiente
            key={amb.chave}
            ambiente={amb}
            lente={lente}
            persona={persona}
            bdiHeader={bdiHeader}
            bdiObra={bdiObra}
            obraId={obraId}
            somenteLeitura={somenteLeitura}
            onSalvo={() => void carregar()}
            onMedir={setItemMedir}
          />
        ))}
      </div>

      {/* Drawer "Medir" (E7c): medição formal por item (append-only no servidor). */}
      <DrawerMedir
        open={itemMedir != null}
        obraId={obraId}
        item={itemMedir}
        onClose={() => setItemMedir(null)}
        onMedido={() => void carregar()}
      />
    </div>
  );
}

// ── Cockpit: 4 KPIs vivos (Total orçado · Custo · Margem% · Avanço) ───────────
function CockpitHeader({
  cockpit,
  lente,
  pendente,
}: {
  cockpit: CockpitEscopo;
  lente: LenteEscopo;
  pendente: boolean;
}) {
  const dash = pendente ? "—" : null;
  const kpis: Array<{ chave: LenteEscopo; rotulo: string; valor: string; Icone: typeof Wallet }> = [
    {
      chave: "preco",
      rotulo: "Total orçado",
      valor: dash ?? fmtMoeda(cockpit.total_orcado),
      Icone: Wallet,
    },
    { chave: "custo", rotulo: "Custo", valor: dash ?? fmtMoeda(cockpit.custo), Icone: Coins },
    {
      chave: "margem",
      rotulo: "Margem",
      valor: dash ?? (cockpit.margem_pct == null ? "—" : `${cockpit.margem_pct}%`),
      Icone: TrendingUp,
    },
    { chave: "avanco", rotulo: "Avanço", valor: `${cockpit.avanco}%`, Icone: Activity },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {kpis.map((k) => {
        const ativo = lente === k.chave;
        const Icone = k.Icone;
        return (
          <div
            key={k.chave}
            className="rounded-xl border p-3"
            style={{
              borderColor: ativo ? DOURADO : BORDA,
              background: ativo ? "linear-gradient(180deg, #14301f, #0a140f)" : BG_CARD,
            }}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: ativo ? "#f0c869" : TXT_DIM }}>
              <Icone className="h-3 w-3" /> {k.rotulo}
            </div>
            <p className="mt-1 text-[15px] font-bold tabular-nums" style={{ color: TXT }}>
              {k.valor}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Seletor de LENTE (uma faixa por vez) ──────────────────────────────────────
function SeletorLente({
  lente,
  disponiveis,
  pendente,
  onMudar,
}: {
  lente: LenteEscopo;
  disponiveis: LenteEscopo[];
  pendente: boolean;
  onMudar: (l: LenteEscopo) => void;
}) {
  return (
    <div className="flex rounded-lg border p-0.5" style={{ borderColor: BORDA, background: BG_CARD }} role="tablist" aria-label="Lente de visualização">
      {LENTES.filter((l) => disponiveis.includes(l)).map((l) => {
        const ativo = lente === l;
        // Sem E7, as lentes de dinheiro existem mas mostram "—": sinalizadas, não escondidas.
        const semDados = pendente && l !== "avanco";
        return (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onMudar(l)}
            title={semDados ? "Disponível após aplicar a migração E7" : undefined}
            className="rounded-md px-3 py-1.5 text-[12px] font-semibold"
            style={{
              color: ativo ? "#f0c869" : semDados ? "#5c6b62" : TXT_DIM,
              background: ativo ? "linear-gradient(180deg, #1d5c3c, #003b26)" : "transparent",
              border: ativo ? `1px solid ${DOURADO}` : "1px solid transparent",
            }}
          >
            {ROTULO_LENTE[l]}
          </button>
        );
      })}
    </div>
  );
}

// ── Seletor de BDI ("BDI 1.06 ▾") ─────────────────────────────────────────────
function SeletorBdi({
  valor,
  onMudar,
  desabilitado,
  simulacao,
}: {
  valor: number;
  onMudar: (v: number) => void;
  desabilitado?: boolean;
  /** true = ainda não persistiu no banco (migração E7 pendente) → rotula como simulação (honesto). */
  simulacao?: boolean;
}) {
  return (
    <label
      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[12px] font-semibold"
      style={{ borderColor: `${DOURADO}44`, color: DOURADO, background: BG_CARD, opacity: desabilitado ? 0.6 : 1 }}
      title={
        simulacao
          ? "BDI em simulação — persiste após aplicar a migração E7 (janela do dono)"
          : "Fator de BDI da obra (preço = custo × BDI × qtd)"
      }
    >
      BDI
      <select
        value={BDIS_COMUNS.includes(valor) ? String(valor) : "custom"}
        onChange={(e) => {
          const v = e.target.value;
          if (v !== "custom") onMudar(Number(v));
        }}
        disabled={desabilitado}
        className="bg-transparent text-[12px] font-bold outline-none"
        style={{ color: "#f0c869" }}
        aria-label="Fator de BDI"
      >
        {BDIS_COMUNS.map((b) => (
          <option key={b} value={b} style={{ background: BG_DEEP, color: TXT }}>
            {b.toFixed(b === Math.round(b) ? 0 : 3)}
          </option>
        ))}
        {!BDIS_COMUNS.includes(valor) ? (
          <option value="custom" style={{ background: BG_DEEP, color: TXT }}>
            {valor}
          </option>
        ) : null}
      </select>
      {simulacao ? (
        <span
          className="ml-1 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{ background: `${DOURADO}22`, color: "#f0c869" }}
          title="Em simulação: o BDI persiste após a migração E7"
        >
          sim.
        </span>
      ) : null}
    </label>
  );
}

// ── Seção AMBIENTE (nível 1, colapsável) ──────────────────────────────────────
function SecaoAmbiente({
  ambiente,
  lente,
  persona,
  bdiHeader,
  bdiObra,
  obraId,
  somenteLeitura,
  onSalvo,
  onMedir,
}: {
  ambiente: NoAmbiente;
  lente: LenteEscopo;
  persona: PersonaEscopo;
  bdiHeader: number;
  bdiObra: number;
  obraId: string;
  somenteLeitura: boolean;
  onSalvo: () => void;
  onMedir: (item: ItemEscopoCalc) => void;
}) {
  const [aberto, setAberto] = useState(true); // colapso agressivo é por DISCIPLINA; ambiente abre.
  const resumo = resumoLente(ambiente.subtotal, lente, persona);
  return (
    <section className="rounded-xl border" style={{ borderColor: BORDA, background: BG_DEEP }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-t-xl px-3 py-2.5 text-left"
        style={{ background: BG_CARD }}
        aria-expanded={aberto}
      >
        <div className="flex min-w-0 items-center gap-2">
          {aberto ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: DOURADO }} />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: DOURADO }} />
          )}
          <DoorOpen className="h-4 w-4 flex-shrink-0" style={{ color: DOURADO }} />
          <h3 className="truncate text-[13px] font-bold uppercase tracking-wide" style={{ color: TXT }}>
            {ambiente.label}
          </h3>
        </div>
        <span className="flex flex-shrink-0 items-center gap-2 text-[12px] font-semibold tabular-nums" style={{ color: TXT_DIM }}>
          {resumo}
          <span className="text-[11px]">{ambiente.subtotal.itens_raiz} itens</span>
        </span>
      </button>

      {aberto ? (
        <div className="flex flex-col gap-2 p-2">
          {ambiente.disciplinas.map((disc) => (
            <BlocoDisciplina
              key={disc.slug}
              disciplina={disc}
              lente={lente}
              persona={persona}
              bdiHeader={bdiHeader}
              bdiObra={bdiObra}
              obraId={obraId}
              somenteLeitura={somenteLeitura}
              onSalvo={onSalvo}
              onMedir={onMedir}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ── Bloco DISCIPLINA (nível 2, colapsável, cor da EAP) ────────────────────────
function BlocoDisciplina({
  disciplina,
  lente,
  persona,
  bdiHeader,
  bdiObra,
  obraId,
  somenteLeitura,
  onSalvo,
  onMedir,
}: {
  disciplina: NoDisciplina;
  lente: LenteEscopo;
  persona: PersonaEscopo;
  bdiHeader: number;
  bdiObra: number;
  obraId: string;
  somenteLeitura: boolean;
  onSalvo: () => void;
  onMedir: (item: ItemEscopoCalc) => void;
}) {
  const [aberto, setAberto] = useState(true);
  const raizes = disciplina.itens.filter((i) => i.parent_id == null);
  const resumo = resumoLente(disciplina.subtotal, lente, persona);
  return (
    <div className="rounded-lg border" style={{ borderColor: BORDA, background: BG_CARD, borderLeft: `3px solid ${disciplina.cor}` }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
        aria-expanded={aberto}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {aberto ? (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: disciplina.cor }} />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: disciplina.cor }} />
          )}
          <Layers className="h-3.5 w-3.5 flex-shrink-0" style={{ color: disciplina.cor }} />
          <span className="truncate text-[12px] font-bold" style={{ color: TXT }}>
            {disciplina.label}
          </span>
        </div>
        <span className="flex-shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: TXT_DIM }}>
          {resumo}
        </span>
      </button>

      {aberto ? (
        <div className="flex flex-col gap-1.5 px-2 pb-2">
          {raizes.map((it) => (
            <LinhaItem
              key={it.id}
              item={it}
              lente={lente}
              persona={persona}
              bdiHeader={bdiHeader}
              bdiObra={bdiObra}
              obraId={obraId}
              somenteLeitura={somenteLeitura}
              onSalvo={onSalvo}
              onMedir={onMedir}
            />
          ))}
          {!somenteLeitura ? (
            <BotaoNovoItem
              obraId={obraId}
              onCriou={onSalvo}
              preset={{ ambiente: undefined, disciplina_slug: disciplina.slug === "__sem__" ? undefined : disciplina.slug }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Linha ITEM (nível 3) — densa no desktop, edita inline ─────────────────────
function LinhaItem({
  item,
  lente,
  persona,
  bdiHeader,
  bdiObra,
  obraId,
  somenteLeitura,
  onSalvo,
  onMedir,
}: {
  item: ItemEscopoCalc;
  lente: LenteEscopo;
  persona: PersonaEscopo;
  bdiHeader: number;
  bdiObra: number;
  obraId: string;
  somenteLeitura: boolean;
  onSalvo: () => void;
  onMedir: (item: ItemEscopoCalc) => void;
}) {
  const [editando, setEditando] = useState(false);
  const valor = valorLente(item, lente, persona);
  // "medido X de Y": quando há quantidade planejada, mostra o realizado estimado do pct atual.
  const medidoDe = textoMedidoDe(item);

  return (
    <div className="rounded-lg border" style={{ borderColor: BORDA, background: BG_DEEP }}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => !somenteLeitura && setEditando((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          disabled={somenteLeitura}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold" style={{ color: TXT }}>
              {item.nome || "Item sem nome"}
            </p>
            <p className="truncate font-mono text-[10px]" style={{ color: "#8b949e" }}>
              {item.codigo}
              {medidoDe ? ` · ${medidoDe}` : item.quantidade != null ? ` · ${item.quantidade}${item.unidade ? ` ${item.unidade}` : ""}` : ""}
            </p>
          </div>
        </button>
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* botão MEDIR (E7c): medição formal com evidência — Click-and-Go, por item */}
          {!somenteLeitura ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMedir(item);
              }}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold"
              style={{ borderColor: `${DOURADO}55`, color: DOURADO, background: BG_CARD }}
              title="Registrar medição formal (com evidência)"
            >
              <Ruler className="h-3 w-3" /> Medir
            </button>
          ) : null}
          {/* barra de avanço sempre visível (mini) */}
          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full sm:block" style={{ background: BG_CARD }}>
            <div className="h-full rounded-full" style={{ width: `${clamp(item.pct_avanco)}%`, background: DOURADO }} />
          </div>
          <span className="min-w-[64px] text-right text-[12px] font-bold tabular-nums" style={{ color: TXT }}>
            {valor}
          </span>
          {!somenteLeitura ? (
            <ChevronRight
              className="h-4 w-4 flex-shrink-0 transition-transform"
              style={{ color: "#5c6b62", transform: editando ? "rotate(90deg)" : "none" }}
            />
          ) : null}
        </div>
      </div>

      {editando && !somenteLeitura ? (
        <EditorInline
          item={item}
          bdiHeader={bdiHeader}
          bdiObra={bdiObra}
          obraId={obraId}
          persona={persona}
          onSalvo={() => {
            setEditando(false);
            onSalvo();
          }}
        />
      ) : null}
    </div>
  );
}

// ── Editor inline (Click-and-Go): qtd stepper + 3 campos de custo + fórmula viva ─
function EditorInline({
  item,
  bdiHeader,
  bdiObra,
  obraId,
  persona,
  onSalvo,
}: {
  item: ItemEscopoCalc;
  bdiHeader: number;
  bdiObra: number;
  obraId: string;
  persona: PersonaEscopo;
  onSalvo: () => void;
}) {
  const [qtd, setQtd] = useState<number>(item.quantidade ?? 0);
  const [locacao, setLocacao] = useState<number>(item.custo_locacao_frete ?? 0);
  const [material, setMaterial] = useState<number>(item.custo_material ?? 0);
  const [mo, setMo] = useState<number>(item.custo_mao_obra ?? 0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // status honesto da última gravação: o que o SERVIDOR confirmou (não uma promessa otimista).
  const [statusSalvo, setStatusSalvo] = useState<
    null | { ok: true; custoGravado: boolean; custoPendente: boolean; custoIgnorado: boolean }
  >(null);
  const sujo = useRef(false);

  const podeCusto = personaPodeVerCusto(persona);
  // BDI efetivo: override do item, senão o do header (que reflete o da obra). Fórmula 3 camadas.
  const bdi = bdiEfetivo(item.bdi_fator, bdiHeader || bdiObra);
  const custoUnit = custoUnitario({ custo_locacao_frete: locacao, custo_material: material, custo_mao_obra: mo });
  // qtd=0 é uma quantidade VÁLIDA (item zerado): a fórmula mostra "× 0", não cai p/ "× 1".
  const formula = formulaPreco(custoUnit, bdi, qtd);

  const salvar = useCallback(async () => {
    if (!sujo.current) return;
    setSalvando(true);
    setErro(null);
    try {
      // qtd=0 vai como 0 (number) — NÃO como null. O servidor aceita 0 (item zerado).
      const body: Record<string, unknown> = { id: item.id, quantidade: qtd };
      if (podeCusto) {
        body.custo_locacao_frete = locacao;
        body.custo_material = material;
        body.custo_mao_obra = mo;
      }
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/itens`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        data?: unknown;
        error?: string;
        custo_gravado?: boolean;
        migracao_pendente?: boolean;
        custo_ignorado_persona?: boolean;
      };
      if (!res.ok) {
        setErro(json.error || "Não foi possível salvar.");
        setStatusSalvo(null);
        return;
      }
      sujo.current = false;
      // Verdade do servidor: a quantidade gravou; o custo só se o servidor confirmou (não fingir).
      setStatusSalvo({
        ok: true,
        custoGravado: podeCusto && json.custo_gravado === true,
        custoPendente: !!json.migracao_pendente,
        custoIgnorado: !!json.custo_ignorado_persona,
      });
      onSalvo();
    } catch {
      setErro("Falha de rede ao salvar.");
      setStatusSalvo(null);
    } finally {
      setSalvando(false);
    }
  }, [item.id, qtd, locacao, material, mo, podeCusto, obraId, onSalvo]);

  // Salva no blur do EDITOR INTEIRO: só dispara quando o foco sai do container (relatedTarget fora).
  // Assim dá para preencher Locação → Material → MO em sequência sem o editor fechar/salvar a cada
  // campo. O botão "Salvar" explícito grava sem precisar sair (e mantém o editor aberto).
  const onBlurContainer = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      const indoPara = e.relatedTarget as Node | null;
      if (indoPara && e.currentTarget.contains(indoPara)) return; // foco ainda dentro do editor
      void salvar();
    },
    [salvar]
  );

  // Micro-texto honesto: descreve EXATAMENTE o que foi gravado no estado atual do schema.
  const rotuloStatus = (() => {
    if (salvando) return "Salvando…";
    if (!statusSalvo) {
      return podeCusto
        ? "Quantidade e custo salvam ao sair do editor (ou no botão Salvar)."
        : "Quantidade salva ao sair do editor (ou no botão Salvar).";
    }
    if (statusSalvo.custoIgnorado) return "Quantidade salva. Custo não é editável no seu perfil.";
    if (podeCusto && statusSalvo.custoPendente)
      return "Quantidade salva. Custo disponível após aplicar a migração E7.";
    if (statusSalvo.custoGravado) return "Quantidade e custo salvos.";
    return "Quantidade salva.";
  })();

  return (
    <div
      className="flex flex-col gap-3 border-t px-3 py-3"
      style={{ borderColor: BORDA }}
      onBlur={onBlurContainer}
    >
      {/* Quantidade (stepper) */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: TXT_DIM }}>
          Quantidade{item.unidade ? ` (${item.unidade})` : ""}
        </span>
        <div className="flex items-center gap-1">
          <BotaoStepper
            rotulo="−"
            onClick={() => {
              sujo.current = true;
              setQtd((q) => Math.max(0, Math.round((q - 1) * 100) / 100));
            }}
          />
          <input
            type="number"
            inputMode="decimal"
            value={qtd}
            min={0}
            onChange={(e) => {
              sujo.current = true;
              setQtd(Math.max(0, Number(e.target.value) || 0));
            }}
            className="w-20 rounded-md border px-2 py-1.5 text-center text-[13px] font-bold tabular-nums"
            style={{ borderColor: BORDA, background: BG_CARD, color: TXT }}
            aria-label="Quantidade"
          />
          <BotaoStepper
            rotulo="+"
            onClick={() => {
              sujo.current = true;
              setQtd((q) => Math.round((q + 1) * 100) / 100);
            }}
          />
        </div>
      </div>

      {/* Custo: 3 campos (locação/material/MO) — só executor|hub */}
      {podeCusto ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            { rotulo: "Locação/frete", v: locacao, set: setLocacao },
            { rotulo: "Material", v: material, set: setMaterial },
            { rotulo: "Mão de obra", v: mo, set: setMo },
          ].map((c) => (
            <label key={c.rotulo} className="flex flex-col gap-1 text-[10px] font-semibold uppercase" style={{ color: TXT_DIM }}>
              {c.rotulo}
              <input
                type="number"
                inputMode="decimal"
                value={c.v}
                min={0}
                onChange={(e) => {
                  sujo.current = true;
                  c.set(Math.max(0, Number(e.target.value) || 0));
                }}
                className="rounded-md border px-2 py-1.5 text-[13px] tabular-nums"
                style={{ borderColor: BORDA, background: BG_CARD, color: TXT }}
                aria-label={`Custo ${c.rotulo}`}
              />
            </label>
          ))}
        </div>
      ) : null}

      {/* Fórmula EXPOSTA (o dono é engenheiro: confia em ver a conta) */}
      {podeCusto ? (
        <div
          className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[12px]"
          style={{ background: BG_CARD, border: `1px solid ${DOURADO}33` }}
        >
          <span style={{ color: TXT_DIM }}>preço = custo × BDI × qtd</span>
          <span className="font-mono font-bold tabular-nums" style={{ color: "#f0c869" }}>
            {formula}
          </span>
        </div>
      ) : null}

      {erro ? (
        <p className="flex items-center gap-1 text-[12px]" style={{ color: "#f85149" }}>
          <AlertTriangle className="h-3.5 w-3.5" /> {erro}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px]" style={{ color: "#5c6b62" }}>
          {rotuloStatus}
        </p>
        {/* Botão Salvar explícito: grava sem fechar o editor (mantém aberto p/ continuar editando). */}
        <button
          type="button"
          onClick={() => {
            sujo.current = true; // garante o save mesmo se nada mudou desde o último
            void salvar();
          }}
          disabled={salvando}
          className="rounded-md px-3 py-1.5 text-[12px] font-bold"
          style={{ color: "#f0c869", background: "linear-gradient(180deg, #1d5c3c, #003b26)", border: `1px solid ${DOURADO}`, opacity: salvando ? 0.6 : 1 }}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function BotaoStepper({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md border text-[16px] font-bold"
      style={{ borderColor: `${DOURADO}44`, color: DOURADO, background: BG_CARD }}
      aria-label={rotulo === "+" ? "Aumentar" : "Diminuir"}
    >
      {rotulo}
    </button>
  );
}

// ── + item (manual, GRAVA via endpoint de itens) ──────────────────────────────
function BotaoNovoItem({
  obraId,
  onCriou,
  preset,
  compacto,
}: {
  obraId: string;
  onCriou: () => void;
  preset?: { ambiente?: string; disciplina_slug?: string };
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [ambiente, setAmbiente] = useState(preset?.ambiente ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const criar = useCallback(async () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setErro("Informe o nome do item.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          nome: nomeTrim,
          ambiente: ambiente.trim() || preset?.ambiente || null,
          disciplina_slug: preset?.disciplina_slug || null,
        }),
      });
      const json = (await res.json()) as { data?: unknown; error?: string };
      if (!res.ok || !json.data) {
        setErro(json.error || "Não foi possível criar o item.");
        return;
      }
      setNome("");
      setAberto(false);
      onCriou();
    } catch {
      setErro("Falha de rede ao criar.");
    } finally {
      setSalvando(false);
    }
  }, [nome, ambiente, obraId, preset, onCriou]);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold"
        style={{ borderColor: `${DOURADO}44`, color: DOURADO, background: compacto ? BG_CARD : "transparent" }}
      >
        <Plus className="h-3.5 w-3.5" /> {compacto ? "item" : "+ item"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-2.5" style={{ borderColor: `${DOURADO}44`, background: BG_CARD }}>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void criar();
            if (e.key === "Escape") setAberto(false);
          }}
          placeholder="Nome do item (ex.: Ponto de elétrica)"
          className="min-h-[40px] flex-1 rounded-md border px-2 text-[13px]"
          style={{ borderColor: BORDA, background: BG_DEEP, color: TXT }}
        />
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Cancelar"
          className="flex h-9 w-9 items-center justify-center rounded-md border"
          style={{ borderColor: BORDA, color: TXT_DIM }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {!preset?.ambiente ? (
        <input
          value={ambiente}
          onChange={(e) => setAmbiente(e.target.value)}
          placeholder="Ambiente (ex.: Cozinha) — opcional"
          className="min-h-[36px] rounded-md border px-2 text-[12px]"
          style={{ borderColor: BORDA, background: BG_DEEP, color: TXT }}
        />
      ) : null}
      {erro ? (
        <p className="text-[11px]" style={{ color: "#f85149" }}>
          {erro}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void criar()}
        disabled={salvando}
        className="min-h-[40px] rounded-md text-[13px] font-bold"
        style={{ color: "#f0c869", background: "linear-gradient(180deg, #1d5c3c, #003b26)", border: `1px solid ${DOURADO}` }}
      >
        {salvando ? "Criando…" : "Adicionar item"}
      </button>
    </div>
  );
}

// ── Empty-state (CONSTRUIR): 3 caminhos ───────────────────────────────────────
function EmptyEscopo({
  obraId,
  somenteLeitura,
  onCriou,
}: {
  obraId: string;
  somenteLeitura: boolean;
  onCriou: () => void;
}) {
  const [modo, setModo] = useState<"none" | "ambiente" | "item">("none");

  if (somenteLeitura) {
    return (
      <div className="rounded-xl border p-6 text-center" style={{ borderColor: BORDA, background: BG_CARD }}>
        <p className="text-sm" style={{ color: "#cdd9d2" }}>Nenhum item de escopo ainda.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: BORDA, background: BG_CARD }}>
      <p className="text-center text-sm font-semibold" style={{ color: TXT }}>
        Monte o escopo da obra
      </p>
      <p className="mt-1 text-center text-[12px]" style={{ color: TXT_DIM }}>
        Ambiente → disciplina → item. Comece de um jeito:
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* (A) IA-first — rótulo honesto (manual-first): abre o copiloto, não promete mágica. */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("copiloto:abrir"))}
          className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center"
          style={{ borderColor: `${DOURADO}66`, background: "linear-gradient(180deg, #14301f, #0a140f)" }}
        >
          <Sparkles className="h-5 w-5" style={{ color: DOURADO }} />
          <span className="text-[12px] font-bold" style={{ color: "#f0c869" }}>
            Gerar escopo com IA
          </span>
          <span className="text-[10px]" style={{ color: TXT_DIM }}>
            descreva por voz/texto
          </span>
        </button>

        {/* (B) + Ambiente */}
        <button
          type="button"
          onClick={() => setModo(modo === "ambiente" ? "none" : "ambiente")}
          className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center"
          style={{ borderColor: BORDA, background: BG_DEEP }}
        >
          <DoorOpen className="h-5 w-5" style={{ color: DOURADO }} />
          <span className="text-[12px] font-bold" style={{ color: TXT }}>
            + Ambiente
          </span>
          <span className="text-[10px]" style={{ color: TXT_DIM }}>
            ex.: Cozinha
          </span>
        </button>

        {/* (C) + item */}
        <button
          type="button"
          onClick={() => setModo(modo === "item" ? "none" : "item")}
          className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center"
          style={{ borderColor: BORDA, background: BG_DEEP }}
        >
          <Plus className="h-5 w-5" style={{ color: DOURADO }} />
          <span className="text-[12px] font-bold" style={{ color: TXT }}>
            + item
          </span>
          <span className="text-[10px]" style={{ color: TXT_DIM }}>
            avulso
          </span>
        </button>
      </div>

      {modo !== "none" ? (
        <div className="mt-3">
          <BotaoNovoItemInline
            obraId={obraId}
            pedirAmbiente={modo === "ambiente"}
            onCriou={() => {
              setModo("none");
              onCriou();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Form inline sempre-aberto do empty-state (reusa o mesmo POST). */
function BotaoNovoItemInline({
  obraId,
  pedirAmbiente,
  onCriou,
}: {
  obraId: string;
  pedirAmbiente: boolean;
  onCriou: () => void;
}) {
  const [nome, setNome] = useState("");
  const [ambiente, setAmbiente] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const criar = useCallback(async () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setErro("Informe o nome do item.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ nome: nomeTrim, ambiente: ambiente.trim() || null }),
      });
      const json = (await res.json()) as { data?: unknown; error?: string };
      if (!res.ok || !json.data) {
        setErro(json.error || "Não foi possível criar.");
        return;
      }
      onCriou();
    } catch {
      setErro("Falha de rede ao criar.");
    } finally {
      setSalvando(false);
    }
  }, [nome, ambiente, obraId, onCriou]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: `${DOURADO}44`, background: BG_DEEP }}>
      {pedirAmbiente ? (
        <input
          autoFocus
          value={ambiente}
          onChange={(e) => setAmbiente(e.target.value)}
          placeholder="Nome do ambiente (ex.: Cozinha)"
          className="min-h-[40px] rounded-md border px-2 text-[13px]"
          style={{ borderColor: BORDA, background: BG_CARD, color: TXT }}
        />
      ) : null}
      <input
        autoFocus={!pedirAmbiente}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void criar();
        }}
        placeholder={pedirAmbiente ? "Primeiro item do ambiente" : "Nome do item"}
        className="min-h-[40px] rounded-md border px-2 text-[13px]"
        style={{ borderColor: BORDA, background: BG_CARD, color: TXT }}
      />
      {erro ? (
        <p className="text-[11px]" style={{ color: "#f85149" }}>
          {erro}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void criar()}
        disabled={salvando}
        className="min-h-[40px] rounded-md text-[13px] font-bold"
        style={{ color: "#f0c869", background: "linear-gradient(180deg, #1d5c3c, #003b26)", border: `1px solid ${DOURADO}` }}
      >
        {salvando ? "Criando…" : pedirAmbiente ? "Criar ambiente + item" : "Adicionar item"}
      </button>
    </div>
  );
}

// ── Aviso de migração (tolerância honesta) ────────────────────────────────────
function AvisoMigracao({ aviso }: { aviso: string | null }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-[12px]" style={{ borderColor: `${DOURADO}44`, background: `${DOURADO}12` }}>
      <p style={{ color: "#f0c869" }}>
        {aviso || "Custo, preço e margem ficam disponíveis após aplicar a migração E7."}
      </p>
      <p className="mt-0.5" style={{ color: TXT_DIM }}>
        O avanço físico por item já funciona. Nada foi perdido.
      </p>
    </div>
  );
}

// ── Helpers de apresentação por lente ─────────────────────────────────────────
function clamp(v: number | null | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * "medido X de Y" (design §4 verbo GERENCIAR): quando o item tem quantidade planejada, mostra o
 * realizado ESTIMADO a partir do pct_avanco atual (X = pct% × Y). Sem quantidade planejada → null
 * (a linha cai no fallback de quantidade simples). Honesto: é estimativa pelo %, não medição crua.
 */
function textoMedidoDe(item: ItemEscopoCalc): string | null {
  const q = Number(item.quantidade);
  if (!Number.isFinite(q) || q <= 0) return null;
  const pct = clamp(item.pct_avanco);
  const realizado = Math.round((pct / 100) * q * 100) / 100;
  const un = item.unidade ? ` ${item.unidade}` : "";
  return `medido ${realizado} de ${q}${un}`;
}

/** Valor formatado de um item conforme a lente (respeita persona p/ custo/margem). */
function valorLente(item: ItemEscopoCalc, lente: LenteEscopo, persona: PersonaEscopo): string {
  if (lente === "avanco") return `${clamp(item.pct_avanco)}%`;
  if (lente === "custo") {
    if (!personaPodeVerCusto(persona)) return "—";
    return item.custo_total == null ? "—" : fmtMoeda(item.custo_total);
  }
  if (lente === "margem") {
    if (!personaPodeVerMargem(persona)) return "—";
    return item.margem_pct == null ? "—" : `${item.margem_pct}%`;
  }
  // preço
  return item.preco_total == null ? "—" : fmtMoeda(item.preco_total);
}

/** Resumo de um subtotal de grupo conforme a lente. */
function resumoLente(
  sub: { custo: number; preco: number; margem_pct: number | null; avanco: number },
  lente: LenteEscopo,
  persona: PersonaEscopo
): string {
  if (lente === "avanco") return `${sub.avanco}%`;
  if (lente === "custo") return personaPodeVerCusto(persona) ? fmtMoeda(sub.custo) : "—";
  if (lente === "margem")
    return personaPodeVerMargem(persona) ? (sub.margem_pct == null ? "—" : `${sub.margem_pct}%`) : "—";
  return fmtMoeda(sub.preco);
}

export default ArvoreEscopo;
