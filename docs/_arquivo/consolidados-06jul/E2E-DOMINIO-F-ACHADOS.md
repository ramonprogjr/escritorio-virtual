# E2E — DOMÍNIO F: Tarefas + Aprovações (gate do dinheiro/escrow)

Auditoria read-only. Data: 2026-06-30. Régua: o melhor para o sistema — crítico, seguro, certeza.
Aprovações = GATE DO DINHEIRO (escrow, 2 chaves). Atenção redobrada na segurança.

## Arquivos auditados (reais)
- Telas: `app/crm/aprovacoes/page.tsx`, `app/crm/tarefas/page.tsx` (= "Próximas ações", caixa de ações de lead)
- Endpoints aprovações: `app/api/hub/aprovacoes/route.ts` (GET), `app/api/hub/aprovacoes/[id]/route.ts` (PATCH) — **caminho real da UI**
- Endpoints alternativos: `app/api/aprovacoes/route.ts` (GET), `app/api/aprovacoes/[id]/route.ts` (PATCH) — **NÃO usados pela UI**
- Tarefas: `app/api/crm/tarefas/route.ts` (só GET), `lib/crm/patch-lead-client.ts`
- Lib: `lib/ia/aprovacoes.ts` (gate dourado + cascata escrow)
- Auth/RBAC: `lib/crm/crm-api-auth.ts`, `lib/crm/crm-permissoes.ts`, `app/crm/layout.tsx`

## Veredito de integridade da lib (confirmação do F0/E6)
`lib/ia/aprovacoes.ts` SEGUE ÍNTEGRA/blindada:
- `buscarAprovacoesPendentes` fail-closed sem tenant → `[]` (l.166-167); `.eq("tenant_id")` (l.174).
- `aprovar`/`rejeitar`: rejeitam sem tenant (l.291-292, 343-344); `.eq("tenant_id")` no SELECT **e reaplicado no UPDATE** — defesa em profundidade (l.299-315, 354-366).
- Cascata do dinheiro (`executarAcaoAprovada`, l.455-513): RPCs `rpc_aprovar_orcamento_frente` / `rpc_liberar_escrow` recebem `p_tenant_id` da sessão (l.478-482, 503-506). Escrow só libera com AMBAS as chaves (RPC fail-closed). Snapshot de custo tolerante + agora logado p/ reconciliação (AUT-1/SEC-8, l.86-114).
- Log de decisão (`registrarDecisao`) sempre com `tenant_id`, tolerante à coluna ausente (l.22-32).
O caminho REAL da UI (`page.tsx → PATCH /api/hub/aprovacoes/[id] → aprovar()/rejeitar() da lib`) está tenant-seguro.

---

## 🔴 BLOQUEADORES

### F-B1 — `GET /api/aprovacoes` vaza a fila de aprovações de TODOS os tenants (sem auth, sem tenant)
`app/api/aprovacoes/route.ts:11-20` — endpoint público de fato: nenhum `getCallerContext`, nenhum
`requireInternalApiKey`, nenhum `.eq("tenant_id")`. Faz `select("*").eq("status","pendente")` sobre
`hub_aprovacoes` inteira via `service_role` (que bypassa RLS). Retorna descrições, motivos,
`valor_envolvido`, `lead_id`, `dados` de **todos os escritórios**. Além disso usa fallback
`SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` (l.7).
EVIDÊNCIA de exposição: é o gate do dinheiro — vazam valores de orçamento/pagamento entre escritórios.
A grep confirma que **nenhum .ts/.tsx chama essa rota** (a UI usa `/api/hub/aprovacoes`). É um
endpoint morto-mas-exposto: a superfície de ataque existe sem nenhum consumidor que justifique o risco.
**AJUSTE:** remover o arquivo `app/api/aprovacoes/route.ts` (caminho preferido, já que é dead code), ou —
se mantido — copiar o cabeçalho de `app/api/hub/aprovacoes/route.ts:12-31`: `getCallerContext` +
`.eq("tenant_id", ctx.tenantId)` + 503 sem service-role. Valor: impede leitura cross-tenant de valores financeiros.

