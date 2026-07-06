# 🏦 DESIGN — Financeiro de REDE: Motor de Comissões + Financeiro por Negócio + Rollup Hub
> Mesa Fable (4 lentes + síntese) — 06/jul. Reusa os trilhos existentes (hub_negocios/hub_aprovacoes/escrow). Aprovado pelo CEO. Refina [[spec-rede-comissoes-financeiro-por-negocio]], [[decisoes-alavanca-06jul-faixa-escrow-tijolos]].

# MODELO UNIFICADO — Financeiro de REDE do Obra10+ (motor de comissões + financeiro por negócio + rollup Hub + fronteira Tijolos)

## Princípio-mãe (arbitra tudo)
**Uma base, um snapshot, um trilho, duas moedas que nunca se misturam.**
- Base do split = **POTE** (`valor_fechado × percentual_comissao`, colunas que JÁ existem em `hub_negocios` — verificado migração 20260522120000:15-16). Fatia = % do pote. Ninguém fala "% do valor do negócio" — quem quer mexer no total mexe no `percentual_comissao` do próprio negócio.
- Snapshot **imutável** no fechamento (decisão travada do dono) — vira constraint (trigger), não convenção.
- Pagamento anda no **trilho de dupla chave que já move dinheiro em prod** (`hub_aprovacoes` + cascata de `lib/ia/aprovacoes.ts` + clone da `rpc_liberar_escrow`) — tipos novos, zero trilho novo.
- **Comissão sacável = BRL, sempre. Tijolo nunca é comissão** — é crédito de serviço do próprio Hub (trava BACEN, doc Carteira C4).

## 1. As 4 tabelas novas (união reconciliada das lentes 1, 2 e 3)

### 1.1 `hub_split_regras` — onde a regra NASCE (item 2 da spec: as DUAS origens numa tabela)
Schema da lente Engine (o mais completo), com o vocabulário de papéis da lente Motor:
- `escopo IN ('parceiro','negocio')` com CHECKs de exclusividade (`parceiro_id` XOR `negocio_id`).
- `beneficiario_tipo IN ('parceiro','pessoa','empresa','hub')` + `beneficiario_id` — mesmo vocabulário de `hub_negocio_vinculos`.
- `papel_gatilho` (indicou_cliente | indicou_comprador | indicou_vendedor | executor | captador) — CHECK aditivo.
- `pct NUMERIC(6,3)` XOR `valor_fixo NUMERIC(14,2)`; **base ÚNICA = pote** na fase 1 (coluna `base` existe no schema com default 'pool_comissao', mas a UI só expõe % do pote — a base dupla da lente Engine fica dormente).
- Mutável (é config); delete = `ativo=false + arquivado_em`. UNIQUE parcial `(tenant, escopo, alvo, beneficiario, papel_gatilho) WHERE ativo` impede regra duplicada no mesmo degrau.
- Seed: `hub_parceiros.comissao_pct` (já existe, default 5%) vira o fallback vivo — não se apaga a coluna.
- RLS padrão E6: `tenant_id NOT NULL` + `current_user_tenant_id()`; app usa `.eq('tenant_id')` puro.

**Precedência determinística (4 degraus):** (1) ajuste manual no snapshot (alçada + log em `hub_crm_logs`) → (2) regra `escopo='negocio'` → (3) regra `escopo='parceiro'` casando `papel_gatilho` (+`mercado_sigla` se preenchido) → (4) fallback `comissao_pct` do parceiro para papel executor. Sem regra nenhuma → 100% do pote fica no Hub (dinheiro nunca "some"). Cada fatia grava `regra_id` + `regra_origem` — auditoria "de onde veio".

### 1.2 `hub_comissoes` — o SNAPSHOT (fato histórico puro, append-only)
Nome e desenho da lente Engine (mais completo que `hub_split_itens`): `apuracao_seq`, tudo congelado por VALOR (`base_valor`, `pool_pct`, `pct_aplicado`, `valor` em R$, até `beneficiario_nome`), `moeda CHECK ('BRL')` — a trava BACEN no schema —, `estorna_comissao_id` (correção = linha compensadora negativa, nunca UPDATE), **sem coluna de status e sem `atualizado_em`** (estado de pagamento mora no título, §1.3). UNIQUE por (negocio, seq, beneficiário) = idempotência estrutural. INSERT só via RPC/service_role + trigger BEFORE UPDATE/DELETE com RAISE (cinto-e-suspensório, padrão Tijolos §3). Fatia do Hub = linha `regra_origem='residual_hub'` explícita — **juiz declarado é juiz confiável**.

