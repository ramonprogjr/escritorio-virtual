---
name: distribuicao-leads-motor
description: "Motor de distribuição inteligente de leads (Bloco 2) — score de aderência fornecedor↔lead, 3 modos (auto/semi/manual), SLA com redistribuição, lead MESTRE×VINCULADO (compartilha, não duplica)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 635246fa-0a11-4787-bf12-7900cf1c8059
---

Especificação do motor de distribuição (Bloco 2 do Wendel). Parte central de [[plataforma-arquitetura-visao]].

**Fluxo:** lead entra no Hub → IA classifica demanda (projeto/reforma/marcenaria/marmoraria/construção/imóvel) → consulta fornecedores homologados → **calcula score de aderência** → direciona ao CRM do fornecedor → fornecedor vende → se fecha, vira obra/projeto/serviço.

**Critérios de score (fornecedor ideal):** tipo de serviço, cidade/região, especialidade, disponibilidade, capacidade operacional, avaliação histórica, taxa de conversão, tempo médio de resposta, volume de leads recebidos, projetos em andamento, ticket médio, qualidade, reclamações, status de homologação, nível na comunidade, plano contratado, afinidade com o cliente.

**3 modos:** Automático · Semiautomático (aprovação do Hub) · Manual. Começar controlando, automatizar com dados. Os três coexistem.

**Lead compartilhado com VÍNCULO, não duplicado:** Lead Mestre (Hub, dono do dado) + Lead Vinculado (Fornecedor, trabalha comercialmente). Histórico sincronizado; Hub pode redistribuir.

**VISIBILIDADE (confirmado Wendel, CONTROLE TOTAL):** **Hub vê TODOS os leads** da rede (qualquer fornecedor/origem/estado). **Fornecedor vê SOMENTE os dele** (os que o Hub direcionou + os que ele cadastrar); nunca a carteira do Hub nem lead de outro fornecedor. RLS: papel fornecedor filtrado por `fornecedor_id`; papel Hub/governança bypassa e vê tudo. Materializado no **Dashboard do Hub** (só cards acionáveis: leads a direcionar, SLA estourando, ranking, funil, obras em risco, financeiro). Ver [[ux-principio-click-talk-go]].

**SLA:** prazos (ex.: 1º contato 15min / atualização status 24h / proposta 48h). Estourou → IA alerta o Hub, lead volta à fila, fornecedor perde score, redistribui.

**Já existe no código (base):** roteamento configurável `resolverDestinoLead` (regras `hub_lead_routing_regras`, fallback heurístico `resolverAgenteResponsavelLead`), canais `hub_canais_entrada`, cadastro de fornecedores/especialistas. Falta: score multi-critério real, modos auto/semi, SLA com redistribuição, lead mestre×vinculado, **menu "Fornecedores"** como motor da rede.

---

**ADIÇÕES 25/jun/2026 (visão consolidada do dono — caprichar, IA-first e conversacional):**

- **5 indicações + escolher/aprovar/encaminhar:** o sistema TRAZ os **5 fornecedores** que mais atendem o lead (por **similaridade** características-lead×fornecedor + **classificação/ranking** do fornecedor); o admin **escolhe, aprova e encaminha** (1 toque, conversacional). Ao encaminhar, o lead **entra no CRM do membro** (tenant dele) e o Hub mantém **controle total do avanço** (funil/pipeline/esteira do membro, visível ao Hub).

- **GATE de pendência (bloqueio até sanar):** se o fornecedor tem **pendência financeira**, ou **follow-up/KPI/SLA pendente**, ele recebe o lead mas **os DADOS do lead ficam bloqueados até sanar**; **ele E nós** somos sinalizados; o Hub pode **liberar o lead automaticamente** ao sanar (ou manualmente). A IA/sistema **AUDITA e COBRA** tudo (KPIs/SLAs/pendências).

- **FLYWHEEL de mérito (alocação por desempenho):** quem tem **alta aderência ao Hub** — respeita **KPIs, métricas, SLAs e entregas** + está **engajado/ativo** — recebe **MAIS leads**. Sistema+IA usam isso para **encorajar trabalhar direito e estar ativo**. O score de aderência (já listado acima) realimenta **tanto o ranking dos 5 quanto o VOLUME** de leads alocados — laço auto-melhorável.

- **Notificações robustas (multi-canal):** membro precisa receber informação de forma forte — **novos leads**, pendências, KPIs/SLAs estourando, liberações. Semente atual: cards "Alertas" no Dashboard + `hub_alertas`. Falta: sistema de notificação per-membro multi-canal (in-app + WhatsApp/email/push) e preferências.

- **Agentes do MEMBRO:** o membro deve **criar agentes** no sistema dele para trabalhos **repetitivos/administrativos/comerciais/atendimento**. Mesmo "fora" do nosso comercial, FAZ parte — porque a **IA do Hub audita e cobra** o que esses agentes (e o membro) produzem. Reaproveitar a infra de agentes existente; ver o gap Mistral→Anthropic. Casa com [[agentes-ia-llm-anthropic]].

