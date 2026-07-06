# Auditoria E2E — DOMÍNIO A (Comercial/CRM)

> Régua-mãe: o melhor para o sistema — crítico, seguro, cuidadoso, com CERTEZA.
> Modo: READ-ONLY (nada alterado). Data: 2026-06-30.
> Telas auditadas: Dashboard (`/crm`), Leads (`/crm/leads` + kanban + caixa + ficha drawer + `[id]`), Distribuição (`/crm/distribuicao`), Negócios (`/crm/negocios`), Atendimento (`/crm/atendimento`), Canais (`/crm/canais`), Tráfego (`/crm/trafego`) + componentes (`LeadKanbanCard`, `NegocioKanbanCard`, `FilaDistribuicao`, `CrmCanalSideover`, drawers).

## Veredito geral

O domínio Comercial está **funcional de verdade, não fachada**. Funil/kanban movem cards via API real (`PATCH /api/crm/negocios/[id]`, `patchLeadCrm`), lead→negócio→obra encadeia (`converter-negocio` → push para `/crm/negocios/[id]`), atendimento envia/assume/devolve via endpoints guardados com identidade de sessão, distribuição atribui leads de verdade (sugerir→aprovar) e roda auditor. **Segurança server-side está madura**: todas as rotas auditadas têm guard de papel (`requireCrmComercial/Gestor/Sessao/Owner`), identidade vem do cookie httpOnly (não de header forjável), e as leituras usam `tenantScopeOrFilter`. RLS está habilitado nas tabelas lidas pelo browser (anon key) com a view `security_invoker = true`.

Não há BLOQUEADOR de vulnerabilidade nem de fluxo quebrado. Os achados são ajustes de robustez, UX/a11y e uma exposição de leitura sem guard.

---

## 🔴 BLOQUEADORES

### B1 — `/api/hub/canais` (GET) sem guard de autenticação nem escopo de tenant
- **Arquivo:** `app/api/hub/canais/route.ts:17-35`
- **Problema:** A rota que alimenta a tela **Canais** faz `GET` direto na `hub_agente_identidade` com a **service-role key** e **sem nenhum guard** (`requireCrm*`/`requireInternalApiKey`) e **sem filtro de tenant**. Retorna todos os agentes/canais (nome, slug, instância, status de conexão) de toda a base. A sanitização (`sanitizarAgenteHubParaCliente`) remove o token, mas a lista de canais/instâncias de **todos os tenants** fica exposta a qualquer chamador que alcance a rota. As demais rotas do domínio exigem `x-api-key` + sessão; esta é a única exceção.
- **Ajuste:** adicionar guard no início do handler — `const g = await requireCrmSessao(request); if ("error" in g) return g.error;` — e filtrar por tenant: aplicar `.or(tenantScopeOrFilter(g.ctx.tenantId))` no select (a `hub_agente_identidade` precisa expor `tenant_id`; se ainda não, escopar via fallback de coluna como nas outras rotas). Mínimo imediato: exigir `requireInternalApiKey(request)` para fechar o acesso anônimo.

---

## 🟢 AJUSTES AUTÔNOMOS (ordenados por valor)

### G1 — Inserts de nota/atividade no browser não passam `tenant_id` (nascem órfãos)
- **Arquivo:** `app/crm/leads/page.tsx:442-444` (`adicionarNota`)
- **Problema:** A nota e a atividade são gravadas direto pelo client anon (`supabase.from("hub_notas").insert(...)` / `hub_atividades`) **sem `tenant_id`**. A RLS anon permite (`tenant_id IS NULL OR = default`), então grava — mas o registro nasce com `tenant_id NULL`. É exatamente o padrão de “legado órfão” que a memória do projeto (`tenant-null-leak-pattern`) manda evitar: em multi-tenant, linha NULL é visível a todos. Hoje funciona (mono-tenant), mas planta dívida.
- **Ajuste:** rotear a criação de nota pela API já existente (`POST /api/crm/leads/[id]/nota`, que tem guard + tenant) em vez do insert direto; ou, no mínimo, incluir `tenant_id` no insert do client. Mesmo padrão vale para a atividade de companhia.