### F-B2 — Quem aprova DINHEIRO não tem trava de papel no servidor (caminho real da UI)
`app/api/hub/aprovacoes/[id]/route.ts:15` usa apenas `getCallerContext` — que admite **qualquer
sessão CRM ativa, inclusive `atendente`** (não há `requireCrmGestor`). Esse é o endpoint que a tela
chama para `orcamento_frente`, `pagamento_obra_arq` e `pagamento_obra_hub` (as 2 chaves do escrow).
Contraste: o endpoint-irmão `app/api/aprovacoes/[id]/route.ts:16` exige `requireCrmGestor`. Ou seja, o
caminho que a UI realmente exercita tem o gate de papel MAIS FRACO que o caminho alternativo.
O guard de rota `/crm/aprovacoes` (min=gestor) existe só no cliente (`app/crm/layout.tsx:184-188`,
`router.replace`) e em `lib/crm/crm-permissoes.ts:175` — **não há middleware** (glob `middleware.ts`
= vazio). Logo, um `atendente` autenticado, com a `INTERNAL_API_KEY` que o front já injeta, consegue
`PATCH /api/hub/aprovacoes/{id} {status:"aprovado"}` e disparar a liberação de escrow.
**AJUSTE:** trocar `getCallerContext` por `requireCrmGestor` (ou um novo `requireCrmAprovador`) em
`app/api/hub/aprovacoes/[id]/route.ts`; idealmente diferenciar a chave Arq vs Hub por papel. Valor:
fecha a escalada de privilégio sobre o gate do dinheiro — hoje a única defesa é client-side, contornável.

### F-B3 — Sem idempotência / proteção contra dupla-aprovação (corrida no dinheiro)
`app/api/hub/aprovacoes/[id]/route.ts` e `lib/ia/aprovacoes.ts:aprovar()` fazem `UPDATE ... status='aprovado'`
**sem condicionar a `status='pendente'`** (l.306-315 da lib; l.54-58 do route). Duas chamadas concorrentes
(duplo clique, retry de rede, dois operadores) passam ambas pelo SELECT (que só checa existência, não
status), executam o UPDATE e **chamam a cascata `rpc_liberar_escrow` duas vezes**. A liberação de escrow
depende da idempotência da RPC (não auditável aqui) para não pagar/contabilizar em dobro. O `valor_envolvido`
e o snapshot de custo também podem ser re-registrados.
**AJUSTE:** no UPDATE, adicionar `.eq("status","pendente")` e checar `count`/linhas afetadas; se 0, retornar
"já processada" sem disparar cascata. Vale para os dois caminhos (route + lib). Valor: elimina pagamento/
contabilização duplicada por corrida — risco direto de dinheiro.

---

## 🟢 AJUSTES AUTÔNOMOS (ordenados por valor)

### F-A1 — `GET /api/aprovacoes` (lista) também é dead code exposto — remover junto com F-B1
Mesmo arquivo de F-B1. Confirmado sem consumidor. Remover elimina superfície. (Alto valor, baixo esforço.)

### F-A2 — Página de Aprovações não distingue o GATE DO DINHEIRO das aprovações comuns
`app/crm/aprovacoes/page.tsx` — o `TIPO_ICON`/`TIPO_BORDER` (l.40-51) **não cobrem** os tipos E6 do
dinheiro: `orcamento_frente`, `pagamento_obra_arq`, `pagamento_obra_hub`, nem `cotacao_fornecedor`.
Esses cards caem no fallback genérico (📌 + borda dourada, l.301/316). O gestor aprova um pagamento de
escrow com a MESMA aparência de um post de conteúdo. Não há rótulo "Chave 1/2 (Arquitetura)" vs
"Chave 2/2 (Hub)", nem aviso de que falta a outra chave. Para o JOB de aprovar dinheiro com confiança,
isso é cego.
**AJUSTE:** adicionar ícones/cores/labels para os 3 tipos E6 (ex.: 🔐 dourado forte), um badge "Gate de
pagamento — 2 chaves" e, quando `dados` indicar, "Aguardando a outra chave". Valor: clareza/confiança no
ponto mais sensível do produto.

