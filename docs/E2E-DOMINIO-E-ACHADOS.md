# Auditoria E2E — DOMÍNIO E (IA / Agentes)

> Régua-mãe: o melhor para o sistema — crítico, seguro, cuidadoso, com CERTEZA.
> Modo: READ-ONLY (nenhum código alterado). Data: 2026-06-30.
> Nota de contexto: a IA depende do Mistral, que está **deferido/sem chave**. Por isso,
> funcionalidade de IA **ao vivo** não roda hoje. O foco abaixo é **estrutura, segurança,
> caminho do dinheiro (Tijolos) e UX** — distinguindo "quebrado" de "espera a chave de IA".

## Telas auditadas (todas existem e renderizam)

| Tela | Arquivo | Veredito rápido |
|---|---|---|
| Lista/ficha de agentes (Modelos) | `app/crm/agentes/page.tsx` (1899 l.) | Funcional, bem-feita |
| Novo agente (redirect) | `app/crm/agentes/novo/page.tsx` | OK (redireciona p/ `?novo=1`) |
| Ficha/playbook do agente | `app/crm/agentes/[slug]/page.tsx` (1791 l.) | Funcional, rica |
| Wizard "Novo agente" | `components/crm/AgenteNovoWizard.tsx` | Funcional; SEM mojibake (já corrigido) |
| Copiloto (central) | `app/crm/agentes-reais/page.tsx` | Funcional (histórico via supabase client) |
| Automações (ciclos) | `app/crm/ciclos/page.tsx` (2170 l.) | Funcional; **segredo cron no browser** |
| Ferramentas IA | `app/crm/ferramentas/page.tsx` | Funcional; gating owner correto |
| Carteira de Tijolos | `app/crm/creditos/page.tsx` | Funcional (modo medição/observabilidade) |
| Precificação & IA | `app/crm/precificacao/page.tsx` | Funcional; owner-only real |
| Integrações | `app/crm/integracoes/page.tsx` | Funcional; "Em breve" honesto |

---

## 🔴 BLOQUEADORES (segurança / dinheiro)

Padrão sistêmico confirmado por leitura direta do código: várias rotas-filhas do agente e
todas as rotas de ciclos/ferramentas usam **service-role (bypassa RLS)** e
(a) **não têm guard de sessão/papel** (`requireCrm*`) e/ou (b) **não têm escopo de tenant**
(`.eq('tenant_id')` ou guard `agenteForaDoTenant`). Filtram só por `agente_slug`/`id`.
Como o slug/id pode coincidir/ser conhecido entre tenants, isto é **vazamento e escrita
cross-tenant**. (As rotas-MÃE `agentes/route.ts` e `agentes/[slug]/route.ts` JÁ estão
corretas — guard + `agenteForaDoTenant` 404 — o que prova que o padrão certo existe e só
não foi propagado às filhas.)

> Atenuante honesto: hoje o sistema opera **single-tenant** (`defaultTenantId`), e o proxy
> exige `INTERNAL_API_KEY`. Então o risco "internet aberta" depende da borda. Mas o desenho
> é frágil: ao ligar o 2º tenant, vira leak imediato; e falta o gate de **papel** (um
> `atendente` logado consegue CRUD/destruir recursos que deviam ser gestor/owner).

### E-B1 — `memorias` DELETE apaga dados sem guard de sessão nem tenant 🔴 (o mais grave)
- Arquivo: `app/api/hub/agentes/[slug]/memorias/route.ts:44-90`
- Problema: DELETE chama `limparMemoriasAgente(supabase, slug, ...)` (apaga memórias do agente
  + zera fluxo conversacional de TODOS os leads do agente) após validar só `eq('agente_slug', slug)`
  (linha 69-73). **Sem `requireCrm*`** e **sem checagem de tenant**. Destruição de dados.
- Ajuste: adicionar `const g = await requireCrmGestor(req); if ("error" in g) return g.error;`
  e, antes de apagar, ler `tenant_id` do agente e retornar 404 se `agenteForaDoTenant(row, g.ctx.tenantId)`
  (reusar o helper já existente em `agentes/[slug]/route.ts`).

