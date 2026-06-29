"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HardHat } from "lucide-react";
import {
  CadastroPremiumSideover,
  CadastroSideoverPanel,
  CadastroTipoBadge,
} from "@/components/crm/cadastro/CadastroPremiumSideover";
import { EntitySelect, type EntitySelectOption } from "@/components/crm/EntitySelect";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  TIPOS_OBRA,
  TIPOS_OBRA_PRINCIPAIS,
  getPresetPorTipo,
  getPresetPorSegmento,
  type TipoObraSlug,
} from "@/lib/obras/eap-presets";
import { SEGMENTOS, type SegmentoSlug } from "@/lib/obras/taxonomia";

type ClienteOpt = EntitySelectOption & { kind: "pessoa" | "empresa" };

type FrentePreview = { disciplina_slug: string; nome: string; on: boolean };

type ObraCriada = {
  id: string;
  codigo?: string | null;
  codigo_legivel?: string | null;
  titulo?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Negócio de origem (vindo de "Gerar obra"): herda o cliente e pula o passo 1. */
  negocioId?: string | null;
  /** Título sugerido (ex.: do negócio). */
  tituloSugerido?: string;
  onCreated?: (obra: ObraCriada, frentesCriadas: number) => void;
};

const VERDE = "#238636";
const DOURADO = "#c9a24a";

