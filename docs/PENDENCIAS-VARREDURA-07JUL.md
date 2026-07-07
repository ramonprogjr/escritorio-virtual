# Varredura de Pendências — o que ficou fora dos 5 docs (07/jul/2026)

> Varredura completa das fontes de pendência (mapas antigos, dívidas técnicas, sidequests, memória do CEO, TODOs do código) cruzada com o 04-Roadmap/caderno. Fonte para alimentar o MASTERPLAN. Preservado como referência.


## Veredito

NÃO está tudo capturado — mas a espinha técnica que importa está. Os 36 WIs do 04/CADERNO (RAS/MET/IA/FIN/EST/FND/OBR/LEAD/EVT/TEN/RBAC/LGPD/POR) cobrem muito bem TODO o núcleo irreversível/dinheiro/rede: linhagem pai-raiz, código único, multi-tenant + RLS Faixa B, RBAC/rotação de INTERNAL_API_KEY, escrow + motor de comissões, obra/EAP/medição (família migracao_pendente), metering/carteira/billing, engine de IA (Mistral/ml.ts/tools), motor de leads/SLA, funis por mercado, analytics/CAC, baseline migration (que destrava o E2E do CI) e anonimização LGPD. As 3 TODOs do código e a família migracao_pendente estão ancoradas em WI/Onda. Estimativa: ~96 de ~162 pendências reais (após dedup entre as 5 fontes) estão capturadas ou são já-feito. Os ÓRFÃOS (consolidados em 32 grupos) concentram-se em 6 zonas que o 04/CADERNO deliberadamente NÃO modela por ser 'backlog técnico, não laudo executivo': (1) INFRA de plataforma — logs/observabilidade unificados (Onda D), rate-limit distribuído, auditoria de AÇÃO da IA (SEC-7/hub_acoes_ia), higiene de banco/segredos e config Render/cron; (2) UX/design/mobile — sweep dos azuis off-brand, mobile-cadastros (PRIORIDADE ALTA do dono), honestidade de telas (42% falso), acessibilidade; (3) features de CRM/atividade + financeiro OPERACIONAL (contas a pagar/receber, menu ⋮ corrigir pago, próxima-ação obrigatória — gaps P0 do próprio código); (4) módulos ainda sem ficha — Produtos (hub_produtos não existe, catálogo bloqueante), Serviços/ofícios, Tarefas, Portal do Fornecedor, Configurações self-service; (5) tarefas/decisões do dono fora das tabelas 'destrava' (rotação service_role/PAT, GitHub backup, recuperar Asana, termos de uso); (6) features futuras F1-F6/campo/marketplace no 'Depois' genérico. Os mais urgentes a promover a WI JÁ: mobile-cadastros, SEC-7/auditoria-IA, R7 fail-open de papel, rotação de segredos, delete=arquiva nos 5 endpoints, e os gaps P0 do progresso-sistema (follow-up/alerta-parado/próxima-ação). Ressalva de método: li 04, CADERNO e 00-Painel; não abri 02-PRODUTO nem 01-NEGOCIO — parte dos itens de UX e decisões de produto pode estar registrada lá como texto (não como pendência acionável), mas nenhum deles aparece como WI rastreável.


**Total de pendências reais:** 162 · **já no 04/caderno:** 96 · **ÓRFÃS:** 32


## Pendências ÓRFÃS (não capturadas — a incorporar)