### F-A3 — Aprovar dinheiro sem confirmação ("gate dourado" prometido não existe na tela)
`app/crm/aprovacoes/page.tsx:372-387` — o botão "✓ Aprovar" chama `aprovar(ap.id)` direto, **sem
modal/confirmação**, para TODO tipo, incluindo escrow. A memória do produto fala em "gate dourado de
confirmação"; na tela ele não existe. Um toque acidental no mobile libera pagamento.
**AJUSTE:** para os tipos E6 (`orcamento_frente`/`pagamento_obra_*`), exigir um passo de confirmação
(modal dourado "Confirmar liberação de R$ X — esta ação move dinheiro"). Demais tipos podem seguir 1-toque.
Valor: evita liberação acidental; materializa o "gate dourado".

### F-A4 — Realtime recarrega a fila inteira a cada evento (no-debounce) — não rompe, mas é frágil
`app/crm/aprovacoes/page.tsx:100-104` — subscription `postgres_changes event:"*"` chama `carregar()`
direto a cada mudança em `hub_aprovacoes`. Em pico, refaz o fetch sem debounce. Funciona, mas
desperdiça. **AJUSTE:** debounce ~400ms no handler. Valor: robustez sob carga.

### F-A5 — `valor_envolvido === 0` esconde o valor em vez de mostrar "R$ 0,00" / "sem valor"
`app/crm/aprovacoes/page.tsx:355-359` — `ap.valor_envolvido && ap.valor_envolvido > 0` renderiza vazio
quando 0. Para uma aprovação financeira de valor 0 (ou ainda não computado) o gestor não vê nada e não
sabe se é "grátis" ou "faltou dado". **AJUSTE:** mostrar "Sem valor informado" quando ausente e "R$ 0,00"
quando realmente zero. Valor: honestidade do dado financeiro.

### F-A6 — Página de Aprovações fora do design-system dark verde+dourado (paleta `C` clara)
`app/crm/aprovacoes/page.tsx:10-22` — usa `bg:#f7f4ec` (creme) e estilos inline próprios, divergindo do
restante do CRM (dark `#0a140f` + tokens `--obra-*`/`--brand-*`), que `app/crm/tarefas/page.tsx:190` segue.
Sem azul/roxo Shadcn (bom), mas é uma ilha visual clara dentro do app escuro. **AJUSTE:** alinhar à
identidade dark verde+dourado (decisão travada em memória). Valor: consistência de marca no gate do dinheiro.

### F-A7 — `app/api/crm/tarefas/route.ts` é só leitura: não há create/assign/conclude server-side
`app/api/crm/tarefas/route.ts:1-22` — só `GET` de `hub_tarefas_comerciais` (tabela tratada como opcional;
retorna `[]` se ausente). Não existe POST/PATCH/DELETE — **não há como criar/atribuir/concluir tarefa
comercial pela API**. A tela `app/crm/tarefas/page.tsx` na prática é a "Caixa de Próximas Ações" (deriva de
`vw_hub_leads_crm_enriquecido` + `proxima_acao` do lead) e "concluir" = limpar `proxima_acao` via
`patchLeadCrm` (l.150-169), o que é coerente. Mas o **gestor de tarefas universal** descrito na visão
(criar/atribuir/destinatário-aceita) NÃO existe como CRUD. Não é fachada quebrada (o que está, funciona),
porém o endpoint `hub_tarefas_comerciais` é um GET órfão sem origem de escrita. **AJUSTE (baixo/decisão):**
ou remover o GET órfão, ou implementar o CRUD. Sinalizado também como decisão (ver F-D1). Valor: evita
endpoint sem propósito + alinha expectativa.

