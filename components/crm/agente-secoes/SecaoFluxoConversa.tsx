"use client";

import { GitBranch, Pencil } from "lucide-react";
import { CrmButton } from "@/components/crm/CrmButton";

/**
 * F2 — Fluxo da conversa como card de 1ª classe na ficha do agente de ATENDIMENTO.
 * Antes, editar o fluxo exigia caçar o botão "Playbook — Calibração" e descer 3 níveis (7-9 cliques).
 * Agora há um card claro com "Editar fluxo" que abre o editor visual DIRETO (≤2 cliques), reaproveitando
 * o drawer de calibração (carga do markdown + publicação) via autoAbrirFluxoVisual.
 */
export function SecaoFluxoConversa({ onEditarFluxo }: { onEditarFluxo: () => void }) {
  return (
    <section className="rounded-xl border border-obra-borda bg-obra-dark-2 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <GitBranch size={18} className="mt-0.5 text-obra-dourado" aria-hidden />
          <div>
            <h3 className="m-0 text-sm font-semibold text-obra-texto">Fluxo da conversa</h3>
            <p className="m-0 mt-0.5 text-xs text-obra-texto-2">
              As perguntas e menus que o agente usa no WhatsApp — edite direto no editor visual.
            </p>
          </div>
        </div>
        <CrmButton size="sm" onClick={onEditarFluxo} leftIcon={<Pencil size={14} />}>
          Editar fluxo
        </CrmButton>
      </div>
    </section>
  );
}
