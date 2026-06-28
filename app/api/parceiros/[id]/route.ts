import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import {
  defaultTenantId,
  isMissingPgColumn,
  tenantIdFromRequest,
  tenantScopeOrFilter,
} from "@/lib/tenant-default";
import { MERCADOS_PREFIXO } from "@/lib/crm/negocio-cadastro";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Status de homologação aceitos no PATCH (porta do motor de distribuição). */
const STATUS_PERMITIDOS = ["captacao", "em_homologacao", "homologado"] as const;
type StatusPermitido = (typeof STATUS_PERMITIDOS)[number];

const MERCADOS_VALIDOS = new Set<string>(MERCADOS_PREFIXO);

type PatchAceito = {
  mercado?: string;
  recebe_leads?: boolean;
  status?: StatusPermitido;
};

/**
 * WHITELIST ESTRITA: só estes 3 campos entram. O body cru é descartado — nada de
 * `comissao`, `codigo`, `tenant_id` ou qualquer outro escapa para o update. Cada
 * campo é validado por tipo/domínio; chave ausente = não mexe naquele campo.
 *
 * `mercado` é STRING SINGULAR de propósito: o motor (listarCandidatosParceiro)
 * casa por `mercado` string. Gravar array quebraria o casamento.
 */
function extrairCamposPermitidos(
  body: unknown
): { campos: PatchAceito } | { erro: string } {
  if (!body || typeof body !== "object") {
    return { erro: "Body inválido" };
  }
  const raw = body as Record<string, unknown>;
  const campos: PatchAceito = {};

  if ("mercado" in raw) {
    const m = raw.mercado;
    if (m === "" || m === null) {
      campos.mercado = "";
    } else if (typeof m === "string" && m.trim().length > 0 && m.trim().length <= 8) {
      const sigla = m.trim().toUpperCase();
      if (!MERCADOS_VALIDOS.has(sigla)) {
        return { erro: "mercado inválido" };
      }
      campos.mercado = sigla;
    } else {
      return { erro: "mercado inválido" };
    }
  }

  if ("recebe_leads" in raw) {
    if (typeof raw.recebe_leads !== "boolean") {
      return { erro: "recebe_leads deve ser booleano" };
    }
    campos.recebe_leads = raw.recebe_leads;
  }

  if ("status" in raw) {
    const s = raw.status;
    if (typeof s !== "string" || !STATUS_PERMITIDOS.includes(s as StatusPermitido)) {
      return { erro: "status inválido" };
    }
    campos.status = s as StatusPermitido;
  }

  if (Object.keys(campos).length === 0) {
    return { erro: "Nenhum campo editável informado" };
  }

  return { campos };
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  // Gestor-only (owner ou gestor) — espelha o endpoint /modulo.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ erro: "id ausente" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const parsed = extrairCamposPermitidos(body);
  if ("erro" in parsed) {
    return NextResponse.json({ erro: parsed.erro }, { status: 400 });
  }
  const { campos } = parsed;

  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();

  // Update com escopo de tenant: id + (tenant atual / legado / null). Fallback sem
  // o filtro `.or` se a coluna tenant_id ainda não existir no schema.
  const runUpdate = (withTenantFilter: boolean) => {
    let query = supabase.from("hub_parceiros").update(campos).eq("id", id);
    if (withTenantFilter) {
      query = query.or(tenantScopeOrFilter(tenantId));
    }
    return query.select("id, nome, mercado, recebe_leads, status").maybeSingle();
  };

  let { data, error } = await runUpdate(true);
  if (error && isMissingPgColumn(error, "tenant_id")) {
    ({ data, error } = await runUpdate(false));
  }

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  if (!data) {
    // Sem linha: ou não existe, ou está fora do escopo de tenant do operador.
    return NextResponse.json({ erro: "Parceiro não encontrado" }, { status: 404 });
  }

  // Auditoria (padrão do endpoint /modulo). Falha de log não derruba o PATCH.
  await supabase
    .from("hub_parceiros_log")
    .insert({
      parceiro_id: id,
      evento: "parceiro_distribuicao_atualizada",
      descricao: "Campos de distribuição atualizados pelo gestor",
      feito_por: g.ctx.userId,
      feito_por_tipo: "humano",
      dados: campos,
    })
    .then(
      () => undefined,
      () => undefined
    );

  return NextResponse.json({ parceiro: data });
}
