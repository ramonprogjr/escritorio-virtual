import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { gerarCodigoParceiro } from "@/lib/crm/parceiro-cadastro";
import {
  insertParceiroCaptacaoCompat,
  insertParceiroCompat,
  insertParceiroLogCompat,
} from "@/lib/crm/parceiro-compat";

/**
 * Cadastro MANUAL INTERNO de parceiro (comercial+). Espelha /api/crm/especialistas:
 * sessão obrigatória, tenant SEMPRE da sessão, comissão travada no server e dedup
 * tenant-scoped que NÃO vaza id/código/NOME de outra empresa.
 *
 * NÃO confundir com /api/parceiros POST (captação PÚBLICA HUB-only). Esta rota exige
 * sessão com papel comercial, entra direto na aba Captação e grava a trilha de auditoria
 * de QUEM cadastrou (feito_por = sessão, não falsificável) — rastreável pelo código único.
 */

// A comissão do parceiro é decisão do Hub, nunca do formulário → travada no server.
const COMISSAO_PADRAO_PCT = 5;

function digits(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

function texto(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

// cpf/cnpj têm UNIQUE GLOBAL no banco (não por tenant). Um conflito com registo de
// OUTRO tenant não aparece no dedup tenant-scoped, mas estoura no insert → traduzir
// para 409 genérico, sem revelar de quem é o cadastro (código 23505 / duplicate key).
function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    String(err.code || "") === "23505" ||
    /duplicate key|already exists|unique constraint/i.test(String(err.message || ""))
  );
}

// Mesma frase para colisão no MESMO tenant OU no UNIQUE global (23505) — não revela a
// fronteira de tenant a um comercial autenticado (sem "oráculo" de existência cross-tenant).
function msgDuplicado(field: "cpf" | "cnpj"): string {
  return `Já existe um parceiro com este ${field.toUpperCase()} na rede.`;
}

// Dedup RESTRITO ao tenant da sessão com `.eq('tenant_id')` PURO (nunca `.or(is.null)`):
// não casa registo legado tenant-NULL nem de outro tenant, então o 409 jamais revela o
// NOME de um parceiro de outra empresa. Se o documento existir só em outro tenant, o dedup
// não acha, o insert segue e o UNIQUE global dispara → 409 genérico ("...na rede.").
async function existeNoTenant(
  field: "cpf" | "cnpj",
  value: string,
  tenantId: string
): Promise<boolean> {
  const { data } = await crmDb()
    .from("hub_parceiros")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq(field, value)
    .maybeSingle();
  return !!data;
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(body.nome || "").trim();
  const telefone = digits(body.telefone);
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (telefone.length < 10)
    return NextResponse.json({ error: "Telefone com DDD obrigatório" }, { status: 400 });

  const tenantId = g.ctx.tenantId;
  const cpf = digits(body.cpf) || null;
  const cnpj = digits(body.cnpj) || null;

  // Dedup tenant-scoped → 409 genérico (MESMA frase do UNIQUE global; sem id/código/nome).
  if (cpf && (await existeNoTenant("cpf", cpf, tenantId)))
    return NextResponse.json({ error: msgDuplicado("cpf") }, { status: 409 });
  if (cnpj && (await existeNoTenant("cnpj", cnpj, tenantId)))
    return NextResponse.json({ error: msgDuplicado("cnpj") }, { status: 409 });

  const codigo = await gerarCodigoParceiro(crmDb());

  const { data: parceiro, error } = await insertParceiroCompat(
    crmDb(),
    {
      codigo,
      nome,
      telefone,
      email: texto(body.email),
      cpf,
      cnpj,
      especialidade: texto(body.especialidade),
      mercado: texto(body.mercado),
      cidade: texto(body.cidade),
      estado: texto(body.estado),
      comissao_pct: COMISSAO_PADRAO_PCT, // travado no server — jamais do body
      status: "captacao",
    },
    tenantId
  );

  if (error || !parceiro) {
    // unique global de cpf/cnpj (registo de OUTRO tenant) → MESMA frase do dedup
    // tenant-scoped (sem oráculo de fronteira de tenant), sem vazar de quem.
    if (isUniqueViolation(error)) {
      const campo = cpf && !cnpj ? "cpf" : cnpj && !cpf ? "cnpj" : null;
      return NextResponse.json(
        { error: campo ? msgDuplicado(campo) : "Já existe um parceiro com este CPF/CNPJ na rede." },
        { status: 409 }
      );
    }
    // 500 genérico: não expõe texto de erro do Postgres (schema/constraints) ao cliente.
    console.error("[crm/parceiros] falha ao gravar parceiro:", error?.message || error);
    return NextResponse.json(
      { error: "Erro ao cadastrar parceiro. Tente novamente." },
      { status: 500 }
    );
  }

  // Estágio de captação + trilha de auditoria de QUEM cadastrou (sessão, não forjável).
  // Warnings de schema drift não derrubam o cadastro já gravado, mas são logados no
  // servidor — a atribuição do "quem cadastrou" nunca some em silêncio.
  const captacaoWarn = await insertParceiroCaptacaoCompat(crmDb(), {
    parceiro_id: parceiro.id,
    estagio: "interessado",
    origem: "manual",
  });
  const logWarn = await insertParceiroLogCompat(crmDb(), {
    parceiro_id: parceiro.id,
    evento: "parceiro_cadastrado",
    descricao: `Parceiro ${nome} cadastrado manualmente`,
    feito_por: g.ctx.userId,
    feito_por_tipo: "usuario",
    dados: { cadastrado_por: g.ctx.userId, origem: "manual", tenant_id: tenantId },
  });
  if (captacaoWarn || logWarn) {
    console.warn(
      "[crm/parceiros] cadastro gravado com schema-drift em tabelas auxiliares:",
      [captacaoWarn, logWarn].filter(Boolean).join(" | ")
    );
  }

  return NextResponse.json(
    { data: { id: parceiro.id, codigo: parceiro.codigo ?? codigo, nome } },
    { status: 201 }
  );
}
