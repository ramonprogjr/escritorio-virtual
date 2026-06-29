/**
 * `criarObraComEAP()` — lógica compartilhada de criação de obra + EAP do preset.
 *
 * EXTRAÍDA do POST /api/crm/obras (E0) no Bloco A2, SEM mudar comportamento. Centraliza:
 *  - idempotência leve anti double-tap (titulo+tenant em <60s);
 *  - código atômico por tenant (gerarCodigoObra) + retry-once no UNIQUE (23505);
 *  - tolerância à migração E0 não aplicada (insere subconjunto legado → obra sem EAP + aviso);
 *  - EAP do preset com seleção opcional de disciplinas (frentes_selecionadas).
 *
 * Reusada por:
 *  - POST /api/crm/obras (criação direta — comportamento preservado);
 *  - POST /api/crm/projetos/[id]/gerar-obra (A2 — orquestrador do elo projeto→obra).
 *
 * REGRA TENANT: o `tenantId` é SEMPRE do caller (a rota o resolve da sessão), nunca do body.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingPgColumn } from "@/lib/tenant-default";
import {
  gerarCodigoObra,
  getPresetPorTipo,
  getPresetPorSegmento,
  frentesDoPresetParaInsert,
  TIPOS_OBRA,
  type EapPreset,
} from "@/lib/obras/eap-presets";
import { isSegmentoValido, taxonomiaPorCodigo } from "@/lib/obras/taxonomia";
import { codigoItemFromNome } from "@/lib/obras/itens-situacao";

const TIPOS_VALIDOS = new Set<string>(TIPOS_OBRA.map((t) => t.slug));

/** Colunas E0 (existem só após a migração). O retorno cai para o legado se faltarem. */
export const SELECT_OBRA_E0 =
  "id, codigo, codigo_legivel, titulo, tipo_obra, status, estagio_slug, cliente_pessoa_id, cliente_empresa_id, cidade, estado, area_total_m2, valor_contrato, data_inicio, negocio_id, criado_em";
export const SELECT_OBRA_LEGADO =
  "id, codigo, titulo, status, cidade, estado, data_inicio, negocio_id, criado_em";

export type CriarObraInput = {
  titulo: string;
  tipo_obra?: string | null;
  /** E0.5 (aditivo, opcional): segmento → usa o preset por segmento (ambiente-first). */
  segmento?: string | null;
  negocio_id?: string | null;
  imovel_id?: string | null;
  cliente_pessoa_id?: string | null;
  cliente_empresa_id?: string | null;
  status?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  area_total_m2?: number | null;
  valor_contrato?: number | null;
  /** disciplina_slugs marcados no passo 3 (Click-and-Go); ausente/vazio = cria TODAS. */
  frentes_selecionadas?: unknown;
};

