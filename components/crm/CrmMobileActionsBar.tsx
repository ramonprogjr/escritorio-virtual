"use client";

import { usePathname } from "next/navigation";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";

/**
 * Faixa fina de ações da página — só aparece no mobile (<768px) quando a rota
 * atual registou ações no slot do CrmHeaderContext.
 *
 * Busca/tenant-badge ficam apenas no desktop (CrmUniversalHeader); esta barra
 * serve exclusivamente os botões de ação (ex.: "Novo Lead", "Exportar", etc.).
 */
export function CrmMobileActionsBar() {
  const pathname = usePathname() || "";
  const { slot } = useCrmHeaderSlot();

  // Só renderiza se o slot é da rota actual e tem acções
  const scoped = slot != null && slot.path === pathname ? slot : null;
  if (!scoped?.actions) return null;

  return (
    <div
      className="flex md:hidden min-h-11 flex-shrink-0 items-center justify-end gap-2 border-b px-3 py-1.5"
      style={{
        background: "#0b1410",
        borderColor: "#1d3a2c",
      }}
    >
      {scoped.actions}
    </div>
  );
}
