/**
 * Execução das 4 ferramentas de IA de Engenharia/Obra (E0).
 *
 * DIFERENÇA-CHAVE em relação às tools de WhatsApp: estas NÃO têm o gate
 * `modoOperacao === 'canal_whatsapp'`. Nascem para o copiloto GLOBAL (o dono
 * autenticado, em qualquer tela /obras|/engenharia). O tenant vem de `ctx.tenantId`
 * (a sessão), nunca do body — mesma garantia multi-tenant das rotas REST.
 *
 * Escrita (criar/eap_montar) continua sob o gate do copiloto: HMAC + allowlist +
 * confirmação humana (ver lib/copiloto/copiloto-core.ts). Aqui só executamos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  gerarCodigoObra,
  getPresetPorTipo,
  frentesDoPresetParaInsert,
  codigoFrenteFromNome,
  disciplinaPorSlug,
  TIPOS_OBRA,
} from "@/lib/obras/eap-presets";

type ObraCtx = { tenantId?: string; modoOperacao?: string | null };

const TIPOS_VALIDOS = new Set<string>(TIPOS_OBRA.map((t) => t.slug));

/**
 * Gate de escrita autônoma: as tools de ESCRITA de obra (criar / eap_montar) nascem
 * para o copiloto GLOBAL (dono autenticado), NÃO para o agente que atende no WhatsApp.
 * Quando o agente está em modo `canal_whatsapp`, recusamos escrita (espelha o guard das
 * tools de lead em executar-ferramenta-ia.ts). LEITURA (listar/resumo) segue livre.
 */
function recusaSeCanalWhatsapp(ctx: ObraCtx): string | null {
  if (ctx.modoOperacao === "canal_whatsapp") {
    return JSON.stringify({
      erro: "ferramenta_escrita_obra_indisponivel_no_whatsapp",
      nota: "Criação/edição de obra é feita pelo copiloto interno, não pelo atendimento WhatsApp.",
    });
  }
  return null;
}

