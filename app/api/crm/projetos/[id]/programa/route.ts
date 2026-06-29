import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SELECT_A0 =
  "id, projeto_id, nome, ordem, status, tipo, categoria, metragem_m2, observacao, aprovacao_status, entregavel_url";
const SELECT_LEGADO = "id, projeto_id, nome, ordem, status";

/** Confirma que o projeto é do tenant do caller (match estrito por tenant). */
async function projetoDoTenant(
  supabase: ReturnType<typeof crmDb>,
  projetoId: string,
  tenantId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("hub_projetos")
    .select("id")
    .eq("id", projetoId)
    // AUDITORIA-FIX (vazamento legado): só o projeto do tenant do caller. Fecha
    // a leitura E o POST de cômodos em projeto órfão/de outro tenant.
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const supabase = crmDb();
  if (!(await projetoDoTenant(supabase, id, g.ctx.tenantId))) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  // tipo: 'comodo' (Programa) | 'fase' (Entregáveis). Sem filtro = todos.
  const tipo = request.nextUrl.searchParams.get("tipo");

  async function buscar(select: string, comTipo: boolean) {
    let q = supabase
      .from("hub_projetos_fases")
      .select(select)
      .eq("projeto_id", id)
      .order("ordem", { ascending: true });
    if (comTipo && tipo) q = q.eq("tipo", tipo);
    return q;
  }

  let { data, error } = await buscar(SELECT_A0, true);
  if (error && isMissingPgColumn(error)) ({ data, error } = await buscar(SELECT_LEGADO, false));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;
  if (!(await projetoDoTenant(supabase, id, tenantId))) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Aceita { itens: [...] } (array de cômodos) ou um único item no corpo.
  const brutos: unknown[] = Array.isArray(body.itens)
    ? body.itens
    : Array.isArray(body)
      ? (body as unknown[])
      : [body];

  const tipo = typeof body.tipo === "string" && body.tipo.trim() ? body.tipo.trim() : "comodo";

  // Próxima ordem (continua de onde está).
  const { data: existentes } = await supabase
    .from("hub_projetos_fases")
    .select("ordem")
    .eq("projeto_id", id);
  let ordem = (existentes ?? []).reduce((m, r) => Math.max(m, Number(r.ordem ?? 0)), -1) + 1;

  const linhasA0: Record<string, unknown>[] = [];
  for (const raw of brutos) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    const nome = typeof o.nome === "string" ? o.nome.trim() : "";
    if (!nome) continue;
    const metragem =
      typeof o.metragem_m2 === "number" && Number.isFinite(o.metragem_m2)
        ? o.metragem_m2
        : typeof o.metragem_m2 === "string" && o.metragem_m2.trim() && !Number.isNaN(Number(o.metragem_m2))
          ? Number(o.metragem_m2)
          : null;
    linhasA0.push({
      projeto_id: id,
      tenant_id: tenantId,
      nome: nome.slice(0, 200),
      ordem: ordem++,
      status: "pendente",
      tipo,
      categoria: typeof o.categoria === "string" && o.categoria.trim() ? o.categoria.trim() : null,
      metragem_m2: metragem,
      observacao: typeof o.observacao === "string" && o.observacao.trim() ? o.observacao.trim().slice(0, 2000) : null,
    });
  }

  if (linhasA0.length === 0) {
    return NextResponse.json({ error: "Nenhum item válido (informe ao menos um nome)." }, { status: 400 });
  }

  let { data, error } = await supabase.from("hub_projetos_fases").insert(linhasA0).select(SELECT_A0);

  // Tolerância: colunas A0 (tipo/categoria/…) ausentes → insere o subconjunto legado.
  if (error && isMissingPgColumn(error)) {
    const linhasLegado = linhasA0.map((l) => ({
      projeto_id: l.projeto_id,
      tenant_id: l.tenant_id,
      nome: l.nome,
      ordem: l.ordem,
      status: l.status,
    }));
    ({ data, error } = await supabase.from("hub_projetos_fases").insert(linhasLegado).select(SELECT_LEGADO));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], criados: (data ?? []).length }, { status: 201 });
}
