# Auditoria E2E — DOMÍNIO H (Auth / Público / Portais) — Foco SEGURANÇA

Data: 2026-06-30 · Modo: READ-ONLY (nenhum código alterado) · Régua: o melhor para o sistema, com EVIDÊNCIA arquivo:linha.

Escopo auditado (arquivos lidos na íntegra):
- Telas: `app/login/page.tsx`, `app/cadastre-se/{page.tsx,actions.ts}`, `app/redefinir-senha/page.tsx`, `app/parceiro/{page.tsx,cadastro/[token]/page.tsx,dashboard/page.tsx}`, `app/fornecedor/{page.tsx,cotacao/page.tsx}`, `app/especialista/cadastro/page.tsx`, `app/office/page.tsx`
- Endpoints: `app/api/auth/crm-session/route.ts`, `app/api/parceiro/cadastro-publico/route.ts`, `app/api/parceiros/portal/verify/route.ts`, `app/api/parceiros/[id]/portal-link/route.ts`, `app/api/public/{especialista,lead-hub,cadastro-empresa}/route.ts`, `app/api/cotacoes/pedidos/{route.ts,[id]/route.ts}`
- Núcleo: `proxy.ts`, `lib/internal-api-headers.ts`, `lib/internal-api-auth.ts`, `lib/parceiro-portal.ts`, `lib/portal-rate-limit.ts`, `lib/tenant-default.ts`, `lib/crm/supabase-server.ts`, `lib/crm/parceiro-link-publico.ts`, `lib/crm/lead-hub-publico.ts`

---

## Modelo de auth (resumo factual — base das conclusões)

`proxy.ts` é o ÚNICO gate para `/api/**` (matcher `/api/:path*`, linha 134):
1. Rotas em `isPublicApiPath()` (linhas 10-21) passam sem auth: `/api/whatsapp`, `/api/health`, **`/api/public/`** (com barra), `/api/parceiros/portal/verify`, `/api/validar/`, `/api/ciclos/`, `/api/cron/`, `/api/ml/ciclo`, `/api/auth/crm-session`.
2. Senão: passa se `x-api-key === INTERNAL_API_KEY` (linha 101) **OU** se há sessão CRM por cookie (linha 105).

Fato-chave de segurança: `lib/internal-api-headers.ts:7-10` envia ao browser `NEXT_PUBLIC_INTERNAL_API_KEY`, que por contrato é "o MESMO valor que `INTERNAL_API_KEY`" (`README.md:40`, `.env.example:13`, `docs/crm-operacional-checklist.md:6`). Ou seja: **a chave do gate é pública** — qualquer pessoa que abrir uma tela que use `internalApiHeaders()` lê a chave no bundle JS e passa o gate em QUALQUER rota `/api/**` não-pública. Já documentado como risco latente em `docs/_rumo-memoria/multitenant-golive-plano.md:14`.

`crmDb()` (`lib/crm/supabase-server.ts:3-8`) e os `db()` locais usam **service-role** (`SUPABASE_SERVICE_ROLE_KEY`), que **bypassa RLS**. Logo, qualquer endpoint sem guard próprio depende 100% do proxy + de filtro `tenant_id` no código.

---

## 🔴 BLOQUEADORES DE SEGURANÇA

### H-SEC-1 — `/api/cotacoes/**` sem auth de handler + sem rate-limit; chave do gate é pública → leitura/escrita anônima com service-role
- Evidência:
  - `app/api/cotacoes/pedidos/route.ts:12-22` — `GET` lista os 50 pedidos mais recentes via service-role. **Zero** verificação de sessão/chave/tenant no handler.
  - `app/api/cotacoes/pedidos/[id]/route.ts:11-35` — `GET` por id devolve `select("*")` do pedido **e** todas as respostas (`hub_cotacoes_respostas`), service-role, sem checar a quem o pedido pertence.
  - `app/api/cotacoes/pedidos/route.ts:24-52` — `POST` grava pedido com `tenant_id: defaultTenantId()` fixo, sem auth de handler.
  - `app/fornecedor/cotacao/page.tsx:36,51,62,85,103,115` — a tela chama esses endpoints com `internalApiHeaders()`, ou seja, **embarca a chave pública** no cliente.
  - Gate: `proxy.ts:101` aceita `x-api-key === INTERNAL_API_KEY`; chave exposta via `lib/internal-api-headers.ts:9`.
- Problema: como a chave vai ao browser, um usuário anônimo qualquer extrai `NEXT_PUBLIC_INTERNAL_API_KEY` do bundle e chama `GET/POST /api/cotacoes/**` (e qualquer outra rota interna não-pública) com poderes de service-role. Vaza cotações/valores/fornecedores entre clientes e permite criar/poluir pedidos. Sem rate-limit (diferente das rotas `/api/public/*`). Em multi-tenant isso é vazamento cross-tenant direto.
- Ajuste concreto (autônomo possível em camada aditiva): adicionar guard de SESSÃO no handler de cada rota `/api/cotacoes/**` (derivar `tenantId` do contexto da sessão, ex.: `requireCrm*`/`getCallerContext`, como recomenda `lib/tenant-default.ts:64-69`) e filtrar `.eq("tenant_id", ctx.tenantId)` em todo `select`. Acrescentar `checkPortalVerifyRateLimit` por IP no `POST`. Estratégico (dono): a correção de raiz é **parar de mandar `INTERNAL_API_KEY` ao browser** — telas internas devem usar a sessão por cookie (o proxy já aceita cookie na linha 105), reservando a chave só para cron/worker server-to-server.

