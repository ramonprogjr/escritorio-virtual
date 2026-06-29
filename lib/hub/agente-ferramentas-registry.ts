/**
 * Catálogo declarado de ferramentas Hub ↔ function calling (Mistral chat completions / Agents).
 * Cada tool tem schema estável e execução servidor em `executarFerramentasHub`.
 */

import type { MistralChatToolDefinition } from "@/lib/ia/mistral-chat-tools";

export type HubFerramentaCategoria = "cliente" | "analise" | "registos" | "obra" | "arquitetura";

export type HubAgenteFerramentaId =
  | "hub_lead_resumo"
  | "hub_lead_memorias"
  | "hub_lead_lookup_por_telefone"
  | "hub_metricas_escritorio"
  | "hub_relatorio_html_simples"
  | "hub_registar_nota_lead"
  | "hub_whatsapp_menu"
  | "hub_atualizar_lead"
  | "hub_crm_criar_cadastro"
  // ── E0: Engenharia/Obra (não dependem de canal WhatsApp) ──
  | "hub_obra_listar"
  | "hub_obra_resumo"
  | "hub_obra_hoje"
  | "hub_obra_criar"
  | "hub_obra_eap_montar"
  // ── E2: Itens × Subitens (Situação auto × Andamento manual) ──
  | "hub_obra_item_listar"
  | "hub_obra_item_avanco"
  | "hub_obra_item_andamento"
  // ── E3: Restrições/Bloqueios de 1ª classe ──
  | "hub_obra_bloqueios_listar"
  | "hub_obra_bloqueio_criar"
  | "hub_obra_bloqueio_resolver"
  // ── E5: Compras → Estoque (SC + Inventário) ──
  | "hub_obra_sc_criar"
  | "hub_obra_estoque_consultar"
  // ── A0: Arquitetura/Projeto (não dependem de canal WhatsApp) ──
  | "arq_resumo"
  | "arq_criar_projeto"
  | "arq_mover_estagio"
  | "arq_programa_item"
  // ── A1: Aprovação do cliente (escrita crítica) ──
  | "arq_enviar_aprovacao"
  | "arq_registrar_aprovacao"
  // ── A2: Elo Gerar Obra (projeto → obra; escrita, gate dourado) ──
  | "arq_gerar_obra";

