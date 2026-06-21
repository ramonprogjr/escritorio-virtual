"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { supabase } from "@/lib/supabase/client";

type CrmTenantContextValue = {
  tenantId: string;
  tenantNome: string;
  role: string;
  loading: boolean;
};

const CrmTenantContext = createContext<CrmTenantContextValue>({
  tenantId: "",
  tenantNome: "",
  role: "",
  loading: true,
});

export function useCrmTenant() {
  return useContext(CrmTenantContext);
}

export function CrmTenantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CrmTenantContextValue>({
    tenantId: "",
    tenantNome: "",
    role: "",
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setState({ tenantId: "", tenantNome: "", role: "", loading: false });
        return;
      }
      try {
        const res = await fetch("/api/crm/me/context", { headers: await crmApiHeaders() });
        const json = (await res.json()) as {
          tenantId?: string;
          tenantNome?: string;
          role?: string;
        };
        if (!cancelled) {
          setState({
            tenantId: json.tenantId ?? "",
            tenantNome: json.tenantNome ?? "Obra10+",
            role: json.role ?? "",
            loading: false,
          });
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    }

    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return <CrmTenantContext.Provider value={state}>{children}</CrmTenantContext.Provider>;
}
