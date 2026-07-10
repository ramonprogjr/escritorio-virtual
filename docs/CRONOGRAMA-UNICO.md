# CRONOGRAMA ÚNICO — Obra10 Hub
**Versão 1 · ancorado no ESTADO REAL verificado de 09/jul · revisado toda semana (rito abaixo)**

> **Este é o ÚNICO documento com semanas.** Qualquer outro doc que fale de prazo aponta para cá. Se aparecer "semana" em outro doc, está errado por definição.
> **Contador novo:** Semana 1 = a próxima semana de trabalho após 09/jul. Os "Sem N" antigos do MASTERPLAN morrem. Datas SEMPRE em semanas (Sprint), nunca calendário.

---

## DECISÃO-35 — RESOLVIDA (esquema único de fases)
Fica valendo **um só esquema: Fases 0-8** (o do 04-ROADMAP, que o MASTERPLAN também usava):
- **MVP = Fases 0-3** (single-tenant, "operar sem planilha")
- **V1 = Fases 4-8** (medir/cobrar, rede multi-tenant, portal, lojas)

Todos os outros esquemas **morrem**: S1-S9 do ROADMAP-EXECUCAO, B0-B8 dos Blocos, MVP/V1/V2/V3 do CRONOGRAMA-PROJETO, semanas 1-4/5-9 do 90-180-365, FASE 0-3 própria da VISAO-MODULOS e o contador Sem 1-37 do MASTERPLAN. Fase agora é só ETIQUETA de item; semana só existe aqui. O 00-PAINEL vira "estado + gates" e aponta pra cá; o 04-ROADMAP vira "backlog de itens por fase" e aponta pra cá.

## As travas (não mudam)
Aditivo/reversível · migração SÓ em janela do dono · NADA SE PERDE · cirúrgico (um código não trava o outro) · backup nos 2 GitHubs · honesto (âmbar não vira verde) · **proxy.ts é o middleware VIVO — não apagar**.

## O QUE JÁ ESTÁ NO AR (não é pendência — ninguém re-planeja isso)
Núcleo single-tenant (CRM, motor de leads, negócios/obras, motor de comissões TESTADO + telas do dinheiro) · IA VIVA (copiloto de voz que navega/abre ficha/AGE; Mari WhatsApp com pausa/handoff blindada) · criar/editar TODOS os agentes F1-F6, incl. "criar agente com IA" · DEPLOY #25 registros×logs×permissões · DEPLOY #26 custo de IA fora da tela · trilho E5 compras→estoque APLICADO (sem carga ainda) · fix da entrega de SC (migração 20260711120000) · Fase 0 de código (MET-01/IA-02/FIN-03/EST-03) · janela de segurança 06/jul (24 portas→0, Faixas A+B) · FIN-02 corrigido + demo R$15k desfeita · mobile-create-path, R7 fail-closed e código morto removido (órfãs desmentidas pelo código).

**Fatos do banco que o plano respeita:** 1 tenant · 16 negócios com linhagem DORMENTE (nenhum código escreve `negocio_pai_id`) · E5 com 1 SC/0 itens · `hub_negocios` sem obra_id/projeto_id · `hub_alertas` sem tenant_id · `hub_produtos` NÃO existe · 2 altitudes do Hub só desenhadas.

## O MVP e seu critério-mãe
**MVP = Fases 0-3, selado na Semana 12.** Critério-mãe: **um cliente real atendido do início ao fim SEM planilha** — captação→IA→CRM→negócio→obra→**COMPRAS**→estoque→medição→financeiro→comissão. Compras entrou no critério-mãe porque é o coração (decisão ratificada 09/jul: negócio=contrato/nó; compra/SC=documento filho; ~1.200 compras/semana; fluxo técnico→engenharia→compras→diretor→financeiro; motor **IA-FIRST, "menos tela, mais IA"**).

---

# AS 12 SEMANAS

## TRACK PRINCIPAL: COMPRAS (Semanas 1-7 — 3 blocos: motor → telas → balcão + prova de carga)
*Estimativa honesta era 5-7 semanas; o plano reserva 7 (contando fundação e prova de carga). Fechar em 5-6 = tudo puxa pra esquerda na revisão semanal.*

### SEMANA 1 — Gates imediatos + FUNDAÇÃO de Compras (Bloco 1 abre)
- **Objetivo:** destravar tudo que depende de minutos do dono e cravar a fundação do motor de compras no banco.
- **Ships:**
  - Deploy da rota de idempotência da entrega (já pronta no dev).
  - Migração aditiva da FUNDAÇÃO DE COMPRAS (~1h de janela, ensaiada em branch antes): `hub_produtos` (catálogo), item de compra 100% customizável (insumo/serviço/equipamento/ferramenta/freelance/diária), dados bancários + condição de pagamento, `hub_negocios.obra_id/projeto_id`, `hub_alertas.tenant_id`, índices de escala.
  - **Linhagem ACORDA:** o app passa a ESCREVER `negocio_pai_id` nos pontos de derivação (RAS-01 de verdade — o modelo negócio=contrato/SC=filho depende disso).
