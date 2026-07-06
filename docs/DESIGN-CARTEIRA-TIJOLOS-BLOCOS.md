# 🧱 DESIGN — MOEDA TIJOLOS/BLOCOS + Carteira + Planos SaaS
> Mesa redonda (Fable, 4 lentes + síntese) — 06/jul. Aprovado pelo CEO com refinamentos (ver rodapé). Decisões do dono pendentes na seção final. Refina [[monetizacao-licenciamento-rede]] e [[creditos-ia-metering-visao]].

# MOEDA TIJOLOS/BLOCOS — Modelo Unificado (síntese da mesa, 06/jul)

## 1. A decisão-mãe: NÃO existe moeda nova

O Tijolo **já existe** em produção como crédito de IA (`lib/ia/metering.ts` + `hub_ia_creditos_mov`). A "moeda ampla" do dono se implementa **promovendo esse ledger a Carteira do Tenant** — mesma tabela, migração aditiva, novos tipos de movimento. As 4 lentes convergiram nisso sem exceção. Criar uma segunda moeda seria o único erro fatal possível aqui.

## 2. Unidade e paridade (âncora)

- **Unidade armazenada: TIJOLO, inteiro (BIGINT), com sinal** (crédito >0, débito <0). Nunca fração.
- **Bloco = 100 Tijolos = REGRA DE APRESENTAÇÃO**, não coluna no banco (como real×centavo).
- **Paridade herdada do código: 1 Tijolo = R$ 0,10 → 1 Bloco = R$ 10,00** (`hub_ia_config.valor_credito_brl`, parametrizável em UM lugar; reprecificar nunca reescreve o passado — cada movimento congela `valor_brl` da época).
- Regra de comunicação (UX): **"Você compra em Blocos, o sistema gasta em Tijolos."** R$ sempre ao lado nas decisões. Vocabulário de banco (extrato/saldo/comprovante/estorno), nunca de jogo.

## 3. O ledger único (evolução aditiva de `hub_ia_creditos_mov`)

Novas colunas: `origem` (tipada por CHECK), `ref_tipo`, `valor_brl` (lastro congelado), `idempotency_key` (UNIQUE parcial por tenant), `estorna_mov_id`, `criado_por`, `dados` JSONB. Mais:
- **Trigger de imutabilidade** (sem UPDATE/DELETE — padrão escrow E6): corrigir = estornar com nova linha.
- **Pré-requisito duro: backfill + `SET NOT NULL` em `tenant_id`** (hoje nullable — padrão tenant-null-leak já auditado). Carteira sem dono não existe.
- **Saldo = SUM(movimentos)** via `rpc_carteira_saldo` no Postgres (substitui a soma O(n) em JS). Cache materializado só quando doer; o extrato é sempre a verdade.
- Opcional: VIEW `hub_carteira_mov` para dar o nome certo sem migrar dados (dívida de nomenclatura consciente).

Origens tipadas: `topup_pix`, `topup_boleto`, `consumo_ia`, `credito_franquia`, `bonus`, `assinatura`, `comissao`, `ajuste_admin`, `estorno`. **Separar no ledger crédito COMPRADO de crédito FRANQUIA/BÔNUS importa juridicamente** (CDC: comprado não expira).

## 4. Como as 3 fontes de rentabilidade confluem

| Fonte | Como toca a carteira | Fase |
|---|---|---|
| **Créditos de IA** | Já debita (`consumo_ia`). Ganha idempotency_key + RPC transacional (fecha o SEC-8: 2 inserts sem transação) | 1 |
| **Assinatura SaaS** | Preço DENOMINADO em Blocos (ex.: 25 Blocos/mês), **paga em BRL por fatura fora da carteira**; o plano CREDITA franquia mensal de Tijolos (`credito_franquia`). Débito-da-carteira só na fase 2+, depois da régua de aviso de saldo | 1 (franquia) / 2 (débito) |
| **Comissão transacional** | **Retida em BRL no próprio split/escrow — NÃO passa pela carteira.** O que entra em Tijolos são os incentivos em volta: bônus ao indicador, cashback, opção do parceiro receber parte em Tijolos com bônus. Lead pago em Tijolos = fase 2 | BRL agora / incentivos fase 2 |

