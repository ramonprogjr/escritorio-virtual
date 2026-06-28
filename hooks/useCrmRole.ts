"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isCrmOwnerRole, isCrmGestorRole } from "@/lib/crm/crm-permissoes";

/**
 * Papel CRM do utilizador autenticado (lido de `users.role`), reutilizável por
 * páginas-cliente que precisam condicionar BLOCOS por perfil — sem bifurcar telas.
 * Mesma fonte/contrato do guard de rota (crmPodeVerRota) e do CrmSessionFooter.
 *
 * Uso típico: esconder do fornecedor comum (gestor/comercial) o que é da
 * PLATAFORMA/HUB (env vars, segredos, identificadores internos) — `isOwner`.
 */
export function useCrmRole(): {
  role: string;
  loading: boolean;
  isOwner: boolean;
  isGestor: boolean;
} {
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return;
      if (!user) {
        setRole("");
        setLoading(false);
        return;
      }
      const row = await supabase.from("users").select("role").eq("auth_id", user.id).maybeSingle();
      if (cancelled) return;
      setRole(row.data?.role != null ? String(row.data.role) : "");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    role,
    loading,
    isOwner: isCrmOwnerRole(role),
    isGestor: isCrmGestorRole(role),
  };
}