Criação: `rpc_apurar_comissoes(p_negocio_id, p_tenant_id)` — SECURITY DEFINER, guard de tenant ANTES de mutar, `FOR UPDATE` no negócio, idempotente (retry não duplica), fail-closed honesto (`valor_fechado` NULL/0 → `{ok:false, erro:'sem_valor_fechado'}` — nunca snapshot de zeros), valida `SUM(fatias) ≤ pote` na RPC (invariante multi-linha não é CHECK-ável), grava `comissao_calculada` (coluna existente) e insere os títulos (§1.3) **no mesmo commit**.

### 1.3 `hub_negocio_titulos` — o financeiro POR NEGÓCIO (item 3 da spec: contas a pagar/receber de cada participante)
Desenho da lente Financeiro (o único que resolve exigibilidade), absorvendo os campos da lente Engine:
- `direcao IN ('receber','pagar')` na ótica do Hub-orquestrador; `natureza IN ('recebivel_cliente','comissao_split','taxa_plataforma','honorario','retencao','ajuste')`.
- `comissao_id → hub_comissoes` (título nascido do split), `contraparte_*` desnormalizado + `contraparte_nome` congelado.
- **`valor_exigivel` = o coração do cash-basis**: título apurado ≠ pagável; só ganha exigibilidade pro-rata quando o dinheiro do cliente ENTRA (`rpc_registrar_recebimento_negocio` distribui `valor_titulo × recebido/valor_fechado`, sobra de centavos determinística no maior título). **O Hub nunca financia a rede com caixa próprio.**
- Gate 2 duplo REUSADO: 2 tipos novos no CHECK de `hub_aprovacoes` — **`pagamento_comissao_ok`** (chave 1: o BENEFICIÁRIO confirma valor/dados — espelha a doutrina "Hub determina, parceiro dá o OK") + **`pagamento_comissao_hub`** (chave 2: o Hub/juiz autoriza). 2 humanos distintos (mecanismo `dados.titulo_id` no JSONB, igual `validarChaveEscrow`). `rpc_liberar_pagamento_comissao` = clone fail-closed da `rpc_liberar_escrow`. Guard extra no gate: `hub_parceiros.status_acesso` checado NA HORA DE PAGAR (bloqueado → `retido`, não paga nem apaga).
- Ponte anti-dupla-contagem: `pagamento_obra_id → hub_obra_pagamentos` / `ref_escrow_mov_id` — quando o deal virou obra, o dinheiro de execução continua no escrow E6; o rollup deduplica pela ponte. **Obrigatória desde a fase 1.**
- Fase 1 sem conta de escrow própria do negócio: baixa manual com comprovante (mesmo realismo do topup PIX), status soft (`previsto→apurado→liberado→autorizado→pago|cancelado|retido`).

### 1.4 `hub_negocio_fin_movimentos` — o EXTRATO append-only do negócio
Clone estrutural de `hub_obra_escrow_movimentos`: `tipo IN ('recebimento','liberacao','pagamento','estorno','retencao_liberada')`, sem policy UPDATE/DELETE, corrigir = estornar com linha nova. É o lastro que o rollup do Hub e o "meu dinheiro" do participante leem. **Uma linha, duas lentes**: o `pagar` do negócio É o "a receber" do participante — nunca linha espelhada.

