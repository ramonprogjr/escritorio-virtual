import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { registrarLogCrm } from "@/lib/crm/audit-log";
import { isMissingPgColumn, tenantScopeOrFilter } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

const FULL =
  "id, codigo, nome, tipo_pessoa, cnpj, cpf, email, telefone, area_atuacao, especialidade, mercados, mercado_principal, regiao, cidade, estado, status_acesso, recebe_leads, bio, instagram, site, comissao_pct, criado_em, atualizado_em";

const EDITAVEIS = [
  "nome",
  "tipo_pessoa",
  "cnpj",
  "cpf",
  "email",
  "telefone",
  "area_atuacao",
  "especialidade",
  "mercados",
  "regiao",
  "cidade",
  "estado",
  "status_acesso",
  "recebe_leads",
  "bio",
  "instagram",
  "site",
  "comissao_pct",
] as const;

export async function GET(_request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const { data, error } = await crmDb().from("hub_fornecedores").select(FULL).eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // Gestor-only (owner ou gestor) — espelha o PATCH de parceiro. `comissao_pct` está
  // na whitelist EDITAVEIS e alimenta o split de comissão (caminho do dinheiro): editar
  // sem auth deixava qualquer um, em qualquer tenant, mexer no percentual.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { id } = await params;
  // Tenant SEMPRE da sessão (g.ctx), NUNCA do header forjável — espelha o PATCH de parceiro.
  const tenantId = g.ctx.tenantId;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.nome === "string" && !body.nome.trim()) {
    return NextResponse.json({ error: "Nome não pode ficar vazio" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const k of EDITAVEIS) {
    if (k in body) {
      if (k === "mercados") {
        const arr = Array.isArray(body.mercados) ? body.mercados : null;
        patch.mercados = arr;
        if (arr && arr.length) patch.mercado_principal = String(arr[0]);
      } else {
        patch[k] = body[k];
      }
    }
  }

  const supabase = crmDb();

  // Estado anterior da comissão (para auditoria de mudança). Best-effort: se a leitura
  // falhar, segue sem o valor antigo no log — nunca derruba o PATCH.
  let comissaoAnterior: number | null = null;
  if ("comissao_pct" in patch) {
    const { data: prev } = await supabase
      .from("hub_fornecedores")
      .select("comissao_pct")
      .eq("id", id)
      .maybeSingle();
    if (prev && typeof (prev as { comissao_pct?: unknown }).comissao_pct === "number") {
      comissaoAnterior = (prev as { comissao_pct: number }).comissao_pct;
    }
  }

  // Update com escopo de tenant: id + (tenant atual / legado / null). Fallback sem o
  // filtro `.or` se a coluna tenant_id ainda não existir no schema (padrão das irmãs).
  const runUpdate = (withTenantFilter: boolean) => {
    let query = supabase.from("hub_fornecedores").update(patch).eq("id", id);
    if (withTenantFilter) {
      query = query.or(tenantScopeOrFilter(tenantId));
    }
    return query.select(FULL).maybeSingle();
  };

  let { data, error } = await runUpdate(true);
  if (error && isMissingPgColumn(error, "tenant_id")) {
    ({ data, error } = await runUpdate(false));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    // Sem linha: ou não existe, ou está fora do escopo de tenant do operador.
    return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
  }

  // Auditoria da comissão (caminho do dinheiro). Só registra quando o valor MUDOU de fato.
  // Falha de log não derruba o PATCH (best-effort, padrão das rotas irmãs).
  if ("comissao_pct" in patch) {
    const comissaoNova =
      typeof (data as { comissao_pct?: unknown }).comissao_pct === "number"
        ? (data as { comissao_pct: number }).comissao_pct
        : null;
    if (comissaoNova !== comissaoAnterior) {
      await registrarLogCrm(supabase, {
        entidade: "fornecedor",
        entidade_id: id,
        acao: "comissao_alterada",
        valor_anterior: comissaoAnterior != null ? String(comissaoAnterior) : null,
        valor_novo: comissaoNova != null ? String(comissaoNova) : null,
        usuario_id: g.ctx.userId,
        tenant_id: tenantId,
      });
    }
  }

  return NextResponse.json({ data });
}