| Item | Fonte | Tipo | Prio | Fase sugerida |
|---|---|---|---|---|
| SEC-7 / hub_acoes_ia — IA gravar auditoria sistêmica de TUDO que escreve (tools de escrita). Explicitamente 'deferido / mesa dedicada' com ponto de injeção (executar-ferramenta-ia.ts:593, agente-ferramentas-registry.ts:1172). 04 tem RAS-03 (hub_eventos.ator_id) e 00-Painel Fase 3 cita 'auditoria em hub_eventos' — mas NENHUM WI cobre a auditoria de AÇÃO da IA em hub_acoes_ia. | BACKLOG-CONSOLIDADO L31 · DIVIDAS-TECNICAS L25 · memoria pendencias-etapa-copiloto | divida | P1 | Fase 3 (junto da Central de Aprovações) |
| Sistema de LOGS/observabilidade unificado — hub_error_logs central, helper único de auditoria em toda mutação, request_id/trace_id de correlação, logger nas ~187 rotas, PII/segredos redigidos, retenção. É a 'Onda D' e a 'base pré-produção'. Nenhum WI no 04/CADERNO (LGPD-01 é anonimização, não logging). | CONTROLE-MESTRE §7/§4.5 · MAPA roadmap-20 | infra | P1 | Fase 3/5 |
| Rate-limit distribuído (Redis) anti-abuso de custo/DoS em TUDO que toca IA (router, agentes/hub, copiloto, atendimento→worker, geração de fluxo). Dono adiou ('outro momento'). MET-* cobre créditos/metering, não rate-limit/DoS. | memoria rate-limit-ia-anti-abuso · MAPA EU-11/DONO-14 | infra | P1 | Fase 1/3 |
| Mobile não cria PF nem empresa ('não aparece'); filtros/telas 'muito ruins' — PRIORIDADE ALTA declarada (dono quer usar de verdade). Suspeita hidden md:block/breakpoints escondendo CTA/FAB/sideover. + redesign de navegação mobile (matar barra inferior/Pulso redundante, drawer). Nenhum WI. | SIDEQUEST-mobile-cadastros · SIDEQUEST-ONBOARDING-E-MENUS · MAPA EU-27 | bug | P1 | Fase 0/3 |
| Design overhaul / identidade visual: sweep dos ~97 azuis-roxos off-brand (29 arquivos) para verde+dourado + tokenizar telas de detalhe fora do CRM + CadastroPremiumSideover herda azul Shadcn. Só vive em DIVIDAS/MAPA/memoria design-overhaid; nenhum WI. | MAPA EU-24/AUT-5 · DIVIDAS L36 · memoria design-overhaid-deferido | divida | P1 | Fase 3 |
| Injetar IA de verdade nas telas-âncora (negócio/lead/atendimento hoje 100% manuais): explicar prioridade, sugerir próxima ação com data, preview de encaminhamento, card 'A IA entendeu assim', barra 'Perguntar à IA', capturar motivo ao rejeitar → vira aprendizado. IA-01 só liga o Mistral; não há WI para a IA na superfície das telas. | MAPA EU-34 | feature | P1 | Fase 3+ |
| Portal do FORNECEDOR real (hoje protótipo/403): cotações direcionadas + status + pedidos, link expirável. POR-01 cobre só o Portal do CLIENTE; não há WI para o do fornecedor. | MAPA roadmap-7 · fase5-go-live-checklist | feature | P1 | Fase 3/7 |
| Camada transversal de eventos/Notificações (F4 in-app/push) como fundação compartilhada de F1/F5/F6. EVT-01 só faz analytics consumir hub_eventos; não há WI para event-bus/notificação/push. | BACKLOG-FEATURES F4 · memoria backlog-features-futuras 27/30 | feature | P1 | Fase 3 |
| Registros/atividades por entidade e disciplina de operação: próxima-ação OBRIGATÓRIA (bloqueio global na API), follow-up automático por prazo, alerta de oportunidade parada no dashboard, timeline nos 4 cadastros, funções faltando (agendar reunião, registrar ligação/visita). São gaps P0 do próprio rastreador do código; sem WI. | progresso-sistema-data.ts (fl-aguardando/pa-obrigatoria/rf-alerta-parado) · MAPA EU-18 | feature | P0 | Fase 3 |
| Financeiro OPERACIONAL: lançamentos automáticos por evento (ganho→receber; medição/compra→pagar), contas a pagar/receber, menu ⋮ por linha para CORRIGIR pago/recebido (editar/estornar/desmarcar), consolidação de 4 fontes eliminando #REF!. FIN-01/02/03 cobrem só comissões/escrow/valor_fechado; contas a pagar-receber é órfão. | MAPA L10 (revisão ao vivo) · MAPA EU-16 | feature | P1 | Fase 2/3 |
| hub_produtos NÃO existe: Tela de Produtos + ficha + modelar PRODUTO e SERVIÇO-de-obra no schema + catálogo de materiais (~20 itens é BLOQUEANTE — Compras abre vazia) + importar ~500 itens reais. Nenhum WI (RAS-04/EST-02 só citam prefixos). | MAPA DECISÃO-31/32/roadmap-14 · progresso-sistema ent-produto-servico/nav-produtos | feature | P1 | Fase 3 |
| Módulo Serviços com todos os ofícios (marcenaria/marmoraria/vidraçaria/serralheria/pintura/elétrica) + prestadoras + cadeia encadeada + motor modelo-por-ofício. Nenhum WI. | MAPA roadmap-12 | feature | P2 | Fase futura |
| Gestor de Tarefas universal + Tela Hoje por perfil + resolver stubs de menu (/crm/conteudo G-D2, Tarefas, Ferramentas IA, agentes-reais, tráfego): esconder/Em breve/construir. Decisão + feature, sem WI. | MAPA roadmap-5/DECISÃO-26 · código app/crm/conteudo/page.tsx | decisao | P2 | Fase 3 |
| Onda C — Configurações self-service (empresa cadastra funcionários + permissões = RBAC operável). É pré-requisito prático do multi-tenant self-service; TEN-04/RBAC-* não cobrem a UI de configuração. Onda pronta parada, sem WI. | CONTROLE-MESTRE §4.5 | feature | P1 | Fase 5 |
| Onda A — Tela do Arquiteto / Módulo Arquitetura carteira de PROJETOS (financeiro do arquiteto + Visão macro/micro + ficha de projeto/briefing/aprovações). A0/A1 (funil projeto) entram em OBR-01, mas a tela/financeiro do arquiteto e a ficha de projeto (po-proj-ficha P0) não têm WI. | CONTROLE-MESTRE §4.5 · progresso-sistema po-proj-ficha · MAPA roadmap-13 | feature | P1 | Fase 3 |
| Refactor Fase 2.3 — extrair app/crm/layout.tsx (657 linhas, envolve 52 telas; tsc/build não pega render). Segurado para o dono, sem WI. | CONTROLE-MESTRE §4.5 L94 · memoria auditoria-destravamento-05jul | divida | P2 | Fase 3 |
| Deleção do código morto do Escritório Virtual legado (~50 arquivos: components/office/*, hooks useOfficeLife/useLiveLeads, mocks lib/data/*, api/agents/[id]). Confirmado sem consumidor vivo. FND-02 é clients inline, não dead-code; sem WI. | DIVIDAS-TECNICAS L41-48 (AUT-16) · MAPA roadmap-20 | divida | P2 | Fase 3 |
| R7 — default de papel desconhecido cai em 'comercial' (fail-OPEN). Precisa fail-closed. Bug de segurança; RBAC-04/05 não o citam. | CONTROLE-MESTRE §4.4 | bug | P1 | Fase 0/5 |
| escrow:chave_tecnica amarrada ao RESPONSÁVEL da linha (coluna hub_obras.engenheiro_responsavel_id, JANELA-03) — hoje valida por PAPEL, não por pessoa. RBAC-02 cobre a chave_hub, não a chave_tecnica; TODO no código sem WI. | código lib/ia/aprovacoes.ts:320 · CONTROLE §4.4 · DIVIDAS | divida | P1 | Fase 2/5 |
| Rotação/higiene de segredos do dono: service_role key + PAT sbp_ (chave do dev demitido vale até 2036) + chaves Render + finalizar push pro GitHub próprio de backup (repo atual é do dev demitido). RBAC-01 cobre só INTERNAL_API_KEY; o resto não está nas tabelas 'O que só o DONO destrava' do 04/00. | MAPA DONO-1/2/16 · CONTROLE §4.1 · memorias token-supabase/github-backup | infra | P0 | Fase 0 |
| Config Render/cron: CRON_SECRET + MOTOR_FONTE=fornecedores + mover cron dos KPIs pro Render + recálculo diário automático (tirar botão 'Atualizar KPIs') + corrigir alertas duplicados/números divergindo. Não está nas tabelas de config do 04/00 nem em WI. | MAPA DONO-6/EU-19 · CONTROLE §4.4 | infra | P1 | Fase 0/3 |
| Higiene de banco (advisors Supabase): mover extensões pg_net/vector do schema public + fixar search_path de _norm_tel + apagar RPCs de exclusão física dormentes + restringir listagem pública dos buckets + criar buckets de mídia restantes (Passo D). Nenhum WI. | MAPA DONO-11/12/13 · BACKLOG-CONSOLIDADO L108 | infra | P1 | Fase 0/3 |
| delete=arquiva ainda pendente em 5 endpoints (falta a coluna de arquivo) — a invariante #4 do CADERNO não está cumprida em produção. Sem WI de remediação. | BACKLOG-CONSOLIDADO L74 · DIVIDAS · MAPA EU-7 | divida | P1 | Fase 0/3 |
| Textos jurídicos: termos de uso + política de privacidade + documentação de usuário final. LGPD-01 é anonimização técnica; os textos/entregáveis não têm WI. | MAPA DONO-23 · fase5-go-live-checklist L21-24 | feature | P2 | Fase 5/6 |
| IA security hardening: prompt-injection (nome de WhatsApp vira comando), RAG cross-tenant, memory-poisoning entre leads. Nenhum WI (IA-01/02/03 são engine/fallback/tools). | MAPA EU-10 | infra | P1 | Fase 1/3 |
| Cron/webhook forjável: HMAC real com timestamp/nonce + comparação segura; WhatsApp só via worker. Config WEBHOOK_SECRET aparece no checklist, mas a correção de forja (HMAC/nonce) não é WI. | MAPA EU-2 · memoria hsec1/multitenant-golive | infra | P1 | Fase 1/3 |
| Recuperar os documentos de GESTÃO DE OBRAS do dono (Asana) — base do módulo Engenharia; conta de convidado inacessível. Deferido. Tarefa de dado, alto risco de órfão, sem WI. | memoria insumos-dono-e-asana-pendente · MAPA DONO-20 | infra | P1 | Fase 2/3 |
| Copiloto/Agentes — features prometidas: Follow-up customizável (cadência/tentativas/gatilhos), auto-montagem de fluxo pela IA, base de conhecimento do agente hoje SÓ no navegador (não persiste no servidor), Agent Builder Fase 4 (instrumentação hub_eventos), achados de dogfooding do wizard. Sem WI. | memorias pendencias-etapa-copiloto/agent-builder · código AgenteNovoWizard/PlaybookFlow | feature | P2 | Fase 2+ |
| Elo Comunidade(Membros)→CRM/fornecedor NÃO existe (sem membro_id/liberado_crm/webhook) + F5 Comunidade com feed em tempo real. Decisão push/pull/link pendente + feature; sem WI. | memoria comunidade-elo-crm · BACKLOG-FEATURES F5 · MAPA DECISÃO-21 | decisao | P2 | Fase futura |
| Backlog de features futuras F1/F2/F3/F6 + Operação de campo E8-E10: Ponto de obra georreferenciado (check-in GPS/foto/LGPD), Compras totem+iFood com spread, Voz→lista de materiais (Talk-and-Go), Diário de obra automático dos eventos, RDO voz/foto, SST. Sem WI (04 só chega até Fase 8 genérica). | BACKLOG-FEATURES F1/F2/F3/F6 · MAPA roadmap-10 · código SmartField | feature | P2 | Fase 6+ |
| Grandes módulos de rede/escala sem WI: Marketplace/iFood da construção + Lalamove + alerta preditivo de material; CRM cross-conta pleno (negócio no CRM de todos + Hub vê todos + fichas cruzadas + Tarefas/Agenda); 2FA + Enterprise (API pública, SLA, multi-unidade); Editor de fluxo visual/Agent Builder por IA + Copiloto de Voz Global. Ficam no 'Depois' genérico (Fase 6-8), sem ficha. | MAPA roadmap-11/19/22/23/24 | feature | P2 | Fase 7-8 |
| Polimento UX transversal + honestidade de telas: barra de progresso falsa (42%) e 85% de confiança inventado, motivo de perda obrigatório + desfazer arraste, seletor por nome (não UUID), KPIs/somas do backend sobre TODOS os registros, toasts/máscaras/loading-skeleton/trocar window.confirm, acessibilidade AA/zoom/kanban por teclado, remover 3º header mobile, limpar copy técnica de fachada (UAZAPI/PDF Pt.14/porta 3001/env vars). 04/CADERNO são backlog técnico e não cobrem UX de tela. | MAPA EU-25/26/28/30/31/32/33 | divida | P1 | Fase 3 |


---

# Digest bruto por fonte (a varredura completa)


## Fonte 1

Read all four source docs. Here is the raw digest of every pendency, tagged by type and marked where already-done, anchored to file/line.

---

# DIGEST — Pendências extraídas das 4 fontes

## FONTE 1: docs/MAPA-MESTRE-PENDENCIAS.md (mapa-mestre dos 207 docs, 06/jul)

### ACHADO DA REVISÃO AO VIVO (linha 9-10)
- **[EU]** Contas a pagar/receber: falta menu hambúrguer (⋮) por linha para CORRIGIR pago/recebido — editar valor/data, desmarcar pago, estornar. Telas `/crm/financeiro/pagar` e `/receber`. (L10)

### JÁ RESOLVIDO neste ciclo — NÃO são pendência (linhas 12-35, 22 itens)
Marcados como já-feito: bug do dinheiro A1 (L14), foto+vídeo medição AUT-6 (L15), histórico medição AUT-3/4 (L16), RDO básico (L17), janela segurança 24 políticas USING(true) AUT-7 (L18), card Previsto (L19), autor medição por nome (L20), medição consistente (L21), custo IA SEC-8 (L22), leak tenant-null Faixa A (L23), buckets criados (L24), backup+ponto-retorno (L25), motor de comissões 4 tabelas (L26), erros login PT AUT-14 (L27), combobox 100+ AUT-11 (L28), estoque saída/devolução AUT-12 (L29), dedup lead AUT-2 [ressalva: falta virar pessoa/FK] (L30), vazamento Aprovações SEC-1 (L31), rotas mortas /comando /agentes AUT-16 (L32), azul off-brand pontual AUT-5 [sweep completo dos 97 azuis segue ABERTO] (L33), EAP AUT-8 (L34), backup-auto.yml removido/.env fora OneDrive refutado (L35).

### 🔑 DEPENDE DE VOCÊ (dono) — 24 itens (linhas 37-62)
1. Rotacionar chaves-mestras Supabase (service_role + token sbp_) + reescopar INTERNAL_API_KEY (chave do dev demitido vale até 2036) (L39)
2. Rotacionar chaves Render + trocar senha exposta no chat + config reset senha Supabase (L40)
3. Tirar NEXT_PUBLIC_* (INTERNAL_API_KEY, TENANT_ID) do Render/bundle + retestar login (L41)
4. Ligar toggle senha vazada (HaveIBeenPwned) no Supabase (L42)
5. Colocar chaves de IA no Render (Mistral/Groq/Anthropic + COPILOTO_HMAC_SECRET) — liga a IA, nº1 do MVP parado ~60 dias (L43)
6. Setar CRON_SECRET + MOTOR_FONTE=fornecedores no Render + mover cron dos KPIs pro Render em todos tenants (L44)
7. Fechar segurança do banco Faixa B/cross-tenant: backfill tenant vazio, filtro por tenant exato (~50 lugares), RLS em fornecedores, policy financeiro, super_admin só leitura, policy anônima hub_pedidos_material, trancar schema crm_* legado (L45)
8. Aplicar bloco grande de migrações represadas (AEC/obra/escrow/RLS financeiro/medição/estrutura unificada/BDI — E0/E2/E4/E5/E6/E8/taxonomia) (L46)
9. Aplicar migrações pontuais: FK morta N1, FK+índice obra<->projeto, índice anti-recebível-duplicado, trilha quem-deu-baixa, CPF anti-duplicado especialista, tenant em hub_leads_crm, coluna arquivo delete=arquiva, migração baseline reconstrói banco (destrava CI/E2E), JANELA-03 engenheiro responsável, merge de pessoas com backup (L47)
10. Aplicar migrações Arquitetura A0/A1 (funil projeto + programa/aprovações cliente) (L48)
11. Higiene banco: mover extensões pg_net/vector do schema public + fixar search_path de _norm_tel (L49)
12. Apagar funções antigas de exclusão física esquecidas no banco (L50)
13. Restringir listagem pública dos buckets (mão-de-obra tem doc pessoal) + criar buckets de mídia restantes (Passo D) ligando envio de documento (L51)
14. Trocar rate-limit de memória por Redis (provisionar serviço) (L52)
15. Configurar credenciais Meta (Lead Ads/Direct) + Windsor + login Meta/Google (tráfego pago) (L53)
16. Finalizar push pro GitHub próprio de backup (repo atual é do dev demitido) (L54)
17. Limpeza de acessos: remover e2e-arq@obra10.app, rebaixar Ramon owner->admin e Ariane owner->comercial, promover obradezmais a owner (L55)
18. Escolher parceiro BaaS + KYC/compliance p/ escrow (fase 2) + abrir contas-escrow por obra (L56)
19. Semear dinheiro real (recebíveis/medições Consulado) + preencher funil/valor dos negócios/leads antigos (L57)
20. Trazer dados/documentos do Asana (estudo se perdeu) + validar preset Reforma=Consulado + lista real de atividades/descritivos por disciplina (seed Orçamento IA) (L58)
21. Rodar E2E ao vivo dos fluxos da obra + 3 testes de IA (fluxo/WhatsApp/copiloto voz) + conferir Fase 2.3 CrmShell/CrmLayout + review visual mobile no aparelho (L59)
22. Desfazer DEMO do escrow (R$ 15 mil liberado no teste) (L60)
23. Fornecer textos de termos de uso e política de privacidade (L61)
24. Ligar middleware de autenticação (~60 rotas abertas) após decidir captação pública (L62)

### 🛠️ EU FAÇO (código) — 34 itens (linhas 64-99)
1. Blindar rotas abertas com guard papel+tenant (nota, especialista, imóveis, cotações, editar lead, atividades, encaminhamentos, GETs) + fechar vazamento ao aprovar/listar (L66)
2. Corrigir cron/webhook forjável: HMAC real com timestamp/nonce + comparação segura; WhatsApp só via worker (L67)
3. Copiloto grava no tenant errado — resolver tenant real + assiná-lo no HMAC (L68)
4. Fechar injeção de filtro na busca (vírgula/parêntese burla tenant) + filtro por tenant exato validado no servidor (L69)
5. RBAC ponto único: permissão fina por rota, 2º eixo função (arq/eng/campo/compras), fail-closed, lente de campo no servidor (cliente/prestador nunca vê custo/margem/fornecedor), criar papel arquiteto (L70)
6. Trocar senha no app exigir senha atual antes (L71)
7. Trocar apagar por arquivar nos endpoints que apagam de verdade (contatos, canais, distribuição, cadastro, propostas, fases, docs IA, vínculos, mídias) — lado código (L72)
8. Corrigir código da obra/cadastro que vaza contagem entre empresas ou repete sob concorrência — sequência única por tenant (L73)
9. Corrigir inserts sem tenant + derivação de entrega que não valida tenant + export CSV financeiro sem proteção tenant (L74)
10. Blindar IA: prompt-injection (nome WhatsApp vira comando), RAG cross-tenant, memory-poisoning entre leads (L75)
11. Wrapper único de IA medindo tokens + gate atômico de créditos ANTES de chamar IA + rate-limit distribuído (L76)
12. SEC-7: ações de escrita da IA gravarem auditoria (mesa dedicada junto da Central de Aprovações) (L77)
13. Consertar camada IA: bug do Mistral (fallback claude-haiku), inverter ordem provedores (Groq/Anthropic antes de Mistral), mostrar motivo real do erro (L78)
14. Fazer dinheiro fluir: MEDIÇÃO estruturada (boletim, trava medido<=contratado, retenção, margem), negócio-raiz gera recebível/medição/escrow, custódia real (remover GREATEST/FOR UPDATE, trava anti-pagamento-duplo), dupla-chave exigir 2 aprovações + rpc_liberar_pagamento_comissao + telas financeiro (L79)
15. Comissão imutável: foto do valor no fechamento + auditada (L80)
16. Lançamentos financeiros automáticos por evento (ganho->receber; medição/compra->pagar) + recebível puxando quem deve + consolidação 4 fontes elimina #REF! (L81)
17. Bugs em produção: vínculo item de escopo ao lançar custo, padronizar nome do ambiente (Sala/sala/SALA), cascata aprovação no endpoint certo, fonte única de andamento (status x estágio), Campanhas Conversões sempre 0 (L82)
18. Registros por entidade (nota/ligação/visita/timeline/próxima-ação) + hub_eventos + timeline nos 4 cadastros + SLA real + funções que faltam (agendar reunião, registrar ligação/visita, follow-up automático) (L83)
19. KPIs/Analytics: recálculo automático diário (tirar botão Atualizar KPIs), ligar hub_eventos, corrigir alertas duplicados + números divergindo (L84)
20. Dedup e vínculos: lead do formulário virar pessoa (FK) + código único, validação forte CPF/CNPJ + dedup por documento, vínculo pessoa<->empresa N:N com tela nos dois lados (L85)
21. Relatórios: ligar Exportar CSV/Excel, filtro de período, linha clicável, busca/ordenação, tirar dump cru/SQL, faixa de insight IA + cards no celular (L86)
22. Atendimento (inbox): tempo real (não 30s), última mensagem+não-lida+horário, corrigir quem enviou (IA x humano), limpar copy técnica, Sugerir resposta IA + resumo + próximo passo (L87)
23. Esteira de entrega ao fechar negócio: propor-e-confirmar (não spawn mágico), Gerar projeto, Gerar Obra levar segmento/memorial/ambientes, bloquear criar obra por texto livre, convergir ofícios no átomo universal (L88)
24. Sweep identidade visual: repintar 97 azuis/roxos off-brand (29 arquivos) verde+dourado + tokenizar telas de detalhe fora do CRM (L89)
25. Polimento UX transversal: avisos erro/sucesso, confirmar/desfazer nas ações de impacto, máscaras telefone/CPF, loading/skeleton, trocar window.confirm, toasts (L90)
26. Acessibilidade: reabilitar zoom, contraste AA, kanban por teclado, reduzir animações, indicador de scroll horizontal (L91)
27. Mobile: remover 3º header, unificar menu mobile ao desktop, funil em lista vertical, destravar criar pessoa/empresa no celular (L92)
28. Limpar vazamentos de fachada/copy técnica (reinicie servidor porta 3001, nomes de tabela, Windsor.ai, PDF Pt.14, slugs/tokens UAZAPI, env vars, placeholders PES/LED/NEG, pt-PT) (L93)
29. Padronizar esqueleto das 7 telas fora do padrão (+16 parciais) + tabelas pesadas em cards/Kanban + podar KPIs duplicados/colunas técnicas (L94)
30. Onda telas comerciais: KPIs/somas do backend sobre TODOS os registros, matar barra de progresso falsa (42%) + 85% confiança inventado, régua de urgência única, Caixa de Oportunidades tela única, motivo de perda obrigatório + desfazer arraste, debounce busca (L95)
31. Onda telas de operação: seletor por nome (não UUID), renomear Obras->Engenharia/Projetos, cards enriquecidos, busca/filtro, painel da obra honesto, imóveis em grid com foto, especialistas busca+UF-por-DDD, fornecedor ligado ao motor, área de atuação em chips (L96)
32. Onda telas financeiro: centavos exatos, loading/desfazer/aviso em Marcar pago/recebido, link direto por id, recolorir azul/roxo (L97)
33. Onda telas IA/Agentes/Admin: aneis de saúde com dado real, criar agente IA-first, horário Brasília, blindar Precificação, health-check Integrações, esconder painel técnico/secrets, separar Guardar horário/distribuição, validar telefone de alerta, Escritórios clicável (L98)
34. Injetar IA de verdade nas telas-âncora (negócio/lead/atendimento 100% manuais): explicar prioridade, sugerir próxima ação com data, preview encaminhamento, descarte com motivo, sugerir fornecedor, card A IA entendeu assim, barra Perguntar à IA, capturar motivo ao rejeitar + cada decisão vira aprendizado do agente (L99)

### 🧭 VOCÊ DECIDE (produto) — 37 itens (linhas 101-139)
1. Desembaralhar fornecedor x parceiro x empresa-cadastro (L103)
2. Valor comercial: faixa ou número exato? (SmartField) (L104)
3. Score do lead: ordenação explicada ou sair da tela (L105)
4. Distribuição de lead: 1 exclusivo ou 2-3 (mais rápido ganha)? + visibilidade + pesos do score (L106)
5. Liberar merge de cadastros duplicados: quem e onde (L107)
6. Etapas próprias do funil por mercado + 7 estágios do funil Arquitetura (L108)
7. Canais de WhatsApp: definir no banco quais agentes são canais (L109)
8. Caixa de Oportunidades = tela principal do gestor? + cadastro tabela ou cards? (L110)
9. Follow-up customizável (cadência/tentativas/gatilhos) + resolver agente repetido (Ariane x Diretora Marketing) (L111)
10. Escrow/medição regras do dinheiro (2 chaves papéis distintos? alçada, adiantamento, spread, retenção, excedente, medição retroativa, custo realizado) (L112)
11. Hub enxerga margem real no preço fechado ou é segredo da executante? + o que o cliente vê (L113)
12. Honorário do arquiteto: por projeto ou só quando virar obra? + modelo de tenant do escritório do arquiteto (L114)
13. Lado de entrada do escrow: quem confirma recebimento (Hub manual? Pix/gateway?) (L115)
14. Comissão travada no fechamento + % de comissão dos parceiros (L116)
15. Créditos de IA: markup por escritório/mercado + rótulo + bloqueio por saldo Tijolos negativo + compra/recarga (L117)
16. Planos SaaS (nomes/preços/liberação Starter/Pro/Enterprise) + cobrança Hub-Parceiro (L118)
17. Financeiro: saldo bancário real/conciliação ou só projeção? + alçada por valor (L119)
18. Nota Fiscal: anexar PDF/XML ou emitir de verdade (SEFAZ/prefeitura)? (L120)
19. Regras de operação soltas: comodato, frete Lalamove, 3-4 KPIs fornecedor, entregue x aprovado, mapa tipologia->obra, gatilho Gerar obra, spread por contrato (L121)
20. Multi-tenant: modelo A/B + quando ligar 1º tenant real + separação por escritório + canonizar papéis em inglês (L122)
21. Abrir login externo (cliente/fornecedor/mão-de-obra) + elo Comunidade(Membros)->CRM + contrato Membro->fornecedor (L123)
22. Captação pública: quais formulários sem login + parar de mandar chave interna pro navegador (L124)
23. Recorte do painel por perfil: aprovar v1 + densidade dashboard + bloco rede/Parceiros só pro Hub (L125)
24. Multi-tenant nos painéis: alertas/observações/ciclos ganham dono? Homologados conta rede toda? regra p/ registros antigos sem dono (L126)
25. Privacidade: quem vê telefone/WhatsApp do contato + /health público revela segredos (L127)
26. Stubs no menu (/crm/conteudo, Tarefas, Ferramentas IA, agentes-reais, tráfego): esconder/Em breve/owner-only ou construir (L128)
27. Armazenamento de mídia público x privado + contrato/NF/foto medição (link assinado ou público) (L129)
28. Voz (Talk-and-Go): aparelho ou serviço? + agentes membro Mistral ou Anthropic + agente sem fluxo auto-gera? + SLA máximo IA (L130)
29. Portal do Cliente: o que enxerga + selo de auditoria (IA/humano) + cliente comenta ou só visualiza (L131)
30. Operação de campo: operário sem smartphone (PIN/biometria/QR?) + tablet-comodato + condição de entrada (L132)
31. Modelar PRODUTO e SERVIÇO-de-obra no schema agora ou deferir (hub_produtos não existe) + catálogo produto físico (L133)
32. Catálogo de materiais: definir ~20 itens (bloqueante — compra abre vazia) + pesos do score + ferramenta/EPI/EPC + importar ~500 itens reais (L134)
33. Validações de obra (E0-E7/EAP): preset Reforma=Consulado, separador código, andamento no subitem, Cancelado encolhe barra?, sync item->cronograma, bloqueios só avisa, Curva S captura+granularidade, ambientes por segmento, taxonomia-núcleo 5 disciplinas, quantidade padrão, estoque negativo, estoque mínimo (L135)
34. Posicionamento de telas: Analytics/Relatórios viram botões? Relatórios só consultar? Ferramentas IA vira Habilidades? Logs/Alertas viram notificação? Escritórios vira hub de gestão? Unificar /office com CRM? Meta Ads ou multi-canal? (L136)
35. Decisões menores UX+docs: cor da custódia (violeta x dourado), onboarding tour ou aprender-fazendo, esclarecer ponytail, reconciliar os 2 documentos-mestre (L137)
36. Estratégia de receita: escolher 1 fonte cobrável cedo + pronto curto e datado + go/no-go parceiros/fornecedores + quem aprova o quê (L138)
37. Decisões marketplace/campo (fase futura): matching, transparência do spread, selo de frescor + trava de preço, cold-start regional, teste SP ~20 fornecedores, frete, % comissão por elo, gate por valor mínimo (L139)

### 🚀 ROADMAP (módulos grandes) — 24 itens (linhas 141-166)
1. Coração IA-first conversacional cobrindo o fluxo inteiro — nº1 do produto (L143)
2. Orçamento por IA (o moat): memorial PDF->planilha, catálogo, EAP-taxonomia E0.5, base de preços própria, IA cruza memorial x orçamento (L144)
3. Espinha da Obra completa (E0-E7): Nova Obra 3 toques, EAP, Catálogo, Cockpit Hoje, Itens & Avanço, Restrições/Bloqueios, Cronograma+Curva S, Compras->Estoque, Financeiro da obra, Medição — árvore de escopo única + AMBIENTE nível EAP + BDI (L145)
4. Central de Aprovações unificada (fila por setor/tipo, IA prioriza/auto-aprova, lote, loop que ensina, escrow 2 chaves, persona cliente) (L146)
5. Gestor de Tarefas universal + Tela Hoje universal por perfil (L147)
6. Portal do Cliente pleno (login próprio + 5 medos: avanço/financeiro/fotos/aprovar/selo, escrow, Curva S, RDO, IA de risco, push, PDF, multi-obra) (L148)
7. Portal do Fornecedor real (hoje protótipo/403): cotações direcionadas + status + pedidos, link expirável (L149)
8. Monetização SaaS: planos/assinatura/módulos + créditos IA (carteira Tijolos, teto, recarga, semáforo, saldo no topbar) + comissão split + funil 2 níveis Hub x Parceiro (L150)
9. Multi-tenant real (tenant dinâmico users.tenant_id + >=2 tenants + suite de isolamento + Dashboard do Hub + Saúde da Rede) + Configurações self-service (L151)
10. Operação de campo (E8-E10): RDO voz/foto, check-in GPS/geofence, IA-campo anti-fraude, totem de compra por voz, SST com bloqueio, copiloto executivo, rigidez invisível (L152)
11. Marketplace / iFood da construção (fase 2-3): catálogo + matching + frete Lalamove + spread + escrow no gate + cadeia de ofícios com split + preditivo determinístico + tablet-comodato + ML (L153)
12. Módulo Serviços com todos os ofícios (marcenaria/marmoraria/vidraçaria/serralheria/pintura/elétrica) + prestadoras + cadeia encadeada + motor modelo-por-ofício + Serviço Universal + fluxos conversacionais (L154)
13. Módulo Arquitetura de verdade (carteira de PROJETOS): funil de projeto + ficha do arquiteto + programa de necessidades + aprovações cliente + elo Projeto->Obra + Escopo/Orçamento + financeiro do arquiteto + plantas/fases/BIM (L155)
14. Tela de Produtos + ficha + estoque global como lente + telas que faltam: cockpit de Compras, Estoque global, Central de Documentos, tela central de IA (L156)
15. Rastreabilidade total (blueprint-mãe): linhagem pai/raiz, entidades ilhadas conectadas (mão-de-obra/imóvel/produtos), códigos param de dar 404, negócio-filho automático, tela de linha do tempo/árvore, analytics de grafo, link com código embutido (L157)
16. Central de Performance Comercial (métricas por perfil, SLA, ranking fornecedores, forecast, dashboards por persona) + analytics de grafo (L158)
17. Motor de distribuição de leads persistido pleno (tabela hub_lead_distribuicao NÃO existe): fila com score/SLA/redistribuição, cascata de rejeição, gate financeiro, painel do Hub, índice de aderência, agente auditor SLA (L159)
18. Fundação nada-se-perde transversal (arquivar + trilha + negocio_id nos elos + lixeira/recuperação pelo Hub) + Mensageria por papel + Comunidade integrada feed tempo real (L160)
19. CRM cross-conta pleno (negócio no CRM de todos os envolvidos + selo + Hub vê todos + fichas cruzadas Pipedrive + itens do negócio + campos ricos + notificações + Tarefas/Agenda) (L161)
20. Base pré-produção: CI/CD + healthcheck + observabilidade (logger nas ~187 rotas, PII redigida, log central) + performance (paginação, virtualização, N+1, índices/FKs) + DR + ESLint/npm audit + E2E no CI + smoke-test + quebrar arquivos gigantes + gaveta CRUD única + deletar código morto escritório virtual legado (~50 órfãos) (L162)
21. Marketing/tráfego com IA (Google+Meta) + IA preditiva de atraso + análise de foto + importador Asana + relatórios generativos + Dashboard que aprende (L163)
22. 2FA + auditoria por usuário (2º tenant real) + camada Enterprise/escala (LGPD, governança, API pública, SLA, multi-unidade) (L164)
23. Marketplace de materiais asset-light + entrega 2 níveis (fornecedor + Lalamove) + alerta preditivo de material (L165)
24. Editor de fluxo visual do agente / Agent Builder por IA + Copiloto de Voz Global (L166)

---

## FONTE 2: docs/BACKLOG-CONSOLIDADO.md (fonte única viva, 06/jul, ~67 itens)

### DEFERIDO — pendência viva (linha 30-31)
- **SEC-7** — IA gravar auditoria sistêmica de tudo que escreve (tabela hub_acoes_ia). Ponto de injeção: `executar-ferramenta-ia.ts:593` + `agente-ferramentas-registry.ts:1172`. Retomar como MESA DEDICADA. (L31)

### Triagem fila [CODE] — marcados FECHADOS (linhas 33-46) — já-feito
AUT-2 (L37), AUT-12 (L38), AUT-14 (L39), AUT-11 [ressalva busca limit=100] (L40), AUT-8 (L41), AUT-5 [resíduo: hex em vez de tokens --obra-*] (L42), AUT-16 [ressalva: ref stale em doc] (L43). AUT-7 = 🔑 JANELA, código pronto (DROP em 20260819120000), só aplicar (L44).

### JÁ RESOLVIDO neste ciclo (linhas 50-64) — já-feito
A1, A2, A3, A4, AUT-3/4, AUT-6, vídeo medição, RDO, janela (buckets/log/diário/medição rica/FVS/NF), Leak Faixa A.

### 🔑 SÓ VOCÊ DESTRAVA (linhas 68-95)
- Segurança RLS Faixa B (tabelas USING(true)/anon, backfill tenant NULL, filtro legado -> .eq puro incl. busca por código) (L72)
- Aplicar ~19 migrações janela-do-dono (AEC, obra, RLS financeiro, escrow, estrutura unificada, medição, curva-S) + 2 do dinheiro (Pipeline Total + índice anti-recebível-duplicado) (L73)
- delete=arquiva em 5 endpoints (falta coluna de arquivo) (L74)
- hub_obras.projeto_id + UNIQUE (mata corrida criar-obra->PATCH) (L75)
- Migration baseline (reconstruir do zero, destrava E2E no CI) (L76)
- SECRETS Render: MISTRAL_API_KEY (+GROQ) + COPILOTO_HMAC_SECRET (liga IA) (L79)
- CRON_SECRET (L80)
- Conferir WEBHOOK_SECRET, UAZAPI_*, SUPABASE_* + remover NEXT_PUBLIC_INTERNAL_API_KEY/TENANT_ID do bundle (L81)
- Rotacionar SUPABASE_SERVICE_ROLE_KEY + token sbp_ (L84)
- Confirmar backup-auto.yml removido + .env fora OneDrive (L85)
- Push pro GitHub de backup (L86)
- Config Supabase Auth: Redirect URL /redefinir-senha + SMTP próprio + password policy + trocar senha do chat (L87)
- Ligar middleware (~60 rotas) (L90)
- Deploy do wendel/dev (esperando Render) (L91)
- Validar IA ao vivo (3 testes) (L92)
- Validação visual no celular + conferir Fase 2.3 (L93)
- Multi-tenant real (hoje tenant fixo=1, ~55% feito) (L94)
- Credenciais Meta (Lead Ads/DM) + enriquecer taxonomia EAP (cobre 5 de 15 disciplinas) (L95)

### 🛠️ EU FAÇO SOZINHO (linhas 99-109) — fila de código
1. SEC-1 Aprovações [verificar se fechou — depois marcado fechado] (L102)
2. Qualidade da medição (autor como código, insert virar transação, Previsto R$ 0) [já-feito neste ciclo] (L103)
3. SEC-7/SEC-8 (L104)
4. Cadastro automático/código único (L105)
5. UX formulário (combobox, erros PT, tokenizar telas de detalhe azuis) (L106)
6. Operação (estoque, wizard EAP ambiente-primeiro) (L107)
7. Limpeza (rotas mortas, índice taxonomia, RPCs hard-delete dormentes) (L108)
8. Re-rodar auditoria de escopo completo — mapa botão/tela/seção que falta por persona (L109)

### 🧭 SÓ VOCÊ DECIDE (linhas 113-123)
- Valor do lead: faixa ou exato? (L114)
- Voz: aparelho ou serviço? (L115)
- Escrow: 2 chaves papéis distintos? (L116)
- Planos SaaS + markup créditos IA (L117)
- Fornecedor x parceiro x empresa-cadastro (L118)
- /crm/tarefas: renomear ou construir Gestor de Tarefas universal (L119)
- Captação pública: quais formulários sem login (L120)
- MOTOR_FONTE=fornecedores: virar a chave? (L121)
- Comunidade(Membros)->CRM + abrir login externo (L122)
- Regras soltas: comodato, frete Lalamove, KPIs, entregue x aprovado, Tijolos negativo, comissão imutável (L123)

### 🚀 GRANDES roadmap (linhas 127-133)
- Coração IA-first conversacional (L129)
- Diário de obra completo (rico + automático dos eventos) (L130)
- Medição rica por atividade/ambiente/fornecedor (fichas de verificação) (L131)
- Tudo na nuvem com log e segurança (contratos, propostas, orçamentos, NF, vídeos) (L132)
- Ponto de obra georreferenciado + Compras totem+iFood + Voz->materiais + Comunidade com feed (L133)

---

## FONTE 3: docs/BACKLOG-FEATURES.md (visão de produto, 24/jun) — F1-F6

- **F1** — Ponto de obra georreferenciado (check-in/out foto+GPS+notifica) [Bloco 6]. Risco médio-alto LGPD. (L7-13)
- **F2** — Compras "totem + iFood" com spread (totem->orçamento->pago->rastreio iFood->entrega; Hub ganha spread). Resolve Módulo Compras pendente de detalhamento. Nova fonte de receita. (L15-25)
- **F3** — Voz->lista de materiais (speech-to-text, confirma, envia aos fornecedores). Talk-and-Go em compras. Depende da decisão de voz. (L27-32)
- **F4** — Notificações do sistema para follow-ups/lembretes (in-app/push). Camada transversal. Bom candidato a antecipar. (L34-40)
- **F5** — Comunidade integrada com feed em tempo real (event bus, tudo vira feed). Risco médio-alto (volume/privacidade). (L42-47)
- **F6** — Diário de obra automático (gerado dos eventos F1/F2/medição). (L49-54)
- Notas transversais (L58-63): camada de eventos/notificação como infra compartilhada; spread de material entra na monetização §5.5; voz reusa decisão pendente; LGPD como tema próprio (F1+F5).

---

## FONTE 4: docs/backlog-fases-6-9.md (roadmap Fases 6-9+, pós-27/05)

Épicos (tabela L5-14):
- Fase 6 — WhatsApp operário (check-in, pedido de material) [dep: UAZAPI, modelo de dados obra/equipe] (L7)
- Fase 6 — Cotação automática [dep: Fornecedores Fase 3, fila/jobs] (L8)
- Julho — Painel visual por obra [dep: dados obra normalizados, permissões] (L9)
- Julho — Workflow imóvel -> obra [dep: CRM imóveis/obras, regras] (L10)
- Agosto — Setores financeiro/compras/projetos "completos" [dep: multi-tenant+RLS, aprovações] (L11)
- Agosto — Múltiplos escritórios [dep: tenant_id, hierarquia, faturamento] (L12)
- 9+ — Pós-venda, app nativo [dep: APIs estáveis, auth unificada] (L13)
- 9+ — Integrações bancárias / NFe / marketplace [dep: compliance, filas, auditoria] (L14)
- Governança (L18-19): não puxar épico p/ prazo 27/05 sem replanejamento; execução financeira/contratual exige aprovação humana.

---

# OBSERVAÇÕES PARA O CRUZAMENTO (candidatos a ÓRFÃO / atenção)

Notas honestas do que pode NÃO ter migrado para os 5 docs vivos (04-ROADMAP / 00-PAINEL / CADERNO):

1. **BACKLOG-FEATURES.md referencia docs que podem estar mortos**: aponta para `PLANO-EXECUTIVO-BLOCOS.md` (Blocos B2/B3/B6/B7/B8) e `monetização §5.5`. Se esses blocos B* não foram remapeados para as WIs do 04-ROADMAP, F1-F6 podem estar órfãos sob nomenclatura antiga (Bloco 6 vs fases E8-E10).

2. **backlog-fases-6-9.md usa nomenclatura de FASES/prazo antigo (27/05, Frentes A/B)** que não bate com o esquema atual (fases 0-8 do 04-ROADMAP). Épicos específicos a verificar se têm WI correspondente: "Cotação automática" (Fase 6), "Workflow imóvel->obra" (Julho), "Painel visual por obra". "WhatsApp operário check-in" mapeia a F1/roadmap-10 (campo).

3. **F4 (Notificações in-app/push) e F2 spread/totem** — a camada de notificação transversal (event bus) aparece em BACKLOG-FEATURES como infra compartilhada mas NÃO tem item dedicado explícito nas listas EU/roadmap do MAPA-MESTRE (roadmap-19 cita "notificações in-app/push" dentro do CRM cross-conta; verificar se há WI própria de notificação/event-bus).

4. **ACHADO da revisão ao vivo (menu ⋮ para corrigir pago/recebido, MAPA L10)** — é reforço do item EU-32; verificar se virou WI FIN explícita ou ficou só como nota.

5. **Reconciliar os 2 documentos-mestre** (MAPA DECISÃO-35, L137) — o próprio doc reconhece redundância entre docs-mestre; sinal de que a migração de fonte-de-verdade ainda está aberta.

6. **hub_acoes_ia / SEC-7** — pendência viva explícita e detalhada (com linhas de código de injeção); confirmar que consta como WI no CADERNO/04, não só como "deferido" no BACKLOG-CONSOLIDADO.

7. **Tabelas que NÃO existem citadas como bloqueio**: `hub_lead_distribuicao` (roadmap-17), `hub_produtos` (DECISÃO-31), `hub_servicos` só catálogo — verificar se cada uma tem WI.

Nada nas 4 fontes é fonte-de-verdade primária; MAPA-MESTRE e BACKLOG-CONSOLIDADO são eles próprios consolidações de docs históricos (207 docs / 23 docs), então itens deles que NÃO estejam no 04-ROADMAP/CADERNO/00-PAINEL são os órfãos mais prováveis — especialmente os das FONTES 3 e 4 (nomenclatura antiga de Blocos/Fases).


## Fonte 2

Digest completo das 4 fontes de checklist/dívida + 3 sidequests. Filtrei o que já foi CONCLUÍDO e listei só pendências REAIS, ancoradas em arquivo:linha.

---

## A) docs/DIVIDAS-TECNICAS.md — dívidas técnicas deferidas de auditorias

**Multi-tenant / segurança**
- **[linha 7]** `tenantScopeOrFilter` inclui o tenant legado (`tenant-default.ts`) — `carregarTaxonomia`/`/catalogo` leem tenant atual + NULL + DEFAULT_OBRA10. Resolver antes de taxonomia/catálogo terem registros de tenant real `origem='tenant'`. PENDENTE.
- **[linha 8]** RLS `anon` ausente nas tabelas novas de E5 (`hub_pedido_itens`/`hub_estoque_mov`) e módulo obra — padronizar quando o módulo for endurecido. PENDENTE.
- *[linha 6]* `lib/ia/aprovacoes.ts` + `/api/hub/aprovacoes` sem `.eq('tenant_id')` (vazamento cross-tenant LIVE) — marcado "sendo corrigido no E6 (F0)". VERIFICAR se fechou; se não, PENDENTE crítico.

**EAP / Orçamento (E0.5)**
- **[linha 11]** Taxonomia cobre só 5/15 disciplinas (elétrica/civil/hidráulica/revestimentos/pintura) — semear as outras 10 antes do Orçamento IA depender delas. PENDENTE (flag ao dono).
- **[linha 12]** Presets por segmento assimétricos (residencial/corporativo robustos; comercial/PDV esqueléticos) — enriquecer com o dono. PENDENTE.
- **[linha 13]** Migração AUT-7 (`20260819120000_aut7_drop_idx_taxonomia_tenant_redundante.sql`) criada mas ⚠️ NÃO aplicada — janela do dono. PENDENTE (aplicar).
- **[linha 14]** Wizard não expõe ambiente-first no passo 3 (só na aba Itens) — melhoria de UX. PENDENTE.

**Elo / idempotência (A2)**
- **[linha 17]** `hub_obras.projeto_id` + UNIQUE (FK reversa) — mata o R2 e a race residual; requer migração (fora do escopo zero-migração de A2). PENDENTE.
- **[linha 18]** Mapa `tipologia→tipo_obra` (comercial→servico, corporativo→construcao) — validar com o dono. PENDENTE (decisão).

**Compras/estoque (E5)**
- **[linha 21]** Idempotência da cascata: avaliar UNIQUE em `hub_estoque_mov` (hoje LEAST(qtd_pedida) protege o item). PENDENTE.

**Aprovações (E3) / sistêmico**
- **[linha 25]** Tools de escrita não gravam auditoria em `hub_acoes_ia`/`hub_memorias_agente` — lacuna sistêmica; o loop de aprendizado da Central de Aprovações depende disso. PENDENTE (resolver junto da Central).

**Decisões de NEGÓCIO p/ o dono [linha 28]** — comodato (condição de entrada?) · frete Lalamove (repasse vs spread) · KPIs iniciais do fornecedor · spread por modelo de contrato · qtd_padrão da taxonomia · política entregue-vs-aprovado no "Gerar Obra". TODAS PENDENTES (decisão).

**Fase 3a — ressalvas da auditoria (backlog)**
- **[linha 32] (a)** Foto da medição é `type=url` — falta upload nativo (`<input type=file capture>` + Supabase Storage → `foto_url`). Sem isso não há foto de campo na hora. PENDENTE.
- **[linha 33] (b)** Histórico append-only sem UI — `GET /medicoes?item_id=` já devolve, mas nenhuma tela consome. Falta seção "Medições do item" read-only. PENDENTE.
- **[linha 34] (c)** Snapshot de custo falha em silêncio (`console.warn`) em `app/api/aprovacoes/[id]/route.ts` e `lib/ia/aprovacoes.ts` — registrar falha do `rpc_snapshot_custo_frente` em `hub_decision_logs`. PENDENTE.
- **[linha 35] (d)** `GET /medicoes` com `.limit(500)` sem paginação — trunca silenciosamente em obras longas. Adicionar cursor quando construir tela (b). PENDENTE.
- **[linha 36] (e)** `CadastroPremiumSideover` herda azul Shadcn (#2d394b/#121a26), fora da paleta verde+dourado — tokenizar `--obra-*`/`--brand-*` no overhaul de design. PENDENTE.

**Código morto — Escritório virtual legado (AUT-16)**
- **[linhas 41-48]** FLAG follow-up (deleção em massa, commit próprio): ~50 arquivos órfãos confirmados sem consumidor vivo — TODOS ~44 componentes `components/office/*`, hooks `useOfficeLife.ts`/`useLiveLeads.ts`, mocks `lib/data/*` (agents-mock, decisions-mock, leads-mock, live-leads, office-mobile-map, partners-mock), API protótipo `app/api/agents/[id]/route.ts`. PENDENTE (não removidos). ⚠️ Ressalvas: NÃO remover `lib/data/office-map.ts` (VIVO, `CrmSessionFooter.tsx:9` usa `getInitials`) nem `/api/hub/agentes` (13+ consumidores).

*Já-feito (não é pendência):* AUT-7 idx redundante identificado→migração criada; AUT-12 saída/devolução handler unificado (`abrirMov`+`tipoInicial`) [linha 22]; AUT-16 rotas `app/comando` e `app/agentes` removidas [linha 40]; `app/office/` mantido de propósito (redirect).

---

## B) docs/CONTROLE-MESTRE.md — pendências vivas (§4)

**§4.1 Janela do dono (SQL/prod)**
- **[linha 71]** `JANELA-03-eng-responsavel-obra.sql` — pronto, não rodado. PENDENTE.
- **[linha 72]** Pacote RLS + backfill tenant-NULL (endurecer `USING(true)`, `.eq` puro, backfill 1 pessoa) — a preparar. PENDENTE.
- **[linha 73]** Onda tenant-null Faixa B (`buscar-pessoa-documento`, oráculo CPF/CNPJ): backfill NULL em `hub_pessoas` → `.eq` puro → reescrever teste do leak → `UNIQUE(tenant_id, documento)` → guardas nos consumidores. PENDENTE.
- **[linha 74]** Rotação da service_role key + reescopo `INTERNAL_API_KEY` (D9 do RBAC) — pré-multi-tenant. PENDENTE.
- **[linha 75]** Escrow #5 (GREATEST/FOR UPDATE) + mover `.env` para fora do OneDrive. PENDENTE.

**§4.2 Decisões de produto (do dono) [linhas 78-80]**
- Dinheiro fluir de verdade (seed recebíveis/medições reais do Consulado). PENDENTE.
- Desambiguar fornecedor × parceiro × empresa-cadastro. PENDENTE.
- `/crm/tarefas`: renomear vs construir Gestor de Tarefas universal. PENDENTE.
- Modelo A/B multi-tenant + QUANDO ligar o 1º tenant real. PENDENTE.

**§4.3 Limpeza [linhas 82-84]**
- Remover login de teste `e2e-arq` (rollback em scratchpad). PENDENTE.
- Rollback do DEMO escrow (já liberado) quando o dono quiser. PENDENTE.
- `obradezmais` → owner (hoje admin temporário) + criar login externo (trava). PENDENTE.

**§4.4 Follow-ups de código (CEO) [linhas 86-88]**
- R7: default de papel desconhecido → fail-closed (hoje cai em "comercial"). PENDENTE (segurança).
- Amarrar `escrow:chave_tecnica` ao RESPONSÁVEL da linha (após JANELA-03). PENDENTE.
- Cron dos KPIs (alimenta analytics, anti "parede-de-zeros"). PENDENTE.

**§4.5 Ondas PRONTAS paradas (retomar pós-destravamento) [linhas 96-99]**
- Onda A — Tela do Arquiteto (financeiro + Visão Geral macro/micro + Analytics TV). PENDENTE (recomendação do CEO de retomar 1º).
- Onda C — Configurações (self-service: empresa cadastra funcionários + permissões = RBAC operável). PENDENTE.
- Onda 3 — RBAC ABAC fino (endurecer `comercial` de rotas architect/operation). PENDENTE.
- Onda D — Sistema de LOGS unificado (§7). PENDENTE.
- **[linha 94]** Frentes do PLANO-DESTRAVAMENTO-05JUL 🔒 SEGURADAS: 2.3 (extrair layout — quebra 52 telas) · 2.4 (RBAC) · E2E (decisão de auth) · Faixa B. Código de Fase 0/1.1/1.3/2.1/2.2 em `wendel/dev` NÃO deployado (Render espera o dono). PENDENTE (deploy + frentes restantes).

**§3.2 Ondas em andamento**
- **[linha 57]** Onda 2 (fila aprovações por persona) — falta E2E vivo pós-deploy. PENDENTE (validação).
- **[linha 58]** Onda A / Tela do Arquiteto — 🏗️ rodando, `DESIGN-TELA-ARQUITETO.md` "em breve" [linha 107] (design não escrito). PENDENTE.
- **[linha 59]** Parceiro Fase 2 — código em `wendel/dev` `28822e2`, E2E verde, **aguarda deploy**. PENDENTE (deploy). *(nota: §4.4 linha 89 marca a feature ✅ FEITO; o deploy é o que resta)*

**§7 Sistema de Logs — gaps [linhas 125-130]**: não há tabela/handler central de ERROS (`hub_error_logs`) nem auditoria de AÇÃO consistente em toda mutação (helper único obrigatório); falta `request_id`/`trace_id` de correlação; retenção+privacidade (não logar PII/segredos). Vira mesa própria (Onda D). PENDENTE.

*Progresso macro auto-declarado: ~55-56%.*

---

## C) docs/crm-operacional-checklist.md
Documento de setup/validação, não de pendências. Nenhum item marcado como incompleto — é guia de `.env`, migrações e roteiro de validação manual (`/crm`, `/crm/leads`, `/crm/negocios`, `/crm/atendimento`, `/crm/aprovacoes`). Sem pendência explícita.

---

## D) docs/fase5-go-live-checklist.md — TODOS os itens abertos `[ ]` (nenhum fechado)

**Validação funcional [linhas 8-12]:** jornada parceiro (cadastro→homologação→painel `/parceiro/dashboard` link assinado) · jornada fornecedor (protótipo cotação `/fornecedor/cotacao` + roadmap de persistência) · WhatsApp (mensagem→lead→resposta IA + HMAC/`WEBHOOK_SECRET` em prod) · Ciclos IA (`hub_ciclos_ia.total_execucoes` subindo nos crons Vercel) · KPIs (`hub_kpis_resultados` populados) · Aprovações (Central sem mocks bloqueantes).
**Multi-tenant piloto [linhas 16-17]:** migração `hub_tenants` aplicada + 2º tenant sem vazamento · roteiro `/crm/onboarding-tenant`.
**Operação [linhas 21-24]:** performance/índices Supabase · logs Vercel+Supabase + alertas · documentação de usuário final · termos de uso e privacidade (jurídico com PO).
**Rollback [linhas 28-29]:** procedimento de reverter deploy documentado · backup recente verificado.
**Decisão [linha 33]:** registrar go/no-go. — TODA A FASE 5 PENDENTE (checklist inteiro aberto).

---

## E) SIDEQUESTS (3 arquivos) — todas PENDENTES

- **SIDEQUEST-AUDITORIA-ONBOARDING-E-MENUS.md** — redesenho de navegação/identidade do app mobile: (A) matar barra inferior + "Pulso" redundante (`lib/mobile/nav.ts` — `pulso` e `escritorio` apontam ambos p/ `/crm`); mobile passar a usar drawer em seções reaproveitando `CRM_NAV_GROUPS` [linhas 18-20, 24-27]; (B) migrar chrome de `#0d1117` para dark verde+dourado (tokens `--brand-*`) [linha 29]; (C) emoldurar listas (card de ação + chips + status em pílula) [linha 31]. Recomendação: começar por A. PENDENTE (nada alterado — auditoria só).
- **SIDEQUEST-mistral-ia.md** — destravar a IA (bug do Mistral no copiloto/agentes). Investigar `lib/ia/llm-completion.ts`, `engine.ts`, `ml.ts`, `app/api/copiloto/interpretar/route.ts`, model IDs, uso de `MISTRAL_API_KEY`, erro engolido, JSON mode, AbortSignal. Duas frentes: código (achar/fixar bug) + ambiente (confirmar chave no Render + logs, com o dono). PENDENTE (havia fallback forçado p/ claude-haiku no `/interpretar` — Mistral falhando).
- **SIDEQUEST-mobile-cadastros.md** — **PRIORIDADE ALTA** (dono quer usar de verdade): no mobile não cria PF nem empresa ("não aparece"); filtros/tela "muito ruins". Investigar `app/crm/pessoas|empresas|cadastro|contatos/page.tsx` + `CadastroWizard.tsx`/`CadastroPremiumSideover.tsx`/`CadastroEmpresaSideover.tsx`/`CadastroContactoSideover.tsx`/`EmpresaFormDrawer.tsx`; suspeita `hidden md:block`/breakpoints escondendo CTA/FAB/sideover. PENDENTE.

---

## Observações para o cruzamento (candidatos a ÓRFÃO)
Sinais de que estas fontes podem NÃO estar refletidas nos 5 docs vivos (04-ROADMAP / 00-PAINEL / caderno):
1. **Ressalvas Fase 3a (a)-(e)** e **AUT-16 deleção em massa (~50 arquivos)** vivem só aqui em DIVIDAS-TECNICAS.md — verificar se viraram WI no 04/caderno.
2. **fase5-go-live-checklist.md inteiro aberto** — parece um checklist antigo (menciona Vercel crons/`vercel.json`, mas CONTROLE-MESTRE diz deploy no **Render**); cheirando a doc de fase antiga não migrado. Itens como "termos de uso/privacidade", "documentação de usuário final", "roteiro `/crm/onboarding-tenant`", "jornada fornecedor `/fornecedor/cotacao`" podem estar órfãos.
3. **crm-operacional-checklist.md** também referencia **Vercel/`vercel.json`** (cron KPIs) — divergente do deploy Render atual; possível dívida de config desatualizada.
4. **3 sidequests** — nenhuma aparece como WI RAS/FIN/etc.; verificar se o 04-ROADMAP as capturou (especialmente mobile-cadastros = prioridade alta, e mistral-ia = destrava IA inteira).
5. **Decisões de negócio ao dono** (comodato, frete Lalamove, spread, KPIs fornecedor, tenant A/B) — decisões pendentes que podem não ter item correspondente no PAINEL-DE-CONTROLE.


## Fonte 3

Digest completo das pendências/decisões/features ainda abertas extraídas das memórias de pendência/adiamento. Ancorei cada item ao arquivo de memória (todos em `C:\Users\wende\.claude\projects\c--Users-wende-Documents-escritorio-virtual-ramon\memory\`). Marquei o "risco-de-órfão": ITEM COM DOC = aponta para um `docs/...` durável (provável que já esteja/possa ser rastreado nos vivos); SÓ-MEMÓRIA = vive apenas no chat/memória, sem WI/doc citado (candidato a órfão — o pai deve confirmar contra 04-ROADMAP / CADERNO / PAINEL).

---

## A. IA ao vivo / provedores (bloqueio operacional)

1. **Validar a IA ao vivo em PRODUÇÃO com o dono — 3 testes combinados** (geração de fluxo com IA; atendimento WhatsApp responde; copiloto de voz FAB). O dono pediu EXPLICITAMENTE "me lembre destes testes, faremos depois" (28/jun). — `testes-ia-pendentes-validar-com-dono.md:10-17`. **Risco-de-órfão: SÓ-MEMÓRIA** (é um lembrete de ação com o dono, não uma WI; provável órfão dos vivos).

2. **`MISTRAL_API_KEY` + `COPILOTO_HMAC_SECRET` no Render** — sem elas nenhuma IA do web service responde (copiloto=503 fail-closed, Agent Builder, atendimento). Pende do dono. — `pendencias-etapa-copiloto-agentes.md:20`. **SÓ-MEMÓRIA** (config/env, provável órfão).

3. **Conta Mistral "idle" (sem billing/plano) — saída rápida = Groq** (`GROQ_API_KEY` free no Render contorna sem depender do dev/2FA). DEFINITIVO = dono loga em console.mistral.ai → ativar billing. Deferido "p/ amanhã" (29/jun). — `mistral-idle-groq-unblock.md:10-16` (doc `docs/MISTRAL-RESOLVER-AMANHA.md`). **ITEM COM DOC**, mas é ação de infra pendente — confirmar se foi resolvido.

---

## B. Segurança / multi-tenant (hard-gates antes de 2º login)

4. **H-SEC-1 (#1 de segurança): `NEXT_PUBLIC_INTERNAL_API_KEY` + `NEXT_PUBLIC_TENANT_ID` vão ao browser**; rotas `/api/cotacoes/**` usam service-role gateadas só por essa chave pública → anônimo lê/escreve cotações (cross-tenant no multi-tenant). Decisão arquitetural do dono pendente: trocar por signed-link HMAC OU sessão; NÃO corrigido às pressas (quebraria portal fornecedor). — `hsec1-internal-api-key-browser.md:10-18` (docs `E2E-DOMINIO-H-ACHADOS.md`, `SEGURANCA-H-SEC-1.md`). **ITEM COM DOC.**

5. **Furo do header forjável `tenantIdFromRequest` (`lib/tenant-default.ts`)** honra `x-tenant-id` sem chave interna → qualquer um forja tenant; `encaminhamentos` 100% aberto; ~16 rotas usam header→trocar por sessão. Fase 1 (blindagem) commitada LOCAL `9be8fe7` **NÃO pushada** (parou por internet instável). — `multitenant-golive-plano.md:12-16`. **Parcialmente endereçado** por `auditoria-destravamento-plano-05jul.md:20` (2.2 `tenantScopeExact` + aviso); confirmar se blindagem+troca de header completou.

6. **JANELA irreversível multi-tenant (com o dono):** `tenant_id` em hub_alertas/hub_ciclos_ia; UNIQUE por-tenant CONCURRENTLY (doc/cnpj/telefone/codigo) → validar → DROP globais; backfill `tenant_id NULL→default`; contador PK por tenant + RPC `p_tenant_id`. — `multitenant-golive-plano.md:18`. **SÓ-MEMÓRIA (migrações de janela)** — checar se estão como WIs de "janela do dono".

7. **⭐ DECISÃO DO DONO pendente — modelo do parceiro (A tenant próprio vs B view escopada por `parceiro_id`)**; + parceiro vê só leads ou negócio+obra? como convidar tenant-parceiro? quando virar a chave do isolamento. — `multitenant-golive-plano.md:20`. **SÓ-MEMÓRIA (decisão de produto).**

8. **Rate limit em TUDO que toca IA** (anti-abuso de custo/DoS) — router IA, rotas agentes/hub, copiloto, atendimento→worker, geração fluxo/playbook. Reusar `lib/portal-rate-limit.ts`, amarrar ao metering. Dono (02/jul): "para outro momento" — Maratona 3 (segurança). — `rate-limit-ia-anti-abuso.md:10-18`. **SÓ-MEMÓRIA** (liga a `auditoria-enterprise-01jul`).

9. **Rotação do PAT Supabase (`sbp_...`) adiada** — dono: "me lembre no futuro" (antes de go-live amplo). — `token-supabase-rotacao-adiada.md:10-12`. **SÓ-MEMÓRIA (lembrete).**

10. **GitHub próprio de backup — finalizar o push** para `wendelnice-dev/escritorio-virtual-backup` (bloqueado pelo classificador de segurança); risco ATIVO: repo principal é do dev demitido (01/jul) que pode bloquear/apagar. Dono pediu "me lembre". — `github-backup-proprio-lembrete.md:10-19`. **SÓ-MEMÓRIA (risco operacional).**

---

## C. Copiloto / Agentes IA (features prometidas não feitas)

11. **#6 Follow-up mais claro/customizável** (cadência, nº de tentativas, gatilhos de reativação) — pedido do dono no dogfooding; hoje é só 1 chip de tarefa. É FEATURE a desenhar. — `pendencias-etapa-copiloto-agentes.md:21`. **SÓ-MEMÓRIA.**

12. **Catálogo de cargos — limpeza** (`hub_cargos_catalogo`, 23 ativos): cargo `mari_pre_vendedora...` com nome de agente; redundantes no Comercial (dois SDR, dois "Atendente"); desativar cargos Marketing/Operações não usados. Dono: "por hora está bom, fazer com sinal". — `pendencias-etapa-copiloto-agentes.md:22`. **SÓ-MEMÓRIA (dívida de dados).**

13. **Seed `hub_agente_identidade` slug=copiloto-global + coluna `setor_ia`** (Fase 6) — DEFERIDO; migração que espera OK do dono; sistema funciona 100% em runtime sem ela. — `copiloto-voz-global.md:19` e `pendencias-etapa-copiloto-agentes.md:24-25`. **SÓ-MEMÓRIA (deferido de propósito).**

14. **Achados de dogfooding do wizard de criação de agente** (p/ depois): 8 passos intimida; mercados em siglas crípticas (IMB/ARQ/RFM) sem rótulos; bug de glyph no checkmark ("—S"/"—x"); card do agente sem "Editar"/"Conversar". — `agent-builder-ia-fase1.md:23`. **SÓ-MEMÓRIA (UX débito).**

15. **Agent Builder Fase 4 = instrumentação (`hub_eventos`)** — próximo não feito. — `agent-builder-ia-fase1.md:21`. **SÓ-MEMÓRIA.**

---

## D. Créditos IA / metering (monetização — 3ª perna)

16. **Fases 2-4 do metering de créditos ("Tijolos")**: Fase 2 carteira/widget+saldo+estimativa na UI → Fase 3 pré-pago+hard-cap+top-up (TRAVA: gateway de pagamento) → Fase 4 assinatura concede Tijolos + painel super-admin de precificação (preços/markup/câmbio/overrides). Fase 1 entregue. — `creditos-ia-metering-visao.md:20` e `:14` (specs `docs/superpowers/specs/2026-06-26-...` e plan). **ITEM COM DOC** (spec+plano existem).

---

## E. Comunidade ↔ CRM (elo inexistente)

17. **Elo Comunidade(Membros)→fornecedor NÃO existe** (zero webhook/sync/import; sem `membro_id`/`liberado_crm`). PARADO até o dono explicar. Plano pronto: P0 decisão push/pull/link → P1 migração aditiva `membro_id`+`origem`+`homologado_em` → P2 webhook HMAC → P3 tela import → P4 unificar `status_acesso`×`status`. — `comunidade-elo-crm-pendente.md:10-16`. **SÓ-MEMÓRIA (decisão de produto + plano).**

---

## F. Design / UI-UX (overhaul deferido)

18. **Revisão de design — resta backlog:** shell das telas de DETALHE (agentes/[slug], parceiros/[id], leads/[id], Aprovações); layout/apresentação (tabela→cards, botões, hierarquia F4/F5); telas FORA do CRM (app/parceiro, onboarding) não escaneadas; resíduo "UAZAPI" em dado de ferramenta. (Dimensão de COR no CRM concluída.) — `design-overhaul-deferido.md:14-15,23-27` (é F4/F5 do `docs`/`diagnostico-tela-a-tela-plano-acao`). **ITEM COM DOC parcial** (liga a diagnóstico tela-a-tela).

---

## G. Rastreabilidade / cadastros (dívida estrutural — "alma do produto")

19. **Linhagem pai/raiz do negócio DORMENTE** — `negocio_pai_id`/`negocio_raiz_id` lidas mas NUNCA escritas por código (só seed) → app não gera negócio-filho no fluxo normal. — `rastreabilidade-estado-real-04jul.md:13`. **ITEM COM DOC** (`docs/MAPA-CONEXOES-CADASTROS.md`).

20. **Cadastros ILHADOS da espinha:** especialista/mão de obra sem FK nem tabela de alocação obra↔especialista (não dá pra rastrear quem executou); imóvel com FKs de captação/dono não populadas; produtos a 2 saltos. — `rastreabilidade-estado-real-04jul.md:14`. **ITEM COM DOC.**

21. **Parceiro some do "Relacionados"** (gravado no vínculo, tela só materializa pessoa/empresa). — `rastreabilidade-estado-real-04jul.md:15`. **ITEM COM DOC.**

22. **Códigos PD/FR/ES/OB/PJ/SV cunhados mas dão 404** (resolver só mapeia 6: PES/EMP/LED/NEG/PAR/IMO); contador de entidade GLOBAL (enumerável cross-tenant) — isolar por tenant no resolver é obrigatório. — `rastreabilidade-estado-real-04jul.md:16` (liga `codigos-rastreio-internos-nao-visiveis`, `tenant-null-leak-pattern`). **ITEM COM DOC.**

23. **Itens de janela da rastreabilidade:** UNIQUE `(tenant_id,documento)`, contador de código por-tenant, policy ANON de `hub_pedidos_material`; atores de compra TEXT→FK (pro escrow). — `rastreabilidade-estado-real-04jul.md:19`. **ITEM COM DOC.**

---

## H. Backlog de features futuras (prometidas, não feitas)

24. **F1 Ponto de obra georreferenciado** (check-in/out com foto+GPS, LGPD). — `backlog-features-futuras.md:11`.
25. **F2 Compras "totem + iFood" com spread** (nova fonte de receita → atualizar monetização §5.5). — `:11`.
26. **F3 Voz→lista de materiais** (IA reconhece/monta/envia). — `:12`.
27. **F4 Notificações do sistema** (camada in-app/push — fundação compartilhada; candidato a antecipar). — `:13`.
28. **F5 Comunidade com feed em tempo real** (event bus + realtime). — `:14`.
29. **F6 Diário de obra automático** (gerado dos eventos). — `:15`.
30. **Transversal: camada de eventos/notificação** (fundação de F1/F2/F5/F6). — `:17`.
— Todos em `backlog-features-futuras.md`, detalhados em **`docs/BACKLOG-FEATURES.md`**. **ITEM COM DOC** (backlog explícito; provável que precise mapear pra WIs EVT/POR/etc no 04).

---

## I. Insumos do dono (dado perdido — diretriz + tarefa)

31. **Recuperar os documentos de GESTÃO DE OBRAS do dono (Asana)** — base do módulo Engenharia; Asana em conta de convidado inacessível (MCP desconectado). Recuperar via Chrome dirigido OU dono re-envia (e persistir na hora). Deferido ("vemos mais tarde"). — `insumos-dono-e-asana-pendente.md:12`. **SÓ-MEMÓRIA (dado a recuperar — alto risco de órfão).**
32. **DIRETRIZ permanente: persistir todo insumo do dono em `docs/insumos-do-dono/`** (nunca deixar só no chat). — `insumos-dono-e-asana-pendente.md:10`. Diretriz, não WI.

---

## J. Destravamento de código (auditoria 05/jul — segurado p/ o dono)

33. **Fases 2.3/2.4/E2E/Faixa B SEGURADAS (não feitas no escuro):** 2.3 extrair `app/crm/layout.tsx` (657 L, envolve 52 telas — `tsc`/`build` não pega render); 2.4 RBAC ponto único; E2E (decisão de auth); Faixa B (itens de janela). Fase 0 + 1.1 + 1.3 + 2.1 + 2.2 executadas em `wendel/dev`, **NÃO deployado** (Render/prod espera o dono). — `auditoria-destravamento-plano-05jul.md:20` (doc `docs/PLANO-DESTRAVAMENTO-05JUL.md`). **ITEM COM DOC.**
34. **Deploy em produção pendente** — 11 commits gated em `wendel/dev` não deployados; prod espera o dono. — mesmo arquivo. **SÓ-MEMÓRIA (estado de release).**

---

### Nota honesta sobre método
Minha fonte foram as memórias de pendência (12 nomeadas + 6 correlatas recentes). Não abri `docs/04-ROADMAP-E-PLANO.md`, `docs/00-PAINEL-DE-CONTROLE.md` nem `docs/CADERNO-ENGENHARIA-AUDITORIA.md` — o cruzamento final (CAPTURADA vs ÓRFÃ) é do agente pai. Sinalização prática: os itens marcados **SÓ-MEMÓRIA** (1, 2, 5-7 parte, 8, 9, 10, 11, 12, 13, 14, 15, 17, 31, 34) são os de **maior risco de órfão** — decisões/lembretes/features que vivem só na memória e podem não ter WI correspondente. Os **ITEM COM DOC** já têm âncora durável em `docs/` e provavelmente estão (ou são fáceis de rastrear) nos vivos. Vários itens são deferidos de propósito com OK do dono (3, 6-janela, 9, 13, 16-Fase3 trava gateway) — pendências reais, mas conscientes.


## Fonte 4

Varredura completa. Segue o digest ancorado (arquivo:linha). Foco em trabalho inacabado REAL no código; sinalizei o que parece já ter WI/fase (capturado) vs. candidato a órfão.

---

# DIGEST — Marcadores de pendência no código

## 1. TODOs explícitos no código (3 reais, todos ancorados em WI/Onda)

- `lib/copiloto/copiloto-auth.ts:26` — `TODO(multi-tenant): mapear user.id → tenant; hoje o sistema opera single-tenant.` Retorna `defaultTenantId()` fixo. **Dívida de multi-tenant** — provável WI TEN. (capturado se TEN existe no 04)
- `app/api/public/especialista/route.ts:54-55` — `Por ora, gravamos cadastrado_por=null` + `TODO(B3.9): derivar convidadoPor de token HMAC assinado no link de convite.` Rastreio de convite incompleto. Ancorado em WI **B3.9**.
- `lib/ia/aprovacoes.ts:320-325` — `TODO(ABAC de linha — Onda 1b completa / Onda 3): amarrar a chave_tecnica ao RESPONSÁVEL da linha, não só ao papel.` Falta coluna `hub_obras.engenheiro_responsavel_id` (migração aditiva pendente — "Onda 0 não tem"). Hoje escrow de obra valida por PAPEL, não por responsável nominal. Ancorado em **Onda 1b/3** — verificar se está no RBAC/ABAC do 04.

## 2. Páginas/rotas STUB e features "em breve" (candidatas a órfão se não houver WI)

- `app/crm/conteudo/page.tsx:28` — página é só um `Em breve`. Corroborado por `lib/mobile/nav.ts:28` (`G-D2: /crm/conteudo é stub "Em breve" — escondido do menu até existir de verdade — decisão do dono`). Decisão do dono registrada — confirmar WI.
- `lib/crm/progresso-sistema-data.ts:223` — o próprio sistema declara: `ix-copiloto "Copiloto global" status:"gap"`, `oQueTemos:"Placeholder /crm/agentes-reais"`, `oQueFalta:"Implementação"`.
- `app/api/copiloto/interpretar/route.ts:108` — copiloto só faz buscar/anotar/atualizar; `"Outras ações por voz chegam em breve."` (ações por voz não implementadas).
- `components/crm/SmartField.tsx:11-12,26,90-93` — Talk-and-Go (preenchimento por voz) é só um selo "em breve", sem botão. `"A voz (Talk-and-Go) entra no fim do roadmap — por ora só um selo discreto."`
- `components/crm/PlaybookFlowReactFlowPanel.tsx:49` — auto-montagem do fluxo pela IA não existe: `"A IA vai montar o fluxo... assim que a chave de IA estiver ativa. Por enquanto, monte manualmente."`
- `components/crm/AgenteNovoWizard.tsx:2529` — base de conhecimento do agente `"Por enquanto ficam só no navegador"` (localStorage, não persistido no servidor).
- `app/crm/integracoes/page.tsx:15` — status `em_breve` de integrações (features anunciadas não entregues).
- `app/api/crm/taxonomia/route.ts:9` — `"futuramente, a IA do Orçamento (classifica memorial → códigos da taxonomia)"` — classificador IA não feito.
- `components/crm/obras/ObraCronogramaSecao.tsx:425` — cronograma simplificado: `"Por enquanto: planejado linear pelas datas... executado pelo avanço dos itens."`

## 3. Família `migracao_pendente` — migrações NO REPO mas com degrade "não aplicada em prod" (dívida operacional)

Endpoints respondem `migracao_pendente=true` e a UI degrada graciosamente até as migrações E2–E7c serem aplicadas. Isto é um bloco de pendência de **deploy de schema**, não de código:
- `lib/crm/obra-route-helpers.ts:11`, `lib/obras/orcamentaria.ts:64,342`, `lib/crm/cockpit-aggregate.ts:247,266,453,479`, `lib/ia/aprovacoes.ts:715`, `lib/crm/excluir-cadastro-crm.ts:34`
- Migrations que documentam o degrade: `20260710120000_e2_obra_itens.sql:12`, `..._e3_obra_restricoes:11`, `..._e4_curva_s:16`, `..._e5_compras_estoque:31`, `..._e6_financeiro_contrato_escrow:27`, `..._e7_item_escopo_unificado:14`, `..._e7b_status_escopo_e_aprovar:13`, `..._e7c_medicao:13`
- **CRÍTICO e explícito**: `lib/crm/progresso-sistema-data.ts` → `inf-migrations-pdf "Migrations PDF aplicadas em prod" status:"gap" P0 oQueFalta:"db push staging + produção"`. Confirma que aplicar migrações em prod é pendência aberta P0.
- Financeiro estruturado (E6) ainda ausente → cockpit mostra "chega em breve": `lib/crm/persona-cockpit-aggregate.ts:282,295`, `app/crm/obras/page.tsx:747,913` (`"O agregado de pagamentos a vencer... chega em breve"`; `"checagem de disparidade orçamento × projeto chega em breve"`).

## 4. Rastreador de gaps do PRÓPRIO sistema — backlog estruturado em código

`lib/crm/progresso-sistema-data.ts` é um backlog vivo COMPILADO NO CÓDIGO com ~66 itens `status:"gap"|"parcial"` + `oQueFalta` + fase F0–F5. Este é o cruzamento mais denso a fazer contra o 04-ROADMAP. Itens **gap P0** (os mais graves, possíveis órfãos se não estiverem no 04):
- `fl-aguardando` — Tarefa automática de follow-up por prazo (F2)
- `fn-derivados` — Fechado ganho → automação criar obra/projeto/produto (F3)
- `rf-ganho-validacao` — Ganho exige validação gestor/financeiro (F3)
- `rf-alerta-parado` — Alertas automáticos de oportunidade parada no dashboard (F2)
- `pa-obrigatoria` — Próxima ação obrigatória p/ avançar: bloqueio global na API (F2)
- `po-proj-ficha` — Ficha de projeto (briefing/cronograma/aprovações) UI completa (F3)
- `po-comissoes` — Módulo comissões previstas/pagas (F3)
- `inf-migrations-pdf` — migrations em prod (ver §3)

gap P1/P2: `ent-produto-servico`, `nav-produtos` (catálogo marcenaria/marmoraria/revestimentos), `pa-atraso` (alertas dashboard+inbox), `ix-confianca` (UI confiança por campo IA), `ix-copiloto`. Além de ~50 itens `parcial` com `oQueFalta` concreto (participantes com papéis, campos sensíveis só gestor, perda exige motivo com bloqueio API, kanban por mercado validado em prod, etc.). **Recomendo cruzar esta lista item-a-item com o 04** — é a fonte mais provável de órfãos.

## 5. Dívida de limpeza `@deprecated` (código legado ainda referenciável)

- `lib/crm-nav-groups.ts:51,203`, `lib/playbook/menu-type-uazapi.ts:6`, `lib/ia/mari-triagem-opcoes.ts:23`, `lib/crm/crm-api-auth.ts:216`, `lib/crm/crm-permissoes.ts:119`, `lib/crm/relatorio-git-entregas.ts:352`. Símbolos marcados obsoletos mas não removidos — dívida de refatoração menor.

## 6. Testes E2E bloqueados (WIP explícito)

- `.github/workflows/e2e.yml:5` — `WIP — bloqueado pelo achado: o repo nao reconstroi o banco do zero (schema-base...)`. Pipeline E2E não roda porque o schema não reconstrói do zero. Pendência de infra de teste — provável órfão (não é WI de feature).
- `lib/crm/guard-coverage.test.ts` — regression gate por-método do middleware (ativo, não pendência).

## 7. `eslint-disable` / supressões (dívida menor, não bugs)

~12 `eslint-disable-next-line react-hooks/exhaustive-deps` e `@next/next/no-img-element` espalhados (`components/crm/AgenteNovoWizard.tsx:1140`, `app/crm/atendimento/page.tsx:169,178,281`, `lib/crm/use-colunas-visiveis.ts:28,60`, `components/crm/playbook-flow-visual/FlowCanvas.tsx:514,525,530`, etc.). Nenhum `@ts-ignore`/`@ts-nocheck` no código (só um `@ts-expect-error` de teste em `lib/crm/eventos-formato.test.ts:35`). O código tem disciplina de tipos alta — confirmado em `docs/PLANO-DESTRAVAMENTO-05JUL.md:10`.

## JÁ-FEITO (não é pendência — ruído descartado)

- `app/crm/projetos/page.tsx:4` e `lib/crm-nav-groups.ts:112` — `/crm/projetos era STUB` → **já redireciona** para a árvore real (B1/E2E Domínio C concluído).
- Placeholders de `<input>` (dezenas em `app/*/page.tsx`, `components/**`), `placeholderData` de React Query, `SUPABASE_ENV_PLACEHOLDER_*` (fallback de build), `nomeLeadEhPlaceholder` (lógica de negócio), textos "em breve" de mensagens ao lead no WhatsApp/playbooks — tudo funcional, não é pendência.

---

**Nota sobre órfãos**: os candidatos MAIS prováveis a terem ficado órfãos (sem WI no 04) são: (a) o pipeline E2E bloqueado (§6), (b) os stubs de UI "em breve" §2 que dependem de decisão do dono já registrada em código mas talvez não migrada ao 04 (`/crm/conteudo` G-D2, Talk-and-Go de voz, auto-fluxo IA, base de conhecimento só-no-navegador), e (c) qualquer item gap/parcial de `progresso-sistema-data.ts` (§4) que não apareça no backlog RAS/FIN/OBR/etc. As 3 TODOs §1 e a família `migracao_pendente` §3 parecem capturadas (referenciam WI/Onda/fases explicitamente).