## 2. QUANDO a comissão nasce (conflito central, resolvido)
Linha do tempo em 5 estados — cada lente estava certa sobre um pedaço:
1. **PREVISTA** (aberto): simulação regravável na ficha ("se fechar hoje, o split é este") — única exceção ao imutável, e a UI diz isso.
2. **APURADA = CONFIRMAR HUMANO.** O ganho (`tipo_fecho='ganho'`, fix A1) **propõe**, o humano **congela**: painel "Fechar comissão — R$ X para N participantes" ao lado do "gerar entrega" existente (route.ts:280, mesmo padrão PROPOR+CONFIRMAR). Nunca automático no drag do kanban — ganho por engano não congela dinheiro (lição do converter-obra). Vale a regra do DIA DO FECHAMENTO.
3. **EXIGÍVEL = cliente PAGOU** (pro-rata, §1.3). Em obra: cada medição paga libera a fatia proporcional via ponte E6.
4. **APROVADA = 2 chaves** (OK do beneficiário + Hub).
5. **PAGA** = baixa manual + comprovante + movimento.
Renegociou depois de congelado? Estorno (linha negativa) + apuração `seq+1` — o extrato conta a história inteira.

## 3. Cadeia de atribuição (item 1 da spec) — N níveis SEM virar pirâmide
- **Nível 1** (fase 1): quem está em `hub_negocio_vinculos` DESTE negócio com papel remunerável — o CHECK já inclui `'indicador'`, nunca usado; passa a ser usado. Arquiteto que trouxe o comprador da venda = vínculo `indicador/indicou_comprador` → fatia BRL do pote. Corretor que trouxe cliente de projeto = idem. UI só oferece quem JÁ é vínculo (Click-and-Go, nada de digitar nome).
- **Nível 2** (fase 2): `indicado_por` (self-FK + HMAC, já existe) de cada beneficiário nível 1. **Hard-stop: CHECK `nivel IN (1,2)` no schema** — nível 3+ não é config, não existe. Decaimento obrigatório (proposta 20% da fatia do indicado). Guarda de ciclo (set de visitados no walk). Recompensa nível 2 = **bônus em Tijolos não-sacáveis** (incentivo de plataforma, financiado pelo Hub como marketing, NUNCA descontado do split) — mata a leitura MMM na raiz. Anti-pirâmide completo: só paga sobre negócio fechado E recebido; indicar/recrutar não gera um centavo.

## 4. Rollup pro Hub (o orquestrador/juiz)
- View `vw_hub_financeiro_rede` (security_invoker): a pagar à rede (exigível) / a receber de clientes / fatia da plataforma acumulada / retido — card no cockpit + fila dourada de pagamentos por vencimento.
- Participante: fase 1 lê seus títulos NA FICHA DO NEGÓCIO (mesmo tenant). Tela cross-tenant "Meu dinheiro na rede" = fase 2, endpoint service-role com `parte_id` resolvida da SESSÃO (nunca de param — padrão IDOR/HMAC já auditado).
- Ficha do negócio: aba Financeiro + rota `app/api/crm/negocios/[id]/financeiro/route.ts` espelhando a de obras (reusa `baldePagamento`/`derivarEstadoDupla`). Estética de extrato bancário: hero com 4 números, tabela por participante com pill dupla-chave, barra de 100% do split (fatias coloridas + "Hub (resto)" dourado; >100% = vermelho + salvar desabilitado, validado em UI+API+RPC).

## 5. Spread da IA (item 4 da spec) + fronteira R$ × Tijolos
**Zero tabela nova.** O spread JÁ existe: `markup` em `hub_ia_config` (resolução tenant>global viva em `lib/ia/metering.ts`). Formaliza-se:
- Snapshot por movimento (gêmeo da comissão imutável): colunas `markup_aplicado/fx_aplicado/valor_credito_aplicado` em `hub_ia_consumo` — reprecificar nunca reescreve o passado.
- Fixes code-safe: `markup>=1` no PUT (bug real verificado: route.ts:41 aceita 0/negativo = IA de graça) + `tokensCacheRead × cache_read_fator` (coluna existe, morta) antes do prompt-caching ligar.
- Relatório "Margem de IA" (view sobre `hub_ia_consumo`, zero migração): margem realizada × sombra — dá ao dono o NÚMERO para a decisão 10x vs 3-5x.
- **Fronteira dura**: comissão sacável = BRL sempre; sem tipo `saque`/`transferencia` no CHECK do ledger de Tijolos; **Tijolo nunca paga terceiro** (a linha que separa "crédito de serviço próprio" de e-money/BACEN); ledgers fisicamente separados, ponte só por `ref_tipo/ref_id`; UI nunca soma os dois saldos; única volta Tijolo→BRL = reembolso CDC de crédito comprado não-consumido. Pontes one-way permitidas: franquia de plano, bônus por evento (nível 2), e — só com mesa jurídica — conversão opt-in "comissão BRL compra crédito com desconto" (recibo BRL cheio, máx 50%, fase futura).

