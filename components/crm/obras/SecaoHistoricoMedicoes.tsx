"use client";

/**
 * AUT-3 — Seção "Medições do item" (histórico read-only, append-only).
 *
 * Consome GET /api/crm/obras/[id]/medicoes?item_id=<id>&limit=<n>&cursor=<cursor>
 * com paginação por cursor (AUT-4). Exibe cards: data · autor · qtd · pct · foto · obs.
 * Tolerante: sem migração E7c o endpoint retorna migracao_pendente=true e a seção
 * exibe um aviso honesto em vez de quebrar.
 *
 * Tokens Obra10+ dark (--obra-*). ARIA: lista de artigos, role="log" para o feed.
 * Mobile-first: cards em coluna única, foto em aspect-ratio 16/9.
 */

import { useCallback, useEffect, useState } from "react";
import { History, Camera, AlertTriangle, RefreshCw, ChevronDown } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";
const BG_DEEP = "#0a140f";
const DOURADO = "#c9a24a";
const TXT = "#e6edf3";
const TXT_DIM = "#8b949e";
const TXT_DIM2 = "#5c6b62";
const VERDE = "#34d399";

type MedicaoItem = {
  id: string;
  obra_id: string;
  item_id: string | null;
  data: string | null;
  quantidade_realizada: number | null;
  pct_avanco_resultante: number | null;
  foto_url: string | null;
  observacao: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  criado_por: string | null;
  criado_em: string;
};

type Props = {
  /** ID da obra (rota). */
  obraId: string;
  /** Se fornecido, filtra apenas as medições deste item. Omitir = obra inteira. */
  itemId?: string | null;
  /** Unidade do item (ex.: "m²") para exibir junto à quantidade. */
  unidade?: string | null;
  /** Título da seção. */
  titulo?: string;
};