Regra de bolso do "o que debita": **ação humana no sistema = grátis (incluso no plano); ação de IA/serviço externo = Tijolos; comissão de negócio e serviços físicos = BRL, nunca converte.**

## 5. Tijolos × Escrow: MOEDAS SEPARADAS (recomendação firme da mesa)

| | Tijolo | Escrow |
|---|---|---|
| Natureza | crédito PRÉ-PAGO de serviço da plataforma | dinheiro REAL de terceiros em custódia |
| Sacável | **NÃO** (nem transferível entre tenants) | SIM — a razão de existir |
| Regulatório | crédito de serviço próprio (baixo risco) | trilho próprio (E6, 2 chaves) |

**Ponte única permitida: referência cruzada** (evento do escrow pode GERAR movimento na carteira com `ref_id`), nunca transferência de valor entre os dois ledgers. Misturar arrasta a carteira inteira pro regime BACEN/e-money.

## 6. Top-up (entrada de dinheiro): pedido ≠ movimento

Tabela `hub_carteira_topups` (pedido): estados `aguardando → pago → creditado` / `expirado` / `divergente` (fila humana) / `arquivado` (delete=arquiva). O Tijolo só nasce quando `status→pago`, numa **RPC transacional idempotente** (update do topup + insert no ledger no mesmo commit; UNIQUE de 1 crédito por topup). Campo `tijolos` congelado no pedido honra o preço da época. `confirmado_por` grava QUEM deu baixa.

Os 3 cadeados anti-duplicação (valem pra baixa manual E pra webhook futuro): (1) idempotência de evento; (2) UNIQUE de 1 crédito por recarga; (3) RPC com `FOR UPDATE`. O desenho é o MESMO da fase 1 manual à fase 2 com gateway — só troca quem confirma.

## 7. Planos SaaS (proposta a validar com o dono)

- 🧱 FUNDAÇÃO 10 Blocos/mês (≈R$99): CRM, 2 usuários, 1 obra, franquia 300 Tijolos
- 🏗️ ESTRUTURA 25 Blocos/mês (≈R$249): + Obra/EAP, escrow, WhatsApp IA, leads da rede, franquia 1.000 Tijolos
- 🏠 ACABAMENTO 50 Blocos/mês (≈R$499): + Portal do Cliente, ilimitado, IA avançada, prioridade no score, franquia 2.500 Tijolos
- REDE (sem mensalidade): parceiro leve, só comissionamento; carteira existe pra bônus

Sanidade: franquia do Estrutura custa ~4% da mensalidade em LLM real (markup 10x) — sustentável.

## 8. UX (evoluir o que existe)

`/crm/creditos` vira **"Minha Carteira"**: hero saldo (Tijolos grande + "≈ N Blocos · R$ X"), card Assinatura SEPARADO (informativo na fase 1), extrato imutável com saldo-após e chips de filtro, fluxo "Adicionar Tijolos" em 3 toques (packs fixos Click-and-Go), **estado pendente como cidadão de primeira classe** (nunca somar antes de compensar), comprovante baixável, chip 🧱 no header (minRole gestor). Quando `IA_HARD_CAP=on` ligar, a mensagem de bloqueio nasce JUNTO na UI.

## 9. Sequência de fases (trava de ordem)

**Carteira → top-up → régua de aviso de saldo → só então IA_HARD_CAP=on.** Bloquear IA sem caminho de recarga = matar o copiloto no meio do atendimento. Hard cap exige antes a RPC atômica de gate+débito (o débito que cruza zero é aceito — a IA já rodou, nada-se-perde; o próximo gate bloqueia; negativo = dívida visível no extrato).

---

## 🚦 FASE 1 (menos-arriscada)
FASE 1 — menos-arrisco (PIX com baixa manual, zero gateway, zero bloqueio, IA segue em modo sombra):