### G2 — `regras/route.ts` deriva tenant do header (caminho cron) tendo sessão disponível
- **Arquivo:** `app/api/crm/distribuicao/regras/route.ts:14` (`tenantIdFromRequest(...)`) com guard `requireCrmGestor` logo acima.
- **Problema:** A rota tem sessão (`requireCrmGestor` retorna `g.ctx.tenantId`), mas o tenant das regras é resolvido por `tenantIdFromRequest(request.headers)` — a função documentada como “apenas para o caminho de cron/worker, NÃO para rotas com sessão de usuário” (`lib/tenant-default.ts:60-69`). Hoje converge para o mesmo default, mas é inconsistente com o resto do domínio e quebra isolamento quando houver tenant real na sessão.
- **Ajuste:** usar `g.ctx.tenantId` (o tenant do gestor logado), como fazem `negocios/route.ts` e `leads/route.ts`.

### G3 — Drag-and-drop do kanban não tem alternativa por teclado (a11y)
- **Arquivos:** `app/crm/leads/page.tsx:875-900` e `app/crm/negocios/page.tsx:559-577` (HTML5 `draggable` + `onDrop`).
- **Problema:** Mover card entre etapas no desktop depende exclusivamente de mouse drag-and-drop; não há foco/`onKeyDown` para mover por teclado. Usuário de teclado/leitor de tela não consegue trabalhar o funil no desktop.
- **Atenuante real:** já existe caminho não-drag — no mobile há o sheet “Mover etapa” (`moverAlvo`, negócios) e a ficha/drawer do lead tem seletor de estágio por botão. **Ajuste:** expor esse mesmo seletor de etapa também no desktop (ex.: botão “mover” no card, como o `onMove` que hoje só aparece no mobile), dando uma rota acessível sem drag.

### G4 — `labelRemetente` no atendimento tem heurística morta/confusa
- **Arquivo:** `app/crm/atendimento/page.tsx:501-515` (`labelRemetente`) — variáveis `isIa` e `!leads.find(() => false)` não fazem nada (sempre `false`/`true`), restos de tentativa anterior.
- **Problema:** Código morto que não afeta a saída (a lógica real está em `looksHuman`), mas confunde manutenção e pode mascarar bug futuro. O rótulo “IA · {slug}” aparece para qualquer saída sem metadata humana — aceitável, mas a função carrega lixo.
- **Ajuste:** remover as duas linhas mortas (`isIa`/`leads.find(() => false)`) e manter só `looksHuman`.

### G5 — Tipografia 9–10px abaixo do mínimo legível em vários cards
- **Arquivos:** `components/crm/leads/LeadKanbanCard.tsx:208-219` (`fontSize: 9/10`), `app/crm/distribuicao/page.tsx:366` (`fontSize: 9`), `app/crm/atendimento/page.tsx` (vários `text-[9px]`/`text-[10px]`), `NegocioKanbanCard.tsx:270-279` (`fontSize: 9`).
- **Problema:** Labels de SLA, “aderência”, badges e timestamps em 9–10px ficam no limite/abaixo do legível, principalmente no mobile e para baixa visão. Já era apontado em auditorias anteriores (verbosidade 10px).
- **Ajuste:** elevar o piso para 11px nesses microtextos; reservar 10px só para badges muito secundários com bom contraste.

### G6 — Contraste de microtexto cinza fraco sobre fundo escuro
- **Arquivos:** `app/crm/leads/page.tsx` (`text-[#484f58]` em vazios/“ver →”), `LeadKanbanCard.tsx:199` (`#64748b`), `atendimento` (`text-zinc-700`/`text-zinc-600` em horas e placeholders).
- **Problema:** `#484f58`/`#64748b`/`zinc-700` sobre `#0a140f`/`#0f1d16` ficam abaixo de 4.5:1 (texto pequeno). Estados vazios e timestamps quase somem.
- **Ajuste:** subir para a faixa `#8b949e`/`#a9c6b6` (já usada como secundária na marca) em textos informativos pequenos; reservar os tons mais escuros para separadores/decoração `aria-hidden`.

### G7 — Dashboard: card “Taxa encaminhamento” aponta para `/crm/parceiros`, não para distribuição
- **Arquivo:** `app/crm/page.tsx:84-91` (rota do KPI = `/crm/parceiros`).
- **Problema:** O KPI fala de encaminhamento (job da Distribuição), mas o clique leva a Parceiros. Pequeno descasamento de intenção/navegação.
- **Ajuste:** apontar “Taxa encaminhamento” e “Encaminhamentos hoje” para `/crm/distribuicao` (onde se age sobre o número).

