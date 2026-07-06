# 🤝 HANDOFF COMPLETO — Obra10+ (fim da sessão 26/jun/2026 → próxima sessão)

> **Leia ESTE doc primeiro — ele dá TODO o contexto.** Complementares: [PLANO-MACRO-CONCLUSAO.md](PLANO-MACRO-CONCLUSAO.md) (tracker vivo) · [AUDITORIA-47-TELAS.md](AUDITORIA-47-TELAS.md) (auditoria detalhada). A memória em `~/.claude` carrega sozinha.
>
> **Para retomar 100%, diga:** *"leia docs/HANDOFF-PROXIMA-SESSAO.md e seguimos"*.

---

## 1. O PRODUTO (visão do dono)

**Obra10+** = plataforma **multi-tenant, IA-first**, de construção (CRM + Hub). Visão: o **Hub** capta e **distribui leads** para **fornecedores/membros** (empresas homologadas); cada membro **VENDE** (CRM próprio) e **EXECUTA** (obra/projeto) dentro do sistema; o Hub tem **governança completa** (KPIs, SLAs, cobrança pela IA).

**Princípios inegociáveis do Wendel:**
- **Funcional, não fachada** — clientes VÃO usar de verdade; nada de botão morto/mock/"em breve" passando por pronto.
- **Click-and-Go** — preencher = ESCOLHER e CONFIRMAR; mínimo de cliques; IA-first conversacional; voz no fim.
- **Tabela ≠ tela de trabalho** — tabela = relatório (vive em `/crm/relatorios`); telas devem ser acionáveis pro JOB do negócio.
- **Design system:** dark **verde #003b26 + dourado #c9a24a**, tokens `--obra-*`/`--brand-*` em globals.css. **NÃO** usar azul/Shadcn do CLAUDE.md global.
- **CEO de produto:** o Code propõe COMO as telas devem ser (revolução com prudência: aditivo, preserva lógica, gates, mesa redonda).

**Modelo-alvo:** lead / pessoa / empresa / negócio SEPARADOS; **negócio é o centro**; fornecedor = classificação, homologado = status, parceiro NÃO é entidade; **código único (CPF/CNPJ) = chave de dedup**. Monetização: assinatura SaaS + comissionamento transacional com split por código único.

---

## 2. ONDE PARAMOS / PANORAMA (barômetro)

🟢 Núcleo apresentável **~97%** · 🟢 Segurança **~93%** · 🔵 Visão completa B0–B8 **~85%** · 🚀 **PRODUÇÃO NO AR.**

O sistema está **maduro e demonstrável**. Nesta sessão (uma maratona) saíram: motor de distribuição completo, auditor IA + cobrança, multi-tenant REAL, auditoria de 47 telas + P0 corrigido, e **deploy em produção** que o dono já pode mostrar no celular.

---

## 3. NO AR / COMO DEPLOYA

- **URL de produção:** **https://escritorio-virtual-1.onrender.com** (Render, plano *starter* → **cold start ~30-60s** na 1ª abertura; depois rápido).
- **Login do app:** `nice.engemp@gmail.com` (dono = papel OWNER).
- **Mecânica do deploy:** push na branch **`feature/escritorio-visual`** (= produção) do repo **`ramonprogjr/escritorio-virtual`** → **Render auto-deploya**. *(Conta Render = Ramon `ramonexercito@gmail.com`, login via Google/GitHub — não e-mail/senha; não consegui logar por senha, e o deploy não precisa disso.)*
- **Branch de trabalho:** `wendel/dev` (tudo commitado + empurrado). Produção é **fast-forward** de wendel/dev.
- **Gate de build:** `npm run build` (= `verify:progresso` + `next build`) — passou. Gate local de dev: `tsc --noEmit` + `npx vitest run` (**183/183**).
- **Supabase:** projeto `cdjlqsznerdhwqyunodl`. Env no Render (`sync:false` = secrets no dashboard). Worker WhatsApp + cron dispatch-ciclos no `render.yaml`.
- **Próximo deploy combinado: DOMINGO** (levar P1/P2 junto).

---

## 4. O QUE FOI ENTREGUE (e está LIVE)

