"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Notificacao = {
  id: string;
  tipo: "info" | "sucesso" | "alerta";
  titulo: string;
  descricao: string;
  href: string | null;
  acionavel: boolean;
  ts: string;
};

const LAST_SEEN_KEY = "crm_notif_last_seen";

function tempoRelativo(ts: string): string {
  const d = Date.parse(ts);
  if (Number.isNaN(d)) return "";
  const seg = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (seg < 60) return "agora";
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

const corPonto = (tipo: string) =>
  tipo === "alerta" ? "#f0a23a" : tipo === "sucesso" ? "#3fb950" : "#c9a24a";

/**
 * Sino de notificações do Hub (C.2) — lê /api/crm/notificacoes (derivado de hub_eventos).
 * Não-lidas = eventos mais recentes que o último "marcar como lidas" (localStorage). v1 Hub;
 * per-fornecedor + canais (WhatsApp/email/push) são próximos incrementos.
 */
export function NotificacoesSino() {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [lastSeen, setLastSeen] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/notificacoes", {
        headers: internalApiHeaders(),
        credentials: "include",
      });
      if (!res.ok) return;
      const j = (await res.json()) as { notificacoes?: Notificacao[] };
      setItens(j.notificacoes ?? []);
    } catch {
      /* best-effort: sino nunca quebra o header */
    }
  }, []);

  useEffect(() => {
    setLastSeen(localStorage.getItem(LAST_SEEN_KEY) ?? "");
    void carregar();
    const t = setInterval(() => void carregar(), 30000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    if (!aberto) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [aberto]);

  const naoLidas = itens.filter((n) => !lastSeen || n.ts > lastSeen).length;

  function marcarLidas() {
    const agora = new Date().toISOString();
    localStorage.setItem(LAST_SEEN_KEY, agora);
    setLastSeen(agora);
  }

  function irPara(n: Notificacao) {
    setAberto(false);
    if (n.href) router.push(n.href);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Notificações${naoLidas ? ` (${naoLidas} não lidas)` : ""}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#c9a24a35] bg-[#c9a24a10] text-[#c9a24a] transition-colors hover:bg-[#c9a24a20] cursor-pointer"
      >
        <Bell size={16} />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#e5484d] px-1 text-[10px] font-bold text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-11 z-50 max-h-[440px] w-[340px] overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#21262d] px-4 py-3">
            <span className="text-sm font-bold text-[#e6edf3]">Notificações</span>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={marcarLidas}
                className="cursor-pointer text-[11px] font-semibold text-[#c9a24a] hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-[388px] overflow-y-auto">
            {itens.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-[#8b949e]">Sem notificações ainda.</p>
            ) : (
              itens.map((n) => {
                const novo = !lastSeen || n.ts > lastSeen;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => irPara(n)}
                    className={`flex w-full items-start gap-3 border-b border-[#161b22] px-4 py-3 text-left transition-colors hover:bg-[#161b22] cursor-pointer ${novo ? "bg-[#c9a24a0a]" : ""}`}
                  >
                    <span
                      className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: corPonto(n.tipo) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#e6edf3]">{n.titulo}</span>
                        {n.acionavel && (
                          <span className="rounded bg-[#f0a23a20] px-1 text-[9px] font-bold uppercase tracking-wide text-[#f0a23a]">
                            ação
                          </span>
                        )}
                      </span>
                      {n.descricao && (
                        <span className="mt-0.5 block truncate text-[12px] text-[#8b949e]">{n.descricao}</span>
                      )}
                      <span className="mt-0.5 block text-[10px] text-[#6e7681]">{tempoRelativo(n.ts)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