**Passo 1 — Migração aditiva (janela do dono, tudo num pacote):**
(a) estender `hub_ia_creditos_mov`: colunas `origem` (CHECK tipado), `ref_tipo`, `valor_brl`, `idempotency_key` (UNIQUE parcial), `estorna_mov_id`, `criado_por`, `dados`; (b) trigger de imutabilidade (sem UPDATE/DELETE, padrão escrow E6); (c) backfill + `SET NOT NULL` de `tenant_id` (pré-requisito, fecha o tenant-null-leak da carteira); (d) criar `hub_carteira_topups` (estados aguardando/pago/expirado/divergente/arquivado, `tijolos` congelado no pedido, `confirmado_por`); (e) RLS: tenant lê o próprio extrato (`.eq` puro), INSERT só via service_role/RPC.

**Passo 2 — RPCs:** `rpc_carteira_saldo` (SUM no Postgres, substitui a soma em JS de `saldoCreditos`) + RPC transacional idempotente de confirmação de topup (FOR UPDATE, valida status, marca pago + insere crédito no mesmo commit, UNIQUE 1 crédito/topup).

**Passo 3 — Tela "Minha Carteira"** (evoluir `/crm/creditos`, não criar rota nova): hero saldo em Tijolos + linha "≈ N Blocos · R$ X" + frase fixa "1 Bloco = 100 Tijolos = R$ 10"; extrato com descrição humana, ±Tijolos, saldo-após, chips de filtro (Tudo/Entradas/IA); consumo de IA vira sub-aba analítica. Dark verde+dourado, minRole gestor.

**Passo 4 — Fluxo "Adicionar Tijolos":** packs fixos em Blocos (sugestão 5/10/25/50, SEM bônus na fase 1), PIX estático do Hub (chave + identificador único do pedido), cria topup 'aguardando' com pílula pendente visível no hero, prazo comunicado ANTES do pagamento.

**Passo 5 — Tela de conciliação do Hub-admin:** pendentes antigas + divergentes; admin confere o extrato bancário e confirma via RPC (papel restrito, `confirmado_por` gravado, tudo logado); valores altos = dupla checagem; limite diário de recarga por tenant.

**Passo 6 — Planos SaaS seguem cobrados como hoje** (fatura BRL fora da carteira); opcionalmente já creditar a franquia mensal de Tijolos do plano (`credito_franquia`) — movimento simples, dá uso imediato ao extrato.

**Fica FORA da fase 1:** gateway/webhook (fase 1b — o desenho de estados+idempotência já é compatível, só troca quem confirma), boleto (exige emissor/convênio + custo fixo; entra com o gateway), bônus por volume, débito de assinatura na carteira, comissão em Tijolos, valor livre de recarga, NF automática, `IA_HARD_CAP=on` (critério de virada: 30 dias de extrato limpo na conciliação + régua de aviso 7/3/1 funcionando).

Resultado: o dono vê dinheiro entrar por PIX, virar Tijolos no extrato imutável, e a IA consumir — o parâmetro completo da carteira funcionando com risco mínimo e sem nenhuma integração externa.

---

## ⚖️ Conflitos resolvidos pela síntese
**C1 — Tijolo é a mesma moeda do escrow (R$)?** Ledger e Risco foram firmes: NÃO. Tijolo = crédito pré-pago de serviço da plataforma (não-sacável, não-transferível); escrow = dinheiro real de terceiros em custódia (E6, trilho próprio). Reconciliação: moedas SEPARADAS com ponte única de referência cruzada (evento do escrow pode gerar movimento na carteira, nunca transferência de valor). Misturar arrastaria a carteira pro regime regulatório do escrow. Nenhuma lente discordou de verdade — adotado como recomendação firme.

**C2 — Fase 1: PIX manual × gateway com webhook.** Monetização, Ledger e UX propuseram PIX estático + baixa manual do Hub (zero integração); Risco&Pagamentos desenhou gateway+webhook já na fase 1. Reconciliação: fase 1 = MANUAL (menos-arrisco, custo zero, o dono pediu simples), MAS adotando integralmente o desenho da lente de Risco (máquina de estados, idempotency_key, RPC FOR UPDATE, estado divergente, fila humana) — assim o gateway na fase 1b só troca QUEM confirma, sem mudar o modelo. O custo honesto do manual: SLA de crédito vira promessa de UX (mitigado com estado pendente visível + prazo escrito antes do pagamento + limite diário).