### Motor de distribuição (keystone) — completo + verificado clicando
- **F1** painel "Quem deve receber este lead?" — 5 fornecedores rankeados (score de aderência) + encaminhar 1-toque.
- **Esteira** — ao FECHAR negócio (etapa→ganho) gera a entrega automática na área certa, **UMA TABELA POR ÁREA** (`hub_obras/hub_projetos/hub_marcenaria/hub_marmoraria/hub_vidracaria/hub_servicos`).
- **F2** `hub_eventos` (event log keystone). **F4** painel "Atividade da rede" (controle do Hub).
- **F3** gate financeiro (bloqueado não recebe + sinaliza) + **flywheel IAH** (pendência rebaixa ranking) + liberação pelo Hub.
- **F2b** cascata de rejeição (recusar → oferta ao próximo elegível).
- **C.1** Auditoria da rede (KPIs) + **scorecards por fornecedor** (aderência + Liberar/Cobrar) + **agente auditor AUTÔNOMO** (`/api/crm/distribuicao/auditor`, cron, cobra sozinho com idempotência 12h).
- **C.2a** sino de notificações no header (deriva `hub_eventos`).

### Multi-tenant REAL (a maior trava) — flipado + isolamento PROVADO
- `users.tenant_id` + `current_user_tenant_id()` dinâmica (`SECURITY DEFINER` + fallback). As ~36 tabelas já tinham RLS tenant-scoped (Bloco E) → só faltava ligar a fonte real. **Isolamento provado** (membro de outro tenant vê **0** leads). **Tenant-scoping no APP** nas 5 rotas que liam tudo (leads/negocios/eventos/notificacoes/metricas). Migração: `supabase/migrations/20260626130000_multitenant_foundation.sql`.

### Auditoria de 47 telas + P0 corrigido (esta sessão)
- Workflow multi-agente (mesa redonda por tela + verificação adversarial). Média **6.8/10**; **36 reais, 8 parciais, 3 stubs**. Relatório: `docs/AUDITORIA-47-TELAS.md`.
- **P0 100% corrigido e LIVE:**
  - **Segurança (8 rotas guard+tenant):** negocios/[id]/nota, especialistas/[id], atendimento/mensagens, pedidos, imoveis/[id], parceiros/[id]/modulo, relatorios/export (CSV vazava dados de qualquer tenant).
  - **Fachada:** botão Ligar (leads) ligado ao tel:; loading infinito (empresas) corrigido; aba Registros morta (cadastro) removida.
  - **UX:** Perdido com seletor de **motivo** (`MOTIVOS_PERDA`) + confirmação (chip e botão).

### Outros desta sessão
- Auditor de consistência (início) → **5 críticos corrigidos** (incl. bug silencioso da esteira).
- Nav renomeada (**Operações / Arquitetura / Engenharia**). Vínculos N:N pessoa↔empresa **securizados** (já existiam). Cadastros dedup por CPF/CNPJ **verificado** (já sólido). Onboarding de membro: o dono confirmou que **já está pronto**.

---

## 5. O QUE FALTA (fila — nada perdido)

### P1 — UX ✅ COMPLETO (sessão 2 de 26/jun, na `wendel/dev`)
- ✅ **Toasts** nas escritas silenciosas — store global + `<ToastViewport/>` no root; ligado em pessoas/[id], empresas/[id], empresas (criar), negocios/[id]. *(`91cb799`)*
- ✅ **Mover etapa no mobile** (negócios) — botão "Mover etapa" no card abre bottom-sheet de etapas (Click-and-Go); `alert()`→toast. *(`6c9695d`)*
- ✅ **Ações por linha** no `/crm/empresas` — Ativar/Desativar tenant (owner-only) + novo `PATCH /api/crm/tenants/[id]`. *(`687e653`)*
- ✅ **Seletor na distribuição** — fim do slug/ID cru; novo `GET /api/crm/distribuicao/destinos` popula agentes (slug) e parceiros (id). *(`0052edd`)*

Todos com gate `tsc + vitest(183)` e verificados clicando (Playwright). Próximo foco: **P2**.

### P2 — Design/polish
- ✅ **Scrollbar invisível CORRIGIDA** (`3f64337`) — era 3px transparente; o dono não via que as telas rolavam (relato: "itens que não se veem, sem barra, só com zoom out"). Agora 10px dourada visível. Auditoria de scroll em 5+ telas: **zero clippers**, arquitetura OK. *(memória: [[scrollbar-visivel-decisao]])*
- ✅ **`/crm/trafego` filtro de período** (`4d6f4ce`) — era fachada (backend fixava 7d); agora respeita 7d/14d/30d.
- ⚠️ **Sweep de tokenização — REAVALIADO:** os hex "GitHub-dark" (`#0d1117`/`#161b22`/`#30363d`) **já são os valores dos tokens** `--obra-dark*` (sem diferença visual) e os azuis (`#3b82f6`) são **semânticos** (status de pipeline, info, venda×locação). Um find-replace cego quebraria o código de cores por zero ganho. **Não é a inconsistência nº1** (essa era a scrollbar). Tratar caso a caso só onde houver azul como CTA/ativo off-brand de verdade.
- Resta: máscaras CPF/telefone (CPF/CNPJ/CEP já existem; falta telefone) · render otimista no atendimento (tela 9.0). *(mojibake do AgenteNovoWizard já estava OK — 0 ocorrências.)*

