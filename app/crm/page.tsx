"use client";

import { useCrmTenant } from "@/components/crm/CrmTenantContext";
import { CrmComercialDashboard } from "@/components/crm/dashboard/CrmComercialDashboard";
import { CrmPersonaCockpit } from "@/components/crm/dashboard/CrmPersonaCockpit";
import { personaCockpitFromRole } from "@/lib/crm/persona-cockpit";

/**
 * Router de PERSONA do /crm (cockpit persona-aware v1 — ADITIVO).
 *
 * O papel do usuário vem do contexto de sessão (useCrmTenant().role → /api/crm/me/context, que
 * lê users.role no servidor). A partir dele escolhemos o cockpit:
 *   - comercial / HUB (owner, admin, gestor, comercial, financeiro, atendente) → dashboard atual,
 *     preservado 100% (CrmComercialDashboard).
 *   - engenharia (operation) / arquiteto (architect) / cliente (client) / fornecedor (supplier) →
 *     seu recorte próprio (CrmPersonaCockpit), que busca o mesmo endpoint persona-aware.
 *
 * A persona do SERVIDOR (route → getCallerContext) é a autoridade final sobre os dados; aqui só
 * decidimos qual componente montar (para não rodar o hook comercial fora da persona comercial).
 */
export default function DashboardPage() {
  const { role, loading } = useCrmTenant();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a140f] px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-[1400px] animate-pulse space-y-4">
          <div className="h-6 w-40 rounded bg-[#16271e]" />
          <div className="h-24 rounded-2xl bg-[#121926]" />
        </div>
      </div>
    );
  }

  const persona = personaCockpitFromRole(role);

  if (persona === "comercial") {
    return <CrmComercialDashboard />;
  }
  return <CrmPersonaCockpit />;
}
