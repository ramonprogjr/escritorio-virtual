/**
 * E7 (Fase 2) — Árvore de ESCOPO da obra (a "planilha viva"): GET monta a árvore
 * ambiente → disciplina → item com custo/preço/avanço/peso + subtotais por nível + cockpit.
 *
 * SEGURANÇA (regra sistêmica E0/E2/E5/E6): crmDb() é service-role e BYPASSA RLS — o isolamento
 * depende 100% do filtro no código. Toda query filtra `.eq("tenant_id", g.ctx.tenantId)` PURO
 * (NUNCA `.or('...is.null')`) E `.eq("obra_id", obraId)`. A obra é validada por POSSE (404 se o
 * tenant não bate). tenant_id vem SEMPRE da sessão (requireCrm*), nunca do body.
 *
 * TOLERÂNCIA (design §7): as colunas/views E7 podem não existir ainda (migração na janela do dono).
 *   - views vw_hub_obra_item_margem/peso ausentes OU colunas de custo ausentes → cai no fallback
 *     que lê hub_obra_itens cru e calcula in-code (lib/obras/escopo.ts). Sem custo → preço/margem
 *     ficam "—"; `migracao_pendente: true` avisa a UI honestamente. A lente "avanço" funciona sempre.
 *   - tabela hub_obra_itens ausente (E2 pendente) → { ambientes: [], migracao_pendente: true }.
 *
 * SEM ESCRITA AQUI: criar/editar item reusa o POST/PATCH de ../itens (não duplica). Este GET é leitura.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { personaDaSessao } from "@/lib/obras/persona-escopo";
import {
  calcularItem,
  montarArvore,
  personaPodeVerCusto,
  personaPodeVerMargem,
  personaPodeVerPreco,
  type CockpitEscopo,
  type ItemEscopoCalc,
  type ItemEscopoInput,
  type NoAmbiente,
  type PersonaEscopo,
  type SubtotalGrupo,
} from "@/lib/obras/escopo";

type Params = { params: Promise<{ id: string }> };

const AVISO_E2 = "Itens & escopo ainda não ativos (migração E2 pendente — janela do dono).";
const AVISO_E7 =
  "Custo/preço/margem ficam disponíveis após aplicar a migração E7 (janela do dono). O avanço já funciona.";

/** Tabela/relação ausente (vs. coluna ausente, tratado à parte). */
function ehRelacaoAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return /relation .*does not exist/i.test(error.message ?? "");
}

/** Colunas E7 (custo/bdi) — presentes só após a migração E7. */
const COLS_E7 =
  "custo_locacao_frete, custo_material, custo_mao_obra, bdi_fator";
/** Base sempre presente (E2). */
const COLS_BASE =
  "id, parent_id, ambiente, disciplina_slug, nome, codigo, quantidade, unidade, pct_avanco, tipo, ativo";

async function assertObraDoTenant(
  obraId: string,
  tenantId: string
): Promise<{ bdi: number | null } | { erro: NextResponse }> {
  const { data } = await crmDb()
    .from("hub_obras")
    .select("id, tenant_id, bdi_fator")
    .eq("id", obraId)
    .maybeSingle();
  if (!data || data.tenant_id !== tenantId) {
    return { erro: NextResponse.json({ error: "Obra não encontrada" }, { status: 404 }) };
  }
  // bdi_fator pode não existir antes de E7 → trata como null (a leitura cai p/ 1.0 neutro).
  const bdi =
    typeof (data as Record<string, unknown>).bdi_fator === "number"
      ? ((data as Record<string, unknown>).bdi_fator as number)
      : null;
  return { bdi };
}