## 6. Travas respeitadas (checklist)
Multi-tenant `.eq` puro · append-only/nada-se-perde (snapshot + extrato + estorno-como-linha) · delete=arquiva (regras) / soft-cancel (títulos) · Hub é juiz (2ª chave sempre + residual explícito) · comissão sacável = BRL (CHECK moeda='BRL') · migração = janela do dono · gate humano explícito, nunca trigger mágico · `crm_commissions` morta não é reusada (nomes `hub_*` novos).

---

## 🚦 FASE 1
FASE 1 — "o esqueleto inteiro girando com o menor risco" (nível 1 apenas, zero cadeia, zero Tijolo, reuso máximo do trilho E6):

PASSO 0 — CODE-SAFE HOJE, sem janela (fixes reais, independentes do motor):
(a) Validar `markup>=1`, `fx>0`, `valor_credito>0` no PUT de `app/api/crm/ia/config/route.ts` (bug verificado na linha 41: aceita 0/negativo = IA de graça);
(b) `tokensCacheRead` em `ConsumoInput` + `custoUsdDeTokens` usando o `cache_read_fator` já existente (testes em `metering-calc.test.ts`);
(c) View/tela "Margem de IA" no Hub-admin: `SUM(custo_brl − custo_usd×fx)` por tenant/mês sobre `hub_ia_consumo` — zero migração, separando margem realizada × sombra (insumo da decisão de spread).

PASSO 1 — UMA migração aditiva empacotada (janela do dono, tudo junto para uma janela só):
(a) `hub_split_regras` + `hub_comissoes` (trigger de imutabilidade + INSERT só via RPC) + `hub_negocio_titulos` + `hub_negocio_fin_movimentos` (append-only), todas `tenant_id NOT NULL` + RLS `current_user_tenant_id()` (DNA E6);
(b) 2 tipos novos no CHECK de `hub_aprovacoes.tipo`: `pagamento_comissao_ok` + `pagamento_comissao_hub` (DROP+ADD — avaliar migrar o CHECK p/ tabela de domínio nesta mesma janela, é a 3ª expansão);
(c) 3 RPCs SECURITY DEFINER com guard de tenant, clones estruturais da `rpc_liberar_escrow`: `rpc_apurar_comissoes` (FOR UPDATE, idempotente, fail-closed em valor_fechado nulo, SUM≤pote), `rpc_registrar_recebimento_negocio` (pro-rata do exigível + movimento), `rpc_liberar_pagamento_comissao` (2 chaves + status_acesso do parceiro);
(d) OBRIGATÓRIO na mesma janela: apertar a RLS `USING(true)`+GRANT anon de `hub_negocio_vinculos` (verificado: 20260620180000:157-162) — não se constrói cofre sobre porta aberta;
(e) Carona da lente IA: CHECK `markup>=1` em `hub_ia_config` + colunas de snapshot em `hub_ia_consumo` (na mesma RPC atômica que fecha o SEC-8 da Carteira).

PASSO 2 — Código (rota + hook + resolver):
(a) Rota `app/api/crm/negocios/[id]/financeiro/route.ts` espelhando a de obras (GET resumo+títulos+extrato; PATCH fechar_comissao/registrar_recebimento/enviar_pagamento/cancelar; tolerante a `migracao_pendente` como a E6);
(b) Hook no branch `tipoFechoAlvo==='ganho'` do PATCH existente (route.ts:126-150): PROPÕE o painel "Fechar comissão" — snapshot só no CONFIRMAR humano (mesmo padrão 2-passos do converter-obra); guard na UI exigindo `valor_fechado` antes do ganho (senão comissão some silenciosa);
(c) 2 tipos novos no resolver de `lib/ia/aprovacoes.ts` (capability nova `comissao:ok_beneficiario` + reuso de `escrow:chave_hub`).

