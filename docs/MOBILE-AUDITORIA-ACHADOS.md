# Auditoria Mobile — Achados Consolidados (CRM Obra10+)

> Consolidação de 8 auditorias estáticas de mobile (read-only, viewport-alvo 360px, mobile = `< 768px` via `useNarrowViewport`).
> Diretor de UX, 2026-06-30. Marca: dark verde `#0a140f`/`#0f1d16` + dourado `#c9a24a`.
> **Honestidade:** auditoria estática de código (sem device real, sem browser). Alturas em px são derivadas das classes/min-height; sobreposições derivadas da estrutura de render. Cada item tem `arquivo:linha`.

---

## 1. RESUMO

### Contagem (após dedup)

| Severidade | Bruto (8 relatórios) | Após dedup |
|---|---|---|
| 🔴 BLOQUEADOR (quebra/ilegível no toque) | 31 | **27** |
| 🟢 POLISH | 41 | **36** |

Itens cross-cutting (causa-raiz compartilhada) que se repetem entre unidades foram fundidos: **scrollbar/affordance de scroll** (3 unidades → 1), **piso tipográfico micro `text-[8/9/10/11px]`** (7 unidades → 1 política), **alvos de toque sub-44px** (8 unidades → 1 política), **`CrmMetricCard.sub` sem `min-w-0`** (2 unidades), **`SmartField` chip touch target** (2 unidades), **botões `#238636` fora da marca** (2 unidades).

### Veredito honesto do estado mobile

O CRM **não está quebrado no mobile — está apertado e inconsistente.** A maioria das telas é genuinamente mobile-aware (drawers viram full-width/bottom-sheet, `min-w-0`/`truncate` aplicados, kanbans com snap-x, modais com safe-area). **Não há estouro horizontal catastrófico em lugar nenhum.**

O problema é de **acabamento e de chrome**, concentrado em quatro classes de defeito que se repetem por todo o app:
1. **Chrome mobile redundante** — em qualquer `/crm/*` há **três headers empilhados** roubando ~180px e ~80px de padding-fantasma de uma tab-bar que nem existe. É o pior achado do conjunto.
2. **Tipografia micro de leitura** — `text-[8px]`–`text-[11px]` em valores financeiros, labels de KPI e conteúdo de relatório, espalhado em ~7 áreas.
3. **Alvos de toque sub-44px** — ícone-botões 32–36px, chips 26–40px, abas 28–30px, em controles primários.
4. **Marca vazando** — azul Shadcn/GitHub (`#0d1117`, `#121a26`, `#238636`) em headers, sideovers e botões de salvar, em meia dúzia de pontos.

As telas **mais saudáveis**: `obras/**` e `financeiro/aprovacoes` (acima da média). As **mais problemáticas**: shell/navegação (chrome triplo), `relatorios` (tabela-scroll-X hostil) e os dois funis do dashboard (texto 8px + cards <44px).

**Nenhum problema é estrutural-irreversível.** Tudo é corrigível por lotes, e ~60% do impacto vem de consertar componentes/tokens **compartilhados** (Seção 2).

---

## 2. 🚀 CROSS-CUTTING (alta alavancagem — consertar 1 conserta muitas telas)

> Ordenados por alavancagem. Estes vêm primeiro porque um único fix propaga por N telas.

### CC-1 — Chrome mobile triplo + tab-bar fantasma (MAIOR alavanca isolada)
**Causa-raiz:** três sistemas de header empilham em todo `/crm/*`, e o layout reserva 80px para uma barra de abas que ninguém renderiza.
- `MobileShell` header (~54px) — `components/mobile/MobileShell.tsx:141`
- Header mobile do CRM (`md:hidden`, ~60px) — `app/crm/layout.tsx:632-671`
- `CrmUniversalHeader`/`CrmPageHeader` (~68px, **sem** `md:hidden`) — `app/crm/layout.tsx:682` + `components/crm/CrmPageHeader.tsx:47-48`
- Padding-fantasma `pb-[calc(5rem+...)]` para tab-bar inexistente — `app/crm/layout.tsx:685`
- Código morto: `MOBILE_TABS`/`MOBILE_MORE_ITEMS`/`MobileMoreSheet`/`mobileTabIdFromPath` — `lib/mobile/nav.ts:14,28,73`, `components/mobile/MobileMoreSheet.tsx` (importado por ninguém)