export type HubAgenteFerramentaCatalogo = {
  id: HubAgenteFerramentaId;
  categoria: HubFerramentaCategoria;
  /** Rótulo curto na UI */
  titulo: string;
  descricao: string;
  /** Sugestão de pré-ligar em atendimento WhatsApp (não força default no servidor) */
  recomendadoWhatsApp: boolean;
  mistralFunction: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const HUB_AGENTE_FERRAMENTAS_CATALOGO: readonly HubAgenteFerramentaCatalogo[] = [
  {
    id: "hub_lead_resumo",
    categoria: "cliente",
    titulo: "Resumo do cliente (lead)",
    descricao:
      "Consulta estágio, dados de contacto e responsáveis no CRM para responder com factos sobre esta conversa.",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_lead_resumo",
      description:
        "Obtém um resumo factual do lead actual nesta conversa no CRM. Use antes de afirmar estado do negócio.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_lead_memorias",
    categoria: "cliente",
    titulo: "Memórias sobre o cliente",
    descricao:
      "Lista notas automáticas ou memorias guardadas sobre este cliente (preferências, histórico relevante).",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_lead_memorias",
      description:
        "Recupera memorias conhecidas sobre o lead (preferências, objeções, histórico relevante). Chame quando precisar lembrar contexto.",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "N máximo de memorias (1–10). Omita para 5.",
            minimum: 1,
            maximum: 10,
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_lead_lookup_por_telefone",
    categoria: "cliente",
    titulo: "Consultar lead por telefone",
    descricao:
      "Consulta a ficha CRM **só do telefone desta conversa** (isolamento). Para a sessão actual prefira hub_lead_resumo.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_lead_lookup_por_telefone",
      description:
        "Consulta lead/pessoa no CRM apenas pelo telefone **desta** conversa WhatsApp (o mesmo da sessão). Não use para pesquisar outros números. Se omitir telefone, usa o da sessão. Não cria nem altera dados.",
      parameters: {
        type: "object",
        properties: {
          telefone: {
            type: "string",
            description:
              "Opcional — só o telefone desta conversa (será validado). Omita para usar o número da sessão.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_metricas_escritorio",
    categoria: "analise",
    titulo: "Métricas rápidas do escritório",
    descricao:
      "Devolve contagens agregadas (total de leads no tenant e volume recente de acções/atividade ligadas a este modelo). Só leitura.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_metricas_escritorio",
      description:
        "Obtém contagens agregadas do CRM para contextualizar respostas (escopo tenant + agente). Não substitui relatório financeiro completo.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_relatorio_html_simples",
    categoria: "analise",
    titulo: "Página HTML + link público",
    descricao:
      "Gera uma página HTML simples (título + texto em segurança), guarda no armazenamento e devolve um URL para abrir noutra janela.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_relatorio_html_simples",
      description:
        "Gera relatório HTML minimalista com texto plano escapado e devolve URL público. Use quando o utilizador pedir página para partilhar ou rever fora do chat.",
      parameters: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Título curto da página (obrigatório).",
          },
          texto_plano: {
            type: "string",
            description: "Corpo em texto simples (sem HTML); será escapado no servidor.",
          },
        },
        required: ["titulo", "texto_plano"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_atualizar_lead",
    categoria: "registos",
    titulo: "Atualizar lead no CRM",
    descricao:
      "Grava campos permitidos na ficha do cliente (hub_leads_crm): estágio, score, valor, interesse, follow-up, tags, metadata.",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_atualizar_lead",
      description:
        "Actualiza a ficha do lead desta conversa no CRM (WhatsApp). O telefone já está no sistema — não peça número. Grave nome, e-mail, interesse_principal, valor_estimado, score, proxima_acao e metadata (fluxo, cidade, potencial) sempre que o cliente revelar algo novo, na mesma volta da resposta, sem anunciar «salvar no CRM». Não use estágios ganho/perdido. Envie só campos que mudaram.",
      parameters: {
        type: "object",
        properties: {
          estagio: {
            type: "string",
            enum: ["novo", "qualificando", "qualificado", "proposta", "negociando", "fechamento"],
            description: "Estágio no pipeline (ganho/perdido bloqueados para a IA).",
          },
          score: {
            type: "integer",
            description: "Pontuação 0–100 (interesse/qualificação).",
            minimum: 0,
            maximum: 100,
          },
          valor_estimado: {
            type: "number",
            description: "Valor estimado do negócio (número, ex.: 150000).",
            minimum: 0,
          },
          nome: { type: "string", description: "Nome completo se o cliente informou." },
          email: { type: "string", description: "E-mail se informado." },
          interesse_principal: {
            type: "string",
            description: "Resumo curto do interesse (ex.: reforma cozinha, apto 3 quartos).",
          },
          proxima_acao: {
            type: "string",
            description: "Próximo passo combinado (ex.: enviar proposta, visita sábado).",
          },
          data_proxima_acao: {
            type: "string",
            description: "Data/hora ISO para follow-up (ex.: 2026-05-20T15:00:00Z).",
          },
          motivo_perda: {
            type: "string",
            description: "Documentar objeção (não altera estágio para perdido).",
          },
          tags_adicionar: {
            type: "array",
            items: { type: "string" },
            description: "Tags curtas a acrescentar (ex.: urgente, imobiliario).",
          },
          humor: { type: "string", description: "Tom detectado: neutro, positivo, irritado, etc." },
          cpf: { type: "string", description: "CPF só dígitos se o cliente forneceu." },
          endereco_completo: { type: "string", description: "Morada se informada." },
          metadata: {
            type: "object",
            description: "Chaves extra (merge JSON), ex.: mercado, quartos.",
          },
          preferencias: {
            type: "object",
            description: "Preferências (merge JSON), ex.: horario manhã.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_crm_criar_cadastro",
    categoria: "registos",
    titulo: "Criar cadastro CRM (PES + LED)",
    descricao:
      "Cria pessoa e lead no CRM após qualificação mínima. Só activo com CRM_IA_AUTO_CADASTRO. Não duplica telefone.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_crm_criar_cadastro",
      description:
        "Cria cadastro permanente (PES) e lead (LED) no CRM quando o contacto ainda não existe. Requer nome e telefone. Respeita duplicidade. Só disponível se a flag CRM_IA_AUTO_CADASTRO estiver ligada.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome completo do contacto." },
          telefone: { type: "string", description: "Telefone com DDD (preferir o da sessão WhatsApp)." },
          tipo_pessoa: { type: "string", enum: ["PF", "PJ"], description: "PF por defeito." },
          mercado: {
            type: "string",
            description: "Sigla de mercado (IMB, ARQ, RFM…). Omita IMB.",
          },
          origem: { type: "string", description: "Origem do lead (whatsapp, site…)." },
          email: { type: "string", description: "E-mail opcional." },
        },
        required: ["nome", "telefone"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_registar_nota_lead",
    categoria: "registos",
    titulo: "Registar nota na linha do tempo",
    descricao:
      "Cria uma entrada de nota na linha do tempo do cliente no CRM (sem apagar nem alterar registos existentes). Útil em atendimento.",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_registar_nota_lead",
      description:
        "Regista uma nota na timeline do lead actual (tipo nota, origem IA). Não apaga dados. Texto deve ser factual e breve.",
      parameters: {
        type: "object",
        properties: {
          texto: {
            type: "string",
            description: "Texto da nota (conteúdo visível ao equipa no CRM).",
          },
        },
        required: ["texto"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_whatsapp_menu",
    categoria: "cliente",
    titulo: "Menu WhatsApp (botões, lista, enquete ou carrossel)",
    descricao:
      "Envia mensagem interactiva via WhatsApp ao número deste lead: botões, lista, enquete ou carrossel (rede finita OpenAPI: /send/menu e /send/carousel).",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_whatsapp_menu",
      description:
        "Envia menu interactivo no WhatsApp desta conversa (UAZAPI). Use quando precisar de escolhas claras: botões (poucas opções), lista (muitas linhas), enquete (selecção múltipla) ou carrossel (cartões com imagem e botões). O número é o do lead; só em agentes modo canal WhatsApp.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["button", "list", "poll", "carousel"],
            description:
              "button — respostas rápidas; list — lista com secções (use linhas que começam com [Título] na doc UAZAPI); poll — enquete; carousel — opções em texto (choices) ou cartões com imagem (cartoes_carrossel + /send/carousel).",
          },
          texto: {
            type: "string",
            description: "Texto principal da mensagem (cabeçalho do menu).",
          },
          opcoes: {
            type: "array",
            description:
              "Lista de choices (obrigatória para /send/menu). Formatos avançados de lista: ver OpenAPI UAZAPI (ex.: Título|id|subtítulo). Para carrossel só com cartoes_carrossel pode ser array vazio.",
            items: { type: "string" },
          },
          rodape: {
            type: "string",
            description: "Texto de rodapé opcional (footerText).",
          },
          texto_botao_lista: {
            type: "string",
            description: "Rótulo do botão que abre a lista (listButton); relevante para type list.",
          },
          max_opcoes_selecionaveis: {
            type: "integer",
            description: "Para enquetes: número máximo de opções que o utilizador pode escolher (selectableCount).",
            minimum: 1,
            maximum: 20,
          },
          url_imagem_botao: {
            type: "string",
            description: "URL da imagem em menus tipo button (imageButton).",
          },
          numero_destino: {
            type: "string",
            description: "Override opcional do número (DDI+…); por defeito usa telefone do lead no CRM.",
          },
          cartoes_carrossel: {
            type: "array",
            description:
              "Se preenchido com tipo carousel, envia via POST /send/carousel (cartões com imagem e botões). Cada cartão: texto_cartao, url_imagem opcional, botoes [{ id, rotulo, tipo: REPLY|URL|COPY|CALL }].",
            items: {
              type: "object",
              properties: {
                texto_cartao: { type: "string", description: "Texto do cartão (pode ter quebras de linha)." },
                url_imagem: { type: "string", description: "URL https da imagem do cartão." },
                botoes: {
                  type: "array",
                  description: "Botões do cartão (máx. ~3 por cartão no WhatsApp).",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "Valor enviado no chat (REPLY), URL completa (URL), texto a copiar (COPY), telefone (CALL).",
                      },
                      rotulo: { type: "string", description: "Texto visível no botão." },
                      tipo: {
                        type: "string",
                        enum: ["REPLY", "URL", "COPY", "CALL"],
                        description: "REPLY — resposta; URL — abrir link; COPY — copiar; CALL — telefonar.",
                      },
                    },
                    required: ["id", "rotulo", "tipo"],
                  },
                },
              },
              required: ["texto_cartao", "botoes"],
            },
          },
        },
        required: ["tipo", "texto"],
        additionalProperties: false,
      },
    },
  },
  // ── E0: Engenharia / Obra ──────────────────────────────────────────────────
  {
    id: "hub_obra_listar",
    categoria: "obra",
    titulo: "Listar obras da carteira",
    descricao: "Lista as obras do escritório (código, título, tipo, status). Só leitura.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_listar",
      description:
        "Lista as obras da carteira do tenant (código, título, tipo, status). Use para responder 'quais obras', 'obras em andamento', etc. Não cria nem altera dados.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filtro opcional por status (ex.: ativa, pausada)." },
          tipo_obra: {
            type: "string",
            description: "Filtro opcional por tipo (construcao, reforma, servico…).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_obra_resumo",
    categoria: "obra",
    titulo: "Resumo de uma obra",
    descricao: "Resumo de UMA obra (dados + nº de frentes da EAP). Só leitura.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_resumo",
      description:
        "Obtém o resumo factual de uma obra (status, tipo, cliente, frentes da EAP). Use o obra_id da tela quando houver. Não altera dados.",
      parameters: {
        type: "object",
        properties: {
          obra_id: { type: "string", description: "ID da obra (opcional; usa a da tela se omitido)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_obra_hoje",
    categoria: "obra",
    titulo: "Fila de decisões do dia (Hoje)",
    descricao:
      "Cockpit do dia: obras com fases atrasadas, marcos nos próximos 15 dias e bloqueios (ocorrências críticas / pedidos abertos). Só leitura.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_hoje",
      description:
        "Resume a fila de decisões do dia das obras do tenant: contadores (atrasados, próximos 15 dias, bloqueios), as fases atrasadas e os bloqueios atuais. Use para 'o que pede decisão hoje', 'o que está atrasado nas obras', 'tem bloqueio'. Não altera dados.",
      parameters: {
        type: "object",
        properties: {
          negocio_id: {
            type: "string",
            description: "Filtro opcional: só obras de um negócio.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_obra_criar",
    categoria: "obra",
    titulo: "Criar obra (com EAP do preset)",
    descricao:
      "Cria uma obra nova com código automático e a EAP pré-montada do preset do tipo. Escrita — exige confirmação do dono.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_criar",
      description:
        "Cria uma obra nova (código automático por tenant) e monta a EAP do preset do tipo. Só propõe — o dono confirma. Não duplica obras com o mesmo título em menos de 1 minuto.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Nome curto da obra (ex.: 'Reforma do Consulado')." },
          tipo_obra: {
            type: "string",
            enum: ["construcao", "reforma", "servico", "manutencao", "consultoria", "projeto", "assistencia"],
            description: "Tipo da obra (reforma por padrão).",
          },
          cliente_pessoa_id: { type: "string", description: "ID da pessoa cliente, se conhecido." },
          cliente_empresa_id: { type: "string", description: "ID da empresa cliente, se conhecido." },
          negocio_id: { type: "string", description: "Negócio de origem, se houver." },
        },
        required: ["titulo"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_obra_eap_montar",
    categoria: "obra",
    titulo: "Montar/adicionar frente na EAP",
    descricao:
      "Adiciona uma frente (disciplina) à EAP de uma obra existente. Escrita — exige confirmação do dono.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_eap_montar",
      description:
        "Adiciona uma frente (disciplina) à EAP de uma obra existente. A frente entra ativa, no fim da ordem. Só propõe — o dono confirma.",
      parameters: {
        type: "object",
        properties: {
          obra_id: { type: "string", description: "ID da obra (use a da tela se houver)." },
          disciplina_slug: {
            type: "string",
            description: "Slug da disciplina do catálogo (ex.: eletrica, hidraulica, civil).",
          },
          nome: { type: "string", description: "Nome da frente (opcional; deriva da disciplina)." },
        },
        required: ["disciplina_slug"],
        additionalProperties: false,
      },
    },
  },
  // ── E2: Itens × Subitens (Situação auto × Andamento manual) ─────────────────
  {
    id: "hub_obra_item_listar",
    categoria: "obra",
    titulo: "Listar itens da obra (avanço/situação)",
    descricao:
      "Lista os itens de contrato da obra por disciplina/andar/situação (avanço, situação automática, andamento manual, bloqueios). Só leitura.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_item_listar",
      description:
        "Lista itens de uma obra com avanço, situação (calculada pelo prazo) e andamento. Filtra por disciplina, andar/área ou situação (ex.: 'atrasado'). Use para 'o que está atrasado na elétrica do andar 8', 'itens da pintura', 'o que está bloqueado'. Não altera dados.",
      parameters: {
        type: "object",
        properties: {
          obra_id: { type: "string", description: "ID da obra (use o da tela se houver)." },
          disciplina_slug: {
            type: "string",
            description: "Filtro por disciplina (ex.: eletrica, hidraulica, civil, pintura).",
          },
          area_codigo: {
            type: "string",
            description: "Filtro por andar/área (ex.: ANDAR8, ROOFTOP, HALLS).",
          },
          situacao: {
            type: "string",
            enum: ["a_iniciar", "em_andamento", "atencao", "atrasado", "concluido", "sem_data", "cancelado"],
            description: "Filtro pela situação automática (prazo).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_obra_item_avanco",
    categoria: "obra",
    titulo: "Marcar avanço de um item (%)",
    descricao:
      "Define o % de avanço de um item da obra (slider via voz). Escrita — exige confirmação do dono. A situação é recalculada sozinha pelo prazo.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_item_avanco",
      description:
        "Define o percentual de avanço (0–100) de um item da obra. Identifique o item por item_id (preferido) OU por nome+obra. Use para 'marca 60% na alvenaria do andar 8'. Se houver mais de um item com o mesmo nome (andares diferentes), peça para o dono escolher antes — não aplique a vários. Só propõe; o dono confirma.",
      parameters: {
        type: "object",
        properties: {
          obra_id: { type: "string", description: "ID da obra (use o da tela)." },
          item_id: { type: "string", description: "ID exato do item, se conhecido (preferido)." },
          nome: { type: "string", description: "Nome do item, se não tiver o id (ex.: 'Alvenaria')." },
          area_codigo: { type: "string", description: "Andar/área para desambiguar (ex.: ANDAR8)." },
          pct_avanco: {
            type: "number",
            description: "Percentual de 0 a 100.",
            minimum: 0,
            maximum: 100,
          },
        },
        required: ["pct_avanco"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_obra_item_andamento",
    categoria: "obra",
    titulo: "Mudar andamento de um item",
    descricao:
      "Declara o andamento manual de um item (iniciado/paralisado/finalizado/cancelado) e marca bloqueios (falta material/pessoa…). Escrita — exige confirmação; finalizado/cancelado têm gate reforçado.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_item_andamento",
      description:
        "Muda o andamento manual de um item (nao_iniciado, iniciado, paralisado, finalizado, cancelado) e/ou marca bloqueios (falta material/pessoa/documento/ferramenta/equipamento). Use para 'item 3.2 paralisado, falta cimento'. Identifique por item_id (preferido) OU nome+andar. finalizado/cancelado são decisões fortes — descreva claramente. Só propõe; o dono confirma.",
      parameters: {
        type: "object",
        properties: {
          obra_id: { type: "string", description: "ID da obra (use o da tela)." },
          item_id: { type: "string", description: "ID exato do item, se conhecido (preferido)." },
          nome: { type: "string", description: "Nome do item, se não tiver o id." },
          area_codigo: { type: "string", description: "Andar/área para desambiguar." },
          andamento: {
            type: "string",
            enum: ["nao_iniciado", "iniciado", "paralisado", "finalizado", "cancelado"],
            description: "Novo andamento manual.",
          },
          falta_pessoa: { type: "boolean", description: "Marca bloqueio: falta pessoa." },
          falta_documento: { type: "boolean", description: "Marca bloqueio: falta documento." },
          falta_material: { type: "boolean", description: "Marca bloqueio: falta material." },
          falta_ferramenta: { type: "boolean", description: "Marca bloqueio: falta ferramenta." },
          falta_equipamento: { type: "boolean", description: "Marca bloqueio: falta equipamento." },
        },
        additionalProperties: false,
      },
    },
  },
  // ── E3: Restrições / Bloqueios de 1ª classe ─────────────────────────────────
  {
    id: "hub_obra_bloqueios_listar",
    categoria: "obra",
    titulo: "Listar bloqueios do dia (restrições)",
    descricao:
      "Lista o que trava as obras agora: faltas (material/pessoa/documento/ferramenta/equipamento) com impacto e responsável. Só leitura.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_bloqueios_listar",
      description:
        "Lista os bloqueios (restrições) ativos das obras: tipo (material/pessoa/documento/ferramenta/equipamento), impacto (trava/atrasa/observa), responsável e prazo. Use para 'o que trava hoje', 'o que está bloqueado na obra X', 'o que falta na elétrica'. Não altera dados.",
      parameters: {
        type: "object",
        properties: {
          obra_id: { type: "string", description: "ID da obra (opcional; sem ele lista de todas as obras)." },
          tipo: {
            type: "string",
            enum: ["material", "pessoa", "documento", "ferramenta", "equipamento", "outro"],
            description: "Filtro opcional pelo tipo de falta.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_obra_bloqueio_criar",
    categoria: "obra",
    titulo: "Registrar bloqueio (falta material/pessoa…)",
    descricao:
      "Registra uma restrição num item ou na obra (falta material/pessoa/documento/ferramenta/equipamento). Escrita — exige confirmação do dono.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_bloqueio_criar",
      description:
        "Registra um bloqueio (restrição) num item da obra ou na obra inteira. Identifique o item por item_id (preferido) OU nome+andar; sem item, cria bloqueio da frente/obra. Use para 'tá faltando cimento no andar 9', 'falta pedreiro na alvenaria'. Liga o bloqueio ao item (boolean falta_*). Se houver mais de um item com o mesmo nome, o sistema pede para escolher. Só propõe; o dono confirma.",
      parameters: {
        type: "object",
        properties: {
          obra_id: { type: "string", description: "ID da obra (use o da tela)." },
          tipo: {
            type: "string",
            enum: ["material", "pessoa", "documento", "ferramenta", "equipamento", "outro"],
            description: "O que falta (material, pessoa, documento, ferramenta, equipamento).",
          },
          item_id: { type: "string", description: "ID exato do item, se conhecido (preferido)." },
          nome: { type: "string", description: "Nome do item, se não tiver o id (ex.: 'Alvenaria')." },
          area_codigo: { type: "string", description: "Andar/área para desambiguar (ex.: ANDAR9)." },
          frente_id: { type: "string", description: "ID da frente, para bloqueio da frente inteira (sem item)." },
          titulo: { type: "string", description: "Resumo curto do bloqueio (ex.: 'falta cimento CP-II')." },
        },
        required: ["tipo"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_obra_bloqueio_resolver",
    categoria: "obra",
    titulo: "Resolver bloqueio (chegou/destravou)",
    descricao:
      "Marca um bloqueio como resolvido e limpa a falta no item. Escrita — gate reforçado (decisão forte). SST de documento não resolve por voz.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_bloqueio_resolver",
      description:
        "Resolve um bloqueio (restrição) da obra: marca resolvida e limpa o falta_* do item. Identifique por restricao_id (preferido) OU item (nome/id) + tipo. Use para 'o cimento do 9 chegou', 'já tem pedreiro na alvenaria'. Documento de SST NÃO é resolvido por voz (regularização auditada). Só propõe; o dono confirma (gate reforçado).",
      parameters: {
        type: "object",
        properties: {
          obra_id: { type: "string", description: "ID da obra (use o da tela)." },
          restricao_id: { type: "string", description: "ID da restrição, se conhecido (preferido)." },
          tipo: {
            type: "string",
            enum: ["material", "pessoa", "documento", "ferramenta", "equipamento", "outro"],
            description: "Tipo do bloqueio a resolver (quando identificar por item).",
          },
          item_id: { type: "string", description: "ID do item, se identificar por item." },
          nome: { type: "string", description: "Nome do item, se não tiver o id." },
          area_codigo: { type: "string", description: "Andar/área para desambiguar." },
        },
        additionalProperties: false,
      },
    },
  },
  // ── E5: Compras → Estoque (SC + Inventário) ─────────────────────────────────
  {
    id: "hub_obra_estoque_consultar",
    categoria: "obra",
    titulo: "Consultar estoque da obra (inventário)",
    descricao:
      "Consulta o inventário da obra (em estoque = entradas − saídas + devoluções), com a fórmula visível. Só leitura.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_estoque_consultar",
      description:
        "Consulta o inventário de uma obra (quanto há em estoque de cada material/equipamento, derivado das movimentações). Use para 'quanto cimento tem', 'tem vergalhão no estoque', 'o que está zerado'. Filtra por item (texto) e categoria. Não altera dados.",
      parameters: {
        type: "object",
        properties: {
          obra_id: { type: "string", description: "ID da obra (use o da tela)." },
          item: { type: "string", description: "Filtro por nome do item (ex.: cimento)." },
          categoria: {
            type: "string",
            enum: ["material", "equipamento", "servico", "mao_de_obra"],
            description: "Filtro opcional pela categoria.",
          },
        },
        required: ["obra_id"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_obra_sc_criar",
    categoria: "obra",
    titulo: "Criar SC (solicitação de compra)",
    descricao:
      "Cria uma solicitação de compra em RASCUNHO para a obra (item do catálogo + quantidade). A IA prepara — aprovar a compra é decisão humana na tela. Escrita.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_obra_sc_criar",
      description:
        "Cria uma SC (solicitação de compra) em RASCUNHO para a obra, com um item e a quantidade. Faz match do item no catálogo (ex.: 'cimento' → Cimento CP-II). Use para 'pede 50 sacos de cimento', 'preciso comprar vergalhão 10mm'. A SC nasce em rascunho — APROVAR A COMPRA É DECISÃO HUMANA NA TELA (nunca por voz). Se o item casar com vários do catálogo, o sistema pede para escolher antes. Só propõe; o dono confirma.",
      parameters: {
        type: "object",
        properties: {
          obra_id: { type: "string", description: "ID da obra (use o da tela)." },
          item: { type: "string", description: "O que comprar (ex.: cimento CP-II, vergalhão 10mm)." },
          quantidade: { type: "number", description: "Quantidade a comprar (ex.: 50).", minimum: 0 },
          tipo_material: {
            type: "string",
            enum: ["material", "equipamento", "servico", "mao_de_obra"],
            description: "Categoria do item (material por padrão).",
          },
          frente_id: { type: "string", description: "ID da frente da EAP, se a compra é de uma frente específica." },
        },
        required: ["obra_id", "item", "quantidade"],
        additionalProperties: false,
      },
    },
  },
  // ── A0: Arquitetura / Projeto ───────────────────────────────────────────────
  {
    id: "arq_resumo",
    categoria: "arquitetura",
    titulo: "Resumo dos projetos (Arquitetura)",
    descricao: "Lista os projetos da carteira (código, cliente, tipologia, estágio, aprovação). Só leitura.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "arq_resumo",
      description:
        "Lista os projetos de arquitetura do tenant (código, cliente, tipologia, estágio, status de aprovação). Use para responder 'o que está parado em aprovação', 'projetos em andamento', etc. Não cria nem altera dados.",
      parameters: {
        type: "object",
        properties: {
          estagio: {
            type: "string",
            description: "Filtro opcional por estágio (ex.: aprovacao, anteprojeto, executivo).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "arq_criar_projeto",
    categoria: "arquitetura",
    titulo: "Criar projeto de arquitetura",
    descricao:
      "Cria um projeto novo com código automático (PRJ-AAAA-NNNN por tenant), em Briefing. Escrita — exige confirmação do dono.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "arq_criar_projeto",
      description:
        "Cria um projeto de arquitetura novo (código automático por tenant) em Briefing. Só propõe — o dono confirma. Não duplica projetos com o mesmo título em menos de 1 minuto.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Nome do projeto (opcional; deriva do cliente/tipologia)." },
          tipologia: {
            type: "string",
            description: "Tipologia (residencial, corporativo, interiores, reforma, comercial, paisagismo). Residencial por padrão.",
          },
          cliente_nome: { type: "string", description: "Nome do cliente (desnormalizado para o card)." },
          cliente_pessoa_id: { type: "string", description: "ID da pessoa cliente, se conhecido." },
          cliente_empresa_id: { type: "string", description: "ID da empresa cliente, se conhecido." },
          area_m2: { type: "number", description: "Área em m² (opcional)." },
          negocio_id: { type: "string", description: "Negócio de origem, se houver." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "arq_mover_estagio",
    categoria: "arquitetura",
    titulo: "Mover projeto de estágio",
    descricao: "Move um projeto para outro estágio do funil. Escrita — exige confirmação do dono.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "arq_mover_estagio",
      description:
        "Move um projeto para outro estágio do funil de arquitetura (briefing, estudo, anteprojeto, executivo, aprovacao, entregue, arquivado). Valida o estágio contra o funil. Só propõe — o dono confirma.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string", description: "ID do projeto (use o da tela se houver)." },
          estagio: {
            type: "string",
            description: "Estágio de destino (briefing, estudo, anteprojeto, executivo, aprovacao, entregue, arquivado).",
          },
        },
        required: ["projeto_id", "estagio"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "arq_programa_item",
    categoria: "arquitetura",
    titulo: "Montar programa (cômodos)",
    descricao:
      "Adiciona cômodos ao programa do projeto (sala, suítes, cozinha…). Escrita — exige confirmação do dono.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "arq_programa_item",
      description:
        "Adiciona um ou mais cômodos ao Programa do projeto (ambientes). Aceita uma lista de nomes ou objetos {nome, metragem_m2?, categoria?}. Só propõe — o dono confirma.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string", description: "ID do projeto (use o da tela)." },
          itens: {
            type: "array",
            description: "Cômodos a adicionar. Cada item: string (nome) OU objeto {nome, metragem_m2?, categoria?}.",
            items: {
              type: "object",
              properties: {
                nome: { type: "string", description: "Nome do cômodo (ex.: Suíte máster)." },
                metragem_m2: { type: "number", description: "Metragem em m² (opcional)." },
                categoria: { type: "string", description: "ambiente | servico | lazer | tecnico (opcional)." },
              },
              required: ["nome"],
            },
          },
        },
        required: ["projeto_id", "itens"],
        additionalProperties: false,
      },
    },
  },
  // ── A1: Aprovação do cliente (escrita CRÍTICA — gate dourado obrigatório) ────
  {
    id: "arq_enviar_aprovacao",
    categoria: "arquitetura",
    titulo: "Enviar entregável para aprovação",
    descricao:
      "Marca um entregável (estudo, anteprojeto, executivo) como enviado ao cliente para aprovação. Escrita — exige confirmação do dono.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "arq_enviar_aprovacao",
      description:
        "Envia (ou reenvia com revisão) um entregável do projeto para o cliente aprovar. Exige que o entregável tenha arquivo (entregavel_url) — se faltar, devolve aviso para anexar primeiro. Recalcula a situação de aprovação do projeto. Só propõe — o dono confirma.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string", description: "ID do projeto (use o da tela)." },
          fase_id: { type: "string", description: "ID do entregável (fase tipo='fase') a enviar." },
          entregavel_url: { type: "string", description: "URL do arquivo do entregável, se for anexar agora (opcional)." },
          observacao: { type: "string", description: "Observação opcional para o histórico do envio." },
        },
        required: ["projeto_id", "fase_id"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "arq_registrar_aprovacao",
    categoria: "arquitetura",
    titulo: "Registrar resposta do cliente",
    descricao:
      "Lança a decisão do cliente (aprovado ou rejeitado) sobre um entregável que está aguardando. Reprovação exige motivo. Escrita — exige confirmação do dono.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "arq_registrar_aprovacao",
      description:
        "Registra a resposta do cliente sobre um entregável que está aguardando (enviado): 'aprovado' ou 'rejeitado'. Rejeitado EXIGE motivo_rejeicao. Recalcula a situação de aprovação do projeto; se tudo ficar aprovado, sugere mover o projeto para Entregue (não move sozinho). Só propõe — o dono confirma.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string", description: "ID do projeto (use o da tela)." },
          fase_id: { type: "string", description: "ID do entregável (fase tipo='fase') respondido." },
          decisao: {
            type: "string",
            enum: ["aprovado", "rejeitado"],
            description: "A decisão do cliente.",
          },
          motivo_rejeicao: {
            type: "string",
            description: "Motivo da reprovação (OBRIGATÓRIO quando decisao='rejeitado').",
          },
        },
        required: ["projeto_id", "fase_id", "decisao"],
        additionalProperties: false,
      },
    },
  },
  // ── A2: Elo Gerar Obra (projeto → obra) ─────────────────────────────────────
  {
    id: "arq_gerar_obra",
    categoria: "arquitetura",
    titulo: "Gerar obra do projeto",
    descricao:
      "Cria a obra de engenharia a partir de um projeto ENTREGUE/APROVADO, herdando título, tipo, cliente, área e negócio, e vincula projeto↔obra. Idempotente (1 obra por projeto). Escrita — exige confirmação do dono.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "arq_gerar_obra",
      description:
        "Gera a obra de engenharia a partir de um projeto de arquitetura. Identifique o projeto por projeto_id (use o da tela) OU por título. O projeto precisa estar ENTREGUE ou com aprovação APROVADA — senão o sistema avisa. Se o projeto JÁ tem obra, devolve a existente (não duplica). A obra herda título, cliente, área e negócio; o tipo_obra é derivado da tipologia (pode sobrepor). Só propõe — o dono confirma.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string", description: "ID do projeto (use o da tela se houver)." },
          titulo: { type: "string", description: "Nome do projeto, se não tiver o id (resolve por título, tenant-scoped)." },
          tipo_obra: {
            type: "string",
            enum: ["construcao", "reforma", "servico", "manutencao", "consultoria", "projeto", "assistencia"],
            description: "Sobrepõe o tipo derivado da tipologia (opcional).",
          },
          nome_obra: { type: "string", description: "Nome da obra, se diferente do título do projeto (opcional)." },
        },
        additionalProperties: false,
      },
    },
  },
] as const;

const IDS = new Set(HUB_AGENTE_FERRAMENTAS_CATALOGO.map((t) => t.id));

export function isHubAgenteFerramentaId(v: string): v is HubAgenteFerramentaId {
  return IDS.has(v as HubAgenteFerramentaId);
}

/** Aceita boolean JSONB e valores às vezes devolvidos como string/número (APIs legadas, cópias). */
function coalesceFerramentaBool(v: unknown): boolean | undefined {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  if (v === false || v === "false" || v === 0 || v === "0") return false;
  return undefined;
}

/** Mapa id → ativo; chaves desconhecidas são ignoradas. */
export function normalizarUsoFerramentasIa(raw: unknown): Partial<Record<HubAgenteFerramentaId, boolean>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<HubAgenteFerramentaId, boolean>> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!isHubAgenteFerramentaId(k)) continue;
    const b = coalesceFerramentaBool(v);
    if (b !== undefined) out[k] = b;
  }
  return out;
}

