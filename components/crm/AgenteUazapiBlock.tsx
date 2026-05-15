"use client";

import type { CSSProperties } from "react";
import { useCallback, useState } from "react";
import {
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  Unplug,
} from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

export type AgenteUazapiSnapshot = {
  uazapi_instance_id?: string | null;
  uazapi_instance_name?: string | null;
  uazapi_connection_status?: string | null;
  uazapi_has_instance_token?: boolean;
};

export type AgenteUazapiBlockProps = {
  agenteSlug: string;
  snapshot: AgenteUazapiSnapshot;
  onRefresh: () => Promise<void> | void;
};

function badgeCor(status?: string | null): { bg: string; fg: string } {
  const s = (status || "").toLowerCase();
  if (s === "connected") return { bg: "#23863633", fg: "#3fb950" };
  if (s === "connecting") return { bg: "#bb800926", fg: "#e6c06a" };
  return { bg: "#30363d", fg: "#8b949e" };
}

export function AgenteUazapiBlock({ agenteSlug, snapshot, onRefresh }: AgenteUazapiBlockProps) {
  const [phonePair, setPhonePair] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [paircode, setPaircode] = useState<string | null>(null);

  const status = snapshot.uazapi_connection_status || "—";
  const temInstancia = Boolean(snapshot.uazapi_instance_id?.trim());
  const badge = badgeCor(snapshot.uazapi_connection_status);

  const postAction = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      setErr("");
      setLoading(action);
      try {
        const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/uazapi`, {
          method: "POST",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          setErr(typeof data.error === "string" ? data.error : `Erro HTTP ${res.status}`);
          return data;
        }
        if (typeof data.qrcode === "string") setQrcode(data.qrcode);
        else if (action === "status" || action === "connect") setQrcode(null);
        if (typeof data.paircode === "string") setPaircode(data.paircode);
        else setPaircode(null);
        await onRefresh();
        return data;
      } catch {
        setErr("Falha de rede ao falar com o servidor.");
        return null;
      } finally {
        setLoading(null);
      }
    },
    [agenteSlug, onRefresh]
  );

  const btn = (disabled: boolean) =>
    ({
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      border: "1px solid #30363d",
      background: disabled ? "#161b22" : "#21262d",
      color: disabled ? "#484f58" : "#e6edf3",
    }) as CSSProperties;

  return (
    <div
      style={{
        marginBottom: 18,
        padding: 14,
        borderRadius: 12,
        border: "1px solid #30363d",
        background: "#0d1117",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <MessageCircle size={18} style={{ color: "#25d366" }} aria-hidden />
        <p style={{ margin: 0, color: "#8b949e", fontSize: 11, fontWeight: 800, letterSpacing: 0.06 }}>
          WHATSAPP (UAZAPI) — LINHA DESTE AGENTE
        </p>
      </div>

      <p style={{ color: "#6e7781", fontSize: 12, lineHeight: 1.55, margin: "0 0 12px" }}>
        Só mensagens da instância <strong style={{ color: "#aebccf" }}>ligada e «connected»</strong> no Hub disparam a IA
        neste número. Configure o webhook global na UAZAPI para o endpoint{" "}
        <code style={{ fontSize: 11, color: "#79c0ff" }}>/api/whatsapp/webhook</code>.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            background: badge.bg,
            color: badge.fg,
          }}
        >
          {String(status).toUpperCase()}
        </span>
        {temInstancia ? (
          <span style={{ color: "#8b949e", fontSize: 11 }}>
            ID: <code style={{ color: "#aebccf", fontSize: 11 }}>{snapshot.uazapi_instance_id}</code>
          </span>
        ) : (
          <span style={{ color: "#8b949e", fontSize: 11 }}>Sem instância criada</span>
        )}
      </div>

      {err ? (
        <p style={{ color: "#f85149", fontSize: 12, margin: "0 0 10px", lineHeight: 1.45 }}>{err}</p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          disabled={loading !== null || temInstancia}
          style={btn(loading !== null || temInstancia)}
          onClick={() => postAction("create")}
        >
          {loading === "create" ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
          Criar instância
        </button>

        <button
          type="button"
          disabled={loading !== null || !temInstancia}
          style={btn(loading !== null || !temInstancia)}
          onClick={() => postAction("connect", phonePair.trim().length >= 10 ? { phone: phonePair } : {})}
        >
          {loading === "connect" ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
          Pedir QR / pareamento
        </button>

        <button
          type="button"
          disabled={loading !== null || !temInstancia}
          style={btn(loading !== null || !temInstancia)}
          onClick={() => postAction("status")}
        >
          {loading === "status" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Actualizar estado
        </button>

        <button
          type="button"
          disabled={loading !== null || !temInstancia}
          style={btn(loading !== null || !temInstancia)}
          onClick={() => postAction("disconnect")}
        >
          {loading === "disconnect" ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />}
          Desligar sessão
        </button>

        <button
          type="button"
          disabled={loading !== null || !temInstancia}
          style={{
            ...btn(loading !== null || !temInstancia),
            borderColor: "#f8514966",
            color: loading !== null || !temInstancia ? "#484f58" : "#f85149",
          }}
          onClick={() => {
            if (
              typeof window !== "undefined" &&
              !window.confirm("Eliminar instância na UAZAPI e limpar ligação no Hub?")
            )
              return;
            postAction("delete_remote");
          }}
        >
          {loading === "delete_remote" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Eliminar na UAZAPI
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", color: "#8b949e", fontSize: 11, marginBottom: 6 }}>
          Telefone para código de pareamento (opcional, ex. 5511999999999)
        </label>
        <input
          value={phonePair}
          onChange={(e) => setPhonePair(e.target.value)}
          placeholder="Deixe vazio só para QR"
          style={{
            width: "100%",
            maxWidth: 280,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #30363d",
            background: "#161b22",
            color: "#e6edf3",
            fontSize: 13,
          }}
        />
      </div>

      {paircode ? (
        <p style={{ color: "#e6c06a", fontSize: 13, fontWeight: 700, margin: "8px 0" }}>
          Código: {paircode}
        </p>
      ) : null}

      {qrcode?.startsWith("data:image") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="QR WhatsApp" src={qrcode} style={{ maxWidth: 220, borderRadius: 8, border: "1px solid #30363d" }} />
      ) : null}

      <p style={{ color: "#484f58", fontSize: 10, margin: "12px 0 0", lineHeight: 1.45 }}>
        Requer <code style={{ fontSize: 10 }}>UAZAPI_BASE_URL</code> e{" "}
        <code style={{ fontSize: 10 }}>UAZAPI_ADMIN_TOKEN</code> no servidor para criar instâncias.
      </p>
    </div>
  );
}