**Fix:** eleger `MobileShell` como **único** dono do chrome mobile. Remover header+drawer mobile de `app/crm/layout.tsx:632-671` e `:692-885`; ocultar `CrmUniversalHeader` no narrow; trocar `pb-[calc(5rem+...)]` por `pb-[env(safe-area-inset-bottom)]`; apagar o código morto de tab-bar. Conserta itens **S-1, S-2, S-4, S-9, S-10** de uma vez e libera ~120px+80px de viewport em TODA tela `/crm`.

### CC-2 — Piso tipográfico: `text-[8px]`–`text-[11px]` em conteúdo de leitura
**Causa-raiz:** sem regra de tipografia mínima; micro-fonte copiada em funis, KPIs, relatórios, gráficos e gates.
Ocorrências (deduplicadas) em: `CrmPipelineResumo.tsx:281-287,387-395` (8px em valor R$), `CrmAnalyticsDashboard.tsx:114,396,522,543,556`, `relatorios/page.tsx:140,155,226`, `CrmLeadsEntradaPeriodo.tsx:62,66,70,94,105` (8–9px), `aprovacoes/page.tsx:401,424,433,449` (9px no gate de dinheiro), `configuracoes/page.tsx:203,214,225,259`, `atendimento/page.tsx:1130,1155,1174,1196`, `CrmFinanceDashboard` sub-line, `FunilOperacionalChart.tsx:32,48`.

**Fix:** política única — **mínimo 12px (`text-xs`) para qualquer texto que se lê; 11px só para badge/eyebrow uppercase decorativo; proibido ≤10px.** Aplicar varredura. Conserta **D-1, AT-2, F-4, A-3, A-7, A-8, A-9** + polidos. (Já houve sweeps G5/G6 levando 10→11; estes ficaram para trás.)

### CC-3 — Alvos de toque < 44px em controles reais
**Causa-raiz:** ausência de utilitário de toque mínimo; padrões `h-9 w-9`, `py-1`, `py-1.5`, `min-h-10`, `min-h-9`, `padding:9px` repetidos.
Ocorrências: ícone-botões `h-9 w-9`/36px (`CrmPipelineResumo.tsx:149`, `MobileShell.tsx:166`), chips `SmartField.tsx:119` (`min-h-10`), `MercadoLeadPicker.tsx:35` (`min-h-9`/36px), chips de filtro `atendimento/page.tsx:590-604,636-644` (~26px), abas `relatorios/page.tsx:170-184` (~30px), `PipelineTabsBar` tabs (~28px), `actionBtn` 32px (`LeadKanbanCard.tsx:395`+`NegocioKanbanCard.tsx:101`), inputs de drawer inline `ObraFinanceiroSecao.tsx:1019`+`ObraComprasEstoqueSecao.tsx:989` (~36px), setas de chip `atendimento` `w-6` (24px), `EapEditorSideover.tsx:188-205` (~14px).

**Fix:** classe utilitária `.tap-target { min-height:44px; min-width:44px }` (ou `min-h-11`) aplicada a todo `<button>`/`<a>`/chip de ação no mobile. Conserta **D-7, D-8, D-9, AT-3, AT-4, CL-4, CL-6, A-5, A-6, A-10, OB-8, F-(touch)** num passe.

### CC-4 — `scrollbar-none` + setas `sm:`-only = scroll horizontal sem affordance
**Causa-raiz:** `app/globals.css:19-25` (`.scrollbar-none` confirmado, sem fallback) usado em kanbans e tab-bars; as setas de scroll são `hidden ... sm:inline-flex` (só desktop).
Ocorrências: kanban negócios `negocios/page.tsx:498`, kanban leads `leads/page.tsx:864`, `PipelineTabsBar.tsx:77,87,97`, quick-actions `leads/page.tsx:1075`, quick-replies `atendimento/page.tsx:1019`.

**Fix:** no mobile, indicador único de rolagem (fade nas bordas OU peek garantido da próxima coluna — reduzir colunas de `72vw`→~80vw com peek). Conserta **CL-4, CL-9, A-6**. (Memória já registra que esconder o scroll confundiu o dono — não repetir.)