export function NovaObraSideover({
  open,
  onClose,
  negocioId,
  tituloSugerido,
  onCreated,
}: Props) {
  const [passo, setPasso] = useState(1);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clienteValue, setClienteValue] = useState(""); // formato "pessoa:<id>" | "empresa:<id>"
  const [tipoObra, setTipoObra] = useState<TipoObraSlug>("reforma");
  const [mostrarOutrosTipos, setMostrarOutrosTipos] = useState(false);
  // E0.5: segmento opcional (null = Geral → preset genérico do tipo, comportamento atual).
  const [segmento, setSegmento] = useState<SegmentoSlug | null>(null);
  const [frentes, setFrentes] = useState<FrentePreview[]>([]);
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Reset ao abrir; se vier de negócio, começa no passo 2 (cliente herdado).
  useEffect(() => {
    if (!open) return;
    setPasso(negocioId ? 2 : 1);
    setClienteValue("");
    setTipoObra("reforma");
    setMostrarOutrosTipos(false);
    setSegmento(null);
    setTitulo(tituloSugerido?.trim() || "");
    setErro(null);
  }, [open, negocioId, tituloSugerido]);

  // Carrega clientes (pessoas + empresas) só quando precisa escolher.
  const carregarClientes = useCallback(async () => {
    setClientesLoading(true);
    try {
      const [pRes, eRes] = await Promise.all([
        fetch("/api/crm/pessoas?limit=50", { headers: internalApiHeaders() }),
        fetch("/api/crm/empresas?limit=50", { headers: internalApiHeaders() }),
      ]);
      const pJson = (await pRes.json()) as {
        data?: Array<{ id: string; nome?: string; codigo?: string | null }>;
      };
      const eJson = (await eRes.json()) as {
        data?: Array<{ id: string; razao_social?: string; nome_fantasia?: string | null; codigo?: string | null }>;
      };
      const pess: ClienteOpt[] = (pJson.data ?? []).map((p) => ({
        kind: "pessoa",
        value: `pessoa:${p.id}`,
        label: p.nome || "Pessoa sem nome",
        sub: p.codigo || "Pessoa",
      }));
      const emp: ClienteOpt[] = (eJson.data ?? []).map((e) => ({
        kind: "empresa",
        value: `empresa:${e.id}`,
        label: e.nome_fantasia || e.razao_social || "Empresa sem nome",
        sub: e.codigo || "Empresa",
      }));
      setClientes([...pess, ...emp]);
    } catch {
      setClientes([]);
    } finally {
      setClientesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !negocioId) void carregarClientes();
  }, [open, negocioId, carregarClientes]);

  // Preset efetivo: por segmento (se escolhido) ou genérico do tipo (Geral / comportamento atual).
  const presetEfetivo = useMemo(
    () => (segmento ? getPresetPorSegmento(segmento) : undefined) ?? getPresetPorTipo(tipoObra),
    [segmento, tipoObra]
  );

  // Pré-monta a EAP do preset quando o tipo/segmento muda (IA-first: já vem marcado).
  useEffect(() => {
    setFrentes(
      (presetEfetivo?.frentes ?? []).map((f) => ({
        disciplina_slug: f.disciplina_slug,
        nome: f.nome,
        on: true,
      }))
    );
  }, [presetEfetivo]);

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => c.value === clienteValue) || null,
    [clientes, clienteValue]
  );

  const tipoMeta = TIPOS_OBRA.find((t) => t.slug === tipoObra);

  function tituloPadrao(): string {
    if (titulo.trim()) return titulo.trim();
    const nomeCliente = clienteSelecionado?.label;
    const base = tipoMeta?.label ?? "Obra";
    return nomeCliente ? `${base} · ${nomeCliente}` : base;
  }

  async function criar() {
    setSalvando(true);
    setErro(null);
    const [kind, id] = clienteValue.split(":");
    const payload: Record<string, unknown> = {
      titulo: tituloPadrao(),
      tipo_obra: tipoObra,
      // C2 (Click-and-Go): honra a seleção do passo 3. Disciplinas das frentes marcadas.
      // Se TODAS estiverem marcadas, mandamos a lista cheia — a API trata vazio/ausente como "todas".
      frentes_selecionadas: frentes.filter((f) => f.on).map((f) => f.disciplina_slug),
    };
    // E0.5: só envia segmento quando escolhido (Geral = ausente = preset genérico, intocado).
    if (segmento) payload.segmento = segmento;
    if (negocioId) payload.negocio_id = negocioId;
    if (kind === "pessoa" && id) payload.cliente_pessoa_id = id;
    if (kind === "empresa" && id) payload.cliente_empresa_id = id;

    try {
      const res = await fetch("/api/crm/obras", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        data?: ObraCriada;
        frentes_criadas?: number;
        error?: string;
      };
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Não foi possível criar a obra.");
      }
      onCreated?.(json.data, json.frentes_criadas ?? 0);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar a obra.");
    } finally {
      setSalvando(false);
    }
  }

  const tiposVisiveis = mostrarOutrosTipos
    ? TIPOS_OBRA
    : TIPOS_OBRA.filter((t) => TIPOS_OBRA_PRINCIPAIS.includes(t.slug));
  const frentesAtivas = frentes.filter((f) => f.on).length;

  const codigoPreview = `${tipoMeta?.prefixo ?? "OBR"}-${new Date().getFullYear()}-####`;

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel="Engenharia"
      title="Nova obra"
      subtitle={`Passo ${passo} de 3`}
      Icon={HardHat}
      badge={<CadastroTipoBadge label="Obra" tone="gold" />}
      footer={
        passo === 3 ? (
          <>
            <button
              type="button"
              onClick={() => setPasso(2)}
              className="rounded-lg border border-[#344256] bg-[#1d2633] px-4 py-2 text-sm font-bold text-[#9eb0c8]"
            >
              ← Voltar
            </button>
            <button
              type="button"
              onClick={() => void criar()}
              disabled={salvando}
              className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: VERDE }}
            >
              {salvando ? "Criando…" : "Criar obra ✓"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPasso((p) => Math.min(3, p + 1))}
            disabled={passo === 1 && !clienteValue && !negocioId}
            className="rounded-lg px-4 py-2 text-sm font-bold text-[#003b26] disabled:opacity-50"
            style={{ background: DOURADO }}
          >
            Continuar →
          </button>
        )
      }
    >
      <div className="flex flex-col gap-4 p-1">
        {/* Indicador de passos */}
        <div className="flex items-center gap-2" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: n <= passo ? DOURADO : "#1d3a2c" }}
            />
          ))}
        </div>

        {/* PASSO 1 — cliente */}
        {passo === 1 && (
          <CadastroSideoverPanel titulo={null} descricao={null}>
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#e6edf3]">De quem é a obra?</p>
              <EntitySelect
                value={clienteValue}
                onChange={setClienteValue}
                options={clientes}
                loading={clientesLoading}
                clearable
                placeholder="Buscar cliente · nome / código…"
                searchPlaceholder="Nome, código…"
                emptyLabel="Nenhum cliente cadastrado ainda."
              />
              <button
                type="button"
                onClick={() => setPasso(2)}
                className="text-xs font-bold text-[#8b949e] underline-offset-2 hover:underline"
              >
                sem cliente / obra interna →
              </button>
            </div>
          </CadastroSideoverPanel>
        )}

        {/* PASSO 2 — tipo */}
        {passo === 2 && (
          <CadastroSideoverPanel titulo={null} descricao={null}>
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#e6edf3]">Que tipo de obra?</p>
              <div className="flex flex-wrap gap-2">
                {tiposVisiveis.map((t) => {
                  const ativo = t.slug === tipoObra;
                  return (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() => setTipoObra(t.slug)}
                      className="rounded-xl border px-3.5 py-2.5 text-sm font-bold"
                      style={{
                        borderColor: ativo ? DOURADO : "#1d3a2c",
                        background: ativo ? "rgba(201,162,74,0.12)" : "#0a140f",
                        color: ativo ? "#e6edf3" : "#8b949e",
                      }}
                    >
                      <span className="mr-1" aria-hidden>
                        {t.icone}
                      </span>
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {!mostrarOutrosTipos && (
                <button
                  type="button"
                  onClick={() => setMostrarOutrosTipos(true)}
                  className="text-xs font-bold text-[#8b949e] hover:underline"
                >
                  outros tipos ⌄
                </button>
              )}

              {/* E0.5 — Segmento (opcional): entrega ambientes típicos pré-distribuídos. */}
              <div className="pt-1">
                <label className="mb-1 block text-[11px] font-bold text-[#8b949e]">
                  Segmento (opcional — a IA distribui por ambiente)
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSegmento(null)}
                    className="rounded-xl border px-3 py-2 text-sm font-bold"
                    style={{
                      borderColor: segmento === null ? DOURADO : "#1d3a2c",
                      background: segmento === null ? "rgba(201,162,74,0.12)" : "#0a140f",
                      color: segmento === null ? "#e6edf3" : "#8b949e",
                    }}
                  >
                    Geral
                  </button>
                  {SEGMENTOS.map((s) => {
                    const ativo = segmento === s.slug;
                    return (
                      <button
                        key={s.slug}
                        type="button"
                        onClick={() => setSegmento(s.slug)}
                        className="rounded-xl border px-3 py-2 text-sm font-bold"
                        style={{
                          borderColor: ativo ? DOURADO : "#1d3a2c",
                          background: ativo ? "rgba(201,162,74,0.12)" : "#0a140f",
                          color: ativo ? "#e6edf3" : "#8b949e",
                        }}
                      >
                        <span className="mr-1" aria-hidden>
                          {s.icone}
                        </span>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1">
                <label className="mb-1 block text-[11px] font-bold text-[#8b949e]">
                  Nome da obra (opcional)
                </label>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder={tituloPadrao()}
                  className="w-full rounded-lg border border-[#1d3a2c] bg-[#0f1d16] px-3 py-2 text-sm text-[#e6edf3]"
                />
              </div>
            </div>
          </CadastroSideoverPanel>
        )}

        {/* PASSO 3 — revisar + criar */}
        {passo === 3 && (
          <CadastroSideoverPanel titulo={null} descricao={null}>
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#e6edf3]">
                {tipoMeta?.label}
                {clienteSelecionado ? ` · ${clienteSelecionado.label}` : ""}
              </p>
              <div className="rounded-lg border border-[#1d3a2c] bg-[#0a140f] px-3 py-2">
                <span className="text-[11px] text-[#8b949e]">Código (automático)</span>
                <p className="font-mono text-sm font-bold" style={{ color: DOURADO }}>
                  {codigoPreview}
                </p>
              </div>
              <p className="text-xs text-[#8b949e]">
                A IA já montou a EAP ({frentesAtivas} frentes do preset{" "}
                {presetEfetivo?.nome ?? "—"}
                {segmento ? " · ambiente-first" : ""}):
              </p>
              <div className="flex flex-wrap gap-2">
                {frentes.length === 0 ? (
                  <span className="text-xs text-[#8b949e]">
                    Tipo sem preset — você poderá adicionar frentes na EAP depois.
                  </span>
                ) : (
                  frentes.map((f, i) => (
                    <button
                      key={`${f.disciplina_slug}-${i}`}
                      type="button"
                      onClick={() =>
                        setFrentes((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, on: !x.on } : x))
                        )
                      }
                      className="rounded-full border px-3 py-1.5 text-xs font-bold"
                      style={{
                        borderColor: f.on ? `${DOURADO}66` : "#1d3a2c",
                        background: f.on ? "rgba(201,162,74,0.1)" : "#0a140f",
                        color: f.on ? "#e6edf3" : "#6e7781",
                      }}
                    >
                      {f.on ? "☑" : "☐"} {f.nome}
                    </button>
                  ))
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-[#6e7781]">
                As frentes marcadas serão criadas; ajuste depois (ocultar, renomear,
                reordenar ou adicionar) no editor da EAP a qualquer momento.
              </p>
            </div>
          </CadastroSideoverPanel>
        )}

        {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
      </div>
    </CadastroPremiumSideover>
  );
}