### E-B2 — `operacao` GET sem guard/tenant 🔴
- Arquivo: `app/api/hub/agentes/[slug]/operacao/route.ts:11-64` (não há `requireCrm*`; service-role; 4 selects só por `agente_slug`)
- Vaza ciclos, logs de execução (com `custo_brl`!), ações e último prompt de qualquer agente.
- Ajuste: guard `requireCrmSessao` + ler tenant do agente e 404 se fora do tenant.

### E-B3 — `logs` GET sem guard/tenant 🔴
- Arquivo: `app/api/hub/agentes/[slug]/logs/route.ts:11-41` (service-role; `hub_prompt_logs` só por slug)
- Vaza histórico de prompts/respostas de IA de qualquer agente. Ajuste igual a E-B2.

### E-B4 — `conhecimento` GET/PUT sem guard/tenant 🔴
- Arquivo: `app/api/hub/agentes/[slug]/conhecimento/route.ts` (GET `:40+`, PUT no mesmo arquivo)
- PUT grava conteúdo de conhecimento (vira system prompt do agente) validando só `agente_slug`.
  Sem `requireCrm*` e sem tenant → escrita cross-tenant. Ajuste: guard gestor + 404 fora do tenant.

### E-B5 — `mistral-sync` POST sem guard/tenant 🔴 (custo externo)
- Arquivo: `app/api/hub/agentes/[slug]/mistral-sync/route.ts`
- Sincroniza o agente com a Mistral (chamada externa/custo) validando só o slug. Ajuste: guard gestor + tenant.

### E-B6 — `playbook/gerar-por-ia` POST sem guard de sessão 🔴 (debita Tijolos)
- Arquivo: `app/api/hub/agentes/[slug]/playbook/gerar-por-ia/route.ts:58-79`
- Endpoint que **debita Tijolos por fase** e chama IA (texto/PDF/áudio) começa direto no check
  de service-role — **sem `requireCrm*`**. Usa `defaultTenantId()` (single-tenant; o `body.tenantId`
  NÃO é a brecha aqui — corrige a leitura de um relatório anterior). Brecha real = ausência de
  guard de sessão/papel num caminho que custa dinheiro.
- Ajuste: `requireCrmGestor` no topo; derivar tenant de `g.ctx.tenantId`; checar agente∈tenant.

### E-B7 — Ciclos: CRUD sem guard de sessão e sem tenant 🔴
- `app/api/hub/ciclos/route.ts:18,46` (GET lista todos os ciclos de TODOS; POST cria) — service-role, sem `requireCrm*`, sem tenant.
- `app/api/hub/ciclos/[id]/route.ts` (GET/PATCH/DELETE por `id`, sem `.eq('tenant_id')`).
- Efeito: qualquer portador do internal-key (ou, ao ligar multi-tenant, qualquer usuário) lê/edita/exclui ciclos de outro escritório.
- Ajuste: guard `requireCrmGestor` + coluna/escopo `tenant_id` nas queries (migração se faltar).

### E-B8 — Ciclos: endpoints de SUGESTÃO IA sem auth (custo aberto) 🔴
- `app/api/hub/ciclos/sugerir-ia/route.ts` e `app/api/hub/ferramentas-custom/sugerir/route.ts`
  chamam LLM (Claude/Mistral) sem `requireCrm*`. Custo de inferência sem dono/rate-limit.
- Ajuste: guard gestor + (idealmente) débito de Tijolos como nas outras rotas de IA.

### E-B9 — Ferramentas custom: sem guard de papel; tenant por header 🔴
- `app/api/hub/ferramentas-custom/route.ts:22,35` (GET/POST) e `.../[id]/route.ts` (PATCH/DELETE)
  não usam `requireCrm*`; tenant vem de `tenantIdFromRequest(headers)`.
- `tenantIdFromRequest` (`lib/tenant-default.ts:70`) só honra `x-tenant-id` **com `INTERNAL_API_KEY`**
  (bom — já blindado contra header forjável do browser); sem a chave cai no default. Mesmo assim,
  falta o gate de papel: a tela já restringe "Gerenciar custom" a `isOwner` no front, mas a **API
  não revalida** — um gestor/atendente com o internal-key edita ferramentas.
