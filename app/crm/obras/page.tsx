"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, HardHat, X, ChevronRight, MapPin } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Obra = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: string;
  cidade: string | null;
  estado: string | null;
  data_inicio: string | null;
  negocio_id: string | null;
  imovel_id: string | null;
  criado_em: string;
};

const STATUS_OPTS = [
  { value: "planejamento", label: "Planejamento" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausada", label: "Pausada" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

const STATUS_COLOR: Record<string, string> = {
  planejamento: "#60a5fa", em_andamento: "#f59e0b",
  pausada: "#8b949e", concluida: "#3fb950", cancelada: "#ef4444",
};

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const EMPTY_FORM = {
  titulo: "", status: "planejamento", endereco: "", cidade: "", estado: "",
};

function ObrasPageInner() {
  const searchParams = useSearchParams();
  const negocioIdParam = searchParams.get("negocio_id") || "";

  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const q = negocioIdParam ? `?negocio_id=${encodeURIComponent(negocioIdParam)}` : "";
      const res = await fetch(`/api/crm/obras${q}`, { headers: internalApiHeaders() });
      const json = (await res.json()) as { data?: Obra[]; error?: string };
      if (!res.ok) { setErro(json.error || "Erro ao carregar obras."); return; }
      setObras(json.data ?? []);
    } catch { setErro("Erro de rede."); }
    finally { setLoading(false); }
  }, [negocioIdParam]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function criar() {
    if (!form.titulo.trim()) { setErroSalvar("Título obrigatório."); return; }
    setSalvando(true);
    setErroSalvar("");
    const res = await fetch("/api/crm/obras", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        titulo: form.titulo.trim(),
        status: form.status,
        endereco: form.endereco.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado || null,
        negocio_id: negocioIdParam || null,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: Obra; error?: string };
    if (!res.ok) { setErroSalvar(json.error || "Erro ao criar."); setSalvando(false); return; }
    if (json.data) setObras((prev) => [json.data!, ...prev]);
    setModal(false);
    setForm({ ...EMPTY_FORM });
    setSalvando(false);
  }

  return (
    <div className="min-h-full bg-[#0d1117]" style={{ color: "#e6edf3" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#30363d] bg-[#0d1117]/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Construção</h1>
            <p className="text-xs text-[#8b949e]">Gestão de obras e canteiros</p>
          </div>
          <button
            type="button"
            onClick={() => { setModal(true); setErroSalvar(""); }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#c9a24a] px-4 text-xs font-bold text-[#003b26] hover:bg-[#b8912f] transition-colors"
          >
            <Plus size={14} />
            Nova obra
          </button>
        </div>
      </div>

      <div className="p-6" style={{ maxWidth: 800 }}>
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-[#161b22]" />)}
          </div>
        ) : erro ? (
          <div className="rounded-xl border border-[#f87171]/30 bg-[#f87171]/10 p-4 text-sm text-[#f87171]">
            {erro} <button type="button" onClick={() => void carregar()} className="underline">tentar novamente</button>
          </div>
        ) : obras.length === 0 ? (
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-10 text-center">
            <HardHat size={32} className="mx-auto mb-3 text-[#30363d]" />
            <p className="text-sm text-[#8b949e]">Nenhuma obra cadastrada. Crie a primeira acima.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {obras.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/crm/obras/${o.id}`}
                  className="flex items-center gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-4 hover:border-[#444c56] transition-colors no-underline"
                >
                  <HardHat size={18} className="shrink-0 text-[#c9a24a]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[#e6edf3] truncate">{o.titulo}</p>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ color: STATUS_COLOR[o.status] ?? "#8b949e", background: `${STATUS_COLOR[o.status] ?? "#8b949e"}20` }}
                      >
                        {STATUS_OPTS.find((s) => s.value === o.status)?.label ?? o.status}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-[#8b949e]">{o.codigo}</p>
                    {(o.cidade || o.estado) && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#8b949e]">
                        <MapPin size={11} />
                        {[o.cidade, o.estado].filter(Boolean).join(" / ")}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-[#8b949e]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal nova obra */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#30363d] bg-[#161b22] p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold">Nova obra</h2>
              <button type="button" onClick={() => setModal(false)} className="text-[#8b949e] hover:text-[#e6edf3]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Título *</label>
                <input
                  value={form.titulo}
                  onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Residência Jardins — Reforma completa"
                  className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none"
                >
                  {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Endereço</label>
                <input
                  value={form.endereco}
                  onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))}
                  placeholder="Rua, número, complemento"
                  className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[#8b949e]">Cidade</label>
                  <input
                    value={form.cidade}
                    onChange={(e) => setForm((p) => ({ ...p, cidade: e.target.value }))}
                    placeholder="São Paulo"
                    className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#8b949e]">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))}
                    className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none"
                  >
                    <option value="">Estado</option>
                    {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {erroSalvar && <p className="mt-3 text-xs text-[#f87171]">{erroSalvar}</p>}

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setModal(false)} className="flex-1 min-h-10 rounded-lg bg-[#21262d] text-xs text-[#8b949e]">
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void criar()}
                className="flex-1 min-h-10 rounded-lg bg-[#c9a24a] text-xs font-bold text-[#003b26] disabled:opacity-60"
              >
                {salvando ? "Criando…" : "Criar obra"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ObrasPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#8b949e]">Carregando obras…</div>}>
      <ObrasPageInner />
    </Suspense>
  );
}
