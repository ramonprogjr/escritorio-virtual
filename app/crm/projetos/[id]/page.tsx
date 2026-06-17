"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, HardHat, ExternalLink } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Projeto = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: string;
  negocio_id: string | null;
  obra_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

type Obra = { id: string; codigo: string | null; titulo: string; status: string };

const STATUS_OPTS = [
  { value: "briefing", label: "Briefing" },
  { value: "desenvolvimento", label: "Desenvolvimento" },
  { value: "aprovacao_cliente", label: "Aprovação Cliente" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

const STATUS_COLOR: Record<string, string> = {
  briefing: "#60a5fa",
  desenvolvimento: "#f59e0b",
  aprovacao_cliente: "#a78bfa",
  concluido: "#3fb950",
  cancelado: "#8b949e",
};

export default function ProjetoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ titulo: "", status: "briefing" });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const [resProjeto, resObras] = await Promise.all([
        fetch(`/api/crm/projetos/${id}`, { headers: internalApiHeaders() }),
        fetch(`/api/crm/obras?projeto_id=${id}`, { headers: internalApiHeaders() }),
      ]);
      const jsonP = (await resProjeto.json()) as { data?: Projeto; error?: string };
      if (!resProjeto.ok) { setErro(jsonP.error || "Projeto não encontrado."); return; }
      const jsonO = (await resObras.json()) as { data?: Obra[] };
      setProjeto(jsonP.data ?? null);
      setObras(jsonO.data ?? []);
      if (jsonP.data) {
        setForm({ titulo: jsonP.data.titulo, status: jsonP.data.status });
      }
    } catch { setErro("Erro de rede."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar() {
    if (!form.titulo.trim()) { setErroSalvar("Título obrigatório."); return; }
    setSalvando(true);
    setErroSalvar("");
    const res = await fetch(`/api/crm/projetos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ titulo: form.titulo.trim(), status: form.status }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: Projeto; error?: string };
    if (!res.ok) { setErroSalvar(json.error || "Erro ao salvar."); setSalvando(false); return; }
    if (json.data) setProjeto(json.data);
    setEditando(false);
    setSalvando(false);
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#0d1117] p-6">
        <div className="h-6 w-32 animate-pulse rounded bg-[#21262d] mb-6" />
        <div className="h-10 w-64 animate-pulse rounded bg-[#161b22]" />
      </div>
    );
  }

  if (erro || !projeto) {
    return (
      <div className="min-h-full bg-[#0d1117] p-6">
        <button type="button" onClick={() => router.push("/crm/projetos")} className="mb-4 inline-flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3]">
          <ArrowLeft size={14} /> Projetos
        </button>
        <p className="text-sm text-[#f87171]">{erro || "Projeto não encontrado."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#0d1117]" style={{ color: "#e6edf3" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#30363d] bg-[#0d1117]/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3 mb-1">
          <button
            type="button"
            onClick={() => router.push("/crm/projetos")}
            className="inline-flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          >
            <ArrowLeft size={14} /> Projetos
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold truncate">{projeto.titulo}</h1>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ color: STATUS_COLOR[projeto.status] ?? "#8b949e", background: `${STATUS_COLOR[projeto.status] ?? "#8b949e"}20` }}
              >
                {STATUS_OPTS.find((s) => s.value === projeto.status)?.label ?? projeto.status}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-xs text-[#8b949e]">{projeto.codigo}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditando(!editando)}
            className="shrink-0 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#30363d] px-3 text-xs text-[#8b949e] hover:text-[#e6edf3] hover:border-[#444c56] transition-colors"
          >
            {editando ? "Cancelar" : "Editar"}
          </button>
        </div>
      </div>

      <div className="p-6 max-w-4xl space-y-6">
        {/* Formulário de edição */}
        {editando && (
          <div className="rounded-xl border border-[#c9a24a]/30 bg-[#161b22] p-5">
            <h2 className="mb-4 text-sm font-bold text-[#c9a24a]">Editar projeto</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-[#8b949e]">Título *</label>
                <input
                  value={form.titulo}
                  onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                  className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none"
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

        {/* Info */}
        <div className="grid gap-3 sm:grid-cols-2">
          {projeto.negocio_id && (
            <Link
              href={`/crm/negocios/${projeto.negocio_id}`}
              className="flex items-center gap-2 rounded-xl border border-[#30363d] bg-[#161b22] p-4 hover:border-[#444c56] transition-colors no-underline"
            >
              <ExternalLink size={16} className="shrink-0 text-[#60a5fa]" />
              <div>
                <p className="text-xs text-[#8b949e]">Negócio vinculado</p>
                <p className="text-sm font-semibold text-[#60a5fa]">Ver negócio</p>
              </div>
            </Link>
          )}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-xs text-[#8b949e]">Criado em</p>
            <p className="text-sm font-semibold">{new Date(projeto.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>
        </div>

        {/* Obras vinculadas */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Obras vinculadas</h2>
            <Link
              href={`/crm/obras?projeto_id=${projeto.id}`}
              className="text-xs text-[#c9a24a] hover:underline"
            >
              + Nova obra
            </Link>
          </div>
          {obras.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#30363d] p-6 text-center">
              <HardHat size={24} className="mx-auto mb-2 text-[#30363d]" />
              <p className="text-xs text-[#8b949e]">Nenhuma obra vinculada a este projeto ainda.</p>
              <Link href="/crm/obras" className="mt-2 inline-block text-xs text-[#c9a24a] hover:underline">
                Ir para Obras
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {obras.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/crm/obras/${o.id}`}
                    className="flex items-center gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-3 hover:border-[#444c56] transition-colors no-underline"
                  >
                    <HardHat size={16} className="shrink-0 text-[#c9a24a]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#e6edf3] truncate">{o.titulo}</p>
                      <p className="text-xs text-[#8b949e]">{o.codigo} · {o.status}</p>
                    </div>
                    <ExternalLink size={14} className="shrink-0 text-[#8b949e]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
