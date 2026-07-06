# Auditoria E2E — DOMÍNIO G (Admin/Config)

> Régua-mãe: o melhor para o sistema — crítico, seguro (RBAC sensível), CERTEZA.
> Data: 2026-06-30 · Modo: READ-ONLY (nenhum código alterado).

## Telas e endpoints auditados
| Tela | Arquivo | Veredito |
|---|---|---|
| Usuários & Permissões (RBAC) | `app/crm/usuarios/page.tsx` (511L) | ✅ Sólido |
| Configurações (geral/IA) | `app/crm/configuracoes/page.tsx` (331L) | 🟡 endpoints fracos por trás |
| Onboarding tenant | `app/crm/onboarding-tenant/page.tsx` (121L) | ✅ Bem gated |
| Progresso sistema (tracker DEV) | `app/crm/progresso-sistema/page.tsx` (7L) + `components/crm/ProgressoSistemaDashboard.tsx` (950L) | 🔴 guard só client |
| Conteúdo | `app/crm/conteudo/page.tsx` (61L) | 🟡 stub vivo no menu |
| Contatos de notificação | `app/crm/contatos/page.tsx` (308L) | ✅ funcional, backend ok |
| API usuários | `app/api/crm/usuarios/route.ts` + `[id]/route.ts` | ✅ Excelente RBAC server |
| API tenant-settings | `app/api/crm/tenant-settings/route.ts` | 🟡 GET só key-gated |
| API contatos | `app/api/crm/contatos/route.ts` + `[id]` | ✅ gestor + tenant guard |
| API health | `app/api/health/route.ts` + `lib/crm/health-checks.ts` | 🟡 SEM auth (só booleans) |
| API followup-config | `app/api/hub/followup-config/route.ts` | 🔴 SEM auth nenhum |
| API onboarding/status | `app/api/crm/onboarding/status/route.ts` | ✅ owner-gated |

O núcleo RBAC (`lib/crm/crm-permissoes.ts`, `lib/crm/crm-api-auth.ts`) é maduro e correto: identidade vem do cookie httpOnly de sessão (não de header forjável), `requireCrmGestor/Owner` valida server-side, owners fixos (Ramon/Nice/Ariane) são intocáveis, "último owner" protegido, escalada de papel barrada (`crmPodeAtribuirRole` nunca devolve owner).

---

## 🔴 BLOQUEADORES

### G-B1 — `/api/hub/followup-config` SEM autenticação (read + write global)
- **Arquivo:** `app/api/crm/../hub/followup-config/route.ts` (GET 12-39, PATCH 41-67)
- **Problema:** GET e PATCH usam `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS) e **não chamam nenhum guard** — não há `requireInternalApiKey`, nem `requireCrmGestor`, nem cookie de sessão, nem tenant scoping. Qualquer pessoa na internet (sem login) pode `GET /api/hub/followup-config` para ler a cadência de follow-up e `PATCH` com `{updates:[{passo,mercado,horas_espera}]}` para **reescrever a cadência de follow-up de toda a plataforma**. A tela `configuracoes/page.tsx:94-119` trata isso como ação de admin, mas o endpoint está aberto. Tabela `hub_followup_config` é global (sem coluna tenant no filtro), então afeta todos os escritórios.
- **Evidência adversarial:** as outras rotas do domínio (tenant-settings, contatos, onboarding) todas chamam `requireCrm*`; esta é a única sem. Memória já registrou (#10603) o padrão de segredos/guards fracos nesse vizinho.
- **Ajuste (autônomo possível, mas é segurança → confirmar):** adicionar `requireCrmGestor(request)` no início de GET e PATCH (espelhando `tenant-settings/route.ts:38-40`). Idealmente escopar `hub_followup_config` por tenant.

### G-B2 — `/crm/progresso-sistema`: tracker interno de DEV protegido SÓ no client
- **Arquivos:** `app/crm/progresso-sistema/page.tsx` (renderiza incondicional), `app/crm/layout.tsx:183-188` (único guard: `useEffect` → `router.replace`), `lib/crm/crm-permissoes.ts:170` (minRole owner).
- **Problema:** A página expõe o roadmap interno completo (fases F0–F5, gaps P0, cadeia de valor, checklist de deploy, status do plano vs. código) e dados sensíveis de operação. O conteúdo é **dado estático no bundle JS** (`lib/crm/progresso-sistema-data.ts` + `-runtime.ts`, importado no componente client) — ou seja, vai para o navegador de **qualquer** usuário logado, independente do papel. O único bloqueio é um redirect client-side que (a) pisca o conteúdo antes de redirecionar, (b) não roda com JS desabilitado, (c) não impede ler o chunk JS direto. Não há `page.tsx` server-guard nem checagem de papel no componente.
- **Sub-achado:** `ProgressoSistemaDashboard.tsx:434` tem número de telefone real hard-coded (`https://wa.me/5511950864013` "WhatsApp Nice") e botão "Gerar PDF/Relatório do dia" que chama `/api/crm/relatorio-diario` — tracker de dono exposto na superfície do app de produção.
- **Ajuste:** mover o tracker para fora de `/crm` (ferramenta de build, fora do app de produto) OU adicionar guard server-side real (Server Component que checa papel via cookie e retorna 404 a não-owner) + lazy-load dos dados só após o guard. No mínimo, gate por `isOwner` dentro do componente para não montar nada antes da verificação.

---

## 🟡 DECISÕES DO DONO

