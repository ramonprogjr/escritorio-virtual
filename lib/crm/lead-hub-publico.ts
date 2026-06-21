import type { SupabaseClient } from "@supabase/supabase-js";
import {
  montarMetadataLeadMercados,
  normalizarTelefoneLead,
  prepararRowHubLeadInsert,
} from "@/lib/crm/lead-cadastro";
import { defaultTenantId } from "@/lib/tenant-default";

export type LeadHubPublicoInput = {
  empresa: string;
  nome: string;
  email: string;
  telefone: string;
};

export function validarLeadHubPublico(
  body: Record<string, unknown>
): { ok: true; data: LeadHubPublicoInput } | { ok: false; error: string } {
  const empresa = String(body.empresa ?? "").trim();
  if (empresa.length < 2) {
    return { ok: false, error: "Informe o nome da empresa." };
  }

  const nome = String(body.nome ?? "").trim();
  if (nome.length < 2) {
    return { ok: false, error: "Informe o seu nome." };
  }

  const email = String(body.email ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Informe um e-mail válido." };
  }

  const telefoneRaw = String(body.telefone ?? "").trim();
  const telefone = normalizarTelefoneLead(telefoneRaw);
  if (telefone.length < 10 || telefone.length > 13) {
    return { ok: false, error: "Informe telefone com DDD (10 ou 11 dígitos)." };
  }

  return {
    ok: true,
    data: {
      empresa: empresa.slice(0, 200),
      nome: nome.slice(0, 200),
      email: email.slice(0, 200),
      telefone,
    },
  };
}

export async function executarLeadHubPublico(
  supabase: SupabaseClient,
  input: LeadHubPublicoInput
): Promise<{ ok: true; leadId: string; codigo: string | null } | { ok: false; error: string; status: number }> {
  const tenantId = defaultTenantId();
  const now = new Date().toISOString();

  if (input.telefone) {
    const { data: dup } = await supabase
      .from("hub_leads_crm")
      .select("id, nome")
      .eq("telefone", input.telefone)
      .maybeSingle();

    if (dup) {
      return {
        ok: false,
        error: `Este telefone já está registado (${dup.nome}).`,
        status: 409,
      };
    }
  }

  const rowBase: Record<string, unknown> = {
    nome: input.nome,
    telefone: input.telefone,
    email: input.email,
    origem: "site",
    estagio: "novo",
    valor_estimado: 0,
    score: 50,
    observacoes: `Empresa: ${input.empresa}`,
    criado_em: now,
    atualizado_em: now,
    metadata: {
      ...montarMetadataLeadMercados({ mercados: [], origem_cadastro: "hub_landing" }),
      empresa: input.empresa,
    },
  };

  const row = await prepararRowHubLeadInsert(supabase, rowBase);
  const variants: Record<string, unknown>[] = [
    { ...row, tenant_id: tenantId },
    { ...row },
  ];

  let lastError: { message?: string; code?: string } | null = null;
  for (const variant of variants) {
    const { data, error } = await supabase
      .from("hub_leads_crm")
      .insert(variant)
      .select("id, codigo")
      .single();

    if (!error && data) {
      const leadId = String(data.id);
      const codigo = data.codigo != null ? String(data.codigo) : null;
      try {
        await supabase.from("hub_atividades").insert({
          lead_id: leadId,
          tipo: "nota",
          descricao: `Lead captado no Hub — ${input.empresa}`,
          feito_por: "sistema",
          feito_por_tipo: "sistema",
        });
      } catch {
        /* actividade opcional */
      }
      return { ok: true, leadId, codigo };
    }
    lastError = error;
    if (lastError?.code === "23505") {
      return { ok: false, error: "Telefone já cadastrado.", status: 409 };
    }
  }

  return {
    ok: false,
    error: lastError?.message ?? "Erro ao registar lead.",
    status: 500,
  };
}