### G8 — Atendimento: polling de 30s sem realtime na LISTA (só no chat aberto)
- **Arquivo:** `app/crm/atendimento/page.tsx:173-179` (lista por `setInterval(30000)`); o realtime existe só para a conversa selecionada (`:288-303`).
- **Problema:** Uma nova conversa pode demorar até 30s para aparecer na inbox. Para um atendente isso é uma janela perceptível (“não chegou ninguém?”). Não é bug, é latência de UX.
- **Ajuste:** assinar `postgres_changes` de INSERT em `hub_leads_crm`/`hub_fila_mensagens` para refrescar a lista (como já se faz na tela de Leads), reduzindo o polling a fallback.

### G9 — Mensagem vazia do histórico afirma demais ("não foram preservadas")
- **Arquivo:** `app/crm/atendimento/page.tsx:826-838`
- **Problema:** O estado-vazio diz “Mensagens anteriores ao sistema de histórico não foram preservadas”, o que pode assustar o operador (parece perda de dado) quando muitas vezes é só conversa nova sem histórico.
- **Ajuste:** suavizar para “Ainda não há mensagens neste histórico. As novas aparecem aqui em tempo real.”

### G10 — Tráfego/Canais sem header mobile dedicado consistente / sem skeleton no Tráfego
- **Arquivos:** `app/crm/trafego/page.tsx` (loading só spinner), `app/crm/canais/page.tsx` (tem skeleton — bom; serve de referência).
- **Problema:** Inconsistência de padrão de loading entre telas-irmãs do domínio. Canais usa skeleton pulse (ótimo); Tráfego usa só um spinner central.
- **Ajuste:** padronizar o loading do Tráfego com skeleton de KPIs/linhas, alinhando ao de Canais.

---

## ✅ STATUS DOS FIXES (aplicados 2026-06-30, branch wendel/dev — NÃO commitado)

- **B1** — APLICADO. `app/api/hub/canais/route.ts` GET agora exige `requireCrmSessao` e escopa por `tenantScopeOrFilter(g.ctx.tenantId)`; degrada graciosamente (sem filtro) só quando a base não tem a coluna `tenant_id` — o guard de sessão continua fechando o acesso anónimo. A página de Canais já enviava `internalApiHeaders()` + cookie same-origin, então segue funcionando.
- **G1** — APLICADO. `adicionarNota` (`app/crm/leads/page.tsx`) deixou de inserir direto via client anon; agora chama `POST /api/crm/leads/[id]/nota`. A rota foi estendida para gravar `hub_notas` (painel) **e** `hub_atividades` (timeline) com `tenant_id` do gestor — fim do registro órfão.
- **G2** — APLICADO. `app/api/crm/distribuicao/regras/route.ts` GET agora tem `requireCrmGestor` e usa `g.ctx.tenantId` via `tenantScopeOrFilter` (não mais `tenantIdFromRequest`).
- **G4** — APLICADO. `labelRemetente` (atendimento): removidas as 2 linhas mortas (`isIa`/`leads.find(() => false)`); só `looksHuman` permanece.
- **G5/G6** — APLICADO (cards do domínio A). Microtextos 9–10px → 11px e cinzas fracos (`#484f58`/`#64748b`/`#6e7681`/`text-zinc-600/700`) → `#8b949e`/`#a9c6b6`/`text-zinc-400`. Arquivos: `LeadKanbanCard.tsx`, `NegocioKanbanCard.tsx`, `distribuicao/page.tsx`, `leads/page.tsx` (estados vazios/timestamp), `atendimento/page.tsx` (timestamps/empties). Badges com bom contraste mantidos a 10px.
- **G7** — APLICADO. Dashboard: KPIs "Taxa encaminhamento" e "Encaminhamentos hoje" agora apontam para `/crm/distribuicao`.
- **G9** — APLICADO. Estado-vazio do chat: "Conversa pronta para começar / Ainda não há mensagens neste histórico. As novas aparecem aqui em tempo real." + contraste melhorado.
- **G10** — APLICADO. Tráfego: spinner central trocado por skeleton de linhas com `animate-pulse` (alinhado ao padrão de Canais).

### 🚩 FLAGS (maiores — NÃO feitos nesta rodada, deixados para mesa/planejamento)

