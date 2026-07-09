"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, StickyNote, Bot, User, Send } from "lucide-react";
import { CrmButton } from "@/components/crm/CrmButton";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/**
 * Timeline UNIVERSAL de qualquer ficha (lead/pessoa/empresa/negocio/fornecedor/especialista/obra):
 * mostra o histórico (logs automáticos + notas) e permite registrar uma NOTA manual — o "em cada
 * cadastro ter logs e registros manuais" que o dono pediu. Reaproveita GET/POST /api/crm/registros
 * e o CrmButton base; estilizado com os tokens --obra-*.
 */

export type EntidadeTimelineTipo =
  | "lead"
  | "pessoa"
  | "empresa"
  | "negocio"
  | "fornecedor"
  | "especialista"
  | "obra";

type Registro = {
  id: string;
  tipo: string | null;
  descricao: string | null;
  feito_por: string | null;
  feito_por_tipo: string | null;
  metadata: Record<string, unknown> | null;
  criado_em: string | null;
};

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
  return tipo
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

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
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const vivo = useRef(true);

  const carregar = useCallback(async () => {
    if (!entityId) return;
    try {
      const res = await fetch(
        `/api/crm/registros?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`,
        { credentials: "include", headers: internalApiHeaders() }
      );
      const j = (await res.json().catch(() => ({}))) as { data?: Registro[]; error?: string };
      if (!vivo.current) return;
      if (!res.ok) {
        setErro(j.error || "Não foi possível carregar o histórico.");
        return;
      }
      setErro("");
      setRegistros(Array.isArray(j.data) ? j.data : []);
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
    return () => {
      vivo.current = false;
    };
  }, [carregar]);

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
      if (!res.ok || !j.ok) {
        setErro(j.error || "Não foi possível registrar a nota.");
        return;
      }
      setNota("");
      await carregar();
    } catch {
      setErro("Erro de rede ao registrar a nota.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-xl border border-obra-borda bg-obra-dark-2 p-4">
      <div className="mb-3 flex items-center gap-2">
        <History size={16} className="text-obra-dourado" aria-hidden />
        <h3 className="m-0 text-sm font-semibold text-obra-texto">{titulo}</h3>
        {!carregando && (
          <span className="ml-auto text-xs text-obra-texto-3">{registros.length}</span>
        )}
      </div>

      {podeRegistrar && (
        <div className="mb-4">
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void registrarNota();
            }}
            rows={2}
            placeholder="Escreva uma nota (Ctrl+Enter para salvar)…"
            className="w-full resize-y rounded-lg border border-obra-borda bg-obra-dark px-3 py-2 text-sm text-obra-texto outline-none placeholder:text-obra-texto-3 focus:border-obra-dourado"
          />
          <div className="mt-2 flex justify-end">
            <CrmButton
              size="sm"
              loading={salvando}
              disabled={!nota.trim()}
              onClick={() => void registrarNota()}
              leftIcon={<Send size={14} />}
            >
              Registrar nota
            </CrmButton>
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="mb-3 rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-xs font-semibold text-[#ff7b72]">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="py-4 text-center text-xs text-obra-texto-3">Carregando histórico…</p>
      ) : registros.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <StickyNote size={22} className="text-obra-texto-3" aria-hidden />
          <p className="m-0 text-xs text-obra-texto-2">Ainda sem registros nesta ficha.</p>
          {podeRegistrar && <p className="m-0 text-[11px] text-obra-texto-3">Escreva a primeira nota acima.</p>}
        </div>
      ) : (
        <ol className="m-0 list-none space-y-0 p-0">
          {registros.map((r, i) => {
            const daIa = r.feito_por_tipo === "ia" || r.feito_por_tipo === "sistema";
            return (
              <li key={r.id} className="relative flex gap-3 pb-3 pl-1">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      daIa ? "bg-obra-dourado/15 text-obra-dourado" : "bg-obra-dark text-obra-texto-2"
                    }`}
                  >
                    {daIa ? <Bot size={13} aria-hidden /> : <User size={13} aria-hidden />}
                  </span>
                  {i < registros.length - 1 && <span className="mt-1 w-px flex-1 bg-obra-borda" aria-hidden />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-obra-texto-3">
                      {rotuloTipo(r.tipo)}
                    </span>
                    <span className="text-[11px] text-obra-texto-3">{tempoRelativo(r.criado_em)}</span>
                  </div>
                  {r.descricao && <p className="m-0 mt-0.5 whitespace-pre-wrap text-sm text-obra-texto">{r.descricao}</p>}
                  {r.feito_por && (
                    <p className="m-0 mt-0.5 text-[11px] text-obra-texto-3">por {r.feito_por}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
