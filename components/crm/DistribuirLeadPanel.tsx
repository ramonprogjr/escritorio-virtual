"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { DirecionarLeadDrawer } from "@/components/crm/DirecionarLeadDrawer";

/**
 * Botão "Direcionar" da ficha do lead → abre o drawer com o CARD ÚNICO.
 * Toda a lógica (sugerir/aprovar/recusa→próximo) vive no `DirecionarLeadDrawer`,
 * reutilizado também pelo quick-action da lista de leads. Um verbo só.
 */
export function DistribuirLeadPanel({
  leadId,
  leadNome,
  onDone,
  onQualificar,
}: {
  leadId: string;
  leadNome?: string;
  onDone?: () => void;
  /** Promove o lead a qualificado e re-roda /sugerir num passo só (opcional). */
  onQualificar?: () => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors md:text-sm"
        style={{ borderColor: "#1d3a2c", color: "#c9a24a", background: "#003b2622" }}
      >
        <Share2 className="h-4 w-4" strokeWidth={2} />
        Direcionar
      </button>

      <DirecionarLeadDrawer
        open={aberto}
        leadId={leadId}
        leadNome={leadNome}
        onClose={() => setAberto(false)}
        onDirecionado={onDone}
        onQualificar={onQualificar}
      />
    </>
  );
}