- **G3 — Kanban mover por teclado (a11y).** Drag-and-drop HTML5 sem alternativa por teclado no desktop (`leads/page.tsx`, `negocios/page.tsx`). Atenuante: há sheet "Mover etapa"/seletor no mobile e na ficha. Fix correto = expor o seletor de etapa também no desktop (botão "mover" no card como o `onMove`), com foco/ARIA — mudança de UX maior, fora do escopo cirúrgico desta rodada.
- **G8 — Realtime na LISTA do inbox.** Hoje a inbox refaz por polling de 30s; realtime só na conversa aberta. Fix = assinar `postgres_changes` (INSERT em `hub_leads_crm`/`hub_fila_mensagens`) para refrescar a lista. É feature de tempo-real (risco de regressão em subscription/cleanup), merece teste dedicado — flag.

---

## 🟡 DECISÕES PARA O DONO

### D1 — Isolamento multi-tenant na leitura via browser (anon) ainda é "mono-tenant na prática"
- **Evidência:** `lib/supabase/client.ts:28` (anon key) + RLS anon `USING (tenant_id IS NULL OR = default_obra10_tenant_id())` (`20260523120000_crm_integral_core.sql:363`) + leituras diretas em `app/crm/leads/page.tsx:234-238, 362-366`.
- **Decisão:** Hoje o CRM lê leads/notas/atividades/memórias direto do banco com a chave anon, e a RLS anon libera **tudo do tenant default + linhas NULL**. Para multi-tenant real (vários escritórios), essa leitura precisa migrar para o claim `authenticated` (`app_tenant_id()`) ou passar a ler via API server (que já escopa por sessão). É o trabalho de Multi-tenant Fase 1 já registrado na memória — **confirmar se entra agora ou continua deferido** enquanto a operação é de um tenant só.

### D2 — Tela "Canais" é por agente/instância e mistura conceito Hub × operação local
- **Evidência:** `app/crm/canais/page.tsx:22-36` (`SLUGS_CANAL_PADRAO`, heurística de relevância) — a tela some/aparece canais por regra implícita de slug quando falta `modo_operacao`.
- **Decisão:** A regra "quais agentes são canais" hoje é heurística no front. Vale alinhar com o dono se a fonte de verdade deve ser uma flag explícita no banco (`modo_operacao = canal_whatsapp`) para não esconder/mostrar canal por engano.

### D3 — "Caixa de Oportunidades" (Leads) é a superfície default; Kanban/Lista são secundárias
- **Evidência:** `app/crm/leads/page.tsx:186` (`view` default = `"caixa"`).
- **Decisão:** A Caixa (faixas Agora/Hoje/Aguardando) é uma escolha de produto forte e alinhada ao "o que precisa de mim agora". Confirmar com o dono que essa é a tela de trabalho canônica do gestor (e o Kanban vira visão de pipeline), para não reintroduzir a tabela como tela de trabalho.

---

## Notas de verificação (o que foi confirmado funcionando)

- **Funil move de verdade:** `negocios` PATCH com guard + `tenantScopeOrFilter`, otimista no front + toast de erro/sucesso. Leads via `patchLeadCrm` com rollback de erro (`mostrarErroAcao`).
- **lead→negócio→obra:** `converter-negocio` cria negócio e redireciona; `derivar-entrega` referenciada no PATCH de negócio (esteira ao ganhar).
- **Atendimento seguro:** `send` exige identidade de sessão (`resolveCallerAuthId`), valida que o operador é o `humano_responsavel` (ou owner/admin), trata WhatsApp dry-run. Assumir/devolver via API.
- **Distribuição real:** `FilaDistribuicao` → `sugerir` (cria encaminhamento) → `aprovar` (avisa fornecedor); auditor/cobrar/liberar todos guardados (`requireCrmGestor`).
- **Tráfego owner-only:** `windsor/campanhas` = `requireCrmOwner`; a tela trata 403 com aviso amigável + CTA Integrações (sem fachada).
- **Marca:** verde+dourado consistente; os únicos "azuis" são `#1877F2`/`#E1306C`/`#0A66C2` usados corretamente como cores de origem (Meta/Instagram/LinkedIn), não Shadcn drift.
- **Erros tratados:** todas as telas têm estados de loading, vazio e erro com retry; toasts no lugar de `alert()`.
