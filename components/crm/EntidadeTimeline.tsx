"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, StickyNote, Bot, User, Send, Pencil, Archive, ScrollText, X, Check } from "lucide-react";
import { CrmButton } from "@/components/crm/CrmButton";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/**
 * Timeline UNIVERSAL de qualquer ficha. Mostra COMENTÁRIOS + ATIVIDADES PRINCIPAIS (logs ficam OCULTOS,
 * pela API). Permite nota manual, editar/arquivar conforme permissão (autor/owner — calculada no servidor)
 * e, só para o owner, extrair os LOGS em relatório. Spec do dono (registros × logs × permissões).
 */

export type EntidadeTimelineTipo =
  | "lead" | "pessoa" | "empresa" | "negocio" | "fornecedor" | "especialista" | "obra";

type Categoria = "comentario" | "atividade_principal" | "log";

type Registro = {
  id: string;
  tipo: string | null;
  descricao: string | null;
  feito_por_tipo: string | null;
  categoria: Categoria;
  autor_nome: string;
  editado_em: string | null;
  criado_em: string | null;
  pode_editar: boolean;
  pode_arquivar: boolean;
};

type LinhaLog = { quando: string | null; fonte: string; quem: string; o_que: string; detalhe: string | null };

function tempoRelativo(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} d`;
  return new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function rotuloTipo(tipo: string | null): string {
  if (!tipo) return "Registro";
  return tipo.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Mensagem para o dono não-técnico: nunca mostra código de sistema cru ("erro_interno", erro do Postgres). */
function mensagemUsuario(raw: string | undefined, fallback: string): string {
  const r = String(raw ?? "").trim();
  if (!r || r === "erro_interno") return fallback;
  if (/relation|column|syntax|violates|null value|permission denied|jwt|duplicate key/i.test(r)) return fallback;
  return r;
}

const FILTROS: { id: "tudo" | Categoria; label: string }[] = [
  { id: "tudo", label: "Tudo" },
  { id: "comentario", label: "Comentários" },
  { id: "atividade_principal", label: "Atividades" },
];

export function EntidadeTimeline({
  entityType,
  entityId,
  titulo = "Histórico e notas",
  podeRegistrar = true,
}: {
  entityType: EntidadeTimelineTipo;
  entityId: string;
  titulo?: string;
  podeRegistrar?: boolean;
}) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState<"tudo" | Categoria>("tudo");
  const [truncado, setTruncado] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [arquivandoId, setArquivandoId] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<LinhaLog[] | null>(null);
  const [logsErro, setLogsErro] = useState("");
  const [logsParcial, setLogsParcial] = useState(false);
  const vivo = useRef(true);

  const carregar = useCallback(async () => {
    if (!entityId) return;
    try {
      const res = await fetch(
        `/api/crm/registros?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`,
        { credentials: "include", headers: internalApiHeaders() }
      );
      const j = (await res.json().catch(() => ({}))) as { data?: Registro[]; is_owner?: boolean; error?: string; truncado?: boolean };
      if (!vivo.current) return;
      if (!res.ok) {
        setErro(mensagemUsuario(j.error, "Não foi possível carregar o histórico."));
        return;
      }
      setErro("");
      setRegistros(Array.isArray(j.data) ? j.data : []);
      setIsOwner(j.is_owner === true);
      setTruncado(j.truncado === true);
    } catch {
      if (vivo.current) setErro("Erro de rede ao carregar o histórico.");
    } finally {
      if (vivo.current) setCarregando(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    vivo.current = true;
    setCarregando(true);
    void carregar();
    return () => { vivo.current = false; };
  }, [carregar]);

  // Modal de logs: fecha por Escape (a11y — teclado).
  useEffect(() => {
    if (!logsOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLogsOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logsOpen]);

  async function registrarNota() {
    const texto = nota.trim();
    if (!texto || salvando) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/registros", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, descricao: texto }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) { setErro(mensagemUsuario(j.error, "Não foi possível registrar a nota.")); return; }
      setNota("");
      await carregar();
    } catch {
      setErro("Erro de rede ao registrar a nota.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao(id: string) {
    const texto = editTexto.trim();
    if (!texto || salvandoEdicao) return;
    setSalvandoEdicao(true);
    try {
      const res = await fetch("/api/crm/registros", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ id, descricao: texto }),
      });
      if (res.ok) { setEditandoId(null); setEditTexto(""); await carregar(); }
      else { const j = (await res.json().catch(() => ({}))) as { error?: string }; setErro(mensagemUsuario(j.error, "Não foi possível editar.")); }
    } catch {
      setErro("Erro de rede ao editar.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function arquivar(id: string) {
    if (arquivandoId) return;
    if (!window.confirm("Arquivar este registro? Ele sai do histórico (o Hub nunca apaga de verdade).")) return;
    setArquivandoId(id);
    try {
      const res = await fetch(`/api/crm/registros?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: internalApiHeaders(),
      });
      if (res.ok) await carregar();
      else { const j = (await res.json().catch(() => ({}))) as { error?: string }; setErro(mensagemUsuario(j.error, "Não foi possível arquivar.")); }
    } catch {
      setErro("Erro de rede ao arquivar.");
    } finally {
      setArquivandoId(null);
    }
  }

  async function abrirLogs() {
    setLogsOpen(true);
    setLogs(null);
    setLogsErro("");
    setLogsParcial(false);
    try {
      const res = await fetch(
        `/api/crm/relatorios/logs-ia?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`,
        { credentials: "include", headers: internalApiHeaders() }
      );
      const j = (await res.json().catch(() => ({}))) as { data?: LinhaLog[]; error?: string; parcial?: boolean };
      if (!res.ok) { setLogsErro(res.status === 403 ? "Apenas o owner pode ver os logs." : "Não foi possível carregar os logs."); return; }
      setLogs(Array.isArray(j.data) ? j.data : []);
      setLogsParcial(j.parcial === true);
    } catch {
      setLogsErro("Erro de rede ao carregar os logs.");
    }
  }

  const visiveis = filtro === "tudo" ? registros : registros.filter((r) => r.categoria === filtro);

  return (
    <section className="rounded-xl border border-obra-borda bg-obra-dark-2 p-4">
      <div className="mb-3 flex items-center gap-2">
        <History size={16} className="text-obra-dourado" aria-hidden />
        <h3 className="m-0 text-sm font-semibold text-obra-texto">{titulo}</h3>
        {isOwner && (
          <button
            type="button"
            onClick={() => void abrirLogs()}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-obra-borda px-2 py-0.5 text-[11px] text-obra-texto-2 hover:border-obra-dourado hover:text-obra-texto"
            title="Extrair os logs da IA (só owner)"
          >
            <ScrollText size={12} /> Logs
          </button>
        )}
      </div>

      {podeRegistrar && (
        <div className="mb-3">
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void registrarNota(); }}
            rows={2}
            placeholder="Escreva uma nota (Ctrl+Enter para salvar)…"
            className="w-full resize-y rounded-lg border border-obra-borda bg-obra-dark px-3 py-2 text-sm text-obra-texto outline-none placeholder:text-obra-texto-3 focus:border-obra-dourado"
          />
          <div className="mt-2 flex justify-end">
            <CrmButton size="sm" loading={salvando} disabled={!nota.trim()} onClick={() => void registrarNota()} leftIcon={<Send size={14} />}>
              Registrar nota
            </CrmButton>
          </div>
        </div>
      )}

      <div className="mb-3 flex gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              filtro === f.id ? "bg-obra-dourado/20 text-obra-dourado" : "text-obra-texto-3 hover:text-obra-texto-2"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erro && (
        <p role="alert" className="mb-3 rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-xs font-semibold text-[#ff7b72]">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="py-4 text-center text-xs text-obra-texto-3">Carregando histórico…</p>
      ) : visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <StickyNote size={22} className="text-obra-texto-3" aria-hidden />
          <p className="m-0 text-xs text-obra-texto-2">Nenhum registro nesta visão.</p>
        </div>
      ) : (
        <ol className="m-0 list-none space-y-0 p-0">
          {visiveis.map((r, i) => {
            const daIa = r.feito_por_tipo === "ia" || r.feito_por_tipo === "sistema";
            const editando = editandoId === r.id;
            return (
              <li key={r.id} className="group relative flex gap-3 pb-3 pl-1">
                <div className="flex flex-col items-center">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${daIa ? "bg-obra-dourado/15 text-obra-dourado" : "bg-obra-dark text-obra-texto-2"}`}>
                    {daIa ? <Bot size={13} aria-hidden /> : <User size={13} aria-hidden />}
                  </span>
                  {i < visiveis.length - 1 && <span className="mt-1 w-px flex-1 bg-obra-borda" aria-hidden />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-obra-texto-3">{rotuloTipo(r.tipo)}</span>
                    <span className="text-[11px] text-obra-texto-3">{tempoRelativo(r.criado_em)}</span>
                    {r.editado_em && <span className="text-[10px] text-obra-texto-3">· editado</span>}
                    {/* Ações: sempre visíveis em touch (mobile é o canal do dono); só-hover no desktop.
                        group-focus-within mantém acessível por teclado. Área de toque ampliada (p-2). */}
                    <span className="ml-auto flex gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      {r.pode_editar && !editando && (
                        <button type="button" onClick={() => { setEditandoId(r.id); setEditTexto(r.descricao ?? ""); }} title="Editar" aria-label="Editar registro" className="inline-flex items-center justify-center rounded-md p-2 text-obra-texto-3 hover:text-obra-dourado">
                          <Pencil size={14} />
                        </button>
                      )}
                      {r.pode_arquivar && !editando && (
                        <button type="button" onClick={() => void arquivar(r.id)} disabled={arquivandoId === r.id} title="Arquivar" aria-label="Arquivar registro" className="inline-flex items-center justify-center rounded-md p-2 text-obra-texto-3 hover:text-[#ff7b72] disabled:opacity-50">
                          <Archive size={14} />
                        </button>
                      )}
                    </span>
                  </div>
                  {editando ? (
                    <div className="mt-1">
                      <textarea
                        value={editTexto}
                        onChange={(e) => setEditTexto(e.target.value)}
                        rows={2}
                        className="w-full resize-y rounded-lg border border-obra-dourado bg-obra-dark px-2 py-1.5 text-sm text-obra-texto outline-none"
                      />
                      <div className="mt-1 flex gap-1.5">
                        <button type="button" onClick={() => void salvarEdicao(r.id)} disabled={!editTexto.trim() || salvandoEdicao} className="inline-flex items-center gap-1 rounded-md bg-obra-dourado/20 px-2 py-0.5 text-[11px] font-semibold text-obra-dourado disabled:opacity-50">
                          <Check size={12} /> {salvandoEdicao ? "Salvando…" : "Salvar"}
                        </button>
                        <button type="button" onClick={() => { setEditandoId(null); setEditTexto(""); }} disabled={salvandoEdicao} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-obra-texto-3 disabled:opacity-50">
                          <X size={12} /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    r.descricao && <p className="m-0 mt-0.5 whitespace-pre-wrap text-sm text-obra-texto">{r.descricao}</p>
                  )}
                  <p className="m-0 mt-0.5 text-[11px] text-obra-texto-3">por {r.autor_nome}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {truncado && !carregando && visiveis.length > 0 && (
        <p className="mt-1 text-center text-[11px] text-obra-texto-3">
          Mostrando os 100 registros mais recentes desta ficha.
        </p>
      )}

      {logsOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="logs-modal-titulo" onClick={() => setLogsOpen(false)} className="fixed inset-0 z-[240] flex items-start justify-center overflow-y-auto bg-black/70 p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl border border-obra-borda bg-obra-dark-2 p-5">
            <div className="mb-3 flex items-center gap-2">
              <ScrollText size={18} className="text-obra-dourado" aria-hidden />
              <h2 id="logs-modal-titulo" className="m-0 flex-1 text-base font-semibold text-obra-texto">Logs da IA — relatório</h2>
              <button type="button" onClick={() => setLogsOpen(false)} aria-label="Fechar" className="text-obra-texto-2 hover:text-obra-texto"><X size={18} /></button>
            </div>
            {logsParcial && !logsErro && (
              <p className="mb-3 rounded-lg border border-obra-dourado/40 bg-obra-dourado/10 px-3 py-2 text-[11px] font-semibold text-obra-dourado">
                Relatório parcial — uma das fontes não pôde ser lida agora. Tente de novo em instantes.
              </p>
            )}
            {logsErro ? (
              <p className="rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-xs font-semibold text-[#ff7b72]">{logsErro}</p>
            ) : logs === null ? (
              <p className="py-4 text-center text-xs text-obra-texto-3">Carregando logs…</p>
            ) : logs.length === 0 ? (
              <p className="py-4 text-center text-xs text-obra-texto-2">Sem logs para esta ficha.</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {logs.map((l, i) => (
                    <li key={i} className="rounded-lg border border-obra-borda bg-obra-dark p-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="rounded bg-obra-dourado/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-obra-dourado">{l.fonte}</span>
                        <span className="text-[11px] text-obra-texto-3">{tempoRelativo(l.quando)}</span>
                        <span className="ml-auto text-[11px] text-obra-texto-3">{l.quem}</span>
                      </div>
                      <p className="m-0 mt-1 text-xs font-medium text-obra-texto">{rotuloTipo(l.o_que)}</p>
                      {l.detalhe && <p className="m-0 mt-0.5 break-words text-[11px] text-obra-texto-2">{l.detalhe}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="m-0 mt-3 text-[10px] text-obra-texto-3">Esta extração fica registrada na trilha de auditoria (imutável).</p>
          </div>
        </div>
      )}
    </section>
  );
}