- Ajuste: `requireCrmOwner` (espelhar a regra da UI) nas rotas de ferramentas-custom.

### E-B10 — Segredo de cron **hard-coded no código do browser** 🔴
- Arquivo: `app/crm/ciclos/page.tsx:588` — a função `executarAgora` (botão "Executar agora")
  monta `/api/ciclos/${agente}?...&secret=obra10plus_cron_2026` **a partir do componente client**.
- Validação: `lib/cron-auth.ts:7-26` — em produção aceita `secret` SE `=== process.env.CRON_SECRET`.
  Ou seja: a string `obra10plus_cron_2026` só "funciona" se `CRON_SECRET` estiver setado exatamente
  com esse valor; em `NODE_ENV!=="production"` o `cronRequestAuthorized` retorna `true` (sem auth).
- Risco real: (a) segredo-shape vazado no bundle/network; (b) se `CRON_SECRET` for esse literal,
  qualquer um dispara ciclos pagos (atendente/gerente/diretor → chamadas de LLM). Os runners
  (`app/api/ciclos/{atendente,gerente,diretor}/route.ts`) não fazem escopo de tenant.
- Ajuste: **não** disparar o runner cron a partir do browser. Criar um endpoint interno
  "executar ciclo agora" com `requireCrmGestor` + tenant, que chama o runner server-side com o
  `CRON_SECRET` real do ambiente (nunca exposto). Garantir que `CRON_SECRET` em prod NÃO seja
  o literal público e rotacioná-lo.

---

## 🟢 AJUSTES AUTÔNOMOS (baixo risco, alto valor)

### E-A1 — Carteira: API devolve `custo_brl` (margem interna) ao browser 🟢
- `app/api/crm/ia/creditos/route.ts:31-39` faz `select(... custo_brl ...)` e retorna no array `consumo`.
- A UI (`app/crm/creditos/page.tsx:13`) marca `custo_brl` como "NÃO exibir ao usuário — só Tijolos",
  mas o valor **viaja no payload** (visível no Network/devtools). Expõe custo real/margem do Hub ao fornecedor.
- Ajuste: remover `custo_brl` do `select` da rota de créditos (a tela só usa `creditos`). Baixo risco, fecha vazamento de margem.

### E-A2 — Busca de ciclos com cor de borda quebrada 🟢
- `app/crm/ciclos/page.tsx:919` — `border: "1px solidrgb(13, 13, 13)"` (falta espaço: `solid` + `rgb`),
  além de destoar do token verde dos outros inputs. CSS inválido → cai no default do browser.
- Ajuste: `border: "1px solid #293241"` (igual aos demais filtros da própria página).

### E-A3 — Copiloto (central) lê Supabase direto do client, sem filtro de tenant 🟢
- `app/crm/agentes-reais/page.tsx:37-42` — `supabase.from("hub_ia_consumo").select(...).like("origem","copiloto_%")`
  no client (anon key + RLS). Funciona, mas (a) depende de RLS por tenant estar ativa em `hub_ia_consumo`
  e (b) é o único da família que não passa por rota server tenant-scoped.
- Ajuste: trocar por uma rota server (ex.: reusar `/api/crm/ia/creditos`-style) com `requireCrmGestor` + `g.ctx.tenantId`. Coerência e defesa em profundidade.

### E-A4 — Texto do banner de "Configurações fixas" pode confundir 🟢 (cosmético)
- `app/crm/agentes/[slug]/page.tsx:1123` — diz "modelo são definidos na criação e não mudam",
  mas o sync Mistral e ferramentas mudam comportamento depois. Apenas refinar a cópia. Opcional.

---

## 🟡 DECISÕES PARA O DONO

