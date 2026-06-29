import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HubAgenteFerramentaId } from "@/lib/hub/agente-ferramentas-registry";
import { isHubAgenteFerramentaId } from "@/lib/hub/agente-ferramentas-registry";
import { fetchFerramentaCustomPorKey } from "@/lib/hub/ferramentas-custom-db";
import { smartPosProcessarResultadoFerramenta } from "@/lib/hub/smart-pos-ferramenta";
import { uploadArquivo } from "@/lib/ia/storage";
import { defaultTenantId } from "@/lib/tenant-default";
import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";
import { buildHubLeadsCrmPatch } from "@/lib/hub/hub-leads-crm-atualizar";
import {
  telefoneConversaId,
  telefonesConversaEquivalentes,
  validarLeadTelefoneSessao,
} from "@/lib/crm/isolamento-conversa-lead";
import { iaCriarCadastroCrm } from "@/lib/crm/ia-criar-cadastro";
import { sugerirMenuTypeUazapi } from "@/lib/playbook/menu-type-uazapi";
import { executarFerramentaObra } from "@/lib/hub/executar-ferramenta-obra";
import { executarFerramentaObraItem } from "@/lib/hub/executar-ferramenta-obra-itens";
import { executarFerramentaObraRestricao } from "@/lib/hub/executar-ferramenta-obra-restricoes";
import { executarFerramentaEstoque } from "@/lib/hub/executar-ferramenta-estoque";
import { executarFerramentaFinanceiro } from "@/lib/hub/executar-ferramenta-financeiro";
import { executarFerramentaArq } from "@/lib/hub/executar-ferramenta-arq";

export type FerramentaHubContexto = {
  leadId: string;
  agenteSlug: string;
  tenantId?: string;
  /** Telefone WhatsApp da sessão (identificador global da conversa). */
  telefoneSessao?: string | null;
  /** hub_agente_identidade.modo_operacao — usado para gates de escrita seguros */
  modoOperacao?: string | null;
};

