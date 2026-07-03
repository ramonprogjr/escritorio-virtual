# AUDITORIA QA DO SISTEMA — SÍNTESE DO CEO (03/jul)

8 equipes de QA (por domínio) sobre ~52 telas + E2E ao vivo (chrome-devtools, prod, logado como Hub, dado real do Consulado). Pareia com **docs/QA-AO-VIVO-achados.md**.

## VEREDITO (franco)
O sistema **está genérico e persona-cego — e a causa é ARQUITETURAL, não cosmética**: os agregadores (`lib/crm/dashboard-aggregate.ts` e o analytics) filtram **só por `tenant_id`, nunca por papel**. Resultado exato da sua dor: HUB, arquiteto, engenharia, serviços e cliente abrem a **mesma tela de funil de vendas**. Onde mais dói:
1. Ninguém além do operador comercial tem cockpit próprio (engenharia e cliente **não têm dashboard nenhum**).
2. **O dinheiro não flui** — o negócio-raiz (R$150k) não gera recebível, aprovação nem escrow; a "alma do produto" (dupla-chave) nunca é exercitada.
3. Os **portais externos** (fornecedor, parceiro) são fachada.
O esqueleto técnico é sólido e os números em geral são reais (não hardcoded). O problema é que **tudo foi desenhado para UMA persona e replicado igual**.

## TOP FIXES P0
1. **Cockpit persona-aware** (`/crm` + `/crm/analytics`): `aggregateDashboard` recebe o papel e monta recorte próprio (HUB=ecossistema · engenharia=obras/medições/pedidos · arquiteto=projetos/aprovações · cliente=minha obra/escrow). — mata a dor.
2. **Fazer o dinheiro FLUIR** (financeiro/receber/pagar/aprovações): criar o elo negócio-ganho/medição → conta a receber + aprovação de escrow; semear o Consulado com recebíveis reais. — financeiro deixa de ser casca. *(precisa SQL/janela do dono)*
3. **Modelar a dupla-chave do escrow** (aprovações): hoje Chave 1 (Arq) e Chave 2 (Hub) são cards **independentes** — nada exige AS DUAS. A alma do produto está quebrada na modelagem.
4. **Papel no Relacionados** (`negocios/[id]/relacionados/route.ts`): a rota **descarta `papel`** → arquiteto/fornecedor/prestador/cliente viram sopa plana. Coração da rastreabilidade.
5. **Vazamento tenant-NULL** (`/crm/pedidos` GET usa `.or(is.null)`): trocar por `.eq('tenant_id')` puro — padrão que a memória proíbe.
6. **Portal do fornecedor real**: `/fornecedor` é stub ("protótipo"/"Fase 3"); `/fornecedor/cotacao` é ferramenta interna do comprador mal-rotulada (fornecedor externo toma 401/403).
7. **Botão morto do parceiro** (`/parceiro` "Abrir painel" sem `id+s` HMAC → erro 100%).
8. **`/crm/tarefas` não é o Gestor de Tarefas universal** (só "próximas ações" de leads, sem CREATE): renomear o menu OU construir o gestor da spec.

## POR PERSONA — o que precisa ver e hoje NÃO vê
- **HUB:** cockpit do **ecossistema** (saúde por negócio, obras em risco, carteira/receita da rede, IA por tenant, lente de auditor). Hoje: funil comercial single-tenant.
- **Engenharia:** **não tem dashboard.** Precisa: obras em andamento, **medições a aprovar → pagamento**, pedidos c/ valor, avanço físico, cronograma. *O conceito de MEDIÇÃO não existe no financeiro.*
- **Arquiteto:** fila de projetos/briefings, aprovações, **disparidade de orçamento**, honorários; ser a **Chave 1** do escrow.
- **Serviços/Prestador:** ver **só os leads/OS encaminhados a ele** + home própria (hoje cai no /crm genérico).
- **Fornecedor:** as **cotações direcionadas a ele** + status das propostas + pedidos a entregar.
- **Cliente:** **não existe visão de cliente.** Precisa: status da obra (avanço/medições — cura dos 5 medos), o que aprovar, e o **escrow**.
- **Parceiro:** a **lista dos próprios leads** (hoje o dashboard admite que nega e só mostra 6 contadores), conversão %, comissão em R$, e ≥1 ação.

## DASHBOARDS/ANALYTICS/RELATÓRIOS (foco #1)
- **Recorte por persona = fix-mãe.** Preservar e replicar `CrmOQuePrecisaDeVoce` ("O que precisa de você") — a única peça boa (regra + contagem real + 1 toque).
- **Funil da home mostra ZEROS** (`CrmPipelineResumo` agrega estágio cru sem `legacyToFunil` — mesmo bug do kanban L2/L3, não corrigido aqui).
- **Analytics nasce VAZIA** (KPIs só via botão manual "Atualizar KPIs" → virar **cron diário**).
- **KPIs mortos/vaidade:** "Negócios sit-down" (=0 sempre), "Receita potencial (leads)" (=R$0, leads sem valor), "Entregues/mês" mede criado_em (errado), "A vencer" hardcoded "—", "Qualificados/Negociando" contam só a página (LIMIT 20).
- **/crm/relatorios:** "Detalhamento" é dump de tabela cru; bug cosmético `Fonte: \`/api/crm/metricas\`` (crases na tela); falta exportar CSV/PDF; sem filtro de período.
- **Inconsistência financeira:** dashboard busca aprovações `IN('pagamento','financeiro')` mas a página usa `pagamento_obra_arq/hub, orcamento_frente, cotacao_fornecedor` — não se cruzam → escrow real nunca aparece.
- Mover pra "Admin/Sistema": `/crm/progresso-sistema`, `/crm/precificacao`. `/crm/kpis` é só redirect.

## BOTÕES DECORATIVOS/QUEBRADOS (amostra)
parceiro "Abrir painel" (sem HMAC=erro) · fornecedor "protótipo" (403) · obras "Reprogramar/Avisar"→copiloto genérico (morto sem MISTRAL) · arquitetura KPI "Atrasados" não clicável · canais "olho"=Configurar (redundante) · parceiros checkboxes decorativos · pessoas/empresas "Editar" grava campo obsoleto do state · especialistas badge "verificado" sem fluxo · imóveis dropdown sem "alugado" · Dashboard card "Agentes cadastrados" (vaidade) + faixa "Visão comercial" (duplica).

## AINDA VIOLAM "DELETE só arquiva"
`/crm/contatos`, `/crm/canais-entrada`, `/crm/distribuicao`, `/crm/cadastro` fazem DELETE físico (e o copy de /cadastro diz "não pode ser desfeita", contradizendo).

## SOBREPOSIÇÃO DE CONCEITO (fonte da sensação "genérico")
(a) `/crm/empresas` lista **escritórios/tenants** mas `/crm/empresas/[id]` abre **empresa PJ do cadastro** — entidades diferentes, mesma URL. (b) **Tripla sobreposição** fornecedores × parceiros × empresas-do-cadastro (todos = homologação+mercados+recebe_leads).

---
## PLANO DE EXECUÇÃO
- **CEO faz sozinho agora (código, gate verde):** papel no Relacionados (P0#4) · tenant-NULL pedidos (P0#5) · funil legacyToFunil · backtick relatórios · placeholder de código na busca · KPIs vaidade. + design v1 do **cockpit persona-aware** (P0#1).
- **Guardado pro dono:** fazer o dinheiro fluir + dupla-chave escrow (P0#2/#3 — precisa SQL/janela) · portal fornecedor + gestor de tarefas + desambiguar fornecedores/parceiros/empresas (decisões de produto) · validar o cockpit.