export async function executarFerramentaObra(
  toolName: "hub_obra_listar" | "hub_obra_resumo" | "hub_obra_criar" | "hub_obra_eap_montar",
  args: Record<string, unknown>,
  ctx: ObraCtx,
  supabase: SupabaseClient
): Promise<string> {
  const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();

  switch (toolName) {
    case "hub_obra_listar": {
      let q = supabase
        .from("hub_obras")
        .select("id, codigo, codigo_legivel, titulo, tipo_obra, status, cidade, estado")
        .eq("tenant_id", tenant)
        .order("criado_em", { ascending: false })
        .limit(30);
      if (typeof args.status === "string" && args.status.trim()) q = q.eq("status", args.status.trim());
      if (typeof args.tipo_obra === "string" && TIPOS_VALIDOS.has(args.tipo_obra)) {
        q = q.eq("tipo_obra", args.tipo_obra);
      }
      const { data, error } = await q;
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      return JSON.stringify({ obras: data ?? [], total: (data ?? []).length });
    }

    case "hub_obra_resumo": {
      const obraId = typeof args.obra_id === "string" ? args.obra_id.trim() : "";
      if (!obraId) return JSON.stringify({ erro: "obra_id_ausente", nota: "Informe a obra (ou abra a ficha da obra)." });
      const { data: obra, error } = await supabase
        .from("hub_obras")
        .select("id, codigo, codigo_legivel, titulo, tipo_obra, status, cidade, estado, tenant_id")
        .eq("id", obraId)
        .maybeSingle();
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      // C1: tenant_id NULL não pertence a ninguém → não-encontrada (service-role bypassa RLS).
      if (!obra || obra.tenant_id !== tenant) {
        return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });
      }
      const { data: frentes } = await supabase
        .from("hub_obra_frentes_eap")
        .select("nome, ativo")
        .eq("obra_id", obraId)
        .eq("tenant_id", tenant); // defesa em profundidade (frentes nunca são globais)
      const ativas = (frentes ?? []).filter((f) => f.ativo).length;
      return JSON.stringify({
        obra: { ...obra, tenant_id: undefined },
        frentes_total: (frentes ?? []).length,
        frentes_ativas: ativas,
      });
    }

    case "hub_obra_criar": {
      const gate = recusaSeCanalWhatsapp(ctx);
      if (gate) return gate;
      const titulo = typeof args.titulo === "string" ? args.titulo.trim() : "";
      if (!titulo) return JSON.stringify({ erro: "titulo_ausente", nota: "Diga o nome da obra." });
      const tipoObra =
        typeof args.tipo_obra === "string" && TIPOS_VALIDOS.has(args.tipo_obra)
          ? args.tipo_obra
          : "reforma";

      // Anti double-tap (mesmo título no tenant em <60s).
      const desde = new Date(Date.now() - 60_000).toISOString();
      const { data: recente } = await supabase
        .from("hub_obras")
        .select("id, codigo_legivel, codigo, titulo")
        .eq("tenant_id", tenant)
        .eq("titulo", titulo)
        .gte("criado_em", desde)
        .limit(1)
        .maybeSingle();
      if (recente?.id) {
        return JSON.stringify({ ok: true, idempotente: true, obra: recente });
      }

      const codigo = await gerarCodigoObra(supabase, tenant, tipoObra);
      const { data: obra, error } = await supabase
        .from("hub_obras")
        .insert({
          codigo,
          codigo_legivel: codigo,
          titulo,
          tipo_obra: tipoObra,
          status: "planejamento",
          estagio_slug: "planejamento",
          cliente_pessoa_id: typeof args.cliente_pessoa_id === "string" ? args.cliente_pessoa_id : null,
          cliente_empresa_id: typeof args.cliente_empresa_id === "string" ? args.cliente_empresa_id : null,
          negocio_id: typeof args.negocio_id === "string" ? args.negocio_id : null,
          tenant_id: tenant,
        })
        .select("id, codigo_legivel, titulo, tipo_obra, status")
        .single();
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });

      let frentesCriadas = 0;
      const preset = getPresetPorTipo(tipoObra);
      if (preset && obra?.id) {
        const linhas = frentesDoPresetParaInsert(preset, String(obra.id), tenant);
        const { error: eapErr } = await supabase.from("hub_obra_frentes_eap").insert(linhas);
        if (!eapErr) frentesCriadas = linhas.length;
      }
      return JSON.stringify({ ok: true, obra, frentes_criadas: frentesCriadas });
    }

    case "hub_obra_eap_montar": {
      const gate = recusaSeCanalWhatsapp(ctx);
      if (gate) return gate;
      const obraId = typeof args.obra_id === "string" ? args.obra_id.trim() : "";
      const disciplinaSlug =
        typeof args.disciplina_slug === "string" ? args.disciplina_slug.trim() : "";
      if (!obraId) return JSON.stringify({ erro: "obra_id_ausente", nota: "Informe a obra." });
      if (!disciplinaSlug) return JSON.stringify({ erro: "disciplina_ausente", nota: "Informe a disciplina." });

      // Confirma que a obra é do tenant.
      const { data: obra } = await supabase
        .from("hub_obras")
        .select("id, tenant_id")
        .eq("id", obraId)
        .maybeSingle();
      // C1: tenant_id NULL não pertence a ninguém → não-encontrada (service-role bypassa RLS).
      if (!obra || obra.tenant_id !== tenant) {
        return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });
      }

      const disc = disciplinaPorSlug(disciplinaSlug);
      const nome = typeof args.nome === "string" && args.nome.trim() ? args.nome.trim() : disc?.label || disciplinaSlug;

      const { data: existentes } = await supabase
        .from("hub_obra_frentes_eap")
        .select("codigo, ordem")
        .eq("obra_id", obraId);
      const usados = new Set<string>((existentes ?? []).map((r) => String(r.codigo)));
      const maxOrdem = (existentes ?? []).reduce((m, r) => Math.max(m, Number(r.ordem ?? 0)), -1);
      let codigo = codigoFrenteFromNome(nome, disciplinaSlug);
      const base = codigo;
      let n = 2;
      while (usados.has(codigo)) {
        codigo = `${base}${n}`;
        n += 1;
      }

      const { data, error } = await supabase
        .from("hub_obra_frentes_eap")
        .insert({
          obra_id: obraId,
          tenant_id: tenant,
          codigo,
          nome,
          disciplina_slug: disciplinaSlug,
          cor: disc?.cor ?? null,
          ativo: true,
          ordem: maxOrdem + 1,
          origem: "ia",
        })
        .select("id, codigo, nome, ativo, ordem")
        .single();
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      return JSON.stringify({ ok: true, frente: data });
    }

    default:
      return JSON.stringify({ erro: "ferramenta_obra_desconhecida", nome: toolName });
  }
}
