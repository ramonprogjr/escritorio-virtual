"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, CheckCircle2, Circle, Clock, AlertCircle, Trash2, X } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: "aberta" | "concluida" | "cancelada";
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  vencimento_em: string | null;
  lead_id: string | null;
  negocio_id: string | null;
  concluida_em: string | null;
};

type Filtro = "todas" | "aberta" | "concluida" | "vencidas";

const PRIORIDADE_COLOR: Record<string, string> = {
  baixa: "#8b949e",
  normal: "#60a5fa",
  alta: "#f59e0b",
  urgente: "#ef4444",
};

const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

function isVencida(t: Tarefa) {
  if (t.status !== "aberta" || !t.vencimento_em) return false;
  return new Date(t.vencimento_em) < new Date();
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const EMPTY_FORM = {
  titulo: "",
  descricao: "",
  prioridade: "normal" as Tarefa["prioridade"],
  vencimento_em: "",
  lead_id: "",
  negocio_id: "",
};

export default function TarefasComerciaisPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/tarefas", { headers: internalApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as { data?: Tarefa[]; error?: string };
      if (!res.ok) { setErro(json.error || "Erro ao carregar."); setTarefas([]); return; }
      setTarefas(json.data ?? []);
    } catch { setErro("Erro de rede."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const tarefasFiltradas = tarefas.filter((t) => {
    if (filtro === "aberta") return t.status === "aberta" && !isVencida(t);
    if (filtro === "concluida") return t.status === "concluida";
    if (filtro === "vencidas") return isVencida(t);
    return true;
  });

  const counts = {
    todas: tarefas.length,
    aberta: tarefas.filter((t) => t.status === "aberta" && !isVencida(t)).length,
    vencidas: tarefas.filter(isVencida).length,
    concluida: tarefas.filter((t) => t.status === "concluida").length,
  };

  async function toggleConcluir(t: Tarefa) {
    const novoStatus = t.status === "concluida" ? "aberta" : "concluida";
    await fetch(`/api/crm/tarefas/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ status: novoStatus }),
    });
    setTarefas((prev) => prev.map((x) => x.id === t.id ? { ...x, status: novoStatus } : x));
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta tarefa?")) return;
    await fetch(`/api/crm/tarefas/${id}`, { method: "DELETE", headers: internalApiHeaders() });
    setTarefas((prev) => prev.filter((t) => t.id !== id));
  }

  async function salvar() {
    if (!form.titulo.trim()) { setErroSalvar("Título obrigatório."); return; }
    setSalvando(true);
    setErroSalvar("");
    const body = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      prioridade: form.prioridade,
      vencimento_em: form.vencimento_em || null,
      lead_id: form.lead_id.trim() || null,
      negocio_id: form.negocio_id.trim() || null,
    };
    const res = await fetch("/api/crm/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: Tarefa; error?: string };
    if (!res.ok) { setErroSalvar(json.error || "Erro ao salvar."); setSalvando(false); return; }
    if (json.data) setTarefas((prev) => [json.data!, ...prev]);
    setModal(false);
    setForm(EMPTY_FORM);
    setSalvando(false);
  }

  const FILTROS: { id: Filtro; label: string }[] = [
    { id: "todas", label: `Todas (${counts.todas})` },
    { id: "aberta", label: `Abertas (${counts.aberta})` },
    { id: "vencidas", label: `Vencidas (${counts.vencidas})` },
    { id: "concluida", label: `Concluídas (${counts.concluida})` },
  ];

  return (
    <div className="min-h-full bg-[#0d1117]" style={{ color: "#e6edf3" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#30363d] bg-[#0d1117]/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Tarefas comerciais</h1>
            <p className="text-xs text-[#8b949e]">Próximas ações vinculadas a leads e negócios</p>
          </div>
          <button
            type="button"
            onClick={() => { setModal(true); setErroSalvar(""); }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#c9a24a] px-4 text-xs font-bold text-[#003b26] hover:bg-[#b8912f] transition-colors"
          >
            <Plus size={14} />
            Nova tarefa
          </button>
        </div>

        {/* Filtros */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filtro === f.id
                  ? "bg-[#c9a24a] text-[#003b26]"
                  : "bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="p-6" style={{ maxWidth: 800 }}>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-xl bg-[#161b22]" />
            ))}
          </div>
        ) : erro ? (
          <div className="rounded-xl border border-[#f87171]/30 bg-[#f87171]/10 p-4 text-sm text-[#f87171]">
            {erro} —{" "}
            <button type="button" onClick={() => void carregar()} className="underline">
              tentar novamente
            </button>
          </div>
        ) : tarefasFiltradas.length === 0 ? (
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-10 text-center text-sm text-[#8b949e]">
            {filtro === "todas"
              ? "Nenhuma tarefa ainda. Crie a primeira clicando em \"Nova tarefa\"."
              : "Nenhuma tarefa neste filtro."}
          </div>
        ) : (
          <ul className="space-y-2">
            {tarefasFiltradas.map((t) => {
              const vencida = isVencida(t);
              const concluida = t.status === "concluida";
              return (
                <li
                  key={t.id}
                  className="group flex items-start gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-4 hover:border-[#444c56] transition-colors"
                >
                  {/* Toggle conclusão */}
                  <button
                    type="button"
                    onClick={() => void toggleConcluir(t)}
                    className="mt-0.5 shrink-0 text-[#8b949e] hover:text-[#c9a24a] transition-colors"
                    title={concluida ? "Reabrir" : "Concluir"}
                  >
                    {concluida ? (
                      <CheckCircle2 size={20} className="text-[#3fb950]" />
                    ) : vencida ? (
                      <AlertCircle size={20} className="text-[#ef4444]" />
                    ) : (
                      <Circle size={20} />
                    )}
                  </button>

                  {/* Conteúdo */}
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold leading-tight ${concluida ? "line-through text-[#8b949e]" : ""}`}>
                      {t.titulo}
                    </p>
                    {t.descricao && (
                      <p className="mt-1 text-xs text-[#8b949e] line-clamp-2">{t.descricao}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      {/* Prioridade */}
                      <span style={{ color: PRIORIDADE_COLOR[t.prioridade] }} className="font-medium">
                        {PRIORIDADE_LABEL[t.prioridade]}
                      </span>
                      {/* Vencimento */}
                      {t.vencimento_em && (
                        <span className={`inline-flex items-center gap-1 ${vencida ? "text-[#ef4444]" : "text-[#8b949e]"}`}>
                          <Clock size={11} />
                          {formatDate(t.vencimento_em)}
                          {vencida && " · Vencida"}
                        </span>
                      )}
                      {/* Links */}
                      {t.lead_id && (
                        <Link href={`/crm/leads/${t.lead_id}`} className="text-[#60a5fa] hover:underline">
                          Lead
                        </Link>
                      )}
                      {t.negocio_id && (
                        <Link href={`/crm/negocios/${t.negocio_id}`} className="text-[#c9a24a] hover:underline">
                          Negócio
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Excluir */}
                  <button
                    type="button"
                    onClick={() => void excluir(t.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-[#8b949e] hover:text-[#ef4444] transition-all"
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal nova tarefa */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#30363d] bg-[#161b22] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold">Nova tarefa</h2>
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
                  placeholder="Ex: Enviar proposta para cliente"
                  className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                  placeholder="Detalhes da tarefa…"
                  rows={2}
                  className="w-full rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[#8b949e]">Prioridade</label>
                  <select
                    value={form.prioridade}
                    onChange={(e) => setForm((p) => ({ ...p, prioridade: e.target.value as Tarefa["prioridade"] }))}
                    className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#8b949e]">Vencimento</label>
                  <input
                    type="date"
                    value={form.vencimento_em}
                    onChange={(e) => setForm((p) => ({ ...p, vencimento_em: e.target.value }))}
                    className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[#8b949e]">ID do Lead</label>
                  <input
                    value={form.lead_id}
                    onChange={(e) => setForm((p) => ({ ...p, lead_id: e.target.value }))}
                    placeholder="UUID do lead"
                    className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#8b949e]">ID do Negócio</label>
                  <input
                    value={form.negocio_id}
                    onChange={(e) => setForm((p) => ({ ...p, negocio_id: e.target.value }))}
                    placeholder="UUID do negócio"
                    className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none"
                  />
                </div>
              </div>
            </div>

            {erroSalvar && (
              <p className="mt-3 text-xs text-[#f87171]">{erroSalvar}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="flex-1 min-h-10 rounded-lg bg-[#21262d] text-xs text-[#8b949e] hover:text-[#e6edf3]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void salvar()}
                className="flex-1 min-h-10 rounded-lg bg-[#c9a24a] text-xs font-bold text-[#003b26] hover:bg-[#b8912f] disabled:opacity-60"
              >
                {salvando ? "Salvando…" : "Criar tarefa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