PASSO 3 — UI (dark verde+dourado, estética de extrato bancário):
(a) Card "Comissão padrão" na ficha do parceiro — chips 5%·10%·15%·outro por papel-gatilho, 2 toques (grava `hub_split_regras escopo='parceiro'`; fallback `comissao_pct` continua valendo sem UI nenhuma);
(b) Card "Divisão da comissão" na ficha do negócio — pote em R$ grande, participantes puxados de `hub_negocio_vinculos` (escolher e confirmar, nunca digitar), fatia sugerida pela regra padrão, barra de 100% com "Hub (resto)" dourado, ajuste manual = pill "sobrescrito neste negócio" + log;
(c) Painel "Fechar comissão — R$ X para N participantes" no ganho;
(d) Aba Financeiro do negócio (4 números hero + tabela por participante com pill de 2 chaves) + card "A pagar à rede" no cockpit lendo `vw_hub_financeiro_rede`.

FICA FORA da fase 1 (explícito): nível 2/cadeia `indicado_por`, qualquer Tijolo no circuito de comissão (bônus ao indicador = fase 2; conversão opt-in = mesa jurídica), condições jsonb/faixas/vigência, tela cross-tenant "Meu dinheiro na rede" do parceiro, escrow/custódia própria do negócio, clawback automatizado, pagamento bancário automático, estorno automático em reabertura, escopo `plano` no spread.

RESULTADO OBSERVÁVEL: o dono fecha uma venda de imóvel, vê o pote dividir entre corretor e arquiteto na barra de 100%, confirma e congela; o PIX do cliente torna as comissões exigíveis pro-rata; o pagamento só sai com OK do beneficiário + chave do Hub; tudo num extrato imutável que deduplica com o financeiro da obra.

---

## ⚖️ Conflitos resolvidos
RESOLVIDOS (com fundamento):

1. TABELAS — 3 propostas de nomes/formas divergentes (split_regras+split_itens da lente Motor; negocio_titulos+fin_movimentos da lente Financeiro; split_regras+comissoes+lancamentos da lente Engine). RESOLVIDO em 4 tabelas com papel único cada: `hub_split_regras` (regra, mutável — consenso Motor+Engine), `hub_comissoes` (snapshot, fato histórico SEM status — desenho Engine, mais completo: apuracao_seq/estorno/moeda CHECK BRL), `hub_negocio_titulos` (estado de pagamento + valor_exigivel — desenho Financeiro, único que resolve exigibilidade), `hub_negocio_fin_movimentos` (extrato append-only). O `hub_split_itens` da lente Motor misturava snapshot com status de pagamento — separado; o `regra_snapshot JSONB` da lente Financeiro dentro do título — substituído pela FK a `hub_comissoes` (snapshot relacional > jsonb para auditoria).

2. QUANDO A COMISSÃO NASCE — Motor: confirm humano; Financeiro: no ganho (atrás do gate); Engine: 2-passos explícito. RESOLVIDO com a linha de 5 estados: PREVISTA (simulação regravável) → APURADA no CONFIRMAR humano (o ganho PROPÕE, nunca congela sozinho — mesma doutrina do converter-obra) → EXIGÍVEL no recebimento pro-rata → APROVADA (2 chaves) → PAGA. Cada lente estava certa sobre um estado.

3. SEGUNDA CHAVE EM NEGÓCIO SEM OBRA — Motor: `pagamento_comissao_resp`; Financeiro: OK do beneficiário; Engine: chave_hub + gestor comercial distinto. RESOLVIDO: chave 1 = OK do PRÓPRIO beneficiário (`pagamento_comissao_ok`) + chave 2 = Hub — é a extensão mais fiel da doutrina existente ('quem determina é o Hub; o parceiro dá só o OK', lib/ia/aprovacoes.ts) e o OK do beneficiário serve de conferência de dados bancários de graça. Precisa bênção do dono (decisão 5) porque estende a doutrina do escrow.