function formatarData(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function clamp(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

/** Barra de progresso fina, dourada, acessível. */
function BarraPct({ pct }: { pct: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Avanço: ${pct}%`}
      style={{
        height: 4,
        borderRadius: 999,
        background: "rgba(201,162,74,0.15)",
        overflow: "hidden",
        marginTop: 6,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: DOURADO,
          borderRadius: 999,
          transition: "width 300ms ease",
        }}
      />
    </div>
  );
}

/** Card individual de uma medição. */
function CardMedicao({ m, unidade }: { m: MedicaoItem; unidade?: string | null }) {
  const pct = clamp(m.pct_avanco_resultante);
  const autor = m.responsavel_nome || m.criado_por || "—";
  const data = m.data ? formatarData(m.data) : formatarData(m.criado_em);

  return (
    <article
      aria-label={`Medição de ${data}`}
      style={{
        borderRadius: 12,
        border: `1px solid ${BORDA}`,
        background: BG_CARD,
        overflow: "hidden",
      }}
    >
      {/* Foto da evidência */}
      {m.foto_url ? (
        <a
          href={m.foto_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver foto da medição em tamanho completo"
          style={{ display: "block" }}
        >
          <img
            src={m.foto_url}
            alt="Foto da evidência desta medição"
            style={{
              width: "100%",
              aspectRatio: "16/9",
              objectFit: "cover",
              display: "block",
            }}
            loading="lazy"
          />
        </a>
      ) : (
        <div
          aria-hidden="true"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 52,
            background: BG_DEEP,
            borderBottom: `1px solid ${BORDA}`,
          }}
        >
          <Camera size={18} color={TXT_DIM2} aria-hidden />
          <span style={{ marginLeft: 6, fontSize: 11, color: TXT_DIM2 }}>Sem foto</span>
        </div>
      )}

      <div style={{ padding: "12px 14px" }}>
        {/* Cabeçalho: data + autor */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <time
            dateTime={m.criado_em}
            style={{ fontSize: 12, color: TXT_DIM, fontVariantNumeric: "tabular-nums" }}
          >
            {data}
          </time>
          <span
            style={{
              fontSize: 11,
              color: TXT_DIM2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "45%",
            }}
          >
            por {autor}
          </span>
        </div>

        {/* Quantidade + avanço */}
        <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "baseline" }}>
          {m.quantidade_realizada != null ? (
            <span style={{ fontSize: 15, fontWeight: 700, color: TXT, fontVariantNumeric: "tabular-nums" }}>
              {m.quantidade_realizada}
              {unidade ? <span style={{ fontSize: 12, color: TXT_DIM, marginLeft: 3 }}>{unidade}</span> : null}
            </span>
          ) : null}
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: DOURADO,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {pct}%
          </span>
        </div>

        <BarraPct pct={pct} />

        {/* Observação */}
        {m.observacao ? (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 12,
              color: TXT_DIM,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.observacao}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function SecaoHistoricoMedicoes({ obraId, itemId, unidade, titulo = "Medições do item" }: Props) {
  const [medicoes, setMedicoes] = useState<MedicaoItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [migracaoPendente, setMigracaoPendente] = useState(false);

  const carregar = useCallback(
    async (cursor?: string) => {
      setCarregando(true);
      setErro(null);
      try {
        const qs = new URLSearchParams({ limit: "20" });
        if (itemId) qs.set("item_id", itemId);
        if (cursor) qs.set("cursor", cursor);

        const res = await fetch(
          `/api/crm/obras/${encodeURIComponent(obraId)}/medicoes?${qs.toString()}`,
          { headers: internalApiHeaders() }
        );
        const json = (await res.json()) as {
          data?: MedicaoItem[];
          next_cursor?: string | null;
          has_more?: boolean;
          migracao_pendente?: boolean;
          aviso?: string;
          error?: string;
        };
        if (!res.ok) {
          setErro(json.error ?? "Não foi possível carregar o histórico.");
          return;
        }
        if (json.migracao_pendente) {
          setMigracaoPendente(true);
          setMedicoes([]);
          return;
        }
        const novas = json.data ?? [];
        setMedicoes((prev) => (cursor ? [...prev, ...novas] : novas));
        setNextCursor(json.next_cursor ?? null);
        setHasMore(json.has_more ?? false);
      } catch {
        setErro("Falha de rede ao carregar o histórico.");
      } finally {
        setCarregando(false);
      }
    },
    [obraId, itemId]
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <section aria-labelledby="historico-medicoes-titulo" style={{ marginTop: 24 }}>
      {/* Cabeçalho */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: `1px solid ${BORDA}`,
        }}
      >
        <History size={16} color={DOURADO} aria-hidden />
        <h3
          id="historico-medicoes-titulo"
          style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TXT, flex: 1 }}
        >
          {titulo}
        </h3>
        <button
          type="button"
          aria-label="Recarregar histórico de medições"
          onClick={() => {
            setMedicoes([]);
            setNextCursor(null);
            void carregar();
          }}
          disabled={carregando}
          style={{
            background: "none",
            border: "none",
            color: TXT_DIM,
            cursor: carregando ? "default" : "pointer",
            padding: 4,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
          }}
        >
          <RefreshCw
            size={14}
            aria-hidden
            style={{ animation: carregando ? "spin 1s linear infinite" : "none" }}
          />
        </button>
      </div>

      {/* Keyframes SEMPRE montados — o spin do Recarregar e o shimmer precisam existir fora do bloco de loading */}
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Estado: migração pendente */}
      {migracaoPendente ? (
        <div
          role="status"
          style={{
            borderRadius: 10,
            border: `1px solid rgba(201,162,74,0.25)`,
            background: "rgba(201,162,74,0.06)",
            padding: "12px 14px",
            fontSize: 12,
            color: TXT_DIM,
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: DOURADO, fontWeight: 700 }}>Histórico formal ainda não ativo.</span>
          {" "}O registro de medições append-only entra após a migração E7c (janela do dono). O avanço
          por item já está sendo salvo corretamente.
        </div>
      ) : null}

      {/* Estado: erro */}
      {erro ? (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 10,
            border: "1px solid rgba(248,81,73,0.3)",
            background: "rgba(179,38,30,0.07)",
            padding: "10px 14px",
            fontSize: 12,
            color: "#f0aba8",
          }}
        >
          <AlertTriangle size={14} aria-hidden />
          {erro}
        </div>
      ) : null}

      {/* Estado: carregando inicial */}
      {carregando && medicoes.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          aria-label="Carregando histórico de medições"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              style={{
                height: 96,
                borderRadius: 12,
                background: `linear-gradient(90deg, ${BG_CARD} 25%, #16271e 50%, ${BG_CARD} 75%)`,
                backgroundSize: "200% 100%",
                animation: "shimmer 1.4s infinite",
              }}
            />
          ))}
        </div>
      ) : null}

      {/* Lista de medições */}
      {!migracaoPendente && !erro && medicoes.length === 0 && !carregando ? (
        <p style={{ fontSize: 13, color: TXT_DIM2, margin: 0 }}>
          Nenhuma medição registrada ainda. Use o botão "Medir" nos itens da obra.
        </p>
      ) : null}

      {medicoes.length > 0 ? (
        <div
          role="log"
          aria-label="Histórico de medições"
          aria-live="polite"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {medicoes.map((m) => (
            <CardMedicao key={m.id} m={m} unidade={unidade} />
          ))}
        </div>
      ) : null}

      {/* Paginação: "Carregar mais" */}
      {hasMore && !carregando ? (
        <button
          type="button"
          onClick={() => void carregar(nextCursor ?? undefined)}
          style={{
            marginTop: 12,
            width: "100%",
            minHeight: 40,
            borderRadius: 10,
            border: `1px solid ${BORDA}`,
            background: BG_CARD,
            color: TXT_DIM,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <ChevronDown size={14} aria-hidden />
          Carregar mais medições
        </button>
      ) : null}

      {carregando && medicoes.length > 0 ? (
        <p
          role="status"
          aria-live="polite"
          style={{ marginTop: 10, fontSize: 12, color: TXT_DIM2, textAlign: "center" }}
        >
          Carregando…
        </p>
      ) : null}

      {/* Contagem + nota append-only */}
      {medicoes.length > 0 ? (
        <p style={{ marginTop: 14, fontSize: 11, color: TXT_DIM2 }}>
          <span style={{ color: VERDE, fontWeight: 700 }}>{medicoes.length}</span> medição(ões) carregada(s)
          {hasMore ? " · há mais" : ""}.{" "}
          Registros imutáveis — para corrigir, registre uma nova medição.
        </p>
      ) : null}
    </section>
  );
}

export default SecaoHistoricoMedicoes;
