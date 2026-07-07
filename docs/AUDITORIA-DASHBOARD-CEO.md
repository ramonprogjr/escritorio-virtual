# Auditoria da Dashboard — CEO pergunta, Fable responde

> Método pedido pelo dono: o CEO formula as perguntas, o Fable + personas respondem, com E2E ao
> vivo + código. 5 personas (dono · gestor do Hub-negócio · operador · UX ProMax · analista de dados)
> + síntese. Data: 07/jul/2026. Detalhe completo: scratchpad `dashboard-veredito.md`.

## Veredito: **REFAZER**

Precisa existir (é a home nobre que abre todo dia), mas hoje faz o trabalho da tela ERRADA: é um
painel de funil de UMA agência, não a home do dono do Hub. Só o topo ("O que precisa de você")
merece sobreviver; o resto refaz.

**O UM trabalho da tela:** em ≤30s de manhã, responder **"quanto o Hub ganhou / tem a receber"** e
**"o que eu destravo AGORA"** (fila priorizada por R$ em risco), cada resposta com um botão do lado.
Todo card que não vira R$ nem vira ação **sai da home**.

## Respostas às 6 perguntas do CEO

| # | Pergunta | Resposta |
|---|----------|----------|
| Q1 | Precisa existir? Qual o trabalho? | Sim, REFEITA. Hoje ~80% vitrine. O trabalho: dinheiro + a fila do dia com botão. |
| Q2 | Voltaria toda manhã? | Hoje **não** — repete números que ele já sabe. Voltaria se mostrasse **dinheiro dele** (MRR + comissão da rede) + a fila **já priorizada por valor**. |
| Q3 | O que precisa ter? | 3 camadas: **HUB-NEGÓCIO** (MRR, comissão da rede realizada, a-receber/a-pagar — hoje ZERO), **OPERAÇÃO por exceção** (só o gargalo com R$ preso), **USUÁRIO** (a fila de decisões, que já existe). |
| Q4 | Bonita/IA-first? | Bonita **sim**. IA-first é **mentira** — o código diz "sem IA/Mistral"; "Equipe IA" só lista. |
| Q5 | Analytics é útil? | **Funde** na dashboard — ~80% redundante, não cobre o negócio do Hub. Só série temporal + marketing viram aba "Tendências". Relatórios vira botão "Exportar" nas listas. |
| Q6 | Melhor organização? | Inverter "mural de números" → **andares de decisão**: Faixa IA → O que precisa de você → Dinheiro do Hub → Operação por exceção → Funil (1×) → Tendências (drill-in). |

## Os buracos (confirmados no código)
1. **Hub como negócio = ZERO na tela.** `dashboard-aggregate.ts` (CrmMetricas) não tem MRR, comissão, a-receber/a-pagar. O motor existe (`hub_comissao_eventos`/`hub_comissao_rateio`, `hub_tenant_assinatura`) mas **nenhuma tela lê**. Buraco #1.
2. **"IA-first" é falso.** `CrmOQuePrecisaDeVoce.tsx:22` diz "Agregação 100% por REGRA, sem IA/Mistral".
3. **Pipeline R$250k duplicado** (`CrmPipelineResumo` + `CrmComercialDashboard.tsx:71-82` "Receita potencial") — fontes que podem divergir; e "Receita potencial" está vestida de receita quando é só pipeline.
4. **Parede de vaidade**: 6 cards "Visão comercial" (`CrmComercialDashboard.tsx:75-118`), "0%"/"200%" cru, "Encaminhamentos hoje 0", "Agentes cadastrados 3" (nem ligado).
5. **Dado de TESTE** (TESTE ARIANE/AUDITORIA) na tela mais nobre de produção.
6. **Operação = contador morto** (14 negócios/1 obra), não mostra o que travou.

## O que FICA (herói): "O que precisa de você" (fila acionável), funil clicável→kanban, realtime, dark verde+dourado.

## Plano priorizado

### P0 seguro — executo já (feio/vaidade/redundância/teste)
- **Matar o Pipeline duplicado** + renomear "Receita potencial" → "Pipeline (estimado)"; fonte única.
- **Filtrar dado de TESTE** da home (leadsRecentes + Equipe IA — nome com "TESTE").
- **Corrigir conversão**: nunca >100%; 0% em cinza-mudo (não vermelho de alarme).
- **Remover a grade "Visão comercial" de 6 cards de vaidade** (o útil vira faixa com verbo).

### P0/P1 — precisa da sua janela / decisão
- **Bloco DINHEIRO DO HUB** (MRR + comissão da rede realizada + a-receber/a-pagar): exige **ler acima de um tenant** (a rede toda) → gate por papel dono-plataforma + **RLS Faixa B na janela**. Novo `/api/crm/hub-financeiro`.
- **Amarrar R$ em risco** a cada item da fila (contexto: valor, dias parado) + reordenar por valor.
- **Operação por exceção** (só o gargalo com R$ preso, clicável).
- **Fundir Analytics** na home como drill-in; Relatórios vira "Exportar" nas listas.

### P2 — depende da chave Mistral
- **Faixa IA no topo**: briefing do dia em 1 frase + "me diga o que fazer agora" (próxima melhor ação por valor) + caixa "pergunte em linguagem natural". Substitui o copiloto flutuante que cobre conteúdo.
- **Cockpit do dono-da-plataforma** (saúde da rede, separado do cockpit do gerente do fornecedor).

## Regra de layout (a lei da nova home)
> Todo bloco ou é **AÇÃO** (verbo + destino) ou é **TENDÊNCIA** (drill-in). Número puro parado é **banido** da home.