### F-A8 — `GET /api/crm/tarefas` sem filtro de tenant
`app/api/crm/tarefas/route.ts:9-14` usa `crmDb()` (service_role) e seleciona `hub_tarefas_comerciais` sem
`.eq("tenant_id")` e sem `getCallerContext`. Hoje a tabela "não existe" (retorna `[]`), então é latente —
mas se/quando criada, vaza tarefas entre tenants pelo mesmo padrão do `tenant_id NULL leak`. **AJUSTE:**
adicionar `getCallerContext` + `.eq("tenant_id", ctx.tenantId)` antes de qualquer uso real da tabela.
Valor: previne o vazamento sistêmico já conhecido (padrão registrado em memória).

---

## 🟡 DECISÕES PARA O DONO

### F-D1 — Existe "gestor de tarefas universal"? Hoje só há "Próximas Ações" (derivado de lead)
A visão de produto fala em tarefas conectadas com criador/executor (humano OU agente)/destinatário-aceita.
O que existe é a Caixa de Próximas Ações (boa para o JOB do comercial) + um endpoint GET de
`hub_tarefas_comerciais` sem escrita. Decisão: (a) manter só Próximas Ações por ora e remover o GET órfão,
ou (b) priorizar o CRUD do gestor universal. Recomendação técnica: (a) agora, (b) no roadmap.

### F-D2 — As 2 chaves do escrow: quem é cada chave por PAPEL?
Hoje qualquer sessão (após corrigir F-B2 para gestor) poderia disparar tanto `pagamento_obra_arq` quanto
`pagamento_obra_hub`. O design ("aprovação dupla arquitetura+Hub") sugere que cada chave pertence a um
papel/entidade distinto. Decisão do dono: a chave "Arquitetura" deve exigir papel/usuário da Arquitetura e
a chave "Hub" papel do Hub? Isso vira regra de papel no endpoint (além de F-B2). Sem isso, "dupla" é só
"dois cliques", não "duas autoridades".

### F-D3 — Mobile: a tela de Aprovações é confiável no celular para o gestor decidir?
UX/mobile geral é sã (cards 1-col, botões `minHeight:44`, filtros com scroll-x, toasts, estados de
carregando/erro/vazio). Pontos de atenção que dependem de decisão: (1) sem confirmação no aprovar (F-A3);
(2) gate do dinheiro indistinto (F-A2). Para "aprovar dinheiro no celular com confiança", recomendo
condicionar F-A2 + F-A3 antes de tratar o fluxo de escrow como production-ready no mobile.

---

## Notas de Acessibilidade (transversal, não-bloqueador)
- `app/crm/aprovacoes/page.tsx`: botões Aprovar/Rejeitar sem `aria-label` explícito (texto visível ajuda);
  barra de confiança da IA (l.360-367) é puramente visual, sem `aria-label="IA 85%"`; ícones emoji sem
  `aria-hidden`/rótulo. Toast sem `role="status"`/`aria-live` (l.59-71) — leitor de tela não anuncia o resultado.
- `app/crm/tarefas/page.tsx`: melhor — usa `role="alert"` no erro (l.209) e `aria-hidden` nos ícones.
  Contraste dourado `#c9a24a` sobre dark ok; verifique `#7dd3c8`/`#8b949e` em textos pequenos.
- **AJUSTE sugerido (autônomo):** `aria-label` nos botões de ação, `aria-live="polite"` no Toast,
  `aria-hidden` nos emojis decorativos.

## Resumo de risco
- 3 BLOQUEADORES, todos no GATE DO DINHEIRO: (B1) leak cross-tenant de valores via rota órfã sem auth/tenant;
  (B2) aprovação de escrow sem trava de papel server-side no caminho real (só client-side guard);
  (B3) sem idempotência → corrida pode duplicar liberação de escrow.
- A lib `aprovacoes.ts` está blindada (F0/E6 confirmado); o furo está nas ROTAS/superfície ao redor dela e na TELA.
