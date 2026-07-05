import { crmDb as db, crmConfigError as configError } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { tenantScopeOrFilter } from "@/lib/tenant-default";
import {
  detectarParesDuplicados,
  type PessoaMergeRow,
} from "@/lib/crm/merge-pessoas";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";

const SELECT_COMPLETO =
  "id, codigo, nome, telefone, email, documento, tipo_pessoa, empresa, cidade, estado, cep, logradouro, numero, complemento, bairro, area_atuacao, origem, dados_extras, tenant_id, criado_em, arquivado_em";
// Fallback sem colunas de endereço/merge (ambiente sem migração aplicada).
const SELECT_CORE =
  "id, codigo, nome, telefone, email, documento, tipo_pessoa, empresa, cidade, estado, origem, dados_extras, tenant_id, criado_em";

/**
 * GET /api/crm/pessoas/duplicatas
 * Read-only, gestor/owner-only, tenant-scoped. Lista pares candidatos a duplicata
 * (mesmo documento OU telefone OU e-mail) no MESMO tenant. NÃO mescla nada.
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const err = configError();
  if (err) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: err },
      { status: 503 }
    );
  }

  const tenantId = g.ctx.tenantId;
  const supabase = db();

  // Carrega pessoas ativas do tenant (inclui legado sem tenant). Limite de
  // segurança: a detecção é O(n) por chave; 5000 cobre tenants atuais.
  async function carregar(select: string) {
    return supabase
      .from("hub_pessoas")
      .select(select)
      .or(tenantScopeOrFilter(tenantId))
      .order("criado_em", { ascending: true })
      .limit(5000);
  }

  let res = await carregar(SELECT_COMPLETO);
  if (res.error) {
    // schema sem colunas novas → tenta o core
    res = await carregar(SELECT_CORE);
  }
  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const linhas = ((res.data ?? []) as unknown as Record<string, unknown>[])
    // defesa extra: ignora arquivadas mesmo que a coluna exista
    .filter((p) => !p.arquivado_em) as unknown as PessoaMergeRow[];

  const pares = detectarParesDuplicados(linhas);

  return NextResponse.json({
    data: pares,
    total: pares.length,
    /** A tela usa isto para habilitar/desabilitar o botão "Mesclar". */
    mergeHabilitado: crmFeatureFlags.mergeDuplicatas(),
  });
}
