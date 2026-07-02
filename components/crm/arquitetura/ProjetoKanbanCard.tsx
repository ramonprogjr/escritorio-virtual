"use client";

import type { CSSProperties, MouseEvent } from "react";
import { Pencil, ArrowLeftRight, User, Ruler } from "lucide-react";
import { tipologiaLabel, APROVACAO_PROJETO, type AprovacaoProjetoStatus } from "@/lib/crm/projeto-funil-defaults";

export type ProjetoKanbanCardData = {
  id: string;
  codigo: string | null;
  titulo: string;
  estagio: string;
  tipologia: string | null;
  area_m2: number | null;
  cliente_nome: string | null;
  responsavel_id: string | null;
  proxima_entrega: string | null;
  proxima_entrega_em: string | null;
  aprovacao_status: string | null;
  criado_em: string | null;
};

/** Faixa de prazo da próxima entrega → cor (atrasada/hoje/futura). A "Situação" auto da planilha. */
function faixaEntrega(
  dataIso: string | null | undefined,
  estagio: string
): { cor: string; quando: string; atrasou: boolean } {
  if (!dataIso) return { cor: "#94a3b8", quando: "", atrasou: false };
  const alvo = new Date(dataIso);
  if (Number.isNaN(alvo.getTime())) return { cor: "#94a3b8", quando: "", atrasou: false };
  const hoje0 = new Date();
  const base = new Date(hoje0.getFullYear(), hoje0.getMonth(), hoje0.getDate()).getTime();
  const alvo0 = new Date(alvo.getFullYear(), alvo.getMonth(), alvo.getDate()).getTime();
  const dias = Math.round((alvo0 - base) / 86_400_000);
  const entregue = estagio === "entregue" || estagio === "arquivado";
  const atrasou = dias < 0 && !entregue;
  const quando =
    dias === 0 ? "hoje"
    : dias === 1 ? "amanhã"
    : dias === -1 ? "ontem"
    : dias < 0 ? `há ${Math.abs(dias)}d`
    : dias < 7 ? `em ${dias}d`
    : alvo.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const cor = atrasou ? "#f85149" : dias === 0 ? "#c9a24a" : "#2f9e8f";
  return { cor, quando, atrasou };
}

function aprovacaoInfo(status: string | null): { label: string; cor: string } {
  const key = (status ?? "sem_aprovacao") as AprovacaoProjetoStatus;
  return APROVACAO_PROJETO[key] ?? APROVACAO_PROJETO.sem_aprovacao;
}

type Props = {
  projeto: ProjetoKanbanCardData;
  accent: string; // cor do estágio (borda esquerda)
  dragging?: boolean;
  draggable?: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onMove?: () => void;
  onAprovacao?: () => void; // atalho do chip de aprovação → ficha na aba Entregáveis
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

const actionBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid #1d3a2c",
  background: "rgba(15, 29, 22, 0.85)",
  cursor: "pointer",
};

