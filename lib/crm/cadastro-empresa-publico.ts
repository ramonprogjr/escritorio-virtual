import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarCodigoEmpresa } from "@/lib/crm/empresa-cadastro";
import {
  documentoCompleto,
  mensagemDocumentoInvalido,
  normalizarDocumento,
  validarCnpj,
} from "@/lib/crm/documento-brasil";
import type { PrefixoMercado } from "@/lib/crm/negocio-cadastro";
import { slugFromNomeExibicao } from "@/lib/crm/tenant-slug";
import { isMissingPgColumn } from "@/lib/tenant-default";
import type { SignupSegmento } from "@/lib/hub/landing-content";

export type CadastroEmpresaPublicoInput = {
  razao_social: string;
  cnpj: string;
  cidade?: string | null;
  estado?: string | null;
  segmento: SignupSegmento;
  owner_name: string;
  owner_email: string;
  owner_password: string;
  aceite_termos: boolean;
};

export type CadastroEmpresaPublicoResult =
  | { ok: true; tenantId: string; slug: string; needsEmailConfirmation: true }
  | { ok: false; error: string; status: number };

const SEGMENTO_PREFIXO: Record<SignupSegmento, PrefixoMercado> = {
  construtora: "ENG",
  incorporadora: "IMB",
  arquitetura: "ARQ",
  imobiliaria: "IMB",
  outro: "SRV",
};

const SEGMENTO_EMPRESA: Record<SignupSegmento, string> = {
  construtora: "construtora",
  incorporadora: "outro",
  arquitetura: "outro",
  imobiliaria: "outro",
  outro: "outro",
};