- **ESTEIRA DE ENTREGA AUTOMÁTICA (Wendel, 25/jun):** ao **FECHAR o negócio** no CRM do membro, o sistema deve **gerar a entrega AUTOMATICAMENTE no CRM do fornecedor, na ÁREA respectiva** — obra / projeto / serviço / **marcenaria / marmoraria / vidraçaria** / etc — e o **Hub tem gestão COMPLETA**. Base já existe: `app/api/crm/negocios/[id]/converter-obra/route.ts` + `resolverTipoDerivado(mercado)` já faz `negócio ganho → obra/projeto`. **Falta:** (1) estender o mapa de tipos p/ TODOS os segmentos (marcenaria/marmoraria/vidraçaria/serviço → tabela/área própria, provável `hub_servicos` por segmento); (2) disparo **AUTOMÁTICO** no fechamento (hoje é botão manual "Gerar obra" quando ganho → virar gatilho ao mover etapa→ganho); (3) atribuir a entrega ao **fornecedor que recebeu o lead** (`distribuido_para_fornecedor_id`), Hub vê tudo. Casa com [[modulo-engenharia-obra]] e [[navegacao-renomear-operacoes-arquitetura-engenharia]] (Engenharia>Construção+Reforma; Arquitetura>Projetos). **É a FATIA "Esteira de Entrega" do plano** (docs/DISTRIBUICAO-PLANO-CEO.md).

- **Dependência-chave:** "lead no CRM do membro" + "Hub vê o funil do membro" = **multi-tenant real** (hoje `current_user_tenant_id` é fixo). Caminho de CEO: **fasear** — Fatia 1 entrega o painel dos 5 + aprovar/encaminhar (tudo visível ao dono, sem isolamento) e demonstra já; isolamento real depois. Análise file-level via workflow `distribuicao-ceo-analise`.

---

**ENTREGUE + AUDITADO 26/jun/2026:** Motor construído ponta a ponta e verificado clicando: **F1** (painel "Quem deve receber este lead?" — 5 fornecedores+encaminhar), **Esteira** (auto ao FECHAR, **UMA TABELA POR ÁREA**: `hub_obras/hub_projetos/hub_marcenaria/hub_marmoraria/hub_vidracaria/hub_servicos` via `lib/crm/derivar-negocio.ts`+`derivar-entrega.ts`), **F2** (`hub_eventos` keystone, `lib/crm/registrar-evento.ts`), **F4** ("Atividade da rede" em `app/crm/distribuicao`), **F3** (gate financeiro `status_financeiro` + flywheel IAH + liberação), **F2b** (cascata de rejeição → `app/api/crm/encaminhamentos/[id]/recusar`), **C.1a** (painel "Auditoria da rede" — KPIs de `hub_eventos`, `/api/crm/distribuicao/metricas`). **Auditor de consistência multi-agente rodado** (commit `9865cbd`): achou+corrigiu 5 críticos (provados clicando: esteira gerou OBR-2026-0004 + log na timeline).

**SESSÃO AUTÔNOMA 26/jun (mandato "todos na sequência, decisões do CEO"):** + **C.1b cobrança/aderência** (scorecards IAH por fornecedor na Auditoria da rede c/ aderência colorida + status + ações **Liberar/Cobrar**; evento `fornecedor_cobrado`→sino; `/api/crm/distribuicao/cobrar` + metricas enriquecido); + **C.2a sino de notificações** (deriva `hub_eventos`, badge + painel Click-and-Go); + **nav renomeada** (Operações/Arquitetura/Engenharia); + **vínculos N:N pessoa↔empresa securizados** (4 rotas guard+tenant; feature já existia).

**BLOQUEADO em TRAVA (exige o dono — NÃO fiz autônomo):** (1) canais de notificação ao MEMBRO (in-app per-fornecedor precisa multi-tenant; WhatsApp precisa UAZAPI; email/push precisam infra); (2) agente IA AUTÔNOMO de cobrança (cron) + SLA real (`ts_oferta`/`ts_resposta`); (3) **multi-tenant real** = flip de RLS em ~36 tabelas — plano de rollout supervisionado (aditivo→função dinâmica→RLS em lotes testados) em `docs/PLANO-MACRO-CONCLUSAO.md` §C.3. Roteiro vivo: `docs/PLANO-MACRO-CONCLUSAO.md`.

**CLASSE DE RISCO RECORRENTE (verificar SEMPRE ao mexer no motor):** (1) **drift de CHECK constraint** — `hub_atividades.tipo` só aceita `mensagem/ligacao/email/reuniao/nota/proposta/follow_up/status_change/ia_acao`; `feito_por_tipo` só `humano/ia`. Inserir valor fora disso quebra o insert **silenciosamente** (erro do supabase ignorado). (2) **vazamento cross-tenant em rota GET/ação por ID** — sempre guard + checar `tenant_id` (padrão null-safe: só bloqueia em divergência explícita, preserva linhas legadas com tenant null). Ver [[schema-rls-alinhamento-mestre]].
