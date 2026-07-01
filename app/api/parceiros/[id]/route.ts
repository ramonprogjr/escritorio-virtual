import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import {
  isMissingPgColumn,
  tenantScopeOrFilter,
} from "@/lib/tenant-default";
import { MERCADOS_PREFIXO } from "@/lib/crm/negocio-cadastro";
import { parceiroParaFornecedor } from "@/lib/crm/parceiro-fornecedor-map";

function db() {
  // fail-closed: sem fallback para a anon key (Batch 3).
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
  if (!supabase) return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });
  // Tenant SEMPRE da sessão autenticada (g.ctx), NUNCA do header x-tenant-id (forjável).
  // Espelha o GET irmão; fecha o vetor de um gestor editar parceiro de outro tenant.
  const tenantId = g.ctx.tenantId;

  // Update com escopo de tenant: id + (tenant atual / legado / null). Fallback sem
  // o filtro `.or` se a coluna tenant_id ainda não existir no schema.
  // Campos extras (telefone/geo/carga/financeiro/tenant) alimentam o espelho
  // hub_fornecedores no sync best-effort abaixo. A resposta da API segue
  // retornando id/nome/mercado/recebe_leads/status (campos extras só agregam).
  const runUpdate = (withTenantFilter: boolean) => {
    let query = supabase.from("hub_parceiros").update(campos).eq("id", id);
    if (withTenantFilter) {
      query = query.or(tenantScopeOrFilter(tenantId));
    }
    return query
      .select(
        "id, nome, telefone, mercado, especialidade, cidade, estado, recebe_leads, status, total_leads_recebidos, status_financeiro, tenant_id"
      )
      .maybeSingle();
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

  // Espelho parceiro → fornecedor (BEST-EFFORT). Mantém hub_fornecedores em sincronia
  // quando o gestor edita o parceiro, para o motor (atrás da flag MOTOR_FONTE) nunca
  // ler dados stale. NUNCA derruba o PATCH: qualquer falha aqui é só logada.
  await sincronizarEspelhoFornecedor(supabase, data, tenantId);

  return NextResponse.json({ parceiro: data });
}

/** Linha do parceiro retornada pelo update (campos usados pelo espelho). */
type ParceiroAtualizado = {
  id?: unknown;
  nome?: unknown;
  telefone?: unknown;
  mercado?: unknown;
  especialidade?: unknown;
  cidade?: unknown;
  estado?: unknown;
  recebe_leads?: unknown;
  status?: unknown;
  total_leads_recebidos?: unknown;
  status_financeiro?: unknown;
  tenant_id?: unknown;
};

/**
 * UPSERT best-effort em hub_fornecedores a partir do parceiro recém-atualizado.
 *
 * Usa o contrato PURO `parceiroParaFornecedor` para derivar mercados[]/mercado_principal
 * e status_acesso (menor privilégio: só `homologado` → `aprovado`). Mapeia o shape do
 * contrato para as colunas reais de hub_fornecedores. `id`/`origem_parceiro_id` recebem
 * o id do parceiro (idempotente: re-editar o mesmo parceiro atualiza a mesma linha).
 *
 * Best-effort por design — encapsulado em try/catch; falha aqui jamais derruba o PATCH.
 */
async function sincronizarEspelhoFornecedor(
  supabase: SupabaseClient,
  parceiro: ParceiroAtualizado | null,
  tenantId: string
): Promise<void> {
  try {
    if (!parceiro?.id) return;

    const mercadoStr =
      typeof parceiro.mercado === "string" && parceiro.mercado.trim()
        ? parceiro.mercado.trim()
        : null;
    const statusStr = typeof parceiro.status === "string" ? parceiro.status : null;

    const derivado = parceiroParaFornecedor({ mercado: mercadoStr, status: statusStr });

    const row = {
      id: String(parceiro.id),
      origem_parceiro_id: String(parceiro.id),
      tenant_id:
        (typeof parceiro.tenant_id === "string" && parceiro.tenant_id) || tenantId,
      nome: typeof parceiro.nome === "string" ? parceiro.nome : "",
      telefone: typeof parceiro.telefone === "string" ? parceiro.telefone : null,
      especialidade:
        typeof parceiro.especialidade === "string" ? parceiro.especialidade : null,
      cidade: typeof parceiro.cidade === "string" ? parceiro.cidade : null,
      estado: typeof parceiro.estado === "string" ? parceiro.estado : null,
      // mercados é JSONB; supabase-js serializa o array nativamente.
      mercados: derivado.mercados,
      mercado_principal: derivado.mercado_principal,
      // status = espelho do parceiro (o motor filtra por status='homologado');
      // status_acesso = porta de homologação (menor privilégio do contrato puro).
      status: derivado.status,
      status_acesso: derivado.status_acesso,
      recebe_leads: parceiro.recebe_leads === true,
      total_leads_recebidos:
        typeof parceiro.total_leads_recebidos === "number"
          ? parceiro.total_leads_recebidos
          : null,
      status_financeiro:
        typeof parceiro.status_financeiro === "string"
          ? parceiro.status_financeiro
          : null,
    };

    const { error } = await supabase
      .from("hub_fornecedores")
      .upsert(row, { onConflict: "id" });
    if (error) {
      console.warn("[parceiros PATCH] sync espelho hub_fornecedores falhou:", error.message);
    }
  } catch (e) {
    console.warn("[parceiros PATCH] sync espelho hub_fornecedores exceção:", e);
  }
}