function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function publicSignupEnabled(): boolean {
  const v = process.env.PUBLIC_SIGNUP_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

export function validarCadastroEmpresaPublico(
  body: Partial<CadastroEmpresaPublicoInput>
): { ok: true; data: CadastroEmpresaPublicoInput } | { ok: false; error: string } {
  const razao_social = (body.razao_social || "").trim();
  if (razao_social.length < 2) {
    return { ok: false, error: "Razão social é obrigatória (mín. 2 caracteres)." };
  }

  const cnpjRaw = (body.cnpj || "").trim();
  const cnpj = normalizarDocumento(cnpjRaw);
  if (!documentoCompleto("PJ", cnpjRaw)) {
    return { ok: false, error: "Informe o CNPJ com 14 dígitos." };
  }
  if (!validarCnpj(cnpj)) {
    return { ok: false, error: mensagemDocumentoInvalido("PJ") };
  }

  const segmento = body.segmento;
  if (!segmento || !SEGMENTO_PREFIXO[segmento as SignupSegmento]) {
    return { ok: false, error: "Selecione um segmento válido." };
  }

  const owner_name = (body.owner_name || "").trim();
  if (owner_name.length < 2) {
    return { ok: false, error: "Nome do responsável é obrigatório." };
  }

  const owner_email = (body.owner_email || "").trim().toLowerCase();
  if (!validarEmail(owner_email)) {
    return { ok: false, error: "E-mail corporativo inválido." };
  }

  const owner_password = body.owner_password || "";
  if (owner_password.length < 8) {
    return { ok: false, error: "Senha deve ter pelo menos 8 caracteres." };
  }

  if (!body.aceite_termos) {
    return { ok: false, error: "Aceite os termos para continuar." };
  }

  return {
    ok: true,
    data: {
      razao_social: razao_social.slice(0, 200),
      cnpj,
      cidade: (body.cidade || "").trim().slice(0, 120) || null,
      estado: (body.estado || "").trim().toUpperCase().slice(0, 2) || null,
      segmento: segmento as SignupSegmento,
      owner_name: owner_name.slice(0, 120),
      owner_email,
      owner_password,
      aceite_termos: true,
    },
  };
}

async function cnpjJaCadastrado(supabase: SupabaseClient, cnpj: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("hub_empresas")
    .select("id")
    .eq("cnpj", cnpj)
    .maybeSingle();
  if (error && isMissingPgColumn(error, "cnpj")) return false;
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function emailJaCadastrado(supabase: SupabaseClient, email: string): Promise<boolean> {
  const { data, error } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function executarCadastroEmpresaPublico(
  supabase: SupabaseClient,
  input: CadastroEmpresaPublicoInput
): Promise<CadastroEmpresaPublicoResult> {
  if (await cnpjJaCadastrado(supabase, input.cnpj)) {
    return { ok: false, error: "CNPJ já cadastrado na plataforma.", status: 409 };
  }
  if (await emailJaCadastrado(supabase, input.owner_email)) {
    return { ok: false, error: "E-mail já utilizado. Faça login ou recupere a senha.", status: 409 };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const redirectTo = appUrl ? `${appUrl}/login?confirmed=1&next=/crm/onboarding-tenant` : undefined;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.owner_email,
    password: input.owner_password,
    email_confirm: false,
    user_metadata: { name: input.owner_name },
    ...(redirectTo ? { email_redirect_to: redirectTo } : {}),
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return { ok: false, error: "E-mail já registado. Faça login.", status: 409 };
    }
    return { ok: false, error: authError.message, status: 500 };
  }

  const authId = authData.user?.id;
  if (!authId) {
    return { ok: false, error: "Conta criada sem identificador. Contacte o suporte.", status: 500 };
  }

  const slugBase = slugFromNomeExibicao(input.razao_social);
  let slug = slugBase;
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabase.from("hub_tenants").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${slugBase}-${i + 2}`;
  }

  const { data: tenant, error: tenantErr } = await supabase
    .from("hub_tenants")
    .insert({ slug, nome_exibicao: input.razao_social, ativo: true })
    .select("id, slug")
    .single();

  if (tenantErr || !tenant) {
    try {
      await supabase.auth.admin.deleteUser(authId);
    } catch {
      /* rollback best-effort */
    }
    return { ok: false, error: tenantErr?.message || "Erro ao criar empresa.", status: 500 };
  }

  const tenantId = String(tenant.id);
  const now = new Date().toISOString();

  const userPayload: Record<string, unknown> = {
    auth_id: authId,
    email: input.owner_email,
    name: input.owner_name,
    role: "owner",
    status: "Ativo",
    tenant_id: tenantId,
    atualizado_em: now,
    criado_em: now,
  };

  let { error: userErr } = await supabase.from("users").insert(userPayload);

  if (userErr && isMissingPgColumn(userErr, "tenant_id")) {
    delete userPayload.tenant_id;
    delete userPayload.criado_em;
    delete userPayload.atualizado_em;
    userPayload.created_at = now;
    userPayload.updated_at = now;
    ({ error: userErr } = await supabase.from("users").insert(userPayload));
  }

  if (userErr) {
    await supabase.from("hub_tenants").delete().eq("id", tenantId);
    try {
      await supabase.auth.admin.deleteUser(authId);
    } catch {
      /* rollback best-effort */
    }
    return { ok: false, error: userErr.message, status: 500 };
  }

  try {
    const codigo = await gerarCodigoEmpresa(supabase);
    const empresaRow: Record<string, unknown> = {
      codigo,
      razao_social: input.razao_social,
      cnpj: input.cnpj,
      segmento: SEGMENTO_EMPRESA[input.segmento],
      prefixo_mercado: SEGMENTO_PREFIXO[input.segmento],
      cidade: input.cidade,
      estado: input.estado,
      email: input.owner_email,
      tenant_id: tenantId,
      ativo: true,
    };
    let { error: empErr } = await supabase.from("hub_empresas").insert(empresaRow);
    if (empErr && isMissingPgColumn(empErr, "tenant_id")) {
      delete empresaRow.tenant_id;
      ({ error: empErr } = await supabase.from("hub_empresas").insert(empresaRow));
    }
    if (empErr && !isMissingPgColumn(empErr, "hub_empresas")) {
      console.warn("[cadastro-empresa-publico] hub_empresas:", empErr.message);
    }
  } catch (e) {
    console.warn("[cadastro-empresa-publico] empresa opcional:", e);
  }

  return {
    ok: true,
    tenantId,
    slug: String(tenant.slug),
    needsEmailConfirmation: true,
  };
}