export function ferramentasMistralParaAgente(
  uso: Partial<Record<HubAgenteFerramentaId, boolean>>
): Array<{ type: "function"; function: HubAgenteFerramentaCatalogo["mistralFunction"] }> {
  const out: Array<{ type: "function"; function: HubAgenteFerramentaCatalogo["mistralFunction"] }> = [];
  for (const item of HUB_AGENTE_FERRAMENTAS_CATALOGO) {
    if (uso[item.id] === true) {
      out.push({ type: "function", function: item.mistralFunction });
    }
  }
  return out;
}

/** Chaves `hub_custom_*` no JSON de uso (activação por agente). */
export function extrairUsoFerramentasCustomIa(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!k.startsWith("hub_custom_")) continue;
    const b = coalesceFerramentaBool(v);
    if (b !== undefined) out[k] = b;
  }
  return out;
}

/** Mapa estável para builtins + booleans para ferramentas custom preservadas do `raw`. */
export function mergeUsoFerramentasComPadraoPreservandoCustom(raw: unknown): Record<string, boolean> {
  const base = mergeUsoFerramentasComPadrao(normalizarUsoFerramentasIa(raw));
  const custom = extrairUsoFerramentasCustomIa(raw);
  return { ...base, ...custom };
}

export type FerramentaCustomDefMistral = {
  ferramenta_key: string;
  descricao_modelo: string;
  parametros_schema: Record<string, unknown>;
};