4. NÍVEL 2 EM TIJOLOS — [CONFLITO PARCIAL, sem consenso pleno]: a lente Motor quer nível 2 preferencialmente em Tijolos JÁ COMO PARTE do motor; a lente Spread/Fronteira aceita bônus-Tijolo ao indicador mas exige que QUALQUER coisa perto de 'comissão em Tijolo' passe por mesa jurídica, e tira tudo da fase 1. RESOLVIDO POR ADIAMENTO: fase 1 = nível 1 apenas, zero Tijolo (consenso das 4 nas próprias propostas de fase 1); nível 2 = fase 2 com bônus-Tijolo (enquadrado como incentivo de plataforma financiado pelo Hub, nunca descontado do split — não é comissão); BRL no nível 2 ou conversão opt-in = só com mesa jurídica. Marcado como decisão 7/8 do dono.

5. BASE DUPLA ('pool_comissao' vs 'valor_fechado' no schema da Engine) vs BASE ÚNICA (Motor, firme). RESOLVIDO: coluna `base` fica no schema com default (custo zero), mas a UI da fase 1 só expõe % do pote — base ambígua é o canto mais perigoso do domínio, e a lente Motor está certa que 'uma base só' é o que protege a confiança do parceiro.

6. TIPOS NO CHECK DE hub_aprovacoes — 3 nomenclaturas propostas. RESOLVIDO: `pagamento_comissao_ok` + `pagamento_comissao_hub` (diz o quê + quem; 'rede' é vago, 'resp' colide com a semântica técnica do escrow de obra).

7. SPREAD DA IA — sem conflito entre lentes; a lente Fronteira provou que o item 4 da spec NÃO precisa de construção nova (markup já existe e é parametrizável) — só governança: snapshot por linha, CHECK de sanidade, relatório de margem. Incorporado como está.

## 🧭 DECISÕES DO DONO
1. 1. MOMENTO DO CONGELAMENTO (bloqueia o Passo 2): snapshot no CONFIRMAR humano do painel 'Fechar comissão' (recomendação unânime das 3 lentes de dinheiro — espelha o gate 'gerar entrega') ou automático no ganho do kanban? Automático congela dinheiro em ganhos por engano.
2. 2. BASE DO SPLIT (bloqueia o schema exposto na UI): confirmar que fatia é SEMPRE % do POTE (valor_fechado × percentual_comissao), nunca % do valor do negócio — recomendação firme e unânime; quem quer mexer no total mexe no percentual_comissao do negócio.
3. 3. PAGAR SÓ APÓS RECEBER (decisão de CAIXA, não técnica): confirmar cash-basis pro-rata (comissão só vira pagável na proporção do que o cliente JÁ pagou) — recomendação firme; a alternativa é o Hub financiar a rede com caixa próprio.
4. 4. HUB RESIDUAL: sobra do pote (100% − fatias) vira fatia explícita do Hub (linha 'residual_hub' visível — recomendado: juiz declarado) — e existe % MÍNIMO garantido do Hub que a barra de 100% deve reservar (ex.: nunca menos de 10%)?
5. 5. CHAVE 1 DO PAGAMENTO + TIMEOUT: confirmar que a 1ª chave é o OK do PRÓPRIO beneficiário (estende a doutrina 'Hub determina, parceiro dá o OK' — precisa bênção); e silêncio do parceiro = concorda após N dias (sugestão 7d com aviso) ou trava indefinida?
6. 6. VISIBILIDADE CRUZADA: participante vê só o PRÓPRIO título ou o split inteiro (quem ganha o quê)? Trade-off transparência × atrito comercial. (A fatia do Hub aberta = recomendado SIM independente.)
7. 7. NÍVEIS E DECAIMENTO (fase 2, mas trava schema): confirmar teto de 2 níveis como CHECK no banco + fração do nível 2 (proposta: 20% da fatia do nível 1) + nível 2 pago em Tijolos não-sacáveis (bônus de plataforma) — se quiser BRL no nível 2, mesa jurídica ANTES (leitura MMM/e-money). [CONFLITO entre lentes — ver campo conflitos]
8. 8. CONVERSÃO COMISSÃO→TIJOLO COM BÔNUS (fase futura): aprovar o desenho 'parceiro usa a comissão BRL dele para COMPRAR crédito com desconto, opt-in por-pagamento, one-way, máx 50%, recibo BRL cheio' e mandar pra mesa jurídica — ou vetar de vez?
9. 9. SPREAD DA IA: manter 10x até o relatório de margem existir (recomendado) + aprovar 'mesmo preço de Tijolo p/ todos os planos, planos diferem na FRANQUIA' (preserva a âncora 1 Bloco = R$10) + tenant vê preço por ação, nunca o multiplicador.
10. 10. ALÇADA: quem ajusta split manual por-deal (comercial? financeiro? só owner do tenant?) e quem define a regra padrão no cadastro do homologado.
11. 11. PAPÉIS REMUNERÁVEIS INICIAIS: validar a lista (indicou_cliente, indicou_comprador, indicou_vendedor, executor, captador) — cada papel novo depois é CHECK aditivo.
12. 12. CLAWBACK: cliente dá calote/estorna DEPOIS de comissão parcialmente paga — Hub cobra de volta (título de estorno a receber) ou absorve? Precisa estar no contrato do homologado antes do 1º split real.
13. 13. RETENÇÃO PADRÃO DA REDE: existe? Qual % e qual evento libera (conclusão do negócio / fim de garantia / prazo fixo)?
14. 14. REABERTURA de negócio ganho com comissão apurada: bloquear, ou permitir gerando estorno automático? Tem efeito em dinheiro possivelmente já pago.