### G-D1 — `/api/health` sem autenticação (divulgação de postura de segurança)
- **Arquivo:** `app/api/health/route.ts:4-6` + `lib/crm/health-checks.ts:24-39`
- **Problema:** GET público (sem key, sem sessão). NÃO vaza valores de segredo — só `name` + `configured: boolean`. Ainda assim revela a qualquer um quais segredos da plataforma existem/faltam (ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, WEBHOOK_SECRET, CRON_SECRET, INTERNAL_API_KEY, UAZAPI...). Útil para reconhecimento de atacante. `configuracoes/page.tsx:81` gateia a *exibição* por `isOwner`, mas o endpoint é aberto.
- **Decisão:** manter público (probe de uptime padrão) e devolver só `{status}` sem a lista de checks, OU exigir `requireCrmOwner` para o detalhe. Recomendo: health "raso" público + detalhe owner-only.

### G-D2 — `/crm/conteudo`: stub vivo no menu (fachada "Em breve")
- **Arquivo:** `app/crm/conteudo/page.tsx` (cards "Em desenvolvimento" + badge "Em breve").
- **Problema:** 100% placeholder, mas aparece na navegação. Memória (#7154) já apontou que badge "Em breve" contradiz módulos live. O dono vai querer decidir: esconder do menu até existir, ou manter como teaser. Não é bug, é decisão de produto/honestidade.
- **Decisão:** remover do nav (como foi feito com progresso-sistema) ou marcar claramente como roadmap.

### G-D3 — `tenant-settings` GET só key-gated (assimetria com PATCH)
- **Arquivo:** `app/api/crm/tenant-settings/route.ts:14-36`
- **Problema:** GET exige `requireInternalApiKey` mas NÃO `requireCrmGestor`, e resolve tenant via `tenantIdFromRequest` → cai no tenant default para o browser. PATCH (38-40) exige gestor. Baixa sensibilidade (horário comercial, flag de distribuição), mas inconsistente. Como a chave pública (`NEXT_PUBLIC_INTERNAL_API_KEY`) vai ao browser, qualquer sessão lê as settings do tenant default.
- **Decisão:** alinhar GET a `requireCrmGestor` + `g.ctx.tenantId` (como contatos), se quiser consistência. Risco real baixo.

---

## 🟢 AJUSTES AUTÔNOMOS (baixo risco, melhoria)

### G-A1 — `contatos` GET usa `tenantScopeOrFilter` (inclui `tenant_id.is.null`)
- **Arquivo:** `app/api/crm/contatos/route.ts:25` + `lib/tenant-default.ts:51-58`
- **Nota:** padrão conhecido (memória #9023, tenant-null-leak): registros legados com `tenant_id NULL` ou do tenant Obra10 padrão aparecem para todos os tenants. Para `hub_contatos_notificacao` (tabela nova, criada já com tenant_id — #10551), não deveria haver linhas NULL legadas, então o risco é teórico. O `[id]` PATCH/DELETE tem `tenantGuard` correto (404 cross-tenant). Sugestão: para tabelas NOVAS, usar `.eq("tenant_id", tid)` puro em vez do `.or(...is.null)`, conforme a regra de memória.

### G-A2 — Tipografia 10px e tabela em telas de trabalho (UX/mobile)
- **Arquivos:** `usuarios/page.tsx` (desktop usa `<table min-w-[640px]>` 343, badges `text-[10px]` 58); `ProgressoSistemaDashboard.tsx` (tabelas `min-w-[900px]` 916, muito texto 10px).
- **Nota:** `usuarios` JÁ tem branch mobile em cards (`isMobile` 268-340) — bom. As tabelas têm `overflow-x-auto`, então não há texto sobreposto, mas 10px é apertado no celular. `progresso-sistema` é denso, mas é tracker de dono (aceitável). Sem bug funcional.

### G-A3 — `contatos/page.tsx` usa hex inline fora de token, mas dentro da paleta
- **Arquivo:** `app/crm/contatos/page.tsx` (todo o estilo é inline `#0a140f`/`#c9a24a`/`#34d399`). Cores estão na identidade Obra10 (verde+dourado), sem azul/roxo Shadcn — OK de marca. Melhoria opcional: migrar para tokens `--obra-*`/classes Tailwind como as outras telas.

---

## Funcionalidade E2E — confirmações positivas
- **Usuários:** convidar (POST), trocar papel (PATCH role), ativar/desativar (PATCH status) — todos com fluxo completo UI→API→DB, toast, confirmação para desativar. RBAC client (`crmPodeEditarPapelUtilizador`, `crmPodeAlterarStatusUtilizador`) espelha o server. Owner pode convidar em outro tenant (select de empresas) com validação server (`usuarios/route.ts:75-95`). **Sem botão morto.**
- **Configurações:** horário, distribuição e follow-up salvam (PATCH reais). Bloco "Ambiente" só monta para owner (`configuracoes/page.tsx:76-92, 165`).
- **Contatos:** CRUD completo (criar/editar/toggle/remover) com máscara de telefone e validação. Backend gestor + tenant guard.
- **Onboarding:** checklist vivo, owner-gated server-side, links "Configurar" funcionais.

## Veredito de segurança RBAC (o ponto mais sensível do domínio)
A gestão de usuários/papéis está **bem feita**: server-side autoritativo, identidade não-forjável, escalada de papel impossível, cross-tenant barrado (`usuarios/[id]/route.ts:81-86`). Os furos NÃO estão no RBAC de usuários — estão em **dois endpoints auxiliares sem guard** (G-B1 followup-config crítico, G-D1 health) e num **tracker de DEV protegido só no client** (G-B2). Priorizar G-B1 (escrita global não autenticada) e G-B2 (vazamento de roadmap interno).