/** Lista completa para Mistral: catálogo fixo + linhas custom do tenant. */
export function ferramentasMistralListaParaAgente(
  uso: Record<string, boolean>,
  customDefs: FerramentaCustomDefMistral[]
): MistralChatToolDefinition[] {
  const out: MistralChatToolDefinition[] = [];
  for (const item of HUB_AGENTE_FERRAMENTAS_CATALOGO) {
    if (uso[item.id] === true) {
      out.push({ type: "function", function: item.mistralFunction });
    }
  }
  for (const c of customDefs) {
    if (uso[c.ferramenta_key] === true) {
      out.push({
        type: "function",
        function: {
          name: c.ferramenta_key,
          description: c.descricao_modelo,
          parameters: c.parametros_schema,
        },
      });
    }
  }
  return out;
}

export function catalogoBuiltinPorId(id: HubAgenteFerramentaId): HubAgenteFerramentaCatalogo | undefined {
  return HUB_AGENTE_FERRAMENTAS_CATALOGO.find((t) => t.id === id);
}

export function mergeUsoFerramentasComPadrao(
  uso: Partial<Record<HubAgenteFerramentaId, boolean>>
): Record<HubAgenteFerramentaId, boolean> {
  const base: Record<HubAgenteFerramentaId, boolean> = {
    hub_lead_resumo: false,
    hub_lead_memorias: false,
    hub_lead_lookup_por_telefone: false,
    hub_metricas_escritorio: false,
    hub_relatorio_html_simples: false,
    hub_registar_nota_lead: false,
    hub_whatsapp_menu: false,
    hub_atualizar_lead: false,
    hub_crm_criar_cadastro: false,
    hub_obra_listar: false,
    hub_obra_resumo: false,
    hub_obra_hoje: false,
    hub_obra_criar: false,
    hub_obra_eap_montar: false,
    hub_obra_item_listar: false,
    hub_obra_item_avanco: false,
    hub_obra_item_andamento: false,
    hub_obra_bloqueios_listar: false,
    hub_obra_bloqueio_criar: false,
    hub_obra_bloqueio_resolver: false,
    hub_obra_sc_criar: false,
    hub_obra_estoque_consultar: false,
    arq_resumo: false,
    arq_criar_projeto: false,
    arq_mover_estagio: false,
    arq_programa_item: false,
    arq_enviar_aprovacao: false,
    arq_registrar_aprovacao: false,
    arq_gerar_obra: false,
  };
  for (const id of Object.keys(base) as HubAgenteFerramentaId[]) {
    if (coalesceFerramentaBool(uso[id]) === true) base[id] = true;
  }
  return base;
}