### H-SEC-2 — Cadastro de parceiro: token-mestre HARDCODED `"rede"` + endpoint sem rate-limit
- Evidência:
  - `lib/crm/parceiro-link-publico.ts:2` — `export const PARCEIRO_LINK_TOKEN_REDE = "rede";` (string literal, embarcada no client).
  - `app/parceiro/cadastro/[token]/page.tsx:61-65` — se `token === "rede"`, **pula a consulta ao DB** (`hub_links_cadastro`) e libera o formulário direto.
  - `app/api/parceiro/cadastro-publico/route.ts:40-169` — handler **sem rate-limit** e **sem validação do token**; valida só nome+telefone (linha 67) e grava parceiro com service-role e `tenant_id` default (linha 42, 134).
- Problema: o "link da rede" é um token público adivinhável (`/parceiro/cadastro/rede`). Qualquer um cadastra parceiros à vontade; o endpoint não exige token nenhum, então também é chamável direto. Sem rate-limit → spam/inflação de `hub_parceiros` e dos logs. Não é injeção de SQL (PostgREST parametriza), mas é **abuso/poluição de dados** real e DoS lógico de cadastro.
- Ajuste concreto: (a) trocar o token fixo por um token assinado/curto-prazo por convite OU manter o link de rede mas **adicionar rate-limit por IP** (`checkPortalVerifyRateLimit('parceiro-signup:'+ip, 5, 15*60_000)`) e CAPTCHA/honeypot no `POST`; (b) marcar o registro como `status:"captacao"` pendente (já faz, linha 133) — manter. Decisão se o link público de rede é intencional é do dono (ver 🟡 H-DON-1).

---

## 🟢 AJUSTES AUTÔNOMOS (bug / UX / consistência / segurança aditiva)

### H-FUN-1 — Form público de parceiro provavelmente QUEBRADO para anônimo (proxy bloqueia o endpoint)
- Evidência: a tela anônima `app/parceiro/cadastro/[token]/page.tsx:122` faz `fetch("/api/parceiro/cadastro-publico")` **sem** `internalApiHeaders()` (sem `x-api-key`) e sem cookie. Mas `/api/parceiro/cadastro-publico` (singular "parceiro") **NÃO** está em `isPublicApiPath` — esta só libera `/api/public/` (com barra) e `/api/parceiros/portal/verify` (`proxy.ts:13-14`). O matcher cobre `/api/:path*` (`proxy.ts:134`).
- Problema: para um visitante anônimo (sem sessão, sem chave), o proxy responde 401 em `proxy.ts:120` ANTES do handler. Em produção, se `INTERNAL_API_KEY` estiver definida, o cadastro de parceiro **falha** com "Acesso negado" para o público-alvo. (Só "funciona" se a chave estiver indefinida no servidor — `proxy.ts:109` — o que por sua vez derruba o resto do gate.) Isto é uma fachada que não grava E2E para o usuário real.
- Ajuste: adicionar `if (pathname === "/api/parceiro/cadastro-publico") return true;` em `isPublicApiPath()` (`proxy.ts`), e então aplicar o rate-limit do H-SEC-2 no próprio handler (já que ele passa a ser público). Confirmar manualmente em incógnito antes de fechar.

### H-FUN-2 — `gerarCodigoParceiro` / código de especialista por `count(*)+1`: corrida e colisão
- Evidência: `app/api/public/especialista/route.ts:66-67` gera `ESP-${ano}-${count+1}`; o cadastro de parceiro usa `gerarCodigoParceiro(supabase)` (`route.ts:118`).
- Problema: contagem + incremento em app, sem unicidade transacional, sob concorrência gera o mesmo código (e o insert pode colidir/duplicar dependendo da constraint). Em endpoint público isso é fácil de disparar.
- Ajuste: gerar o código via sequência/`DEFAULT` no Postgres (migração aditiva, **somente via Supabase MCP** `apply_migration`) ou `UNIQUE` + retry no insert. Não tocar `hub_*`/`public` fora do schema autorizado nem aplicar SQL fora do MCP.