### Debug
- Visual **mobile + desktop**, tela por tela.

### ⏸️ DEFERIDO — aguarda DADOS do dono
- **Gestão de Obra / Engenharia / Arquitetura** (módulo de EXECUÇÃO — as menores notas: obras 5.5, obra/[id] **3.5**, projetos 5.5). O dono vai **trazer dados** sobre como deve ser. **Só isso fica pra depois; o resto = "CEO aprova, prossiga".**

### Visão maior (registrado, pós-CRM)
- Onboarding de membro USÁVEL (criar `hub_tenants` + `users` com tenant do membro → membro loga e vê só o dele). · Canais de notificação ao membro (WhatsApp/email/push). · Faxina das ~26 policies `always_true` (authenticated-only intencionais — não furo anon; refinamento). · Totem/iFood de materiais (com SPREAD). · Migração membro elegível → fornecedor. · Monetização (split por código único).

---

## 6. PRÓXIMOS PASSOS (imediato)
1. **Se o dono trouxer os dados de Engenharia/Arquitetura** → construir a gestão de obra (o módulo de execução).
2. **Senão** → atacar **P1/P2 com foco** (pro deploy de domingo), começando pelo que aparece na demo.
3. Sempre: **gate (tsc + vitest) + verificar clicando + commit na `wendel/dev`**; deploy de domingo = fast-forward `wendel/dev` → `feature/escritorio-visual`.

---

## 7. CONTEXTO TÉCNICO-CHAVE
- **Stack:** Next.js 16 (App Router) + Supabase. Dev: `npm run dev` (porta **3001**, via `scripts/dev-insecure-tls.cjs`).
- **Auth de API:** `requireCrmSessao/Comercial/Gestor/Financeiro(request)` → `{ ctx: { authId, userId, role, status, tenantId } } | { error }`. `crmDb()` usa **SERVICE_ROLE (bypassa RLS)** → **rotas DEVEM filtrar por `g.ctx.tenantId`** (RLS é só backstop).
- **Padrão tenant null-safe:** buscar por id → 404 se `tenant_id` setado e ≠ ctx (preserva linhas legadas com tenant null). Helper `tenantScopeOrFilter(tenantId)` p/ SELECT em lista.
- **Keystone:** `hub_eventos` (append-only; `registrarEvento` best-effort). Sino + auditor + métricas derivam dele.
- **Gates:** `tsc --noEmit` + `npx vitest run` (**183/183**). tsconfig strict, **sem** noUnusedLocals.
- **Risco recorrente — schema drift:** CHECK constraints (`hub_atividades.tipo` só aceita `mensagem|ligacao|email|reuniao|nota|proposta|follow_up|status_change|ia_acao`; `feito_por_tipo` só `humano|ia`). Inserir valor fora disso quebra **silencioso**. **Verificar coluna/constraint via Supabase MCP antes de inserir/selecionar.**
- **Dev server:** Fast Refresh degrada em sessão longa → se a UI vier "stale", reiniciar limpo (matar porta 3001 + `rm -rf .next` + `npm run dev`).

---

## 8. TRAVAS / REGRAS PERMANENTES
- **Aditivo** (migrações aditivas) · preserva lógica · backups reversíveis · gates sempre · **verificável clicando**.
- **Mesa redonda** de especialistas + **foco UI/UX** (Click-and-Go) em cada tela.
- **NUNCA** salvar senhas/tokens/secrets na memória nem no Git.
- **Push só com autorização** (foi autorizado p/ o deploy desta sessão; produção feita).
- **Parar só** em: irreversível-sem-rollback, exclusão em massa, credenciais, alteração sensível em produção, custo. (Multi-tenant RLS = sempre supervisionado.)
- Trabalhar **só no projeto `-ramon`**.

---

## 9. COMMITS-CHAVE DESTA SESSÃO (branch wendel/dev = produção)
`fb95d73` C.1b scorecards · `42f6867` C.1c auditor autônomo · `4d8ffa8` multi-tenant fundação · `e36aaf4` tenant-scoping no app · `9865cbd` auditor consistência (5 críticos) · `91dfc60` P0 segurança (8 rotas) · `58744c3` P0 fachada · `1716e41` Perdido com motivo · `3236ec6` handoff. Produção: `7b543f2` (feature/escritorio-visual).

---

*Fim da sessão de 26/jun/2026. Sistema auditado, blindado e no ar. Próxima sessão: puxar o fio por aqui.* 🚀