/**
 * Primeiro atendimento WhatsApp: ferramentas de leitura/escrita no CRM activadas por defeito.
 * `hub_whatsapp_menu` permanece activo salvo desligado explicitamente no agente (triagem list/button).
 */
export function mergeUsoFerramentasWhatsappCanal(
  uso: Partial<Record<HubAgenteFerramentaId, boolean>>,
  modoOperacao?: string | null
): Record<HubAgenteFerramentaId, boolean> {
  const base = mergeUsoFerramentasComPadrao(uso);
  if (modoOperacao === "canal_whatsapp") {
    if (coalesceFerramentaBool(uso.hub_atualizar_lead) !== false) base.hub_atualizar_lead = true;
    if (coalesceFerramentaBool(uso.hub_lead_memorias) !== false) base.hub_lead_memorias = true;
    if (coalesceFerramentaBool(uso.hub_lead_resumo) !== false) base.hub_lead_resumo = true;
    if (coalesceFerramentaBool(uso.hub_whatsapp_menu) !== false) base.hub_whatsapp_menu = true;
    if (coalesceFerramentaBool(uso.hub_registar_nota_lead) !== false) base.hub_registar_nota_lead = true;
  }
  return base;
}

export const HUB_FERRAMENTA_SECAO_LABEL: Record<HubFerramentaCategoria, string> = {
  cliente: "Dados do cliente nesta conversa",
  analise: "Análise e partilha",
  registos: "Registos no CRM",
  obra: "Engenharia e obras",
  arquitetura: "Arquitetura e projetos",
};

