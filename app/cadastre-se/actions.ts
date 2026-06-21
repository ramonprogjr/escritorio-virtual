"use server";

import { redirect } from "next/navigation";
import { crmDb } from "@/lib/crm/supabase-server";
import { executarLeadHubPublico, validarLeadHubPublico } from "@/lib/crm/lead-hub-publico";

export async function submitLeadHub(formData: FormData) {
  const parsed = validarLeadHubPublico({
    empresa: formData.get("empresa"),
    nome: formData.get("nome"),
    email: formData.get("email"),
    telefone: formData.get("telefone"),
  });

  if (!parsed.ok) {
    redirect(`/cadastre-se?erro=${encodeURIComponent(parsed.error)}`);
  }

  const result = await executarLeadHubPublico(crmDb(), parsed.data);
  if (!result.ok) {
    redirect(`/cadastre-se?erro=${encodeURIComponent(result.error)}`);
  }

  redirect(`/cadastre-se?ok=1&email=${encodeURIComponent(parsed.data.email)}`);
}