export type CriarObraResultado = {
  ok: true;
  obra: Record<string, unknown>;
  frentes_criadas: number;
  /** E0.5: itens semeados por ambiente quando a obra nasce de um preset por segmento. */
  itens_criados?: number;
  aviso: string | null;
  /** true se a obra reaproveitou uma criada nos últimos 60s (anti double-tap). */
  idempotente: boolean;
} | {
  ok: false;
  erro: string;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * E0.5 — Semeia os ITENS de um preset por segmento, distribuídos por AMBIENTE.
 *
 * Para cada frente (com `ambientes`), cada ambiente, cada `atividade_default`, cria um item
 * de contrato com: nome/descrição/unidade/qtd vindos da taxonomia (in-code), `ambiente` desnorm,
 * `disciplina_slug` da frente, `frente_id` mapeado, e `taxonomia_id` resolvido por código
 * (best-effort — null se a taxonomia ainda não foi semeada / migração E0.5 pendente).
 *
 * TOLERÂNCIA: se `hub_obra_itens` não tem as colunas E0.5 (ambiente/taxonomia_id), repete o
 * insert SEM esses campos (o item nasce sem ambiente, mas nasce). Se a tabela inteira faltar,
 * devolve 0 sem lançar. NUNCA bloqueia a criação da obra (best-effort puro).
 *
 * Respeita `frentes_selecionadas` (selecSet): só semeia itens de disciplinas marcadas no wizard.
 */
async function semearItensPorAmbiente(
  supabase: SupabaseClient,
  preset: EapPreset,
  obraId: string,
  tenantId: string,
  frentesInseridas: Array<{ id: string; disciplina_slug: string | null }>,
  selecSet: Set<string> | null
): Promise<number> {
  // Mapa disciplina_slug → frente_id (a 1ª frente daquela disciplina; preset de segmento tem 1 por disc).
  const frentePorDisc = new Map<string, string>();
  for (const f of frentesInseridas) {
    if (f.disciplina_slug && !frentePorDisc.has(f.disciplina_slug)) {
      frentePorDisc.set(f.disciplina_slug, f.id);
    }
  }

  // Resolve taxonomia_id por código (best-effort). Se a tabela não existe, segue com mapa vazio.
  const codigosTax = new Set<string>();
  for (const fr of preset.frentes) {
    for (const amb of fr.ambientes ?? []) {
      for (const a of amb.atividades_default) codigosTax.add(a.codigo);
    }
  }
  const taxIdPorCodigo = new Map<string, string>();
  if (codigosTax.size > 0) {
    const { data: taxRows } = await supabase
      .from("hub_obra_taxonomia")
      .select("id, codigo")
      .in("codigo", [...codigosTax])
      // taxonomia: tenant OU global (NULL=global legítimo); fecha o ponteiro FK cross-tenant
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    for (const r of (taxRows ?? []) as Array<{ id: string; codigo: string }>) {
      taxIdPorCodigo.set(r.codigo, r.id);
    }
  }

  // Monta as linhas de item (com código único na obra).
  const usados = new Set<string>();
  const linhas: Array<Record<string, unknown>> = [];
  let ordem = 0;
  for (const fr of preset.frentes) {
    if (selecSet && selecSet.size > 0 && !selecSet.has(fr.disciplina_slug)) continue;
    const frenteId = frentePorDisc.get(fr.disciplina_slug) ?? null;
    for (const amb of fr.ambientes ?? []) {
      for (const a of amb.atividades_default) {
        const tax = taxonomiaPorCodigo(a.codigo);
        const nome = tax?.nome ?? a.codigo;
        let codigo = codigoItemFromNome(`${amb.codigo} ${nome}`, fr.disciplina_slug.slice(0, 4));
        const base = codigo;
        let n = 2;
        while (usados.has(codigo)) {
          codigo = `${base}-${n}`;
          n += 1;
        }
        usados.add(codigo);
        linhas.push({
          obra_id: obraId,
          tenant_id: tenantId,
          frente_id: frenteId,
          codigo,
          nome,
          descricao: tax?.descricao_padrao ?? null,
          disciplina_slug: fr.disciplina_slug,
          ambiente: amb.codigo.toLowerCase(),
          taxonomia_id: taxIdPorCodigo.get(a.codigo) ?? null,
          unidade: tax?.unidade ?? null,
          quantidade: a.qtd ?? tax?.qtd_padrao ?? null,
          tipo: "contrato",
          andamento: "nao_iniciado",
          origem: "ia", // veio do preset/IA, não digitado à mão
          ordem: ordem++,
        });
      }
    }
  }

  if (linhas.length === 0) return 0;

  // Insert com os campos E0.5; retry sem ambiente/taxonomia_id se a coluna não existe.
  let { error } = await supabase.from("hub_obra_itens").insert(linhas);
  if (error && (isMissingPgColumn(error, "ambiente") || isMissingPgColumn(error, "taxonomia_id"))) {
    const semE0b = linhas.map(({ ambiente: _a, taxonomia_id: _t, ...rest }) => {
      void _a;
      void _t;
      return rest;
    });
    ({ error } = await supabase.from("hub_obra_itens").insert(semE0b));
  }
  if (error) return 0; // tabela ausente ou outro erro → best-effort, não bloqueia a obra
  return linhas.length;
}

/**
 * Cria a obra (código atômico por tenant) e monta a EAP do preset do tipo.
 * Tolerante: degrada para a linha legada se a migração E0 não estiver aplicada.
 * Idempotente: reaproveita obra com mesmo titulo+tenant criada em <60s.
 */
export async function criarObraComEAP(
  supabase: SupabaseClient,
  tenantId: string,
  input: CriarObraInput
): Promise<CriarObraResultado> {
  const titulo = String(input.titulo || "").trim();
  if (!titulo) return { ok: false, erro: "Título obrigatório" };

  const tipoObra =
    typeof input.tipo_obra === "string" && TIPOS_VALIDOS.has(input.tipo_obra)
      ? input.tipo_obra
      : "reforma";

  // Idempotência leve (anti double-tap): mesma obra (titulo+tenant) criada nos últimos 60s.
  {
    const desde = new Date(Date.now() - 60_000).toISOString();
    const { data: recente } = await supabase
      .from("hub_obras")
      .select(SELECT_OBRA_E0)
      .eq("tenant_id", tenantId)
      .eq("titulo", titulo)
      .gte("criado_em", desde)
      .limit(1)
      .maybeSingle();
    if (recente && (recente as Record<string, unknown>).id) {
      return {
        ok: true,
        obra: recente as Record<string, unknown>,
        frentes_criadas: 0,
        aviso: null,
        idempotente: true,
      };
    }
  }

  // Código ATÔMICO e POR TENANT (a RPC não vaza contagem entre tenants).
  const codigo = await gerarCodigoObra(supabase, tenantId, tipoObra);

  // E0.5: segmento opcional → escolhe o preset por segmento (ambiente-first) quando válido.
  const segmento = isSegmentoValido(input.segmento) ? input.segmento : null;
  const presetSegmento: EapPreset | undefined = segmento ? getPresetPorSegmento(segmento) : undefined;

  const rowE0: Record<string, unknown> = {
    codigo,
    codigo_legivel: codigo,
    titulo,
    tipo_obra: tipoObra,
    ...(segmento ? { segmento } : {}), // só inclui se houver (coluna E0.5; retry abaixo se faltar)
    negocio_id: input.negocio_id || null,
    imovel_id: input.imovel_id || null,
    cliente_pessoa_id: input.cliente_pessoa_id || null,
    cliente_empresa_id: input.cliente_empresa_id || null,
    status: typeof input.status === "string" ? input.status : "planejamento",
    estagio_slug: "planejamento",
    endereco: input.endereco || null,
    cidade: input.cidade || null,
    estado: input.estado || null,
    area_total_m2: num(input.area_total_m2),
    valor_contrato: num(input.valor_contrato),
    tenant_id: tenantId,
  };

  let obra: Record<string, unknown> | null = null;
  let insErr: { message?: string; code?: string } | null = null;
  // rowAtivo evolui conforme os retries (ex.: cai o `segmento` se a coluna E0.5 não existe).
  let rowAtivo: Record<string, unknown> = rowE0;

  {
    const { data, error } = await supabase.from("hub_obras").insert(rowAtivo).select(SELECT_OBRA_E0).single();
    obra = data as Record<string, unknown> | null;
    insErr = error;
  }

  // E0.5: se a coluna `segmento` não existe (migração E0.5 pendente), repete SEM ela. Não pode
  // cair no fallback legado abaixo (que descarta tipo_obra etc.) por causa de uma coluna aditiva.
  if (insErr && segmento && isMissingPgColumn(insErr, "segmento")) {
    const { segmento: _drop, ...rowSemSegmento } = rowAtivo;
    void _drop;
    rowAtivo = rowSemSegmento;
    const { data, error } = await supabase
      .from("hub_obras")
      .insert(rowAtivo)
      .select(SELECT_OBRA_E0)
      .single();
    obra = data as Record<string, unknown> | null;
    insErr = error;
  }

  // Retry-once em corrida do UNIQUE (tenant_id, codigo_legivel): o fallback do gerador não é
  // atômico (só a RPC gerar_codigo_obra é). Em 23505, regeneramos o código e tentamos 1× mais.
  if (insErr?.code === "23505") {
    const codigoRetry = await gerarCodigoObra(supabase, tenantId, tipoObra);
    const { data, error } = await supabase
      .from("hub_obras")
      .insert({ ...rowAtivo, codigo: codigoRetry, codigo_legivel: codigoRetry })
      .select(SELECT_OBRA_E0)
      .single();
    obra = data as Record<string, unknown> | null;
    insErr = error;
  }

  // Tolerância: colunas E0 ausentes → insere o subconjunto legado (obra nasce sem EAP).
  let migracaoPendente = false;
  if (insErr && isMissingPgColumn(insErr)) {
    migracaoPendente = true;
    const rowLegado = {
      codigo,
      titulo,
      negocio_id: input.negocio_id || null,
      imovel_id: input.imovel_id || null,
      status: typeof input.status === "string" ? input.status : "planejamento",
      endereco: input.endereco || null,
      cidade: input.cidade || null,
      estado: input.estado || null,
      tenant_id: tenantId,
    };
    const { data, error } = await supabase
      .from("hub_obras")
      .insert(rowLegado)
      .select(SELECT_OBRA_LEGADO)
      .single();
    obra = data as Record<string, unknown> | null;
    insErr = error;
  }

  if (insErr) return { ok: false, erro: insErr.message || "Falha ao criar obra." };
  if (!obra?.id) return { ok: false, erro: "Falha ao criar obra." };

  // Monta a EAP do preset (se a migração estiver aplicada). Best-effort: a obra já existe;
  // se a tabela de frentes não existir ainda, devolvemos a obra + aviso (UI degrada).
  let frentesCriadas = 0;
  let itensCriados = 0;
  let avisoEap: string | null = null;

  if (!migracaoPendente) {
    // E0.5: com segmento válido, usa o preset por segmento (ambiente-first); senão o genérico do tipo.
    const preset = presetSegmento ?? getPresetPorTipo(tipoObra);
    if (preset) {
      const todasLinhas = frentesDoPresetParaInsert(preset, String(obra.id), tenantId);
      // Click-and-Go: honra a seleção do passo 3. `frentes_selecionadas` = disciplina_slugs marcados.
      // Guard: se vier ausente/vazio/não-array, criamos TODAS (comportamento original, tolerante).
      const selecRaw = input.frentes_selecionadas;
      const selecSet =
        Array.isArray(selecRaw) && selecRaw.length > 0
          ? new Set(selecRaw.filter((s): s is string => typeof s === "string"))
          : null;
      const filtradas =
        selecSet && selecSet.size > 0
          ? todasLinhas.filter((l) => selecSet.has(String(l.disciplina_slug)))
          : todasLinhas;
      // Se a seleção não casar com nenhuma linha, mantém todas (nunca cria obra sem EAP).
      const linhas = filtradas.length > 0 ? filtradas : todasLinhas;
      // Captura os ids das frentes (p/ ligar os itens por ambiente quando há preset de segmento).
      const { data: frentesInseridas, error: eapErr } = await supabase
        .from("hub_obra_frentes_eap")
        .insert(linhas)
        .select("id, disciplina_slug");
      if (eapErr) {
        avisoEap = "Obra criada; as frentes da EAP precisam da migração E0 aplicada.";
      } else {
        frentesCriadas = linhas.length;
        // E0.5: se o preset é por segmento, semeia os ITENS por ambiente (best-effort, tolerante).
        if (presetSegmento) {
          itensCriados = await semearItensPorAmbiente(
            supabase,
            preset,
            String(obra.id),
            tenantId,
            (frentesInseridas ?? []) as Array<{ id: string; disciplina_slug: string | null }>,
            selecSet
          );
        }
      }
    } else {
      avisoEap = "Tipo sem preset — adicione frentes manualmente na EAP.";
    }
  } else {
    avisoEap = "Personalização de frentes ainda não ativa (migração E0 pendente).";
  }

  return {
    ok: true,
    obra,
    frentes_criadas: frentesCriadas,
    itens_criados: itensCriados,
    aviso: avisoEap,
    idempotente: false,
  };
}
