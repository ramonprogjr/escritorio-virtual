/**
 * Execução das 3 ferramentas de escrita + 1 leitura de Arquitetura/Projeto (A0).
 *
 * DIFERENÇA-CHAVE em relação às tools de WhatsApp: estas NÃO têm o gate
 * `modoOperacao === 'canal_whatsapp'`. Nascem para o copiloto GLOBAL (o dono
 * autenticado, em qualquer tela /arquitetura). O tenant vem de `ctx.tenantId`
 * (a sessão), nunca do body — mesma garantia multi-tenant das rotas REST.
 *
 * Escrita (criar_projeto / mover_estagio / programa_item) continua sob o gate do
 * copiloto: HMAC + allowlist + confirmação humana (lib/copiloto/copiloto-core.ts).
 * Aqui só executamos — sempre com .eq('tenant_id') no INSERT/UPDATE.
 *
 * DISJUNTO de E0: não toca hub_obras/EAP/catálogo. Espelha executar-ferramenta-obra.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  ESTAGIO_PROJETO_INICIAL,
  PIPELINE_PROJETO_SLUG,
  SLUGS_PROJETO_PADRAO,
} from "@/lib/crm/projeto-funil-defaults";

type ArqCtx = { tenantId?: string };

export type ArqToolName =
  | "arq_resumo"
  | "arq_criar_projeto"
  | "arq_mover_estagio"
  | "arq_programa_item";

async function gerarCodigo(supabase: SupabaseClient, tenant: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("gerar_codigo_projeto", { p_tenant: tenant });
    if (!error && typeof data === "string" && data) return data;
  } catch {
    /* fallback */
  }
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("hub_projetos")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant)
    .like("codigo", `PRJ-${year}-%`);
  return `PRJ-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
}

/** Resolve o pipeline_id de projeto do projeto (ou o global seedado). */
async function pipelineProjetoId(
  supabase: SupabaseClient,
  projetoPipelineId: string | null | undefined
): Promise<string | null> {
  if (projetoPipelineId) return projetoPipelineId;
  const { data } = await supabase
    .from("hub_pipelines")
    .select("id")
    .eq("slug", PIPELINE_PROJETO_SLUG)
    .is("tenant_id", null)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function executarFerramentaArq(
  toolName: ArqToolName,
  args: Record<string, unknown>,
  ctx: ArqCtx,
  supabase: SupabaseClient
): Promise<string> {
  const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();

  switch (toolName) {
    case "arq_resumo": {
      const estagioFiltro =
        typeof args.estagio === "string" && args.estagio.trim() ? args.estagio.trim() : "";
      let q = supabase
        .from("hub_projetos")
        .select("id, codigo, titulo, estagio, tipologia, area_m2, cliente_nome, aprovacao_status, proxima_entrega_em")
        // AUDITORIA-FIX (vazamento legado): só o tenant do caller. O `,tenant_id.is.null`
        // anterior fazia a IA enxergar projetos órfãos de outras empresas no resumo.
        .eq("tenant_id", tenant)
        .order("criado_em", { ascending: false })
        .limit(30);
      if (estagioFiltro) q = q.eq("estagio", estagioFiltro);
      const { data, error } = await q;
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      const projetos = data ?? [];
      const emAprovacao = projetos.filter((p) => p.estagio === "aprovacao").length;
      return JSON.stringify({
        projetos,
        total: projetos.length,
        em_aprovacao: emAprovacao,
        nota: "Resumo dos projetos da carteira (Arquitetura). Apenas leitura.",
      });
    }

    case "arq_criar_projeto": {
      const tipologia =
        typeof args.tipologia === "string" && args.tipologia.trim() ? args.tipologia.trim() : "residencial";
      const clienteNome =
        typeof args.cliente_nome === "string" && args.cliente_nome.trim() ? args.cliente_nome.trim() : null;
      let titulo = typeof args.titulo === "string" ? args.titulo.trim() : "";
      if (!titulo) {
        titulo = clienteNome
          ? `Projeto — ${clienteNome}`
          : `Projeto — ${tipologia.charAt(0).toUpperCase()}${tipologia.slice(1)}`;
      }

      // Anti double-tap (mesmo título no tenant em <60s).
      const desde = new Date(Date.now() - 60_000).toISOString();
      const { data: recente } = await supabase
        .from("hub_projetos")
        .select("id, codigo, titulo")
        .eq("tenant_id", tenant)
        .eq("titulo", titulo)
        .gte("criado_em", desde)
        .limit(1)
        .maybeSingle();
      if (recente?.id) {
        return JSON.stringify({ ok: true, idempotente: true, projeto: recente });
      }

      const areaM2 =
        typeof args.area_m2 === "number" && Number.isFinite(args.area_m2)
          ? args.area_m2
          : typeof args.area_m2 === "string" && args.area_m2.trim() && !Number.isNaN(Number(args.area_m2))
            ? Number(args.area_m2)
            : null;

      const pipelineId = await pipelineProjetoId(supabase, null);
      const codigo = await gerarCodigo(supabase, tenant);
      const { data: projeto, error } = await supabase
        .from("hub_projetos")
        .insert({
          codigo,
          titulo,
          status: ESTAGIO_PROJETO_INICIAL,
          estagio: ESTAGIO_PROJETO_INICIAL,
          pipeline_id: pipelineId,
          tipologia,
          area_m2: areaM2,
          cliente_nome: clienteNome,
          cliente_pessoa_id:
            typeof args.cliente_pessoa_id === "string" ? args.cliente_pessoa_id : null,
          cliente_empresa_id:
            typeof args.cliente_empresa_id === "string" ? args.cliente_empresa_id : null,
          negocio_id: typeof args.negocio_id === "string" ? args.negocio_id : null,
          aprovacao_status: "sem_aprovacao",
          tenant_id: tenant,
        })
        .select("id, codigo, titulo, estagio, tipologia, area_m2")
        .single();
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      return JSON.stringify({ ok: true, projeto });
    }

    case "arq_mover_estagio": {
      const projetoId = typeof args.projeto_id === "string" ? args.projeto_id.trim() : "";
      const estagio = typeof args.estagio === "string" ? args.estagio.trim() : "";
      if (!projetoId) return JSON.stringify({ erro: "projeto_id_ausente", nota: "Informe o projeto (ou abra a ficha)." });
      if (!estagio) return JSON.stringify({ erro: "estagio_ausente", nota: "Informe o estágio de destino." });

      // Confirma a POSSE com match ESTRITO por tenant.
      // AUDITORIA-FIX: a guarda `proj.tenant_id && proj.tenant_id !== tenant` deixava
      // passar projeto órfão (tenant_id NULL). Agora exige tenant_id = tenant no WHERE.
      const { data: proj } = await supabase
        .from("hub_projetos")
        .select("id, pipeline_id")
        .eq("id", projetoId)
        .eq("tenant_id", tenant)
        .maybeSingle();
      if (!proj) {
        return JSON.stringify({ erro: "projeto_nao_encontrado", projeto_id: projetoId });
      }

      // Valida o slug contra o pipeline do projeto (evita etapa-fantasma).
      if (!SLUGS_PROJETO_PADRAO.has(estagio)) {
        const pipelineId = await pipelineProjetoId(supabase, proj.pipeline_id as string | null);
        if (pipelineId) {
          const { data: est } = await supabase
            .from("hub_pipeline_estagios")
            .select("slug")
            .eq("pipeline_id", pipelineId)
            .eq("slug", estagio)
            .maybeSingle();
          if (!est) {
            return JSON.stringify({ erro: "estagio_invalido", estagio, nota: "Esse estágio não existe neste funil." });
          }
        }
      }

      const { data, error } = await supabase
        .from("hub_projetos")
        .update({ estagio, status: estagio, atualizado_em: new Date().toISOString() })
        .eq("id", projetoId)
        .eq("tenant_id", tenant) // tenant-scope no UPDATE.
        .select("id, codigo, titulo, estagio")
        .maybeSingle();
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      if (!data) return JSON.stringify({ erro: "projeto_nao_encontrado", projeto_id: projetoId });
      return JSON.stringify({ ok: true, projeto: data });
    }

    case "arq_programa_item": {
      const projetoId = typeof args.projeto_id === "string" ? args.projeto_id.trim() : "";
      if (!projetoId) return JSON.stringify({ erro: "projeto_id_ausente", nota: "Informe o projeto." });

      // Confirma a POSSE com match ESTRITO por tenant (antes de qualquer INSERT).
      // AUDITORIA-FIX: a guarda permissiva deixava inserir cômodos em projeto órfão
      // (tenant_id NULL). Agora o WHERE exige tenant_id = tenant.
      const { data: proj } = await supabase
        .from("hub_projetos")
        .select("id")
        .eq("id", projetoId)
        .eq("tenant_id", tenant)
        .maybeSingle();
      if (!proj) {
        return JSON.stringify({ erro: "projeto_nao_encontrado", projeto_id: projetoId });
      }

      // itens: array de nomes (strings) ou objetos { nome, metragem_m2?, categoria? }.
      const rawItens = Array.isArray(args.itens) ? args.itens : args.nome != null ? [args] : [];
      const { data: existentes } = await supabase
        .from("hub_projetos_fases")
        .select("ordem")
        .eq("projeto_id", projetoId);
      let ordem = (existentes ?? []).reduce((m, r) => Math.max(m, Number(r.ordem ?? 0)), -1) + 1;

      const linhas: Record<string, unknown>[] = [];
      for (const it of rawItens) {
        let nome = "";
        let metragem: number | null = null;
        let categoria: string | null = null;
        if (typeof it === "string") {
          nome = it.trim();
        } else if (it && typeof it === "object" && !Array.isArray(it)) {
          const o = it as Record<string, unknown>;
          nome = typeof o.nome === "string" ? o.nome.trim() : "";
          if (typeof o.metragem_m2 === "number" && Number.isFinite(o.metragem_m2)) metragem = o.metragem_m2;
          else if (typeof o.metragem_m2 === "string" && o.metragem_m2.trim() && !Number.isNaN(Number(o.metragem_m2)))
            metragem = Number(o.metragem_m2);
          if (typeof o.categoria === "string" && o.categoria.trim()) categoria = o.categoria.trim();
        }
        if (!nome) continue;
        linhas.push({
          projeto_id: projetoId,
          tenant_id: tenant,
          nome: nome.slice(0, 200),
          ordem: ordem++,
          status: "pendente",
          tipo: "comodo",
          categoria,
          metragem_m2: metragem,
        });
      }
      if (linhas.length === 0) {
        return JSON.stringify({ erro: "sem_itens", nota: "Diga ao menos um cômodo (ex.: sala, 3 suítes, cozinha)." });
      }

      const { data, error } = await supabase
        .from("hub_projetos_fases")
        .insert(linhas)
        .select("id, nome, metragem_m2, categoria, tipo, ordem");
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      return JSON.stringify({ ok: true, itens: data ?? [], criados: (data ?? []).length });
    }

    default:
      return JSON.stringify({ erro: "ferramenta_arq_desconhecida", nome: toolName });
  }
}
