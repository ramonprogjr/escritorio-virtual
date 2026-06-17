"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Package, ClipboardList, BookOpen, AlertTriangle } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type ObraDetalhe = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  data_inicio: string | null;
  data_previsao_fim: string | null;
  negocio_id: string | null;
};

type Pedido = { id: string; descricao: string; status: string; valor_estimado: number | null };
type DiarioEntry = { id: string; resumo: string; criado_em: string };
type CheckIn = { id: string; tipo: string; criado_em: string };
type Ocorrencia = { id: string; descricao: string; criado_em: string };

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

const PEDIDO_STATUS_COLOR: Record<string, string> = {
  rascunho: "#8b949e", cotando: "#60a5fa", aprovado: "#f59e0b",
  entregue: "#3fb950", cancelado: "#ef4444",
};

const ESTADOS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

type Tab = "pedidos" | "diario" | "checkins" | "ocorrencias";

export default function ObraPainelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [obra, setObra] = useState<ObraDetalhe | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [diario, setDiario] = useState<DiarioEntry[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [tab, setTab] = useState<Tab>("pedidos");

  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ titulo: "", status: "", endereco: "", cidade: "", estado: "", data_inicio: "", data_previsao_fim: "" });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(id)}`, { headers: internalApiHeaders() });
      const json = (await res.json()) as {
        data?: ObraDetalhe; pedidos?: Pedido[]; diario?: DiarioEntry[];
        checkins?: CheckIn[]; ocorrencias?: Ocorrencia[]; error?: string;
      };
      if (!res.ok) { setErro(json.error || "Obra não encontrada."); return; }
      setObra(json.data ?? null);
      setPedidos(json.pedidos ?? []);
      setDiario(json.diario ?? []);
      setCheckins(json.checkins ?? []);
      setOcorrencias(json.ocorrencias ?? []);
      if (json.data) {
        const o = json.data;
        setForm({
          titulo: o.titulo,
          status: o.status,
          endereco: o.endereco ?? "",
          cidade: o.cidade ?? "",
          estado: o.estado ?? "",
          data_inicio: o.data_inicio?.split("T")[0] ?? "",
          data_previsao_fim: o.data_previsao_fim?.split("T")[0] ?? "",
        });
      }
    } catch { setErro("Erro de rede."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar() {
    if (!form.titulo.trim()) { setErroSalvar("Título obrigatório."); return; }
    setSalvando(true);
    setErroSalvar("");
    const patch: Record<string, string | null> = {
      titulo: form.titulo.trim(),
      status: form.status,
      endereco: form.endereco.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado || null,
      data_inicio: form.data_inicio || null,
      data_previsao_fim: form.data_previsao_fim || null,
    };
    const res = await fetch(`/api/crm/obras/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify(patch),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: ObraDetalhe; error?: string };
    if (!res.ok) { setErroSalvar(json.error || "Erro ao salvar."); setSalvando(false); return; }
    if (json.data) setObra(json.data);
    setEditando(false);
    setSalvando(false);
  }

  function fmt(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }

  if (loading) return (
    <div className="min-h-full bg-[#0d1117] p-6 space-y-4">
      <div className="h-5 w-28 animate-pulse rounded bg-[#21262d]" />
      <div className="h-10 w-64 animate-pulse rounded bg-[#161b22]" />
    </div>
  );

  if (erro || !obra) return (
    <div className="min-h-full bg-[#0d1117] p-6">
      <button type="button" onClick={() => router.push("/crm/obras")} className="mb-4 inline-flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3]">
        <ArrowLeft size={14} /> Obras
      </button>
      <p className="text-sm text-[#f87171]">{erro || "Obra não encontrada."}</p>
    </div>
  );

  const statusLabel = STATUS_OPTS.find((s) => s.value === obra.status)?.label ?? obra.status;

  const TABS: { id: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { id: "pedidos", label: "Pedidos", count: pedidos.length, icon: <Package size={14} /> },
    { id: "diario", label: "Diário", count: diario.length, icon: <BookOpen size={14} /> },
    { id: "checkins", label: "Check-ins", count: checkins.length, icon: <ClipboardList size={14} /> },
    { id: "ocorrencias", label: "Ocorrências", count: ocorrencias.length, icon: <AlertTriangle size={14} /> },
  ];

  return (
    <div className="min-h-full bg-[#0d1117]" style={{ color: "#e6edf3" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#30363d] bg-[#0d1117]/95 px-6 py-4 backdrop-blur">
        <div className="mb-2">
          <button type="button" onClick={() => router.push("/crm/obras")} className="inline-flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            <ArrowLeft size={14} /> Obras
          </button>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold">{obra.titulo}</h1>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ color: STATUS_COLOR[obra.status] ?? "#8b949e", background: `${STATUS_COLOR[obra.status] ?? "#8b949e"}20` }}
              >
                {statusLabel}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-xs text-[#8b949e]">{obra.codigo}</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditando(!editando); setErroSalvar(""); }}
            className="shrink-0 min-h-9 rounded-lg border border-[#30363d] px-3 text-xs text-[#8b949e] hover:text-[#e6edf3] hover:border-[#444c56] transition-colors"
          >
            {editando ? "Cancelar" : "Editar"}
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl space-y-6">
        {/* Formulário de edição */}
        {editando && (
          <div className="rounded-xl border border-[#c9a24a]/30 bg-[#161b22] p-5">
            <h2 className="mb-4 text-sm font-bold text-[#c9a24a]">Editar obra</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-[#8b949e]">Título *</label>
                <input value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none">
                  {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Estado</label>
                <select value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none">
                  <option value="">—</option>
                  {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-[#8b949e]">Endereço</label>
                <input value={form.endereco} onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))} placeholder="Rua, número" className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Cidade</label>
                <input value={form.cidade} onChange={(e) => setForm((p) => ({ ...p, cidade: e.target.value }))} className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Início</label>
                <input type="date" value={form.data_inicio} onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))} className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Previsão de entrega</label>
                <input type="date" value={form.data_previsao_fim} onChange={(e) => setForm((p) => ({ ...p, data_previsao_fim: e.target.value }))} className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none" />
              </div>
            </div>
            {erroSalvar && <p className="mt-2 text-xs text-[#f87171]">{erroSalvar}</p>}
            <button
              type="button"
              disabled={salvando}
              onClick={() => void salvar()}
              className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#c9a24a] px-4 text-xs font-bold text-[#003b26] disabled:opacity-60"
            >
              <Save size={14} />
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        )}

        {/* Info rápida */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-xs text-[#8b949e]">Localização</p>
            <p className="mt-0.5 text-sm font-semibold">
              {[obra.cidade, obra.estado].filter(Boolean).join(" / ") || "Não informado"}
            </p>
            {obra.endereco && <p className="mt-0.5 text-xs text-[#8b949e]">{obra.endereco}</p>}
          </div>
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-xs text-[#8b949e]">Início</p>
            <p className="mt-0.5 text-sm font-semibold">{fmt(obra.data_inicio)}</p>
          </div>
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-xs text-[#8b949e]">Previsão de entrega</p>
            <p className="mt-0.5 text-sm font-semibold">{fmt(obra.data_previsao_fim)}</p>
          </div>
          {obra.negocio_id && (
            <Link
              href={`/crm/negocios/${obra.negocio_id}`}
              className="sm:col-span-3 flex items-center gap-2 rounded-xl border border-[#30363d] bg-[#161b22] p-3 hover:border-[#444c56] transition-colors no-underline text-xs font-semibold text-[#60a5fa]"
            >
              Negócio vinculado →
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-1 border-b border-[#30363d] mb-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.id
                    ? "border-[#c9a24a] text-[#c9a24a]"
                    : "border-transparent text-[#8b949e] hover:text-[#e6edf3]"
                }`}
              >
                {t.icon}
                {t.label}
                {t.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs ${tab === t.id ? "bg-[#c9a24a]/20" : "bg-[#21262d]"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "pedidos" && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-[#8b949e]">{pedidos.length} pedido(s) de material</p>
                <Link href={`/crm/pedidos?obra_id=${obra.id}`} className="text-xs text-[#c9a24a] hover:underline">
                  + Novo pedido
                </Link>
              </div>
              {pedidos.length === 0 ? (
                <p className="text-xs text-[#8b949e]">Nenhum pedido para esta obra.</p>
              ) : (
                <ul className="space-y-2">
                  {pedidos.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-3 text-sm">
                      <span className="flex-1 truncate">{p.descricao}</span>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-xs" style={{ color: PEDIDO_STATUS_COLOR[p.status] ?? "#8b949e", background: `${PEDIDO_STATUS_COLOR[p.status] ?? "#8b949e"}20` }}>
                        {p.status}
                      </span>
                      {p.valor_estimado != null && (
                        <span className="shrink-0 text-xs text-[#8b949e]">
                          {p.valor_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "diario" && (
            <div>
              {diario.length === 0 ? (
                <p className="text-xs text-[#8b949e]">Nenhum registro no diário de obra.</p>
              ) : (
                <ul className="space-y-2">
                  {diario.map((d) => (
                    <li key={d.id} className="rounded-xl border border-[#30363d] bg-[#161b22] p-3">
                      <p className="text-xs text-[#8b949e] mb-1">{fmt(d.criado_em)}</p>
                      <p className="text-sm">{d.resumo}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "checkins" && (
            <div>
              {checkins.length === 0 ? (
                <p className="text-xs text-[#8b949e]">Nenhum check-in registrado.</p>
              ) : (
                <ul className="space-y-2">
                  {checkins.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-3 text-sm">
                      <span className="flex-1">{c.tipo}</span>
                      <span className="text-xs text-[#8b949e]">{fmt(c.criado_em)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "ocorrencias" && (
            <div>
              {ocorrencias.length === 0 ? (
                <p className="text-xs text-[#8b949e]">Nenhuma ocorrência registrada.</p>
              ) : (
                <ul className="space-y-2">
                  {ocorrencias.map((o) => (
                    <li key={o.id} className="rounded-xl border border-[#30363d] bg-[#161b22] p-3">
                      <p className="text-xs text-[#8b949e] mb-1">{fmt(o.criado_em)}</p>
                      <p className="text-sm">{o.descricao}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