### CC-5 — `CrmMetricCard.sub` sem `min-w-0 break-words` (componente de TODOS os KPIs)
**Causa-raiz:** `components/crm/CrmMetricCard.tsx:52` — `{sub && <p className="mt-0.5 text-xs text-[#6e7681]">{sub}</p>}` (confirmado: sem `min-w-0`/`break-words`/`truncate`). É o componente de todos os KPIs financeiros (8 cards) e de outros dashboards.
**Fix:** adicionar `min-w-0 break-words` ao `<p>` do sub. Blinda o card "Vencido" (#F-1) e qualquer sub longo futuro. **Maior alavanca da área financeira.**

### CC-6 — Token de cor da marca não aplicado no chrome/sideovers (azul vaza)
**Causa-raiz:** existe `CRM_CHROME_SOLID = "#0c1712"` (confirmado em `lib/crm-shell-theme.ts:9`), mas hex azul GitHub/Shadcn está hardcoded em vários pontos.
Ocorrências: `MobileShell.tsx:139` (`#0d1117`), `MobileDetector.tsx:13` (`#0d1117`), `app/crm/layout.tsx:635` (`rgba(22,27,34)`), `MobileMoreSheet.tsx:38` (`#161b22`), sideover de atendimento `atendimento/page.tsx:1090-1101` (`#121a26/#101722/#344256/#1d2633/#9eb0c8`), skeleton `CrmMetricCard.tsx:17` (`#121926`).
**Fix:** trocar todos por `#0a140f`/`#0f1d16`/`CRM_CHROME_SOLID`. Conserta **S-6, AT-1, F-8**.

### CC-7 — Botões de ação fora da marca (`#238636`/`#da3633` verde GitHub)
**Causa-raiz:** "Guardar/Salvar/Confirmar exclusão" usam verde GitHub em vez de `#003b26`+`#c9a24a`.
Ocorrências: `CadastroContactoSideover.tsx:380-394,415-430`, `CadastroEmpresaSideover.tsx:310-325,345-359`, `CadastroWizard.tsx:1042`.
**Fix:** `#238636`→`#003b26` texto `#c9a24a`; vermelho de exclusão alinhar a `#f85149`. Conserta **CPE-6**.

### CC-8 — Grids de coluna FIXA inline sem breakpoint (`repeat(4,1fr)` / `repeat(3,1fr)` / `1fr 1fr`)
**Causa-raiz:** CSS-in-JS inline sem `useNarrowViewport`; nunca colapsa para 1 coluna no mobile.
Ocorrências: `NegocioFormDrawer.tsx:677,737,822,930` (4-col), `negocios/[id]/page.tsx:643` (2-col), `ObraFinanceiroSecao.tsx:364,715` (3-col), `ObraItensSecao.tsx:304` (`grid-cols-2` sem `sm:`), `FinanceiroNovoLancamentoModal.tsx:155`, `configuracoes`/`atendimento` info grids.
**Fix:** helper responsivo (`repeat(auto-fit, minmax(96px,1fr))`) ou migrar para Tailwind `grid-cols-1 sm:grid-cols-2/4`. Conserta **CL-1, CL-2, CL-5, OB-1, OB-3**.

### CC-9 — `INPUT.fontSize < 16px` → zoom automático no iOS em todo form
**Causa-raiz:** cada form define sua própria `INPUT` com `fontSize:13/14`; sem override global. Safari iOS dá auto-zoom em `<input>` < 16px.
Ocorrências: `CadastroWizard.tsx:51`, `CadastroComercialSecao.tsx:58`, `PessoaFormModal.tsx:51`, `EmpresaFormDrawer.tsx:26`, `CadastroContactoSideover.tsx:72`, `CadastroEmpresaSideover.tsx:65`, `SmartField.tsx:134` (`text-sm`) — e por herança o resto do CRM.
**Fix (uma regra global):** em `app/globals.css` → `@media (max-width:767px){ input,select,textarea{ font-size:16px } }`. Neutraliza o defeito nº1 de formulário em TODO o app. Conserta **CPE-1**.

### CC-10 — Constante `INPUT`/estilos de drawer duplicados (6+ arquivos)
**Causa-raiz:** `INPUT: React.CSSProperties`, overlay, drawer e botão primário copiados em 6+ cadastros e nos drawers caseiros de Obras. Toda correção precisa ser repetida N×.
**Fix:** extrair token/estilo compartilhado; migrar drawers caseiros de Financeiro/Compras para `CadastroPremiumSideover` (herdam full-width + safe-area). Causa-raiz estrutural por trás de CC-9, CC-7 e dos inputs de 36px (OB C3).

### CC-11 — `mobilePageTitle` incompleto → header mostra "Obra10+" genérico
**Causa-raiz:** `lib/mobile/nav.ts:90-108` é switch manual que não cobre rotas reais do menu (`/crm/cadastro/pessoas`, `/crm/imoveis`, `/crm/obras`, `/crm/pedidos`, `/crm/projetos`, etc.).
**Fix:** derivar título de `CRM_NAV_GROUPS` (mesma fonte do menu) por match de href ativo. Conserta **S-3**.

### CC-12 — Tabela-relatório como tela de trabalho (anti-padrão da diretriz)
**Causa-raiz:** `<table min-w-[640px]>` / `<table w-full text-sm>` força scroll-X+scroll-Y aninhado; `truncate`+`title` (tooltip não existe no toque → dado inacessível).
Ocorrências: `relatorios/page.tsx:212,226`, `CrmAnalyticsDashboard.tsx:554`.
**Fix:** componente `RelatorioResponsiveTable` (tabela em `sm+`, lista de cards no mobile). Conserta **A-1, A-2, A-4** e alinha à diretriz "tabela = relatório, nunca tela de trabalho".

---

## 3. 🔴 BLOQUEADORES por tela

> Já deduplicados contra a Seção 2. Itens puramente cross-cutting não se repetem aqui; abaixo ficam os específicos da tela + ponteiro ao CC quando aplicável.

### SHELL / NAVEGAÇÃO (`app/crm/layout.tsx`, `components/mobile/*`, `lib/mobile/nav.ts`)
- **S-1** — 3 headers fixos empilhados (~180px de chrome). `MobileShell.tsx:141` + `layout.tsx:632` + `CrmPageHeader.tsx:48`. → **ver CC-1.**
- **S-2** — Padding-fantasma de 80px (`pb-[calc(5rem+...)]`) para tab-bar inexistente. `layout.tsx:685`. → **CC-1.**
- **S-3** — Título cai para "Obra10+" em rotas reais. `lib/mobile/nav.ts:90-108`. → **CC-11.**
- **S-4** — Dois botões "Voltar" com lógicas diferentes (`router.back()` vs histórico em estado). `layout.tsx:640-657` vs `MobileShell.tsx:117-125`. → **CC-1** (sobra só o do MobileShell após remoção).
- **S-5** — Badge do sino + título + 3 alvos de 44px estouram em <360px; título trunca para 2–3 chars. `MobileShell.tsx:173-191`. **Ajuste:** em <360px esconder sino quando `showBack` ativo; garantir largura mínima do título.

### DASHBOARD / PULSO (`app/crm/page.tsx`, `components/crm/CrmPipelineResumo.tsx`)
- **D-1** — Valor R$ por etapa em `text-[8px]` (ilegível, truncado em card ~50px). `CrmPipelineResumo.tsx:281-287,387-395`. → **CC-2.** Alternativa: remover valor do card no mobile, mostrar no KPI agregado.
- **D-2** — Funil de 6 etapas espremido sem `min-w`; `overflow-x-auto` inerte (comprime em vez de rolar); cards <44px. `CrmPipelineResumo.tsx:240-296`. **Ajuste:** `min-w-[56px]` por coluna + rolar de fato, OU lista vertical (`flex-col`) abaixo de `sm:`; esconder conectores de % no mobile (`hidden sm:flex` libera ~70px). (Epicentro também tem JSX duplicado leads vs negócios — extrair `FunilEtapaCard`.)
- **D-3** — Pills Ganhos/Perdidos com `justify-between` empurram a extremos ao quebrar; `py-1` (~28px). `CrmPipelineResumo.tsx:301-317`. **Ajuste:** `flex-col items-start` + `min-h-11` no mobile.

### ATENDIMENTO (`app/crm/atendimento/page.tsx`)
- **AT-1** — Header do sideover "Info" inteiro em azul Shadcn. `atendimento/page.tsx:1090-1101`. → **CC-6.**
- **AT-2** — Par label(10px)+valor(12px) em ~40 campos do sideover; Observações/1ª mensagem são leitura longa. `:1130-1131,1155-1156,1174-1175,1195-1196`. → **CC-2** (extrair `<InfoRow label value/>` 11px/13px).
- **AT-3** — Chips de modo/estágio ~26px de altura (controle primário de filtro). `:590-604,636-644`. → **CC-3.**
- **AT-4** — Setas de scroll dos chips `w-6 h-full` (24px). `:574-581,614-621,626-633,650-657`. → **CC-3** (ou `hidden sm:flex` e confiar no swipe nativo).

### CADASTROS PESSOA/EMPRESA (`CadastroWizard.tsx`, `*Sideover.tsx`, `SmartField.tsx`)
- **CPE-1** — `INPUT.fontSize:14` → zoom iOS em ~12 inputs. → **CC-9.**
- **CPE-2** — "Buscar CNPJ"/"Buscar CEP" sem `minHeight` (cai <44px) e encolhe ao quebrar. `CadastroWizard.tsx:626-697,890-906`. **Ajuste:** `minHeight:44`; `flex-basis:100%` ao quebrar.
- **CPE-3** — Botões "Buscar CEP" nos drawers legados/sideover ~40-41px. `EmpresaFormDrawer.tsx:342-360`, `PessoaFormModal.tsx:877-911`. → **CC-3** (`minHeight:44` + `alignItems:stretch`).
- **CPE-4** — Chips `SmartField.tsx:119` (`min-h-10`) e `MercadoLeadPicker.tsx:35` (`min-h-9`/36px) — coração do Click-and-Go em todos os forms. → **CC-3.**
- **CPE-5** — Sub-grid Logradouro/Número `"1fr minmax(96px,140px)"` nunca colapsa; a 320px fica colado nas bordas. `CadastroWizard.tsx:913`. **Ajuste:** `minmax(0,1fr)` + fallback 1 coluna <360px.
- **CPE-6** — Botões "Guardar"/"Confirmar exclusão" em `#238636`/`#da3633`. → **CC-7.**

### CADASTROS LEAD/NEGÓCIO (`NegocioFormDrawer.tsx`, kanbans, detalhe)
- **CL-1** — Stepper `repeat(4,1fr)` fixo espreme rótulos longos. `NegocioFormDrawer.tsx:674-733`. → **CC-8** (`repeat(2,1fr)` <480px ou pills numeradas).
- **CL-2** — Cards de métrica `repeat(4,1fr)` fixo; R$ truncado em ~75px. `NegocioFormDrawer.tsx:737,930` (+ `:822` date em meia-largura). → **CC-8** (2×2).
- **CL-3** — Rodapé com 4 botões `minWidth` 120-160 (~552px de mínimos) vira paredão de 3-4 linhas. `NegocioFormDrawer.tsx:564-669`. **Ajuste:** `minWidth:0`+`flex:1`, CTA primário (Salvar) full-width no mobile.
- **CL-4** — Kanban com `scrollbar-none` + colunas `72vw` (próxima mal espia) sem affordance. `negocios/page.tsx:498`, `leads/page.tsx:864`, `PipelineTabsBar.tsx:97`. → **CC-4.**
- **CL-5** — Detalhe do negócio: `gridTemplateColumns:"1fr 1fr"` + ações inline, **sem nenhum** breakpoint/`useNarrowViewport`. `negocios/[id]/page.tsx:643,674-678`. → **CC-8** (empilhar <480px; migrar ao padrão responsivo das listas).

### OBRAS (`components/crm/obras/*`)
- **OB-1** — Ficha do item `grid grid-cols-2` Situação×Andamento sem `sm:`; a ~320px espreme e a hierarquia quebra. `ObraItensSecao.tsx:304`. → **CC-8** (`grid-cols-1 sm:grid-cols-2`).
- **OB-2** — Linha de item do orçamento com 3 inputs fixos (`desc flex:2` + qtd `width:64` + unit `width:84`); R$ de milhar não cabe em 84px. `ObraFinanceiroSecao.tsx:828-833`. **Ajuste:** `flexWrap:wrap` + `flex:1; minWidth:90` nos numéricos (ou coluna <380px).
- **OB-3** — ResumoCards/Custódia `repeat(3,1fr)` fixo; label "Aguarda 2ª chave ⏳" em 1/3 de 320px quebra e desalinha alturas. `ObraFinanceiroSecao.tsx:364,715`. → **CC-8** + encurtar labels.

### FINANCEIRO / APROVAÇÕES (`app/crm/financeiro/**`, `app/crm/aprovacoes/**`)
- **F-1** — KPI "Vencido": `sub` concatena 2 valores **exatos** (`moedaFinanceiroExata`) em card de ~160px sem `truncate`/`break-words` → 4-5 linhas, grade torta. `CrmFinanceDashboard.tsx:174-181`. **Ajuste:** usar `moedaFinanceiro()` (abreviado) no `sub` + **CC-5** no `<p>`. (Viola a própria regra `finance-contas.ts:46`: exato só no item.)
- **F-2** — Valor exato `text-lg font-black` encosta na borda em 320px (≥7 dígitos), sem `break-words`. `FinanceiroContasList.tsx:118-120`. **Ajuste:** `text-base sm:text-lg` + `pr-1`.
- **F-3** — Aprovações: wrapper `<div style={{flex:1}}>` **sem `minWidth:0`** + `<p>` sem `wordBreak` → meta-linha longa empurra largura. `aprovacoes/page.tsx:412-418`. **Ajuste:** `minWidth:0` no wrapper + `wordBreak:break-word` no `<p>`.
- **F-4** — Labels do gate de dinheiro ("O QUE OBSERVOU/IMPACTO/RECOMENDAÇÃO") em `fontSize:9`. `aprovacoes/page.tsx:401,424,433,449`. → **CC-2** (gate de dinheiro = clareza crítica).

### RELATÓRIOS / CONFIG / AGENTES (`relatorios`, `analytics`, `configuracoes`, `agentes-reais`)
- **A-1** — `<table min-w-[640px]>` em `overflow-auto` → scroll-X+Y aninhado, células `text-xs`. `relatorios/page.tsx:212`. → **CC-12.**
- **A-2** — `max-w-[220px] truncate` + `title` (tooltip não existe no toque) → dado cortado inacessível. `relatorios/page.tsx:226`. → **CC-12** (`whitespace-normal break-words` ou tap p/ abrir).
- **A-3** — Labels de mini-KPI `text-[10px]` (ex.: "Aprovações pendentes (ao vivo)") quebram feio em `grid-cols-2`. `CrmAnalyticsDashboard.tsx:114`. → **CC-2** + encurtar rótulos.
- **A-4** — 2ª tabela ("Histórico de medições") `<table w-full text-sm>` sem `overflow-x` → pode empurrar largura global; data+hora completa estoura. `CrmAnalyticsDashboard.tsx:554`. → **CC-12.**
- **A-5** — Abas de entidade + "Atualizar" `px-3 py-2 text-xs` (~30-32px). `relatorios/page.tsx:170-184`. → **CC-3.**
- **A-6** — `PipelineTabsBar` setas `hidden sm:` + `scrollbar-none` = affordance zero; tabs ~28px. `PipelineTabsBar.tsx:74-91,97`. → **CC-3** + **CC-4.**
- **A-7** — Labels de form "Início/Fim/Fuso/Prazo" em `text-[10px]`; "Fuso" é **input de texto livre** (viola Click-and-Go). `configuracoes/page.tsx:203,214,225,259`. → **CC-2** + trocar Fuso por `<select>`.

---

## 4. 🟢 POLISH por tela

### SHELL / NAVEGAÇÃO
- **S-6** — `#0d1117`/`rgba(22,27,34)`/`#161b22` fora da marca. `MobileShell.tsx:139`, `MobileDetector.tsx:13`, `layout.tsx:635`, `MobileMoreSheet.tsx:38`. → **CC-6.**
- **S-7** — Badge do sino `text-[9px]` (limite). `MobileShell.tsx:187`. → subir p/ 10-11px. (Labels de seção uppercase 10px toleráveis.)
- **S-8** — Botão "Voltar" `h-11 w-9` (largura 36px). `MobileShell.tsx:166`. → `w-11`.
- **S-9** — Drawer mobile do CRM (~190 linhas) inalcançável (atrás do MobileShell). `layout.tsx:692-885`. → **CC-1** (remover).
- **S-10** — `!text-[8px]` no subtítulo do brand header mobile. `layout.tsx:659`. → **CC-1** (some com a remoção).

### DASHBOARD / PULSO
- **D-4** — "Visão comercial" `grid-cols-2` no mobile com labels longos quebrando 2-3 linhas. `page.tsx:178`. → opcional `grid-cols-1 xs:grid-cols-2`.
- **D-5** — `CrmMetricCard` label `text-[11px]` (piso). `:43`. → **CC-2** (tolerável por ser uppercase).
- **D-6** — Botão "Atualizar" `h-9 w-9` (36px). `CrmPipelineResumo.tsx:149`. → **CC-3.**
- **D-7** — Tabs Leads/Negócios `py-1.5` (~30px). `CrmPipelineResumo.tsx:154-175`. → **CC-3.**
- **D-8** — Links "Ver todos" `py-1` (~26px). `CrmUltimosLeads.tsx:45`, `CrmEquipeResumo.tsx:37`. → **CC-3.**
- **D-9** — Label de item com `truncate` esconde a parte crítica ("· 2 há +7 dias"). `CrmOQuePrecisaDeVoce.tsx:198-199`. → `line-clamp-2`.

### ATENDIMENTO
- **AT-5** — Meta-linha do card cola badge no texto (`mr-2`). `:688-700`. → `mr-3` + badge `max-w-[40%]`.
- **AT-6** — Origem/tempo do card `text-[10px]`. `:686,689`. → **CC-2.**
- **AT-7** — Enter envia intercepta no mobile → bloqueia quebra de linha no teclado touch. `:1046`. → no `isMobile`, não interceptar Enter; placeholder condicional.
- **AT-8** — Header de ações: 4 botões `py-1.5` (~30px) apertados. `:750-793`. → colapsar "Ver ficha"/"Info" em "⋯"; `py-2`.

### CADASTROS PESSOA/EMPRESA
- **CPE-7** — Badge "VENDAS" `fontSize:9` e status `fontSize:10`. `CadastroComercialSecao.tsx:146,169`. → **CC-2** (piso 11px badge / 12px hint de validação).
- **CPE-8** — Toggle PF/PJ `gap:10` apertado a 320px. `CadastroWizard.tsx:581`. → `gap:8` no mobile.
- **CPE-9** — Rodapé `flexWrap:wrap`+`justify-end` desalinha ao quebrar. `CadastroPremiumSideover.tsx:126-142`. → botões `flex:1` no mobile.
- **CPE-10** — CEP no sideover sem spinner (paridade com Wizard). `CadastroContactoSideover.tsx:757-769`. → indicador de loading no blur.

### CADASTROS LEAD/NEGÓCIO
- **CL-6** — `actionBtn` 32px nos cards (clicável dentro de card clicável). `LeadKanbanCard.tsx:395`, `NegocioKanbanCard.tsx:101`. → **CC-3** (40-44px + gap maior).
- **CL-7** — Chips origem/mercado `fontSize:10`. `LeadKanbanCard.tsx:189`, `NegocioKanbanCard.tsx:161`. → **CC-2.**
- **CL-8** — `ParticipantePicker` dropdown `maxHeight:320` cobre rodapé com teclado aberto. `:146`. → `min(320px,40vh)`.
- **CL-9** — Quick-actions do lead (6 botões) rolam sem dica. `leads/page.tsx:1075`. → **CC-4.**

### OBRAS
- **OB-4** — `text-[10px]` em custódia/descrição de menu (leitura central). `ObraFinanceiroSecao.tsx:723`, `ArvoreEscopo.tsx:328,552,569`. → **CC-2.**
- **OB-5** — Labels do eixo Y do SVG `fontSize={3}` podem borrar. `ObraCronogramaSecao.tsx:357`. → rótulos HTML fora do SVG (baixa prioridade; tem `sr-only`).
- **OB-6** — Sub-abas de Compras sem `overflowX:auto` (inconsistente). `ObraComprasEstoqueSecao.tsx:99-102`. → adicionar por consistência.
- **OB-7** — Botão de voz com texto fixo entre aspas pode espremer. `ObraItensSecao.tsx:347`. → polish.
- **OB-8** — Setas mover ↑/↓ `size={14}` sem padding (~14-18px). `EapEditorSideover.tsx:188-205`. → **CC-3** (botão `w-9`) ou drag.

### FINANCEIRO / APROVAÇÕES
- **F-5** — Chips de filtro de tipo com label completo larguíssimo. `aprovacoes/page.tsx:318-320`. → ícone+contagem no chip, label completo no card.
- **F-6** — KPIs abreviados k/M sem affordance p/ ver exato. `CrmFinanceDashboard.tsx:159`. → `title`/`aria-label` com valor exato.
- **F-7** — Modal lançamento `grid-cols-2` (valor/vencimento) apertado a 320px. `FinanceiroNovoLancamentoModal.tsx:155`. → `grid-cols-1 sm:grid-cols-2`.
- **F-8** — Skeleton `#121926` azulado (vs verde real). `CrmMetricCard.tsx:17`. → **CC-6.**
- **F-9** — `padding:24px` fixo nas aprovações (não responsivo). `aprovacoes/page.tsx:296,327`. → `isMobile ? 16 : 24`.

### RELATÓRIOS / CONFIG / AGENTES
- **A-8** — `text-[10px]/[11px]` pervasivo em texto informativo. `relatorios/page.tsx:140,155`, `CrmAnalyticsDashboard.tsx:396,522,543,556`. → **CC-2.**
- **A-9** — `text-[8px]/[9px]` no gráfico de barras; valores só em `group-hover` (invisíveis no toque). `CrmLeadsEntradaPeriodo.tsx:62,66,70,94,105`. → **CC-2** + valores visíveis por padrão no mobile.
- **A-10** — Input numérico de follow-up `py-1` (~30px). `configuracoes/page.tsx:300-311`. → **CC-3.**
- **A-11** — Padding/maxWidth inline fixo sem breakpoint. `agentes-reais/page.tsx:65-66`. → padding 12px no mobile.
- **A-12** — Emoji 🧱 como unidade de crédito (tofu em alguns Androids). `agentes-reais/page.tsx:140-144`. → ícone Lucide ou "créd.".

---

## 5. PLANO DE LOTES (execução sequencial com gates)

> Cada lote é coerente, aditivo e tem gate `tsc + vitest + _chk23 + verificação visual no narrow`. Ordem escolhida por **alavancagem × risco**: chrome primeiro (libera viewport p/ ver tudo), depois tokens globais (1 fix → N telas), depois telas.

### Lote A — Shell + navegação (desbloqueio de viewport) — `CC-1, CC-6 (shell), CC-11`
Eleger `MobileShell` como dono único do chrome. Remover header+drawer mobile de `app/crm/layout.tsx`, ocultar `CrmUniversalHeader` no narrow, trocar padding-fantasma, apagar código morto de tab-bar, derivar título de `CRM_NAV_GROUPS`, trocar `#0d1117`→token da marca no shell.
**Resolve:** S-1, S-2, S-3, S-4, S-5, S-9, S-10, S-6(parcial). **Por que primeiro:** libera ~200px e dá a base honesta para validar todos os lotes seguintes no mobile.

### Lote B — Tokens globais: tipografia + toque + iOS-zoom — `CC-2, CC-3, CC-9`
Três regras de alavanca máxima: (1) política tipográfica (piso 12px conteúdo / 11px badge) via varredura; (2) classe `.tap-target` (min 44px) aplicada a botões/chips/abas/inputs de drawer; (3) regra global `@media (max-width:767px){input,select,textarea{font-size:16px}}`.
**Resolve (parcial/total):** D-1, D-6, D-7, D-8, AT-2, AT-3, AT-4, CPE-1, CPE-3, CPE-4, F-4, A-3, A-5, A-7(font), A-8, A-9, A-10, OB-4, OB-8, CL-6, CL-7 + polidos tipográficos. **Maior ROI do plano.**

### Lote C — Marca: cores fora do design system — `CC-6 (sideovers), CC-7`
Trocar azul Shadcn/GitHub e verde GitHub pelos tokens (`#0a140f`/`#0f1d16`/`CRM_CHROME_SOLID`, `#003b26`+`#c9a24a`). Sideover de atendimento, skeleton, botões de salvar/excluir dos cadastros.
**Resolve:** AT-1, CPE-6, F-8 + S-6(resto). **Risco baixo, ganho de identidade alto.**

### Lote D — Grids inline → responsivos + drawers caseiros — `CC-8, CC-10`
Colapsar `repeat(3/4,1fr)` e `1fr 1fr` inline para `auto-fit`/`grid-cols-1 sm:grid-cols-N`; migrar drawers caseiros de Financeiro/Compras para `CadastroPremiumSideover`; extrair `INPUT` compartilhada. Inclui a página de detalhe do negócio (sem breakpoint hoje).
**Resolve:** CL-1, CL-2, CL-3, CL-5, OB-1, OB-2, OB-3, CPE-5, F-7 + inputs de 36px dos drawers de obra.

### Lote E — Scroll/affordance + tabela→cards — `CC-4, CC-12, CC-5`
Indicador de scroll horizontal (fade/peek) nos kanbans e tab-bars; componente `RelatorioResponsiveTable` (cards no mobile); `min-w-0 break-words` no `CrmMetricCard.sub` + abreviado no KPI "Vencido"; `minWidth:0` nos flex de texto das aprovações.
**Resolve:** CL-4, CL-9, A-1, A-2, A-4, A-6, F-1, F-2, F-3, CC-5.

### Lote F — Polish fino + funil duplicado (acabamento) — restantes 🟢
Extrair `FunilEtapaCard` (dedup leads/negócios) + lista vertical no mobile (D-2, D-3); Enter no mobile (AT-7); paddings responsivos (F-9, A-11); affordances menores (CL-8, AT-5, AT-8, OB-5/6/7, D-4/9, CPE-7/8/9/10, F-5/6, A-12); Fuso → `<select>` (A-7).
**Resolve:** o resto da fila 🟢 + D-2/D-3 (que são 🔴 de UX mas dependem da refatoração do componente de funil).

**Gate por lote:** `tsc` limpo + `vitest` verde + `_chk23` + abrir 2-3 telas afetadas no narrow (360px) e tocar os CTAs. Aditivo, sem push até o dono validar (trava de memória).
