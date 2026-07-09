"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/**
 * F1 — VERDADE VISÍVEL. Farol read-only do estado REAL do agente (GET .../estado-runtime).
 * Mostra, por tipo, se o agente está ativo, se o fluxo está publicado e — o mais importante —
 * se ele REALMENTE roda no WhatsApp (roteamento). Fail-open: se o endpoint falhar, mostra
 * "estado indisponível" e NUNCA bloqueia a edição da ficha.
 */

type Estado = "ok" | "alerta" | "pendente" | "off";
type Luz = { chave: string; label: string; estado: Estado; detalhe: string };
type EstadoRuntime = {
  tipo: "atendimento" | "interno";
  resumo: { estado: Estado; mensagem: string };
  luzes: Luz[];
};

const COR: Record<Estado, string> = {
  ok: "#10b981",
  alerta: "#f59e0b",
  pendente: "#8b949e",
  off: "#f85149",
};

function IconeLuz({ estado }: { estado: Estado }) {
  const cor = COR[estado];
  if (estado === "ok") return <CheckCircle2 size={16} style={{ color: cor }} aria-hidden />;
  if (estado === "alerta") return <AlertTriangle size={16} style={{ color: cor }} aria-hidden />;
  if (estado === "off") return <XCircle size={16} style={{ color: cor }} aria-hidden />;
  return <CircleDashed size={16} style={{ color: cor }} aria-hidden />;
}

export function AgenteEstadoVivoCard({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<EstadoRuntime | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    setCarregando(true);
    (async () => {
      try {
        const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}/estado-runtime`, {
          credentials: "include",
          headers: internalApiHeaders(),
        });
        const j = (await res.json().catch(() => ({}))) as EstadoRuntime & { error?: string };
        if (!vivo.current) return;
        if (!res.ok || !Array.isArray(j.luzes)) {
          setIndisponivel(true);
          return;
        }
        setEstado(j);
      } catch {
        if (vivo.current) setIndisponivel(true);
      } finally {
        if (vivo.current) setCarregando(false);
      }
    })();
    return () => {
      vivo.current = false;
    };
  }, [slug]);

  // Fail-open: nunca bloqueia — mostra um aviso discreto e some.
  if (indisponivel) {
    return (
      <div className="rounded-xl border border-obra-borda bg-obra-dark-2 px-4 py-2.5 text-xs text-obra-texto-3">
        Estado do agente indisponível no momento — a edição continua normal.
      </div>
    );
  }

  const alerta = estado?.luzes.find((l) => l.estado === "alerta" || l.estado === "off");

  return (
    <section className="rounded-xl border border-obra-borda bg-obra-dark-2 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity size={16} className="text-obra-dourado" aria-hidden />
        <h3 className="m-0 text-sm font-semibold text-obra-texto">Estado do agente</h3>
        {estado && (
          <span
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: `${COR[estado.resumo.estado]}1a`, color: COR[estado.resumo.estado] }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COR[estado.resumo.estado] }} />
            {estado.resumo.estado === "ok" ? "Pronto" : estado.resumo.estado === "alerta" ? "Atenção" : "Pendente"}
          </span>
        )}
      </div>

      {carregando && !estado ? (
        <p className="py-2 text-center text-xs text-obra-texto-3">Verificando estado…</p>
      ) : (
        <>
          {/* Banner honesto quando o fluxo publicado NÃO roda no WhatsApp (o buraco silencioso) */}
          {alerta && alerta.chave === "roteamento" && (
            <div
              className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: `${COR[alerta.estado]}14`, border: `1px solid ${COR[alerta.estado]}59` }}
            >
              <AlertTriangle size={15} style={{ color: COR[alerta.estado], flexShrink: 0, marginTop: 1 }} aria-hidden />
              <span className="text-obra-texto">{alerta.detalhe}</span>
            </div>
          )}

          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {estado?.luzes.map((l) => (
              <li key={l.chave} className="flex items-start gap-2.5">
                <span className="mt-0.5">
                  <IconeLuz estado={l.estado} />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-sm font-medium text-obra-texto">{l.label}</p>
                  <p className="m-0 text-[11px] text-obra-texto-2">{l.detalhe}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
