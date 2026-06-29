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
  frentesDoPresetParaInsert,
  TIPOS_OBRA,
} from "@/lib/obras/eap-presets";

const TIPOS_VALIDOS = new Set<string>(TIPOS_OBRA.map((t) => t.slug));

/** Colunas E0 (existem só após a migração). O retorno cai para o legado se faltarem. */
export const SELECT_OBRA_E0 =
  "id, codigo, codigo_legivel, titulo, tipo_obra, status, estagio_slug, cliente_pessoa_id, cliente_empresa_id, cidade, estado, area_total_m2, valor_contrato, data_inicio, negocio_id, criado_em";
export const SELECT_OBRA_LEGADO =
  "id, codigo, titulo, status, cidade, estado, data_inicio, negocio_id, criado_em";

export type CriarObraInput = {
  titulo: string;
  tipo_obra?: string | null;
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

  const rowE0: Record<string, unknown> = {
    codigo,
    codigo_legivel: codigo,
    titulo,
    tipo_obra: tipoObra,
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

  {
    const { data, error } = await supabase.from("hub_obras").insert(rowE0).select(SELECT_OBRA_E0).single();
    obra = data as Record<string, unknown> | null;
    insErr = error;
  }

  // Retry-once em corrida do UNIQUE (tenant_id, codigo_legivel): o fallback do gerador não é
  // atômico (só a RPC gerar_codigo_obra é). Em 23505, regeneramos o código e tentamos 1× mais.
  if (insErr?.code === "23505") {
    const codigoRetry = await gerarCodigoObra(supabase, tenantId, tipoObra);
    const { data, error } = await supabase
      .from("hub_obras")
      .insert({ ...rowE0, codigo: codigoRetry, codigo_legivel: codigoRetry })
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
  let avisoEap: string | null = null;

  if (!migracaoPendente) {
    const preset = getPresetPorTipo(tipoObra);
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
      const { error: eapErr } = await supabase.from("hub_obra_frentes_eap").insert(linhas);
      if (eapErr) {
        avisoEap = "Obra criada; as frentes da EAP precisam da migração E0 aplicada.";
      } else {
        frentesCriadas = linhas.length;
      }
    } else {
      avisoEap = "Tipo sem preset — adicione frentes manualmente na EAP.";
    }
  } else {
    avisoEap = "Personalização de frentes ainda não ativa (migração E0 pendente).";
  }

  return { ok: true, obra, frentes_criadas: frentesCriadas, aviso: avisoEap, idempotente: false };
}