function db(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function executarFerramentaHubBuiltin(
  toolName: HubAgenteFerramentaId,
  args: Record<string, unknown>,
  ctx: FerramentaHubContexto,
  supabase: SupabaseClient
): Promise<string> {
  const telSessao = telefoneConversaId(ctx.telefoneSessao ?? "");
  if (telSessao.length >= 10) {
    const isolamento = await validarLeadTelefoneSessao(supabase, ctx.leadId, telSessao);
    if (!isolamento.ok) {
      return JSON.stringify({ erro: isolamento.codigo, detalhe: isolamento.detalhe });
    }
  }

  switch (toolName) {
    case "hub_lead_resumo": {
      const { data, error } = await supabase
        .from("hub_leads_crm")
        .select(
          "id, nome, telefone, estagio, valor_estimado, interesse_principal, agente_responsavel, humano_responsavel, atualizado_em, metadata"
        )
        .eq("id", ctx.leadId)
        .maybeSingle();
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      if (!data) return JSON.stringify({ erro: "lead_nao_encontrado", lead_id: ctx.leadId });
      const meta =
        data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
          ? { ...(data.metadata as Record<string, unknown>) }
          : {};
      const sessaoReiniciadaEm = meta.sessao_reiniciada_em;
      delete meta.conversa_turnos;
      for (const key of Object.keys(meta)) {
        if (/^fluxo/i.test(key) && key !== "fluxo_id") delete meta[key];
      }
      return JSON.stringify({
        lead: { ...data, metadata: meta },
        agente_slug_conversa: ctx.agenteSlug,
        sessao_reiniciada_em: sessaoReiniciadaEm ?? null,
        sessao_telefone: telSessao.length >= 10 ? telSessao : data.telefone ?? null,
        aviso: "Dados apenas deste contacto WhatsApp — não misturar com outros números.",
      });
    }
    case "hub_lead_memorias": {
      const limRaw = args.limite;
      const lim =
        typeof limRaw === "number" && Number.isFinite(limRaw)
          ? Math.min(10, Math.max(1, Math.floor(limRaw)))
          : 5;
      const { cutoffSessaoConversaMs } = await import("@/lib/ia/sessao-conversa-ttl");
      const cutoffIso = new Date(cutoffSessaoConversaMs()).toISOString();
      const { data, error } = await supabase
        .from("hub_memorias_lead")
        .select("chave, valor, confianca, criado_por, criado_em")
        .eq("lead_id", ctx.leadId)
        .gte("criado_em", cutoffIso)
        .order("confianca", { ascending: false })
        .limit(lim);
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      return JSON.stringify({ memorias: data ?? [] });
    }
    case "hub_lead_lookup_por_telefone": {
      const telRaw =
        typeof args.telefone === "string" && args.telefone.trim()
          ? args.telefone
          : telSessao.length >= 10
            ? telSessao
            : "";
      const telefone = telefoneConversaId(telRaw);
      if (telefone.length < 10) {
        return JSON.stringify({
          erro: "telefone_invalido",
          detalhe: "Use o telefone desta conversa ou hub_lead_resumo para a sessão actual.",
        });
      }

      if (telSessao.length >= 10 && !telefonesConversaEquivalentes(telefone, telSessao)) {
        return JSON.stringify({
          erro: "isolamento_sessao",
          detalhe:
            "Só é permitido consultar o telefone desta conversa. Para a ficha actual use hub_lead_resumo.",
        });
      }

      const { data: lead, error: eLead } = await supabase
        .from("hub_leads_crm")
        .select(
          "id, nome, telefone, estagio, score, valor_estimado, agente_responsavel, humano_responsavel, atualizado_em"
        )
        .eq("telefone", telefone)
        .maybeSingle();
      if (eLead) return JSON.stringify({ erro: "supabase", detalhe: eLead.message });
      if (!lead) return JSON.stringify({ ok: true, encontrado: false, telefone });

      const { data: pessoa, error: ePessoa } = await supabase
        .from("hub_pessoas")
        .select("id, codigo, nome, telefone, origem, atualizado_em")
        .eq("telefone", telefone)
        .maybeSingle();
      if (ePessoa) return JSON.stringify({ erro: "supabase", detalhe: ePessoa.message });

      return JSON.stringify({
        ok: true,
        encontrado: true,
        telefone,
        lead,
        pessoa: pessoa ?? null,
      });
    }
    case "hub_metricas_escritorio": {
      const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

      const { count: leadsTenant, error: e1 } = await supabase
        .from("hub_leads_crm")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant);

      const { count: acoes7d, error: e2 } = await supabase
        .from("hub_acoes_ia")
        .select("*", { count: "exact", head: true })
        .eq("agente_slug", ctx.agenteSlug)
        .gte("criado_em", since);

      const { count: prompts7d, error: e3 } = await supabase
        .from("hub_prompt_logs")
        .select("*", { count: "exact", head: true })
        .eq("agente_slug", ctx.agenteSlug)
        .gte("criado_em", since);

      if (e1 || e2 || e3) {
        return JSON.stringify({
          erro: "supabase",
          detalhe: [e1?.message, e2?.message, e3?.message].filter(Boolean).join(" | ") || "contagem_falhou",
        });
      }

      return JSON.stringify({
        tenant_id: tenant,
        leads_total_no_tenant: leadsTenant ?? 0,
        acoes_ia_ultimos_7d_este_agente: acoes7d ?? 0,
        pedidos_inferencia_hub_ultimos_7d_este_agente: prompts7d ?? 0,
        nota: "Contagens agregadas; não substitui relatório financeiro nem detalhe por lead.",
      });
    }
    case "hub_relatorio_html_simples": {
      const titulo = typeof args.titulo === "string" ? args.titulo.trim() : "";
      const textoPlano = typeof args.texto_plano === "string" ? args.texto_plano.trim() : "";
      if (!titulo || !textoPlano) {
        return JSON.stringify({ erro: "titulo_e_texto_plano_obrigatorios" });
      }
      const tituloEsc = escapeHtml(titulo.slice(0, 240));
      const body = textoPlano
        .slice(0, 50_000)
        .split(/\r?\n/)
        .map((linha) => `<p>${escapeHtml(linha)}</p>`)
        .join("");
      const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${tituloEsc}</title><style>body{font-family:system-ui,sans-serif;padding:1.25rem;line-height:1.5;color:#111}h1{font-size:1.25rem}</style></head><body><h1>${tituloEsc}</h1>${body}</body></html>`;
      const buffer = Buffer.from(html, "utf-8");
      const salvo = await uploadArquivo({
        arquivo: buffer,
        nome: `relatorio_ia_${Date.now()}.html`,
        tipo: "relatorio",
        origem: "ia_gerado",
        leadId: ctx.leadId,
        agenteSlug: ctx.agenteSlug,
        contentType: "text/html; charset=utf-8",
        metadata: { ferramenta: "hub_relatorio_html_simples" },
      });
      if (!salvo) return JSON.stringify({ erro: "upload_ou_gravacao_falhou" });
      return JSON.stringify({
        ok: true,
        url_publica: salvo.url,
        arquivo_id: salvo.id,
      });
    }
    case "hub_atualizar_lead": {
      if (ctx.modoOperacao !== "canal_whatsapp") {
        return JSON.stringify({
          erro: "ferramenta_apenas_modo_atendimento_canal_whatsapp",
          modo_actual: ctx.modoOperacao ?? null,
        });
      }

      const { data: leadAtual, error: errLead } = await supabase
        .from("hub_leads_crm")
        .select(
          "id, estagio, score, valor_estimado, tags, metadata, preferencias, nome, telefone, interesse_principal"
        )
        .eq("id", ctx.leadId)
        .maybeSingle();

      if (errLead) return JSON.stringify({ erro: "supabase", detalhe: errLead.message });
      if (!leadAtual) return JSON.stringify({ erro: "lead_nao_encontrado", lead_id: ctx.leadId });

      const built = buildHubLeadsCrmPatch(args, leadAtual as Record<string, unknown>);
      if (!built.ok) {
        return JSON.stringify({ erro: built.codigo ?? built.erro, detalhe: built.erro });
      }

      const { data: updated, error: errUp } = await supabase
        .from("hub_leads_crm")
        .update(built.patch)
        .eq("id", ctx.leadId)
        .select(
          "id, nome, estagio, score, valor_estimado, interesse_principal, proxima_acao, data_proxima_acao, tags, atualizado_em"
        )
        .maybeSingle();

      if (errUp) return JSON.stringify({ erro: "supabase", detalhe: errUp.message });
      if (!updated) return JSON.stringify({ erro: "lead_nao_atualizado" });

      if (
        built.estagioNovo &&
        built.estagioAnterior &&
        built.estagioNovo !== built.estagioAnterior
      ) {
        await supabase.from("hub_atividades").insert({
          lead_id: ctx.leadId,
          tipo: "status_change",
          descricao: `Estágio: ${built.estagioAnterior} → ${built.estagioNovo}`,
          feito_por: ctx.agenteSlug,
          feito_por_tipo: "ia",
          metadata: {
            origem: "hub_atualizar_lead",
            estagio_anterior: built.estagioAnterior,
            estagio_novo: built.estagioNovo,
          },
        });
      }

      await supabase.from("hub_acoes_ia").insert({
        agente_slug: ctx.agenteSlug,
        tipo: "memoria_salva",
        descricao: "Lead atualizado via hub_atualizar_lead",
        lead_id: ctx.leadId,
        sucesso: true,
        metadata: {
          ferramenta: "hub_atualizar_lead",
          campos: Object.keys(built.patch).filter((k) => k !== "atualizado_em" && k !== "ultimo_contato"),
        },
      });

      return JSON.stringify({
        ok: true,
        lead: updated,
        campos_alterados: Object.keys(built.patch).filter(
          (k) => k !== "atualizado_em" && k !== "ultimo_contato"
        ),
      });
    }
    case "hub_crm_criar_cadastro": {
      const nome = typeof args.nome === "string" ? args.nome.trim() : "";
      const telefoneArg = typeof args.telefone === "string" ? args.telefone.trim() : "";
      // SEGURANÇA (auditoria 28/jun): em atendimento WhatsApp o cadastro é SEMPRE do lead da sessão
      // — não aceita telefone arbitrário por prompt injection (defesa em profundidade; a tool já vem
      // desligada no merge WhatsApp por padrão). Fora do canal, o telefone do arg vale.
      const telefone =
        ctx.modoOperacao === "canal_whatsapp" ? telSessao : telefoneArg || telSessao;
      if (!nome) return JSON.stringify({ erro: "nome_obrigatorio" });
      if (!telefone || telefone.length < 10) {
        return JSON.stringify({ erro: "telefone_obrigatorio" });
      }
      const result = await iaCriarCadastroCrm(supabase, {
        nome,
        telefone,
        tipo_pessoa: args.tipo_pessoa === "PJ" ? "PJ" : "PF",
        mercado: typeof args.mercado === "string" ? args.mercado : undefined,
        origem: typeof args.origem === "string" ? args.origem : "whatsapp",
        email: typeof args.email === "string" ? args.email : null,
        tenant_id: ctx.tenantId ?? defaultTenantId(),
      });
      if (!result.ok) {
        return JSON.stringify({ erro: "criar_cadastro_falhou", detalhe: result.error });
      }
      return JSON.stringify({ ok: true, ...result.payload });
    }
    case "hub_registar_nota_lead": {
      if (ctx.modoOperacao !== "canal_whatsapp") {
        return JSON.stringify({
          erro: "ferramenta_apenas_modo_atendimento_canal_whatsapp",
          modo_actual: ctx.modoOperacao ?? null,
        });
      }
      const textoBruto = typeof args.texto === "string" ? args.texto.trim() : "";
      if (!textoBruto) return JSON.stringify({ erro: "texto_obrigatorio" });
      const texto = textoBruto.slice(0, 8000);
      const { error } = await supabase.from("hub_atividades").insert({
        lead_id: ctx.leadId,
        tipo: "nota",
        descricao: texto,
        feito_por: ctx.agenteSlug,
        feito_por_tipo: "ia",
        metadata: { origem: "hub_registar_nota_lead" },
      });
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      return JSON.stringify({ ok: true, tipo: "nota_timeline" });
    }
    case "hub_whatsapp_menu": {
      if (ctx.modoOperacao !== "canal_whatsapp") {
        return JSON.stringify({
          erro: "ferramenta_apenas_modo_atendimento_canal_whatsapp",
          modo_actual: ctx.modoOperacao ?? null,
        });
      }

      const tipoRaw = args.tipo;
      const tipo =
        typeof tipoRaw === "string" ? tipoRaw.trim().toLowerCase() : "";
      const tiposMenu = new Set(["button", "list", "poll", "carousel"]);
      if (!tiposMenu.has(tipo)) {
        return JSON.stringify({ erro: "tipo_menu_invalido", permitidos: ["button", "list", "poll", "carousel"] });
      }

      const textoBruto = typeof args.texto === "string" ? args.texto.trim() : "";
      if (!textoBruto) return JSON.stringify({ erro: "texto_obrigatorio" });
      const texto = textoBruto.slice(0, 4000);

      const normOpcoes = (v: unknown): string[] => {
        if (!Array.isArray(v)) return [];
        return v
          .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
          .filter((s) => s.length > 0)
          .slice(0, 50);
      };
      const opcoes = normOpcoes(args.opcoes);

      type CarouselCard = { text: string; image?: string; buttons: Array<{ id: string; text: string; type: string }> };
      const montarCarousel = (): CarouselCard[] | null => {
        const raw = args.cartoes_carrossel;
        if (!Array.isArray(raw) || raw.length === 0) return null;
        const out: CarouselCard[] = [];
        const tiposBtn = new Set(["REPLY", "URL", "COPY", "CALL"]);
        for (const item of raw.slice(0, 10)) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const o = item as Record<string, unknown>;
          const textCart =
            typeof o.texto_cartao === "string" ? o.texto_cartao.trim() : String(o.texto_cartao ?? "").trim();
          const image =
            typeof o.url_imagem === "string" && o.url_imagem.trim() ? o.url_imagem.trim().slice(0, 2000) : undefined;
          const botoesRaw = o.botoes;
          if (!textCart || !Array.isArray(botoesRaw)) continue;
          const buttons: CarouselCard["buttons"] = [];
          for (const b of botoesRaw.slice(0, 5)) {
            if (!b || typeof b !== "object" || Array.isArray(b)) continue;
            const br = b as Record<string, unknown>;
            const id = typeof br.id === "string" ? br.id.trim() : String(br.id ?? "").trim();
            const rotulo =
              typeof br.rotulo === "string" ? br.rotulo.trim() : String(br.rotulo ?? "").trim();
            const tRaw = typeof br.tipo === "string" ? br.tipo.trim().toUpperCase() : "REPLY";
            const tBtn = tiposBtn.has(tRaw) ? tRaw : "REPLY";
            if (!id || !rotulo) continue;
            buttons.push({ id: id.slice(0, 500), text: rotulo.slice(0, 120), type: tBtn });
          }
          if (buttons.length === 0) continue;
          const card: CarouselCard = { text: textCart.slice(0, 4000), buttons };
          if (image) card.image = image;
          out.push(card);
        }
        return out.length > 0 ? out : null;
      };

      const carouselCards = tipo === "carousel" ? montarCarousel() : null;
      const useCarouselEndpoint = Boolean(carouselCards && carouselCards.length > 0);

      if (!useCarouselEndpoint && opcoes.length === 0) {
        return JSON.stringify({
          erro: "opcoes_obrigatorias",
          nota: "Forneça `opcoes` (choices) para /send/menu ou `cartoes_carrossel` com tipo carousel para /send/carousel.",
        });
      }

      // SEGURANÇA (auditoria 28/jun): em atendimento WhatsApp IGNORA numero_destino — o menu vai
      // SEMPRE para o telefone do lead da sessão. Impede um cliente injetar "manda menu pro +55X"
      // e usar o número/token do escritório para spam/phishing a terceiros. Override só fora do canal.
      const overrideNum =
        ctx.modoOperacao === "canal_whatsapp"
          ? ""
          : typeof args.numero_destino === "string"
            ? args.numero_destino.replace(/\D/g, "")
            : "";
      let number = overrideNum;
      if (!number) {
        const { data: leadRow, error: el } = await supabase
          .from("hub_leads_crm")
          .select("telefone")
          .eq("id", ctx.leadId)
          .maybeSingle();
        if (el) return JSON.stringify({ erro: "supabase", detalhe: el.message });
        const tel =
          leadRow && typeof leadRow.telefone === "string" ? leadRow.telefone.replace(/\D/g, "") : "";
        number = tel;
      }
      if (!number) {
        return JSON.stringify({ erro: "numero_destino_ausente", nota: "Lead sem telefone ou override inválido." });
      }

      const { data: agenteRow, error: ea } = await supabase
        .from("hub_agente_identidade")
        .select("uazapi_instance_token")
        .eq("agente_slug", ctx.agenteSlug)
        .maybeSingle();
      if (ea) return JSON.stringify({ erro: "supabase", detalhe: ea.message });
      const instanceToken =
        agenteRow && typeof agenteRow.uazapi_instance_token === "string"
          ? agenteRow.uazapi_instance_token.trim()
          : "";
      if (!instanceToken) {
        return JSON.stringify({
          erro: "uazapi_token_instancia_ausente",
          nota: "Ligue a instância UAZAPI na ficha do agente.",
        });
      }

      if (useCarouselEndpoint && carouselCards) {
        const res = await uazapiFetchJson<unknown>("/send/carousel", {
          method: "POST",
          instanceToken,
          body: {
            number,
            text: texto,
            carousel: carouselCards,
          },
        });
        if (!res.ok) {
          return JSON.stringify({
            ok: false,
            endpoint: "/send/carousel",
            erro: "uazapi",
            detalhe: res.error,
            status: res.status,
            request: res.request,
          });
        }
        return JSON.stringify({
          ok: true,
          endpoint: "/send/carousel",
          status: res.status,
          resposta: res.data,
        });
      }

      const tipoResolvido =
        tipo === "list" || tipo === "button"
          ? sugerirMenuTypeUazapi(opcoes.length, tipo)
          : tipo;

      const body: Record<string, unknown> = {
        number,
        type: tipoResolvido,
        text: texto,
        choices: opcoes,
      };

      const rodape = typeof args.rodape === "string" ? args.rodape.trim() : "";
      if (rodape) body.footerText = rodape.slice(0, 500);

      if (tipoResolvido === "list") {
        const listaBtn =
          typeof args.texto_botao_lista === "string" ? args.texto_botao_lista.trim() : "";
        if (listaBtn) body.listButton = listaBtn.slice(0, 120);
        else body.listButton = "Ver opções";
      }

      if (tipo === "poll") {
        const ms = args.max_opcoes_selecionaveis;
        if (typeof ms === "number" && Number.isFinite(ms)) {
          body.selectableCount = Math.min(20, Math.max(1, Math.floor(ms)));
        }
      }

      const imgBtn = typeof args.url_imagem_botao === "string" ? args.url_imagem_botao.trim() : "";
      if (imgBtn) body.imageButton = imgBtn.slice(0, 2000);

      const resMenu = await uazapiFetchJson<unknown>("/send/menu", {
        method: "POST",
        instanceToken,
        body,
      });
      if (!resMenu.ok) {
        return JSON.stringify({
          ok: false,
          endpoint: "/send/menu",
          erro: "uazapi",
          detalhe: resMenu.error,
          status: resMenu.status,
          request: resMenu.request,
        });
      }
      return JSON.stringify({
        ok: true,
        endpoint: "/send/menu",
        status: resMenu.status,
        resposta: resMenu.data,
      });
    }
    // ── E0: Engenharia / Obra (SEM gate canal_whatsapp — operam pelo copiloto global) ──
    case "hub_obra_listar":
    case "hub_obra_resumo":
    case "hub_obra_hoje":
    case "hub_obra_criar":
    case "hub_obra_eap_montar":
      return executarFerramentaObra(toolName, args, ctx, supabase);

    // ── E2: Itens × Subitens (SEM gate canal_whatsapp — copiloto global) ──
    case "hub_obra_item_listar":
    case "hub_obra_item_avanco":
    case "hub_obra_item_andamento":
      return executarFerramentaObraItem(toolName, args, ctx, supabase);

    // ── E3: Restrições/Bloqueios (SEM gate canal_whatsapp — copiloto global) ──
    case "hub_obra_bloqueios_listar":
    case "hub_obra_bloqueio_criar":
    case "hub_obra_bloqueio_resolver":
      return executarFerramentaObraRestricao(toolName, args, ctx, supabase);

    // ── E5: Compras → Estoque (SEM gate canal_whatsapp — copiloto global) ──
    case "hub_obra_sc_criar":
    case "hub_obra_estoque_consultar":
      return executarFerramentaEstoque(toolName, args, ctx, supabase);

    // ── E6: Financeiro (SEM gate canal_whatsapp — copiloto global). Escrita só PREPARA: a aprovação
    //    dupla (arquitetura + Hub) e a liberação do escrow são decisão humana na tela, nunca por voz. ──
    case "hub_obra_financeiro_resumo":
    case "hub_obra_pagamento_preparar":
      return executarFerramentaFinanceiro(toolName, args, ctx, supabase);

    // ── A0: Arquitetura / Projeto (SEM gate canal_whatsapp — copiloto global) ──
    case "arq_resumo":
    case "arq_criar_projeto":
    case "arq_mover_estagio":
    case "arq_programa_item":
    case "arq_enviar_aprovacao":
    case "arq_registrar_aprovacao":
    case "arq_gerar_obra":
      return executarFerramentaArq(toolName, args, ctx, supabase);

    default:
      return JSON.stringify({ erro: "ferramenta_builtin_desconhecida", nome: toolName });
  }
}