export function ProjetoKanbanCard({
  projeto,
  accent,
  dragging,
  draggable,
  onOpen,
  onEdit,
  onMove,
  onAprovacao,
  onDragStart,
  onDragEnd,
}: Props) {
  const entrega = faixaEntrega(projeto.proxima_entrega_em, projeto.estagio);
  const aprov = aprovacaoInfo(projeto.aprovacao_status);
  const tipo = projeto.tipologia ? tipologiaLabel(projeto.tipologia) : null;

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      style={{
        cursor: "pointer",
        opacity: dragging ? 0.5 : 1,
        transition: "opacity 0.15s",
        borderRadius: 14,
        border: "1px solid #1d3a2c",
        borderLeft: `3px solid ${accent}`,
        background: "#0f1d16",
        padding: 12,
      }}
    >
      {/* L1 — título + selos (ATRASOU auto · AGUARD. aprovação) — empilham, não sobrepõem */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
        <strong
          style={{
            color: "#e6edf3",
            fontSize: 13,
            letterSpacing: "-0.02em",
            lineHeight: 1.25,
            minWidth: 0,
          }}
        >
          {projeto.titulo}
        </strong>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
          {entrega.atrasou ? (
            <span
              style={{
                borderRadius: 999,
                padding: "1px 7px",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.3,
                background: "#f8514922",
                color: "#f85149",
              }}
            >
              ATRASOU
            </span>
          ) : null}
          {projeto.aprovacao_status === "aguardando" ? (
            <span
              style={{
                borderRadius: 999,
                padding: "1px 7px",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.3,
                background: "#c9a24a22",
                color: "#c9a24a",
              }}
            >
              ◷ AGUARD.
            </span>
          ) : null}
        </div>
      </div>

      {/* L2 — responsável */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#8b949e", fontSize: 10.5, fontWeight: 600 }}>
          <User size={11} aria-hidden />
          {projeto.cliente_nome?.trim() || "Sem cliente"}
        </span>
      </div>

      {/* L3 — chip tipologia (dourado) + m² */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 6,
            background: tipo ? "rgba(201,162,74,0.16)" : "#1d3a2c44",
            color: tipo ? "#e0b86a" : "#6e7681",
            border: `1px solid ${tipo ? "rgba(201,162,74,0.35)" : "#1d3a2c"}`,
          }}
        >
          {tipo ?? "Sem tipologia"}
        </span>
        {projeto.area_m2 && projeto.area_m2 > 0 ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#94a3b8", fontSize: 10.5, fontWeight: 600 }}>
            <Ruler size={11} aria-hidden />
            {projeto.area_m2}m²
          </span>
        ) : null}
      </div>

      {/* L4 — próxima entrega (cor por prazo; oculta se ausente) */}
      {projeto.proxima_entrega?.trim() || projeto.proxima_entrega_em ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          <span
            style={{ width: 6, height: 6, borderRadius: "50%", background: entrega.cor, flexShrink: 0 }}
            aria-hidden
          />
          <span style={{ color: "#c8d4e6", fontSize: 11, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {projeto.proxima_entrega?.trim() || "Próxima entrega"}
          </span>
          {entrega.quando ? (
            <span
              style={{
                flexShrink: 0,
                marginLeft: "auto",
                borderRadius: 999,
                padding: "1px 7px",
                fontSize: 9,
                fontWeight: 700,
                background: `${entrega.cor}22`,
                color: entrega.cor,
              }}
            >
              {entrega.quando}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* L5 — footer: chip aprovação + ações */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {onAprovacao ? (
          // Atalho útil: leva à ficha na aba Entregáveis (onde mora a aprovação).
          // stopPropagation p/ o clique não cair no onOpen genérico do card.
          <button
            type="button"
            title="Abrir Entregáveis (aprovação)"
            aria-label={`Aprovação: ${aprov.label}. Abrir Entregáveis`}
            onClick={(e) => { stop(e); onAprovacao(); }}
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 6,
              background: `${aprov.cor}18`,
              color: aprov.cor,
              border: `1px solid ${aprov.cor}40`,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${aprov.cor}33`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${aprov.cor}18`; }}
          >
            {aprov.label}
          </button>
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 6,
              background: `${aprov.cor}18`,
              color: aprov.cor,
              border: `1px solid ${aprov.cor}40`,
            }}
          >
            {aprov.label}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {onMove ? (
            <button type="button" title="Mover etapa" aria-label="Mover etapa" onClick={(e) => { stop(e); onMove(); }} style={actionBtn}>
              <ArrowLeftRight size={13} strokeWidth={2.2} color="#c9a24a" />
            </button>
          ) : null}
          {onEdit ? (
            <button type="button" title="Abrir" aria-label="Abrir" onClick={(e) => { stop(e); onEdit(); }} style={actionBtn}>
              <Pencil size={13} strokeWidth={2.2} color="#c9a24a" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