**C3 — Boleto na fase 1?** O dono citou boleto E PIX; Risco recomendou só PIX (boleto exige emissor registrado, tem custo fixo e gera divergências: valor diferente/pago vencido/pago 2x). Reconciliação: PIX primeiro; boleto entra junto com o gateway (fase 1b), com o tipo `topup_boleto` já reservado no CHECK. Marcado como decisão #2 do dono, pois contraria parcialmente o pedido literal dele.

**C4 — Comissão transacional em Tijolos?** Ledger desenhou `origem='comissao'` convertendo a fatia da plataforma pela paridade do dia; Monetização e Risco alertaram: comissão passando pela carteira cria barreira de caixa pro parceiro E (pior) Tijolo pagando comissão SACÁVEL muda o regime regulatório (e-money/BACEN). Reconciliação: comissão do Hub fica em BRL no split/escrow; a origem `comissao` fica RESERVADA no CHECK apenas para incentivos não-sacáveis (bônus ao indicador, cashback). Comissão sacável em Tijolos = TRAVA: só com mesa jurídica antes.

**C5 — Assinatura debita da carteira?** Monetização quis convergir na fase 2/3; Ledger e UX recomendaram BRL por fora indefinidamente ou até a régua existir. Reconciliação: fase 1 = fatura BRL + plano CREDITA franquia de Tijolos (todos concordam); débito-da-carteira fica como decisão futura do dono, condicionada à régua de aviso 7/3/1 (risco de churn silencioso). Não há consenso sobre o destino final — marcado como decisão #6.

**C6 — Bônus por volume nos packs.** Monetização propôs 5/10/15%; UX recomendou SEM bônus na fase 1 (anti-jogo, e bônus complica a conciliação manual e o CDC). Reconciliação: fase 1 sem bônus; o tipo `bonus` já fica tipado no ledger pra quando entrar (fase 1b/2), sempre em movimento SEPARADO do comprado.

**C7 — Nome da tabela.** Evoluir `hub_ia_creditos_mov` in-place (compat com código vivo) ganhou de criar tabela nova; a dívida de nomenclatura ('ia' no nome da carteira geral) fica consciente, mitigável com VIEW `hub_carteira_mov`.

## 🧭 DECISÕES DO DONO (pendentes)
1. 1. PARIDADE: confirmar 1 Tijolo = R$ 0,10 → 1 Bloco = R$ 10 (é o que já está no código; âncora de TODA a tabela de preços e da comunicação fixa na UI — não deve mudar toda hora)
2. 2. ESCOPO DO MEIO DE PAGAMENTO fase 1: só PIX manual (recomendação unânime de risco) ou insistir em boleto junto? Boleto exige emissor/convênio + custo fixo R$1-3 + estados divergentes — recomendo PIX agora, boleto entra com o gateway na fase 1b
3. 3. PACKS e LIMITES: denominações (proposta 5/10/25/50 Blocos), valor mínimo/máximo de recarga e limite diário por tenant (a baixa manual aguenta pouco volume; teto protege de erro operacional e de PIX MED)
4. 4. PREÇOS DOS PLANOS: validar 99/249/499 (Fundação/Estrutura/Acabamento) e as franquias de Tijolos (300/1.000/2.500) — o dono conhece o bolso do arquiteto/fornecedor melhor que benchmark
5. 5. COMISSÃO TRANSACIONAL: confirmar a recomendação firme da mesa — comissão do Hub retida em BRL no split/escrow, NUNCA em Tijolos sacáveis (trava regulatória BACEN/e-money); em Tijolos só incentivos não-sacáveis. E definir os % por tipo de negócio (linha de negócio pura, não proposto pela mesa)
6. 6. ASSINATURA: confirmar fase 1 = fatura BRL fora da carteira + franquia creditada; decidir SE um dia migra pra débito-da-carteira (só depois da régua de aviso, pelo risco de churn silencioso)
7. 7. EXPIRAÇÃO: Tijolos COMPRADOS nunca expiram (risco CDC — consenso); franquia/bônus expiram (sugestão 90 dias) ou acumulam?
8. 8. ALÇADAS: quem no Hub pode confirmar topup manualmente (papel restrito + logado) e quem vê/compra na carteira do tenant (manter minRole gestor ou restringir compra a owner?)
9. 9. MARKUP IA: manter 10x do código (colchão de risco inicial) ou baixar pra 3-5x pra incentivar uso pesado? Já é parametrizável por tenant — dá pra decidir com os dados do modo sombra
10. 10. FASE 1b (não urgente): qual gateway (Asaas/Mercado Pago/Efí — abrir conta, taxas, credenciais = mão do dono), em que CNPJ/conta o dinheiro entra, e quando emitir NF da recarga (decisão com o contador — trilha em docs/JANELA-STORAGE-LOGS-NF.md)
11. 11. VIRADA DO IA_HARD_CAP=on: aprovar o critério proposto (carteira + top-up + régua de aviso no ar + 30 dias de extrato limpo) e a política de transição (aviso prévio + possível saldo-cortesia pra quem hoje tem débito de sombra acumulado)