export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const obra = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if ("erro" in obra) return obra.erro;

  // PERSONA derivada do PAPEL da sessão (server-side, não do cliente). Controla a defesa em
  // profundidade do payload abaixo E é devolvida para a UI usar a lente/visibilidade certas.
  const persona = personaDaSessao(g.ctx.role);

  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();

  // ── Leitura tolerante: tenta com as colunas E7; se faltarem, repete só com a base (E2). ──
  // O cast por `unknown` mantém um único tipo de linha (Record) entre as duas tentativas — o
  // PostgREST infere shapes diferentes por select, e a forma é normalizada em runtime abaixo.
  let migracaoPendente = false;
  let comE7 = true;
  let resp = (await supabase
    .from("hub_obra_itens")
    .select(`${COLS_BASE}, ${COLS_E7}`)
    .eq("obra_id", obraId)
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(2000)) as { data: Array<Record<string, unknown>> | null; error: { message?: string; code?: string } | null };

  if (
    resp.error &&
    (isMissingPgColumn(resp.error, "custo_locacao_frete") ||
      isMissingPgColumn(resp.error, "custo_material") ||
      isMissingPgColumn(resp.error, "custo_mao_obra") ||
      isMissingPgColumn(resp.error, "bdi_fator") ||
      isMissingPgColumn(resp.error)) &&
    !ehRelacaoAusente(resp.error)
  ) {
    comE7 = false;
    migracaoPendente = true;
    resp = (await supabase
      .from("hub_obra_itens")
      .select(COLS_BASE)
      .eq("obra_id", obraId)
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .limit(2000)) as { data: Array<Record<string, unknown>> | null; error: { message?: string; code?: string } | null };
  }
  const { data, error } = resp;

  if (error) {
    if (ehRelacaoAusente(error)) {
      return NextResponse.json({
        migracao_pendente: true,
        aviso: AVISO_E2,
        persona,
        bdi_obra: obra.bdi ?? 1.0,
        ambientes: [],
        cockpit: { total_orcado: 0, custo: 0, margem_pct: null, avanco: 0, itens: 0 },
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  // Normaliza cada linha em ItemEscopoInput; sem E7 os custos vêm undefined (preço/margem = "—").
  const itensInput: ItemEscopoInput[] = rows.map((r) => ({
    id: String(r.id),
    parent_id: (r.parent_id as string | null) ?? null,
    ambiente: (r.ambiente as string | null) ?? null,
    disciplina_slug: (r.disciplina_slug as string | null) ?? null,
    nome: (r.nome as string | null) ?? null,
    codigo: (r.codigo as string | null) ?? null,
    quantidade: numOrNull(r.quantidade),
    unidade: (r.unidade as string | null) ?? null,
    pct_avanco: numOrNull(r.pct_avanco),
    custo_locacao_frete: comE7 ? numOrNull(r.custo_locacao_frete) : null,
    custo_material: comE7 ? numOrNull(r.custo_material) : null,
    custo_mao_obra: comE7 ? numOrNull(r.custo_mao_obra) : null,
    bdi_fator: comE7 ? numOrNull(r.bdi_fator) : null,
  }));

  const obraBdi = obra.bdi ?? 1.0;
  const itensCalc: ItemEscopoCalc[] = itensInput.map((it) => calcularItem(it, obraBdi));
  const arvore = montarArvore(itensCalc);

  // DEFESA EM PROFUNDIDADE (bloqueador 3): mesmo que o cliente tentasse exibir, o servidor NÃO
  // devolve a faixa-dinheiro que a persona não pode ver. Arquiteto não vê custo/preço/margem;
  // prestador vê preço mas nunca custo/margem. (executor|hub veem tudo.) Sanitiza antes de enviar.
  const { ambientes, cockpit } = sanitizarPorPersona(arvore.ambientes, arvore.cockpit, persona);

  return NextResponse.json({
    migracao_pendente: migracaoPendente,
    aviso: migracaoPendente ? AVISO_E7 : null,
    persona,
    bdi_obra: obraBdi,
    ambientes,
    cockpit,
  });
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Defesa em profundidade: zera os campos de dinheiro que a `persona` não pode ver, em TODOS os
 * níveis (item → disciplina → ambiente → cockpit), antes de o payload sair do servidor.
 *  - custo (custo_total / subtotal.custo / cockpit.custo) → só executor|hub.
 *  - margem (margem_pct em todos os níveis)               → só executor|hub.
 *  - preço (preco_total / subtotal.preco / total_orcado)  → todos menos arquiteto.
 * Avanço é sempre liberado (não é faixa-dinheiro). Mantém a forma do objeto (não remove chaves)
 * para a UI não quebrar: o que a persona não pode ver vira null → a UI já renderiza "—".
 */
function sanitizarPorPersona(
  ambientes: NoAmbiente[],
  cockpit: CockpitEscopo,
  persona: PersonaEscopo
): { ambientes: NoAmbiente[]; cockpit: CockpitEscopo } {
  const verCusto = personaPodeVerCusto(persona);
  const verMargem = personaPodeVerMargem(persona);
  const verPreco = personaPodeVerPreco(persona);

  // executor|hub veem tudo → atalho sem custo de cópia.
  if (verCusto && verMargem && verPreco) return { ambientes, cockpit };

  const limparItem = (it: ItemEscopoCalc): ItemEscopoCalc => ({
    ...it,
    ...(verCusto ? {} : { custo_locacao_frete: null, custo_material: null, custo_mao_obra: null, custo_unitario: 0, custo_total: null }),
    ...(verPreco ? {} : { preco_unitario: 0, preco_total: null }),
    ...(verMargem ? {} : { margem_pct: null }),
  });

  const limparSubtotal = (s: SubtotalGrupo): SubtotalGrupo => ({
    ...s,
    custo: verCusto ? s.custo : 0,
    preco: verPreco ? s.preco : 0,
    margem_pct: verMargem ? s.margem_pct : null,
  });

  const ambientesLimpos: NoAmbiente[] = ambientes.map((amb) => ({
    ...amb,
    subtotal: limparSubtotal(amb.subtotal),
    disciplinas: amb.disciplinas.map((d) => ({
      ...d,
      subtotal: limparSubtotal(d.subtotal),
      itens: d.itens.map(limparItem),
    })),
  }));

  const cockpitLimpo: CockpitEscopo = {
    ...cockpit,
    custo: verCusto ? cockpit.custo : 0,
    total_orcado: verPreco ? cockpit.total_orcado : 0,
    margem_pct: verMargem ? cockpit.margem_pct : null,
  };

  return { ambientes: ambientesLimpos, cockpit: cockpitLimpo };
}