/** Efeito em dados ou storage (UI / CRM — catálogo fixo no código). */
export type HubFerramentaNivelAcesso = "leitura" | "escrita";

export const HUB_FERRAMENTA_ACESSO: Record<HubAgenteFerramentaId, HubFerramentaNivelAcesso> = {
  hub_lead_resumo: "leitura",
  hub_lead_memorias: "leitura",
  hub_lead_lookup_por_telefone: "leitura",
  hub_metricas_escritorio: "leitura",
  hub_relatorio_html_simples: "escrita",
  hub_registar_nota_lead: "escrita",
  hub_whatsapp_menu: "escrita",
  hub_atualizar_lead: "escrita",
  hub_crm_criar_cadastro: "escrita",
  hub_obra_listar: "leitura",
  hub_obra_resumo: "leitura",
  hub_obra_hoje: "leitura",
  hub_obra_criar: "escrita",
  hub_obra_eap_montar: "escrita",
  hub_obra_item_listar: "leitura",
  hub_obra_item_avanco: "escrita",
  hub_obra_item_andamento: "escrita",
  hub_obra_bloqueios_listar: "leitura",
  hub_obra_bloqueio_criar: "escrita",
  hub_obra_bloqueio_resolver: "escrita",
  hub_obra_estoque_consultar: "leitura",
  hub_obra_sc_criar: "escrita",
  arq_resumo: "leitura",
  arq_criar_projeto: "escrita",
  arq_mover_estagio: "escrita",
  arq_programa_item: "escrita",
  arq_enviar_aprovacao: "escrita",
  arq_registrar_aprovacao: "escrita",
  arq_gerar_obra: "escrita",
};
