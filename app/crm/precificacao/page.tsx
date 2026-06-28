"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Save } from "lucide-react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { useCrmRole } from "@/hooks/useCrmRole";
import { toast } from "@/components/crm/toast";

type Config = {
  markup: number;
  fx_usd_brl: number;
  valor_credito_brl: number;
  nome_moeda: string;
  modo: string;
  alerta_saldo_baixo: number;
};
type Preco = { modelo: string; input_usd_milhao: number; output_usd_milhao: number; ativo: boolean };

const CONFIG_FALLBACK: Config = {
  markup: 10,
  fx_usd_brl: 6,
  valor_credito_brl: 0.1,
  nome_moeda: "Tijolos",
  modo: "prepago",
  alerta_saldo_baixo: 50,
};

export default function PrecificacaoPage() {
  const { isOwner, loading: roleLoading } = useCrmRole();
  const [cfg, setCfg] = useState<Config>(CONFIG_FALLBACK);
  const [precos, setPrecos] = useState<Preco[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [salvandoModelo, setSalvandoModelo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const headers = await crmApiHeaders();
      const [rc, rp] = await Promise.all([
        fetch("/api/crm/ia/config", { headers }),
        fetch("/api/crm/ia/precos", { headers }),
      ]);
      const jc = (await rc.json()) as { data?: Config | null };
      const jp = (await rp.json()) as { data?: Preco[] };
      if (rc.ok && jc.data) setCfg({ ...CONFIG_FALLBACK, ...jc.data });
      if (rp.ok && jp.data) setPrecos(jp.data);
    } catch {
      toast.error("Erro ao carregar precificação");
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (!roleLoading) void carregar();
  }, [roleLoading, carregar]);

  async function salvarConfig() {
    setSalvandoCfg(true);
    try {
      const res = await fetch("/api/crm/ia/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify(cfg),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || "Falha ao salvar configuração");
        return;
      }
      toast.success("Precificação salva");
    } finally {
      setSalvandoCfg(false);
    }
  }

  async function salvarModelo(p: Preco) {
    setSalvandoModelo(p.modelo);
    try {
      const res = await fetch("/api/crm/ia/precos", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify(p),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || "Falha ao salvar modelo");
        return;
      }
      toast.success(`${p.modelo} salvo`);
    } finally {
      setSalvandoModelo(null);
    }
  }

  // Exemplo de margem: ação típica de 1000 tokens entrada + 500 saída no modelo mais caro ativo.
  const modeloExemplo = precos.filter((p) => p.ativo).sort((a, b) => b.output_usd_milhao - a.output_usd_milhao)[0];
  const custoUsdEx = modeloExemplo
    ? (1000 * modeloExemplo.input_usd_milhao + 500 * modeloExemplo.output_usd_milhao) / 1_000_000
    : 0;
  const custoBrlEx = custoUsdEx * cfg.fx_usd_brl * cfg.markup;
  const tijolosEx = cfg.valor_credito_brl > 0 ? Math.ceil(custoBrlEx / cfg.valor_credito_brl) : 0;
  const custoRealBrlEx = custoUsdEx * cfg.fx_usd_brl;
  const margemEx = custoBrlEx - custoRealBrlEx;

  const inputCls =
    "w-full min-h-10 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 text-sm text-[#e6edf3]";
  const labelCls = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#8b949e]";

  if (roleLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a140f] text-sm text-[#8b949e]">
        Carregando…
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-8 text-center">
          <Coins className="mx-auto mb-4 h-8 w-8 text-[#c9a24a]" />
          <h1 className="text-lg font-bold text-[#e6edf3]">Precificação & IA</h1>
          <p className="mt-2 text-sm text-[#8b949e]">Apenas owners podem configurar a precificação.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#0a140f]">
      <CrmStickyPageHeader
        title="Precificação & IA"
        description="Configuração de negócios (super-admin): valor do Tijolo, margem, câmbio e preços por modelo."
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {/* Config global */}
        <div className="rounded-2xl border border-[#1d3a2c] bg-[#0f1d16] p-5">
          <h2 className="mb-3 text-sm font-bold text-[#e6edf3]">Moeda & margem</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Nome da moeda</label>
              <input className={inputCls} value={cfg.nome_moeda} onChange={(e) => setCfg((c) => ({ ...c, nome_moeda: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Valor do Tijolo (R$)</label>
              <input className={inputCls} type="number" step="0.01" value={cfg.valor_credito_brl} onChange={(e) => setCfg((c) => ({ ...c, valor_credito_brl: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Markup (×)</label>
              <input className={inputCls} type="number" step="0.5" value={cfg.markup} onChange={(e) => setCfg((c) => ({ ...c, markup: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Câmbio USD→BRL</label>
              <input className={inputCls} type="number" step="0.1" value={cfg.fx_usd_brl} onChange={(e) => setCfg((c) => ({ ...c, fx_usd_brl: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Modo</label>
              <select className={inputCls} value={cfg.modo} onChange={(e) => setCfg((c) => ({ ...c, modo: e.target.value }))}>
                <option value="prepago">Pré-pago (hard-cap)</option>
                <option value="pospago">Pós-pago (exceção)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Alerta de saldo baixo</label>
              <input className={inputCls} type="number" value={cfg.alerta_saldo_baixo} onChange={(e) => setCfg((c) => ({ ...c, alerta_saldo_baixo: Number(e.target.value) }))} />
            </div>
          </div>

          {/* Visão de margem (única tela com R$) */}
          {modeloExemplo && (
            <div className="mt-4 rounded-xl border border-[#c9a24a33] bg-[#1a1505] p-3 text-xs">
              <p className="mb-1 font-bold text-[#c9a24a]">Exemplo de margem (ação típica · {modeloExemplo.modelo})</p>
              <p className="text-[#8b949e]">
                Custo real <strong className="text-[#e6edf3]">R$ {custoRealBrlEx.toFixed(4)}</strong> · cobra{" "}
                <strong className="text-[#e0b86a]">{tijolosEx} {cfg.nome_moeda}</strong> (R$ {custoBrlEx.toFixed(2)}) ·
                margem <strong className="text-[#3fb950]">R$ {margemEx.toFixed(2)}</strong>
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={salvandoCfg}
            onClick={() => void salvarConfig()}
            className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#c9a24a] px-4 text-xs font-bold text-[#003b26] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {salvandoCfg ? "Salvando…" : "Salvar configuração"}
          </button>
        </div>

        {/* Preços por modelo */}
        <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-[#8b949e]">Preços por modelo (USD / 1M tokens)</h2>
        {loading ? (
          <p className="text-sm text-[#8b949e]">Carregando…</p>
        ) : (
          <div className="space-y-2">
            {precos.map((p, idx) => (
              <div key={p.modelo} className="flex flex-wrap items-end gap-2 rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-3">
                <div className="min-w-[160px] flex-1">
                  <span className="text-sm font-semibold text-[#e6edf3]">{p.modelo}</span>
                  <span className="ml-2 text-[10px] font-bold uppercase text-[#6e7681]">
                    {p.modelo.startsWith("claude") ? "Turbo" : p.modelo.startsWith("mistral") ? "Econômico" : ""}
                  </span>
                </div>
                <div>
                  <label className={labelCls}>Input</label>
                  <input className={`${inputCls} w-24`} type="number" step="0.1" value={p.input_usd_milhao}
                    onChange={(e) => setPrecos((arr) => arr.map((x, i) => (i === idx ? { ...x, input_usd_milhao: Number(e.target.value) } : x)))} />
                </div>
                <div>
                  <label className={labelCls}>Output</label>
                  <input className={`${inputCls} w-24`} type="number" step="0.1" value={p.output_usd_milhao}
                    onChange={(e) => setPrecos((arr) => arr.map((x, i) => (i === idx ? { ...x, output_usd_milhao: Number(e.target.value) } : x)))} />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-[#8b949e]">
                  <input type="checkbox" checked={p.ativo}
                    onChange={(e) => setPrecos((arr) => arr.map((x, i) => (i === idx ? { ...x, ativo: e.target.checked } : x)))} />
                  Ativo
                </label>
                <button
                  type="button"
                  disabled={salvandoModelo === p.modelo}
                  onClick={() => void salvarModelo(p)}
                  className="min-h-9 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 text-xs font-bold text-[#e6edf3] disabled:opacity-50"
                >
                  {salvandoModelo === p.modelo ? "…" : "Salvar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