- **Gate do dono:** ① Render: `IA_HARD_CAP=on` + confirmar `MISTRAL_API_KEY`/`COPILOTO_HMAC_SECRET` + `/api/health` verde (10 min) · ② OK do deploy da idempotência (2 min) · ③ ratificar a DELEGAÇÃO de compras — alçada por faixa de valor (15 min de conversa) · ④ JANELA ~1h da migração (vagão: HaveIBeenPwned + CRON_SECRET + UAZAPI/Deploy Hook se der) · ⑤ ligar webhook da Mari + smoke ao vivo (10 min — fecha IA-01/Fase 1).
- **Critério binário:** colunas/tabelas novas verificadas em prod via SELECT **E** 1 negócio derivado de teste com `negocio_pai_id` preenchido pelo app **E** `/api/health` verde com hard-cap ON **E** Mari respondeu 1 conversa real de ponta a ponta.

### SEMANA 2 — Motor de Compras I: a máquina de estados
- **Objetivo:** a SC nasce e percorre técnico→engenharia→compras→diretor→financeiro com alçadas, tudo com trilha imutável.
- **Ships:** state machine da SC (RPCs atômicas aprovar/reprovar/devolver), alçadas conforme a delegação ratificada, trilha de auditoria imutável (reaproveita o padrão do DEPLOY #25), rate-limit em tudo que toca IA, e o primeiro fio IA-first: **criar SC por conversa** com o copiloto. Secundários: blindar o "1 toque" no engine genérico (resto de IA-01) + verificar no código se `hub_acoes_ia` (SEC-7) tem gap residual — se tiver, vira item na revisão semanal.
- **Gate do dono:** nenhum (só a revisão semanal).
- **Critério binário:** 1 SC sintética percorre TODAS as etapas até "aprovada para pagamento" via API com trilha completa gravada **E** usuário sem alçada é NEGADO no teste.

### SEMANA 3 — Motor de Compras II: entrega, estoque (E5 acorda) e IA operando
- **Objetivo:** fechar o motor — entrega vira movimento de estoque e a IA consulta/aprova por conversa.
- **Ships:** entrega de SC → estoque (trilho E5 carrega carga REAL pela 1ª vez), reenvio idempotente provado em cima da migração 20260711120000, duplicidade bloqueada, IA responde/age: "aprova a SC 123", "o que está parado em engenharia?" com número EXATO. Em paralelo: FND-01 ENSAIO em branch (baseline migration reconstrói o schema do zero; resolve de vez a colisão de timestamp 20260711120000 apontada no caderno).
- **Gate do dono:** nenhum.
- **Critério binário:** compra→entrega→estoque movimenta saldo certo **E** reenviar a entrega NÃO duplica estoque **E** a branch com baseline sobe o schema do zero com testes verdes.

### SEMANA 4 — Telas de Compras (Bloco 2) — poucas, com IA do lado + JANELA FND-01
- **Objetivo:** as únicas telas que precisam existir ("menos tela, mais IA"): fila de aprovação por papel, detalhe da SC, criação assistida.
- **Ships:** fila de aprovações (1 tela, lente por papel do fluxo), detalhe da SC com trilha completa, criação assistida por IA (foto/voz/texto → rascunho de SC preenchido).
- **Gate do dono:** JANELA — aplicar FND-01 (baseline) + vagão de higiene **re-triado item a item ANTES no banco** (regra eterna: conferir antes): delete=arquiva nos 5 endpoints restantes, `hub_obras.projeto_id`+UNIQUE, JANELA-03 (`engenheiro_responsavel_id`), pg_net/vector fora do public, buckets restritos.
- **Critério binário:** o dono cria 1 SC REAL pelo celular (foto ou voz) e ela cai na fila certa do papel certo **E** baseline aplicada com CI reconstruindo o schema do zero.

### SEMANA 5 — Balcão do Comprador I (Bloco 3)
- **Objetivo:** o dia inteiro do comprador em um lugar só: agrupar SCs, cotar, pedir.
- **Ships:** balcão v1 (SCs aprovadas → cotação → pedido ao fornecedor), fornecedor+preço+condição de pagamento no pedido, dados bancários prontos para o financeiro. IA sugere agrupamento ("estes 8 itens são do mesmo fornecedor — cotar junto?").
- **Gate do dono:** nenhum (revisão semanal).
- **Critério binário:** 1 ciclo completo SC aprovada→cotada→pedido emitido→entrega→estoque, com o pedido carregando a condição de pagamento correta.

### SEMANA 6 — Balcão II + o dinheiro de compras no financeiro
- **Objetivo:** fechar o círculo do dinheiro: pedido→entrega→contas a pagar; a obra enxerga o custo.
- **Ships:** título a pagar nasce da compra (condição/parcelas), custo aparece na obra (obra_id/projeto_id agora úteis de verdade), visão do diretor via IA ("quanto comprei essa semana? o que vence?") com número exato batendo com o banco.
- **Gate do dono:** nenhum.
- **Critério binário:** uma compra flui até "pago" com trilha completa **E** a resposta do copiloto bate com o SELECT no banco (mesmo número).

### SEMANA 7 — PROVA DE CARGA + roleplay = COMPRAS VERDE
- **Objetivo:** provar a escala de 1.200/semana ANTES de pendurar empresa real.
- **Ships:** gerador de 5.000 SCs sintéticas, medição de gargalo (índices, N+1, p95), fixes do que aparecer, E2E dedicado do fluxo inteiro, runbook de operação.
- **Gate do dono:** roleplay comprador/diretor ao vivo (~30 min) — o dono assina COMPRAS.
- **Critério binário:** 5.000 SCs processadas sem erro e sem duplicação (estoque/títulos) **E** ações-chave dentro do limiar combinado na revisão **E** dono aprovou o roleplay. **Se falhar, a Semana 8 vira fix e o resto desliza — sem "quase".**

## FECHO DO MVP (Semanas 8-12)

### SEMANA 8 — Funil sem pedras I: vocabulário único + entrega certa por mercado
- **Objetivo:** tirar o risco de loop (P0) e o "tudo vira obra".
- **Ships:** LEAD-02 (vocabulário único de estágio, `legacyToFunil` único), EST-02 (ganhar IMB/FOR/PRO entrega o certo), início de EST-01 (funis por mercado).
- **Gate do dono:** decisão EST-02 (15 min): o que acontece ao ganhar em cada mercado.
- **Critério binário:** teste dos 6 mercados verde no CI com vocabulário único **E** ganhar negócio IMB NÃO cria obra.

### SEMANA 9 — Funil sem pedras II: funis próprios + SLA com relógio
- **Objetivo:** cada mercado com seu funil e lead nunca esquecido.
- **Ships:** EST-01 completo (config `hub_pipeline_estagios`, `tipo_fecho` preservado), LEAD-01 (`ts_oferta`/`ts_resposta` + cron */5 de redistribuição + penalidade de mérito), RAS-03 (app popula `ator_id`) e RAS-04 (resolvedor cobre os 14 prefixos).
- **Gate do dono:** nenhum.
- **Critério binário:** lead sem resposta redistribui SOZINHO no prazo **E** funil próprio visível em 2 mercados **E** evento novo carrega `ator_id`.

### SEMANA 10 — Dinheiro do dia-a-dia + últimos restos dos planos cirúrgicos
- **Objetivo:** financeiro operacional sem planilha; fechar os únicos restos vivos de registros e agentes.
- **Ships:** contas a pagar/receber consolidadas (4 fontes) com menu de correção/estorno; lançamento automático por evento (ganho→a receber; compra/medição→a pagar); Registros F6 (atividades principais surfaçadas + higiene de tipos); Agentes F7 (passo-0 humano do wizard, atendimento nasce pausado).
- **Gate do dono:** 1 pagamento REAL pela dupla-chave (5 min — prova FIN-01/FIN-02 vivos em produção) · opcional: seed do dinheiro real do Consulado.
- **Critério binário:** ganho→a receber e compra/medição→a pagar aparecem SOZINHOS **E** 1 pagamento real liquidado com 2 chaves.

### SEMANA 11 — Honestidade de telas + observabilidade mínima
- **Objetivo:** nenhum número inventado; erro rastreável.
- **Ships:** matar a barra 42% falsa e o 85% inventado, KPIs do backend sobre TODOS os registros, motivo de perda obrigatório, centavos exatos; Onda D mínima: `hub_error_logs` + trace_id nas rotas quentes (compras + IA).
- **Gate do dono:** limpeza de acessos (remover e2e-arq, rebaixar/promover contas) + encomendar textos jurídicos mínimos (termos/privacidade).
- **Critério binário:** amostragem das 33 telas sem número falso **E** um erro proposital aparece no log central com trace_id.

### SEMANA 12 — E2E-MÃE: cliente real SEM planilha = MVP SELADO
- **Objetivo:** o teste-mãe do MVP inteiro, com compras dentro.
- **Ships:** fixes do ensaio, roteiro gravado, re-baseline do 00-PAINEL/04-ROADMAP para o bloco V1.
- **Gate do dono:** roleplay de ~1h em produção, tenant-zero: captação→IA→CRM→negócio→obra→compras→estoque→medição→financeiro→comissão.
- **Critério binário:** o ciclo completo roda em produção sem abrir planilha **E** o dono assina "MVP fechado".

---

## DEPOIS DO MVP — V1 (Fases 4-8; SEM semana comprometida — re-baseline na revisão da Semana 12)
- **F4 medir/cobrar:** MET-02 (consumo atômico), MET-03 (carteira+top-up), MET-04 (régua 7/3/1 — o hard-cap já estará ON desde a Semana 1), MET-05 (billing). **GATED pela decisão de preços — adiada de propósito, ZERO build até lá.** Tijolo segue só medida de consumo; Hub paga em dinheiro.
- **F5 endurecer para a rede (gate ABSOLUTO do 2º tenant):** TEN-01/02/04, RBAC-01..05 (+ RBAC ponto único do destravamento), LGPD-01, IA-sec (prompt-injection/RAG/memory), CI bloqueante, **rotação de chaves/segredos (ADIADA pelo dono em 09/jul — volta AQUI, obrigatória antes de qualquer 2º tenant)**.
- **F6:** LEAD-03 (paginação do motor >100), IA-03 (provider Anthropic trocável).
- **F7:** POR-01 Portal do Cliente (os 5 medos), altitude 1 do Hub (ler a rede + dinheiro do Hub), clawback ativo (hold 7 dias, decidido).
- **F8:** lojas/mobile (PWA→TWA→iOS), marketplace, 2ª altitude (entrar no CRM do tenant).
- **Agentes F8-F10** (ajustar por conversa, rascunho→publicar — janela `playbook_draft_*` fica AGENDADA para carona na primeira janela pós-MVP —, mídia no fluxo): **primeiros da fila de folga** — entram antes se COMPRAS fechar em 5-6 semanas.

## ESTACIONAMENTO (nada se perde; só entra na semana por troca 1-por-1)
Agentes F8-F10 · restos do destravamento (smoke E2E logado 1.2, 2.1b 16 clients fail-closed, extrair layout CRM, Fase 3 ESLint/god-files) · SmartField/voz nos forms · pipelines por tenant (B3) · ponte Membros (B7) · Onda UX-R (Ficha 360 / Caixa de Oportunidades) · portal do fornecedor real · notificações in-app/push · design overhaul (~97 azuis→verde+dourado) · Gestor de Tarefas universal + tela "Hoje" · Central de Aprovações unificada (a fila de compras da Semana 4 é a semente concreta) · injeção de IA nas demais telas-âncora · FND-02 crmDb (contínuo, oportunista) · recuperar docs de obras do Asana · **FIM (pedido do dono): repo-backup 12h no GitHub wendel-dev + rotação do token UAZAPI**.

## DOCS — quem manda e quem virou história
**Vivos (4 + 2 de apoio):** este CRONOGRAMA-UNICO (semanas) · `00-PAINEL-DE-CONTROLE.md` (estado+gates, aponta pra cá) · `04-ROADMAP-E-PLANO.md` (backlog de itens por fase, herda as fichas WI do caderno) · `PENDENCIAS-JANELA-DONO.md` (gates do dono, com refresh: riscar as 3 decisões já ratificadas e adicionar os gates novos) · `PLANO-AGENTES-CRIAR-EDITAR.md` (só F7-F10; linha de estado corrigida — F1-F6 shipados) · `ROADMAP-VISAO-DEFINITIVA-MODULOS.md` (só como VISÃO de F2/F3 + refinamento do dono; F0/F1 marcadas superadas).
**Histórico (banner no topo apontando pra cá):** MASTERPLAN-CRONOGRAMA · CADERNO-ENGENHARIA-AUDITORIA · CRONOGRAMA-PROJETO · ROADMAP-EXECUCAO · PLANO-90-180-365-DIAS · PLANO-MACRO-CONCLUSAO · PLANO-EXECUTIVO-BLOCOS · BACKLOG-CONSOLIDADO · PENDENCIAS-VARREDURA-07JUL · MAPA-MESTRE-PENDENCIAS · PLANO-DESTRAVAMENTO-05JUL · PLANO-REGISTROS-LOGS-PERMISSOES.

## O RITO SEMANAL (30 min, sagrado — é ele que mantém o trilho)
1. **Conferir o CÓDIGO/BANCO, não o doc** (regra eterna) e riscar o feito.
2. **Critério binário da semana: passou?** Se não, a semana NÃO fechou — desliza a fila inteira, nunca se espreme.
3. **Estacionamento:** o que chegou durante a semana entra SÓ trocando por algo do mesmo tamanho.
4. **Re-publicar este doc** (nº da semana corrente + o que mudou).
**Fura-fila só 3:** produção quebrada · risco de perda de dados · obrigação legal.