### E-D1 — Propagar o padrão de tenant/guard às rotas-filhas (esforço × momento)
As correções E-B1..E-B9 são o **mesmo patch repetido** (guard `requireCrm*` + checar `tenant_id`
do agente, reusando `agenteForaDoTenant`). Decisão: fazer agora (antes do 2º tenant, recomendado —
casa com a memória "padrão tenant_id NULL leak") ou no lote de hardening multi-tenant já planejado.
Recomendo **fazer agora pelo menos os que destroem dados ou gastam dinheiro**: E-B1 (DELETE
memórias), E-B5 (mistral-sync), E-B6 (gerar-por-ia), E-B8 (sugestões IA), E-B10 (cron no browser).

### E-D2 — Carteira de Tijolos: ainda é só medição (sem compra) — confirmar que é o desejado agora
Não existe endpoint de **recarga/compra** de Tijolos (`grep` em `app/api` por `hub_ia_creditos_mov`/
`comprar` = 0 escritas além do débito do servidor). O saldo é 100% server-side
(`saldoCreditos` em `lib/ia/metering.ts:125`, `.eq('tenant_id')`), logo **não manipulável pelo
cliente** — bom. A tela mostra honestamente "Em modo de medição". Decisão do dono: a perna de
cobrança/compra entra quando? (Hoje a tela é honesta, não fachada.)

### E-D3 — Modelo de personalidade: 2 frases (wizard) × 5 eixos (editor) — divergência conhecida
`app/crm/agentes/[slug]/page.tsx` já trata isto com cuidado (BUG 1, linhas 230-236, 554-560):
preserva a personalidade do wizard e só regenera dos sliders se o dono mexer num eixo. Está
**correto e defensivo**, mas o dono deve saber que são dois formatos coexistindo. Decisão:
unificar um dia ou manter a ponte atual (recomendo manter — funciona e não perde dado).

---

## O que está BOM (registrar — não é fachada)

- **Auth core sólido** (`lib/crm/crm-api-auth.ts`): identidade vem do cookie httpOnly (JWT `sub`),
  tenant SEMPRE da sessão, header `x-caller-auth-id` ignorado quando há cookie. Hierarquia de
  papéis real (`requireCrmGestor/Owner/Sessao`).
- **Rotas-mãe de agente** (`agentes/route.ts`, `agentes/[slug]/route.ts`): guard + `agenteForaDoTenant`
  (404 cross-tenant) + tenant da sessão no insert. É o padrão-ouro a propagar.
- **Caminho do dinheiro server-side**: `saldoCreditos`/`registrarConsumoIA` tenant-scoped; saldo
  nunca enviado pelo cliente; sem endpoint de recarga = sem brecha de auto-crédito.
- **Precificação owner-only de verdade**: API `requireCrmOwner` (config + preços) e a tela esconde
  o painel de não-owner (`app/crm/precificacao/page.tsx:124`). É a única tela com R$ (margem) — correto.
- **Integrações**: API `requireCrmOwner` + `requireInternalApiKey`; só devolve **booleans** de
  presença de env (não vaza valores de chave). "Em breve" (Meta/Google/GA4) é honesto — features reais
  não construídas, não contradiz nada (o badge "Copiloto em breve" do tipo de nav NÃO está aplicado ao
  item Copiloto, que é live — a contradição apontada por auditoria anterior já foi resolvida).
- **Copiloto (escrita)**: `app/api/copiloto/executar/route.ts` — HMAC assinando ferramenta+params+ts+leadId
  (anti-replay/TTL), allowlist de ferramentas, tenant de `auth.tenantId` (não do body), e auditoria
  SEC-7 em `hub_decision_logs`. Arquitetura forte.
- **Segredos no browser**: `sanitizarAgenteHubParaCliente` remove `uazapi_instance_token`; chaves de IA
  ficam server-side. (Exceção: `custo_brl` em créditos — ver E-A1.)
- **Wizard**: sem mojibake (corrigido); fluxo 3 grupos/8 sub-passos com loading/disabled; "Gerar com IA"
  degrada com aviso amigável quando falta `MISTRAL_API_KEY` (espera-a-chave, não quebrado).
- **Mobile da ficha do agente**: abas (Config/Ferramentas/Atividade) para não rolar manutenção antes de
  config; `useNarrowViewport`. UX cuidada.
