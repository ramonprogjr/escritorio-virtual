"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Compass } from "lucide-react";
import {
  CadastroPremiumSideover,
  CadastroSideoverPanel,
  CadastroTipoBadge,
} from "@/components/crm/cadastro/CadastroPremiumSideover";
import { EntitySelect, type EntitySelectOption } from "@/components/crm/EntitySelect";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  TIPOLOGIAS_PROJETO,
  TIPOLOGIAS_PROJETO_PRINCIPAIS,
  type TipologiaProjetoSlug,
} from "@/lib/crm/projeto-funil-defaults";

type ClienteOpt = EntitySelectOption & { kind: "pessoa" | "empresa" };

type ProjetoCriado = {
  id: string;
  codigo?: string | null;
  titulo?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Negócio de origem ("Gerar projeto"): herda cliente+título; vira fluxo de 2 toques. */
  negocioId?: string | null;
  /** Cliente sugerido (nome desnormalizado) quando vem de um negócio. */
  clienteNomeSugerido?: string | null;
  onCreated?: (projeto: ProjetoCriado, jaExistia: boolean) => void;
};

const VERDE = "#238636";
const DOURADO = "#c9a24a";

export function NovoProjetoSideover({
  open,
  onClose,
  negocioId,
  clienteNomeSugerido,
  onCreated,
}: Props) {
  const [tipologia, setTipologia] = useState<TipologiaProjetoSlug>("residencial");
  const [mostrarOutras, setMostrarOutras] = useState(false);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clienteValue, setClienteValue] = useState("");
  const [titulo, setTitulo] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTipologia("residencial");
    setMostrarOutras(false);
    setClienteValue("");
    setTitulo("");
    setAreaM2("");
    setErro(null);
  }, [open]);

  const carregarClientes = useCallback(async () => {
    setClientesLoading(true);
    try {
      const [pRes, eRes] = await Promise.all([
        fetch("/api/crm/pessoas?limit=50", { headers: internalApiHeaders() }),
        fetch("/api/crm/empresas?limit=50", { headers: internalApiHeaders() }),
      ]);
      const pJson = (await pRes.json()) as { data?: Array<{ id: string; nome?: string; codigo?: string | null }> };
      const eJson = (await eRes.json()) as {
        data?: Array<{ id: string; razao_social?: string; nome_fantasia?: string | null; codigo?: string | null }>;
      };
      const pess: ClienteOpt[] = (pJson.data ?? []).map((p) => ({
        kind: "pessoa",
        value: `pessoa:${p.id}`,
        label: p.nome || "Pessoa sem nome",
        sub: "Pessoa",
      }));
      const emp: ClienteOpt[] = (eJson.data ?? []).map((e) => ({
        kind: "empresa",
        value: `empresa:${e.id}`,
        label: e.nome_fantasia || e.razao_social || "Empresa sem nome",
        sub: "Empresa",
      }));
      setClientes([...pess, ...emp]);
    } catch {
      setClientes([]);
    } finally {
      setClientesLoading(false);
    }
  }, []);

  // Vindo de negócio: não precisa escolher cliente (herdado) → só carrega fora desse caso.
  useEffect(() => {
    if (open && !negocioId) void carregarClientes();
  }, [open, negocioId, carregarClientes]);

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => c.value === clienteValue) || null,
    [clientes, clienteValue]
  );

  const tipoMeta = TIPOLOGIAS_PROJETO.find((t) => t.slug === tipologia);
  const nomeClienteEfetivo = clienteSelecionado?.label || clienteNomeSugerido?.trim() || null;

  function tituloPadrao(): string {
    if (titulo.trim()) return titulo.trim();
    return nomeClienteEfetivo
      ? `Projeto — ${nomeClienteEfetivo}`
      : `Projeto — ${tipoMeta?.label ?? "Arquitetura"}`;
  }

  const tiposVisiveis = mostrarOutras
    ? TIPOLOGIAS_PROJETO
    : TIPOLOGIAS_PROJETO.filter((t) => TIPOLOGIAS_PROJETO_PRINCIPAIS.includes(t.slug));

  async function criar() {
    setSalvando(true);
    setErro(null);
    const [kind, id] = clienteValue.split(":");
    const payload: Record<string, unknown> = {
      titulo: tituloPadrao(),
      tipologia,
    };
    if (negocioId) payload.negocio_id = negocioId;
    if (nomeClienteEfetivo) payload.cliente_nome = nomeClienteEfetivo;
    if (kind === "pessoa" && id) payload.cliente_pessoa_id = id;
    if (kind === "empresa" && id) payload.cliente_empresa_id = id;
    if (areaM2.trim() && !Number.isNaN(Number(areaM2))) payload.area_m2 = Number(areaM2);

    try {
      const res = await fetch("/api/crm/projetos", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        data?: ProjetoCriado;
        ja_existe?: boolean;
        idempotente?: boolean;
        error?: string;
      };
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Não foi possível criar o projeto.");
      }
      onCreated?.(json.data, Boolean(json.ja_existe));
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar o projeto.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel="Arquitetura"
      title="Novo projeto"
      subtitle={negocioId ? "A partir de um negócio" : "Click-and-Go · 3 toques"}
      Icon={Compass}
      badge={<CadastroTipoBadge label="Projeto" tone="gold" />}
      footer={
        <button
          type="button"
          onClick={() => void criar()}
          disabled={salvando}
          className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: VERDE }}
        >
          {salvando ? "Criando…" : "Criar projeto ✓"}
        </button>
      }
    >
      <div className="flex flex-col gap-4 p-1">
        {negocioId ? (
          <div className="rounded-lg border border-[#c9a24a44] bg-[#003b2622] px-3 py-2 text-xs text-[#e6edf3]">
            Origem: negócio
            {clienteNomeSugerido ? ` · cliente ${clienteNomeSugerido}` : ""}. O cliente é herdado.
          </div>
        ) : null}

        {/* Toque 1 — tipologia (chip, default Residencial) */}
        <CadastroSideoverPanel titulo={null} descricao={null}>
          <div className="space-y-3">
            <p className="text-sm font-bold text-[#e6edf3]">Que tipo de projeto?</p>
            <div className="flex flex-wrap gap-2">
              {tiposVisiveis.map((t) => {
                const ativo = t.slug === tipologia;
                return (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => setTipologia(t.slug)}
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
            {!mostrarOutras && (
              <button
                type="button"
                onClick={() => setMostrarOutras(true)}
                className="text-xs font-bold text-[#8b949e] hover:underline"
              >
                outras tipologias ⌄
              </button>
            )}
          </div>
        </CadastroSideoverPanel>

        {/* Toque 2 — cliente (opcional; oculto quando vem de negócio) */}
        {!negocioId ? (
          <CadastroSideoverPanel titulo={null} descricao={null}>
            <div className="space-y-2">
              <p className="text-sm font-bold text-[#e6edf3]">De quem é o projeto? (opcional)</p>
              <EntitySelect
                value={clienteValue}
                onChange={setClienteValue}
                options={clientes}
                loading={clientesLoading}
                clearable
                placeholder="Buscar cliente · nome…"
                searchPlaceholder="Nome…"
                emptyLabel="Nenhum cliente cadastrado ainda."
              />
            </div>
          </CadastroSideoverPanel>
        ) : null}

        {/* Título auto + área (opcionais) */}
        <CadastroSideoverPanel titulo={null} descricao={null}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-[#8b949e]">Nome do projeto (opcional)</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={tituloPadrao()}
                className="w-full rounded-lg border border-[#1d3a2c] bg-[#0f1d16] px-3 py-2 text-sm text-[#e6edf3]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-[#8b949e]">Área (m²) — opcional</label>
              <input
                value={areaM2}
                onChange={(e) => setAreaM2(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
                inputMode="decimal"
                placeholder="ex.: 248"
                className="w-full rounded-lg border border-[#1d3a2c] bg-[#0f1d16] px-3 py-2 text-sm text-[#e6edf3]"
              />
            </div>
            <p className="text-[11px] leading-relaxed text-[#6e7781]">
              O projeto nasce em <strong className="text-[#8b949e]">Briefing</strong>. Você poderá montar o
              programa, mover de estágio e anexar entregáveis na ficha.
            </p>
          </div>
        </CadastroSideoverPanel>

        {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
      </div>
    </CadastroPremiumSideover>
  );
}