## ⚠️ Top riscos
1. RLS ABERTA SOB O DINHEIRO (verificado no código): hub_negocio_vinculos — a espinha dos participantes do split — tem policy USING(true) + GRANT a anon (20260620180000:157-162). Apertar NA MESMA janela da migração do motor é pré-condição, não melhoria: construir split em cima disso é cofre sobre porta aberta.
2. BUG REAL HOJE, independente do motor: PUT /api/crm/ia/config aceita markup 0/negativo (route.ts:41, verificado) e não há CHECK no banco — um typo do owner faz a IA rodar de graça. Fix code-safe imediato (Passo 0).
3. SOMA DAS FATIAS > 100% DO POTE por regras padrão legítimas se acumulando (indicou_comprador 20% + indicou_vendedor 20% + executor 70%) — invariante multi-linha não é CHECK-ável; precisa das 3 camadas (barra na UI + 400 na API + validação na RPC) + INSERT de hub_comissoes restrito a RPC, senão SQL direto fura.
4. DUPLA CONTAGEM obra×negócio: o recebível do cliente numa obra já vive no escrow E6; rollup que soma títulos do negócio + movimentos da obra sem deduplicar pela ponte mostra o mesmo dinheiro 2x no cockpit — a ponte é obrigatória desde a fase 1.
5. VAZAMENTO CROSS-TENANT na futura leitura do beneficiário (fase 2): título vive no tenant do negócio, beneficiário é OUTRO tenant — endpoint service-role com parte_id da SESSÃO (nunca de param); é o padrão IDOR/tenant-null-leak já auditado, agora com dinheiro.
6. PIRÂMIDE/REGULATÓRIO: cadeia sem teto+decaimento vira MMM na prática e na leitura do regulador; teto 2 níveis = CHECK no banco (não config); comissão em Tijolo sacável ou Tijolo pagando terceiro = perímetro BACEN (e-money) — qualquer exceção passa por mesa jurídica ANTES.
7. valor_fechado NULL no ganho (fluxo atual não obriga): a RPC recusa honesto, mas isso significa comissão 'sumindo' em silêncio — precisa do guard na UI exigindo valor antes do ganho.
8. IMUTABILIDADE DE FACHADA: qualquer endpoint que permita UPDATE de valor em comissão apurada transforma o snapshot em mentira e a primeira disputa entre parceiros em palavra-contra-palavra — trigger de RAISE desde o dia 1 (cinto-e-suspensório contra o próprio service_role).
9. ARREDONDAMENTO no pro-rata: múltiplos recebimentos parciais × N participantes gera sobras de centavos; sem regra determinística documentada (sobra no maior título) a conciliação nunca fecha e o extrato perde a credibilidade — que é o produto inteiro.
10. JANELA E TESTE: todas as tabelas + DROP+ADD do CHECK de hub_aprovacoes (3ª expansão — typo trava TODOS os gates) = janela do dono; e o schema não-reproduzível (achado 05/jul, migrations fora de ordem) faz o ensaio local dessa migração ser manual — ensaiar o SQL num branch Supabase antes da janela.