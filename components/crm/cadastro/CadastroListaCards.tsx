"use client";

import { memo, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { CrmCheckbox } from "@/components/crm/CrmCheckbox";

/**
 * Versão MOBILE da lista de cadastros (Contatos/Empresas).
 *
 * No desktop a tela usa CadastroListaTable (tabela com scroll horizontal); em
 * telas estreitas (&lt; 768px) a tabela causava scroll horizontal e ficava
 * ilegível. Aqui renderizamos cards verticais — mesmo padrão de leads/negócios:
 * nome em bold, subtítulo (código mono dourado + telefone), badge e ações.
 *
 * Preserva os mesmos handlers (onRowClick/onView/onEdit/onDelete/onToggleRow)
 * usados pela tabela — só muda a apresentação.
 */

type Props<T extends { id: string }> = {
  rows: T[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  primaryColumn: {
    title: (row: T) => ReactNode;
    label?: (row: T) => string;
    subtitle?: (row: T) => ReactNode;
  };
  /** Conteúdo extra do card (badge PF/PJ, ações rápidas como WhatsApp). */
  badge?: (row: T) => ReactNode;
  footer?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
};

function CadastroListaCardsInner<T extends { id: string }>({
  rows,
  selectedIds,
  onToggleRow,
  primaryColumn,
  badge,
  footer,
  onRowClick,
  onEdit,
  onDelete,
}: Props<T>) {
  const hasActions = Boolean(onEdit || onDelete);

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-4">
      {rows.map((row) => {
        const selected = selectedIds.has(row.id);
        return (
          <li
            key={row.id}
            className={`rounded-xl border bg-[#0f1d16] p-3 transition-colors ${
              selected ? "border-[#c9a24a]/60" : "border-[#1d3a2c]"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className="pt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <CrmCheckbox
                  checked={selected}
                  onChange={() => onToggleRow(row.id)}
                  aria-label={`Selecionar ${
                    primaryColumn.label?.(row) ?? String(primaryColumn.title(row))
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={() => onRowClick?.(row)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate font-bold text-white">
                    {primaryColumn.title(row)}
                  </span>
                  {badge?.(row)}
                </div>
                {primaryColumn.subtitle?.(row)}
              </button>
            </div>

            {footer?.(row)}

            {hasActions && (
              <div className="mt-2.5 flex items-center justify-end gap-1.5 border-t border-[#16271e] pt-2.5">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#1d3a2c] px-3 text-xs font-semibold text-[#8b949e] transition-colors hover:bg-[#16271e] hover:text-[#c9a24a]"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#1d3a2c] text-[#8b949e] transition-colors hover:border-[#f8514966] hover:bg-[#16271e] hover:text-[#f85149]"
                    aria-label="Excluir"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export const CadastroListaCards = memo(CadastroListaCardsInner) as typeof CadastroListaCardsInner;