### H-SEC-3 — `cadastrado_por` (atribuição) aceito de fonte não autenticada (`por` na query)
- Evidência: `app/especialista/cadastro/page.tsx:15,44` lê `?por=` e envia; `app/api/public/especialista/route.ts:50-51,81` grava `cadastrado_por = por` se for UUID, sem provar que o convidador realmente convidou.
- Problema: qualquer um forja a atribuição "mão de obra de quem" colocando um UUID arbitrário. Baixo impacto hoje (single-tenant), mas falsifica rastreio/comissão futura.
- Ajuste: assinar o `por` no link (HMAC, como o portal do parceiro já faz em `lib/parceiro-portal.ts`) e validar no endpoint; sem assinatura válida, gravar `cadastrado_por = null`.

### H-SEC-4 — Rate-limit em memória não cobre serverless multi-instância
- Evidência: `lib/portal-rate-limit.ts:5` usa `Map` em memória de processo; comentário admite "melhor em instância única".
- Problema: em Vercel/Render com múltiplas instâncias o limite é por instância — atacante distribui e fura. Vale para `portal/verify`, `especialista`, `lead-hub`, `cadastro-empresa`.
- Ajuste: mover o contador para store compartilhado (Redis/Upstash) ou rate-limit na borda. Aditivo, sem quebrar a API atual.

### H-UX-1 — PT-PT residual nas telas de portal público
- Evidência: `app/parceiro/cadastro/[token]/page.tsx:341` "como vai **actuar** na rede"; mensagens em `app/api/auth/crm-session/route.ts:43-44,60-62` usam "contactar/utilizador" (PT-PT). Padrão do produto é PT-BR.
- Ajuste: "actuar"→"atuar"; "contactar"→"contatar"; "utilizador"→"usuário". Aditivo, só texto.

### H-A11Y-1 — Inputs dos portais públicos sem `<label htmlFor>` associado (especialista/cotação)
- Evidência: `app/especialista/cadastro/page.tsx:72-83` usa só `placeholder` como rótulo (sem `<label>`/`aria-label`); `app/fornecedor/cotacao/page.tsx:138-201` idem (placeholder-only).
- Problema: leitor de tela não anuncia o campo; placeholder some ao digitar. A tela do parceiro (`[token]/page.tsx`) faz certo (tem `<label>`), então é inconsistência.
- Ajuste: adicionar `<label htmlFor>` ou `aria-label` em cada input. (Contraste e marca verde+dourado dark estão OK; tokens `--obra-*` usados no login/redefinir.)

---

## 🟡 DECISÕES PARA O DONO

### H-DON-1 — Link público de rede para cadastro de parceiro é intencional?
O token `"rede"` é, por design, um único link reutilizável para "todos os parceiros da rede" (`lib/crm/parceiro-link-publico.ts:1`). Se intencional, aceitar o cadastro aberto mas blindar com rate-limit + CAPTCHA (H-SEC-2) e manter tudo como `captacao` pendente de homologação. Se NÃO intencional, migrar para tokens de convite assinados por destinatário.

### H-DON-2 — Política de signup público de empresa (multi-tenant)
`app/api/public/cadastro-empresa/route.ts:18-24` cria TENANT via flag `publicSignupEnabled()`. Confirmar se o auto-provisionamento de tenant fica ligado em produção ou se passa a ser convite-only antes do 2º login real (alinhado ao plano de go-live multi-tenant).

### H-DON-3 — Parar de expor `INTERNAL_API_KEY` ao browser (raiz de H-SEC-1)
Decisão arquitetural: telas internas (cotação etc.) devem autenticar por SESSÃO (cookie) em vez de `NEXT_PUBLIC_INTERNAL_API_KEY`. Já é viável (proxy aceita cookie, `proxy.ts:105`). É a correção de raiz que fecha H-SEC-1 e o furo de `x-tenant-id` forjável (`lib/tenant-default.ts` já blindou o caminho cron, mas a chave pública contorna o gate). Mudança de médio porte → alinhar com o dono.

---

## O que está BOM (não mexer)

- `app/login/page.tsx` e `app/redefinir-senha/page.tsx`: mensagens neutras anti-enumeração (linhas 176-184 do login), erro de auth traduzido sem vazar técnico (`traduzirErroAuth`), token de recovery removido do hash da URL (`redefinir-senha:35-39`), senha mín. 8, cookie `httpOnly`+`secure`+`sameSite=lax` (`crm-session:73-79`). Marca Obra10+ (tokens `--obra-*`) aplicada.
- Portal do parceiro: assinatura HMAC-SHA256 com `crypto.timingSafeEqual` (`lib/parceiro-portal.ts:12-19`) e rate-limit por IP em `portal/verify` (`route.ts:21-32`). HMAC é forte; ressalva única: sem expiração na assinatura (token não rotaciona) e segredo cai em `"obra10plus_dev_only"` se `PORTAL_HMAC_SECRET`/`CRON_SECRET` faltarem — garantir os secrets em produção.
- `/api/public/{lead-hub,cadastro-empresa,especialista}`: rate-limit + validação de input + (no signup) feature-flag. Bom padrão — replicar nos endpoints de cotação/parceiro.
- `lib/tenant-default.ts:70-87`: `tenantIdFromRequest` já rejeita `x-tenant-id` forjável sem a chave interna (blindagem aplicada em 28/jun).