## ⚠️ Top riscos
1. tenant_id NULLABLE em hub_ia_creditos_mov/hub_ia_consumo (padrão tenant-null-leak já auditado 05/jul): carteira sem dono; backfill + SET NOT NULL é PRÉ-REQUISITO da fase 1 e é migração em prod = janela do dono
2. Duplo-crédito/duplo-gasto: saldoCreditos() soma em JS (O(n), não-atômico) e registrarConsumoIA faz 2 inserts sem transação (SEC-8 anotado no código); tolerável em modo sombra, mas idempotency_key + RPCs atômicas são obrigatórias ANTES de qualquer dinheiro real entrar e antes do hard cap
3. Regulatório: se Tijolo virar sacável ou transferível entre tenants, deixa de ser crédito de serviço e vira e-money (BACEN) — o desenho inteiro depende de manter não-sacável/não-transferível; comissão sacável em Tijolos = trava jurídica explícita
4. CDC/jurídico: crédito COMPRADO que expira é terreno perigoso no Brasil — por isso comprado nunca expira e franquia/bônus vivem em tipos de movimento separados no ledger
5. Baixa manual de PIX na fase 1 = risco humano (confirmar errado/2x, comprovante falso) e SLA de crédito vira promessa de UX — mitigado por identificador único por pedido, idempotência, confirmado_por gravado, limite diário, dupla checagem em valores altos e estado pendente visível; não eliminado até o webhook (fase 1b)
6. PIX MED: devolução por fraude em até ~80 dias com Tijolos já gastos — dano limitado por packs pequenos + limite diário + Tijolo não-sacável (prejuízo máximo = custo de IA com markup 10x)
7. Ligar IA_HARD_CAP=on fora de ordem (sem carteira+top-up+régua) bloqueia copiloto/WhatsApp no meio do atendimento — pior UX possível; e a virada pode acordar tenants com saldo negativo de sombra acumulado (precisa aviso prévio + possível saldo-cortesia)
8. Churn silencioso se a assinatura for debitada da carteira sem régua de aviso: tenant 'morre' sem cancelar e sem saber — não ligar débito de assinatura antes das notificações 7/3/1
9. Fiscal/contábil: venda de crédito = receita antecipada; NF e reconhecimento (na recarga ou no consumo) precisam do contador antes de escalar volume — não bloqueia fase 1 com valores pequenos
10. Confusão de dupla unidade (Tijolo×Bloco) e tom de 'jogo': mitigado pela regra rígida 'compra em Blocos, gasta em Tijolos' + R$ sempre ao lado + vocabulário bancário; se em teste com o dono ainda confundir, o fallback é rebaixar Bloco a mero 'pacote de 100' sem retrabalho de arquitetura

---
_CEO: aprovo o modelo. Refinamento: **PIX-first** (boleto entra na fase 1b com o gateway) — alinha com o "menos-arriscado" do dono. A Fase 1 desta carteira TAMBÉM fecha o SEC-8 (insert de custo não-transacional) via as RPCs atômicas. Escrow ≠ Tijolos é trava regulatória — manter firme._