/** Resultado string para o modelo (JSON ou texto após smart layer). */
export async function executarFerramentaHub(
  toolName: string,
  argsJson: string,
  ctx: FerramentaHubContexto
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    const p = JSON.parse(argsJson || "{}");
    if (p && typeof p === "object" && !Array.isArray(p)) args = p as Record<string, unknown>;
  } catch {
    return JSON.stringify({ erro: "argumentos_json_invalidos" });
  }

  const supabase = db();
  const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();

  try {
    if (toolName.startsWith("hub_custom_")) {
      const row = await fetchFerramentaCustomPorKey(supabase, tenant, toolName);
      if (!row) {
        return JSON.stringify({ erro: "ferramenta_custom_nao_encontrada", chave: toolName });
      }
      if (!isHubAgenteFerramentaId(row.builtin_impl)) {
        return JSON.stringify({ erro: "builtin_impl_invalido", valor: row.builtin_impl });
      }
      const raw = await executarFerramentaHubBuiltin(row.builtin_impl, args, ctx, supabase);
      if (row.smart_provider === "mistral" || row.smart_provider === "gemini") {
        const instr =
          row.smart_prompt?.trim() ||
          "Resuma e estruture estes dados para o assistente principal, em português, sem inventar factos.";
        const pos = await smartPosProcessarResultadoFerramenta({
          provider: row.smart_provider,
          model: row.smart_model,
          instrucoes: instr,
          payloadBruto: raw,
        });
        if (!pos.ok) {
          return raw;
        }
        return pos.texto;
      }
      return raw;
    }

    if (!isHubAgenteFerramentaId(toolName)) {
      return JSON.stringify({ erro: "ferramenta_desconhecida", nome: toolName });
    }

    return await executarFerramentaHubBuiltin(toolName, args, ctx, supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_execucao";
    return JSON.stringify({ erro: "excecao", detalhe: msg });
  }
}
