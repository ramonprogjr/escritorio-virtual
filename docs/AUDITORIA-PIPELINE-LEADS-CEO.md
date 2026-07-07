# Auditoria da tela de Leads (Pipeline) — CEO pergunta, Fable responde

> Queixa do dono: *"os leads para ver é muito difícil, aparecem embaixo, com uma barra de
> rolagem, espremidos"*. 4 lentes ProMax (busca/filtros · modos Caixa/Kanban/Lista · mobile/card ·
> hierarquia/1ª dobra) + leitura de código. Data: 07/jul/2026. `app/crm/leads/page.tsx`.

## Veredito: **os leads são a VÍTIMA, não a culpada** — a Caixa está certa, o chrome acima a soterra

As 4 lentes convergiram **sem exceção** numa causa-raiz **estrutural** (de código, não de gosto):

### 🎯 Causa-raiz (o "espremido com barra de rolagem")
O container-mãe é `overflow-hidden` (`page.tsx:653`) e o MAIN é `flex-1 overflow-hidden`
(`page.tsx:705`). Tudo que vem **antes** dos leads fica **pinado** no topo e come altura de tela;
os leads recebem só a **sobra** e rolam **dentro de uma caixinha** (`page.tsx:709`). É literalmente
por isso que o dono vê os leads embaixo, espremidos, com scroll próprio. **Sem consertar isto, mexer
no resto não resolve.**

### As 4 faixas de "chrome" que empurram o lead para fora da 1ª dobra
| # | Faixa | Onde | Peso |
|---|-------|------|------|
| 1 | Banner "Encaminhamentos pendentes (IA)" — card cheio | `page.tsx:672` / `EncaminhamentosPendentesPanel.tsx:108` | ~110–160px |
| 2 | Abas de mercado (`PipelineTabsBar`) — banda + scroll horizontal | `page.tsx:676` | ~45px |
| 3 | Grade de 5 KPIs — `flex-shrink-0`, nunca colapsa | `page.tsx:689-702` | ~60–130px |
| 4 | Toolbar do header — 2 buscas + estágio + toggle + Novo + Pipeline | `page.tsx:529-586` | 1–2 linhas |

**Desktop:** ~340–380px de chrome antes do 1º card. **Mobile (375×667):** ~450–550px — o primeiro
lead nasce **na ou abaixo** da dobra. Queixa confirmada no código.

## O que FICA (as lentes elogiaram)
- **A Caixa é o herói certo** e o **modo padrão está correto** (`page.tsx:186`, forçado no mobile `:321`).
  As lanes **Agora / Hoje / Aguardando** por urgência (`:479-497`) são exatamente o Click-and-Go que o dono quer.
- **O card do lead é ótimo** — borda-esquerda por urgência, nome, badges, "X parado", valor, responsável
  IA/humano, e as 3 ações **Responder (WhatsApp) / Negócio / Ficha** (`:803-829`). Ver = 0 clique, agir = 1.

## Os buracos (confirmados no código)
1. **`overflow-hidden` prende os leads** (`:653` + `:705`) — a caixinha recebe só a sobra da viewport. **Buraco #1.**
2. **Busca DUPLICADA**: a global do CrmShell (com sino) + a "Buscar lead…" da página (`:558-563` e `:616-621`, mesmo estado) — dois campos competindo, digitar num não reflete no outro.
3. **Banner IA é card sempre-aberto** (`Panel.tsx:108`) — incha justo quando o dono TEM trabalho.
4. **Abas de mercado quase decorativas**: no pipeline global `isPipelineGlobal` já devolve todos os leads (`:158-165`, `:458-462`) — banda inteira + scroll horizontal para um filtro que raramente muda o resultado.
5. **5 KPIs = placar morto** fixo no topo; só "Sem Resposta" e "Em Risco" movem ação.
6. **🐛 Toque < 44px** (2 lentes): os 3 botões de ação do card (`:805` Responder, `:814` Negócio, `:822` Ficha) usam `py-1.5 text-xs` **sem `min-h`** → ~28–30px. É a ação PRINCIPAL da tela padrão, abaixo do alvo tátil (o header já usa `min-h-11`).
7. **Mobile**: `headerControls` empilhado em `flex-col` (`:684`) = ~220px de controles + banner + abas + KPIs 2-col antes de qualquer card.
8. **Dado de TESTE** (TESTE AUDITORIA/ARIANE) nos cards — higiene de seed (vem de `vw_hub_leads_crm_enriquecido`, não é bug de UI).

## Plano priorizado

### FIX Nº1 (keystone) — desprender o scroll
Tirar o `overflow-hidden` que aprisiona os leads (`:653` e `:705`): a página rola como **um documento
único**, chrome fino no topo, leads dominando a dobra. **É o fix que destrava tudo.**

### P0 — toolbar única + colapsos (o grosso da queixa)
- **1 toolbar sticky (~52px)**: `[🔍 Buscar lead] · [Mercado ▾] · [Estágio ▾] · [Caixa|Kanban|Lista] · [+ Novo] · [IA·N ▾]`.
- **Unificar as 2 buscas** → só a da página (já filtra nome+telefone+código, `:464-476`); a global recua em `/crm/leads`.
- **Banner IA → chip dourado "IA · N ▾"** que abre drawer com a lista Recusar/Aprovar que já existe (`Panel.tsx:114-148`).
- **Abas de mercado → dropdown "Mercado ▾"** (mata a banda + o scroll horizontal, resolve o mobile).
- **KPIs → tira fina rolável**; "Sem Resposta" e "Em Risco" viram **chips-filtro** clicáveis (`:506-508`).
- **Caixa segue padrão**; colapsar a lane **"Aguardando"** fechada para "Agora"+"Hoje" ocuparem a dobra.

### P0 rápido (seguro, independente) — **JÁ FEITO**
- **Toque 44px**: `min-h-11` nos 3 botões de ação do card (`:805/:814/:822`).

### Higiene
- Limpar/filtrar o seed de TESTE dos cards (path da lista é a view enriquecida — filtro separado do da home).

## Regra de layout (a lei da nova tela de leads)
> O **lead é o herói**. Tudo que não é lead vira **1 linha de toolbar** ou **colapsa**. O primeiro card
> aparece nos primeiros ~120px do topo — em desktop e mobile.
