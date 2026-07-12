# PRD BACKEND (TestSprite) - Obra10+/Escritorio Virtual

> PRD de BACKEND para geracao de testes (TestSprite). 275 endpoints reais documentados (metodo, auth/permissao, proposito, regras, casos de teste) lidos do codigo em 12/jul/2026. Atual por construcao.

# PRD de Backend — Obra10+ / Escritório Virtual (Hub/CRM IA-first)

## 1. O produto

Obra10+ (repo `escritorio-virtual-ramon`) é um Hub/CRM **IA-first** para o mercado de construção civil / imobiliário. Um **Hub** central capta leads (site, WhatsApp, parceiros), qualifica com agentes de IA (atendimento "Mari", copiloto de voz, ciclos de diretor/gerente/atendente IA) e **distribui** para fornecedores/parceiros da rede. Sobre a mesma coluna vertebral rodam os módulos verticais: **CRM** (leads → negócios → propostas), **Cadastros** (pessoas, empresas, fornecedores, especialistas, imóveis, catálogo/serviços), **Obras/Projetos/Arquitetura** (EAP, cronograma, escopo, estoque, restrições), **Compras** (Solicitação de Compra da obra → cotações de fornecedor → gate humano de aprovação), **Financeiro** (contas a pagar/receber, motor de comissões da rede, escrow com dupla chave) e **Agentes/IA** (playbooks, autonomia, ferramentas custom, aprovações).

- **Stack**: Next.js 16 (App Router) + Supabase (Postgres + Auth). Backend = **205 route handlers** em `app/api/**/route.ts`.
- **Formato de resposta**: JSON. Sucesso geralmente `{ data }`, `{ ok: true, ... }` ou o objeto direto; erro `{ error: "mensagem" }` (algumas rotas de compras/obras usam a chave `{ erro }` em pt-BR). Status usados: `400` validação, `401` sem sessão/chave, `403` sem permissão ou conta inativa, `404` não encontrado (inclui recurso de outro tenant), `409` conflito de estado, `429` rate limit (com `Retry-After`), `500` erro interno, `502` falha ao contatar o Supabase, `503` serviço não configurado (ex.: `SUPABASE_SERVICE_ROLE_KEY` ausente).

## 2. Arquitetura de auth (leia isto antes de qualquer endpoint)

Fonte: `lib/crm/crm-api-auth.ts` + `lib/auth/crm-session.ts`.

**Sessão humana (browser):**
1. O cliente autentica no Supabase Auth e chama `POST /api/auth/crm-session` com `{ access_token }`.
2. O token é **validado no Supabase** (assinatura + expiração) e gravado num cookie **httpOnly** (`CRM_ACCESS_COOKIE`), `sameSite=lax`, TTL default 7 dias.
3. Em cada request, o guard revalida o token na fonte (`fetchAuthUserFromAccessToken`) — cookie forjado/expirado → `401` (fail-closed).
4. Do `auth_id` resolve-se a linha em `public.users` → `userId`, `role`, `status`, `tenant_id`. `status != "ativo"` → `403 "Conta inativa."`. Usuário sem linha → `403 "Utilizador não encontrado."`.

**Caminho server-to-server (cron/worker/IA):** sem cookie, exige header `x-api-key == INTERNAL_API_KEY` **e** `x-caller-auth-id`. Se `INTERNAL_API_KEY` não estiver configurada, o caminho é rejeitado (fail-closed). Esse caminho produz `ehHumano=false` — **nunca pode assinar chave de escrow** (invariante de dinheiro).

**Hierarquia de papéis** (`APP_ROLES`): `owner > gestor > (comercial | financeiro) > atendente`; existe ainda `parceiro`. Legados mapeados: `admin→gestor`, `vendedor→comercial`. Guards por rota:

| Guard | Quem passa |
|---|---|
| `requireCrmSessao` | qualquer sessão ativa (atendente+) |
| `requireCrmComercial` | comercial, gestor, owner |
| `requireCrmFinanceiro` | financeiro, gestor, owner |
| `requireCrmGestor` | gestor, owner |
| `requireCrmOwner` | só owner |
| `requireCrmAprovador` | gestor/owner OU portador de capacidade de escrow (`escrow:chave_tecnica` = architect/operation; `escrow:chave_hub` = owner) — sem elevar o nível CRM |
| `requireInternalApiKey` | `x-api-key` correta (cron/webhooks internos) |

**Rotas públicas** (`public/**`, `leads`, `parceiro/cadastro-publico`, `parceiros/portal/verify`, `validar/**`, alguns webhooks): sem sessão, usam `crmDb()` (service_role) + **rate limit por IP** (ex.: `public/lead-hub` = 8 req/15min → `429`), validação estrita de payload e erro 500 "genérico" via `erroPublico500` (não vaza stack/detalhe).

## 3. Modelo de tenant (o ponto mais crítico do sistema)

O acesso a dados usa `crmDb()` = client Supabase com **service_role, que BYPASSA a RLS**. O isolamento multi-tenant é feito **no código**, via `.eq("tenant_id", ctx.tenantId)` em cada query — o `tenantId` vem **da sessão** (linha do usuário), nunca de header/body do cliente. O header `x-tenant-id` só é honrado no caminho interno com `INTERNAL_API_KEY` válida. Consequência para testes: **um único `.eq('tenant_id')` faltante = vazamento cross-tenant**; esse é o defeito sistêmico nº 1 a caçar. Recurso de outro tenant deve responder `404` (não `403`), evitando enumeração de IDs.

## 4. Como ler este PRD

As seções seguintes documentam os 205 endpoints em 9 grupos: **Público/Captação/Auth (18)** · **CRM Leads+Negócios (28)** · **Cadastros (44)** · **Atendimento/WhatsApp/Copiloto/Ciclos/Cron/ML (22)** · **Distribuição/Parceiros (20)** · **Obras/Projetos/Arquitetura (42)** · **Compras/Cotações/Financeiro (19)** · **Agentes/IA/Hub (48)** · **Dashboard/Analytics/Relatórios/Config (34)**. Cada endpoint traz: método+caminho, guard de auth exigido, propósito, validações/regras de negócio e 2-3 casos de teste (feliz + erro + permissão/tenant). Tudo foi extraído do código real dos `route.ts` — os nomes de campos e mensagens de erro são fiéis ao código.

## Como o TestSprite deve testar
# Como o TestSprite deve testar este backend

## 1. Ambiente e configuração

- **Base URL**: local `http://localhost:3000` (`npm run dev`). NÃO rodar suíte destrutiva contra a produção (Render) — os endpoints de dinheiro/aprovação mudam estado real.
- **Env obrigatórias** para o backend responder: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (sem ela, muitas rotas devolvem `503 "Serviço indisponível"` — isso é comportamento testável, não bug), `INTERNAL_API_KEY` (para o caminho server-to-server e crons).

## 2. Autenticação nos testes (dois caminhos)

**Caminho humano (o principal):**
1. `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` com email/senha do usuário de teste (header `apikey` = anon key) → pega `access_token`.
2. `POST /api/auth/crm-session` com `{ "access_token": "..." }` → o servidor seta o cookie httpOnly de sessão.
3. Reusar o **cookie jar** em todas as chamadas seguintes. Sem cookie → `401`.

**Caminho interno (para testar crons e a invariante do escrow):** headers `x-api-key: {INTERNAL_API_KEY}` + `x-caller-auth-id: {auth_id de um usuário}`. Esse caminho tem `ehHumano=false` — deve ser **rejeitado ao assinar chaves de escrow** mesmo com role owner; teste isso explicitamente.

**Matriz de usuários de teste (mínimo):** 1 `owner`, 1 `gestor`, 1 `comercial`, 1 `financeiro`, 1 `atendente` no tenant A; 1 `owner` no **tenant B** (para cross-tenant); 1 usuário com `status != "ativo"` (deve tomar `403 "Conta inativa."`); 1 usuário com capacidade de escrow (architect/operation) para a Chave Técnica.

## 3. Dados de exemplo

- Criar via API (preferível — testa o caminho de escrita) na ordem de dependência: pessoa/empresa → lead → negócio → obra → itens/EAP → SC/cotação → aprovação. IDs são UUID; guarde os IDs criados para os GET/PATCH/DELETE.
- CPF/CNPJ precisam ser **válidos por dígito verificador** (há validação real em `validar/cpf|cnpj` e dedup por documento nos cadastros). Telefones em formato BR (o sistema normaliza 3 formatos).
- **DELETE arquiva, nunca apaga** (regra do produto) — o assert correto após DELETE é o recurso sumir das listagens, não necessariamente sumir do banco.

## 4. Convenções de assert (padrão do sistema)

| Cenário | Esperado |
|---|---|
| Sem cookie e sem `x-api-key` | `401` `{ error }` |
| Role abaixo do guard | `403` com a mensagem do guard (ex.: "Apenas owner ou gestor...") |
| ID de recurso do tenant B com sessão do tenant A | `404` (nunca os dados) |
| Payload inválido / JSON quebrado | `400` `{ error }` |
| Conflito de estado (ex.: submeter cotação já aprovada) | `409` |
| Rate limit público estourado | `429` + header `Retry-After` |
| Env de serviço ausente | `503` |

Erros podem vir como `{ error }` ou `{ erro }` conforme o grupo — checar o corpo documentado por endpoint.

## 5. O que priorizar e cuidados operacionais

1. **Rotas de DINHEIRO e APROVAÇÃO mudam estado financeiro** (comissões, escrow, contas, status de compra). Rode-as por último dentro do cenário, em tenant de teste isolado, e valide o efeito colateral (registro criado/status mudado), não só o HTTP 200.
2. **Cross-tenant em TODA rota autenticada com `[id]`**: repetir o mesmo GET/PATCH/DELETE com sessão do tenant B esperando `404`. Este é o teste de maior valor por endpoint.
3. **Rotas públicas**: o rate limit é em memória por IP — testes de 429 devem rodar isolados (poluem o contador para os demais); valide também que o 500 público não vaza detalhes internos.
4. **Rotas de IA** (`hub/agentes/**`, `crm/ia/**`, copiloto): podem chamar provider externo (Mistral) e gerar custo — priorizar os testes de **guard/validação/rate-limit** (que falham antes do provider) sobre o caminho feliz completo; caminho feliz só se houver chave de IA de teste.
5. **Crons/webhooks** (`cron/**`, process-whatsapp-jobs): testar que SEM `x-api-key` correta devolvem `401` — é o assert de segurança que importa.
6. **Idempotência/estado**: para gates de aprovação, testar a repetição (aprovar duas vezes, submeter duas vezes) esperando `409`/erro de negócio, não duplicação de efeito financeiro.

## Prioridades (testar primeiro)
# Prioridades de teste — maior risco primeiro

## P0 — Dinheiro e aprovações (efeito financeiro irreversível)

1. **`PATCH /api/hub/aprovacoes/[id]`** — o gate humano central: aprovar/rejeitar cards (compra, cotação, pagamento, escrow). Testar: `requireCrmAprovador` (atendente/comercial → 403); `status` fora de `aprovado|rejeitado` → 400; **dupla chave do escrow** (duas autoridades humanas DISTINTAS; mesma pessoa nas duas chaves deve falhar); **caminho interno (`x-api-key`) não pode assinar escrow** mesmo como owner (`ehHumano=false`); tenant vem da sessão (card do tenant B → não aprovável).
2. **Financeiro** — `crm/financeiro/contas` (pagar/receber), `financeiro-rede` do negócio, motor de comissões (split/snapshot/cash-basis), `crm/parceiros/[id]/liberar`. Testar guard `requireCrmFinanceiro`, valores negativos/inválidos → 400, e que baixa/liberação gera o registro correto uma única vez.
3. **Compras / SC / cotações** — `crm/obras/[id]/sc`, `crm/obras/[id]/restricoes/[rid]/gerar-sc`, `cotacoes/pedidos` (+ `[id]`, `[id]/respostas`), **`cotacoes/pedidos/[id]/submeter-aprovacao`** (regra "nada financeiro sem aprovação humana": sem resposta de fornecedor → 400; já `em_aprovacao|aprovado` → 409; pedido de outro tenant → 404), `crm/pedidos/[id]`. Compras é o negócio universal do produto (meta 1.200/semana) — cadeia SC→cotação→aprovação→PO inteira.

## P1 — Isolamento cross-tenant (vazamento de dados)

4. **Toda rota autenticada com `[id]`** — o `crmDb()` bypassa RLS; o isolamento é só o `.eq('tenant_id')` no código. Varredura sistemática: sessão do tenant A acessando IDs do tenant B em leads, negócios, pessoas, empresas, obras, projetos, SC, contas, parceiros, agentes → **sempre 404**, nunca os dados. Prioridade extra nas rotas de escrita (PATCH/DELETE cross-tenant não pode ter efeito).
5. **Listagens** (`GET` coleção: leads, negocios, obras, contas, aprovacoes, usuarios) — resposta não pode conter linhas do outro tenant.

## P2 — Superfície pública (sem login, internet aberta)

6. **`public/lead-hub`, `public/cadastro-empresa`, `public/especialista`, `leads` (POST público), `parceiro/cadastro-publico`, `parceiros/portal/verify`, `validar/cpf|cnpj`** — rate limit por IP (lead-hub: 8/15min → 429 + Retry-After), payload inválido → 400, erro interno mascarado (500 genérico), e que NÃO aceitam parâmetros de controle (tenant/role) vindos do cliente.
7. **`auth/crm-session`** — token inválido → 401; token válido de usuário sem linha/inativo → 403; JSON quebrado → 400; cookie httpOnly setado corretamente; DELETE limpa a sessão.

## P3 — Escalação de privilégio e caminho interno

8. **Guards por role em rotas administrativas** — `crm/usuarios` (convite/role: atendente não cria usuário; `crmPodeAtribuirRole` impede atribuir role acima do próprio), `crm/tenants`, `crm/tenant-settings`, `distribuicao/regras`, `parceiros/[id]/portal-link`.
9. **Crons e ML** (`cron/**`, `ml/aprovar`, `ml/ciclo`, `ciclos/**`) — sem `x-api-key` correta → 401; com `INTERNAL_API_KEY` ausente no env, o header deve ser rejeitado (fail-closed).
10. **Distribuição** — `crm/distribuicao/[encaminhamentoId]/aprovar` e `cobrar`: direcionam lead (valor comercial) — permissão + idempotência.

## P4 — Restante

11. **IA/agentes/hub (48 rotas)** — foco em guard + rate limit anti-abuso de custo; caminho feliz só com chave de teste.
12. **Obras/projetos/arquitetura** — integridade do encadeamento (converter-negocio → converter-obra → EAP) e 409 de estado.
13. **Dashboard/analytics/relatórios/config** — leitura; assert principal é tenant-scope e guard.

**Regra de ouro:** para cada endpoint P0/P1, os três casos mínimos são (a) caminho feliz com role correta, (b) 401/403 de permissão, (c) 404 cross-tenant — e em P0 acrescentar (d) repetição do efeito financeiro → 409/erro, sem duplicar dinheiro.


---

## PÚBLICO / CAPTAÇÃO / AUTH (rotas sem login com rate limit + validação de sessão CRM: public/**, parceiro/cadastro-publico, parceiros/portal/verify, auth/crm-session, validar/**, leads, atividades, agentes*)

### POST /api/public/cadastro-empresa
- **Auth:** Público (sem login). Usa service_role (crmDb). Rate limit: 5 req/15min por IP (429 com Retry-After). Feature flag PUBLIC_SIGNUP_ENABLED (se 'false'/'0' → 503).
- **Proposito:** Auto-cadastro público de empresa (tenant): cria usuário no Supabase Auth, tenant e registro em users/hub_empresas; retorna 201 {ok, tenantId, slug, needsEmailConfirmation}.
- **Regras:** JSON inválido → 400. Validações (validarCadastroEmpresaPublico): razão social ≥2 chars; CNPJ com 14 dígitos e dígitos verificadores válidos; segmento dentro do catálogo; nome do responsável obrigatório; e-mail corporativo válido (regex); senha ≥8 chars; aceite de termos obrigatório. Dedup: CNPJ já cadastrado → 409; e-mail já usado → 409 (também se o Auth acusar e-mail existente). Erros internos → 500 genérico via erroPublico500 (não vaza schema).
- **Casos de teste:**
  - **Cadastro feliz** - DADO PUBLIC_SIGNUP_ENABLED não é 'false', payload completo com CNPJ válido de 14 dígitos, e-mail novo, senha de 8+ chars e aceite=true . QUANDO POST com esse JSON . ENTAO 201 com {ok:true, tenantId, slug, needsEmailConfirmation}
  - **Validação de senha curta** - DADO payload válido exceto senha com 5 caracteres . QUANDO POST . ENTAO 400 {error:'Senha deve ter pelo menos 8 caracteres.'}
  - **CNPJ duplicado** - DADO empresa já cadastrada com o mesmo CNPJ . QUANDO POST com o CNPJ repetido . ENTAO 409 {error:'CNPJ já cadastrado na plataforma.'}
  - **Rate limit** - DADO 6 tentativas do mesmo IP dentro de 15 minutos . QUANDO a 6ª requisição chega . ENTAO 429 com header Retry-After e mensagem 'Muitas tentativas...'

### POST /api/public/especialista
- **Auth:** Público (sem login). service_role (crmDb). Rate limit: 5 req/15min por IP (429). 503 se config Supabase ausente (crmConfigError).
- **Proposito:** Auto-cadastro público de especialista (mão de obra) via link de convite; gera código sequencial ESP-YYYY-NNNN e insere em hub_especialistas com origem='link' no tenant padrão (single-tenant).
- **Regras:** nome obrigatório → 400; telefone com <10 dígitos (após remover não-dígitos) → 400; especialidades filtradas contra catálogo ESPECIALIDADES, mínimo 1 válida → 400. CPF (se enviado): dedup por CPF exato → 409. H-SEC-3: parâmetro 'por' (UUID do convidador) NÃO é confiável — cadastrado_por é gravado como null (atribuição real espera link HMAC). Erro de insert → 500 genérico.
- **Casos de teste:**
  - **Cadastro feliz** - DADO body {nome:'João', telefone:'11999998888', especialidades:['pedreiro']} (especialidade existente no catálogo) . QUANDO POST . ENTAO 201 {ok:true, codigo:'ESP-<ano>-NNNN'} e linha em hub_especialistas com origem='link' e cadastrado_por=null
  - **Sem especialidade válida** - DADO body com nome e telefone válidos mas especialidades:['inexistente'] . QUANDO POST . ENTAO 400 {error:'Escolha ao menos uma especialidade'}
  - **CPF duplicado** - DADO hub_especialistas já contém registro com cpf '12345678901' . QUANDO POST com o mesmo CPF (mesmo formatado '123.456.789-01') . ENTAO 409 {error:'Já existe um cadastro com este CPF.'}

### POST /api/public/lead-hub
- **Auth:** Público (sem login). service_role (crmDb). Rate limit: 8 req/15min por IP (429 com Retry-After).
- **Proposito:** Captação pública de lead do Hub (formulário do site): valida, deduplica por telefone e insere lead; retorna 201 {ok, leadId, codigo}.
- **Regras:** JSON inválido → 400. Validações (validarLeadHubPublico): nome da empresa obrigatório; nome do contato obrigatório; e-mail válido; telefone com DDD (10 ou 11 dígitos). Dedup por telefone: já registrado → 409 ('Este telefone já está registado (<nome>).' ou 'Telefone já cadastrado.'). Falha de gravação → 500 genérico via erroPublico500.
- **Casos de teste:**
  - **Lead captado** - DADO payload com empresa, nome, e-mail válido e telefone de 11 dígitos inédito . QUANDO POST . ENTAO 201 {ok:true, leadId:<uuid>, codigo}
  - **Telefone sem DDD** - DADO payload válido exceto telefone '99998888' (8 dígitos) . QUANDO POST . ENTAO 400 {error:'Informe telefone com DDD (10 ou 11 dígitos).'}
  - **Telefone duplicado** - DADO lead já existente com o mesmo telefone . QUANDO POST repetindo o telefone . ENTAO 409 com mensagem de telefone já registado

### POST /api/parceiro/cadastro-publico
- **Auth:** Público (sem login). service_role direto (fail-closed: sem SUPABASE_SERVICE_ROLE_KEY → 503). Rate limit: 5 req/15min por IP (429, H-SEC-2).
- **Proposito:** Cadastro público de parceiro da rede via link: cria hub_parceiros (status='captacao', comissao_pct=5), registro de captação (estagio='interessado', origem='link_publico_rede') e log; retorna código de rastreio (sem UUID interno).
- **Regras:** nomeFinal (razao_social p/ PJ, nome p/ PF) obrigatório e telefone ≥10 dígitos → senão 400. Dedup: telefone → 409 genérico 'Telefone já cadastrado na rede.' (não revela id/código); CPF → 409; CNPJ → 409. cpf só gravado se tipo_pessoa='PF'; cnpj só se 'PJ'. Atribuição 'quem convidou' (H-SEC-3): convidado_por só creditado no log se convidado_sig for HMAC válido (conviteParceiroValido); sem sig válida grava convite_verificado=false. Sucesso: 200 {codigo, status:'criado', warning|null}. Erro inesperado → 500 genérico (loga no servidor).
- **Casos de teste:**
  - **Cadastro PF feliz** - DADO body {tipo_pessoa:'PF', nome:'Maria', telefone:'11988887777'} inédito . QUANDO POST . ENTAO 200 com {codigo:'PAR-...', status:'criado'}; hub_parceiros criado com comissao_pct=5 e status='captacao'
  - **Telefone duplicado — resposta genérica** - DADO parceiro existente com o mesmo telefone . QUANDO POST repetindo o telefone . ENTAO 409 {erro:'Telefone já cadastrado na rede.'} sem expor id/código do existente
  - **Convite forjado não credita** - DADO body com convidado_por=<uuid qualquer> e convidado_sig inválida . QUANDO POST . ENTAO cadastro criado, mas log gravado com dados {convite_verificado:false} (sem convidado_por_user)

### POST /api/parceiros/portal/verify
- **Auth:** Público com link assinado: body {id, s} onde s = assinatura HMAC do id (parceiroPortalValido). service_role fail-closed (sem key → 503). Rate limit configurável: PORTAL_VERIFY_RATE_MAX (default 40) por PORTAL_VERIFY_RATE_WINDOW_MS (default 60s) por IP → 429.
- **Proposito:** Verifica o link assinado do portal do parceiro (zero-login) e devolve os dados do parceiro (id, nome, status, modulo_atual, comissao_pct, totais de leads, recebe_leads, telefone, cidade, estado).
- **Regras:** JSON inválido → 400. id ou s ausentes, ou assinatura HMAC inválida/expirada → 401 {ok:false, erro:'Link inválido ou expirado'}. Parceiro inexistente no banco → 404. Sucesso → 200 {ok:true, parceiro}.
- **Casos de teste:**
  - **Link válido** - DADO id de parceiro existente e s = HMAC correta desse id . QUANDO POST {id, s} . ENTAO 200 {ok:true, parceiro:{id, nome, status, comissao_pct, ...}}
  - **Assinatura forjada** - DADO id válido mas s aleatória . QUANDO POST . ENTAO 401 {ok:false, erro:'Link inválido ou expirado'}
  - **Parceiro apagado** - DADO id+s com HMAC válida, mas parceiro não existe mais em hub_parceiros . QUANDO POST . ENTAO 404 {ok:false, erro:'Parceiro não encontrado'}

### POST /api/auth/crm-session
- **Auth:** Público (é o próprio fluxo de login): troca access_token do Supabase Auth por cookie de sessão CRM.
- **Proposito:** Valida o access_token no Supabase Auth e grava o cookie httpOnly CRM_ACCESS_COOKIE (obra10_crm_access) com maxAge = expires_in (se >0) ou 7 dias; sameSite=lax, secure em produção.
- **Regras:** JSON inválido → 400; access_token ausente/vazio → 400. Falha de rede/SSL ao contatar o Supabase → 502 com mensagem orientando dev local. Token que não resolve usuário → 401 'Sessão inválida'. Se shouldVerifyPublicUser(): usuário rejeitado na tabela public.users → 403; erro nessa verificação → 502. Sucesso → {ok:true}. Erro inesperado → 500.
- **Casos de teste:**
  - **Login feliz** - DADO access_token válido de usuário existente no Supabase Auth (e em public.users quando a verificação está ativa) . QUANDO POST {access_token, expires_in:3600} . ENTAO 200 {ok:true} e Set-Cookie httpOnly obra10_crm_access com maxAge=3600
  - **Token ausente** - DADO body {} sem access_token . QUANDO POST . ENTAO 400 {error:'access_token obrigatório'}
  - **Token inválido** - DADO access_token expirado/forjado que o Supabase não reconhece . QUANDO POST . ENTAO 401 {error:'Sessão inválida'} e nenhum cookie gravado

### DELETE /api/auth/crm-session
- **Auth:** Público (logout — não exige sessão válida).
- **Proposito:** Logout: sobrescreve o cookie CRM_ACCESS_COOKIE com valor vazio e maxAge=0.
- **Regras:** Sempre limpa o cookie e responde {ok:true}; falha inesperada → 500 {ok:false}.
- **Casos de teste:**
  - **Logout com sessão** - DADO cliente com cookie obra10_crm_access setado . QUANDO DELETE . ENTAO 200 {ok:true} e Set-Cookie expirando o cookie (maxAge=0)
  - **Logout sem sessão (idempotente)** - DADO cliente sem cookie . QUANDO DELETE . ENTAO 200 {ok:true} (não há erro por não estar logado)

### GET|POST /api/validar/cpf
- **Auth:** Público (sem login, sem rate limit).
- **Proposito:** Validação algorítmica de CPF (dígitos verificadores). GET recebe ?cpf=, POST recebe {cpf}; ambos retornam {valido:boolean, cpf:<somente dígitos>}.
- **Regras:** Remove não-dígitos; exige 11 dígitos; rejeita sequências repetidas (ex.: 11111111111); calcula os 2 dígitos verificadores. Não consulta serviço externo. Sempre 200 (a resposta indica válido/inválido).
- **Casos de teste:**
  - **CPF válido formatado** - DADO CPF matematicamente válido com máscara, ex. '529.982.247-25' . QUANDO GET /api/validar/cpf?cpf=529.982.247-25 . ENTAO 200 {valido:true, cpf:'52998224725'}
  - **CPF de dígitos repetidos** - DADO cpf '111.111.111-11' . QUANDO POST {cpf:'11111111111'} . ENTAO 200 {valido:false, cpf:'11111111111'}
  - **Tamanho errado** - DADO cpf com 9 dígitos . QUANDO GET com esse valor . ENTAO 200 {valido:false}

### GET|POST /api/validar/cnpj
- **Auth:** Público (sem login, sem rate limit).
- **Proposito:** Validação algorítmica de CNPJ. GET (?cnpj=): se válido, enriquece via BrasilAPI (razao_social, nome_fantasia, situacao, ativo, municipio, uf; cache revalidate 1h) com fallback silencioso para validação local se a API externa falhar. POST ({cnpj}): apenas validação local {valido, cnpj}.
- **Regras:** Remove não-dígitos; exige 14 dígitos; rejeita repetidos; calcula 2 dígitos verificadores com pesos oficiais. GET com CNPJ inválido → 200 {valido:false, cnpj} sem chamar BrasilAPI. 'ativo' = situação cadastral === 'ATIVA'. Sempre 200.
- **Casos de teste:**
  - **CNPJ válido com enriquecimento** - DADO CNPJ real válido e BrasilAPI respondendo . QUANDO GET /api/validar/cnpj?cnpj=<válido> . ENTAO 200 {valido:true, cnpj, razao_social, situacao, ativo, municipio, uf}
  - **CNPJ inválido** - DADO cnpj '12345678000100' (dígito verificador errado) . QUANDO GET . ENTAO 200 {valido:false, cnpj:'12345678000100'} sem chamada externa
  - **BrasilAPI fora do ar** - DADO CNPJ válido mas fetch externo falha . QUANDO GET . ENTAO 200 {valido:true, cnpj} (fallback só-local, sem 5xx)

### GET /api/leads
- **Auth:** Sessão CRM ativa (requireCrmSessao — qualquer nível: owner/gestor/comercial/atendente). Sem sessão → 401.
- **Proposito:** Lista até 20 leads ativos (estagio fora de perdido/ganho) do tenant do chamador, ordenados por score desc, com campos operacionais (id, nome, telefone, origem, estagio, score, valor_estimado, responsáveis, datas).
- **Regras:** Escopo de tenant via tenantScopeOrFilter(g.ctx.tenantId) — inclui legado tenant_id NULL/default Obra10 como partilhado; service_role fail-closed (sem SUPABASE_SERVICE_ROLE_KEY → 503). Erro de query → 500. Resposta é array JSON direto.
- **Casos de teste:**
  - **Listagem do próprio tenant** - DADO sessão CRM válida e leads ativos no tenant do usuário + leads em outro tenant . QUANDO GET . ENTAO 200 com no máx. 20 leads apenas do tenant do chamador (ou legado NULL/default), sem perdido/ganho, ordenados por score desc
  - **Sem sessão** - DADO requisição sem cookie de sessão CRM . QUANDO GET . ENTAO 401
  - **Isolamento de tenant** - DADO sessão do tenant A e lead ativo pertencente exclusivamente ao tenant B . QUANDO GET com a sessão do tenant A . ENTAO o lead do tenant B NÃO aparece na lista

### POST /api/leads
- **Auth:** Sessão CRM ativa (requireCrmSessao). Sem sessão → 401.
- **Proposito:** Cria lead (rota legada) no tenant da sessão, garantindo CÓDIGO ÚNICO: cria/deduplica hub_pessoas (por CPF e/ou telefone) e vincula pessoa_id ao lead; metadata.origem_cadastro='api_leads_legacy'.
- **Regras:** body.nome obrigatório → 400 'nome required'. tenant do lead = g.ctx.tenantId (não o default global). Defaults: origem='outro', estagio='novo', valor_estimado=0, score=50, tags=[]. Fallback de schema: se a coluna pessoa_id não existir (isMissingPgColumn), reinsere sem o vínculo. service_role ausente → 503. Erro de insert → 500. Sucesso → 201 com o lead criado.
- **Casos de teste:**
  - **Criação com pessoa vinculada** - DADO sessão válida e body {nome:'Carlos', telefone:'11977776666'} . QUANDO POST . ENTAO 201 com lead criado no tenant da sessão, pessoa_id preenchido (hub_pessoas criada/reusada por telefone) e metadata.origem_cadastro='api_leads_legacy'
  - **Sem nome** - DADO body {telefone:'11977776666'} sem nome . QUANDO POST . ENTAO 400 {error:'nome required'}
  - **Sem sessão** - DADO requisição anônima . QUANDO POST com body válido . ENTAO 401 e nenhum lead criado

### PATCH /api/leads
- **Auth:** Sessão CRM ativa (requireCrmSessao) + guard de posse por tenant (lead de outro tenant → 404, sem vazar existência).
- **Proposito:** Atualiza campos operacionais de um lead (id no body) com whitelist estrita; seta atualizado_em automaticamente.
- **Regras:** body.id obrigatório → 400 'id required'. Lead inexistente → 404 'Lead não encontrado'. Lead com tenant_id preenchido diferente do tenant da sessão e diferente do DEFAULT_OBRA10_TENANT_ID → 404 (legado NULL/default é partilhado). Whitelist LEAD_PATCH_ALLOWED: nome, telefone, email, origem, campanha, estagio, valor_estimado, score, tags, agente_responsavel, humano_responsavel, proxima_acao, proxima_acao_em — id/tenant_id/pessoa_id/codigo nunca passam. Nenhum campo permitido no body → 400 'Nenhum campo para atualizar'. Sucesso → {ok:true}.
- **Casos de teste:**
  - **Update permitido** - DADO lead do tenant da sessão e body {id, estagio:'qualificado', score:80} . QUANDO PATCH . ENTAO 200 {ok:true}; lead atualizado com novo estagio/score e atualizado_em novo
  - **Campo fora da whitelist ignorado** - DADO body {id, tenant_id:'outro-tenant'} sem nenhum campo permitido . QUANDO PATCH . ENTAO 400 'Nenhum campo para atualizar' e tenant_id inalterado
  - **Lead de outro tenant** - DADO sessão do tenant A e id de lead com tenant_id do tenant B . QUANDO PATCH {id, score:90} . ENTAO 404 'Lead não encontrado' (sem alterar o lead)

### POST /api/atividades
- **Auth:** Sessão CRM ativa (requireCrmSessao). Sem sessão → 401. service_role fail-closed (sem key → 503).
- **Proposito:** Registra atividade de agendamento de reunião em hub_atividades: tipo='agendamento', descricao montada de data/hora/notas, feito_por='wendel' (hardcoded), feito_por_tipo='humano', metadata {data, hora, notas}.
- **Regras:** Body esperado {lead_id, data, hora, notas?}. Observação fiel ao código: NÃO há validação de lead_id/data/hora no handler — campos ausentes viram 'undefined' na descrição ou erro do banco (FK/NOT NULL) → 500. Erro de insert → 500 com error.message. Sucesso → {ok:true}.
- **Casos de teste:**
  - **Agendamento registrado** - DADO sessão válida e body {lead_id:<uuid existente>, data:'2026-07-15', hora:'14:00', notas:'ligar antes'} . QUANDO POST . ENTAO 200 {ok:true}; hub_atividades ganha linha tipo 'agendamento' com descricao 'Reunião agendada para 2026-07-15 às 14:00 — ligar antes'
  - **lead_id inexistente** - DADO body com lead_id que não existe em hub_leads_crm . QUANDO POST . ENTAO 500 com a mensagem de erro do banco (violação de FK) — sem registro criado
  - **Sem sessão** - DADO requisição anônima . QUANDO POST com body válido . ENTAO 401

### GET /api/agentes
- **Auth:** Sessão CRM ativa (requireCrmSessao — qualquer nível). Sem sessão → 401.
- **Proposito:** Mapa do escritório: lista todos os agentes IA (hub_agente_identidade, ordenados por nivel) enriquecidos com personalidade e métricas 24h (conversas, custo BRL, latência média, taxa de conversão via hub_prompt_logs), KPIs fora da meta (hub_kpis_resultados) e sugestões ML pendentes.
- **Regras:** SANITIZAÇÃO obrigatória: sanitizarAgenteHubParaCliente remove uazapi_instance_token (credencial WhatsApp) da resposta — o token NUNCA pode aparecer no JSON. Sem agentes → []. Resposta é array direto.
- **Casos de teste:**
  - **Lista enriquecida** - DADO sessão válida e agentes cadastrados com logs nas últimas 24h . QUANDO GET . ENTAO 200 array com cada agente contendo personalidade e metricas {conversas24h, custoHoje, latenciaMedia, taxaConversao, kpisForaMeta, sugestoesPendentes}
  - **Credencial não vaza** - DADO agente com uazapi_instance_token preenchido no banco . QUANDO GET . ENTAO 200 e o campo uazapi_instance_token NÃO está presente em nenhum item da resposta
  - **Sem sessão** - DADO requisição sem cookie CRM . QUANDO GET . ENTAO 401

### POST /api/agentes
- **Auth:** requireCrmGestor — apenas owner/gestor (mudança estrutural, Batch 5). Sem sessão → 401; nível comercial/atendente → 403.
- **Proposito:** Cria agente IA completo: hub_agente_identidade + hub_personalidade + hub_hierarquia + hub_agente_configuracao (best-effort) + hub_agente_conhecimento + KPIs padrão (só nível 4).
- **Regras:** Anti-tamper: se cargo_slug (ou agente_slug) existir em hub_cargos_catalogo, nivel e modelo_padrao são FORÇADOS pelo servidor (catálogo), ignorando o body. Modelos derivados por nível: modelo_critico e modelo_alto_valor sobem de tier para nivel<=3 / <=2. Defaults: prefixo_mercado='GRL', ativo=true, supervisor_slug='gerente_atendimento', horario 08:00-22:00. Erro no insert da identidade (ex. agente_slug duplicado) → 400 {erro}. hub_agente_configuracao/kpis são non-critical (falha silenciosa). Sucesso → {sucesso:true, agente}.
- **Casos de teste:**
  - **Criação por gestor** - DADO sessão owner/gestor e body {agente_slug:'vendedor_x', nome, cargo, cargo_slug válido do catálogo, humor:4, personalidade_id:2} . QUANDO POST . ENTAO 200 {sucesso:true, agente}; nivel/modelo vêm do catálogo (não do body); personalidade e hierarquia criadas
  - **Permissão insuficiente** - DADO sessão CRM de nível atendente/comercial . QUANDO POST com body válido . ENTAO 403 (requireCrmGestor barra) e nada é criado
  - **Slug duplicado** - DADO hub_agente_identidade já contém agente_slug 'vendedor_x' . QUANDO POST repetindo o slug . ENTAO 400 {erro:<mensagem de unique violation>}

### PATCH /api/agentes
- **Auth:** requireCrmGestor — apenas owner/gestor. Sem sessão → 401; nível insuficiente → 403.
- **Proposito:** Edita agente: atualiza hub_agente_identidade por agente_slug com os demais campos do body; se 'conhecimentos' vier, substitui todo o conhecimento (delete + reinsert com ordem/ativo).
- **Regras:** Body {agente_slug, conhecimentos?, ...dadosAgente}. Sem whitelist de campos em dadosAgente (aplica update direto). conhecimentos presente → delete de todos os hub_agente_conhecimento do slug e reinsert da lista (pode ser vazia = zera conhecimento). Sempre responde {sucesso:true} (erros de update não são propagados no código atual).
- **Casos de teste:**
  - **Edição de identidade** - DADO sessão gestor e body {agente_slug:'mari', cargo:'SDR Sênior'} . QUANDO PATCH . ENTAO 200 {sucesso:true} e hub_agente_identidade do slug com cargo atualizado
  - **Substituição de conhecimento** - DADO agente com 3 conhecimentos e body {agente_slug, conhecimentos:[{secao,titulo,conteudo}]} . QUANDO PATCH . ENTAO conhecimento antigo apagado e apenas o novo item existe, com ordem=0 e ativo=true
  - **Permissão insuficiente** - DADO sessão de atendente . QUANDO PATCH . ENTAO 403

### GET /api/agentes/mobile
- **Auth:** Sessão CRM ativa (requireCrmSessao). Sem sessão → 401.
- **Proposito:** Mapa mobile do escritório: agentes com posição no mapa (pos_mobile_x não nula) + contagem de leads ativos (leads_atendendo) por agente_responsavel, excluindo estágios ganho/perdido/arquivado.
- **Regras:** Sem SUPABASE_SERVICE_ROLE_KEY → 200 [] (degrada, não 5xx). Erro de query ou sem agentes → []. Ordena por nivel.
- **Casos de teste:**
  - **Mapa com contagem** - DADO sessão válida, agente com pos_mobile_x definida e 3 leads ativos atribuídos a ele . QUANDO GET . ENTAO 200 array incluindo o agente com leads_atendendo=3
  - **Agente sem posição não aparece** - DADO agente com pos_mobile_x NULL . QUANDO GET . ENTAO 200 e esse agente não está no array
  - **Sem sessão** - DADO requisição anônima . QUANDO GET . ENTAO 401

### GET /api/agentes/[slug]/detalhes
- **Auth:** Sessão CRM ativa (requireCrmSessao). Sem sessão → 401.
- **Proposito:** Detalhe do agente para o mapa mobile: identidade + índice de conhecimento (secao/titulo, até 50) + conversas ativas (até 12 leads, ordenadas por atualizado_em desc) + stats {atendendo, atendidos_hoje (ganhos desde 00:00), conversao_pct}.
- **Regras:** Sem SUPABASE_SERVICE_ROLE_KEY → 503 {erro:'Serviço indisponível'}. Slug inexistente em hub_agente_identidade → 404 {erro:'Agente não encontrado'}. conversao_pct = round(ganhosHoje/(ativos+ganhosHoje)*100). Defaults: cor_departamento '#c9a24a', modelo_padrao/sala_id ''. Conversas excluem ganho/perdido/arquivado.
- **Casos de teste:**
  - **Detalhe completo** - DADO sessão válida e agente 'mari' com 2 leads ativos e 1 ganho hoje . QUANDO GET /api/agentes/mari/detalhes . ENTAO 200 com conversas_ativas (2 itens) e stats {atendendo:2, atendidos_hoje:1, conversao_pct:33}
  - **Slug inexistente** - DADO nenhum agente com slug 'fantasma' . QUANDO GET /api/agentes/fantasma/detalhes . ENTAO 404 {erro:'Agente não encontrado'}
  - **Sem sessão** - DADO requisição sem cookie CRM . QUANDO GET . ENTAO 401


---

## CRM LEADS + NEGÓCIOS (leads, propostas, converter-negocio, nota, negócios, converter-obra, relacionados, financeiro-rede, copilot, encaminhamentos, indicações)

### GET /api/crm/leads
- **Auth:** requireCrmSessao (qualquer sessão CRM válida)
- **Proposito:** Lista enxuta de leads para selects (ex.: formulário de negócio). Exclui estágios 'ganho' e 'perdido'; escopo por tenant via tenantScopeOrFilter (tenant da sessão + legados com tenant NULL); ordena por criado_em desc.
- **Regras:** Query params: limit (default 50, máx 100) e busca (sanitizada via sanitizarBuscaPostgrest; aplica ilike em nome OU telefone). Retorna {data:[{id,nome,telefone,estagio,valor_estimado,criado_em}]}. 503 se Supabase não configurado; 500 em erro de banco.
- **Casos de teste:**
  - **Listagem feliz com filtro de busca** - DADO Sessão CRM válida e leads ativos no tenant, um deles com nome 'Maria' . QUANDO GET /api/crm/leads?busca=Maria&limit=10 . ENTAO 200 com {data:[...]} contendo apenas leads cujo nome ou telefone casa 'Maria', máximo 10 itens, sem leads em estágio ganho/perdido
  - **Sem sessão** - DADO Request sem cookie/sessão CRM . QUANDO GET /api/crm/leads . ENTAO 401 (erro do guard requireCrmSessao)
  - **Isolamento de tenant** - DADO Sessão do tenant A e leads existentes apenas no tenant B . QUANDO GET /api/crm/leads . ENTAO 200 com data não contendo nenhum lead do tenant B (somente tenant A e legados tenant NULL)

### POST /api/crm/leads
- **Auth:** requireCrmSessao
- **Proposito:** Cria lead manual no CRM (hub_leads_crm) com dedup por telefone no tenant, vínculo/criação automática de pessoa (hub_pessoas) pelo telefone, score inicial 50, metadata de mercados/indicado_por, atividade 'Lead criado manualmente' e evento keystone lead_criado (best-effort).
- **Regras:** Body validado por validarLeadCadastro (nome, telefone, email, origem, estagio, valor_estimado, mercados) → 400 se inválido; JSON inválido → 400. Dedup: telefone já existente no escopo do tenant → 409 com {error, lead_id}. Insert com fallback de colunas legadas (tenant_id/pessoa_id/codigo ausentes); tabela inexistente (PGRST205) → 503; 23505 no insert → 409 'Lead duplicado'. Pessoa: busca por telefone escopada no tenant; se não existe cria (tipo 'lead', código gerado); corrida 23505 → re-busca. Sucesso → 201 {data}.
- **Casos de teste:**
  - **Criação feliz com pessoa vinculada** - DADO Sessão CRM válida e body {nome:'João Teste', telefone:'11999998888', origem:'crm_manual'} com telefone inédito no tenant . QUANDO POST /api/crm/leads . ENTAO 201 com {data:{id, codigo, nome, telefone, score:50, pessoa_id preenchido}}; existe atividade tipo status_change e evento lead_criado
  - **Telefone duplicado no tenant** - DADO Lead já existente com telefone '11999998888' no mesmo tenant . QUANDO POST /api/crm/leads com o mesmo telefone . ENTAO 409 com {error:'Telefone já cadastrado para o lead <nome>.', lead_id}
  - **Payload inválido** - DADO Sessão válida e body sem nome (ou JSON malformado) . QUANDO POST /api/crm/leads . ENTAO 400 com {error} da validação (ou 'JSON inválido')

### GET /api/crm/leads/[id]
- **Auth:** requireCrmSessao + guard de posse por tenant (lead de outro tenant → 404)
- **Proposito:** Ficha completa do lead: dados do lead + pessoa vinculada + negócios do lead + timeline (hub_atividades, 50) + notas (hub_notas, 30) + propostas + memórias IA (hub_memorias_lead).
- **Regras:** Lead inexistente → 404 'Lead não encontrado'. Se lead.tenant_id preenchido e ≠ tenant da sessão → 404 (service-role bypassa RLS; o filtro no código é a proteção). 503 sem config; 500 erro de banco. Resposta {data, pessoa, negocios, timeline, notas, propostas, memorias}.
- **Casos de teste:**
  - **Ficha completa** - DADO Lead existente do tenant da sessão com atividades e notas . QUANDO GET /api/crm/leads/{id} . ENTAO 200 com data (campos LEAD_SELECT), timeline ordenada desc, notas, propostas, memorias e pessoa (ou null)
  - **Lead de outro tenant** - DADO Lead existente com tenant_id = B e sessão do tenant A . QUANDO GET /api/crm/leads/{id} . ENTAO 404 'Lead não encontrado' (não vaza existência)
  - **Id inexistente** - DADO UUID que não existe em hub_leads_crm . QUANDO GET /api/crm/leads/{id} . ENTAO 404 'Lead não encontrado'

### PATCH /api/crm/leads/[id]
- **Auth:** requireCrmSessao + guard de posse por tenant (404 se outro tenant)
- **Proposito:** Atualiza campos do lead (allowlist) e/ou muda estágio do funil. Em mudança de estágio: registra atividade status_change, log CRM (estagio_alterado) e evento keystone. Auto-avanço F3: se edição tocou interesse_principal/valor_estimado e o lead ficou 'pronto', move para qualificando e sugere encaminhamento automático (best-effort).
- **Regras:** JSON inválido → 400. Campos permitidos: nome, telefone, email, origem, score, valor_estimado, agente_responsavel, humano_responsavel, proxima_acao, data_proxima_acao, motivo_perda, tags, pessoa_id, metadata, tipo_interesse, interesse_principal, cidade, bairro, canal_origem (+ estagio/estagio_funil via buildLeadEstagioPatch). Nenhum campo → 400 'Nenhum campo para atualizar'. Mudança para 'perdido' exige motivo_perda (validarMudancaEstagioLead) → 400 sem ele. Lead inexistente → 404; outro tenant → 404.
- **Casos de teste:**
  - **Mudança de estágio com trilha** - DADO Lead do tenant da sessão em estágio 'novo' . QUANDO PATCH com body {estagio_funil:'qualificando'} . ENTAO 200 com data atualizado; atividade 'Estágio alterado: ... → ...' e log estagio_alterado criados
  - **Perdido sem motivo** - DADO Lead válido do tenant . QUANDO PATCH com {estagio:'perdido'} sem motivo_perda . ENTAO 400 com erro de validação exigindo o motivo da perda
  - **PATCH cross-tenant bloqueado** - DADO Lead com tenant_id = B, sessão do tenant A . QUANDO PATCH com {nome:'hackeado'} . ENTAO 404 'Lead não encontrado' e nenhum campo alterado no banco

### POST /api/crm/leads/[id]/nota
- **Auth:** requireCrmComercial (nível comercial ou superior)
- **Proposito:** Registra nota manual do lead: grava em hub_notas (painel de notas, com tenant) e espelha na timeline hub_atividades (tipo 'nota', texto completo até 2000 chars; falha do espelho não derruba a nota).
- **Regras:** body.descricao obrigatória e não-vazia após trim → 400 'Escreva a nota.'. Conteúdo truncado em 2000 chars. tenant_id sempre da sessão. Sucesso → 201 {data:{id,conteudo,criado_por,criado_em}}. Erro no insert da nota → 500.
- **Casos de teste:**
  - **Nota criada e espelhada** - DADO Sessão comercial e lead existente . QUANDO POST com {descricao:'Cliente pediu retorno amanhã'} . ENTAO 201 com data da nota; hub_atividades ganha registro tipo 'nota' com o mesmo texto
  - **Nota vazia** - DADO Sessão comercial válida . QUANDO POST com {descricao:'   '} ou body vazio . ENTAO 400 'Escreva a nota.'
  - **Permissão insuficiente** - DADO Sessão de nível atendente (abaixo de comercial) . QUANDO POST /api/crm/leads/{id}/nota . ENTAO 403 (guard requireCrmComercial)

### GET /api/crm/leads/[id]/propostas
- **Auth:** requireCrmSessao + escopo tenant (tenantScopeOrFilter na query)
- **Proposito:** Lista todas as propostas (hub_propostas) do lead, escopadas ao tenant da sessão, ordenadas por criado_em desc.
- **Regras:** 503 sem config Supabase; 500 erro de banco. Filtro .eq('lead_id', id) + .or(tenantScopeOrFilter) — propostas de outro tenant não aparecem. Retorna {data:[...]} (vazio se nenhum).
- **Casos de teste:**
  - **Listagem feliz** - DADO Lead com 2 propostas no tenant da sessão . QUANDO GET /api/crm/leads/{id}/propostas . ENTAO 200 com data contendo as 2 propostas em ordem desc de criado_em
  - **Sem sessão** - DADO Request anônimo . QUANDO GET /api/crm/leads/{id}/propostas . ENTAO 401
  - **Propostas de outro tenant não vazam** - DADO Lead com proposta tenant B; sessão tenant A . QUANDO GET /api/crm/leads/{id}/propostas . ENTAO 200 com data:[] (proposta do tenant B filtrada)

### POST /api/crm/leads/[id]/propostas
- **Auth:** requireCrmSessao
- **Proposito:** Cria proposta para o lead (hub_propostas) com status default 'rascunho' e validade default 7 dias; registra atividade tipo 'proposta' na timeline do lead.
- **Regras:** JSON inválido → 400. titulo obrigatório (trim) → 400 'Título obrigatório'. valor coagido a número (NaN → 0). Campos opcionais: escopo, prazo_dias, validade_dias (default 7), servico_id, status (default 'rascunho'). tenant_id da sessão. Sucesso → 201 {data}; erro insert → 500.
- **Casos de teste:**
  - **Criação feliz** - DADO Sessão válida e lead existente . QUANDO POST com {titulo:'Reforma cozinha', valor:25000} . ENTAO 201 com data (status 'rascunho', validade_dias 7, tenant da sessão); atividade 'Proposta criada: Reforma cozinha' na timeline
  - **Sem título** - DADO Sessão válida . QUANDO POST com {valor:1000} sem titulo . ENTAO 400 'Título obrigatório'
  - **Sem auth** - DADO Request sem sessão CRM . QUANDO POST /api/crm/leads/{id}/propostas . ENTAO 401

### PATCH /api/crm/leads/[id]/propostas/[propostaId]
- **Auth:** requireCrmSessao + guard de posse (proposta do lead E do tenant; senão 404)
- **Proposito:** Edita proposta e gerencia ciclo de vida de status com transições validadas (transicaoValida) e carimbos temporais: enviada→enviada_em; aprovada→aprovado_em+aprovado_por; aceita/recusada→respondida_em. Mudança de status gera atividade tipo 'proposta' na timeline.
- **Regras:** JSON inválido → 400. Allowlist: titulo, valor, escopo, prazo_dias, validade_dias, servico_id, status, motivo_recusa. Proposta inexistente (id+lead_id) ou tenant divergente → 404 'Proposta não encontrada'. Transição de status inválida → 409 com mensagem 'Transição inválida: X → Y'. status 'recusada' exige motivo_recusa → 400 'Informe o motivo da recusa.'.
- **Casos de teste:**
  - **Envio da proposta (rascunho → enviada)** - DADO Proposta em status 'rascunho' do tenant da sessão . QUANDO PATCH com {status:'enviada'} . ENTAO 200 com data.status='enviada' e enviada_em carimbado; atividade 'Proposta enviada: ...' criada
  - **Transição inválida** - DADO Proposta em status 'rascunho' . QUANDO PATCH com {status:'aceita'} (pulo não permitido pelo mapa de transições) . ENTAO 409 'Transição inválida: Rascunho → Aceita.' (labels conforme propostaStatusLabel)
  - **Recusa sem motivo / cross-tenant** - DADO Proposta 'enviada' do tenant A; sessão tenant A sem motivo OU sessão tenant B . QUANDO PATCH {status:'recusada'} sem motivo_recusa; ou qualquer PATCH vindo do tenant B . ENTAO 400 'Informe o motivo da recusa.' no primeiro caso; 404 'Proposta não encontrada' no segundo

### DELETE /api/crm/leads/[id]/propostas/[propostaId]
- **Auth:** requireCrmSessao + guard de posse por tenant (404 se outro tenant)
- **Proposito:** Exclui (hard delete) a proposta do lead após confirmar existência e posse pelo tenant.
- **Regras:** Proposta inexistente (id+lead_id) → 404; tenant divergente → 404. Sucesso → 200 {ok:true}. Erro de banco → 500.
- **Casos de teste:**
  - **Exclusão feliz** - DADO Proposta existente do lead no tenant da sessão . QUANDO DELETE /api/crm/leads/{id}/propostas/{propostaId} . ENTAO 200 {ok:true} e a proposta não aparece mais no GET de propostas
  - **Proposta de outro tenant** - DADO Proposta com tenant_id = B; sessão tenant A . QUANDO DELETE na proposta . ENTAO 404 'Proposta não encontrada' e o registro permanece no banco
  - **Id não pertencente ao lead** - DADO propostaId válido mas vinculado a outro lead_id . QUANDO DELETE com par (leadId, propostaId) que não casa . ENTAO 404 'Proposta não encontrada'

### POST /api/crm/leads/[id]/converter-negocio
- **Auth:** requireCrmComercial + guard de posse do lead por tenant (404)
- **Proposito:** Converte lead em negócio: gera código por prefixo de mercado (default IMB, ou derivado do metadata do lead), resolve pipeline do mercado (fallback negocios-global), copia pessoa/empresa do lead, cria hub_negocios (status 'aberto', etapa 'novo_negocio'), cria vínculos ricos (hub_negocio_vinculos, incl. parceiro do metadata se feature flag vinculoParceiroAuto), registra atividade e move o lead para estágio convertido_negocio.
- **Regras:** IDEMPOTÊNCIA: se o lead já tem negócio ABERTO no tenant → 200 {data: existente, idempotente:true} (não duplica). Lead inexistente ou de outro tenant → 404. Body opcional: {titulo, prefixo_mercado, ...}; título default 'Negócio — <nome do lead>'. Falha nos vínculos (exceto tabela ausente) → 207 'Negócio criado, mas vínculos falharam' com data. Erro no insert → 500. Sucesso novo → 201 {data:negocio}.
- **Casos de teste:**
  - **Conversão feliz** - DADO Lead qualificado do tenant sem negócio aberto . QUANDO POST /api/crm/leads/{id}/converter-negocio com body {} (vazio permitido) . ENTAO 201 com negócio (codigo com prefixo de mercado, status 'aberto', etapa 'novo_negocio', lead_id preenchido); lead vira estágio convertido_negocio; atividade 'Negócio <codigo> criado...'
  - **Idempotência (duplo clique)** - DADO Lead que já possui negócio com status 'aberto' no tenant . QUANDO POST novamente na mesma rota . ENTAO 200 com {data: negócio existente, idempotente:true}; nenhum negócio novo criado
  - **Lead de outro tenant** - DADO Lead com tenant_id = B; sessão comercial do tenant A . QUANDO POST converter-negocio . ENTAO 404 'Lead não encontrado'

### GET /api/crm/negocios
- **Auth:** requireCrmSessao
- **Proposito:** Lista paginada de negócios (20 por página) com filtros (busca, status, etapa, prefixo_mercado, pipeline_id) + KPIs agregados de TODO o pipeline (não só a página): pipeline_total (soma excluindo ganho/perdido), etapa_totais e etapa_counts — via RPC crm_negocios_pipeline_totais (primário) ou agregação app-side limitada a 50k (fallback).
- **Regras:** Escopo tenant via tenantScopeOrFilter. offset via query (limit fixo 20). busca sanitizada aplica ilike em titulo/codigo. Coluna aditiva proxima_acao_em: se ausente no banco, refaz o SELECT legado sem ela. Erro → 500. Resposta {data, total (count exact), pipeline_total, etapa_totais, etapa_counts}.
- **Casos de teste:**
  - **Listagem com KPI estável ao paginar** - DADO Tenant com 25 negócios abertos . QUANDO GET /api/crm/negocios?offset=0 e depois ?offset=20 . ENTAO 200 nas duas chamadas; data com 20 e 5 itens; pipeline_total e etapa_totais IDÊNTICOS nas duas páginas
  - **Filtro por etapa e prefixo** - DADO Negócios em várias etapas e mercados . QUANDO GET ?etapa=proposta&prefixo_mercado=ARQ . ENTAO 200 com data contendo apenas negócios com etapa 'proposta' e prefixo_mercado 'ARQ'
  - **Sem sessão** - DADO Request anônimo . QUANDO GET /api/crm/negocios . ENTAO 401

### POST /api/crm/negocios
- **Auth:** requireCrmComercial
- **Proposito:** Cria negócio direto (wizard): valida payload (validarNegocioCadastro), resolve pipeline pelo mercado se pipeline_id ausente, valida existência de todos os vínculos (lead_ids/pessoa_ids/empresa_ids/parceiro_ids, UUIDs dedupados), gera código por prefixo, insere hub_negocios com múltiplos fallbacks de schema legado (tipo obrigatório, lead_id NOT NULL → cria 'lead de apoio' automático), registra evento negocio_criado e grava vínculos N:N.
- **Regras:** JSON inválido → 400; validação (titulo, prefixo_mercado, etapa, status, valor_estimado...) → 400. IDs de vínculo inexistentes → 400 '<Entidade> não encontrado(s).'. Tabela hub_negocios ausente (PGRST205) → 503. Compat legado pode devolver 'warning' no 201. Vínculos falharam pós-criação → 207 {error, data, warning}. Sucesso → 201 {data, warning}.
- **Casos de teste:**
  - **Criação feliz com vínculos** - DADO Sessão comercial; pessoa e lead existentes no tenant . QUANDO POST com {titulo:'Casa Alphaville', prefixo_mercado:'ARQ', etapa:'novo_negocio', status:'aberto', valor_estimado:80000, lead_ids:[leadId], pessoa_ids:[pessoaId]} . ENTAO 201 com data (codigo ARQ-..., pipeline do mercado resolvido); vínculos gravados em hub_negocio_vinculos; evento negocio_criado emitido
  - **Vínculo inexistente** - DADO Body com pessoa_ids contendo UUID que não existe em hub_pessoas . QUANDO POST /api/crm/negocios . ENTAO 400 com {error:'Pessoa não encontrado(s).'}
  - **Permissão insuficiente** - DADO Sessão nível atendente . QUANDO POST /api/crm/negocios . ENTAO 403 (requireCrmComercial)

### GET /api/crm/negocios/[id]
- **Auth:** requireCrmSessao + guard de posse por tenant (404)
- **Proposito:** Ficha do negócio: dados + lead de origem (via lead_id ou hub_negocio_vinculos papel='lead_origem') + pessoa + timeline (hub_atividades por negocio_id, 50) + propostas + estágios reais do pipeline do negócio (hub_pipeline_estagios ativos, ordenados, com tipo_fecho).
- **Regras:** Negócio inexistente → 404; tenant divergente → 404. Coluna aditiva proxima_acao_em ausente → refaz SELECT legado (degrada sem quebrar). Sem pipeline → estagios:[] (UI cai na lista legada). Resposta {data, lead, pessoa, timeline, propostas, estagios}.
- **Casos de teste:**
  - **Ficha completa com estágios do pipeline** - DADO Negócio do tenant com pipeline_id válido e lead de origem via vínculo . QUANDO GET /api/crm/negocios/{id} . ENTAO 200 com data, lead resolvido (mesmo com hub_negocios.lead_id NULL, via papel lead_origem), estagios com slugs/labels/tipo_fecho do pipeline
  - **Negócio de outro tenant** - DADO Negócio com tenant_id = B; sessão tenant A . QUANDO GET /api/crm/negocios/{id} . ENTAO 404 'Negócio não encontrado'
  - **Id inexistente** - DADO UUID sem correspondência . QUANDO GET /api/crm/negocios/{id} . ENTAO 404 'Negócio não encontrado'

### PATCH /api/crm/negocios/[id]
- **Auth:** requireCrmComercial + guard de posse por tenant (404) + escopo de tenant repetido no UPDATE (anti-TOCTOU)
- **Proposito:** Atualiza negócio (allowlist) e move etapa do funil. Etapa é validada contra os slugs do pipeline do negócio; o tipo_fecho da etapa-alvo (ganho/perdido/aberto) DERIVA o status quando o caller só manda {etapa} (kanban). Mudança de etapa gera atividade, log CRM (etapa_alterada) e evento keystone (negocio_ganho/perdido/etapa_mudou). NÃO cria obra/projeto automaticamente ao ganhar (gate humano — converter-obra).
- **Regras:** JSON inválido → 400. Allowlist: titulo, descricao, tipo, prefixo_mercado, pessoa_id, empresa_id, lead_id, pipeline_id, valor_estimado, valor_fechado, percentual_comissao, status, etapa, motivo_perda, proxima_acao, proxima_acao_em, data_previsao_fechamento, data_fechamento. Etapa fora do pipeline → 400 'Etapa inválida para o pipeline deste negócio.'. validarMudancaNegocio: perdido exige motivo → 400. Coluna proxima_acao_em ausente → degrada. 404 inexistente/outro tenant; 500 falha no update.
- **Casos de teste:**
  - **Ganho via kanban só com {etapa}** - DADO Negócio aberto cujo pipeline tem etapa com tipo_fecho='ganho' . QUANDO PATCH com body {etapa:'<slug da etapa de ganho>'} sem enviar status . ENTAO 200 com status derivado para 'ganho'; atividade 'Etapa: X → Y', log etapa_alterada e evento de fecho registrados; nenhuma obra criada automaticamente
  - **Etapa inválida para o pipeline** - DADO Negócio com pipeline_id cujo conjunto de slugs não inclui 'xyz' . QUANDO PATCH com {etapa:'xyz'} . ENTAO 400 'Etapa inválida para o pipeline deste negócio.'
  - **Cross-tenant bloqueado** - DADO Negócio do tenant B; sessão comercial do tenant A . QUANDO PATCH com {valor_fechado:999999} . ENTAO 404 'Negócio não encontrado' e valor inalterado

### POST /api/crm/negocios/[id]/converter-obra
- **Auth:** requireCrmComercial
- **Proposito:** Geração MANUAL da entrega do negócio (obra ou projeto) via derivarEntregaDoNegocio — idempotente, não duplica. É o gate humano pós-ganho ('Negócio ganho — gerar entrega'). Aceita override body.tipo_alvo ('obra' | 'projeto').
- **Regras:** Body opcional (JSON inválido tratado como {}). Delegação total a derivarEntregaDoNegocio(id, {override, tenant_id da sessão, origem:'manual'}): erro → status do resultado (ex.: 404 negócio inexistente/outro tenant, 400 regra). Sucesso: ja_existia=true → 200; nova entrega → 201 {data, tipo, ja_existia}.
- **Casos de teste:**
  - **Gerar obra pela primeira vez** - DADO Negócio ganho do tenant sem entrega derivada . QUANDO POST /api/crm/negocios/{id}/converter-obra . ENTAO 201 com {data, tipo, ja_existia:false}
  - **Idempotência** - DADO Negócio que já teve entrega derivada . QUANDO POST novamente . ENTAO 200 com {ja_existia:true} e nenhuma entrega duplicada
  - **Permissão insuficiente** - DADO Sessão nível atendente . QUANDO POST converter-obra . ENTAO 403 (requireCrmComercial)

### POST /api/crm/negocios/[id]/nota
- **Auth:** requireCrmComercial + guard de posse por tenant (404)
- **Proposito:** Registra nota manual na timeline do negócio (hub_atividades tipo 'nota'), herdando lead_id do negócio quando existir.
- **Regras:** descricao obrigatória (trim) → 400 'Escreva a nota.'. Negócio inexistente ou de outro tenant → 404 'Negócio não encontrado'. Texto truncado em 2000 chars; tenant_id da sessão. Sucesso → 201 {data:{id,tipo,descricao,criado_em}}; erro insert → 500.
- **Casos de teste:**
  - **Nota criada** - DADO Negócio do tenant da sessão . QUANDO POST com {descricao:'Cliente aprovou o orçamento por telefone'} . ENTAO 201 com data tipo 'nota'; registro em hub_atividades com negocio_id e lead_id do negócio
  - **Nota vazia** - DADO Sessão comercial . QUANDO POST com {descricao:''} . ENTAO 400 'Escreva a nota.'
  - **Negócio de outro tenant** - DADO Negócio tenant B; sessão tenant A . QUANDO POST nota . ENTAO 404 'Negócio não encontrado'

### GET /api/crm/negocios/[id]/relacionados
- **Auth:** requireCrmSessao + guard de posse por tenant (404); escopo de tenant em TODAS as sub-consultas
- **Proposito:** Grafo de relacionados do negócio, tudo por NOME (código de identidade escondido — regra do dono): pessoas/empresas/parceiros (via hub_negocio_vinculos, com 'papel' de cada um), lead de origem, obras e projetos derivados, e linhagem pai/raiz/filhos (colunas aditivas negocio_pai_id/negocio_raiz_id, best-effort — banco antigo degrada para linhagem vazia).
- **Regras:** 404 negócio inexistente/outro tenant; 500 erro de banco. SELECT de vínculos defensivo (coluna 'papel' ausente → refaz sem ela). Limites: 200 vínculos, 50 obras/projetos/filhos. Resposta {data:{pessoas, empresas, parceiros, leads, obras, projetos, linhagem:{pai,raiz,filhos}}} — cada item {id, nome, papel?}.
- **Casos de teste:**
  - **Relacionados completos com papel** - DADO Negócio do tenant com vínculos pessoa (papel 'cliente') e parceiro (papel 'indicador'), uma obra derivada . QUANDO GET /api/crm/negocios/{id}/relacionados . ENTAO 200 com pessoas[0].papel='cliente', parceiros[0].papel='indicador', obras com {id,nome} por título — nenhum código exposto
  - **Negócio de outro tenant** - DADO Negócio tenant B; sessão tenant A . QUANDO GET relacionados . ENTAO 404 'Negócio não encontrado'
  - **Sem vínculos nem linhagem** - DADO Negócio recém-criado sem vínculos, banco sem colunas de linhagem . QUANDO GET relacionados . ENTAO 200 com arrays vazios e linhagem {pai:null, raiz:null, filhos:[]} (não quebra)

### GET /api/crm/negocios/[id]/financeiro-rede
- **Auth:** requireCrmSessao + posse do negócio por tenant (404)
- **Proposito:** Painel financeiro de rede do negócio: participantes (hub_negocio_vinculos), comissões (hub_comissoes), títulos a pagar/receber (hub_negocio_titulos), extrato (hub_negocio_fin_movimentos, 100) e pote_previsto = (valor_fechado ?? valor_estimado) × percentual_comissao. Tolerante a motor ausente: tabelas de comissão inexistentes → arrays vazios + motor_pendente:true + aviso.
- **Regras:** 503 sem config. 404 negócio inexistente/outro tenant. Todas as consultas com .eq('tenant_id'). Resposta {negocio:{...pote_previsto, apurado}, participantes, comissoes, titulos, movimentos, motor_pendente, aviso?}.
- **Casos de teste:**
  - **Painel com motor ativo** - DADO Negócio do tenant com valor_fechado=100000, percentual_comissao=5 e comissões apuradas . QUANDO GET /api/crm/negocios/{id}/financeiro-rede . ENTAO 200 com negocio.pote_previsto=5000, apurado:true, comissoes/titulos/movimentos preenchidos e motor_pendente:false
  - **Motor pendente (migração ausente)** - DADO Banco sem as tabelas hub_comissoes/hub_negocio_titulos . QUANDO GET financeiro-rede . ENTAO 200 com arrays vazios, motor_pendente:true e aviso 'Motor de comissões ainda não ativo (migração pendente).'
  - **Negócio de outro tenant** - DADO Negócio tenant B; sessão tenant A . QUANDO GET financeiro-rede . ENTAO 404 'Negócio não encontrado'

### POST /api/crm/negocios/[id]/financeiro-rede
- **Auth:** requireCrmFinanceiro (permissão financeira) + posse do negócio por tenant (404)
- **Proposito:** Ações de dinheiro do negócio, cada uma delegada a um RPC SECURITY DEFINER fail-closed: acao='apurar' (congela split — rpc_apurar_comissoes), acao='receber' (recebimento do cliente → comissão exigível pro-rata — rpc_registrar_recebimento_negocio), acao='liberar' (dupla chave → autoriza pagamento de título — rpc_liberar_pagamento_comissao). tenant_id/criado_por SEMPRE da sessão, nunca do body.
- **Regras:** JSON inválido → 400. acao fora de {apurar, receber, liberar} → 400 'ação inválida'. apurar: valor_fechado numérico > 0 obrigatório → 400; fatias array opcional; motor ausente → 503. receber: valor > 0 obrigatório → 400. liberar: titulo_id string obrigatória → 400 'titulo_id ausente.'. Erro do RPC → 500 com a mensagem.
- **Casos de teste:**
  - **Apurar comissões** - DADO Sessão com permissão financeira e negócio do tenant com participantes . QUANDO POST com {acao:'apurar', valor_fechado:100000, fatias:[...]} . ENTAO 200 com o retorno do rpc_apurar_comissoes (split congelado)
  - **Valor inválido no receber** - DADO Sessão financeira válida . QUANDO POST com {acao:'receber', valor:0} . ENTAO 400 'Informe o valor recebido.'
  - **Permissão insuficiente** - DADO Sessão CRM sem nível financeiro . QUANDO POST {acao:'apurar', ...} . ENTAO 403 (requireCrmFinanceiro); GET na mesma rota continua acessível com sessão comum

### POST /api/crm/negocios/copilot
- **Auth:** requireCrmSessao + rate limit IA por tenant (requireIaRateLimit, teto 20 — chave negocio-copilot:<tenantId>)
- **Proposito:** Copiloto IA do wizard de criação de negócios: envia histórico (últimas 12 mensagens user/assistant válidas) + resumo do draft à Mistral (MISTRAL_MODEL ou mistral-small-latest, temp 0.35, máx 700 tokens). Sucesso → registra metering de tokens (Tijolos, best-effort) e responde {reply, provider:'mistral', model}. Falha da IA → resposta determinística local {reply, provider:'fallback', detail} (nunca 500 por falha do LLM).
- **Regras:** JSON inválido → 400. messages filtradas: role ∈ {user, assistant} e content string não-vazia. Sem nenhuma mensagem de user → 400 'Mensagem do utilizador é obrigatória.'. Rate limit excedido → resposta do guard (429). draft opcional (titulo, prefixo_mercado, etapa, valor_estimado, ids de vínculos, pipeline_id).
- **Casos de teste:**
  - **Resposta do copiloto (ou fallback)** - DADO Sessão válida e body {messages:[{role:'user', content:'o que está faltando?'}], draft:{titulo:'Obra X'}} . QUANDO POST /api/crm/negocios/copilot . ENTAO 200 com {reply não-vazio, provider:'mistral'|'fallback'} — nunca 500 por indisponibilidade do LLM
  - **Sem mensagem de usuário** - DADO Body {messages:[{role:'assistant', content:'oi'}]} . QUANDO POST copilot . ENTAO 400 'Mensagem do utilizador é obrigatória.'
  - **Rate limit por tenant** - DADO Mais de 20 chamadas do mesmo tenant dentro da janela do limitador . QUANDO POST copilot repetidamente . ENTAO 429 (resposta do requireIaRateLimit) nas chamadas excedentes

### GET /api/crm/encaminhamentos
- **Auth:** requireCrmComercial
- **Proposito:** Lista os encaminhamentos (hub_encaminhamentos) de um lead específico, escopados ao tenant da sessão, ordenados por criado_em desc.
- **Regras:** Query param lead_id OBRIGATÓRIO → 400 'lead_id obrigatório' se ausente. Filtro .eq('tenant_id') estrito. Erro → 500. Resposta {data:[...]}.
- **Casos de teste:**
  - **Listagem por lead** - DADO Lead do tenant com 2 encaminhamentos . QUANDO GET /api/crm/encaminhamentos?lead_id={leadId} . ENTAO 200 com data contendo os 2 registros em ordem desc
  - **Sem lead_id** - DADO Sessão comercial válida . QUANDO GET /api/crm/encaminhamentos . ENTAO 400 'lead_id obrigatório'
  - **Isolamento de tenant** - DADO Encaminhamentos do lead pertencem ao tenant B; sessão tenant A . QUANDO GET com o lead_id do tenant B . ENTAO 200 com data:[] (filtro estrito por tenant)

### POST /api/crm/encaminhamentos
- **Auth:** requireCrmComercial + feature flag CRM_ENCAMINHAMENTO_V2 (senão 403)
- **Proposito:** Cria encaminhamento pendente de lead para parceiro/destinatário via lib compartilhada criarEncaminhamentoPendente (inclui guard de posse/IDOR do lead no tenant). Campos: lead_id, negocio_id, destinatario_pessoa_id/empresa_id, segmento, responsavel_envio, sugerido_ia, validado_humano, status, criterio_selecao, encaminhado_em.
- **Regras:** Flag encaminhamentoV2 desligada → 403 'Encaminhamento V2 desativado. Defina CRM_ENCAMINHAMENTO_V2=true.'. lead_id obrigatório → 400. status default 'aguardando_validacao'; deve pertencer à lista STATUS_VALIDOS (12 valores: sugerido_ia, aguardando_validacao, aprovado_envio, enviado, recebido, aceito, recusado, sem_resposta, em_atendimento, convertido_negocio, perdido, bloqueado) → 400 'status inválido'. Erro da lib → status do resultado. Sucesso → 201 com o registro.
- **Casos de teste:**
  - **Criação feliz** - DADO Flag V2 ativa, sessão comercial e lead do tenant . QUANDO POST com {lead_id, segmento:'reforma', status:'aguardando_validacao'} . ENTAO 201 com o encaminhamento criado no tenant da sessão
  - **Status inválido** - DADO Flag V2 ativa . QUANDO POST com {lead_id, status:'foo'} . ENTAO 400 'status inválido'
  - **Feature flag desligada** - DADO CRM_ENCAMINHAMENTO_V2 não definida/false . QUANDO POST /api/crm/encaminhamentos . ENTAO 403 com instrução para ativar a flag

### PATCH /api/crm/encaminhamentos
- **Auth:** requireCrmComercial + guard de posse por tenant (404)
- **Proposito:** Atualiza o status de um encaminhamento (id e status no BODY, não na URL) com carimbos: 'enviado'→enviado_em; 'aceito'/'recusado'→respondido_em + resposta_destinatario; validado_humano===true seta a flag. Registra log CRM (status_alterado) com valor anterior/novo.
- **Regras:** id e status obrigatórios no body → 400 'id e status obrigatórios'. Encaminhamento inexistente ou de outro tenant → 404 'Encaminhamento não encontrado.'. Erro no update → 500. Sucesso → 200 {ok:true}. Observação: o status NÃO é validado contra STATUS_VALIDOS neste PATCH (apenas no POST).
- **Casos de teste:**
  - **Marcar como enviado** - DADO Encaminhamento do tenant em 'aprovado_envio' . QUANDO PATCH com {id, status:'enviado'} . ENTAO 200 {ok:true}; enviado_em carimbado; log status_alterado com anterior/novo
  - **Campos ausentes** - DADO Sessão comercial . QUANDO PATCH com {id} sem status . ENTAO 400 'id e status obrigatórios'
  - **Cross-tenant** - DADO Encaminhamento do tenant B; sessão tenant A . QUANDO PATCH com {id do B, status:'aceito'} . ENTAO 404 'Encaminhamento não encontrado.'

### GET /api/crm/encaminhamentos/pendentes
- **Auth:** requireCrmComercial
- **Proposito:** Fila de validação humana: lista até 50 encaminhamentos por status (default 'aguardando_validacao') do tenant, enriquecidos com dados do lead (nome/telefone/código) e com o criterio_selecao (JSON) parseado em parceiro_sugerido, parceiro_id e lista de candidatos.
- **Regras:** Query param status opcional (default aguardando_validacao). Filtro .eq('tenant_id') estrito. criterio_selecao não-JSON → tratado como parceiro_nome literal. Lead ausente → lead_nome '—'. Erro → 500. Resposta {data:[{id, lead_id, lead_nome, lead_telefone, lead_codigo, segmento, status, sugerido_ia, criado_em, parceiro_sugerido, parceiro_id, candidatos}]}.
- **Casos de teste:**
  - **Fila pendente enriquecida** - DADO Encaminhamento aguardando_validacao no tenant com criterio_selecao JSON {parceiro_id, parceiro_nome, candidatos:[...]} . QUANDO GET /api/crm/encaminhamentos/pendentes . ENTAO 200 com data[0] trazendo lead_nome real, parceiro_sugerido e candidatos parseados
  - **Filtro por outro status** - DADO Encaminhamentos 'enviado' e 'aguardando_validacao' no tenant . QUANDO GET ?status=enviado . ENTAO 200 com data contendo apenas os de status 'enviado'
  - **Permissão insuficiente** - DADO Sessão nível atendente . QUANDO GET pendentes . ENTAO 403 (requireCrmComercial)

### POST /api/crm/encaminhamentos/[id]/aprovar
- **Auth:** requireCrmComercial + guard de posse por tenant (404)
- **Proposito:** Aprova o encaminhamento e ENVIA o lead ao parceiro (WhatsApp real) via aprovarEEnviarEncaminhamento; aceita override body.parceiro_id para escolher outro candidato.
- **Regras:** Encaminhamento inexistente ou de outro tenant → 404 'Encaminhamento não encontrado.'. Body JSON opcional ({} se inválido). Falha da lib (regra/envio) → 400 com {error}. Sucesso → 200 {ok:true, telefone} (telefone do parceiro notificado).
- **Casos de teste:**
  - **Aprovação e envio** - DADO Encaminhamento aguardando_validacao do tenant com parceiro sugerido válido . QUANDO POST /api/crm/encaminhamentos/{id}/aprovar com body {} . ENTAO 200 com {ok:true, telefone} e status do encaminhamento avançado pela lib
  - **Cross-tenant** - DADO Encaminhamento do tenant B; sessão tenant A . QUANDO POST aprovar . ENTAO 404 'Encaminhamento não encontrado.'
  - **Falha de regra no envio** - DADO Encaminhamento em estado que a lib rejeita (ex.: parceiro inválido/sem telefone) . QUANDO POST aprovar . ENTAO 400 com {error} retornado pela lib

### POST /api/crm/encaminhamentos/[id]/recusar
- **Auth:** requireCrmComercial + guard de posse por tenant (404)
- **Proposito:** Cascata de rejeição: marca o encaminhamento como 'recusado' + evento lead_recusado; busca o PRÓXIMO candidato elegível (não bloqueado financeiramente) na lista de criterio_selecao; se existir, cria novo encaminhamento 'aprovado_envio' (preservando card_resumo do lead, sem re-chamar a IA), envia ao parceiro e emite lead_recolocado; se NÃO existir, devolve o lead à fila (estagio 'qualificado') e emite lead_sem_proximo.
- **Regras:** 404 inexistente/outro tenant; 500 se erro ao ler ou ao criar o novo encaminhamento ('Falha ao recolocar o lead.'). Candidato elegível: parceiro_id ≠ atual e status_financeiro ≠ 'bloqueado' (default 'em_dia'). Resposta com próximo: {ok:true, proximo:{parceiro_id, nome}, enviado}; sem próximo: {ok:true, proximo:null, mensagem:'Sem próximo candidato — lead voltou à fila.'}.
- **Casos de teste:**
  - **Cascata com próximo candidato** - DADO Encaminhamento do tenant com criterio_selecao contendo candidatos [A (atual), B (em_dia)] . QUANDO POST /api/crm/encaminhamentos/{id}/recusar . ENTAO 200 com proximo = B; encaminhamento original vira 'recusado'; novo encaminhamento 'aprovado_envio' criado para B; eventos lead_recusado e lead_recolocado registrados
  - **Sem próximo — lead volta à fila** - DADO Encaminhamento cujo criterio_selecao só tem o candidato atual (ou os demais estão bloqueados) . QUANDO POST recusar . ENTAO 200 com proximo:null; lead atualizado para estagio 'qualificado'; evento lead_sem_proximo
  - **Cross-tenant** - DADO Encaminhamento do tenant B; sessão tenant A . QUANDO POST recusar . ENTAO 404 'Encaminhamento não encontrado.'

### GET /api/crm/indicacoes
- **Auth:** requireCrmSessao
- **Proposito:** 'Minhas indicações': lista até 100 leads do tenant que possuem metadata.indicacao (semáforo por estágio), retornando comprovante_codigo, indicador_nome, regra_texto e resultado de cada indicação.
- **Regras:** Filtro estrito .eq('tenant_id') + .not('metadata->indicacao','is',null). 503 sem config Supabase. Resposta {indicacoes:[{lead_id, indicado_nome, indicado_telefone, estagio, criado_em, comprovante_codigo, indicador_nome, regra_texto, resultado}]}.
- **Casos de teste:**
  - **Listagem de indicações** - DADO Tenant com 2 leads criados via indicação e 1 lead comum . QUANDO GET /api/crm/indicacoes . ENTAO 200 com indicacoes contendo apenas os 2 leads indicados, com comprovante_codigo e indicador_nome do carimbo
  - **Sem sessão** - DADO Request anônimo . QUANDO GET /api/crm/indicacoes . ENTAO 401
  - **Tenant vazio** - DADO Tenant sem leads indicados . QUANDO GET /api/crm/indicacoes . ENTAO 200 com {indicacoes:[]}

### POST /api/crm/indicacoes
- **Auth:** requireCrmSessao
- **Proposito:** Indicar em 1 toque: resolve o INDICADOR (parceiro casado pelo e-mail do usuário logado, senão 'Hub') e a regra de comissão (hub_parceiros.comissao_pct → senão padrão Hub); DEDUPLICA por telefone (first-touch imutável: duplicado devolve comprovante de TENTATIVA, não cria/sobrescreve); cria o lead pela via oficial (pessoa garantida + código LED + carimbo imutável metadata.indicacao) e emite evento indicacao_registrada (ou indicacao_duplicada). registrado_por (quem apertou) ≠ indicador (quem recebe comissão).
- **Regras:** JSON inválido → 400. nome mín. 2 letras → 400; telefone obrigatório → 400; telefone normalizado precisa ter 10-13 dígitos → 400 'Telefone inválido (informe DDD + número).'. mercado e observacao opcionais. Duplicado (dedup no escopo tenant+legado ou corrida 23505) → 200 {ok:true, resultado:'duplicado', comprovante, aviso} SEM criar lead. Sucesso → 201 {ok:true, resultado:'lead_criado', lead_id, comprovante (codigo IND-YYYY-######, indicador, regra_pct, regra_texto)}. Erro de banco → 500.
- **Casos de teste:**
  - **Indicação cria lead com carimbo** - DADO Sessão válida e telefone inédito no tenant . QUANDO POST com {nome:'Carlos Indicado', telefone:'11988887777', mercado:'ARQ'} . ENTAO 201 com resultado:'lead_criado', lead_id e comprovante com comprovante_codigo 'IND-...', indicador (parceiro do usuário ou Hub) e regra_texto; lead nasce com origem 'indicacao' e metadata.indicacao
  - **Duplicado first-touch** - DADO Lead já existente com o mesmo telefone no tenant . QUANDO POST com o telefone repetido . ENTAO 200 com resultado:'duplicado', comprovante de tentativa e aviso de que a atribuição do primeiro registro permanece; nenhum lead novo criado
  - **Telefone inválido** - DADO Sessão válida . QUANDO POST com {nome:'Ana', telefone:'123'} . ENTAO 400 'Telefone inválido (informe DDD + número).'


---

## CADASTROS (pessoas, empresas, contatos, vínculos, especialistas, fornecedores, imóveis, super-cadastro, catálogo, serviços, taxonomia, canais-entrada)

### GET /api/crm/pessoas
- **Auth:** requireCrmSessao (qualquer nível logado: owner/gestor/comercial/atendente)
- **Proposito:** Lista pessoas (hub_pessoas) do tenant com busca, filtros e paginação; enriquece linhas (compat de schema).
- **Regras:** Query params: busca (sanitizada p/ PostgREST; ilike em nome/email/telefone/codigo/documento), tipo_pessoa, estado, origem, area_atuacao, offset (default 0), limit (default 200, max 500). Escopo por tenantScopeOrFilter (tenant da sessão + legado NULL/Obra10). Exclui arquivadas (arquivado_em IS NULL — soft-delete some da lista). Fallback de SELECT reduzido se colunas novas não existirem. Resposta {data, total}.
- **Casos de teste:**
  - **Listagem feliz com filtro** - DADO Sessão CRM válida e pessoas ativas no tenant . QUANDO GET /api/crm/pessoas?tipo_pessoa=PF&limit=10 . ENTAO 200 com {data:[...], total:N}; só pessoas PF do tenant, sem arquivadas
  - **Sem sessão** - DADO Requisição sem cookie/sessão CRM . QUANDO GET /api/crm/pessoas . ENTAO 401 (erro do guard requireCrmSessao)
  - **Pessoa arquivada não aparece** - DADO Pessoa com arquivado_em preenchido (excluída via DELETE) . QUANDO GET /api/crm/pessoas . ENTAO 200 e a pessoa arquivada NÃO está em data

### POST /api/crm/pessoas
- **Auth:** requireCrmComercial (comercial+; atendente é 403)
- **Proposito:** Cria pessoa (PF/PJ) com código sequencial e dedup por telefone/documento no tenant.
- **Regras:** 503 se Supabase não configurado. 400 se JSON inválido ou validarPessoaCadastro falhar (nome/telefone/tipo_pessoa etc.). Dedup escopado por tenant: telefone duplicado → 409 'Telefone já cadastrado neste escritório.'; documento (CPF/CNPJ) duplicado → 409 com label PF/PJ. Insert com retry tolerante a colunas ausentes (tenant_id, endereço); unique violation 23505 → 409 genérico. Sucesso: 201 {data} com pessoa enriquecida e codigo gerado.
- **Casos de teste:**
  - **Criação feliz** - DADO Sessão comercial+ e payload válido {nome, telefone único, tipo_pessoa:'PF'} . QUANDO POST /api/crm/pessoas . ENTAO 201 com data.id e data.codigo gerados
  - **Telefone duplicado** - DADO Já existe pessoa com o mesmo telefone no tenant . QUANDO POST com o mesmo telefone . ENTAO 409 {error:'Telefone já cadastrado neste escritório.'}
  - **Nível insuficiente** - DADO Sessão de atendente . QUANDO POST /api/crm/pessoas . ENTAO 403 do guard requireCrmComercial

### GET /api/crm/pessoas/[id]
- **Auth:** requireCrmSessao
- **Proposito:** Carrega a ficha completa de uma pessoa (SELECT estendido com fallback core).
- **Regras:** 400 se id não é UUID normalizável. Guard de tenant (carregarPessoaDoTenant): registro de outro tenant → 404 'Pessoa não encontrada.' (NULL/tenant Obra10 padrão = legado partilhado, acessível). 503 sem config Supabase. Resposta {data} enriquecida.
- **Casos de teste:**
  - **Ficha feliz** - DADO Pessoa existente no tenant da sessão . QUANDO GET /api/crm/pessoas/{uuid} . ENTAO 200 {data} com campos da pessoa
  - **ID inválido** - DADO Sessão válida . QUANDO GET /api/crm/pessoas/abc . ENTAO 400 {error:'ID inválido.'}
  - **Cross-tenant vira 404** - DADO Pessoa pertence a OUTRO tenant . QUANDO GET com id dessa pessoa . ENTAO 404 'Pessoa não encontrada.' (não vaza existência)

### PATCH /api/crm/pessoas/[id]
- **Auth:** requireCrmGestor (gestor/owner)
- **Proposito:** Edita campos da pessoa (whitelist) com validação de documento e merge de dados_extras de endereço.
- **Regras:** Whitelist: nome, telefone, email, documento, tipo, tipo_pessoa, empresa, origem, area_atuacao, cep, logradouro, numero, complemento, bairro, cidade, estado. 400 id inválido/JSON inválido/nenhum campo. Guard de tenant → 404. Se documento/tipo_pessoa no body: validarDocumentoDisponivelPatch (formato + dedup no tenant, exclui o próprio id) → 409 se indisponível. Endereço vai também para dados_extras (merge com existente). Fallback de update sem colunas de endereço se schema antigo.
- **Casos de teste:**
  - **Edição feliz** - DADO Sessão gestor e pessoa do tenant . QUANDO PATCH {nome:'Novo Nome'} . ENTAO 200 {data} com nome atualizado e atualizado_em novo
  - **Documento em uso** - DADO Outra pessoa do tenant já tem o CPF enviado . QUANDO PATCH {documento:'<cpf duplicado>', tipo_pessoa:'PF'} . ENTAO 409 com erro de documento indisponível
  - **Comercial não edita** - DADO Sessão de nível comercial . QUANDO PATCH /api/crm/pessoas/{id} . ENTAO 403 do guard requireCrmGestor

### DELETE /api/crm/pessoas/[id]
- **Auth:** requireCrmGestor
- **Proposito:** Arquiva (soft-delete) a pessoa via excluirPessoaCrm e registra auditoria (registrarAuditoriaCrm com snapshot).
- **Regras:** 503 sem SUPABASE_SERVICE_ROLE_KEY. 400 id inválido. Guard de tenant → 404. Nunca apaga de verdade: arquiva (arquivado_em) — princípio 'delete só arquiva'. Auditoria best-effort com actor dos headers. Resposta {ok:true, nome, codigo}.
- **Casos de teste:**
  - **Arquivamento feliz** - DADO Gestor e pessoa ativa do tenant . QUANDO DELETE /api/crm/pessoas/{id} . ENTAO 200 {ok:true,nome,codigo}; pessoa some do GET de lista mas permanece no banco (arquivado_em setado)
  - **Pessoa de outro tenant** - DADO Id válido pertencente a outro escritório . QUANDO DELETE . ENTAO 404 'Pessoa não encontrada.'
  - **Permissão insuficiente** - DADO Sessão comercial . QUANDO DELETE . ENTAO 403

### GET /api/crm/pessoas/duplicatas
- **Auth:** requireCrmGestor
- **Proposito:** Lista pares candidatos a duplicata (mesmo documento OU telefone OU e-mail) no mesmo tenant — read-only, não mescla.
- **Regras:** Carrega até 5000 pessoas ativas do tenant (inclui legado tenant NULL), ignora arquivadas, roda detectarParesDuplicados. Fallback de SELECT core se schema antigo. Resposta {data: pares, total, mergeHabilitado} — mergeHabilitado vem da flag NEXT_PUBLIC_CRM_MERGE_DUPLICATAS.
- **Casos de teste:**
  - **Detecção feliz** - DADO Duas pessoas do tenant com o mesmo telefone . QUANDO GET /api/crm/pessoas/duplicatas . ENTAO 200 com pelo menos 1 par em data e total>=1
  - **Comercial bloqueado** - DADO Sessão comercial . QUANDO GET duplicatas . ENTAO 403 (gestor/owner-only)
  - **Sem duplicatas** - DADO Base sem chaves repetidas . QUANDO GET duplicatas . ENTAO 200 {data:[], total:0, mergeHabilitado:bool}

### POST /api/crm/pessoas/merge
- **Auth:** requireCrmGestor + feature flag NEXT_PUBLIC_CRM_MERGE_DUPLICATAS
- **Proposito:** Mescla duas pessoas via RPC crm_merge_pessoas (vencedor absorve perdedor; perdedor é arquivado).
- **Regras:** Flag OFF → 403 {code:'merge_em_homologacao'}. Body {vencedor_id, perdedor_id}: ambos UUID obrigatórios (400), não podem ser iguais (400). RPC recebe tenant e user da sessão; mensagens da RPC mapeadas: 'não encontrado'→404; documentos/tenants diferentes, já arquivada, mesmo registo→409; função inexistente→503; resto→500. Sucesso: {ok:true,...resultado} + auditoria best-effort.
- **Casos de teste:**
  - **Merge feliz (flag ON)** - DADO Flag ativa, duas pessoas duplicadas do mesmo tenant . QUANDO POST {vencedor_id, perdedor_id} . ENTAO 200 {ok:true}; perdedor arquivado e referências movidas
  - **Flag OFF** - DADO NEXT_PUBLIC_CRM_MERGE_DUPLICATAS desativada . QUANDO POST merge válido . ENTAO 403 {code:'merge_em_homologacao'}
  - **Mesmo registo** - DADO vencedor_id === perdedor_id . QUANDO POST . ENTAO 400 'Vencedor e perdedor não podem ser o mesmo registo.'

### GET /api/crm/pessoas/verificar-documento
- **Auth:** requireCrmSessao (anti-oráculo: não é público)
- **Proposito:** Valida formato de CPF/CNPJ e informa disponibilidade no tenant (pré-check de cadastro).
- **Regras:** Query: tipo_pessoa=PF|PJ (senão 400) e documento. Documento vazio → {disponivel:true, valido:false, motivo:'vazio'}. Incompleto (≠11/14 dígitos) ou dígito verificador inválido → 200 com {disponivel:false, valido:false, error}. Busca escopada por tenant (LGPD/anti-enumeração): se existir → {disponivel:false, valido:true, duplicado:true} sem expor nome/id. 503 sem service key.
- **Casos de teste:**
  - **Documento disponível** - DADO CPF válido não cadastrado no tenant . QUANDO GET ?tipo_pessoa=PF&documento=<cpf válido> . ENTAO 200 {disponivel:true, valido:true, duplicado:false}
  - **tipo_pessoa inválido** - DADO Sessão válida . QUANDO GET ?tipo_pessoa=X&documento=123 . ENTAO 400 'tipo_pessoa deve ser PF ou PJ.'
  - **Duplicado sem vazar dados** - DADO CPF já cadastrado no tenant . QUANDO GET com esse CPF . ENTAO 200 {disponivel:false, duplicado:true} — resposta NÃO contém nome/código/id do registro existente

### GET /api/crm/pessoas/[id]/nota
- **Auth:** requireCrmSessao
- **Proposito:** Timeline de registros (hub_atividades) da pessoa — últimos 80, desc por criado_em.
- **Regras:** SELECT id, tipo, descricao, feito_por, feito_por_tipo, criado_em filtrado por pessoa_id. 503 sem config. Sem guard de tenant no id (observação fiel ao código). Resposta {data:[...]}.
- **Casos de teste:**
  - **Timeline feliz** - DADO Pessoa com atividades registradas . QUANDO GET /api/crm/pessoas/{id}/nota . ENTAO 200 {data} ordenada por criado_em desc, máx 80
  - **Sem sessão** - DADO Requisição anônima . QUANDO GET nota . ENTAO 401

### POST /api/crm/pessoas/[id]/nota
- **Auth:** requireCrmComercial
- **Proposito:** Registra nota manual na timeline da pessoa (hub_atividades, tipo 'nota').
- **Regras:** Body {descricao} obrigatória (trim; vazia → 400 'Escreva a nota.'); truncada em 2000 chars. Grava feito_por='humano' e tenant_id da sessão. Resposta 201 {data}.
- **Casos de teste:**
  - **Nota feliz** - DADO Sessão comercial+ e pessoa existente . QUANDO POST {descricao:'Cliente pediu retorno'} . ENTAO 201 com data.tipo='nota' e data.descricao
  - **Nota vazia** - DADO Body {descricao:'  '} . QUANDO POST . ENTAO 400 {error:'Escreva a nota.'}
  - **Atendente bloqueado** - DADO Sessão atendente . QUANDO POST nota . ENTAO 403

### GET /api/crm/pessoas/[id]/vinculos
- **Auth:** requireCrmSessao
- **Proposito:** Rastreabilidade da pessoa: empresas vinculadas (N:N), leads, negócios (diretos + como participante via hub_negocio_vinculos), obras e projetos.
- **Regras:** GUARD multi-tenant: pessoa-raiz precisa ser do tenant (tenant_id NULL = legado ok); senão 404. Negócios: merge direto (pessoa_id) + participante (hub_negocio_vinculos entidade_tipo='pessoa'), dedup por id, ordena desc, máx 20. Obras/projetos carregadas em lote pelos negocio_ids, escopadas por tenant; degradam para [] se tabela/coluna ausente (42P01/42703). Tabela de vínculos ausente → resposta vazia estruturada.
- **Casos de teste:**
  - **Vínculos felizes** - DADO Pessoa com vínculo a empresa e 1 negócio direto . QUANDO GET /api/crm/pessoas/{id}/vinculos . ENTAO 200 {data:{empresas:[{vinculo_id,cargo,principal,...}], leads, negocios, obras, projetos}}
  - **Pessoa de outro tenant** - DADO pessoa_id de outro tenant (ids enumeráveis) . QUANDO GET vinculos . ENTAO 404 'Pessoa não encontrada' — não vaza PII
  - **Pessoa inexistente** - DADO UUID que não existe . QUANDO GET vinculos . ENTAO 404

### GET /api/crm/empresas
- **Auth:** requireCrmSessao
- **Proposito:** Lista empresas (hub_empresas) do tenant com busca, filtros e paginação.
- **Regras:** Params: busca (ilike razao_social/nome_fantasia/cnpj/email/codigo), ativo (''=todos; default true; 'false'=inativas), segmento, prefixo_mercado, estado, offset, limit (default 200, max 500). Escopo tenantScopeOrFilter + arquivado_em IS NULL (soft-delete some; 'ativo' é toggle separado). Fallbacks de SELECT p/ schema antigo. Tabela ausente (PGRST205) → 503 com instrução de migração. Resposta {data, total}.
- **Casos de teste:**
  - **Lista feliz** - DADO Sessão válida, empresas ativas no tenant . QUANDO GET /api/crm/empresas?busca=constru . ENTAO 200 {data,total} filtrado por ilike
  - **Sem sessão** - DADO Anônimo . QUANDO GET empresas . ENTAO 401
  - **Empresa arquivada oculta** - DADO Empresa com arquivado_em setado . QUANDO GET empresas . ENTAO 200 e a empresa não aparece

### POST /api/crm/empresas
- **Auth:** requireCrmSessao (qualquer nível logado — mais permissivo que pessoas)
- **Proposito:** Cria empresa com código sequencial, dedup por CNPJ e telefone.
- **Regras:** 400 JSON/validação (validarEmpresaCadastro: razao_social, cnpj etc.). Dedup CNPJ GLOBAL (sem filtro de tenant no código) → 409 com razao_social+codigo do existente e empresa_id; telefone (se enviado) também 409. Insert tolerante a colunas ausentes; tabela ausente → 503. Sucesso 201 {data} com ativo=true e acesso_habilitado=true.
- **Casos de teste:**
  - **Criação feliz** - DADO Payload válido com CNPJ inédito . QUANDO POST /api/crm/empresas . ENTAO 201 {data} com codigo, ativo:true, acesso_habilitado:true
  - **CNPJ duplicado** - DADO Empresa existente com o mesmo CNPJ . QUANDO POST com esse CNPJ . ENTAO 409 com error citando razao_social e empresa_id do existente
  - **Payload inválido** - DADO Body sem razao_social . QUANDO POST . ENTAO 400 com erro de validação

### GET /api/crm/empresas/[id]
- **Auth:** requireCrmSessao
- **Proposito:** Carrega ficha da empresa (SELECT completo com fallback).
- **Regras:** 400 id não-UUID. Guard de tenant (carregarEmpresaDoTenant): outro tenant → 404 (NULL/Obra10 = legado partilhado). 503 sem config. Resposta {data}.
- **Casos de teste:**
  - **Ficha feliz** - DADO Empresa do tenant . QUANDO GET /api/crm/empresas/{uuid} . ENTAO 200 {data}
  - **Cross-tenant** - DADO Empresa de outro escritório . QUANDO GET . ENTAO 404 'Empresa não encontrada.'
  - **ID inválido** - DADO id='xyz' . QUANDO GET . ENTAO 400 'ID inválido.'

### PATCH /api/crm/empresas/[id]
- **Auth:** requireCrmGestor
- **Proposito:** Edita empresa (whitelist de campos texto + toggles ativo/acesso_habilitado) com validação de CNPJ.
- **Regras:** Whitelist texto: razao_social, nome_fantasia, cnpj, email, telefone, segmento, prefixo_mercado, cep, logradouro, numero, complemento, bairro, cidade, estado (trim). cnpj no body → validarCnpjEmpresaDisponivelPatch (409 se em uso). acesso_habilitado boolean seta acesso_habilitado_em (ISO ou null). ativo boolean. 400 se nenhum campo. Guard de tenant → 404. Fallback de update removendo colunas ausentes.
- **Casos de teste:**
  - **Edição feliz** - DADO Gestor e empresa do tenant . QUANDO PATCH {razao_social:'Nova Razão'} . ENTAO 200 {data} atualizado
  - **CNPJ em conflito** - DADO Outra empresa já usa o CNPJ enviado . QUANDO PATCH {cnpj:<duplicado>} . ENTAO 409
  - **Nenhum campo** - DADO Body {} válido . QUANDO PATCH . ENTAO 400 'Nenhum campo para atualizar.'

### DELETE /api/crm/empresas/[id]
- **Auth:** requireCrmGestor
- **Proposito:** Arquiva (soft-delete) a empresa via excluirEmpresaCrm + auditoria com snapshot.
- **Regras:** 400 id inválido; guard de tenant → 404; 503 sem config. Arquiva via arquivado_em (não hard-delete). Auditoria best-effort. Resposta {ok:true, razao_social, codigo}.
- **Casos de teste:**
  - **Arquivamento feliz** - DADO Gestor, empresa ativa do tenant . QUANDO DELETE /api/crm/empresas/{id} . ENTAO 200 {ok:true}; empresa some da listagem mas permanece no banco
  - **Outro tenant** - DADO Empresa de outro escritório . QUANDO DELETE . ENTAO 404
  - **Comercial bloqueado** - DADO Sessão comercial . QUANDO DELETE . ENTAO 403

### GET /api/crm/empresas/[id]/vinculos
- **Auth:** requireCrmSessao
- **Proposito:** Rastreabilidade da empresa: pessoas vinculadas (N:N com PII), negócios (titular + participante), obras e projetos.
- **Regras:** GUARD multi-tenant na empresa-raiz (404 se de outro tenant; NULL = legado). Negócios diretos (empresa_id, escopo tenant, máx 20) + participantes via hub_negocio_vinculos entidade_tipo='empresa' (dedup). Obras/projetos em lote, degradam para [] em 42P01/42703. Tabela de vínculos ausente → {pessoas:[],negocios:[],obras:[],projetos:[]}.
- **Casos de teste:**
  - **Vínculos felizes** - DADO Empresa com pessoa vinculada e negócio . QUANDO GET /api/crm/empresas/{id}/vinculos . ENTAO 200 {data:{pessoas:[{nome,telefone,email,cargo,...}], negocios, obras, projetos}}
  - **Cross-tenant vira 404** - DADO empresa_id de outro tenant . QUANDO GET vinculos . ENTAO 404 'Empresa não encontrada' — pessoas/PII não vazam
  - **Empresa inexistente** - DADO UUID inexistente . QUANDO GET vinculos . ENTAO 404

### GET /api/crm/contatos
- **Auth:** requireCrmGestor
- **Proposito:** Lista contatos de notificação (hub_contatos_notificacao — quem recebe alertas de lead/aprovação/encaminhamento).
- **Regras:** Escopo .eq('tenant_id') + ativo=true (DELETE arquiva com ativo=false), ordenado por nome. Fallback sem filtro de tenant se coluna tenant_id não existir (42703). Erro 500 com mensagem genérica (não expõe SQL).
- **Casos de teste:**
  - **Lista feliz** - DADO Gestor com contatos ativos no tenant . QUANDO GET /api/crm/contatos . ENTAO 200 {data} só com ativo=true do tenant
  - **Comercial bloqueado** - DADO Sessão comercial . QUANDO GET contatos . ENTAO 403
  - **Contato desativado oculto** - DADO Contato com ativo=false (excluído) . QUANDO GET contatos . ENTAO 200 sem esse contato

### POST /api/crm/contatos
- **Auth:** requireCrmGestor
- **Proposito:** Cria contato de notificação com preferências de canal e tipos de alerta.
- **Regras:** nome obrigatório (400); telefone com ≥10 dígitos (400 'Telefone inválido — informe DDD + número.'). canal ∈ {whatsapp,email,ambos}, default whatsapp. receber_novo_lead/aprovacao/encaminhamento default true; ativo default true. tenant_id da sessão (fallback sem a coluna). 201 {data}.
- **Casos de teste:**
  - **Criação feliz** - DADO Gestor, body {nome:'Maria', telefone:'11999998888'} . QUANDO POST /api/crm/contatos . ENTAO 201 com canal='whatsapp' e flags receber_* true
  - **Telefone curto** - DADO telefone '9999' . QUANDO POST . ENTAO 400 'Telefone inválido — informe DDD + número.'
  - **Canal inválido normalizado** - DADO body {canal:'sms', nome, telefone válidos} . QUANDO POST . ENTAO 201 com canal='whatsapp' (fallback)

### PATCH /api/crm/contatos/[id]
- **Auth:** requireCrmGestor
- **Proposito:** Edita contato de notificação (whitelist EDITAVEIS).
- **Regras:** tenantGuard: contato inexistente ou de outro tenant → 404 (null-safe p/ legado). nome string vazia → 400. canal normalizado ao set válido. tenant_id NUNCA editável. Whitelist: nome, telefone, email, cargo, canal, ativo, receber_*.
- **Casos de teste:**
  - **Edição feliz** - DADO Contato do tenant . QUANDO PATCH {receber_novo_lead:false} . ENTAO 200 {data} com flag alterada
  - **Outro tenant** - DADO Contato pertence a outro tenant . QUANDO PATCH . ENTAO 404 'Contato não encontrado.'
  - **Nome vazio** - DADO body {nome:'  '} . QUANDO PATCH . ENTAO 400 'Nome não pode ficar vazio.'

### DELETE /api/crm/contatos/[id]
- **Auth:** requireCrmGestor
- **Proposito:** Arquiva o contato (ativo=false; nunca hard-delete) — some da listagem.
- **Regras:** tenantGuard → 404 se inexistente/outro tenant. Update {ativo:false, atualizado_em}. Resposta {ok:true}.
- **Casos de teste:**
  - **Arquivamento feliz** - DADO Contato ativo do tenant . QUANDO DELETE /api/crm/contatos/{id} . ENTAO 200 {ok:true}; GET seguinte não lista o contato, registro permanece no banco
  - **Cross-tenant** - DADO Contato de outro tenant . QUANDO DELETE . ENTAO 404

### POST /api/crm/vinculos/pessoa-empresa
- **Auth:** requireCrmComercial
- **Proposito:** Cria vínculo N:N pessoa↔empresa (hub_pessoas_empresas), com criar-e-vincular: cria rascunho de pessoa/empresa só com nome se o alvo ainda não existe.
- **Regras:** Body: pessoa_id/empresa_id OU criar_pessoa_nome/criar_empresa_nome (nomes trim, máx 200 chars; rascunho ganha código sequencial e tenant da sessão). Sem pessoa E empresa resolvidos → 400 'Informe a pessoa e a empresa (ou um nome para criar).'. criarVinculoPessoaEmpresa grava cargo/principal/tenant_id. Sucesso 201 {ok, id, empresa_id, pessoa_id, criou_empresa, criou_pessoa}.
- **Casos de teste:**
  - **Vínculo feliz** - DADO pessoa_id e empresa_id existentes . QUANDO POST {pessoa_id, empresa_id, cargo:'Sócio', principal:true} . ENTAO 201 {ok:true, id} com criou_*:false
  - **Criar-e-vincular** - DADO pessoa existe, empresa não . QUANDO POST {pessoa_id, criar_empresa_nome:'ACME Ltda'} . ENTAO 201 com criou_empresa:true e empresa_id novo (rascunho sem CNPJ)
  - **Faltam alvos** - DADO Body sem ids nem nomes . QUANDO POST . ENTAO 400

### DELETE /api/crm/vinculos/pessoa-empresa?id=...
- **Auth:** requireCrmComercial
- **Proposito:** Remove um vínculo pessoa↔empresa pelo id (query param).
- **Regras:** id obrigatório na query (400). Guard de tenant null-safe: vínculo inexistente ou de outro tenant → 404 'Vínculo não encontrado' (legado tenant NULL passa). Resposta {ok:true}.
- **Casos de teste:**
  - **Remoção feliz** - DADO Vínculo existente do tenant . QUANDO DELETE ?id={vinculo_id} . ENTAO 200 {ok:true}
  - **Sem id** - DADO Query sem id . QUANDO DELETE . ENTAO 400 'id obrigatório'
  - **Vínculo de outro tenant** - DADO id de vínculo com tenant divergente . QUANDO DELETE . ENTAO 404 'Vínculo não encontrado'

### GET /api/crm/especialistas
- **Auth:** requireCrmSessao
- **Proposito:** Lista especialistas (mão de obra, sem login) do tenant — formato Membros.
- **Regras:** Escopo ESTRITO .eq('tenant_id') puro (nunca .or(is.null) — evitaria over-share cross-tenant sob service_role). Filtro opcional ?verificado=true. Ordena por criado_em desc, limit 100. Resposta {data, total}.
- **Casos de teste:**
  - **Lista feliz** - DADO Especialistas cadastrados no tenant . QUANDO GET /api/crm/especialistas . ENTAO 200 {data,total} só do tenant da sessão
  - **Filtro verificado** - DADO Mix de verificados e não . QUANDO GET ?verificado=true . ENTAO 200 apenas verificado=true
  - **Sem sessão** - DADO Anônimo . QUANDO GET . ENTAO 401

### POST /api/crm/especialistas
- **Auth:** requireCrmComercial
- **Proposito:** Cadastra especialista com código atômico (rpc crm_proximo_codigo, prefixo ESP) e dedup de CPF por tenant.
- **Regras:** nome obrigatório (400); telefone ≥10 dígitos (400). CPF normalizado (só dígitos); se enviado, dedup ESTRITO no tenant → 409 'Já existe um especialista com este CPF na rede.'. especialidades array → especialidade_principal = primeira. Grava origem='cadastro', cadastrado_por=userId, tenant_id da sessão. 201 {data}.
- **Casos de teste:**
  - **Cadastro feliz** - DADO Body {nome, telefone válido, especialidades:['eletricista']} . QUANDO POST /api/crm/especialistas . ENTAO 201 com codigo ESP-... e especialidade_principal='eletricista'
  - **CPF duplicado no tenant** - DADO Especialista com o mesmo CPF já no tenant . QUANDO POST com esse CPF . ENTAO 409
  - **Atendente bloqueado** - DADO Sessão atendente . QUANDO POST . ENTAO 403

### GET /api/crm/especialistas/[id]
- **Auth:** requireCrmComercial
- **Proposito:** Ficha completa do especialista (inclui bio, observações, destaque).
- **Regras:** Busca por id; inexistente → 404. Isolamento de tenant null-safe: tenant divergente → 404 'Especialista não encontrado'. Resposta {data} (inclui tenant_id no select).
- **Casos de teste:**
  - **Ficha feliz** - DADO Especialista do tenant . QUANDO GET /api/crm/especialistas/{id} . ENTAO 200 {data}
  - **Outro tenant** - DADO Especialista de outro tenant . QUANDO GET . ENTAO 404

### PATCH /api/crm/especialistas/[id]
- **Auth:** requireCrmComercial
- **Proposito:** Edita especialista (whitelist de 15 campos incl. verificado/destaque).
- **Regras:** Guard de tenant null-safe → 404. nome vazio → 400. especialidades array atualiza especialidade_principal (primeira); tamanho_equipe → Number ou null. Sempre seta atualizado_em. Resposta {data}.
- **Casos de teste:**
  - **Edição feliz** - DADO Especialista do tenant . QUANDO PATCH {verificado:true} . ENTAO 200 {data.verificado:true}
  - **Nome vazio** - DADO body {nome:''} . QUANDO PATCH . ENTAO 400 'Nome não pode ficar vazio'
  - **Cross-tenant** - DADO Especialista de outro tenant . QUANDO PATCH . ENTAO 404

### GET /api/crm/especialistas/convite
- **Auth:** requireCrmComercial
- **Proposito:** Devolve o userId da sessão ({por}) para montar o link de convite de especialista (rastreio de quem convidou, não-falsificável).
- **Regras:** Sem parâmetros; retorna {por: g.ctx.userId} — o cliente compõe `${origin}/especialista/cadastro?por=${por}`.
- **Casos de teste:**
  - **Convite feliz** - DADO Sessão comercial+ . QUANDO GET /api/crm/especialistas/convite . ENTAO 200 {por:'<userId da sessão>'}
  - **Sem permissão** - DADO Sessão atendente ou anônima . QUANDO GET convite . ENTAO 403/401

### GET /api/crm/fornecedores
- **Auth:** requireCrmSessao
- **Proposito:** Lista fornecedores (rede, PJ/PF por área) do tenant, com filtro por status de homologação.
- **Regras:** Escopo ESTRITO .eq('tenant_id') puro. Filtro ?status= (status_acesso). Ordena criado_em desc, limit 100. Resposta {data, total}.
- **Casos de teste:**
  - **Lista feliz** - DADO Fornecedores no tenant . QUANDO GET /api/crm/fornecedores?status=pendente . ENTAO 200 {data} só com status_acesso='pendente' do tenant
  - **Sem sessão** - DADO Anônimo . QUANDO GET . ENTAO 401

### POST /api/crm/fornecedores
- **Auth:** PÚBLICO (sem sessão) — captação com rate limit por IP
- **Proposito:** Captação pública de fornecedor (formulário externo): cria registro pendente de homologação no tenant do Hub.
- **Regras:** Rate limit: 10 req/60s por IP (x-forwarded-for) → 429 'Muitas tentativas. Aguarde um instante.'. nome obrigatório (trim, máx 200; senão 400). tenant SEMPRE defaultTenantId() (Hub) — nunca do header (anti escrita cross-tenant). Código atômico FOR-... via rpc. tipo_pessoa: 'PF' só se explícito, default 'PJ'. status_acesso default 'pendente'; recebe_leads só se ===true. mercado_principal = primeiro de mercados. 201 {data}.
- **Casos de teste:**
  - **Captação pública feliz** - DADO Requisição SEM sessão com {nome:'Fornecedor X'} . QUANDO POST /api/crm/fornecedores . ENTAO 201 com codigo FOR-..., status_acesso='pendente', tenant do Hub
  - **Rate limit** - DADO 11ª requisição do mesmo IP em 60s . QUANDO POST . ENTAO 429
  - **Nome ausente** - DADO Body sem nome . QUANDO POST . ENTAO 400 'Nome obrigatório'

### GET /api/crm/fornecedores/[id]
- **Auth:** requireCrmGestor (dossiê tem PII + comissao_pct — caminho do dinheiro)
- **Proposito:** Ficha completa do fornecedor (cnpj/cpf/email/telefone/comissao_pct/bio/instagram/site).
- **Regras:** Inexistente → 404. Tenant divergente → 404 (legado tenant NULL = partilhado). Resposta {data}.
- **Casos de teste:**
  - **Ficha feliz** - DADO Gestor e fornecedor do tenant . QUANDO GET /api/crm/fornecedores/{id} . ENTAO 200 {data} incl. comissao_pct
  - **Comercial bloqueado** - DADO Sessão comercial . QUANDO GET . ENTAO 403
  - **Outro tenant** - DADO Fornecedor de outro escritório . QUANDO GET . ENTAO 404

### PATCH /api/crm/fornecedores/[id]
- **Auth:** requireCrmGestor
- **Proposito:** Edita fornecedor (whitelist de 18 campos incl. comissao_pct) com auditoria de mudança de comissão.
- **Regras:** nome vazio → 400. Whitelist EDITAVEIS; mercados array atualiza mercado_principal. Update escopado: .eq(id) + .or(tenantScopeOrFilter) (fallback sem filtro se coluna ausente); sem linha → 404 (inexistente OU fora do tenant). Se comissao_pct mudou de fato → registrarLogCrm('comissao_alterada') com valor anterior/novo (best-effort, não derruba o PATCH). Resposta {data}.
- **Casos de teste:**
  - **Edição feliz com auditoria** - DADO Fornecedor do tenant com comissao_pct=5 . QUANDO PATCH {comissao_pct:10} . ENTAO 200 {data.comissao_pct:10} e log 'comissao_alterada' registrado (5→10)
  - **Cross-tenant vira 404** - DADO Fornecedor de outro tenant . QUANDO PATCH . ENTAO 404 'Fornecedor não encontrado' (update não afeta linha)
  - **Permissão insuficiente** - DADO Sessão comercial . QUANDO PATCH . ENTAO 403

### GET /api/crm/imoveis
- **Auth:** requireCrmSessao
- **Proposito:** Lista imóveis do tenant com filtros, paginação fixa de 20 e contagem real por finalidade (venda/locação).
- **Regras:** Params: busca (ilike titulo/cidade/bairro), ativo (default true; 'false' lista inativos), tipo, finalidade, status, offset. Escopo tenantScopeOrFilter. Segunda query agregada (até 5000) conta finalidade sobre TODO o conjunto filtrado (não só a página). Resposta {data, total, finalidade_counts:{venda,locacao}}.
- **Casos de teste:**
  - **Lista com contagens** - DADO Imóveis venda e locação no tenant . QUANDO GET /api/crm/imoveis . ENTAO 200 com data (máx 20), total e finalidade_counts refletindo o conjunto inteiro
  - **Filtro finalidade** - DADO Imóveis mistos . QUANDO GET ?finalidade=locacao . ENTAO 200 apenas locação
  - **Sem sessão** - DADO Anônimo . QUANDO GET . ENTAO 401

### POST /api/crm/imoveis
- **Auth:** requireCrmComercial
- **Proposito:** Cria imóvel com código sequencial (prefixo de imóvel) ou código informado.
- **Regras:** 400 JSON inválido ou titulo vazio. Defaults: tipo='apartamento', finalidade='venda', status='disponivel' (status 'captacao' violaria check constraint 23514), ativo=true. Numéricos convertidos (valor, dormitorios, area_total_m2). tenant_id da sessão (fallback sem coluna). Erro de insert → 500 com mensagem genérica 'Não foi possível salvar o imóvel.' (não vaza SQL). 201 {data}.
- **Casos de teste:**
  - **Criação feliz** - DADO Sessão comercial+, body {titulo:'Apto Centro', valor:500000} . QUANDO POST /api/crm/imoveis . ENTAO 201 com codigo gerado e defaults aplicados
  - **Sem título** - DADO Body {} . QUANDO POST . ENTAO 400 'Título obrigatório'
  - **Atendente bloqueado** - DADO Sessão atendente . QUANDO POST . ENTAO 403

### PATCH /api/crm/imoveis/[id]
- **Auth:** requireCrmComercial
- **Proposito:** Edita imóvel (campos permitidos: titulo, tipo, finalidade, status, cidade, estado, bairro, valor, ativo, dormitorios, area_total_m2).
- **Regras:** 400 se id não bate regex UUID estrita. Guard de tenant (carregarImovelDoTenant): outro tenant → 404 (NULL/Obra10 = legado). 400 se nenhum campo além de atualizado_em. Resposta {data} com select reduzido.
- **Casos de teste:**
  - **Edição feliz** - DADO Imóvel do tenant . QUANDO PATCH {status:'vendido', ativo:false} . ENTAO 200 {data} atualizado
  - **ID malformado** - DADO id='123' . QUANDO PATCH . ENTAO 400 'ID inválido'
  - **Cross-tenant** - DADO Imóvel de outro tenant . QUANDO PATCH . ENTAO 404 'Imóvel não encontrado'

### POST /api/crm/cadastro
- **Auth:** requireCrmComercial
- **Proposito:** Super-cadastro em uma chamada: cria pessoa (+empresa opcional, +lead opcional) com snapshot OpenCNPJ — orquestrado por salvarSuperCadastro.
- **Regras:** 503 sem config. 400 JSON inválido ou validarSuperCadastro reprovado. Tenant SEMPRE da sessão (nunca do header). opencnpj_snapshot opcional (objeto) anexado. Erros do saver propagam status próprio (ex.: 409 de dedup interno). Sucesso 201 {data:{pessoa_id, empresa_id?, lead_id?, codigo_pessoa?, codigo_lead?, aviso?, pessoa}}.
- **Casos de teste:**
  - **Super-cadastro feliz** - DADO Payload válido com pessoa + empresa + lead . QUANDO POST /api/crm/cadastro . ENTAO 201 com pessoa_id, empresa_id e lead_id preenchidos
  - **Validação reprovada** - DADO Payload sem campos obrigatórios da pessoa . QUANDO POST . ENTAO 400 com {error} do validador
  - **Atendente bloqueado** - DADO Sessão atendente . QUANDO POST . ENTAO 403

### POST /api/crm/cadastro/bulk-delete
- **Auth:** requireCrmGestor
- **Proposito:** Arquiva em lote pessoas OU empresas (soft-delete via excluirPessoaCrm/excluirEmpresaCrm), item a item, com relatório de falhas.
- **Regras:** Body {tipo:'pessoa'|'empresa', ids:[...]}: tipo inválido ou ids vazio → 400; máx 100 ids (400); ids dedupados e filtrados (strings não vazias). Cada exclusão respeita escopo de tenant (via helpers). Resposta 200 sempre: {ok: erros.length===0, excluidos, falhas, erros:[{id,error}]}.
- **Casos de teste:**
  - **Lote feliz** - DADO 3 pessoas do tenant . QUANDO POST {tipo:'pessoa', ids:[a,b,c]} . ENTAO 200 {ok:true, excluidos:3, falhas:0}
  - **Acima do limite** - DADO 101 ids . QUANDO POST . ENTAO 400 'Máximo de 100 registos por operação.'
  - **Lote parcial com id de outro tenant** - DADO 2 ids válidos + 1 de outro tenant . QUANDO POST . ENTAO 200 {ok:false, excluidos:2, falhas:1, erros:[{id,error}]}

### GET /api/crm/catalogo
- **Auth:** requireCrmSessao
- **Proposito:** Master dos dropdowns Click-and-Go (hub_catalogo): disciplinas, áreas/andares, materiais — global (tenant NULL) + do tenant.
- **Regras:** Param opcional ?categoria= (ex.: disciplina). Só ativo=true, ordenado por ordem. Tolerante: tabela ausente (migração E0 pendente) → fallback in-code das 15 DISCIPLINAS_PADRAO (apenas p/ categoria vazia ou 'disciplina') com migracao_pendente:true. Resposta {data, migracao_pendente}.
- **Casos de teste:**
  - **Catálogo feliz** - DADO Tabela hub_catalogo populada . QUANDO GET /api/crm/catalogo?categoria=disciplina . ENTAO 200 {data:[...], migracao_pendente:false} ordenado por ordem
  - **Fallback sem tabela** - DADO Migração E0 não aplicada . QUANDO GET ?categoria=disciplina . ENTAO 200 com 15 disciplinas in-code e migracao_pendente:true
  - **Sem sessão** - DADO Anônimo . QUANDO GET . ENTAO 401

### GET /api/crm/servicos
- **Auth:** requireCrmSessao
- **Proposito:** Catálogo de serviços do tenant (hub_servicos) para o Click-and-Go da proposta (título + faixa de valor pré-preenchidos).
- **Regras:** Só ativo=true, escopo tenantScopeOrFilter (global NULL + tenant), ordena por nome, limit 200. Resposta {servicos:[{id,nome,categoria,faixa_preco_min,faixa_preco_max,prazo_medio_dias}]} — nota: chave é 'servicos', não 'data'.
- **Casos de teste:**
  - **Lista feliz** - DADO Serviços ativos no tenant . QUANDO GET /api/crm/servicos . ENTAO 200 {servicos:[...]} em ordem alfabética
  - **Sem sessão** - DADO Anônimo . QUANDO GET . ENTAO 401

### GET /api/crm/taxonomia
- **Auth:** requireCrmSessao
- **Proposito:** Catálogo controlado de atividades por disciplina (descritivo padrão + sinônimos) — serve a UI ambiente-first e futura IA de orçamento.
- **Regras:** Param opcional ?disciplina= (ex.: eletrica). Lê global (tenant NULL) + tenant via carregarTaxonomia, que NUNCA lança: sem tabela (migração E0.5 pendente) devolve fallback in-code com migracao_pendente:true. Resposta {data, migracao_pendente}.
- **Casos de teste:**
  - **Taxonomia feliz** - DADO Tabela populada . QUANDO GET /api/crm/taxonomia?disciplina=eletrica . ENTAO 200 {data} filtrada pela disciplina, migracao_pendente:false
  - **Fallback in-code** - DADO Migração E0.5 não aplicada . QUANDO GET /api/crm/taxonomia . ENTAO 200 com dados in-code e migracao_pendente:true (nunca 500)
  - **Sem sessão** - DADO Anônimo . QUANDO GET . ENTAO 401

### GET /api/crm/canais-entrada
- **Auth:** requireCrmSessao
- **Proposito:** Lista canais de entrada de leads (hub_canais_entrada) ativos do tenant — sem tokens/segredos.
- **Regras:** Escopo .eq('tenant_id') PURO (sem is.null — anti over-share) + ativo=true (DELETE arquiva), ordena criado_em asc. Resposta {data}.
- **Casos de teste:**
  - **Lista feliz** - DADO Canais ativos do tenant . QUANDO GET /api/crm/canais-entrada . ENTAO 200 {data} só ativos do tenant
  - **Canal desativado oculto** - DADO Canal com ativo=false . QUANDO GET . ENTAO 200 sem esse canal
  - **Sem sessão** - DADO Anônimo . QUANDO GET . ENTAO 401

### POST /api/crm/canais-entrada
- **Auth:** requireCrmGestor
- **Proposito:** Cria canal de entrada (fonte de lead) com tipo controlado.
- **Regras:** nome obrigatório (400). tipo ∈ {whatsapp, meta_ads, google_ads, site, indicacao, manual}; inválido → 'manual'. origem_slug default = tipo. ativo default true. tenant_id da sessão. 201 {data}.
- **Casos de teste:**
  - **Criação feliz** - DADO Gestor, body {nome:'WhatsApp Loja', tipo:'whatsapp'} . QUANDO POST /api/crm/canais-entrada . ENTAO 201 com origem_slug='whatsapp' e ativo:true
  - **Tipo inválido normalizado** - DADO body {nome:'X', tipo:'telegram'} . QUANDO POST . ENTAO 201 com tipo='manual'
  - **Comercial bloqueado** - DADO Sessão comercial . QUANDO POST . ENTAO 403

### PATCH /api/crm/canais-entrada/[id]
- **Auth:** requireCrmGestor
- **Proposito:** Edita canal de entrada (whitelist: tipo, nome, identificador, origem_slug, ativo, observacao).
- **Regras:** tenantGuard null-safe: inexistente/outro tenant → 404 'Canal não encontrado.'. nome string vazia → 400. ativo só vira true se ===true; demais campos trim ou null. Resposta {data}.
- **Casos de teste:**
  - **Edição feliz** - DADO Canal do tenant . QUANDO PATCH {nome:'Novo Nome'} . ENTAO 200 {data} atualizado
  - **Cross-tenant** - DADO Canal de outro tenant . QUANDO PATCH . ENTAO 404
  - **Nome vazio** - DADO body {nome:' '} . QUANDO PATCH . ENTAO 400 'Nome não pode ficar vazio'

### DELETE /api/crm/canais-entrada/[id]
- **Auth:** requireCrmGestor
- **Proposito:** Arquiva o canal (ativo=false, nunca hard-delete) — some da listagem.
- **Regras:** tenantGuard → 404 se inexistente/outro tenant. Update {ativo:false}. Resposta {ok:true}.
- **Casos de teste:**
  - **Arquivamento feliz** - DADO Canal ativo do tenant . QUANDO DELETE /api/crm/canais-entrada/{id} . ENTAO 200 {ok:true}; canal some do GET mas permanece no banco
  - **Cross-tenant** - DADO Canal de outro tenant . QUANDO DELETE . ENTAO 404 'Canal não encontrado.'
  - **Permissão insuficiente** - DADO Sessão comercial . QUANDO DELETE . ENTAO 403


---

## ATENDIMENTO / WHATSAPP / COPILOTO / CICLOS / CRON / ML

### GET /api/whatsapp/pausas
- **Auth:** requireCrmGestor (gestor ou owner)
- **Proposito:** Lista a deny-list de pausas do atendimento IA (hub_atendimento_pausas): telefone, fonte, labelid, motivo, criado_por, criado_em — até 1000 linhas, ordenado por criado_em desc.
- **Regras:** Guard gestor/owner obrigatório (retorna erro do guard se sessão inválida/insuficiente). Erro de banco → 500 {error}. Sucesso → {ok:true, total, pausas[]}.
- **Casos de teste:**
  - **Listar pausas como gestor** - DADO sessão válida de gestor/owner e pelo menos 1 registro em hub_atendimento_pausas . QUANDO GET /api/whatsapp/pausas . ENTAO 200 com {ok:true, total>=1, pausas[]} contendo telefone/fonte/motivo
  - **Sem permissão** - DADO sessão de papel comercial/atendente (abaixo de gestor) ou sem sessão . QUANDO GET /api/whatsapp/pausas . ENTAO resposta de erro do guard (401 sem sessão / 403 papel insuficiente), sem dados

### POST /api/whatsapp/pausas
- **Auth:** requireCrmGestor (gestor ou owner)
- **Proposito:** Gerencia a deny-list de pausa por action: 'sync' (sincroniza etiqueta 'pausa' do WhatsApp), 'seed' (semeia telefones[] de clientes ativos, fonte='seed'), 'pausar' (pausa manual, fonte='painel'), 'retomar' (remove pausas comando/painel/seed do número).
- **Regras:** JSON inválido → 400. action fora de sync|seed|pausar|retomar → 400. sync: sem instância WhatsApp conectada → 409; falha na sincronização → 502. seed: telefones[] vazio/ausente → 400; responde {ok, recebidos, adicionados, falhas[]}. pausar/retomar: telefone obrigatório (400 se ausente); falha da lib → 400. tenantId vem do contexto do gestor.
- **Casos de teste:**
  - **Pausar telefone manualmente** - DADO sessão gestor e body {action:'pausar', telefone:'5511988887777'} . QUANDO POST /api/whatsapp/pausas . ENTAO 200 {ok:true} e telefone presente no GET com fonte='painel', motivo='pausa_manual'
  - **Action inválida** - DADO sessão gestor e body {action:'xyz'} . QUANDO POST /api/whatsapp/pausas . ENTAO 400 {error:'action inválida — use sync | seed | pausar | retomar.'}
  - **Sync sem instância conectada** - DADO sessão gestor e nenhuma instância WhatsApp ativa no tenant . QUANDO POST com {action:'sync'} . ENTAO 409 {error:'Nenhuma instância WhatsApp conectada para sincronizar.'}

### GET /api/whatsapp/webhook
- **Auth:** Público (verificação Meta-style opcional via WHATSAPP_VERIFY_TOKEN)
- **Proposito:** Verificação do webhook (hub.mode=subscribe: devolve hub.challenge se hub.verify_token confere com WHATSAPP_VERIFY_TOKEN) e health-check (sem hub.mode devolve {status:'ok', service:'obra10plus-webhook', version:'2.0'}).
- **Regras:** hub.mode=subscribe com token errado ou WHATSAPP_VERIFY_TOKEN ausente → 403 {error:'Forbidden'}. Com token correto e challenge presente → 200 texto puro com o challenge. Sem hub.mode → 200 JSON de status.
- **Casos de teste:**
  - **Health-check** - DADO nenhum query param . QUANDO GET /api/whatsapp/webhook . ENTAO 200 {status:'ok', service:'obra10plus-webhook', version:'2.0'}
  - **Verificação subscribe com token errado** - DADO hub.mode=subscribe&hub.verify_token=errado&hub.challenge=123 . QUANDO GET /api/whatsapp/webhook . ENTAO 403 {error:'Forbidden'}

### POST /api/whatsapp/webhook
- **Auth:** Público com verificação de origem: HMAC SHA-256 (x-hub-signature-256/x-signature) OU Bearer OU header configurável (WEBHOOK_SECRET_HEADER, default x-webhook-secret) OU query param — todos contra WEBHOOK_SECRET (timing-safe). Em produção sem WEBHOOK_SECRET → 500. Dev pode pular com WEBHOOK_SKIP_SIGNATURE_VERIFY=true.
- **Proposito:** Recebe mensagens inbound do WhatsApp (UAZAPI). Fluxo: autentica → parseia → (fromMe: comando /pausa|/retoma ou handoff humano) → dedupe (memória 2min + hub_msg_jobs por canal+message_id) → rate limit 20/remetente → identifica intenção/mercado → intenção 'parceiro' cria hub_parceiros+captação+alerta → senão encontra/cria pessoa (telefone canônico) e lead (hub_leads_crm) → enfileira job em hub_msg_jobs (upsert onConflict canal,message_id) e dispara o worker.
- **Regras:** Auth falha → 401 {code:'WEBHOOK_AUTH_FAILED'}. JSON inválido → 400. Telefone <10 dígitos → 200 {status:'ignored', reason:'invalid_phone'}. Duplicado (message_id) → 200 ignored. Rate limit excedido → 200 {reason:'rate_limited'} (200 de propósito p/ evitar retry-storm). message_id ausente → 200 {reason:'missing_message_id'}. Falha ao criar lead → 500 {code:'LEAD_CREATE_FAILED'}. Mensagem fromMe com '/pausa'|'/retoma' → 200 {status:'comando_pausa'} + alerta durável em hub_alertas; fromMe normal → human takeover (humano_responsavel no lead + cancela jobs IA). Sucesso → 200 {status:'accepted'|'duplicate', lead_id, mercado, queue:'hub_msg_jobs'}. Novo lead notifica contatos de hub_contatos_notificacao.
- **Casos de teste:**
  - **Mensagem inbound válida cria lead e enfileira job** - DADO WEBHOOK_SECRET configurado e payload UAZAPI de mensagem de texto de telefone novo com message_id, assinado com HMAC correto . QUANDO POST /api/whatsapp/webhook . ENTAO 200 {status:'accepted', lead_id, queue:'hub_msg_jobs'}; lead criado em hub_leads_crm e job em hub_msg_jobs
  - **Assinatura inválida** - DADO WEBHOOK_SECRET configurado e request sem HMAC/Bearer/secret válido . QUANDO POST /api/whatsapp/webhook com body qualquer . ENTAO 401 {error:'Não autorizado', code:'WEBHOOK_AUTH_FAILED'}
  - **Dedupe por message_id** - DADO mesma mensagem (mesmo message_id+telefone) já processada . QUANDO POST repetido do mesmo payload autenticado . ENTAO 200 {status:'ignored', reason:'duplicate_message_id_memory'|'duplicate_message_id'} sem novo job

### GET /api/crm/atendimento
- **Auth:** requireCrmSessao (qualquer papel CRM ativo)
- **Proposito:** Inbox do atendimento: lista leads do tenant da sessão (filtro opcional ?estagio=), anexa a última mensagem de cada lead (de hub_fila_mensagens + hub_mensagens legado), marca aguardando_desde quando a última é de entrada, e ordena por atividade recente.
- **Regras:** Isolamento por .eq('tenant_id', sessao.ctx.tenantId). estagio='todos' ou ausente → sem filtro de estágio. Erro de banco → 500 {error, leads:[]}. Cada lead retorna ultima_mensagem {conteudo, direcao, criado_em} ou null.
- **Casos de teste:**
  - **Inbox do tenant com preview** - DADO sessão válida e leads do tenant com mensagens em hub_fila_mensagens . QUANDO GET /api/crm/atendimento . ENTAO 200 {leads[]} com ultima_mensagem preenchida e ordenado por atividade (mais recente primeiro)
  - **Filtro por estágio** - DADO sessão válida e leads em estágios variados . QUANDO GET /api/crm/atendimento?estagio=novo . ENTAO 200 apenas com leads de estagio='novo' do tenant
  - **Sem sessão** - DADO request sem cookie de sessão válido . QUANDO GET /api/crm/atendimento . ENTAO 401 (erro do guard requireCrmSessao)

### POST /api/crm/atendimento/send
- **Auth:** resolveCallerAuthId (cookie de sessão validado no Supabase) + resolveOperador (usuário ativo); envio para lead de outro operador exige role owner/admin
- **Proposito:** Operador humano envia mensagem WhatsApp ao lead durante o atendimento assumido: envia via UAZAPI (token da instância do agente responsável ou global), grava em hub_fila_mensagens (direcao='saida'), hub_atividades, atualiza ultimo_contato do lead e registra evento hub_eventos ('mensagem_enviada').
- **Regras:** Sem identidade → 401. JSON inválido → 400. leadId e texto obrigatórios → 400. Operador não encontrado/inativo → 403. Lead buscado com escopo do tenant do operador (tenantScopeOrFilter) → 404 se não achar. Lead sem humano_responsavel (atendimento não assumido) → 403. humano_responsavel ≠ operador e role ∉ {owner,admin} → 403. Lead sem telefone válido → 400. WhatsApp não configurado → 502 (exceto dev/WHATSAPP_DRY_RUN=1, que grava com status 'pendente' e whatsappSkipped:true). Falha no envio UAZAPI → 502. Falha ao gravar fila → 500. Sucesso → {ok:true, whatsappSkipped, whatsapp, operadorSlug, operadorNome}.
- **Casos de teste:**
  - **Envio pelo operador que assumiu** - DADO operador ativo que é o humano_responsavel do lead, lead com telefone, WhatsApp configurado (ou dry-run) . QUANDO POST {leadId, texto:'Olá!'} . ENTAO 200 {ok:true} e linha em hub_fila_mensagens com direcao='saida' e registro em hub_atividades
  - **Lead não assumido** - DADO lead do tenant sem humano_responsavel . QUANDO POST {leadId, texto} . ENTAO 403 {error:'Atendimento humano não assumido para este lead.'}
  - **Operador diferente sem privilégio** - DADO lead assumido por outro operador e chamador com role comercial (não owner/admin) . QUANDO POST {leadId, texto} . ENTAO 403 {error:'Lead está sob atendimento de outro operador (...)'}

### POST /api/crm/atendimento/assumir
- **Auth:** resolveCallerAuthId (sessão validada) + resolveOperador (usuário CRM ativo)
- **Proposito:** Operador humano assume o atendimento de um lead (handoff IA→humano): grava humano_responsavel no lead e cancela jobs de IA pendentes (retorna jobsCancelados).
- **Regras:** Config ausente (crmApiConfigError) → 503. Sem identidade → 401. JSON inválido → 400. leadId obrigatório → 400. Operador não encontrado/inativo → 403. Falha em assumirAtendimentoCrm → 500 {error}. Sucesso → {ok:true, operadorSlug, operadorNome, jobsCancelados}.
- **Casos de teste:**
  - **Assumir com sucesso** - DADO operador ativo e lead existente sob atendimento da IA com jobs pendentes . QUANDO POST {leadId} . ENTAO 200 {ok:true, operadorSlug, jobsCancelados>=0}; lead fica com humano_responsavel do operador
  - **leadId ausente** - DADO sessão válida e body {} . QUANDO POST /api/crm/atendimento/assumir . ENTAO 400 {error:'leadId é obrigatório'}
  - **Sem sessão** - DADO request sem cookie/identidade válida . QUANDO POST {leadId} . ENTAO 401 {error:'Sessão inválida ou identidade ausente.'}

### POST /api/crm/atendimento/devolver
- **Auth:** resolveCallerAuthId (sessão validada) + resolveOperador (usuário CRM ativo)
- **Proposito:** Devolve o lead ao atendimento automático da IA (limpa humano_responsavel via devolverAtendimentoIA).
- **Regras:** Mesmo pipeline do assumir: 503 config ausente, 401 sem identidade, 400 JSON inválido/leadId ausente, 403 operador inexistente/inativo, 500 falha na lib. Sucesso → {ok:true, operadorSlug}.
- **Casos de teste:**
  - **Devolver à IA** - DADO operador ativo e lead assumido por humano . QUANDO POST {leadId} . ENTAO 200 {ok:true, operadorSlug}; lead volta ao fluxo da IA (humano_responsavel limpo)
  - **JSON inválido** - DADO sessão válida e body não-JSON . QUANDO POST /api/crm/atendimento/devolver . ENTAO 400 {error:'JSON inválido'}

### GET /api/crm/atendimento/mensagens?leadId=
- **Auth:** requireCrmSessao (qualquer papel CRM ativo) + checagem de tenant do lead
- **Proposito:** Timeline unificada do chat de um lead: mescla 4 fontes (hub_fila_mensagens, hub_mensagens, hub_msg_jobs inbound histórico, hub_atividades tipo='mensagem'), normaliza para {id, conteudo, direcao, criado_em, agente_id, metadata}, deduplica por conteúdo(50 chars)+janela de 2 min e ordena cronologicamente.
- **Regras:** leadId obrigatório → 400. Lead com tenant_id ≠ tenant da sessão → 404 {error:'Lead não encontrado'} (null-safe: lead sem tenant passa). Atividades tipo 'Assumiu/Devolveu/Retomou' são filtradas (não são chat). Limite 300 linhas por fonte. Erro inesperado → 500.
- **Casos de teste:**
  - **Timeline mesclada e deduplicada** - DADO lead do tenant com mensagens em hub_fila_mensagens e hub_mensagens (algumas duplicadas entre tabelas) . QUANDO GET ?leadId=<id> . ENTAO 200 {mensagens[]} ordenadas por criado_em asc, sem duplicatas (mesma janela 2min + conteúdo)
  - **leadId ausente** - DADO sessão válida . QUANDO GET /api/crm/atendimento/mensagens . ENTAO 400 {error:'leadId é obrigatório', mensagens:[]}
  - **Lead de outro tenant** - DADO leadId existente com tenant_id diferente do tenant da sessão . QUANDO GET ?leadId=<id-alheio> . ENTAO 404 {error:'Lead não encontrado', mensagens:[]}

### POST /api/crm/atendimento/sugerir
- **Auth:** requireCrmSessao (qualquer papel CRM ativo) + escopo de tenant do lead
- **Proposito:** "Mari sugere": IA (Mistral) propõe a próxima resposta ao operador a partir da conversa do lead (sugerirRespostaAtendimento).
- **Regras:** crmConfigError → 503. JSON inválido → 400. lead_id obrigatório → 400. Lead inexistente OU tenant_id ≠ tenant da sessão → 404 {error:'Lead não encontrado.'}. Resultado da lib com ok:false → 400; ok:true → 200 com a sugestão.
- **Casos de teste:**
  - **Sugestão gerada** - DADO lead do tenant com histórico de conversa e chave Mistral configurada . QUANDO POST {lead_id} . ENTAO 200 com {ok:true, ...sugestão de resposta}
  - **lead_id ausente** - DADO sessão válida e body {} . QUANDO POST /api/crm/atendimento/sugerir . ENTAO 400 {error:'lead_id obrigatório'}
  - **Lead de outro tenant** - DADO lead_id de lead com tenant_id diferente do da sessão . QUANDO POST {lead_id} . ENTAO 404 {error:'Lead não encontrado.'}

### POST /api/copiloto/interpretar
- **Auth:** autenticarCopiloto (sessão Supabase do usuário logado; devolve tenantId/userId) + rate limit por tenant
- **Proposito:** Interpreta comando de voz/texto do copiloto: classifica via LLM (Mistral→Anthropic→Groq) em 'navegar' (resolve lead por nome/telefone/'ultimo' → /crm/leads/<id>, ou rota da allowlist), 'ler' (ferramenta de leitura) ou 'escrever' (só allowlist Fase 3). NÃO executa — devolve PROPOSTA assinada com HMAC (confirmacaoId + ts) para o /executar.
- **Regras:** Auth falha → status do auth (401/403). Rate limit → 429. JSON inválido → 400. texto <2 chars → 400 'Diga um comando.'. Saldo de créditos (Tijolos) <0 → 200 {acao:'sem_saldo'}. IA indisponível → 502. COPILOTO segredo HMAC ausente → 503. leadId do contexto entra na assinatura HMAC. Ferramenta fora de leitura/allowlist-escrita → 200 {acao:'nao_entendi'}. Consumo IA registrado em metering (origem 'copiloto_intencao'). Resposta de proposta: {acao, ferramenta, params, descricao, confianca, nivelAcesso, confirmacaoId, ts, modelo}.
- **Casos de teste:**
  - **Comando de leitura vira proposta assinada** - DADO usuário autenticado, saldo ok, comando 'quantos leads novos temos?' . QUANDO POST {texto, contexto:{rota:'/crm'}} . ENTAO 200 {acao:'ler', ferramenta, confirmacaoId, ts, nivelAcesso:'leitura'} — nada executado
  - **Texto vazio** - DADO usuário autenticado . QUANDO POST {texto:'a'} . ENTAO 400 {error:'Diga um comando.'}
  - **Sem sessão** - DADO request sem cookie de sessão . QUANDO POST {texto:'abrir leads'} . ENTAO 401/403 conforme autenticarCopiloto, {error}

### POST /api/copiloto/executar
- **Auth:** autenticarCopiloto (sessão) + validação HMAC da proposta (confirmacaoId/ts/leadId) + allowlist de ferramentas; tenantId SEMPRE da sessão, nunca do body
- **Proposito:** Executa a ferramenta proposta pelo /interpretar após confirmação do usuário: valida assinatura HMAC (amarrada a ferramenta+params+ts+leadId), executa via executarFerramentaHub, audita escritas em hub_decision_logs (SEC-7, best-effort) e, para leitura, devolve resposta em linguagem natural gerada pela IA.
- **Regras:** Auth falha → status do auth. JSON inválido → 400. HMAC inválido/adulterado → 403 'Proposta inválida.'; expirado (TTL) → 403 'A proposta expirou...'. Segredo HMAC ausente → 503. Ferramenta fora da allowlist executável (leitura ou escrita Fase 3) → 403 'Esta ação não está disponível pelo copiloto.'. Escrita sobre lead sem leadId no contexto → 400 'Abra um lead...'. Exceção na ferramenta → 500 (escrita ainda audita a falha). Escrita de lead recebe modoOperacao='canal_whatsapp'. Sucesso → {ok:true, ferramenta, resultado, resposta}.
- **Casos de teste:**
  - **Executar leitura confirmada** - DADO proposta válida obtida do /interpretar (confirmacaoId+ts frescos, mesma ferramenta/params/leadId) . QUANDO POST {ferramenta, params, confirmacaoId, ts, pergunta} . ENTAO 200 {ok:true, resultado, resposta em linguagem natural (ou null)}
  - **Proposta adulterada** - DADO confirmacaoId assinado para params X e body com params Y (ou leadId trocado) . QUANDO POST com o payload alterado . ENTAO 403 {error:'Proposta inválida.'} — nada executado
  - **Ferramenta fora da allowlist** - DADO HMAC hipoteticamente válido para ferramenta não executável (ex.: hub_crm_criar_cadastro) . QUANDO POST /api/copiloto/executar . ENTAO 403 {error:'Esta ação não está disponível pelo copiloto.'}

### POST /api/copiloto/transcrever
- **Auth:** autenticarCopiloto (sessão) + rate limit por userId (requireIaRateLimit, teto 10)
- **Proposito:** Fallback de transcrição de áudio do copiloto (quando o navegador não tem Web Speech API): recebe multipart {audio}, transcreve com Mistral/Voxtral e cai para Groq/Whisper se a chave Mistral está ausente ou falha.
- **Regras:** Auth falha → status do auth. Rate limit por usuário → resposta 429 do helper. Body não multipart → 400 'Envie o áudio como multipart/form-data.'. Campo audio ausente/vazio → 400 'Áudio ausente.'. Áudio >25 MB → 400. Falha de transcrição → 502 com mensagem amigável (sem chave / áudio não entendido / erro). Sucesso → 200 {texto}.
- **Casos de teste:**
  - **Transcrição ok** - DADO usuário autenticado, chave Mistral (ou Groq) configurada, form-data com audio webm <25MB . QUANDO POST multipart /api/copiloto/transcrever . ENTAO 200 {texto: transcrição não vazia}
  - **Áudio ausente** - DADO usuário autenticado e form-data sem o campo audio . QUANDO POST multipart vazio . ENTAO 400 {error:'Áudio ausente.'}
  - **Áudio grande demais** - DADO form-data com blob >25 MB . QUANDO POST /api/copiloto/transcrever . ENTAO 400 {error:'Áudio muito grande (máx. 25 MB).'}

### GET /api/crm/copiloto/historico
- **Auth:** requireCrmSessao (qualquer papel CRM ativo)
- **Proposito:** Histórico de consumo de IA do copiloto para o tenant da sessão: lê hub_ia_consumo com origem LIKE 'copiloto_%', últimas 20 linhas (origem, modelo, creditos, ref_id, criado_em). custo_brl é propositalmente excluído do select (margem interna).
- **Regras:** crmApiConfigError → 503. Guard de sessão obrigatório. Escopo .eq('tenant_id', tenant da sessão). Erro de banco → 500 {error}. Sucesso → {rows[]}.
- **Casos de teste:**
  - **Histórico do tenant** - DADO sessão válida e registros copiloto_intencao/copiloto_resposta em hub_ia_consumo do tenant . QUANDO GET /api/crm/copiloto/historico . ENTAO 200 {rows[]} (máx 20, sem campo custo_brl, só origens copiloto_*)
  - **Sem sessão** - DADO request anônimo . QUANDO GET /api/crm/copiloto/historico . ENTAO 401 (erro do guard)

### GET|POST /api/ciclos/atendente?ciclo=followup|sla[&hub_ciclo_id=]
- **Auth:** cronRequestAuthorized (CRON_SECRET via Bearer / header de cron; POST é alias do GET)
- **Proposito:** Runner dos ciclos do agente 'atendente': 'followup' envia follow-ups automáticos por WhatsApp conforme hub_followup_config (template por passo/mercado, horas de espera, overrides das configuracoes do ciclo) e arquiva leads sem resposta; 'sla' gera alertas para mensagens de entrada pendentes há >15 min (critico >30 min). Registra execução em hub_ciclos_log e atualiza hub_ciclos_ia (ultimo_ciclo, ultimo_status, total_execucoes).
- **Regras:** Sem auth cron → 401 {erro:'Não autorizado'}. hub_ciclo_id inexistente → 404. Followup só age em leads fora de ganho/perdido/arquivado, com followup_pausado=false e humano_responsavel IS NULL; passo>3 além de arquivarAposHoras → estagio='arquivado'. Ciclo desconhecido → executa vazio (200, total 0). Erro interno → 500 e log status 'erro'. Sucesso → {ok:true, ciclo, duracao_ms, acoes/alertas, total}.
- **Casos de teste:**
  - **Followup devido** - DADO CRON_SECRET válido, lead ativo sem humano_responsavel com ultimo_followup além das horas do passo 1 e config ativa . QUANDO GET ?ciclo=followup . ENTAO 200 {ok:true, total>=1}; mensagem em hub_fila_mensagens, followup_passo incrementado e log em hub_ciclos_log
  - **SLA estourado** - DADO auth cron e mensagem direcao='entrada' status='pendente' criada há >15 min sem alerta recente . QUANDO GET ?ciclo=sla . ENTAO 200 com alerta criado em hub_alertas (critico se >30 min)
  - **Sem segredo de cron** - DADO request sem Authorization/CRON_SECRET . QUANDO GET /api/ciclos/atendente . ENTAO 401 {erro:'Não autorizado'}

### GET|POST /api/ciclos/diretor?ciclo=trafego|analise_manha|analise_noite[&hub_ciclo_id=]
- **Auth:** cronRequestAuthorized (CRON_SECRET; POST é alias do GET)
- **Proposito:** Runner dos ciclos do diretor: 'trafego' lê campanhas via Windsor.ai e gera alertas por CPC (critico >R$5, importante >R$3, sugestão de aumento se CPC<R$2 e spend>R$100); 'analise_manha' agrega leads ativos/receita potencial/alertas críticos; 'analise_noite' monta resumo do dia e envia por WhatsApp aos contatos com notificar_critico se há alertas abertos. Atualiza hub_ciclos_log/hub_ciclos_ia e dispara medirKPIs dos agentes.
- **Regras:** Sem auth cron → 401. WINDSOR_API_KEY ausente ou API indisponível → ciclo trafego insere alerta 'info' pedindo configuração e retorna total 0 (200). Ciclo desconhecido → resultado {} (200). Erro interno → 500 {ok:false, erro}.
- **Casos de teste:**
  - **Análise da manhã** - DADO auth cron válida e leads/alertas existentes no banco . QUANDO GET ?ciclo=analise_manha . ENTAO 200 {ok:true, resultado:{leads_ativos, receita_potencial, criticos, encaminhamentos_7d}}
  - **Tráfego sem Windsor** - DADO auth cron e WINDSOR_API_KEY não configurada . QUANDO GET ?ciclo=trafego . ENTAO 200 {ok:true} com resultado.total=0 e alerta 'info' de configuração em hub_alertas
  - **Não autorizado** - DADO request sem credencial de cron . QUANDO POST /api/ciclos/diretor . ENTAO 401 {erro:'Não autorizado'}

### GET|POST /api/ciclos/gerente?ciclo=relatorio_manha|supervisao[&hub_ciclo_id=]
- **Auth:** cronRequestAuthorized (CRON_SECRET; POST é alias do GET)
- **Proposito:** Runner dos ciclos do gerente de atendimento: 'relatorio_manha' agrega KPIs de ontem (leads, qualificados, encaminhados, alertas), envia relatório por WhatsApp aos contatos com notificar_novo_lead e grava alerta 'info'; 'supervisao' varre mensagens de entrada dos últimos 30 min buscando palavras de reclamação e cria alerta 'importante' por lead insatisfeito. Registra em hub_ciclos_log e atualiza hub_ciclos_ia.
- **Regras:** Sem auth cron → 401. Ciclo desconhecido → resultado {} (200). Status da execução: 'sucesso' se houve ação/dados, senão 'sem_acao'. Erro interno → 500 {ok:false, erro}.
- **Casos de teste:**
  - **Supervisão detecta reclamação** - DADO auth cron e mensagem de entrada recente contendo 'péssimo' em hub_fila_mensagens . QUANDO GET ?ciclo=supervisao . ENTAO 200 {ok:true, resultado.total>=1} e alerta 'importante' com lead_id em hub_alertas
  - **Relatório matinal** - DADO auth cron e dados de ontem no banco . QUANDO GET ?ciclo=relatorio_manha . ENTAO 200 com resultado {relatorio, leads, qualificados, encaminhados} e alerta 'info' gravado
  - **Não autorizado** - DADO sem credencial de cron . QUANDO GET /api/ciclos/gerente . ENTAO 401 {erro:'Não autorizado'}

### GET|POST /api/cron/dispatch-ciclos[?dry_run=1]
- **Auth:** cronRequestAuthorized (CRON_SECRET; POST é alias do GET) + exige SUPABASE_SERVICE_ROLE_KEY
- **Proposito:** Dispatcher único de ciclos: um cron externo (1–5 min) chama esta rota; ela lê hub_ciclos_ia (ativo=true, tipo='programado'), decide o que está devido (cron_expressao/intervalo_minutos vs ultimo_ciclo) e invoca via HTTP interno os runners /api/ciclos/<api>?ciclo=<x>&hub_ciclo_id=<id> com o CRON_SECRET, no máximo 25 por tick.
- **Regras:** Sem auth cron → 401. SUPABASE_SERVICE_ROLE_KEY ausente → 503 {erro:'Serviço indisponível'}. dry_run=1|true → só lista o que dispararia (ran:[]). Ciclo sem rota inferível → entra em skipped com reason. Erro de leitura do banco → 500. Resposta: {ok:true, tick, dry_run, checked, due_count, due_preview[], ran[], skipped[], skipped_count, capped, errors[]}.
- **Casos de teste:**
  - **Dry-run lista devidos sem executar** - DADO auth cron, service key presente e ciclos programados vencidos em hub_ciclos_ia . QUANDO GET ?dry_run=1 . ENTAO 200 {dry_run:true, due_count>=1, ran:[]} — nenhum HTTP interno disparado
  - **Execução real** - DADO auth cron e 1 ciclo devido com dispatch inferível . QUANDO GET /api/cron/dispatch-ciclos . ENTAO 200 com ran[] contendo {id, ok, status} do runner chamado
  - **Não autorizado** - DADO sem CRON_SECRET . QUANDO GET /api/cron/dispatch-ciclos . ENTAO 401 {erro:'Não autorizado'}

### GET /api/cron/process-whatsapp-jobs
- **Auth:** cronRequestAuthorized (CRON_SECRET)
- **Proposito:** Processa um lote da fila hub_msg_jobs via runWhatsappWorkerTick (fallback quando o Background Worker não roda no Render); chamado a cada 1–5 min por cron.
- **Regras:** Sem auth cron → 401 {error:'unauthorized'}. Sucesso → 200 {ok, claimed, worker_id, error|null} — ok=false se o tick reportou erro (ainda 200).
- **Casos de teste:**
  - **Tick com jobs pendentes** - DADO auth cron e jobs status pendente em hub_msg_jobs . QUANDO GET /api/cron/process-whatsapp-jobs . ENTAO 200 {ok:true, claimed>=1, worker_id}
  - **Não autorizado** - DADO request sem credencial de cron . QUANDO GET /api/cron/process-whatsapp-jobs . ENTAO 401 {error:'unauthorized'}

### POST /api/ml/aprovar
- **Auth:** requireCrmGestor (gestor ou owner)
- **Proposito:** Aprova/rejeita/aplica mudanças propostas pelo ML (hub_ml_sugestoes) em fluxo de dupla confirmação humana: 'aprovar_primeira_vez' devolve preview + instrução; 'confirmar_aplicar' exige token literal confirmacao='CONFIRMO_A_ALTERACAO' e executa via aplicarMudancaConfirmada; 'rejeitar' só atualiza status para 'rejeitado' com motivo.
- **Regras:** Guard gestor/owner. sugestaoId e acao obrigatórios → 400. acao fora de aprovar_primeira_vez|confirmar_aplicar|rejeitar → 400. confirmar_aplicar sem o token exato → 400 'Token de confirmação inválido...'. Exceção → 500 {sucesso:false, erro}.
- **Casos de teste:**
  - **Fluxo de dupla aprovação** - DADO sessão gestor e sugestão ML pendente . QUANDO POST {sugestaoId, acao:'aprovar_primeira_vez'} e depois POST {sugestaoId, acao:'confirmar_aplicar', confirmacao:'CONFIRMO_A_ALTERACAO'} . ENTAO 1ª chamada 200 com preview+instrucao; 2ª chamada 200 com resultado da aplicação
  - **Confirmação sem token** - DADO sessão gestor . QUANDO POST {sugestaoId, acao:'confirmar_aplicar', confirmacao:'sim'} . ENTAO 400 {erro:'Token de confirmação inválido. Use confirmacao="CONFIRMO_A_ALTERACAO"'}
  - **Papel insuficiente** - DADO sessão de atendente/comercial . QUANDO POST {sugestaoId, acao:'rejeitar'} . ENTAO 403 (erro do guard requireCrmGestor)

### POST /api/ml/ciclo
- **Auth:** cronRequestAuthorized (CRON_SECRET)
- **Proposito:** Roda o ciclo de ML/monitoramento: body {tipo, agenteSlug} — 'kpis'+agenteSlug mede KPIs do agente; 'monitor' roda varrerSistema+monitorarTrafego; 'cobranca'+agenteSlug roda cobrarSubordinados; default 'completo' roda rodarCicloML + varrerSistema + medirKPIs de todos os agentes ativos (hub_agente_identidade).
- **Regras:** Sem auth cron → 401 {erro:'Não autorizado'}. Body não-JSON → tratado como {} (default completo). No ramo completo: SUPABASE_SERVICE_ROLE_KEY ausente → 503 {erro:'Serviço indisponível'}. Exceção → 500 {sucesso:false, erro}.
- **Casos de teste:**
  - **Ciclo completo** - DADO auth cron válida e agentes ativos no banco . QUANDO POST /api/ml/ciclo (body {}) . ENTAO 200 {sucesso:true, ml, monitor:{alertasCriticos, sugestoes}, timestamp}
  - **KPIs de um agente** - DADO auth cron . QUANDO POST {tipo:'kpis', agenteSlug:'atendente'} . ENTAO 200 {sucesso:true, tipo:'kpis', agente:'atendente'}
  - **Não autorizado** - DADO sem CRON_SECRET . QUANDO POST /api/ml/ciclo . ENTAO 401 {erro:'Não autorizado'}

### GET /api/ml/ciclo[?acao=kpis]
- **Auth:** DUPLA: ?acao=kpis → cronRequestAuthorized (cron de KPIs); sem acao=kpis → requireCrmGestor (dashboard de status ML)
- **Proposito:** Com acao=kpis (cron): mede KPIs de todos os agentes ativos e registra agregado do hub em hub_kpis_resultados (registrarResultadoCronKpisHub). Sem acao (gestor): dashboard de status ML — sugestões pendentes (hub_ml_sugestoes), históricos ativos (hub_ml_historico), ações IA das últimas 24h (hub_acoes_ia, limit 20) e KPIs fora de meta da última hora (hub_kpis_resultados nivel_alerta≠ok).
- **Regras:** acao=kpis sem auth cron → 401. Nos dois ramos: SUPABASE_SERVICE_ROLE_KEY ausente → 503. Ramo dashboard sem sessão gestor → erro do guard (401/403). Exceção → 500 ({sucesso:false,erro} no kpis; {erro:'Erro ao buscar status'} no dashboard).
- **Casos de teste:**
  - **Cron de KPIs** - DADO credencial de cron válida e agentes ativos . QUANDO GET /api/ml/ciclo?acao=kpis . ENTAO 200 {sucesso:true, tipo:'kpis', agentes_medidos>=0, hub_agregado, timestamp}
  - **Dashboard como gestor** - DADO sessão gestor/owner válida . QUANDO GET /api/ml/ciclo . ENTAO 200 {sugestoesPendentes, sugestoes[], historicosAtivos, acoesUltimas24h, kpisForaMeta, kpis[]}
  - **Dashboard sem guard** - DADO request anônimo sem acao=kpis . QUANDO GET /api/ml/ciclo . ENTAO 401 (erro do requireCrmGestor) — a fila interna da IA não vaza


---

## DISTRIBUIÇÃO / PARCEIROS (app/api/crm/distribuicao/**, app/api/crm/parceiros/**, app/api/parceiros/**)

### GET /api/crm/distribuicao/regras
- **Auth:** Sessão CRM nível gestor+ (requireCrmGestor; owner ou gestor)
- **Proposito:** Lista as regras de roteamento automático de leads do tenant (apenas ativas), ordenadas por prioridade asc e criado_em asc.
- **Regras:** Tenant vem da sessão (não de header). Filtro .or(tenantScopeOrFilter) — inclui linhas tenant NULL legadas. Só retorna ativo=true (DELETE arquiva, a lista esconde inativas). 503 se Supabase não configurado. Resposta {data:[{id, prioridade, ativo, origem, mercado, uf, destino_tipo, destino_valor, rotulo, criado_em}]}.
- **Casos de teste:**
  - **Listar regras ativas do tenant** - DADO gestor autenticado com 2 regras ativas e 1 arquivada (ativo=false) no seu tenant . QUANDO GET /api/crm/distribuicao/regras . ENTAO 200 com {data} contendo apenas as 2 ativas, ordenadas por prioridade crescente
  - **Sem permissão** - DADO usuário com papel comercial/atendente (abaixo de gestor) ou sem sessão . QUANDO GET /api/crm/distribuicao/regras . ENTAO 401/403 retornado pelo guard requireCrmGestor, sem dados
  - **Isolamento de tenant** - DADO regra criada por tenant B . QUANDO gestor do tenant A lista as regras . ENTAO 200 e a regra do tenant B NÃO aparece na lista

### POST /api/crm/distribuicao/regras
- **Auth:** Sessão CRM nível gestor+ (requireCrmGestor)
- **Proposito:** Cria uma regra de roteamento de leads (origem/mercado/uf → destino agente/atendente/parceiro).
- **Regras:** destino_valor obrigatório (string não vazia) → 400 'Destino obrigatório'. prioridade default 100; ativo default true (false só se body.ativo===false); mercado e uf normalizados para UPPERCASE; destino_tipo restrito a ['agente','atendente','parceiro'], senão cai em 'agente'; origem/rotulo trim ou null; tenant_id SEMPRE da sessão. Retorna 201 {data}.
- **Casos de teste:**
  - **Criar regra com defaults** - DADO gestor autenticado . QUANDO POST com {destino_valor:'mari', mercado:'imb', uf:'sp'} . ENTAO 201 com data.prioridade=100, ativo=true, mercado='IMB', uf='SP', destino_tipo='agente'
  - **Destino ausente** - DADO gestor autenticado . QUANDO POST com body sem destino_valor (ou vazio) . ENTAO 400 {error:'Destino obrigatório'}
  - **destino_tipo inválido cai no default** - DADO gestor autenticado . QUANDO POST com {destino_valor:'x', destino_tipo:'hacker'} . ENTAO 201 e data.destino_tipo='agente' (whitelist aplicada)

### PATCH /api/crm/distribuicao/regras/[id]
- **Auth:** Sessão CRM nível gestor+ (requireCrmGestor) + guard de tenant sobre a regra
- **Proposito:** Edita campos de uma regra de roteamento existente.
- **Regras:** Pré-cheque tenantGuard: busca tenant_id da regra; se não existe OU pertence a outro tenant (tenant_id não-nulo divergente) → 404 'Regra não encontrada.' (null legado passa). Whitelist de campos editáveis: prioridade, ativo, origem, mercado, uf, destino_tipo, destino_valor, rotulo. ativo só vira true com body.ativo===true; prioridade Number()||100; mercado/uf UPPERCASE; demais trim ou null. Retorna 200 {data}.
- **Casos de teste:**
  - **Editar prioridade e uf** - DADO regra existente do tenant do gestor . QUANDO PATCH com {prioridade: 5, uf:'rj'} . ENTAO 200 com data.prioridade=5 e data.uf='RJ'
  - **Regra de outro tenant** - DADO regra pertence ao tenant B . QUANDO gestor do tenant A faz PATCH nela . ENTAO 404 {error:'Regra não encontrada.'} — sem editar (anti-sequestro de leads)
  - **Id inexistente** - DADO id que não existe na tabela . QUANDO PATCH /api/crm/distribuicao/regras/{id-falso} . ENTAO 404 {error:'Regra não encontrada.'}

### DELETE /api/crm/distribuicao/regras/[id]
- **Auth:** Sessão CRM nível gestor+ (requireCrmGestor) + guard de tenant
- **Proposito:** Arquiva (soft-delete) uma regra de roteamento — nunca apaga do banco.
- **Regras:** Mesmo tenantGuard do PATCH (404 se inexistente ou de outro tenant). Executa update {ativo:false} (princípio 'só arquiva'); a regra some do GET, que filtra ativo=true. Retorna {ok:true}.
- **Casos de teste:**
  - **Arquivar regra** - DADO regra ativa do tenant do gestor . QUANDO DELETE na regra . ENTAO 200 {ok:true}; GET subsequente não lista mais a regra; a linha continua no banco com ativo=false
  - **Regra de outro tenant** - DADO regra do tenant B . QUANDO gestor do tenant A faz DELETE . ENTAO 404 {error:'Regra não encontrada.'} e ativo permanece true
  - **Sem sessão** - DADO requisição sem cookie/sessão CRM . QUANDO DELETE em qualquer id . ENTAO 401 do guard, nada alterado

### GET /api/crm/distribuicao/destinos
- **Auth:** Sessão CRM nível gestor+ (requireCrmGestor)
- **Proposito:** Lista destinos válidos para as regras de roteamento: agentes (value=agente_slug de hub_agente_identidade) e parceiros (value=id de hub_parceiros), com labels amigáveis.
- **Regras:** Tenant-scoped null-safe (.or(tenantScopeOrFilter)) nas duas consultas em paralelo. Agentes sem agente_slug string não-vazio são filtrados; label = 'nome · cargo' quando há cargo. 503 sem config; 500 se qualquer consulta falhar. Resposta {agentes:[{value,label}], parceiros:[{value,label}]} (sem envelope data).
- **Casos de teste:**
  - **Listar destinos** - DADO tenant com 1 agente (slug 'mari', cargo 'SDR') e 1 parceiro . QUANDO GET /api/crm/distribuicao/destinos . ENTAO 200 com agentes=[{value:'mari', label contendo '· SDR'}] e parceiros=[{value:<uuid>, label:<nome>}]
  - **Permissão insuficiente** - DADO usuário nível comercial . QUANDO GET destinos . ENTAO 403 do requireCrmGestor
  - **Isolamento de tenant** - DADO parceiro cadastrado no tenant B . QUANDO gestor do tenant A pede destinos . ENTAO 200 e o parceiro do tenant B não aparece

### GET /api/crm/distribuicao/metricas
- **Auth:** Qualquer sessão CRM válida (requireCrmSessao — todos os níveis)
- **Proposito:** Auditor da rede (read-only): agrega os últimos 2000 hub_eventos do tenant em KPIs gerais e por fornecedor (top-8), com aderência (IAH 0-100), cobrança sugerida e alertas.
- **Regras:** Conta por event_type: lead_distribuido/lead_recolocado (recebidos), lead_recusado, entrega_gerada, gate_pendencia_bloqueio, gate_liberado, lead_sem_proximo. Enriquece top-8 fornecedores com status_financeiro de hub_parceiros; aderência = clamp(0..100, 50 + 8*recebidos - 15*recusados - 20*bloqueios - penalidade de status [bloqueado:25, pendente:10]). cobranca: 'bloqueado'→pendência bloqueado; 'pendente'→pendência aberta; recusados>=2 && recusados>=recebidos→alta recusa. Alertas gerados para bloqueios>0, sem_proximo>0 e fornecedores com alta recusa. Resposta {geral, fornecedores, alertas}.
- **Casos de teste:**
  - **KPIs agregados** - DADO tenant com eventos lead_distribuido (2x fornecedor F) e 1 lead_recusado de F . QUANDO GET /api/crm/distribuicao/metricas . ENTAO 200 com geral.distribuidos=2, geral.recusados=1 e fornecedores contendo F com recebidos=2, recusados=1 e aderencia calculada
  - **Alerta de bloqueio** - DADO existe evento gate_pendencia_bloqueio no tenant . QUANDO GET metricas . ENTAO 200 e alertas contém mensagem 'tentativa(s) de envio barradas por pendência financeira'
  - **Sem sessão** - DADO requisição anônima . QUANDO GET metricas . ENTAO 401 do requireCrmSessao

### GET /api/crm/distribuicao/fila
- **Auth:** Sessão CRM nível comercial+ (requireCrmComercial)
- **Proposito:** Lista leads 'aguardando distribuição' (estágio qualificado, sem encaminhamento pendente/enviado) com top-3 candidatos do motor de score determinístico por lead. Read-only — não cria encaminhamento.
- **Regras:** Query param limite (default 12, teto 30). Busca até 60 leads qualificado do tenant (ordem criado_em asc); exclui os com encaminhamento em status ['aguardando_validacao','sugerido_ia','aprovado_envio','enviado']. Mercado extraído da metadata do lead (mercado_principal/mercado/mercados[0], fallback 'IMB'). Geo (cidade/estado) via hub_pessoas do pessoa_id. Candidatos via listarCandidatosParceiro (limite 3, sem LLM). 503 sem config; 500 em erro de banco. Resposta {data:[FilaLeadItem]}.
- **Casos de teste:**
  - **Fila com candidatos** - DADO tenant com 1 lead estagio='qualificado' sem encaminhamento e 1 parceiro homologado no mercado do lead . QUANDO GET /api/crm/distribuicao/fila . ENTAO 200 com data[0].lead_id do lead e data[0].candidatos com até 3 parceiros pontuados
  - **Lead já encaminhado sai da fila** - DADO lead qualificado com encaminhamento status 'enviado' . QUANDO GET fila . ENTAO 200 e esse lead NÃO aparece em data
  - **Atendente barrado** - DADO sessão com papel atendente (abaixo de comercial) . QUANDO GET fila . ENTAO 403 do requireCrmComercial

### POST /api/crm/distribuicao/sugerir
- **Auth:** Sessão CRM nível comercial+ (requireCrmComercial)
- **Proposito:** Roda o motor sugerirEncaminhamentoAutomatico para um lead: cria um encaminhamento sugerido com candidato principal + lista de candidatos + card_resumo.
- **Regras:** Body JSON obrigatório (JSON inválido → 400 'JSON inválido'); lead_id obrigatório (trim) → 400 'lead_id obrigatório'. tenant_id passado da sessão ao motor. Falha do motor (ex.: lead sem candidato elegível, lead inexistente) → 400 {error, candidatos:[]}. Sucesso → 200 {ok:true, encaminhamento_id, principal, candidatos, card_resumo|null}.
- **Casos de teste:**
  - **Sugerir encaminhamento** - DADO lead qualificado do tenant com parceiro elegível . QUANDO POST {lead_id} . ENTAO 200 {ok:true} com encaminhamento_id criado e principal preenchido
  - **lead_id ausente** - DADO sessão comercial válida . QUANDO POST com body {} ou lead_id vazio . ENTAO 400 {error:'lead_id obrigatório'}
  - **Body não-JSON** - DADO sessão comercial válida . QUANDO POST com corpo malformado (não-JSON) . ENTAO 400 {error:'JSON inválido'}

### POST /api/crm/distribuicao/[encaminhamentoId]/aprovar
- **Auth:** Sessão CRM nível comercial+ (requireCrmComercial) + guard de tenant sobre o encaminhamento
- **Proposito:** Aprova um encaminhamento sugerido e envia o lead ao fornecedor (via aprovarEEnviarEncaminhamento). Body opcional {parceiro_id} escolhe qual candidato recebe; omitido usa o principal gravado.
- **Regras:** Pré-cheque em hub_encaminhamentos: inexistente OU tenant_id não-nulo diferente do da sessão → 404 'Encaminhamento não encontrado.'. Body é tolerante (catch → {}). Falha de negócio no envio (ex.: status inválido, fornecedor bloqueado) → 400 {error}. Sucesso → 200 {ok:true, telefone} (telefone do parceiro para contato).
- **Casos de teste:**
  - **Aprovar com principal** - DADO encaminhamento sugerido do tenant do caller . QUANDO POST sem body (ou {}) . ENTAO 200 {ok:true, telefone} e encaminhamento passa a enviado ao parceiro principal
  - **Encaminhamento de outro tenant** - DADO encaminhamento do tenant B . QUANDO comercial do tenant A tenta aprovar . ENTAO 404 {error:'Encaminhamento não encontrado.'}
  - **Escolher outro candidato** - DADO encaminhamento com 3 candidatos . QUANDO POST {parceiro_id: <segundo candidato>} . ENTAO 200 e o lead é enviado ao parceiro_id informado (não ao principal)

### POST /api/crm/distribuicao/cobrar
- **Auth:** Sessão CRM nível gestor+ (requireCrmGestor)
- **Proposito:** Dispara uma cobrança do Hub a um fornecedor (pendência/KPI/SLA), emitindo o evento 'fornecedor_cobrado' em hub_eventos (aparece no feed da rede e no sino de notificações).
- **Regras:** fornecedor_id obrigatório (string trim) → 400 'fornecedor_id obrigatório'. Busca parceiro; inexistente OU tenant_id não-nulo divergente → 404 'Fornecedor não encontrado'. Evento gravado com ator='humano', payload {parceiro_nome, motivo (default 'Pendência / KPI / SLA')}, tenant_id do parceiro (fallback sessão). Resposta {ok:true}.
- **Casos de teste:**
  - **Cobrar fornecedor** - DADO parceiro do tenant do gestor . QUANDO POST {fornecedor_id, motivo:'SLA estourado'} . ENTAO 200 {ok:true} e hub_eventos ganha 1 linha event_type='fornecedor_cobrado' com payload.motivo='SLA estourado'
  - **fornecedor_id ausente** - DADO gestor autenticado . QUANDO POST {} . ENTAO 400 {error:'fornecedor_id obrigatório'}
  - **Fornecedor de outro tenant** - DADO parceiro do tenant B . QUANDO gestor do tenant A cobra esse id . ENTAO 404 {error:'Fornecedor não encontrado'} sem emitir evento

### POST /api/crm/distribuicao/auditor (GET = mesmo handler)
- **Auth:** DUPLO: Bearer CRON_SECRET (cronRequestAuthorized) OU sessão CRM gestor+
- **Proposito:** Roda o auditor autônomo da rede (rodarAuditorRede): emite cobranças automáticas idempotentes (cooldown 12h) que alimentam o feed e o sino.
- **Regras:** Se autorizado por cron → roda no tenant DEFAULT fixo (00000000-0000-4000-8000-000000000001); senão exige gestor e roda no tenant da sessão. GET exportado como alias de POST (mesma lógica). Resposta {ok:true, ...resultado do auditor}.
- **Casos de teste:**
  - **Gestor roda sob demanda** - DADO gestor autenticado do tenant A . QUANDO POST /api/crm/distribuicao/auditor . ENTAO 200 {ok:true,...} com o auditor executado no tenant A
  - **Cron autorizado** - DADO requisição com Authorization: Bearer <CRON_SECRET> correto . QUANDO GET/POST auditor . ENTAO 200 {ok:true} executando no tenant default, sem exigir sessão
  - **Sem credencial** - DADO requisição sem CRON_SECRET e sem sessão gestor . QUANDO POST auditor . ENTAO 401/403 do requireCrmGestor

### POST /api/crm/parceiros
- **Auth:** Sessão CRM nível comercial+ (requireCrmComercial)
- **Proposito:** Cadastro MANUAL INTERNO de parceiro pelo time comercial: cria hub_parceiros em status 'captacao' com código gerado, estágio de captação 'interessado' (origem 'manual') e trilha de auditoria de QUEM cadastrou (feito_por = userId da sessão).
- **Regras:** nome obrigatório → 400 'Nome obrigatório'; telefone com >=10 dígitos → 400 'Telefone com DDD obrigatório'. cpf/cnpj só dígitos. Dedup tenant-scoped com .eq('tenant_id') PURO → 409 'Já existe um parceiro com este CPF/CNPJ na rede.' (frase idêntica à colisão do UNIQUE GLOBAL 23505 — sem oráculo cross-tenant, sem vazar id/nome). comissao_pct TRAVADA no server em 5 (ignora body). tenant SEMPRE da sessão. Erro de insert não-unique → 500 genérico (sem texto do Postgres). Warnings de schema-drift nas tabelas auxiliares não derrubam o cadastro. Resposta 201 {data:{id, codigo, nome}}.
- **Casos de teste:**
  - **Cadastro manual feliz** - DADO comercial autenticado . QUANDO POST {nome:'Empreiteira X', telefone:'11999998888', cnpj:'12345678000199'} . ENTAO 201 com data.id e data.codigo; parceiro em status 'captacao' e log 'parceiro_cadastrado' com feito_por = userId da sessão
  - **Telefone curto** - DADO comercial autenticado . QUANDO POST {nome:'X', telefone:'1199'} . ENTAO 400 {error:'Telefone com DDD obrigatório'}
  - **CPF duplicado no tenant** - DADO parceiro do mesmo tenant já cadastrado com o CPF . QUANDO POST com o mesmo cpf . ENTAO 409 {error:'Já existe um parceiro com este CPF na rede.'} sem revelar id/nome do existente
  - **Comissão do body ignorada** - DADO comercial autenticado . QUANDO POST incluindo comissao_pct:50 no body . ENTAO 201 e o parceiro é gravado com comissao_pct=5 (valor travado no server)

### GET /api/crm/parceiros/convite
- **Auth:** Sessão CRM nível comercial+ (requireCrmComercial)
- **Proposito:** Gera a atribuição ASSINADA do convidador para o link público de convite de parceiro (/parceiro/cadastro/rede?por=...&sig=...).
- **Regras:** por = userId da SESSÃO (nunca do cliente); sig = HMAC do servidor (assinarConviteParceiro). O cadastro público só credita 'quem convidou' se o sig confere (anti-forja H-SEC-3). Resposta {por, sig}.
- **Casos de teste:**
  - **Gerar convite assinado** - DADO comercial autenticado com userId U . QUANDO GET /api/crm/parceiros/convite . ENTAO 200 com {por:U, sig:<hmac não vazio>} e sig válido para o par (U)
  - **Sem sessão** - DADO requisição anônima . QUANDO GET convite . ENTAO 401 do guard
  - **Sig não forjável** - DADO sig gerado para userId U . QUANDO cliente troca por=V mantendo o mesmo sig . ENTAO a verificação HMAC no cadastro público falha (atribuição não creditada)

### POST /api/crm/parceiros/[id]/liberar
- **Auth:** Sessão CRM nível gestor+ (requireCrmGestor) + guard de tenant
- **Proposito:** Hub libera fornecedor bloqueado/pendente por pendência financeira: seta status_financeiro='em_dia' (+atualizado_em) e registra evento 'gate_liberado' para auditoria.
- **Regras:** Pré-cheque de tenant: parceiro inexistente OU tenant_id não-nulo divergente → 404 'Fornecedor não encontrado' (fecha o vetor de liberar gate de outro tenant sob service-role). Update em hub_parceiros; erro → 500. Evento gate_liberado com ator='humano' e payload {parceiro_nome}. Resposta {ok:true, data:{id, nome, status_financeiro}}.
- **Casos de teste:**
  - **Liberar fornecedor bloqueado** - DADO parceiro do tenant com status_financeiro='bloqueado' . QUANDO POST /api/crm/parceiros/{id}/liberar . ENTAO 200 {ok:true} com data.status_financeiro='em_dia' e evento 'gate_liberado' registrado
  - **Fornecedor de outro tenant** - DADO parceiro do tenant B . QUANDO gestor do tenant A tenta liberar . ENTAO 404 {error:'Fornecedor não encontrado'} e status_financeiro intacto
  - **Papel insuficiente** - DADO sessão nível comercial . QUANDO POST liberar . ENTAO 403 do requireCrmGestor

### GET /api/parceiros
- **Auth:** Qualquer sessão CRM válida (requireCrmSessao); service_role no banco
- **Proposito:** Lista parceiros do tenant do operador, com filtros status, mercado e busca textual (nome/email/telefone ilike, sanitizada via sanitizarBuscaPostgrest).
- **Regras:** Fail-closed: sem SUPABASE_SERVICE_ROLE_KEY → 503 'Serviço indisponível'. Escopo por tenant da sessão (.or(tenantScopeOrFilter) — não do header). Ordena por criado_em desc. Fallback de compat: em erro de coluna ausente (tenant_id, modulo_atual, recebe_leads, totais) refaz com SELECT reduzido. Resposta {parceiros:[...]}; erro final → 500 {erro}. Atenção: chave de resposta é 'parceiros'/'erro' (não 'data'/'error').
- **Casos de teste:**
  - **Listar com filtro de status** - DADO sessão CRM válida e parceiros em 'captacao' e 'homologado' no tenant . QUANDO GET /api/parceiros?status=homologado . ENTAO 200 com {parceiros} contendo só os homologados do tenant
  - **Sem sessão** - DADO requisição anônima . QUANDO GET /api/parceiros . ENTAO 401 do requireCrmSessao
  - **Busca sanitizada** - DADO sessão válida . QUANDO GET ?busca=jo%C3%A3o,injec)ao . ENTAO 200 sem erro de PostgREST (caracteres perigosos neutralizados pelo sanitizador) e resultados por nome/email/telefone

### POST /api/parceiros
- **Auth:** PÚBLICO (captação) com rate limit por IP: 10 req/60s → 429; tenant SEMPRE defaultTenantId (HUB-only, header ignorado)
- **Proposito:** Captação pública de parceiro (landing/convite): cria hub_parceiros em status 'captacao' + estágio de captação (origem/canal/UTMs) + log de sistema; suporta atribuição 'indicado_por'.
- **Regras:** Rate limit por x-forwarded-for (10/min) → 429 'Muitas tentativas...'. nome e telefone obrigatórios → 400 'nome e telefone são obrigatórios'. Dedup no escopo do tenant Hub por cpf, cnpj E telefone (dígitos) → 409 {erro:'CPF/CNPJ/Telefone já cadastrado', parceiro_id do existente}. comissao_pct do body aceita (default 5). Gera código único. Warnings de compat retornados em 'warning'. Resposta 201 {parceiro_id, codigo, status:'criado', warning}. 503 sem service key; 500 {erro} em falha. Chaves de resposta em pt: 'erro'.
- **Casos de teste:**
  - **Captação pública feliz** - DADO nenhum parceiro com o telefone informado . QUANDO POST {nome:'João', telefone:'(11) 98888-7777', origem:'landing', utm_source:'meta'} . ENTAO 201 com {parceiro_id, codigo, status:'criado'}; captação registra origem/UTMs
  - **Telefone duplicado** - DADO parceiro já existente com o mesmo telefone (dígitos) no tenant Hub . QUANDO POST com o mesmo telefone . ENTAO 409 {erro:'Telefone já cadastrado', parceiro_id:<id existente>}
  - **Rate limit** - DADO mesmo IP já fez 10 POSTs no último minuto . QUANDO 11º POST . ENTAO 429 {erro:'Muitas tentativas. Aguarde um instante.'}
  - **Campos obrigatórios** - DADO requisição pública . QUANDO POST {nome:'X'} sem telefone . ENTAO 400 {erro:'nome e telefone são obrigatórios'}

### PATCH /api/parceiros/[id]
- **Auth:** Sessão CRM nível gestor+ (requireCrmGestor); update tenant-scoped
- **Proposito:** Edita campos de DISTRIBUIÇÃO do parceiro (porta do motor): mercado, recebe_leads, status de homologação; sincroniza espelho hub_fornecedores (best-effort) e grava log de auditoria.
- **Regras:** Fail-closed 503 sem service key. WHITELIST ESTRITA de 3 campos — comissao/codigo/tenant_id do body são descartados. mercado: '' ou null limpa; senão string <=8 chars validada contra MERCADOS_PREFIXO (UPPERCASE) → 400 'mercado inválido'. recebe_leads deve ser boolean → 400. status restrito a ['captacao','em_homologacao','homologado'] → 400 'status inválido'. Nenhum campo editável no body → 400. JSON inválido → 400. Update escopado por tenant da sessão (.or(tenantScopeOrFilter), fallback sem filtro se coluna tenant_id não existir); 0 linhas → 404 'Parceiro não encontrado'. Log 'parceiro_distribuicao_atualizada' e upsert em hub_fornecedores nunca derrubam o PATCH. Resposta {parceiro}.
- **Casos de teste:**
  - **Homologar e ligar leads** - DADO parceiro do tenant do gestor em 'captacao' . QUANDO PATCH {status:'homologado', recebe_leads:true, mercado:'imb'} . ENTAO 200 {parceiro} com status='homologado', recebe_leads=true, mercado='IMB'; hub_fornecedores espelhado
  - **Campo fora da whitelist** - DADO gestor autenticado . QUANDO PATCH {comissao_pct: 50} (nenhum campo permitido) . ENTAO 400 {erro:'Nenhum campo editável informado'} — comissão jamais alterada por esta rota
  - **Mercado inválido** - DADO gestor autenticado . QUANDO PATCH {mercado:'XYZ123'} . ENTAO 400 {erro:'mercado inválido'}
  - **Parceiro de outro tenant** - DADO parceiro do tenant B . QUANDO gestor do tenant A faz PATCH . ENTAO 404 {erro:'Parceiro não encontrado'} (update tenant-scoped não casa a linha)

### POST /api/parceiros/[id]/modulo
- **Auth:** Sessão CRM nível gestor+ (requireCrmGestor)
- **Proposito:** Marca um módulo de homologação do parceiro como concluído: upsert em hub_parceiros_modulos, avança modulo_atual, promove status 'captacao'→'em_homologacao', atualiza hub_parceiros_homologacao (concluído com 8 módulos) e grava log.
- **Regras:** Fail-closed 503 sem service key. JSON inválido → 400. modulo_numero deve ser number entre 1 e 24 → 400 'modulo_numero inválido'. Parceiro inexistente → 404. Título vem de hub_modulos_template (fallback 'Módulo N'). modulo_atual = max(atual, numero). Total para conclusão da homologação = 8 módulos ('concluido' + data_conclusao). ATENÇÃO (fiel ao código): NÃO há pré-cheque de tenant nesta rota — o guard é só de papel. Resposta {ok:true, modulo_numero, modulos_concluidos}.
- **Casos de teste:**
  - **Concluir módulo** - DADO parceiro em 'captacao' com modulo_atual=0 . QUANDO POST {modulo_numero:1} . ENTAO 200 {ok:true, modulo_numero:1, modulos_concluidos:1}; parceiro passa a status 'em_homologacao' e modulo_atual=1
  - **Número fora do domínio** - DADO gestor autenticado . QUANDO POST {modulo_numero: 25} ou {modulo_numero:'1'} . ENTAO 400 {erro:'modulo_numero inválido'}
  - **Parceiro inexistente** - DADO id que não existe . QUANDO POST {modulo_numero:1} . ENTAO 404 {erro:'Parceiro não encontrado'}
  - **Idempotência do módulo** - DADO módulo 1 já concluído para o parceiro . QUANDO POST {modulo_numero:1} de novo . ENTAO 200 sem duplicar linha em hub_parceiros_modulos (update da existente); modulos_concluidos não infla

### GET /api/parceiros/[id]/portal-link
- **Auth:** INTERNO: internalApiKeyAuthorized (chave de API interna) OU cronRequestAuthorized (Bearer CRON_SECRET); senão 401
- **Proposito:** Gera a URL assinada do portal do parceiro: {base}/parceiro/dashboard?id={id}&s={hmac} (base = NEXT_PUBLIC_APP_URL ou origin da request).
- **Regras:** Sem sessão de usuário — é rota máquina-a-máquina (worker/cron que envia o link ao parceiro). Assinatura via assinarParceiroPortal(id) (HMAC do servidor). Não valida existência do parceiro (a validação acontece no /portal/verify). Resposta {url}.
- **Casos de teste:**
  - **Gerar link com chave interna** - DADO requisição com header de internal API key válida . QUANDO GET /api/parceiros/{id}/portal-link . ENTAO 200 com {url} contendo id e parâmetro s (assinatura) verificável pelo /portal/verify
  - **Sem credencial interna** - DADO requisição sem internal key e sem CRON_SECRET (mesmo com sessão CRM de gestor) . QUANDO GET portal-link . ENTAO 401 {erro:'Não autorizado'}
  - **Via cron secret** - DADO Authorization: Bearer <CRON_SECRET> correto . QUANDO GET portal-link . ENTAO 200 com {url} assinada

### POST /api/parceiros/portal/verify
- **Auth:** PÚBLICO com verificação HMAC do link (id + s) + rate limit por IP (default 40/60s, env PORTAL_VERIFY_RATE_MAX/WINDOW_MS)
- **Proposito:** Valida o link assinado do portal do parceiro (login sem senha) e retorna os dados do parceiro para renderizar o dashboard.
- **Regras:** Rate limit primeiro → 429 com header Retry-After. JSON inválido → 400. id ou s ausentes OU assinatura inválida (parceiroPortalValido) → 401 'Link inválido ou expirado'. 503 sem service key. Parceiro inexistente → 404. Sucesso → 200 {ok:true, parceiro:{id, nome, status, modulo_atual, comissao_pct, total_leads_recebidos, total_leads_convertidos, recebe_leads, telefone, cidade, estado}}. Tentativas suspeitas são logadas no servidor (ip, hasId).
- **Casos de teste:**
  - **Link válido** - DADO par (id, s) gerado pelo portal-link para parceiro existente . QUANDO POST {id, s} . ENTAO 200 {ok:true, parceiro} com os campos do dashboard
  - **Assinatura forjada** - DADO id real mas s inventado/alterado . QUANDO POST {id, s:'xxx'} . ENTAO 401 {ok:false, erro:'Link inválido ou expirado'} sem retornar dados
  - **Rate limit** - DADO mesmo IP excedeu 40 tentativas em 60s . QUANDO nova tentativa de verify . ENTAO 429 com {erro:'Muitas tentativas...'} e header Retry-After
  - **Parceiro apagado do banco** - DADO assinatura válida para id que não existe mais em hub_parceiros . QUANDO POST {id, s} . ENTAO 404 {ok:false, erro:'Parceiro não encontrado'}


---

## OBRAS / PROJETOS / ARQUITETURA

### GET /api/crm/obras
- **Auth:** requireCrmSessao (qualquer papel logado: owner/gestor/comercial/atendente)
- **Proposito:** Lista até 100 obras do tenant da sessão (mais recente primeiro), com count exato. Filtros query: ?status, ?tipo (só slugs válidos de TIPOS_OBRA), ?negocio_id.
- **Regras:** tenant_id SEMPRE da sessão (.eq('tenant_id')). Tolerância migração E0: coluna ausente → repete com SELECT legado sem filtro de tipo. Resposta {data, total}. 503 se config Supabase ausente; 500 em erro de banco.
- **Casos de teste:**
  - **Listar obras do tenant** - DADO sessão válida de um tenant com obras cadastradas . QUANDO GET /api/crm/obras . ENTAO 200 com {data:[...], total:N}; só obras do tenant, ordenadas por criado_em desc, máx 100
  - **Filtro por negócio** - DADO obras vinculadas a um negocio_id X e outras não . QUANDO GET /api/crm/obras?negocio_id=X . ENTAO 200 retornando apenas as obras com negocio_id=X
  - **Sem sessão** - DADO requisição sem cookie/sessão CRM . QUANDO GET /api/crm/obras . ENTAO 401 (erro do guard requireCrmSessao)

### POST /api/crm/obras
- **Auth:** requireCrmComercial (comercial ou superior)
- **Proposito:** Cria obra com EAP do preset via criarObraComEAP (código atômico com retry 23505, frentes do preset por tipo_obra/segmento, semeadura de itens por ambiente).
- **Regras:** titulo obrigatório (400). Body JSON inválido → 400. Idempotência anti double-tap: mesmo título+tenant em 60s → 200 {data, idempotente:true} (sem criar duplicata). Sucesso → 201 {data, frentes_criadas, itens_criados, aviso}. tenant_id da sessão, nunca do body.
- **Casos de teste:**
  - **Criar obra feliz** - DADO sessão comercial+ e body {titulo:'Obra Teste', tipo_obra:'reforma'} . QUANDO POST /api/crm/obras . ENTAO 201 com data.id, frentes_criadas>0 (preset da EAP) e itens_criados
  - **Título ausente** - DADO body {} ou {titulo:''} . QUANDO POST /api/crm/obras . ENTAO 400 {error:'Título obrigatório'}
  - **Idempotência 60s** - DADO obra 'Obra X' criada há menos de 60s no mesmo tenant . QUANDO POST com o mesmo titulo 'Obra X' . ENTAO 200 com {idempotente:true} devolvendo a obra existente, sem duplicar

### GET /api/crm/obras/cockpit
- **Auth:** requireCrmSessao
- **Proposito:** Agregação do cockpit 'Hoje' + carteira de obras (contadores: atrasados, próximos 15 dias, bloqueios, pagamentos a vencer) via aggregateCockpit. ?negocio_id opcional.
- **Regras:** Falha-segura: qualquer exceção devolve 200 com estrutura vazia coerente + aviso (nunca derruba a tela). Cache-Control private max-age=30. Filtro por tenant em toda query.
- **Casos de teste:**
  - **Cockpit do tenant** - DADO sessão válida com obras e cronograma . QUANDO GET /api/crm/obras/cockpit . ENTAO 200 com {carteira, contadores, hoje, resumo_ia, flags}
  - **Degradação segura** - DADO tabelas do cockpit ausentes/erro interno . QUANDO GET /api/crm/obras/cockpit . ENTAO 200 (nunca 500) com contadores zerados e campo aviso preenchido
  - **Sem auth** - DADO requisição anônima . QUANDO GET /api/crm/obras/cockpit . ENTAO 401

### POST /api/crm/obras/cockpit
- **Auth:** requireCrmSessao
- **Proposito:** Ação direta de baixo risco: marcar fase do cronograma como concluída. Body {acao:'concluir_fase', fase_id}.
- **Regras:** acao !== 'concluir_fase' → 400. fase_id vazio → 400. Guarda de posse: lê a fase e compara tenant_id; NULL ou de outro tenant → 404 'Fase não encontrada' (não vaza existência). Update com .eq(tenant_id) (defesa em profundidade). Sucesso → {ok:true, fase_id, fase, concluida:true}.
- **Casos de teste:**
  - **Concluir fase** - DADO fase de cronograma do próprio tenant . QUANDO POST {acao:'concluir_fase', fase_id:<id>} . ENTAO 200 {ok:true, concluida:true} e concluida=true no banco
  - **Ação inválida** - DADO body {acao:'reprogramar'} . QUANDO POST /api/crm/obras/cockpit . ENTAO 400 'Ação não suportada.'
  - **Fase de outro tenant** - DADO fase_id existente mas de tenant diferente do caller . QUANDO POST {acao:'concluir_fase', fase_id} . ENTAO 404 'Fase não encontrada.' e nenhuma escrita

### GET /api/crm/obras/[id]
- **Auth:** requireCrmSessao
- **Proposito:** Detalhe da obra + agregados em paralelo: cronograma, diário (20), check-ins de operários (30), pedidos de material, ocorrências (20).
- **Regras:** Escopo tenantScopeOrFilter (tenant atual + legados NULL/default Obra10 — exceção deliberada nesta rota). Obra não encontrada no escopo → 404. Resposta {data, cronograma, diario, checkins, pedidos, ocorrencias}.
- **Casos de teste:**
  - **Detalhe completo** - DADO obra do tenant com cronograma e diário . QUANDO GET /api/crm/obras/{id} . ENTAO 200 com data (obra) e arrays cronograma/diario/checkins/pedidos/ocorrencias
  - **Obra inexistente** - DADO UUID que não existe . QUANDO GET /api/crm/obras/{uuid-aleatorio} . ENTAO 404 'Obra não encontrada'
  - **Obra de outro tenant** - DADO obra pertencente a outro tenant (tenant_id divergente, fora do escopo legado) . QUANDO GET com sessão do tenant A . ENTAO 404 (não vaza dados cross-tenant)

### PATCH /api/crm/obras/[id]
- **Auth:** requireCrmComercial
- **Proposito:** Edita a obra: titulo, status, endereco, cidade, estado, data_inicio, data_previsao_fim, tipo_contrato e bdi_fator (E7).
- **Regras:** Posse estrita: tenant_id NULL/divergente → 404. tipo_contrato deve ser 'administracao'|'preco_fechado' (400 se inválido) e é IMUTÁVEL após 1º orçamento aprovado → 422 {error:'tipo_contrato_imutavel'}. bdi_fator: só número finito > 0. Tolerância E7: coluna bdi_fator ausente → grava os demais campos e responde aviso + bdi_gravado:false.
- **Casos de teste:**
  - **Editar título e status** - DADO obra do tenant . QUANDO PATCH {titulo:'Novo', status:'em_andamento'} . ENTAO 200 com data atualizada e atualizado_em novo
  - **tipo_contrato imutável** - DADO obra com orçamento em hub_obra_orcamentos com status='aprovado' . QUANDO PATCH {tipo_contrato:'preco_fechado'} . ENTAO 422 {error:'tipo_contrato_imutavel'}
  - **tipo_contrato inválido** - DADO obra do tenant . QUANDO PATCH {tipo_contrato:'xyz'} . ENTAO 400 'tipo_contrato inválido (administracao | preco_fechado).'

### GET /api/crm/obras/[id]/eap
- **Auth:** requireCrmSessao
- **Proposito:** Lista as frentes da EAP da obra (hub_obra_frentes_eap), ordenadas por ordem.
- **Regras:** assertObraDoTenant: obra inexistente ou tenant_id≠sessão (inclui NULL) → 404. Query com .eq(tenant_id) puro. Tolerância E0: tabela ausente → 200 com EAP_PRESETS_FALLBACK + migracao_pendente:true + aviso.
- **Casos de teste:**
  - **Listar frentes** - DADO obra do tenant com EAP semeada . QUANDO GET /api/crm/obras/{id}/eap . ENTAO 200 {data:[frentes], migracao_pendente:false}
  - **Obra de outro tenant** - DADO obra com tenant_id de outra empresa . QUANDO GET /eap com sessão do tenant A . ENTAO 404 'Obra não encontrada'
  - **Migração pendente** - DADO banco sem a tabela hub_obra_frentes_eap . QUANDO GET /eap . ENTAO 200 com fallback de presets e migracao_pendente:true (não quebra)

### POST /api/crm/obras/[id]/eap
- **Auth:** requireCrmComercial
- **Proposito:** Adiciona nova frente à EAP: entra ativa, no fim da ordem, com código único gerado do nome/disciplina (sufixo numérico em colisão), origem='manual'.
- **Regras:** Exige disciplina_slug válido OU nome (400 'Informe a disciplina ou o nome da frente.'). Posse da obra → 404. Tabela ausente → 503 'Migração E0 pendente'. Sucesso → 201 {data}.
- **Casos de teste:**
  - **Criar frente por disciplina** - DADO obra do tenant . QUANDO POST {disciplina_slug:'eletrica'} . ENTAO 201 com data.codigo gerado, ativo=true e ordem = max+1
  - **Sem nome nem disciplina** - DADO body {} . QUANDO POST /eap . ENTAO 400
  - **Colisão de código** - DADO obra que já tem frente com o código base do nome . QUANDO POST com o mesmo nome . ENTAO 201 com codigo sufixado (ex.: 'ELE2'), sem 409

### PATCH /api/crm/obras/[id]/eap
- **Auth:** requireCrmComercial
- **Proposito:** Edita uma frente por body.id: ativo (ocultar/ativar), nome (código imutável), ordem, peso_fisico, peso_financeiro, area_label.
- **Regras:** body.id obrigatório (400). Update filtrado por .eq(id)+.eq(obra_id) (obra já validada por posse). Frente inexistente na obra → 404. Sucesso → {data}.
- **Casos de teste:**
  - **Ocultar frente** - DADO frente ativa da obra . QUANDO PATCH {id:<frenteId>, ativo:false} . ENTAO 200 com data.ativo=false
  - **id ausente** - DADO body sem id . QUANDO PATCH /eap . ENTAO 400 'id da frente é obrigatório'
  - **Frente de outra obra** - DADO frenteId pertencente a outra obra . QUANDO PATCH {id:<frenteId>} . ENTAO 404 'Frente não encontrada'

### GET /api/crm/obras/[id]/itens
- **Auth:** requireCrmSessao
- **Proposito:** Lista itens/subitens da obra pela view vw_hub_obra_itens_situacao (inclui situacao derivada + dias_atraso). Filtros: ?disciplina, ?area, ?situacao (validada), ?ambiente (E0.5). Limite 1000.
- **Regras:** Posse da obra → 404. Tolerância E0.5: colunas ambiente/taxonomia_id ausentes → retry sem elas (filtro ambiente degrada junto). Tabela/view ausente (E2 pendente) → 200 {data:[], migracao_pendente:true, aviso}.
- **Casos de teste:**
  - **Listar com filtro de situação** - DADO obra com itens em situações variadas . QUANDO GET /itens?situacao=atrasado . ENTAO 200 apenas itens com situacao='atrasado' (derivada na view)
  - **Obra cross-tenant** - DADO obra de outro tenant . QUANDO GET /itens . ENTAO 404 'Obra não encontrada'
  - **E2 pendente** - DADO view ausente no banco . QUANDO GET /itens . ENTAO 200 {data:[], migracao_pendente:true} (nunca 500)

### POST /api/crm/obras/[id]/itens
- **Auth:** requireCrmComercial
- **Proposito:** Cria item (parent_id null) ou subitem. Código auto-gerado do nome (sufixo -2, -3 em colisão) ou aceito do body. Canonicaliza ambiente (trim+lowercase, R3) e aceita taxonomia_id (E0.5, com retry sem as colunas).
- **Regras:** nome obrigatório (400). parent_id (se vier) validado por posse na mesma obra/tenant → 404 'Item pai não encontrado nesta obra.'. pct_avanco clampado 0–100. tipo/andamento validados por whitelist (default contrato/nao_iniciado). Duplicate key → 409 com o código em conflito. Tabela ausente → 503.
- **Casos de teste:**
  - **Criar item** - DADO obra do tenant . QUANDO POST {nome:'Alvenaria', ambiente:'Sala '} . ENTAO 201 com codigo gerado, ordem=max+1 e ambiente canonicalizado 'sala'
  - **Pai de outra obra** - DADO parent_id de item pertencente a outra obra . QUANDO POST {nome:'Sub', parent_id:<idExterno>} . ENTAO 404 'Item pai não encontrado nesta obra.'
  - **Código duplicado** - DADO body com codigo explícito já usado na obra . QUANDO POST {nome:'X', codigo:'ALV'} . ENTAO 409 com mensagem citando o código

### PATCH /api/crm/obras/[id]/itens
- **Auth:** requireCrmComercial (custo: gate adicional por persona)
- **Proposito:** Atualiza item por body.id: avanço (pct_avanco 0–100), andamento, datas, quantidade, unidade, bloqueios falta_* (5 booleans), evidência (evidencia_url → tem_evidencia), situacao_override, nome/descrição/observações, ativo/ordem/frente_id e custos E7 (custo_locacao_frete/material/mao_obra/bdi_fator).
- **Regras:** Situação NUNCA é escrita (derivada na view); situacao_override só aceita os 5 valores do CHECK (rejeita sem_data/atencao). GATE DE PERSONA server-side: papel sem sessaoPodeEscreverCusto → campos de custo silenciosamente ignorados + flag custo_ignorado_persona:true. Tolerância E7: colunas de custo ausentes → retry sem custo, resposta com migracao_pendente:true e aviso honesto. Item inexistente → 404.
- **Casos de teste:**
  - **Atualizar avanço** - DADO item da obra . QUANDO PATCH {id:<itemId>, pct_avanco:150} . ENTAO 200 com pct_avanco clampado em 100
  - **Custo bloqueado por persona** - DADO sessão com papel que não pode escrever custo (persona arquiteto/prestador) . QUANDO PATCH {id, custo_material:500} . ENTAO 200 com custo_ignorado_persona:true e custo NÃO gravado
  - **id ausente** - DADO body sem id . QUANDO PATCH /itens . ENTAO 400 'id do item é obrigatório'

### GET /api/crm/obras/[id]/restricoes
- **Auth:** requireCrmSessao
- **Proposito:** Lista restrições/bloqueios da obra (hub_obra_restricoes), mais recente primeiro, limite 500. ?ativas=1 filtra status in (aberta, em_resolucao, reaberta).
- **Regras:** Posse da obra → 404. .eq(tenant_id) puro. Tabela ausente (E3 pendente) → 200 {data:[], migracao_pendente:true, aviso}.
- **Casos de teste:**
  - **Listar só ativas** - DADO obra com restrições resolvidas e abertas . QUANDO GET /restricoes?ativas=1 . ENTAO 200 apenas status aberta/em_resolucao/reaberta
  - **Obra de outro tenant** - DADO obra alheia . QUANDO GET /restricoes . ENTAO 404
  - **E3 pendente** - DADO tabela ausente . QUANDO GET /restricoes . ENTAO 200 {data:[], migracao_pendente:true}

### POST /api/crm/obras/[id]/restricoes
- **Auth:** requireCrmComercial
- **Proposito:** Cria restrição. Com item_id: caminho idempotente via RPC hub_obra_restricao_promover (não duplica dossiê) + liga o boolean falta_* correspondente no item (sync E2 explícito) + enriquece com campos opcionais. Sem item_id: INSERT direto (bloqueio de frente/obra) com acao_sugerida padrão do tipo.
- **Regras:** tipo validado por isTipoRestricao (400 'Tipo de restrição inválido.'). item_id (se vier) validado por posse (404). origem sanitizada — NUNCA aceita 'sst' do caller (sst só nasce do flag sst=true com tipo='documento'). Resposta 201 {data} (com idempotente:true no caminho da RPC). Tabela ausente → 503.
- **Casos de teste:**
  - **Restrição de material em item** - DADO item da obra . QUANDO POST {tipo:'material', item_id:<id>} . ENTAO 201 {data, idempotente:true} e falta_material=true no item
  - **Tipo inválido** - DADO body {tipo:'clima'} (fora da whitelist) . QUANDO POST /restricoes . ENTAO 400 'Tipo de restrição inválido.'
  - **Idempotência da promoção** - DADO restrição já aberta para (item, tipo) . QUANDO POST repetido com o mesmo item_id+tipo . ENTAO 201 devolvendo o MESMO dossiê (RPC promover não duplica)

### PATCH /api/crm/obras/[id]/restricoes
- **Auth:** requireCrmComercial
- **Proposito:** Resolver / reabrir / em_resolucao / virar_pendencia / editar restrição (body.id). Ao resolver: grava resolvido_em/resolvido_por/resolucao_obs. Ao resolver ou virar pendência de restrição ligada a item, LIMPA o boolean falta_* do item (sync E2; falha no sync não derruba a resolução).
- **Regras:** body.id obrigatório (400). status validado contra whitelist de 5 valores (400). SST readonly: restrição sst tipo documento NÃO pode ser resolvida aqui → 409 'Documento de SST: resolução só por regularização auditada.'. Posse (obra+tenant) na leitura e no update → 404.
- **Casos de teste:**
  - **Resolver restrição de item** - DADO restrição aberta tipo material ligada a item com falta_material=true . QUANDO PATCH {id, status:'resolvida'} . ENTAO 200 com resolvido_em preenchido e falta_material=false no item
  - **SST não resolve por 1 toque** - DADO restrição com sst=true (tipo documento) . QUANDO PATCH {id, status:'resolvida'} . ENTAO 409
  - **Status inválido** - DADO restrição da obra . QUANDO PATCH {id, status:'fechada'} . ENTAO 400 'Status inválido.'

### POST /api/crm/obras/[id]/restricoes/[rid]/gerar-sc
- **Auth:** requireCrmComercial
- **Proposito:** Elo E3→E5: gera SC (solicitação de compra) em RASCUNHO pré-preenchida a partir de uma restrição de material (origem='e3_restricao', urgencia='urgente', frente herdada da restrição/item, descrição do título/item) e grava pedido_material_id de volta na restrição (elo bidirecional).
- **Regras:** Sem body. Posse da obra e da restrição → 404. Idempotente: se a restrição já tem pedido_material_id de SC não-cancelada → 200 {data, idempotente:true}. Código via RPC gerar_codigo_sc (fallback timestamp). NÃO aprova nem resolve nada. Migração E3/E5 pendente → 503.
- **Casos de teste:**
  - **Gerar SC do bloqueio** - DADO restrição de material sem SC vinculada . QUANDO POST /restricoes/{rid}/gerar-sc . ENTAO 201 com SC status='rascunho', origem='e3_restricao', urgencia='urgente' e restricao.pedido_material_id preenchido
  - **Idempotência** - DADO restrição que já tem SC ativa vinculada . QUANDO POST repetido . ENTAO 200 {idempotente:true} com a MESMA SC (sem duplicar)
  - **Restrição inexistente** - DADO rid aleatório . QUANDO POST /gerar-sc . ENTAO 404 'Restrição não encontrada'

### GET /api/crm/obras/[id]/cronograma
- **Auth:** requireCrmSessao
- **Proposito:** Curva-S da obra (E4): {baseline, planejado[], executado[], hoje_index, kpis} — executado ao vivo derivado do avanço ponderado dos itens de escopo; planejado da baseline E4 ou fallback LINEAR das datas da obra.
- **Regras:** Leitura pura (sem escrita). Posse da obra → 404. Tolerâncias em cascata: tabelas E4 ausentes → migracao_e4_pendente + fallback linear; hub_obra_itens ausente → migracao_e2_pendente com avanço 0. DEFESA POR PERSONA: papel sem personaPodeVerPreco recebe financeiro=0 em todos os pontos e kpis.financeiroAtual=0 (ver_financeiro:false).
- **Casos de teste:**
  - **Curva com itens** - DADO obra com itens ativos e pct_avanco . QUANDO GET /cronograma . ENTAO 200 com planejado[] e executado[] renderizáveis, kpis e hoje_index
  - **Persona sem preço** - DADO sessão cuja persona não vê preço (arquiteto) . QUANDO GET /cronograma . ENTAO 200 com ver_financeiro:false e todos os campos financeiro zerados
  - **Obra de outro tenant** - DADO obra alheia . QUANDO GET /cronograma . ENTAO 404

### GET /api/crm/obras/[id]/escopo
- **Auth:** requireCrmSessao
- **Proposito:** Árvore de escopo ('planilha viva'): ambiente → disciplina → item com custo/preço/margem/avanço + subtotais + cockpit. Leitura pura (escrita reusa POST/PATCH de /itens).
- **Regras:** Posse da obra → 404. Tolerância E7: colunas de custo ausentes → recalcula in-code sem custo (migracao_pendente:true, preço/margem '—'); hub_obra_itens ausente → ambientes:[] com aviso E2. SANITIZAÇÃO POR PERSONA (server-side): arquiteto não vê custo/preço/margem; prestador vê preço mas não custo/margem; executor|hub veem tudo. Campos ocultados viram null/0 mantendo a forma.
- **Casos de teste:**
  - **Árvore completa** - DADO sessão executor/hub e obra com itens com custos E7 . QUANDO GET /escopo . ENTAO 200 com ambientes[].disciplinas[].itens[], subtotais e cockpit com total_orcado/custo/margem_pct
  - **Sanitização de persona** - DADO sessão com persona arquiteto . QUANDO GET /escopo . ENTAO 200 mantendo a forma do payload mas custo/preço/margem nulos/zerados em item, subtotal e cockpit
  - **Obra inexistente** - DADO UUID inexistente . QUANDO GET /escopo . ENTAO 404 'Obra não encontrada'

### GET /api/crm/obras/[id]/financeiro
- **Auth:** requireCrmSessao
- **Proposito:** Painel financeiro E6: resumo (previsto/orcado/aprovado/a_pagar/vencendo_7d/atrasado/aguarda_2a_chave/custódia), orçamentos com itens, pagamentos com balde + estado real da dupla chave (arq/hub via hub_aprovacoes), cobertura (vw compatibilização — só administração) e escrow (conta + movimentos).
- **Regras:** BIFURCAÇÃO por tipo_contrato NA QUERY: preco_fechado NÃO seleciona valor_unitario/composição dos itens (defesa — composição nunca vai ao cliente). Posse da obra → 404. Tabela ausente (E6 pendente) → 200 {migracao_pendente:true} com baldes vazios.
- **Casos de teste:**
  - **Painel administração** - DADO obra tipo_contrato='administracao' com orçamentos e pagamentos . QUANDO GET /financeiro . ENTAO 200 com itens contendo valor_unitario, cobertura preenchida e resumo consistente
  - **Preço fechado esconde composição** - DADO obra tipo_contrato='preco_fechado' . QUANDO GET /financeiro . ENTAO 200 com itens de orçamento SEM campos valor_unitario/quantidade/spread_pct e cobertura=[]
  - **Obra de outro tenant** - DADO obra alheia . QUANDO GET /financeiro . ENTAO 404

### POST /api/crm/obras/[id]/financeiro
- **Auth:** requireCrmFinanceiro (nível financeiro — mais restrito que comercial)
- **Proposito:** Cria em estado de PREPARO: acao='orcamento' (Gate 1, nasce rascunho/enviado — NUNCA aprovado) ou acao='pagamento' (Gate 2, nasce bloqueado salvo orçamento aprovado / avulso / reembolso / adiantamento justificado).
- **Regras:** Orçamento: titulo obrigatório (400); R2: linha de item com descrição mas sem item_id de escopo → 400 {codigo:'item_escopo_obrigatorio'}; status do caller restrito a rascunho|enviado; valor_total = soma qtd×unitário (administração) ou lump sum (preço fechado). Pagamento: titulo obrigatório, valor > 0 (400), data_vencimento obrigatória (400); adiantamento sem justificativa → 422 'adiantamento_exige_justificativa'; status inicial 'liberado' só se orçamento vinculado está aprovado ou tipo avulso/reembolso/adiantamento. acao desconhecida → 400. Tabela ausente → 503.
- **Casos de teste:**
  - **Criar orçamento em rascunho** - DADO sessão financeiro+ e itens todos com item_id de escopo . QUANDO POST {acao:'orcamento', titulo:'Frente Elétrica', itens:[...]} . ENTAO 201 com status='rascunho' e valor_total somado dos itens
  - **Item sem elo de escopo** - DADO itens com uma linha {descricao:'Fios', item_id:''} . QUANDO POST {acao:'orcamento', ...} . ENTAO 400 {codigo:'item_escopo_obrigatorio'}
  - **Adiantamento sem justificativa** - DADO body {acao:'pagamento', tipo:'adiantamento', titulo, valor:1000, data_vencimento} sem justificativa . QUANDO POST /financeiro . ENTAO 422 {error:'adiantamento_exige_justificativa'}

### PATCH /api/crm/obras/[id]/financeiro
- **Auth:** requireCrmComercial
- **Proposito:** Ações de preparo humano: enviar_orcamento (enfileira Gate 1 em hub_aprovacoes e marca orçamento 'enviado'), enviar_pagamento (enfileira Gate 2 DUPLO — cria aprovação arq + hub), cancelar_orcamento / cancelar_pagamento (soft-delete: status='cancelado', nunca DELETE).
- **Regras:** enviar_orcamento: orcamento_id obrigatório (400), não encontrado → 404, já aprovado → 422. enviar_pagamento: pagamento_id obrigatório; pagamento bloqueado (orçamento não aprovado) → 422 'orcamento_nao_aprovado'; já enfileirado (2 aprovações) → {ok:true, idempotente:true}. acao inválida → 400. Aprovar em si é fora daqui (gate dourado /api/aprovacoes).
- **Casos de teste:**
  - **Enfileirar orçamento** - DADO orçamento em rascunho da obra . QUANDO PATCH {acao:'enviar_orcamento', orcamento_id} . ENTAO 200 {ok:true, aprovacao_id} e orçamento com status='enviado'
  - **Pagamento bloqueado** - DADO pagamento com status='bloqueado' (orçamento não aprovado) . QUANDO PATCH {acao:'enviar_pagamento', pagamento_id} . ENTAO 422 {error:'orcamento_nao_aprovado'}
  - **Dupla chave idempotente** - DADO pagamento já com aprovacao_arq_id e aprovacao_hub_id . QUANDO PATCH {acao:'enviar_pagamento', pagamento_id} . ENTAO 200 {ok:true, idempotente:true} sem criar novas aprovações

### GET /api/crm/obras/[id]/diario
- **Auth:** requireCrmComercial (atenção: o GET também exige comercial+, não só sessão)
- **Proposito:** Histórico do Diário de Obra (RDO básico): últimas 50 entradas {id, obra_id, resumo, clima, registrado_por, criado_em}.
- **Regras:** Posse da obra → 404. .eq(tenant_id) puro. Tabela ausente → 200 {data:[], migracao_pendente:true}.
- **Casos de teste:**
  - **Listar diário** - DADO obra com entradas de diário . QUANDO GET /diario . ENTAO 200 {data:[...]} ordenado por criado_em desc, máx 50
  - **Papel insuficiente** - DADO sessão atendente (abaixo de comercial) . QUANDO GET /diario . ENTAO 403 do guard requireCrmComercial
  - **Obra de outro tenant** - DADO obra alheia . QUANDO GET /diario . ENTAO 404

### POST /api/crm/obras/[id]/diario
- **Auth:** requireCrmComercial
- **Proposito:** Cria entrada no diário: body {resumo (obrigatório), clima (opcional)}.
- **Regras:** resumo vazio → 400 'Escreva o resumo do dia.'. JSON inválido → 400. tenant_id da sessão no insert. Tabela ausente → 503.
- **Casos de teste:**
  - **Registrar dia** - DADO obra do tenant . QUANDO POST {resumo:'Concretagem da laje', clima:'sol'} . ENTAO 200 {data} com a entrada criada
  - **Resumo vazio** - DADO body {resumo:'  '} . QUANDO POST /diario . ENTAO 400
  - **Obra inexistente** - DADO UUID aleatório . QUANDO POST /diario . ENTAO 404 'Obra não encontrada'

### GET /api/crm/obras/[id]/medicoes
- **Auth:** requireCrmSessao
- **Proposito:** Histórico append-only de medições, paginado por cursor opaco (base64url de criado_em|id). Params: ?item_id, ?limit (padrão 30, máx 100), ?cursor. Resolve nomes de autor (UUID→users.name/email) e troca paths de mídia por URLs ASSINADAS (~1h, bucket privado).
- **Regras:** Posse da obra → 404. Cursor corrompido → ignorado (1ª página). Resposta {data, next_cursor, has_more, migracao_pendente}. Tabela ausente (E7c) → 200 {data:[], migracao_pendente:true}.
- **Casos de teste:**
  - **Paginação por cursor** - DADO obra com 40 medições e limit=30 . QUANDO GET /medicoes?limit=30 e depois GET com o next_cursor devolvido . ENTAO 1ª página com 30 + has_more:true; 2ª com 10 restantes, next_cursor:null, sem duplicatas
  - **URL assinada da evidência** - DADO medição com foto_url gravada como path (não http) . QUANDO GET /medicoes . ENTAO 200 com foto_url convertida em URL assinada https
  - **Obra de outro tenant** - DADO obra alheia . QUANDO GET /medicoes . ENTAO 404

### POST /api/crm/obras/[id]/medicoes
- **Auth:** requireCrmComercial
- **Proposito:** Registra medição append-only + atualiza pct_avanco vivo do item. pct resultante derivado da quantidade física (quantidade_realizada / quantidade planejada) quando possível, senão do pct informado; sem nada utilizável, preserva o pct atual.
- **Regras:** item_id obrigatório (400); item validado por posse na mesma obra/tenant → 404. criado_por = userId da sessão (nunca null). Tolerância E7c: tabela ausente → 200 com medicao_registrada:false, migracao_pendente:true e evidencia_descartada:true quando havia foto/vídeo/observação (aviso honesto). Erro REAL no insert → reverte o pct do item (update otimista .eq(pct_avanco)) e responde 500. Sucesso → 201 {data, pct_avanco_resultante, medicao_registrada:true}.
- **Casos de teste:**
  - **Medição por quantidade** - DADO item com quantidade planejada 100 e pct atual 0 . QUANDO POST {item_id, quantidade_realizada:50} . ENTAO 201 com pct_avanco_resultante=50 e pct_avanco=50 no item
  - **item_id ausente** - DADO body {} . QUANDO POST /medicoes . ENTAO 400 'item_id é obrigatório'
  - **Item de outra obra** - DADO item_id de outra obra do mesmo tenant . QUANDO POST {item_id} . ENTAO 404 'Item não encontrado nesta obra.'

### POST /api/crm/obras/[id]/medicoes/upload
- **Auth:** requireCrmComercial
- **Proposito:** Upload multipart/form-data {file, tipo:'foto'|'video'} da evidência da medição para bucket PRIVADO; devolve {path, tipo} (path é gravado depois via POST /medicoes; exibição só por URL assinada).
- **Regras:** Não-multipart → 400. tipo fora de foto|video → 400. Arquivo ausente/vazio → 400. Limites: foto 25 MB, vídeo 200 MB → 413. Content-type incompatível (foto não-image/* ou vídeo não-video/*) → 415. Falha no storage → 502. Posse da obra → 404.
- **Casos de teste:**
  - **Upload de foto** - DADO form-data com file image/jpeg < 25MB e tipo='foto' . QUANDO POST /medicoes/upload . ENTAO 200 {path, tipo:'foto'} com path escopado por tenant/obra
  - **Arquivo grande demais** - DADO foto de 30MB . QUANDO POST /medicoes/upload . ENTAO 413 'Arquivo grande demais (máx 25 MB).'
  - **Mimetype errado** - DADO tipo='foto' com arquivo application/pdf . QUANDO POST /medicoes/upload . ENTAO 415 'Esperada uma imagem.'

### GET /api/crm/obras/[id]/inventario
- **Auth:** requireCrmSessao
- **Proposito:** Inventário derivado da view vw_hub_inventario (Entrada − Saída + Devolução + Ajuste), limite 500. ?categoria filtra; ?historico=<catalogo_id> muda para o histórico de movimentações do item (hub_estoque_mov, 200 linhas, tipo:'historico').
- **Regras:** Posse da obra → 404. Estoque negativo é permitido (a UI alerta, o endpoint não bloqueia). Tabela/view ausente (E5) → 200 {data:[], migracao_pendente:true, aviso}.
- **Casos de teste:**
  - **Inventário da obra** - DADO obra com movimentos de estoque . QUANDO GET /inventario . ENTAO 200 {data:[{em_estoque, total_entrada, total_saida,...}]}
  - **Histórico de um item** - DADO catalogo_id com movimentações . QUANDO GET /inventario?historico=<catalogoId> . ENTAO 200 {data:[movimentos], tipo:'historico'} mais recente primeiro
  - **Obra cross-tenant** - DADO obra de outro tenant . QUANDO GET /inventario . ENTAO 404

### POST /api/crm/obras/[id]/estoque
- **Auth:** requireCrmComercial
- **Proposito:** Registra movimentação manual APPEND-ONLY em hub_estoque_mov: saida | devolucao | ajuste (entrada é exclusiva da cascata SC→entrega). Resolve snapshot do item pelo hub_catalogo (tenant OU global NULL) quando catalogo_id vier.
- **Regras:** tipo validado (400 'Tipo inválido...'); tipo='entrada' explicitamente rejeitado → 400 'Entradas são registradas pela entrega da SC...'. quantidade > 0 (400). Exige catalogo_id OU descricao (400). registrado_por = userId, origem='manual'. Estoque negativo permitido. Tabela ausente → 503. Sucesso → 201.
- **Casos de teste:**
  - **Registrar saída** - DADO obra com item no catálogo . QUANDO POST {tipo:'saida', catalogo_id, quantidade:5} . ENTAO 201 com nova linha append-only (snapshot descricao/unidade herdado do catálogo)
  - **Entrada manual bloqueada** - DADO body {tipo:'entrada', descricao:'Cimento', quantidade:10} . QUANDO POST /estoque . ENTAO 400 mandando usar a entrega da SC
  - **Quantidade inválida** - DADO body {tipo:'saida', descricao:'X', quantidade:0} . QUANDO POST /estoque . ENTAO 400 'Quantidade deve ser maior que zero.'

### GET /api/crm/obras/[id]/sc
- **Auth:** requireCrmSessao
- **Proposito:** Lista SCs da obra (hub_pedidos_material) com itens embutidos (hub_pedido_itens em 1 query — sem N+1), mais recente primeiro, limite 300. ?abertas=1 filtra status in (rascunho, cotando, aprovado, entregue_parcial).
- **Regras:** Posse da obra → 404. .eq(tenant_id) puro nas duas tabelas. Tabela ausente (E5) → 200 {data:[], migracao_pendente:true}.
- **Casos de teste:**
  - **Listar SCs com itens** - DADO obra com SCs e itens . QUANDO GET /sc . ENTAO 200 {data:[{...sc, itens:[...]}]}
  - **Só abertas** - DADO SCs canceladas e em rascunho . QUANDO GET /sc?abertas=1 . ENTAO 200 sem as canceladas/entregues
  - **Sem sessão** - DADO requisição anônima . QUANDO GET /sc . ENTAO 401

### POST /api/crm/obras/[id]/sc
- **Auth:** requireCrmComercial
- **Proposito:** Cria SC com itens estruturados. Código atômico por tenant via RPC gerar_codigo_sc (fallback timestamp). Cotações sanitizadas e pontuadas (cotacoes_json). valor_estimado = Σ qtd × preço estimado.
- **Regras:** Exige ao menos 1 item válido OU descricao livre (400). GATE: status do caller restrito a rascunho|cotando — NUNCA nasce 'aprovado' (aprovar é o PATCH humano). tipo_material/urgencia/origem validados por whitelist com defaults. Itens sem descrição ou qtd<=0 são descartados. Tabela ausente → 503. Sucesso → 201 {data:{...sc, itens}}.
- **Casos de teste:**
  - **Criar SC com itens** - DADO obra do tenant . QUANDO POST {itens:[{descricao:'Cimento CP-II', qtd_pedida:20, preco_unit_estimado:35}]} . ENTAO 201 com codigo SC-*, status='rascunho' e valor_estimado=700
  - **Status aprovado forjado** - DADO body {status:'aprovado', itens:[...]} . QUANDO POST /sc . ENTAO 201 mas com status='rascunho' (o gate rebaixa; nunca nasce aprovada)
  - **SC vazia** - DADO body sem itens e sem descricao . QUANDO POST /sc . ENTAO 400 'Informe ao menos um item ou uma descrição da SC.'

### PATCH /api/crm/obras/[id]/sc/[scid]
- **Auth:** requireCrmComercial
- **Proposito:** Ações sobre uma SC: acao='aprovar' (GATE HUMANO), acao='registrar_entrega' (cascata SC→Inventário via RPC hub_sc_registrar_entrega, idempotente por entrega_uid), acao='cancelar' (soft-delete), acao='escolher_cotacao' (grava cotacoes_json + preco_unit_final), ou {status} para mover rascunho↔cotando.
- **Regras:** SC carregada por posse (obra+tenant) → 404. aprovar: UPDATE atômico com .in(status,['rascunho','cotando']) — 0 linhas → 409 (não reabre cancelada/entregue; corrida entre 2 aprovadores segura). cancelar: só de rascunho/cotando/aprovado/entregue_parcial → senão 409. registrar_entrega: exige itens [{item_id, qtd>0}] (400); RPC recusa SC não aprovada → 409; entrega_uid UUID do cliente garante idempotência no retry. Mover status para aprovado/entregue/cancelado via {status} → 400 'Use a ação dedicada'. Nenhuma ação reconhecida → 400.
- **Casos de teste:**
  - **Aprovar compra** - DADO SC em status 'cotando' . QUANDO PATCH {acao:'aprovar'} . ENTAO 200 com status='aprovado', aprovado_por e aprovado_em preenchidos
  - **Aprovar SC cancelada** - DADO SC com status='cancelado' . QUANDO PATCH {acao:'aprovar'} . ENTAO 409 'não está num estado que permita aprovar'
  - **Entrega antes da aprovação** - DADO SC em rascunho . QUANDO PATCH {acao:'registrar_entrega', itens:[{item_id, qtd:5}]} . ENTAO 409 'Esta compra ainda não foi aprovada...' (RPC sc_nao_aprovada)

### GET /api/crm/projetos
- **Auth:** requireCrmSessao
- **Proposito:** Lista até 100 projetos (hub_projetos) do tenant com count, filtros ?negocio_id, ?estagio, ?pipeline_id, e estagio_counts agregado (mapeando status legado quando a migração A0 falta).
- **Regras:** .eq(tenant_id) ESTRITO (o OR is.null legado foi removido — vazamento fechado). Tolerância A0: colunas ausentes → SELECT legado sem filtro de estágio + migracao_pendente:true. Resposta {data, total, estagio_counts, migracao_pendente}.
- **Casos de teste:**
  - **Listar por estágio** - DADO projetos em estágios diferentes . QUANDO GET /api/crm/projetos?estagio=briefing . ENTAO 200 apenas projetos com estagio='briefing' + estagio_counts
  - **Isolamento de tenant** - DADO projetos de outro tenant e órfãos (tenant_id NULL) . QUANDO GET com sessão do tenant A . ENTAO 200 sem NENHUM projeto de outro tenant nem órfão
  - **Sem sessão** - DADO requisição anônima . QUANDO GET /api/crm/projetos . ENTAO 401

### POST /api/crm/projetos
- **Auth:** requireCrmComercial
- **Proposito:** Cria projeto de arquitetura. Título explícito ou auto ('Projeto — <Cliente>' / 'Projeto — <Tipologia>' / 'Projeto'). Código ATÔMICO por tenant (gerarCodigoProjeto). status espelha estagio (compat A0).
- **Regras:** Idempotência 60s por título+tenant → 200 {idempotente:true}. Negócio que JÁ tem projeto → 200 {ja_existe:true} devolvendo o existente (não duplica). estagio default ESTAGIO_PROJETO_INICIAL. area_m2 aceita number ou string numérica. Tolerância A0: colunas ausentes → insert legado + migracao_pendente:true. Sucesso → 201.
- **Casos de teste:**
  - **Criar com título auto** - DADO body {cliente_nome:'Maria', tipologia:'residencial'} . QUANDO POST /api/crm/projetos . ENTAO 201 com titulo 'Projeto — Maria', codigo PRJ-* atômico e aprovacao_status='sem_aprovacao'
  - **Negócio já tem projeto** - DADO negocio_id com projeto existente no tenant . QUANDO POST {negocio_id} . ENTAO 200 {ja_existe:true} devolvendo o projeto existente
  - **Double-tap** - DADO projeto 'Projeto — Maria' criado há <60s . QUANDO POST repetido com o mesmo título . ENTAO 200 {idempotente:true} sem duplicar

### GET /api/crm/projetos/[id]
- **Auth:** requireCrmSessao
- **Proposito:** Detalhe de um projeto (SELECT A0 completo com fallback legado por coluna ausente).
- **Regras:** id validado por regex UUID → 400 'ID inválido'. .eq(tenant_id) estrito → projeto de outro tenant/órfão = 404. 503 se config ausente.
- **Casos de teste:**
  - **Detalhe do projeto** - DADO projeto do tenant . QUANDO GET /api/crm/projetos/{id} . ENTAO 200 {data} com codigo, estagio, aprovacao_status, obra_id etc.
  - **ID não-UUID** - DADO id='abc' . QUANDO GET /api/crm/projetos/abc . ENTAO 400 'ID inválido'
  - **Projeto de outro tenant** - DADO UUID válido de projeto alheio . QUANDO GET com sessão do tenant A . ENTAO 404 'Projeto não encontrado'

### PATCH /api/crm/projetos/[id]
- **Auth:** requireCrmComercial
- **Proposito:** Edita projeto: titulo, estagio (move no funil), aprovacao_status, tipologia, area_m2, responsavel_id, cliente_nome, proxima_entrega(_em), negocio_id, obra_id.
- **Regras:** UUID inválido → 400. Mover estágio: slug validado contra defaults do funil OU hub_pipeline_estagios do pipeline do projeto (custom) → slug inexistente = 400 'Estágio "X" não existe neste funil.'; status espelha estagio. UPDATE tenant-scoped (.eq id + tenant_id) → cross-tenant = 404. Tolerância A0: coluna ausente → aplica só o subconjunto legado.
- **Casos de teste:**
  - **Mover de estágio** - DADO projeto em 'briefing' . QUANDO PATCH {estagio:'estudo'} . ENTAO 200 com estagio='estudo' e status='estudo' (espelho)
  - **Estágio fantasma** - DADO pipeline sem o slug 'fase_secreta' . QUANDO PATCH {estagio:'fase_secreta'} . ENTAO 400 'Estágio "fase_secreta" não existe neste funil.'
  - **Update cross-tenant** - DADO projeto de outro tenant . QUANDO PATCH {titulo:'Hack'} . ENTAO 404 e nenhuma linha alterada

### POST /api/crm/projetos/[id]/gerar-obra
- **Auth:** requireCrmComercial
- **Proposito:** Orquestrador A2 do elo Arquitetura→Engenharia: gera obra a partir do projeto via criarObraComEAP, derivando tipo_obra/segmento da tipologia (overrides opcionais no body: tipo_obra, segmento, titulo, frentes_selecionadas), herdando cliente/negócio (linhagem), e grava obra_id de volta no projeto (lock).
- **Regras:** UUID inválido → 400. Projeto só do tenant → 404. IDEMPOTÊNCIA: projeto já com obra_id → 200 {data:{id}, vinculada:true, idempotente:true} SEM criar. GATE server-side: só gera se estagio='entregue' OU aprovacao_status='aprovado' → senão 400 {codigo:'gate_nao_entregue'}. Se o PATCH do elo falhar após criar a obra → 201 com elo_ok:false + aviso.
- **Casos de teste:**
  - **Gerar obra de projeto entregue** - DADO projeto com estagio='entregue' e tipologia residencial, sem obra_id . QUANDO POST /gerar-obra . ENTAO 201 com data (obra), frentes_criadas, itens_criados (semeados por ambiente) e elo_ok:true; projeto.obra_id preenchido
  - **Gate não liberado** - DADO projeto em 'estudo' com aprovacao_status≠'aprovado' . QUANDO POST /gerar-obra . ENTAO 400 {codigo:'gate_nao_entregue'}
  - **Idempotência do elo** - DADO projeto que já tem obra_id . QUANDO POST /gerar-obra repetido . ENTAO 200 {idempotente:true, vinculada:true} sem criar segunda obra

### GET /api/crm/projetos/[id]/programa
- **Auth:** requireCrmSessao
- **Proposito:** Lista as fases/cômodos do projeto (hub_projetos_fases) ordenados por ordem. ?tipo='comodo' (Programa) | 'fase' (Entregáveis); sem filtro = todos.
- **Regras:** UUID inválido → 400. projetoDoTenant estrito → 404. Fallback tolerante em 3 níveis: SELECT A1 (com SLA) → A0 → legado (sem filtro de tipo), cada queda só por coluna ausente.
- **Casos de teste:**
  - **Listar cômodos** - DADO projeto com cômodos e entregáveis . QUANDO GET /programa?tipo=comodo . ENTAO 200 {data} só com tipo='comodo', ordenado por ordem
  - **Projeto de outro tenant** - DADO projeto alheio . QUANDO GET /programa . ENTAO 404 'Projeto não encontrado'
  - **ID inválido** - DADO id não-UUID . QUANDO GET /api/crm/projetos/abc/programa . ENTAO 400

### POST /api/crm/projetos/[id]/programa
- **Auth:** requireCrmComercial
- **Proposito:** Cria itens do programa em lote ({itens:[...]}) ou item único no body. tipo default 'comodo'. Cada item: nome (obrigatório, 200 chars), categoria, metragem_m2 (number ou string numérica), observacao (2000 chars). ordem continua do máximo existente.
- **Regras:** Itens sem nome são descartados; nenhum válido → 400 'Nenhum item válido (informe ao menos um nome).'. status inicial 'pendente'. Posse do projeto → 404. Tolerância A0: colunas ausentes → insert do subconjunto legado. Sucesso → 201 {data, criados}.
- **Casos de teste:**
  - **Criar cômodos em lote** - DADO body {itens:[{nome:'Sala', metragem_m2:20},{nome:'Cozinha'}], tipo:'comodo'} . QUANDO POST /programa . ENTAO 201 {criados:2} com ordens sequenciais
  - **Lote todo inválido** - DADO body {itens:[{nome:''},{}]} . QUANDO POST /programa . ENTAO 400 'Nenhum item válido...'
  - **Projeto cross-tenant** - DADO projeto de outro tenant . QUANDO POST /programa . ENTAO 404

### PATCH /api/crm/projetos/[id]/programa/[faseId]
- **Auth:** requireCrmComercial
- **Proposito:** Edita fase/cômodo: nome, metragem_m2, observacao, categoria, entregavel_url (anexo por URL — fluxo MVP).
- **Regras:** UUIDs inválidos → 400. Posse do projeto → 404; fase carregada tenant-scoped: 'sem_tenant' (migração pendente) → 409; não encontrada → 404. Sem campos além de atualizado_em → devolve a fase atual (idempotente). Update com .eq(id + projeto_id + tenant_id).
- **Casos de teste:**
  - **Renomear cômodo** - DADO cômodo do projeto . QUANDO PATCH {nome:'Suíte Master'} . ENTAO 200 com data.nome atualizado
  - **Body vazio idempotente** - DADO fase existente . QUANDO PATCH {} . ENTAO 200 devolvendo a fase atual sem alterar
  - **Fase de outro projeto** - DADO faseId que não pertence ao projeto id . QUANDO PATCH {nome:'X'} . ENTAO 404 'Item não encontrado'

### DELETE /api/crm/projetos/[id]/programa/[faseId]
- **Auth:** requireCrmComercial
- **Proposito:** Remove fase/cômodo do programa. Após deletar uma fase (tipo='fase'), recalcula o agregado hub_projetos.aprovacao_status.
- **Regras:** UUIDs inválidos → 400. Posse projeto/fase → 404; 'sem_tenant' → 409. BLOQUEIO: entregável (tipo='fase') com aprovacao_status='enviado' (em voo) → 409 'Entregável em aprovação — registre a resposta ou cancele o envio antes de remover.'. Cômodo é sempre livre. Sucesso → {ok:true}.
- **Casos de teste:**
  - **Remover cômodo** - DADO cômodo tipo='comodo' . QUANDO DELETE /programa/{faseId} . ENTAO 200 {ok:true} e linha removida
  - **Entregável em voo** - DADO fase tipo='fase' com aprovacao_status='enviado' . QUANDO DELETE /programa/{faseId} . ENTAO 409 (bloqueado até responder/cancelar)
  - **Fase inexistente** - DADO faseId aleatório . QUANDO DELETE . ENTAO 404 'Item não encontrado'

### POST /api/crm/projetos/[id]/programa/[faseId]/aprovacao
- **Auth:** requireCrmComercial
- **Proposito:** Máquina de estados da aprovação do cliente (A1) numa rota única por body.acao: enviar (pendente/rejeitado→enviado), reenviar (rejeitado→enviado, nova versão), responder (enviado→aprovado|rejeitado+motivo), anexar (grava entregavel_url mantendo o estado). Ao final recalcula o agregado do projeto (hub_projetos.aprovacao_status) e grava SLA (aprovacao_enviado_em/respondido_em/motivo) quando as colunas A1 existem.
- **Regras:** UUIDs inválidos → 400. Posse projeto/fase → 404; 'sem_tenant' → 409. Só entregáveis (tipo='fase'); cômodo → 400. acao fora da whitelist → 400. Transições: enviar/reenviar sem entregavel_url → 422 'entregavel_sem_arquivo'; reenviar de não-rejeitado → 409; responder de não-enviado → 409; responder sem decisão → 400 'decisao_invalida'; rejeitar sem motivo → 400 'motivo_obrigatorio'. Resposta {data, acao, de, para, aprovacao_projeto, sla_persistido}.
- **Casos de teste:**
  - **Enviar para o cliente** - DADO entregável pendente com entregavel_url no body . QUANDO POST {acao:'enviar', entregavel_url:'https://...'} . ENTAO 200 com de:'pendente', para:'enviado' e aprovacao_enviado_em setado (sla_persistido:true)
  - **Enviar sem arquivo** - DADO entregável pendente sem entregavel_url (nem no body nem gravado) . QUANDO POST {acao:'enviar'} . ENTAO 422 'Anexe o arquivo do entregável (URL) antes de enviar...'
  - **Rejeitar sem motivo** - DADO entregável em 'enviado' . QUANDO POST {acao:'responder', decisao:'rejeitado'} sem motivo . ENTAO 400 'Para registrar uma reprovação, informe o motivo do cliente.'

### GET /api/crm/arquitetura/fila
- **Auth:** requireCrmSessao
- **Proposito:** Fila 'Em aprovação' do cockpit do arquiteto: entregáveis (tipo='fase') com aprovacao_status='enviado' do tenant, ordenados por tempo de espera (pior no topo, por aprovacao_enviado_em ou atualizado_em no fallback), limite 100, enriquecidos com título/código/cliente do projeto e dias_esperando.
- **Regras:** .eq(tenant_id) puro (nunca OR is.null). Fallback tolerante: coluna SLA ausente → ordena por atualizado_em; pré-A0 (sem tipo/aprovacao_status) → 200 {data:[], total:0, migracao_pendente:true}. Join leve com hub_projetos escopado por tenant.
- **Casos de teste:**
  - **Fila com espera** - DADO entregáveis enviados há N dias . QUANDO GET /api/crm/arquitetura/fila . ENTAO 200 {data:[{fase_id, projeto_titulo, dias_esperando,...}], total} ordenado do mais antigo para o mais novo
  - **Fila vazia** - DADO tenant sem entregáveis em 'enviado' . QUANDO GET /fila . ENTAO 200 {data:[], total:0}
  - **Isolamento de tenant** - DADO entregáveis 'enviado' de OUTRO tenant . QUANDO GET com sessão do tenant A . ENTAO 200 sem nenhum item do tenant B


---

## COMPRAS / COTAÇÕES / FINANCEIRO (SC da obra, gate humano de aprovação de compra, cotações de fornecedor, contas pagar/receber, dashboard financeiro e motor de comissões da rede)

### GET /api/crm/pedidos
- **Auth:** Sessão CRM ativa (requireCrmSessao — atendente ou acima)
- **Proposito:** Lista pedidos de material / SCs (hub_pedidos_material) do tenant da sessão, mais recentes primeiro (limite 100). Aceita query param ?obra_id= para filtrar por obra.
- **Regras:** Isolamento por .eq('tenant_id', ctx.tenantId) puro (crmDb service_role bypassa RLS). 503 se config Supabase ausente. Resposta { data: [...] }; campos: id, codigo, obra_id, descricao, status, valor_estimado, solicitado_por, criado_em, atualizado_em. Erro de banco → 500 { error }.
- **Casos de teste:**
  - **Listar pedidos do tenant** - DADO Usuário autenticado (qualquer nível) com pedidos existentes no seu tenant . QUANDO GET /api/crm/pedidos . ENTAO 200 com { data: [...] } contendo apenas pedidos do tenant da sessão, ordenados por criado_em desc, máx. 100
  - **Filtro por obra** - DADO Pedidos em duas obras distintas do tenant . QUANDO GET /api/crm/pedidos?obra_id=<obraA> . ENTAO 200 e todos os itens retornados têm obra_id = obraA
  - **Sem sessão** - DADO Request sem token/cookie de sessão CRM . QUANDO GET /api/crm/pedidos . ENTAO 401 (ou 403 conforme guard) com { error }; nenhum dado retornado

### POST /api/crm/pedidos
- **Auth:** Comercial+ (requireCrmComercial — comercial, gestor ou owner)
- **Proposito:** Cria um pedido de material (SC) avulso. GATE DE COMPRA: a rota NUNCA aceita status do body além de 'cotando' — qualquer outro valor vira 'rascunho'. É impossível nascer 'aprovado' por aqui (aprovação só no PATCH com acao='aprovar').
- **Regras:** descricao obrigatória (trim) → 400 'Descrição obrigatória'. status do body: só 'cotando' é aceito; default 'rascunho'. Código gerado por RPC gerar_codigo_sc (atômico por tenant); degrada para SC-<ano>-<timestamp> se a RPC faltar. tenant_id vem da sessão, nunca do body. Campos opcionais: obra_id, valor_estimado (Number), solicitado_por. 503 se config ausente; erro de insert → 500.
- **Casos de teste:**
  - **Criação feliz (rascunho)** - DADO Usuário comercial autenticado . QUANDO POST com { descricao: 'Cimento 50 sacos' } . ENTAO 201 { data } com status='rascunho', codigo iniciando por 'SC-' e tenant_id do caller (não exposto no SELECT mas isolado)
  - **Tentativa de nascer aprovado (fraude do gate)** - DADO Usuário comercial autenticado . QUANDO POST com { descricao: 'x', status: 'aprovado' } . ENTAO 201 mas data.status === 'rascunho' (o status do body é ignorado; só 'cotando' é aceito)
  - **Sem descrição** - DADO Usuário comercial autenticado . QUANDO POST com body {} ou { descricao: '  ' } . ENTAO 400 { error: 'Descrição obrigatória' }
  - **Permissão insuficiente** - DADO Usuário nível atendente . QUANDO POST /api/crm/pedidos . ENTAO 403 'Sem permissão para esta ação comercial.'

### PATCH /api/crm/pedidos/[id]
- **Auth:** Comercial+ (requireCrmComercial)
- **Proposito:** Atualiza um pedido de material avulso: descricao, status, valor_estimado, obra_id (obra_id pode ser desvinculado enviando null).
- **Regras:** id deve ser UUID válido → 400 'ID inválido'. Pré-cheque de posse: busca tenant_id do pedido por id; se não existe OU pertence a outro tenant → 404 'Pedido não encontrado' (legado com tenant_id NULL é tratado como partilhado e passa). Só aplica campos presentes no body; sempre grava atualizado_em. OBS fiel ao código: este PATCH aceita body.status sem allowlist (diferente do POST). Update sem retorno de linha → 404.
- **Casos de teste:**
  - **Atualização feliz** - DADO Pedido existente do tenant do caller . QUANDO PATCH /api/crm/pedidos/<id> com { descricao: 'novo texto', valor_estimado: 1500 } . ENTAO 200 { data } com campos atualizados
  - **ID não-UUID** - DADO Usuário comercial autenticado . QUANDO PATCH /api/crm/pedidos/abc . ENTAO 400 { error: 'ID inválido' }
  - **Cross-tenant bloqueado** - DADO Pedido pertencente a outro tenant (tenant_id preenchido e diferente) . QUANDO PATCH /api/crm/pedidos/<id-do-outro-tenant> . ENTAO 404 'Pedido não encontrado' (não vaza existência)

### GET /api/crm/obras/[id]/sc
- **Auth:** Sessão CRM ativa (requireCrmSessao)
- **Proposito:** Lista as Solicitações de Compra (SC) de uma obra com seus itens (hub_pedidos_material + hub_pedido_itens), mais recentes primeiro (limite 300). Query ?abertas=1 filtra apenas status rascunho/cotando/aprovado/entregue_parcial.
- **Regras:** Posse da obra validada (assertObraDoTenant) → 404 se a obra não é do tenant. Filtros .eq('obra_id') + .eq('tenant_id') puros. Itens carregados em UMA query (.in pedido_id, evita N+1) e agregados por pedido. Tolerância à migração E5 pendente: tabela ausente → 200 { data: [], migracao_pendente: true, aviso }. Erro de banco → 500.
- **Casos de teste:**
  - **Listar SCs com itens** - DADO Obra do tenant com 2 SCs, uma com itens . QUANDO GET /api/crm/obras/<id>/sc . ENTAO 200 { data, migracao_pendente: false } — cada SC traz array itens (vazio quando não há) ordenado por ordem
  - **Filtro abertas** - DADO Obra com SC cancelada e SC em rascunho . QUANDO GET /api/crm/obras/<id>/sc?abertas=1 . ENTAO 200 e apenas a SC em rascunho aparece (cancelado/entregue ficam fora)
  - **Obra de outro tenant** - DADO obraId pertencente a outro tenant . QUANDO GET /api/crm/obras/<idOutroTenant>/sc . ENTAO 404 (posse falha; nenhuma SC vaza)

### POST /api/crm/obras/[id]/sc
- **Auth:** Comercial+ (requireCrmComercial)
- **Proposito:** Cria uma SC estruturada na obra: cabeçalho + itens (catalogo_id, descricao, qtd, preço estimado, cotacoes_json). A IA pode preparar (origem='ia'), mas a SC nasce SEMPRE em 'rascunho' ou 'cotando' — nunca 'aprovado' (gate humano no PATCH de [scid]).
- **Regras:** Posse da obra → 404. Body JSON inválido → 400. Exige ao menos 1 item válido OU descricao livre → 400 'Informe ao menos um item ou uma descrição da SC.'. status: só 'cotando' aceito, resto vira 'rascunho'. tipo_material/urgencia/origem validados por allowlist (defaults: material/normal/manual). valor_estimado = Σ qtd×preço dos itens. Código via RPC gerar_codigo_sc (fallback timestamp). Itens inválidos (sem descrição ou qtd<=0) são descartados silenciosamente; cotacoes_json sanitizado+pontuado. solicitado_por default = userId da sessão. Migração pendente → 503 { migracao_pendente: true }. Sucesso → 201 { data: { ...sc, itens } }.
- **Casos de teste:**
  - **Criar SC com itens** - DADO Obra do tenant; usuário comercial . QUANDO POST com { itens: [{ descricao: 'Areia média', qtd_pedida: 10, preco_unit_estimado: 50 }] } . ENTAO 201 com status='rascunho', valor_estimado=500, itens[0].descricao_snapshot='Areia média', item_fora_catalogo=true (sem catalogo_id)
  - **Status aprovado do body é rebaixado** - DADO Obra do tenant . QUANDO POST com { descricao: 'x', status: 'aprovado' } . ENTAO 201 mas data.status === 'rascunho' (gate de compra não contornável na criação)
  - **Sem item e sem descrição** - DADO Obra do tenant . QUANDO POST com { itens: [] } . ENTAO 400 'Informe ao menos um item ou uma descrição da SC.'

### PATCH /api/crm/obras/[id]/sc/[scid]
- **Auth:** Comercial+ (requireCrmComercial) — o GATE HUMANO de aprovação de compra vive aqui
- **Proposito:** Ações sobre uma SC, roteadas por body.acao: 'aprovar' (gate humano), 'registrar_entrega' (cascata SC→Inventário via RPC idempotente), 'cancelar' (soft-delete), 'escolher_cotacao' (grava cotacoes_json + preco_unit_final do item), ou mover status genérico (apenas rascunho/cotando).
- **Regras:** Posse da obra → 404; SC carregada por id+obra+tenant → 404 se não bate. JSON inválido → 400. APROVAR: UPDATE atômico com WHERE status IN ('rascunho','cotando') — grava aprovado_por (userId) e aprovado_em; 0 linhas afetadas → 409 (já aprovada/cancelada/entregue, ou corrida entre 2 aprovadores). CANCELAR: só de rascunho/cotando/aprovado/entregue_parcial → senão 409; nunca DELETE. REGISTRAR_ENTREGA: exige itens [{item_id, qtd>0}] → 400 se vazio/inválido; chama RPC hub_sc_registrar_entrega com entrega_uid (UUID do cliente para idempotência de retry; gerado se ausente); banco recusa entrega de SC não aprovada → 409 'Esta compra ainda não foi aprovada...'; pedido_nao_encontrado → 404. ESCOLHER_COTACAO: item_id obrigatório → 400; calcula preco_unit_final = valor_total da cotação escolhida / qtd_pedida; item não encontrado → 404. STATUS GENÉRICO: valida isStatusSc → 400; recusa 'aprovado'/'entregue'/'entregue_parcial'/'cancelado' → 400 'Use a ação dedicada'. Nenhuma ação reconhecida → 400. Migração pendente → 503.
- **Casos de teste:**
  - **Aprovar compra (gate humano feliz)** - DADO SC do tenant em status 'cotando' . QUANDO PATCH com { acao: 'aprovar' } . ENTAO 200 { data } com status='aprovado', aprovado_por preenchido com o userId da sessão e aprovado_em setado
  - **Aprovar duas vezes / reabrir cancelada** - DADO SC já em status 'aprovado' (ou 'cancelado') . QUANDO PATCH com { acao: 'aprovar' } . ENTAO 409 'Esta compra não está num estado que permita aprovar (rascunho/cotando).'
  - **Entrega sem aprovação (gate no banco)** - DADO SC em 'rascunho' com item válido . QUANDO PATCH com { acao: 'registrar_entrega', itens: [{ item_id, qtd: 5 }] } . ENTAO 409 'Esta compra ainda não foi aprovada. Aprove antes de registrar a entrega.' (RPC devolve sc_nao_aprovada)
  - **Burlar gate via status genérico** - DADO SC em 'rascunho' . QUANDO PATCH com { status: 'aprovado' } (sem acao) . ENTAO 400 'Use a ação dedicada (aprovar / registrar_entrega / cancelar).'
  - **SC de outro tenant** - DADO scid existente mas de obra/tenant alheio . QUANDO PATCH com { acao: 'aprovar' } . ENTAO 404 (posse da obra ou da SC falha)

### POST /api/crm/obras/[id]/restricoes/[rid]/gerar-sc
- **Auth:** Comercial+ (requireCrmComercial)
- **Proposito:** Elo E3→E5: a partir de uma restrição de obra ('falta material'), gera uma SC pré-preenchida em RASCUNHO (origem='e3_restricao', urgencia='urgente', restricao_id e frente_id herdados da restrição ou do item ligado) e grava pedido_material_id de volta na restrição (elo bidirecional). NÃO aprova nada e NÃO resolve a restrição.
- **Regras:** Posse da obra → 404; restrição carregada por id+obra+tenant → 404. IDEMPOTENTE: se a restrição já tem pedido_material_id apontando para SC não-cancelada do tenant, retorna 200 { data, idempotente: true } sem duplicar. Descrição derivada: titulo da restrição → 'Material para <item>' → descricao da restrição → fallback. Código via RPC gerar_codigo_sc. solicitado_por = userId. Back-link na restrição é best-effort (falha não derruba a resposta). Migração E3/E5 pendente → 503. Sucesso → 201 { data }.
- **Casos de teste:**
  - **Gerar SC do bloqueio** - DADO Restrição de material da obra do tenant, sem SC vinculada . QUANDO POST .../restricoes/<rid>/gerar-sc . ENTAO 201 { data } com status='rascunho', origem='e3_restricao', urgencia='urgente', restricao_id=<rid>; a restrição passa a ter pedido_material_id
  - **Idempotência (duplo clique)** - DADO Restrição já ligada a uma SC ativa (não cancelada) . QUANDO POST novamente na mesma restrição . ENTAO 200 { data: <SC existente>, idempotente: true } — nenhuma SC nova é criada
  - **Restrição inexistente/alheia** - DADO rid inexistente ou de outro tenant . QUANDO POST .../restricoes/<rid>/gerar-sc . ENTAO 404 'Restrição não encontrada'

### GET /api/cotacoes/pedidos
- **Auth:** Comercial+ (requireCrmComercial) — rota já foi pública, fechada no Batch 3; client próprio fail-closed (sem SUPABASE_SERVICE_ROLE_KEY → 503)
- **Proposito:** Lista pedidos de cotação a fornecedores (hub_cotacoes_pedidos) do tenant, mais recentes primeiro (limite 50).
- **Regras:** Filtro .eq('tenant_id') do caller. Sem service key → 503 { erro: 'Serviço indisponível' }. ATENÇÃO ao envelope: esta família responde { pedidos } / { pedido } / { erro } (chave em português), não { data }/{ error }. Erro de banco → 500.
- **Casos de teste:**
  - **Listagem feliz** - DADO Comercial autenticado com pedidos de cotação no tenant . QUANDO GET /api/cotacoes/pedidos . ENTAO 200 { pedidos: [...] } com id, titulo, descricao, status, criado_em, aprovacao_id — só do tenant
  - **Sem permissão** - DADO Usuário nível atendente . QUANDO GET /api/cotacoes/pedidos . ENTAO 403 'Sem permissão para esta ação comercial.'
  - **Sem sessão** - DADO Request anônimo . QUANDO GET /api/cotacoes/pedidos . ENTAO 401 — a rota não é mais pública

### POST /api/cotacoes/pedidos
- **Auth:** Comercial+ (requireCrmComercial)
- **Proposito:** Cria um pedido de cotação a fornecedores, nascendo em status 'rascunho'.
- **Regras:** titulo obrigatório (string trim) → 400 { erro: 'titulo é obrigatório' }; descricao opcional. tenant_id da sessão. JSON inválido → 400 { erro: 'JSON inválido' }. Sem service key → 503. Sucesso → 201 { pedido }.
- **Casos de teste:**
  - **Criação feliz** - DADO Comercial autenticado . QUANDO POST com { titulo: 'Cotação vergalhão CA-50' } . ENTAO 201 { pedido } com status='rascunho' e criado_em preenchido
  - **Sem título** - DADO Comercial autenticado . QUANDO POST com { descricao: 'x' } . ENTAO 400 { erro: 'titulo é obrigatório' }
  - **Permissão** - DADO Usuário atendente . QUANDO POST /api/cotacoes/pedidos . ENTAO 403

### GET /api/cotacoes/pedidos/[id]
- **Auth:** Comercial+ (requireCrmComercial)
- **Proposito:** Detalha um pedido de cotação (SELECT *) + todas as respostas de fornecedores (hub_cotacoes_respostas) ordenadas por criado_em asc.
- **Regras:** Pedido buscado por id + tenant_id da sessão → 404 { erro: 'Pedido não encontrado' } se não bate (cross-tenant vira 404). Respostas filtradas por pedido_id (a posse já foi validada no pai). Erro nas respostas → 500. Resposta: { pedido, respostas }.
- **Casos de teste:**
  - **Detalhe feliz** - DADO Pedido do tenant com 2 respostas . QUANDO GET /api/cotacoes/pedidos/<id> . ENTAO 200 { pedido, respostas: [2 itens em ordem cronológica] }
  - **Cross-tenant** - DADO Pedido existente de outro tenant . QUANDO GET /api/cotacoes/pedidos/<idAlheio> . ENTAO 404 { erro: 'Pedido não encontrado' }
  - **Inexistente** - DADO UUID aleatório . QUANDO GET /api/cotacoes/pedidos/<uuid-random> . ENTAO 404

### POST /api/cotacoes/pedidos/[id]/respostas
- **Auth:** Comercial+ (requireCrmComercial) — flag no código: hoje é um OPERADOR logado digitando em nome do fornecedor (não há identidade de fornecedor externo; padrão HMAC do portal ainda não desenhado para cotações)
- **Proposito:** Registra a proposta de um fornecedor no pedido de cotação e move o pedido para status 'cotando'.
- **Regras:** fornecedor_nome obrigatório (trim) → 400 { erro }. JSON inválido → 400. Pedido validado por id + tenant → 404. Se o pedido está em status em_aprovacao/aprovado/rejeitado/cancelado → 409 { erro: 'Pedido não aceita novas respostas neste status' }. Campos opcionais: valor_total, prazo_dias, observacoes (default null). Após inserir, atualiza o pedido para status='cotando' (best-effort). Sucesso → 201 { resposta }.
- **Casos de teste:**
  - **Registrar proposta** - DADO Pedido do tenant em 'rascunho' . QUANDO POST com { fornecedor_nome: 'Depósito X', valor_total: 12000, prazo_dias: 7 } . ENTAO 201 { resposta }; o pedido passa para status='cotando'
  - **Pedido fechado a respostas** - DADO Pedido em status 'em_aprovacao' . QUANDO POST resposta válida . ENTAO 409 'Pedido não aceita novas respostas neste status'
  - **Sem fornecedor_nome** - DADO Pedido do tenant aberto . QUANDO POST com { valor_total: 100 } . ENTAO 400 { erro: 'fornecedor_nome é obrigatório' }

### POST /api/cotacoes/pedidos/[id]/submeter-aprovacao
- **Auth:** Comercial+ (requireCrmComercial)
- **Proposito:** GATE DE DINHEIRO: submete a escolha de fornecedor à decisão HUMANA — cria um card em hub_aprovacoes (tipo='cotacao_fornecedor', status='pendente', confianca_ia=70) sugerindo a proposta de MENOR valor_total, e move o pedido para 'em_aprovacao' gravando aprovacao_id. Nada financeiro é executado sem aprovação humana.
- **Regras:** Pedido por id + tenant → 404. Se status já é 'em_aprovacao' ou 'aprovado' → 409 { erro: 'Pedido já enviado ou aprovado' } (não duplica card). Exige ≥1 resposta de fornecedor → 400 { erro: 'Inclua ao menos uma resposta de fornecedor antes de submeter' }. Melhor proposta = reduce por menor valor_total (null tratado como Infinity). Card grava tenant_id, valor_envolvido (valor da melhor, ou 0), payload dados = { pedido_id, respostas, sugerido }. Erro ao criar card → 500. Sucesso → 200 { ok: true, aprovacao_id }.
- **Casos de teste:**
  - **Submeter para aprovação** - DADO Pedido em 'cotando' com 3 respostas (valores 900, 1200, null) . QUANDO POST .../submeter-aprovacao . ENTAO 200 { ok: true, aprovacao_id }; card pendente criado sugerindo a de 900; pedido vira 'em_aprovacao' com aprovacao_id preenchido
  - **Sem respostas** - DADO Pedido em 'rascunho' sem respostas . QUANDO POST .../submeter-aprovacao . ENTAO 400 'Inclua ao menos uma resposta de fornecedor antes de submeter'
  - **Re-submissão** - DADO Pedido já em 'em_aprovacao' . QUANDO POST .../submeter-aprovacao . ENTAO 409 'Pedido já enviado ou aprovado' — não cria segundo card

### POST /api/crm/financeiro/contas
- **Auth:** Financeiro, Gestor ou Owner (requireCrmFinanceiro)
- **Proposito:** Cria um lançamento financeiro: conta a PAGAR (hub_contas_pagar) ou a RECEBER (hub_contas_receber), sempre nascendo status='pendente'. Recebíveis podem vincular negocio_id com anti-duplicação (um negócio gera no máximo UMA conta a receber).
- **Regras:** tipo ∈ {pagar, receber} → 400 'tipo deve ser pagar ou receber'. descricao obrigatória → 400. valor: normaliza pt-BR ('1.234,50' → 1234.50); deve ser finito e > 0 → 400 'valor inválido'. vencimento opcional (corta em YYYY-MM-DD). tenant_id SEMPRE da sessão (H-SEC-1, nunca de header). negocio_id só vale para tipo='receber' e se for UUID. Anti-dup: se já existe recebível do negocio_id no escopo do tenant → 200 { ok, id, ja_existia: true } sem criar outro. Fallback tolerante: coluna negocio_id ausente → reinsere sem o vínculo. Erro → 500 com mensagem genérica (detalhe só em log, nunca expõe schema). Sucesso → 201 { ok: true, id, tipo }.
- **Casos de teste:**
  - **Criar conta a pagar** - DADO Usuário financeiro autenticado . QUANDO POST com { tipo: 'pagar', descricao: 'Aluguel betoneira', valor: '1.500,00', vencimento: '2026-08-01' } . ENTAO 201 { ok: true, id, tipo: 'pagar' } — valor persistido 1500 (vírgula pt-BR normalizada), status 'pendente'
  - **Anti-duplicação de recebível por negócio** - DADO Já existe conta a receber vinculada ao negocio_id N . QUANDO POST com { tipo: 'receber', descricao: 'x', valor: 100, negocio_id: N } . ENTAO 200 { ok: true, id: <existente>, ja_existia: true } — nenhum novo registro
  - **Valor inválido** - DADO Usuário financeiro . QUANDO POST com { tipo: 'pagar', descricao: 'x', valor: 0 } (ou 'abc', ou negativo) . ENTAO 400 { error: 'valor inválido' }
  - **Permissão** - DADO Usuário nível comercial (sem financeiro) . QUANDO POST /api/crm/financeiro/contas . ENTAO 403 'Sem permissão para o módulo financeiro.'

### PATCH /api/crm/financeiro/contas/pagar/[id]
- **Auth:** Financeiro, Gestor ou Owner (requireCrmFinanceiro)
- **Proposito:** Muda o status de uma conta a pagar: pendente | pago | cancelado. Ao marcar 'pago', grava trilha de auditoria baixado_por (userId) + baixado_em (D-10).
- **Regras:** status obrigatório e ∈ {pendente, pago, cancelado} → 400 'status inválido'. Update com escopo de tenant via .or(tenantScopeOrFilter) — id + tenant atual/legado/NULL (sem isso o service_role flipava contas de outro tenant). Fallbacks tolerantes: coluna baixado_por ausente → refaz sem auditoria; coluna tenant_id ausente → refaz sem filtro. FIEL AO CÓDIGO: retorna 200 { ok: true } mesmo quando 0 linhas foram afetadas (id inexistente ou de outro tenant NÃO gera 404 — o update simplesmente não muda nada). Erro real de banco → 500 genérico.
- **Casos de teste:**
  - **Dar baixa (pago)** - DADO Conta a pagar pendente do tenant . QUANDO PATCH com { status: 'pago' } . ENTAO 200 { ok: true }; no banco: status='pago', baixado_por=userId da sessão, baixado_em preenchido
  - **Status fora da allowlist** - DADO Conta do tenant . QUANDO PATCH com { status: 'quitado' } . ENTAO 400 { error: 'status inválido' }
  - **Cross-tenant silencioso** - DADO id de conta de OUTRO tenant . QUANDO PATCH com { status: 'pago' } . ENTAO 200 { ok: true } porém a conta do outro tenant permanece INALTERADA (filtro de tenant impede o write; a resposta não distingue 0 linhas — verificar no banco)

### PATCH /api/crm/financeiro/contas/receber/[id]
- **Auth:** Financeiro, Gestor ou Owner (requireCrmFinanceiro)
- **Proposito:** Muda o status de uma conta a receber: pendente | recebido | cancelado. Ao marcar 'recebido', grava baixado_por + baixado_em (auditoria D-10). Espelho exato da rota de pagar.
- **Regras:** status ∈ {pendente, recebido, cancelado} → 400 'status inválido' (nota: 'pago' aqui é inválido; a allowlist difere da irmã). Escopo de tenant via .or(tenantScopeOrFilter) com os mesmos 2 fallbacks tolerantes (baixado_por ausente; tenant_id ausente). Igual à irmã: 200 { ok: true } mesmo com 0 linhas afetadas. Erro de banco → 500 genérico.
- **Casos de teste:**
  - **Marcar recebido** - DADO Recebível pendente do tenant . QUANDO PATCH com { status: 'recebido' } . ENTAO 200 { ok: true }; banco mostra status='recebido' + baixado_por/baixado_em
  - **Vocabulário errado** - DADO Recebível do tenant . QUANDO PATCH com { status: 'pago' } . ENTAO 400 'status inválido' (recebível usa 'recebido', não 'pago')
  - **Tenant alheio não flipa** - DADO id de recebível de outro tenant . QUANDO PATCH com { status: 'cancelado' } . ENTAO 200 { ok: true } mas o registro do outro tenant permanece pendente (verificação no banco)

### GET /api/crm/financeiro/dashboard
- **Auth:** Financeiro, Gestor ou Owner (requireCrmFinanceiro)
- **Proposito:** Painel financeiro agregado do tenant — delega para aggregateFinanceDashboard(db, tenantId) (lib/crm/finance-dashboard-aggregate) e devolve o payload agregado direto (sem envelope { data }).
- **Regras:** tenantId da sessão. Qualquer exceção da agregação → 500 { error: <mensagem> } com log no servidor.
- **Casos de teste:**
  - **Dashboard feliz** - DADO Usuário financeiro com lançamentos no tenant . QUANDO GET /api/crm/financeiro/dashboard . ENTAO 200 com payload JSON agregado do painel (números refletem apenas o tenant da sessão)
  - **Permissão** - DADO Usuário comercial . QUANDO GET /api/crm/financeiro/dashboard . ENTAO 403 'Sem permissão para o módulo financeiro.'
  - **Sem sessão** - DADO Request anônimo . QUANDO GET /api/crm/financeiro/dashboard . ENTAO 401

### GET /api/crm/financeiro-rede
- **Auth:** Sessão CRM ativa (requireCrmSessao — leitura aberta a qualquer nível do tenant)
- **Proposito:** 'Meu Dinheiro' da rede: tudo que o tenant tem a receber/pagar no motor de comissões — títulos (hub_negocio_titulos, exclui cancelados, limite 300), totais agregados (a_receber, a_pagar, exigivel, recebido), mapa id→título dos negócios e extrato de movimentos (hub_negocio_fin_movimentos, limite 60).
- **Regras:** Filtro .eq('tenant_id') puro em todas as queries. Totais: direcao='receber' soma (total−pago) em a_receber; 'pagar' em a_pagar; exigivel = Σ (exigivel−pago) só dos 'pagar'; recebido = Σ pago; arredondados a 2 casas. Negócios buscados em um SELECT .in (sem N+1). Tolerância: tabela do motor ausente → 200 { motor_pendente: true, aviso, totais zerados, listas vazias }. Erro real → 500.
- **Casos de teste:**
  - **Extrato da rede** - DADO Tenant com títulos direcao 'receber' (1000, pago 200) e 'pagar' (300, exigível 300, pago 0) . QUANDO GET /api/crm/financeiro-rede . ENTAO 200 com totais { a_receber: 800, a_pagar: 300, exigivel: 300, recebido: 200 }, titulos sem cancelados, negocios com os títulos dos negócios e movimentos
  - **Motor pendente** - DADO Base sem as tabelas do motor de comissões . QUANDO GET /api/crm/financeiro-rede . ENTAO 200 { motor_pendente: true, aviso, totais zerados, titulos: [], movimentos: [] } — nunca 500
  - **Isolamento de tenant** - DADO Títulos existentes em dois tenants . QUANDO GET com sessão do tenant A . ENTAO 200 e nenhum título/movimento do tenant B aparece

### GET /api/crm/negocios/[id]/financeiro-rede
- **Auth:** Sessão CRM ativa (requireCrmSessao)
- **Proposito:** Financeiro de rede de UM negócio: dados do negócio + pote_previsto (valor_fechado||valor_estimado × percentual_comissao), participantes do split (hub_negocio_vinculos), comissões apuradas, títulos e extrato de movimentos — a fonte da 'faixa de split na cara'.
- **Regras:** Posse do negócio: busca por id; 404 se não existe ou tenant_id preenchido e diferente do da sessão (NULL legado passa). Motor tolerante: tabelas hub_comissoes/hub_negocio_titulos ausentes → motor_pendente: true + aviso (listas vazias), sem quebrar. apurado = existe ≥1 comissão. pote_previsto = Math.round(base × pct) / 100.
- **Casos de teste:**
  - **Split na cara** - DADO Negócio do tenant com valor_fechado=100000, percentual_comissao=5, comissões apuradas . QUANDO GET /api/crm/negocios/<id>/financeiro-rede . ENTAO 200 com negocio.pote_previsto=5000, negocio.apurado=true, participantes/comissoes/titulos/movimentos preenchidos, motor_pendente=false
  - **Negócio de outro tenant** - DADO id de negócio com tenant_id diferente . QUANDO GET .../financeiro-rede . ENTAO 404 'Negócio não encontrado'
  - **Motor pendente** - DADO Negócio válido mas tabelas do motor ausentes . QUANDO GET .../financeiro-rede . ENTAO 200 com motor_pendente=true, aviso de migração e arrays vazios

### POST /api/crm/negocios/[id]/financeiro-rede
- **Auth:** Financeiro, Gestor ou Owner (requireCrmFinanceiro) — ações de DINHEIRO; cada uma delega a um RPC SECURITY DEFINER fail-closed
- **Proposito:** Executa as 3 ações do motor de comissões via body.acao: 'apurar' (congela o split confirmado pelo humano — rpc_apurar_comissoes), 'receber' (registra pagamento do cliente, comissão vira exigível pro-rata — rpc_registrar_recebimento_negocio) e 'liberar' (2 chaves aprovadas → autoriza pagamento de um título — rpc_liberar_pagamento_comissao).
- **Regras:** Posse do negócio → 404. JSON inválido → 400. APURAR: valor_fechado numérico > 0 obrigatório → 400 'Informe o valor fechado do negócio.'; fatias = array (default []); tabela do motor ausente → 503. RECEBER: valor > 0 obrigatório → 400 'Informe o valor recebido.'. LIBERAR: titulo_id string obrigatório → 400 'titulo_id ausente.'. tenant_id e criado_por (userId) sempre da sessão, passados aos RPCs — nunca do body. Erro do RPC → 500 { error: mensagem do RPC }. Ação desconhecida → 400 'ação inválida (apurar | receber | liberar).'. Sucesso → 200 com o retorno do RPC.
- **Casos de teste:**
  - **Apurar split** - DADO Negócio do tenant, usuário financeiro . QUANDO POST com { acao: 'apurar', valor_fechado: 50000, fatias: [...] } . ENTAO 200 com o payload do rpc_apurar_comissoes (comissões congeladas para o negócio)
  - **Apurar sem valor** - DADO Negócio do tenant . QUANDO POST com { acao: 'apurar' } (sem valor_fechado ou com 0) . ENTAO 400 'Informe o valor fechado do negócio.'
  - **Liberar sem título** - DADO Negócio do tenant . QUANDO POST com { acao: 'liberar' } . ENTAO 400 'titulo_id ausente.'
  - **Permissão insuficiente para mexer em dinheiro** - DADO Usuário nível comercial (GET funciona para ele, POST não) . QUANDO POST com { acao: 'receber', valor: 100 } . ENTAO 403 'Sem permissão para o módulo financeiro.'


---

## AGENTES / IA / HUB — app/api/hub/agentes/**, app/api/hub/** (cargos, ciclos, aprovacoes, alertas, canais, autonomia-matriz, ferramentas-custom, followup-config, playbook), app/api/crm/ia/**

### GET+POST /api/hub/agentes
- **Auth:** GET: requireCrmSessao (qualquer papel CRM ativo); POST: requireCrmGestor (gestor/owner). Tenant SEMPRE da sessão (cookie httpOnly), nunca do header x-tenant-id.
- **Proposito:** GET lista agentes IA do tenant (hub_agente_identidade), sanitizados (sanitizarAgenteHubParaCliente remove segredos como uazapi_instance_token). POST cria agente novo: por cargo do catálogo OU playbook-only; gera slug único, provisiona ciclo padrão em hub_ciclos_ia, dispara pipeline de playbook e sync Mistral em after().
- **Regras:** GET: por padrão devolve só ativo=true e arquivado_em IS NULL; ?ativo=false lista inativos; ?arquivados=somente lista só arquivados; ?todos=true lista tudo; fallback de query se colunas arquivado_em/tenant_id não existirem. POST: nome obrigatório (400); playbook_only=true (ou modo_instrucao=playbook_only) é MUTUAMENTE EXCLUSIVO com cargo_slug (400 nos dois sentidos); cargo_slug deve existir ATIVO em hub_cargos_catalogo (400 se não); avatar_url ≤ 600.000 chars (400); dias_semana [0-6]→['dom'..'sab'], default seg-sex; slug derivado do nome com sufixo _2,_3… em colisão; modelo_preferencia 'turbo'|'turbo_alto_valor' força claude-sonnet-4-6; ciclo_execucao interacao|tempo_real|agenda provisiona linha em hub_ciclos_ia (agenda: intervalo 1..10080 min, default 60, criada em pausa com dispatch_pendente); ciclos_vincular_ids só re-aponta ciclos órfãos ou do MESMO tenant (rejeitados contados em ciclo_erro); conhecimento_secoes grava seções válidas em hub_agente_conhecimento; erro de insert responde 500 genérico {error:'erro_criacao_agente'} sem vazar schema; sucesso = 201 com agente sanitizado + ciclo_aviso/ciclo_erro.
- **Casos de teste:**
  - **Criar agente por cargo do catálogo (caminho feliz)** - DADO Sessão de gestor válida e cargo ativo 'sdr' em hub_cargos_catalogo . QUANDO POST /api/hub/agentes com {cargo_slug:'sdr', nome:'Mari Teste'} . ENTAO 201 com agente_slug derivado de 'mari_teste', cargo=título do catálogo, ativo=true, tenant_id do tenant da sessão; campo uazapi_instance_token NÃO aparece na resposta
  - **playbook_only com cargo_slug é rejeitado** - DADO Sessão de gestor válida . QUANDO POST com {nome:'X', playbook_only:true, cargo_slug:'sdr'} . ENTAO 400 {error:'Modo playbook-only: não envie cargo_slug.'}
  - **Atendente não cria agente** - DADO Sessão CRM de papel atendente/comercial . QUANDO POST /api/hub/agentes com body válido . ENTAO 403 (requireCrmGestor nega); GET com a mesma sessão responde 200 (listar exige só sessão)

### GET+PATCH+DELETE /api/hub/agentes/{slug}
- **Auth:** GET: requireCrmSessao; PATCH/DELETE: requireCrmGestor. Isolamento por tenant: agente com tenant_id != tenant da sessão → 404 (tenant NULL passa, legado). 503 se SUPABASE_SERVICE_ROLE_KEY ausente.
- **Proposito:** GET devolve a ficha completa do agente (sanitizada; preenche bio/system_prompt_base a partir do cargo do catálogo quando vazios). PATCH atualiza campos allowlisted. DELETE faz SOFT-ARCHIVE (arquivado_em+ativo=false) — o Hub nunca apaga.
- **Regras:** PATCH: allowlist = nome, prefixo_mercado, personalidade, horario_inicio/fim, dias_semana, bio, tom_voz, estilo_comunicacao, system_prompt_base, avatar_url, ativo, modo_operacao, ciclo_execucao_padrao (+booleans motor_ferramentas_habilitado/mistral_agent_sync_habilitado, uso_ferramentas_ia serializado, setor_ia ≤40 chars/null limpa); patch vazio → 400 'Nenhum campo válido para atualizar.'; agente arquivado NÃO pode ser reativado via ativo=true → 409; after() reroda pipeline de playbook e sync Mistral se campos de sync mudaram e sync habilitado. DELETE: valida tenant ANTES; grava arquivado_motivo='Arquivado via exclusão (rota DELETE).'; responde {ok:true, agente_slug}; 503 se coluna arquivado_em ausente.
- **Casos de teste:**
  - **PATCH atualiza nome e devolve agente sanitizado** - DADO Agente 'mari' pertence ao tenant da sessão de gestor . QUANDO PATCH /api/hub/agentes/mari com {nome:'Mari 2'} . ENTAO 200 com nome='Mari 2'; resposta não contém uazapi_instance_token
  - **Reativar agente arquivado é bloqueado** - DADO Agente com arquivado_em preenchido . QUANDO PATCH com {ativo:true} . ENTAO 409 'Agente arquivado não pode ser reativado...'
  - **DELETE de agente de outro tenant devolve 404** - DADO Agente existente com tenant_id de OUTRO tenant . QUANDO DELETE /api/hub/agentes/{slug} com sessão de gestor do tenant A . ENTAO 404 'Agente não encontrado' e a linha NÃO é arquivada (isolamento antes do write)

### POST /api/hub/agentes/{slug}/arquivar
- **Auth:** requireCrmGestor + isolamento de tenant (outro tenant → 404).
- **Proposito:** Arquiva o agente (soft-archive: arquivado_em=now, arquivado_motivo, ativo=false).
- **Regras:** Body JSON obrigatório com motivo ≥ 10 caracteres (400 caso contrário; chave de erro é 'erro', não 'error'); 503 se coluna arquivado_em ausente no banco; sucesso = {ok:true, agente_slug}.
- **Casos de teste:**
  - **Arquivar com motivo válido** - DADO Agente do tenant e sessão de gestor . QUANDO POST com {motivo:'Campanha encerrada em julho'} . ENTAO 200 {ok:true, agente_slug}; GET /api/hub/agentes deixa de listar o agente por padrão
  - **Motivo curto é rejeitado** - DADO Sessão de gestor . QUANDO POST com {motivo:'ok'} . ENTAO 400 {erro:'Informe o motivo do arquivamento (mínimo 10 caracteres).'}
  - **Papel comum não arquiva** - DADO Sessão de atendente . QUANDO POST com motivo válido . ENTAO 403 (requireCrmGestor)

### GET+POST /api/hub/agentes/{slug}/briefing-chat
- **Auth:** requireCrmSessao (GET e POST) + isolamento de tenant (404). POST: rate limit requireIaRateLimit('briefing-chat:{tenant}', 30) e 503 se nem MISTRAL_API_KEY nem ANTHROPIC_API_KEY configuradas.
- **Proposito:** Chat de briefing/simulação com o agente. GET lista sessões (até 40) e mensagens de uma sessão (?sessao_id=, até 500), com cache in-memory 15s. POST envia mensagem do usuário, chama LLM (modos: briefing_interno | simulacao_canal | simulacao_whatsapp com motor de fluxo do playbook), persiste mensagens e extrai memórias do agente.
- **Regras:** POST: mensagem obrigatória, ≤ 12.000 chars (400); sessao_id ausente cria sessão nova; sessao_id inexistente/de outro agente → 400 'Sessão inválida'; modo diferente do modo da sessão → 409; falha do provedor IA → 502; histórico limitado a 48 mensagens; metadata da resposta inclui modelo/tokens/custo_brl/fontes_conhecimento; simulacao_whatsapp persiste partes do fluxo com flow_state e deduplica displays. GET: sessao_id inexistente → 404 'Sessão não encontrada'.
- **Casos de teste:**
  - **Mensagem cria sessão e devolve resposta da IA** - DADO Agente do tenant, provedor IA configurado . QUANDO POST com {mensagem:'Como você atende um lead?'} sem sessao_id . ENTAO 200 com sessao_id novo, mensagens[] contendo user+assistant e ultima_resposta_meta com modelo/tokens
  - **Mensagem vazia/longa é rejeitada** - DADO Sessão CRM válida . QUANDO POST com {mensagem:''} (ou > 12000 chars) . ENTAO 400 'Mensagem inválida ou muito longa.'
  - **Modo trocado no meio da sessão** - DADO Sessão criada com modo briefing_interno . QUANDO POST na mesma sessao_id com modo:'simulacao_whatsapp' . ENTAO 409 'Esta conversa foi iniciada noutro modo...'

### GET+PUT /api/hub/agentes/{slug}/conhecimento
- **Auth:** GET: requireCrmSessao; PUT: requireCrmGestor. Isolamento de tenant (GET degrada para {secoes:[]}, PUT → 404).
- **Proposito:** Lê e edita as seções de conhecimento do agente (hub_agente_conhecimento) que alimentam o system prompt.
- **Regras:** GET tolerante: tabela ausente ou erro de leitura devolve {secoes:[]} (nunca quebra o editor). PUT: secao deve ser um id válido de seção (isConhecimentoSecaoId) → 400 'Secção de conhecimento inválida.'; titulo default = rótulo canônico; upsert manual (select→update/insert, tabela sem unique em agente_slug+secao); 503 se tabela não existir; sucesso = {ok:true, secao, titulo}.
- **Casos de teste:**
  - **Gravar seção válida** - DADO Agente do tenant, sessão de gestor . QUANDO PUT com {secao:'<id válido>', conteudo:'Texto de conhecimento'} . ENTAO 200 {ok:true, secao, titulo}; GET seguinte devolve a seção com o conteúdo
  - **Seção inválida rejeitada** - DADO Sessão de gestor . QUANDO PUT com {secao:'secao_inexistente', conteudo:'x'} . ENTAO 400 'Secção de conhecimento inválida.'
  - **GET de agente de outro tenant não vaza conteúdo** - DADO Agente pertence a outro tenant . QUANDO GET /conhecimento com sessão do tenant A . ENTAO 200 {secoes:[]} (lista vazia, sem vazar existência/conteúdo)

### GET /api/hub/agentes/{slug}/logs
- **Auth:** requireCrmSessao + isolamento de tenant (404 se agente de outro tenant).
- **Proposito:** Lista logs de prompts de IA do agente (hub_prompt_logs), mais recentes primeiro.
- **Regras:** ?limit= entre 1 e 200 (default 60, valores inválidos caem no default); resposta {logs:[...]}.
- **Casos de teste:**
  - **Listar logs com limite** - DADO Agente do tenant com logs em hub_prompt_logs . QUANDO GET ?limit=5 . ENTAO 200 {logs:[...]} com no máximo 5 itens ordenados por criado_em desc
  - **limit acima do teto é clampado** - DADO Sessão válida . QUANDO GET ?limit=9999 . ENTAO 200 com no máximo 200 logs
  - **Sem sessão CRM** - DADO Request sem cookie de sessão . QUANDO GET /logs . ENTAO 401 (guard de sessão)

### GET+DELETE /api/hub/agentes/{slug}/memorias
- **Auth:** GET: requireCrmSessao; DELETE: requireCrmGestor. Isolamento de tenant → 404.
- **Proposito:** GET devolve contagem de memórias do agente. DELETE limpa memórias (e opcionalmente sessões de briefing) via limparMemoriasAgente.
- **Regras:** Slug vazio após trim → 400 'Slug inválido.'; DELETE aceita body opcional {incluir_briefing:false} (default true = também apaga briefing); sucesso = {ok:true, agente_slug, ...contadores}; exceção → 500.
- **Casos de teste:**
  - **Contagem de memórias** - DADO Agente do tenant com memórias . QUANDO GET /memorias . ENTAO 200 com contagem (payload de contarMemoriasAgente)
  - **Limpar memórias preservando briefing** - DADO Sessão de gestor . QUANDO DELETE com {incluir_briefing:false} . ENTAO 200 {ok:true, agente_slug}; GET seguinte mostra contagem de memórias zerada
  - **DELETE por papel comum** - DADO Sessão de atendente . QUANDO DELETE /memorias . ENTAO 403 (requireCrmGestor)

### POST /api/hub/agentes/{slug}/mistral-sync
- **Auth:** requireCrmGestor + isolamento de tenant → 404.
- **Proposito:** Reenvia (provisiona/atualiza) o agente Hub na Mistral Agents API.
- **Regras:** Exige mistral_agent_sync_habilitado=true na linha do agente → senão 409 'Ative «Provisionar agente na Mistral»...'; falha na chamada externa → 502; sucesso = {ok:true, mistral_agent_id, created}.
- **Casos de teste:**
  - **Sync com flag habilitada** - DADO Agente do tenant com mistral_agent_sync_habilitado=true e MISTRAL_API_KEY válida . QUANDO POST /mistral-sync . ENTAO 200 {ok:true, mistral_agent_id, created:boolean}
  - **Sync sem flag habilitada** - DADO Agente com mistral_agent_sync_habilitado=false . QUANDO POST /mistral-sync . ENTAO 409 pedindo para ativar o provisionamento antes
  - **Agente de outro tenant** - DADO Slug de agente de outro tenant . QUANDO POST com sessão de gestor do tenant A . ENTAO 404 'Agente não encontrado' (sem chamada externa)

### GET /api/hub/agentes/{slug}/operacao
- **Auth:** requireCrmSessao + isolamento de tenant → 404 (rota expõe custo_brl e prompts).
- **Proposito:** Painel de operação do agente: ciclos (hub_ciclos_ia), últimas 150 execuções (hub_ciclos_log), últimas 12 ações IA (hub_acoes_ia) e timestamp do último prompt (hub_prompt_logs).
- **Regras:** 4 queries em Promise.all; qualquer erro → 500 com mensagens concatenadas; resposta {ciclos, execucoes_ciclo, acoes, ultimo_prompt_em}.
- **Casos de teste:**
  - **Painel completo** - DADO Agente do tenant com ciclos e logs . QUANDO GET /operacao . ENTAO 200 com as 4 chaves; execucoes_ciclo ≤ 150 itens; acoes ≤ 12
  - **Agente inexistente** - DADO Slug que não existe . QUANDO GET /operacao . ENTAO 404 'Agente nao encontrado'
  - **Cross-tenant bloqueado** - DADO Agente de outro tenant . QUANDO GET /operacao com sessão do tenant A . ENTAO 404 (não vaza custo/prompts de outro escritório)

### GET /api/hub/agentes/{slug}/estado-runtime
- **Auth:** requireCrmSessao + isolamento de tenant → 404.
- **Proposito:** Só-leitura: compõe o estado REAL de runtime do agente ('luzes' verde/âmbar/cinza/vermelho): ativo/arquivado, playbook publicado, roteamento WhatsApp (agenteUsaPlaybookMaria), ferramentas ligadas, modo de instrução.
- **Regras:** Sem escrita, sem chamada externa; para agente modo_operacao=canal_whatsapp inclui luzes 'playbook' e 'roteamento' (alerta quando fluxo publicado mas NÃO roteado); para interno inclui luzes 'ferramentas' e 'instrucao'; resumo = primeira luz off/alerta ou 'Pronto para atender/trabalhar'.
- **Casos de teste:**
  - **Agente WhatsApp com fluxo publicado mas fora do roteamento** - DADO Agente canal_whatsapp com playbook publicado e slug fora do env de roteamento . QUANDO GET /estado-runtime . ENTAO 200 com luz 'roteamento' estado='alerta' e resumo apontando o problema
  - **Agente interno pronto** - DADO Agente interno ativo, motor_ferramentas_habilitado=true com ferramentas . QUANDO GET /estado-runtime . ENTAO 200 com resumo {estado:'ok', mensagem:'Pronto para trabalhar.'}
  - **Sem sessão** - DADO Request anônimo . QUANDO GET /estado-runtime . ENTAO 401

### POST /api/hub/agentes/{slug}/sugestoes-melhoria
- **Auth:** requireCrmSessao + rate limit 6/tenant + gate de saldo assertSaldoAntesDoLLM (402 'sem_creditos' se IA_HARD_CAP=on e sem saldo). Isolamento FAIL-CLOSED: tenant NULL do agente = 404.
- **Proposito:** IA analisa o agente e devolve sugestões priorizadas de melhoria. Só leitura do agente; registra consumo (metering) sempre que houve chamada paga.
- **Regras:** Erros com códigos estáveis: 503 servico_indisponivel, 429 rate limit, 402 sem_creditos, 404 agente não encontrado, 200 {error:'sem_sugestoes'}, 502 ia_indisponivel, 500 erro_interno; sucesso = {ok:true, sugestoes:[...]}; metering registrado com origem='sugestoes_melhoria_agente'.
- **Casos de teste:**
  - **Sugestões geradas** - DADO Agente do tenant, saldo ok, IA disponível . QUANDO POST /sugestoes-melhoria . ENTAO 200 {ok:true, sugestoes} e linha de consumo registrada em hub_ia_consumo
  - **Rate limit por tenant** - DADO 7ª chamada dentro da janela de rate limit . QUANDO POST repetido . ENTAO 429 (requireIaRateLimit com teto 6)
  - **Agente com tenant NULL (fail-closed)** - DADO Agente legado sem tenant_id . QUANDO POST /sugestoes-melhoria . ENTAO 404 'Agente não encontrado' (diferente das rotas tolerantes)

### GET+POST+PATCH+DELETE /api/hub/agentes/{slug}/rag-documentos
- **Auth:** requireCrmGestor em TODOS os métodos. Isolamento: tenant do agente deve ser o do caller OU NULL OU o tenant default Obra10 (legado partilhado) → senão 404.
- **Proposito:** Gerencia documentos RAG do agente: GET lista (hub_agente_rag_documentos); POST upload multipart (bucket RAG) + extração de texto + indexação em chunks; PATCH ?id= reindexação a partir do Storage; DELETE ?id= remove do Storage e da tabela (hard-delete).
- **Regras:** POST: máx. 3 documentos por agente → 409; arquivo obrigatório no campo 'file' (400); > 5 MB → 413; extração falha → 422 (doc marcado status='erro'); indexação falha → 502; sucesso devolve documento status='pronto' com chunks_count. PATCH/DELETE: ?id= obrigatório (400); doc inexistente para o slug → 404. Migração RAG ausente: GET devolve {documentos:[], aviso}, POST/PATCH/DELETE → 503.
- **Casos de teste:**
  - **Upload e indexação de PDF** - DADO Agente do tenant com < 3 documentos . QUANDO POST multipart com file=manual.pdf (< 5 MB) . ENTAO 200 com documento {status:'pronto', chunks_count > 0}
  - **Limite de 3 documentos** - DADO Agente já com 3 documentos RAG . QUANDO POST com 4º arquivo . ENTAO 409 'Limite de 3 documentos por agente atingido...'
  - **Arquivo grande demais** - DADO Sessão de gestor . QUANDO POST com arquivo de 6 MB . ENTAO 413 'Arquivo maior que 5 MB.'

### POST /api/hub/agentes/{slug}/uazapi
- **Auth:** requireCrmGestor + isolamento de tenant → 404 (opera instância WhatsApp — privilegiado).
- **Proposito:** Multiplexador de ações da instância WhatsApp (UAZAPI) do agente via body.action: create | connect | status | disconnect | delete_remote | save_proxy | list_proxy_cities | sync_webhook. Persiste snapshot (id/token/status/proxy) em hub_agente_identidade.
- **Regras:** action ausente/inválida → 400. create: exige modo_operacao='canal_whatsapp' (409) e agente SEM instância prévia (409); UAZAPI sem id/token na resposta → 502. save_proxy: exige proxy_managed_city (400). Ações connect/status/disconnect/delete_remote exigem token de instância já criado → 409 'Crie primeiro a instância...'. connect: exige proxy configurado (400); reset_session=true desconecta antes; devolve qrcode/paircode quando presentes, qr_valid_seconds=120 e hints quando QR falta. Falha auth na UAZAPI (401/403/invalid token) → 502 com uazapi_auth_failed:true e status local forçado a 'disconnected'. delete_remote limpa todas as colunas uazapi_*.
- **Casos de teste:**
  - **create em agente WhatsApp sem instância** - DADO Agente modo_operacao='canal_whatsapp' sem uazapi_instance_id . QUANDO POST {action:'create'} . ENTAO 200 {ok:true, uazapi_instance_id, uazapi_connection_status, webhook_sync} e colunas uazapi_* persistidas
  - **create duplicado** - DADO Agente que já tem uazapi_instance_id . QUANDO POST {action:'create'} . ENTAO 409 'Este agente já tem instância WhatsApp...'
  - **connect sem proxy salvo** - DADO Instância criada mas sem cidade de proxy . QUANDO POST {action:'connect'} . ENTAO 400 'Guarde a cidade do proxy (região) antes de gerar o QR.' com proxy_warning

### GET+POST /api/hub/agentes/{slug}/playbook
- **Auth:** GET: requireCrmSessao; POST: requireCrmGestor. Isolamento de tenant → 404.
- **Proposito:** GET devolve metadados do último playbook publicado (object_path, public_url, generated_at, source_hash). POST gera/publica o playbook Markdown a partir do estado atual do agente (pipeline → bucket hub-agent-playbooks + refs na identidade).
- **Regras:** POST: body opcional {force:true} força regeneração; sem force, se playbook_source_hash == hash do snapshot atual devolve {sucesso:true, skipped:true} sem regenerar; snapshot inexistente → 404; pipeline falha → 500; sucesso = {sucesso:true, skipped:false, playbook_public_url, playbook_object_path, playbook_source_hash, mistral_appendix}.
- **Casos de teste:**
  - **Publicar playbook novo** - DADO Agente do tenant com estado alterado desde o último publish . QUANDO POST /playbook . ENTAO 200 {sucesso:true, skipped:false} com URL pública e hash novo
  - **Skip por hash idêntico** - DADO Agente sem mudanças desde o último playbook . QUANDO POST sem force . ENTAO 200 {sucesso:true, skipped:true, motivo:'Hash do snapshot igual...'}
  - **POST exige gestor** - DADO Sessão de atendente . QUANDO POST /playbook . ENTAO 403; GET com a mesma sessão → 200 (metadados)

### POST /api/hub/agentes/{slug}/playbook/analisar
- **Auth:** requireCrmSessao + rate limit 20/tenant ('playbook-analisar') + isolamento de tenant → 404.
- **Proposito:** Analisa o playbook do agente com a Mistral (qualidade/completude). Aceita conteúdo inline no body ({content}) ou carrega do storage.
- **Regras:** Body opcional; content string não vazia tem prioridade (origem_playbook='conteudo_body'); sem playbook carregável → status do loader (404/409...); falha da Mistral NÃO é erro: devolve 200 com analise de fallback local (model:'local-fallback', analise_origem:'fallback', aviso).
- **Casos de teste:**
  - **Análise via Mistral** - DADO Agente com playbook publicado e Mistral disponível . QUANDO POST sem body . ENTAO 200 {sucesso:true, analise_origem:'mistral', analise, model}
  - **Fallback local quando IA cai** - DADO MISTRAL indisponível . QUANDO POST com {content:'# Playbook...'} . ENTAO 200 {sucesso:true, model:'local-fallback', analise_origem:'fallback', aviso}
  - **Agente de outro tenant** - DADO Slug de outro tenant . QUANDO POST /playbook/analisar . ENTAO 404 'Agente não encontrado.'

### POST /api/hub/agentes/{slug}/playbook/calibracao-chat
- **Auth:** requireCrmSessao + rate limit 30/tenant ('calibracao-chat') + isolamento de tenant → 404.
- **Proposito:** Chat de calibração do playbook: a IA responde sobre/ajusta o playbook (usa markdown_rascunho do body ou o playbook publicado).
- **Regras:** mensagem obrigatória (400) e ≤ 12.000 chars (400 'Mensagem demasiado longa.'); historico normalizado a até 32 mensagens user/assistant (itens inválidos descartados silenciosamente); sem playbook carregável → status do loader; falha da IA → 502; sucesso = {sucesso:true, resposta, modelo, tokens_input, tokens_output, custo_brl}.
- **Casos de teste:**
  - **Calibração com rascunho inline** - DADO Agente do tenant, IA disponível . QUANDO POST {mensagem:'Deixe a saudação mais curta', markdown_rascunho:'# Playbook...'} . ENTAO 200 {sucesso:true, resposta, tokens_input/output}
  - **Sem mensagem** - DADO Sessão válida . QUANDO POST {historico:[]} . ENTAO 400 'mensagem é obrigatória.'
  - **Rate limit** - DADO 31ª chamada na janela do tenant . QUANDO POST repetido . ENTAO 429

### GET+PUT /api/hub/agentes/{slug}/playbook/conteudo
- **Auth:** GET: requireCrmSessao; PUT: requireCrmGestor. Isolamento de tenant → 404.
- **Proposito:** GET devolve o Markdown publicado + metadados + avaliação do fluxo WhatsApp (Cache-Control private 30s). PUT publica Markdown editado (bucket + refs em hub_agente_identidade).
- **Regras:** GET sem playbook: devolve tem_playbook:false com metadados (409 do loader vira 200). PUT: aceita body.markdown ou body.content; ensureMarkdownWithWhatsappFlow exige bloco de fluxo `obra10_playbook_flow` válido → 400 com errors[] se inválido (pode auto-anexar fluxo, flag auto_appended_flow); sucesso = {sucesso:true, ...refs, fluxo_whatsapp}.
- **Casos de teste:**
  - **Publicar markdown válido** - DADO Agente do tenant, sessão de gestor . QUANDO PUT com {markdown:'# Playbook\n...bloco obra10_playbook_flow válido...'} . ENTAO 200 {sucesso:true} com playbook_public_url e fluxo_whatsapp avaliado
  - **Fluxo WhatsApp inválido** - DADO Markdown com bloco de fluxo malformado . QUANDO PUT /playbook/conteudo . ENTAO 400 'Publicação exige bloco de fluxo WhatsApp válido...' com errors[]
  - **GET sem playbook publicado** - DADO Agente novo sem playbook . QUANDO GET /playbook/conteudo . ENTAO 200 com tem_playbook:false e metadados (não 404)

### POST /api/hub/agentes/{slug}/playbook/gerar-por-ia
- **Auth:** requireCrmGestor + rate limit 15/tenant ('playbook-gerar-ia') + isolamento de tenant → 404. Tenant SEMPRE da sessão (nunca do body).
- **Proposito:** Gera (NÃO publica) um playbook — fluxo conversacional + regras — a partir de descrição em texto, documento base64 (PDF/DOCX/TXT) e/ou áudio base64 (transcrito via Mistral). Debita Tijolos por fase (origem 'playbook_builder_ia') e registra evento de instrumentação 'playbook_builder_gerado'.
- **Regras:** Documento: máx. 8 MB (400), extração falha → 400; áudio: máx. 25 MB (400), transcrição falha → 502 com mensagem amigável; conteúdo final < 12 chars → 400; falha da geração → 502; sucesso = {markdown, flowDefinition, regras, avisos}. Metering best-effort por fase (nunca bloqueia).
- **Casos de teste:**
  - **Gerar por texto** - DADO Agente do tenant, IA disponível . QUANDO POST {descricao:'Atender leads de reforma, qualificar orçamento e prazo'} . ENTAO 200 com markdown + flowDefinition + regras; consumo registrado em hub_ia_consumo
  - **Descrição curta demais** - DADO Sessão de gestor . QUANDO POST {descricao:'oi'} . ENTAO 400 pedindo mais detalhe (mín. 12 caracteres)
  - **Áudio grande demais** - DADO Áudio base64 > 25 MB . QUANDO POST {audio:{base64:...}} . ENTAO 400 'Áudio muito grande (máx. 25 MB).'

### POST /api/hub/agentes/{slug}/playbook/importar-documento
- **Auth:** requireCrmGestor + rate limit 10/tenant + isolamento FAIL-CLOSED (tenant NULL do agente → 404).
- **Proposito:** Extrai o TEXTO de um PDF/DOCX enviado (multipart, campo file) e devolve para revisão no editor — SEM armazenar nem publicar.
- **Regras:** Pré-check por Content-Length > 8 MB + 64 KB → 413 (antes de bufferizar); allowlist server-side só .pdf/.docx (extensão ou MIME) → 400 'formato_invalido'; file.size > 8 MB → 400; sem file → 400 'arquivo_obrigatorio'; extração falha (ex.: PDF digitalizado) → 422; sucesso = {ok:true, texto, nome}.
- **Casos de teste:**
  - **Extrair texto de DOCX** - DADO Agente do tenant, sessão de gestor . QUANDO POST multipart com file=instrucoes.docx . ENTAO 200 {ok:true, texto:'...', nome:'instrucoes.docx'}; nada persistido
  - **Formato fora da allowlist** - DADO Sessão de gestor . QUANDO POST com file=planilha.xlsx . ENTAO 400 'formato_invalido' (parsers extras não expostos)
  - **Content-Length acima do teto** - DADO Request com Content-Length de 20 MB . QUANDO POST /importar-documento . ENTAO 413 'Arquivo acima de 8 MB.' antes de ler o corpo

### POST /api/hub/agentes/{slug}/playbook/upload
- **Auth:** requireCrmGestor + rate limit 10/tenant ('playbook-upload') + isolamento FAIL-CLOSED (tenant NULL → 404).
- **Proposito:** Upload de playbook customizado (arquivo Markdown) para o agente: valida o bloco de fluxo, grava no bucket e atualiza refs.
- **Regras:** Pré-check Content-Length > 1 MB + 64 KB → 413; Content-Type deve ser multipart/form-data → 415; file obrigatório (400); file.size > 1 MB → 413; se o Markdown CONTÉM bloco de fluxo, ele é parseado e validado → 400 'Fluxo playbook inválido.' com errors[]; ausência de bloco de fluxo é aceita (not_found passa); sucesso = {sucesso:true, tipo, nome_arquivo, bytes, playbook_object_path/public_url/generated_at/source_hash}.
- **Casos de teste:**
  - **Upload de playbook .md válido** - DADO Agente do tenant, arquivo < 1 MB . QUANDO POST multipart com file=playbook.md . ENTAO 200 {sucesso:true} com refs do bucket atualizadas
  - **Content-Type errado** - DADO Sessão de gestor . QUANDO POST com Content-Type application/json . ENTAO 415 'Content-Type inválido. Use multipart/form-data com campo file.'
  - **Fluxo inválido no markdown** - DADO Arquivo com bloco obra10_playbook_flow malformado . QUANDO POST /playbook/upload . ENTAO 400 'Fluxo playbook inválido.' com errors[]

### POST+DELETE /api/hub/agentes/{slug}/playbook-media
- **Auth:** requireCrmGestor + isolamento de tenant → 404.
- **Proposito:** POST faz upload de mídia do playbook (PDF/áudio/imagem, até 25 MB) para o bucket 'playbook-media' e devolve URL pública. DELETE ?path= remove o objeto do bucket.
- **Regras:** POST: file obrigatório (400); > 25 MB → 413; MIME fora da allowlist (pdf, ogg/mpeg/mp4/mp3/x-m4a, png/jpeg, octet-stream) → 415; objectPath = slug/uuid-nomeSanitizado; kind informado ou inferido do MIME; bucket ausente → 503 apontando a migration. DELETE: path obrigatório (400) e DEVE começar com '{slug}/' → 400 'Path fora do escopo do agente.'.
- **Casos de teste:**
  - **Upload de imagem PNG** - DADO Agente do tenant, sessão de gestor . QUANDO POST multipart com file=logo.png e kind=image . ENTAO 200 {ok:true, media:{type:'image', url, file_name}}
  - **MIME não suportado** - DADO Sessão de gestor . QUANDO POST com file=video.mp4 (video/mp4) . ENTAO 415 'Tipo de arquivo não suportado...'
  - **DELETE de path de outro agente** - DADO Path 'outro-agente/arquivo.png' . QUANDO DELETE /playbook-media?path=outro-agente/arquivo.png no slug 'mari' . ENTAO 400 'Path fora do escopo do agente.' (path traversal bloqueado)

### POST /api/hub/agentes/blueprint-por-ia
- **Auth:** requireCrmGestor + rate limit 5/tenant + gate de saldo (402 'sem_creditos').
- **Proposito:** O dono descreve o agente em texto e a IA devolve um BLUEPRINT validado contra os catálogos reais (cargo/ferramenta alucinados são descartados). SÓ gera — não cria o agente. Metering em after() com origem 'blueprint_agente_ia'.
- **Regras:** descricao obrigatória com ≥ 8 chars → 400 'descricao_curta'; descrição truncada a 4000 chars; contexto = cargos ativos do catálogo (até 200); falha da IA → 502 'ia_indisponivel'; sucesso = {ok:true, blueprint, avisos, cargo_desc (título humano, esconde o código)}.
- **Casos de teste:**
  - **Blueprint gerado com cargo do catálogo** - DADO Sessão de gestor, saldo ok . QUANDO POST {descricao:'Quero um SDR que qualifica leads de arquitetura no WhatsApp'} . ENTAO 200 {ok:true, blueprint com cargo_slug do catálogo, cargo_desc} e débito registrado
  - **Descrição curta** - DADO Sessão de gestor . QUANDO POST {descricao:'sdr'} . ENTAO 400 'descricao_curta'
  - **Sem saldo com hard-cap ligado** - DADO Tenant sem Tijolos e IA_HARD_CAP=on . QUANDO POST /blueprint-por-ia . ENTAO 402 'sem_creditos'

### POST /api/hub/agentes/mistral-sync-all
- **Auth:** Bearer token = CRON_SECRET OU INTERNAL_API_KEY (401 sem token válido; bypass em NODE_ENV=development). NÃO usa sessão CRM.
- **Proposito:** Job administrativo: normaliza modelos legados Anthropic (haiku/sonnet/opus/claude-*) para o sentinel Mistral em todos os agentes e sincroniza todos os agentes com sync Mistral ativo.
- **Regras:** 503 se SUPABASE_SERVICE_ROLE_KEY ou MISTRAL_API_KEY ausentes; resposta {ok: fail===0, modelos_normalizados, total, sucesso, falhas, resultados[]}; exceção → 500.
- **Casos de teste:**
  - **Sync all com CRON_SECRET** - DADO Header Authorization: Bearer <CRON_SECRET> e MISTRAL_API_KEY configurada . QUANDO POST /mistral-sync-all . ENTAO 200 com contagens total/sucesso/falhas e modelos_normalizados
  - **Token inválido** - DADO Authorization: Bearer token-errado (produção) . QUANDO POST /mistral-sync-all . ENTAO 401 'Não autorizado'
  - **MISTRAL_API_KEY ausente** - DADO Ambiente sem MISTRAL_API_KEY . QUANDO POST com Bearer válido . ENTAO 503 'MISTRAL_API_KEY não configurada.'

### POST /api/hub/agentes/sugerir-conhecimento
- **Auth:** requireCrmGestor + rate limit 20/tenant ('sugerir-conhecimento').
- **Proposito:** IA gera texto sugerido para UMA seção de conhecimento do wizard de agente, a partir do cargo e nome do agente.
- **Regras:** secao deve estar em SECOES_CONHECIMENTO_IDS → 400 listando as válidas; nome_agente obrigatório (400); cargo obrigatório como objeto {slug, titulo, ...} (400); mercados[] e texto_atual opcionais; falha IA → 503; sucesso = {texto}.
- **Casos de teste:**
  - **Sugestão para seção válida** - DADO Sessão de gestor, IA disponível . QUANDO POST {secao:'<id válido>', nome_agente:'Mari', cargo:{slug:'sdr', titulo:'SDR'}} . ENTAO 200 {texto:'...'}
  - **Cargo malformado** - DADO Sessão de gestor . QUANDO POST {secao:'<id válido>', nome_agente:'Mari', cargo:{slug:''}} . ENTAO 400 'cargo obrigatório: { slug, titulo, ... }.'
  - **Papel sem permissão** - DADO Sessão de atendente . QUANDO POST /sugerir-conhecimento . ENTAO 403

### GET+POST+PATCH+DELETE /api/hub/cargos
- **Auth:** GET: requireCrmSessao; POST/PATCH/DELETE: requireCrmGestor. Catálogo é master-data GLOBAL (hub_cargos_catalogo, sem tenant_id).
- **Proposito:** CRUD do catálogo de cargos de agentes IA. GET lista (por padrão só ativos, ?all=true inclui inativos). POST cria com defaults de atendimento heurísticos por tipo de cargo (SDR/suporte/operações/marketing). PATCH edita por body.slug (suporta rename via novo_slug e propagar_titulo_para_agentes). DELETE ?slug= arquiva (soft, ativo=false).
- **Regras:** POST: titulo obrigatório (400); slug derivado/normalizado, mín. 2 chars (400); slug duplicado → 409; nivel clampado 1..5 (default 3); modelos normalizados via helpers hub-model-defaults; limite_autonomia_brl ≥ 0. PATCH: slug obrigatório (400); cargo inexistente → 404; novo_slug em colisão → 409; titulo não pode ficar vazio (400); nenhum campo → 400; propagar_titulo_para_agentes=true atualiza hub_agente_identidade.cargo dos agentes com o título antigo. DELETE: slug obrigatório (400); 404 se não existe; 409 se agentes usam o cargo (guarda de arquivarCargoCatalogo).
- **Casos de teste:**
  - **Criar cargo com defaults de qualificação** - DADO Sessão de gestor . QUANDO POST {titulo:'SDR Imóveis'} . ENTAO 201 com slug 'sdr_imoveis', usar_perguntas_essenciais=true e perguntas essenciais default (heurística /sdr|qualific/)
  - **Slug duplicado** - DADO Cargo 'sdr' já existe . QUANDO POST {titulo:'SDR', slug:'sdr'} . ENTAO 409 'Já existe cargo com slug «sdr».'
  - **DELETE bloqueado por agentes em uso** - DADO Cargo com agentes ativos apontando para o título . QUANDO DELETE /api/hub/cargos?slug=sdr . ENTAO 409 (guarda de arquivarCargoCatalogo — não arquiva cargo em uso)

### POST /api/hub/cargos/delete-batch
- **Auth:** requireCrmGestor.
- **Proposito:** Arquiva cargos do catálogo em lote (soft-delete via ativo=false, mesmo helper arquivarCargoCatalogo).
- **Regras:** Body {slugs: string[]} não vazio (400); slugs deduplificados e filtrados (≥ 2 chars, 400 se nenhum sobrar); resposta {ok: blocked.length===0, deleted[], blocked[{slug,error}], counts} — cargos em uso por agentes entram em blocked (409 individual vira item da lista).
- **Casos de teste:**
  - **Lote misto** - DADO 'cargo_livre' sem agentes e 'sdr' com agentes ativos . QUANDO POST {slugs:['cargo_livre','sdr']} . ENTAO 200 {ok:false, deleted:['cargo_livre'], blocked:[{slug:'sdr', ...}], counts:{deleted:1, blocked:1}}
  - **Array vazio** - DADO Sessão de gestor . QUANDO POST {slugs:[]} . ENTAO 400 'slugs deve ser um array não vazio.'
  - **Sem permissão** - DADO Sessão de comercial . QUANDO POST /delete-batch . ENTAO 403

### POST /api/hub/cargos/sugerir
- **Auth:** requireCrmGestor + rate limit 20/tenant ('cargos-sugerir').
- **Proposito:** IA (Mistral) sugere os campos completos de um cargo novo para hub_cargos_catalogo, usando como contexto os cargos ativos (até 48) e mercados ativos (até 40).
- **Regras:** titulo obrigatório (400); erro ao ler catálogo → 500; falha da IA → 502; sucesso = {sugestao}.
- **Casos de teste:**
  - **Sugestão de cargo** - DADO Sessão de gestor, Mistral disponível . QUANDO POST {titulo:'Analista de Orçamentos'} . ENTAO 200 {sugestao} com campos propostos para o catálogo
  - **Sem título** - DADO Sessão de gestor . QUANDO POST {} . ENTAO 400 'titulo é obrigatório.'
  - **IA fora do ar** - DADO Mistral indisponível . QUANDO POST {titulo:'X'} . ENTAO 502 com a mensagem de erro do provedor

### GET+POST /api/hub/ciclos
- **Auth:** GET: requireCrmSessao; POST: requireCrmGestor. Filtro .eq('tenant_id', sessão) no GET; tenant_id do INSERT vem da sessão (fallback sem tenant se coluna ausente — legado).
- **Proposito:** GET lista ciclos de IA do tenant (hub_ciclos_ia) com filtros; POST cria ciclo (contínuo/programado/gatilho) para um agente.
- **Regras:** GET: por padrão só ativo=true; ?ativo=false só inativos; ?ativo=todos tudo; ?agente_slug=, ?tipo= (continuo|programado|gatilho); ?q= sanitizado via sanitizarBuscaPostgrest ANTES do .or(ilike) — anti-injeção PostgREST. POST: agente_slug, nome e tipo válidos obrigatórios (400); intervalo_minutos, se enviado, inteiro > 0 (400); configuracoes validadas/normalizadas via validateAndNormalizeCicloConfiguracoes (400 se inválidas); sucesso 201 com a linha.
- **Casos de teste:**
  - **Criar ciclo programado** - DADO Sessão de gestor . QUANDO POST {agente_slug:'mari', nome:'Follow-up manhã', tipo:'programado', intervalo_minutos:60} . ENTAO 201 com o ciclo criado, ativo=true e tenant_id da sessão
  - **Tipo inválido** - DADO Sessão de gestor . QUANDO POST {agente_slug:'mari', nome:'X', tipo:'semanal'} . ENTAO 400 'agente_slug, nome e tipo (continuo/programado/gatilho) são obrigatórios.'
  - **Busca com injeção PostgREST** - DADO Sessão válida do tenant A . QUANDO GET /api/hub/ciclos?q=,tenant_id.eq.OUTRO . ENTAO 200 sem vazar ciclos de outro tenant (termo sanitizado antes do .or)

### GET+PATCH+DELETE /api/hub/ciclos/{id}
- **Auth:** GET: requireCrmSessao; PATCH/DELETE: requireCrmGestor. Isolamento de tenant tolerante (tenant_id NULL passa; diferente → 404).
- **Proposito:** GET devolve um ciclo; PATCH edita campos (nome, descricao, tipo, cron_expressao, intervalo_minutos, ativo, configuracoes, agente_slug); DELETE arquiva (soft: ativo=false — ciclo e logs permanecem).
- **Regras:** PATCH: tipo inválido → 400; intervalo_minutos não numérico/≤0 → 400 (null/'' limpa); configuracoes inválidas → 400; patch vazio → 400; agente_slug/nome não podem ficar vazios (400); ciclo de outro tenant → 404 antes do write. DELETE: verifica tenant antes; responde {ok:true}.
- **Casos de teste:**
  - **Pausar ciclo** - DADO Ciclo do tenant, sessão de gestor . QUANDO PATCH {ativo:false} . ENTAO 200 com ativo=false; GET /api/hub/ciclos padrão deixa de listá-lo
  - **intervalo_minutos inválido** - DADO Sessão de gestor . QUANDO PATCH {intervalo_minutos:'abc'} . ENTAO 400 'intervalo_minutos inválido.'
  - **DELETE cross-tenant** - DADO Ciclo com tenant_id de outro tenant . QUANDO DELETE /api/hub/ciclos/{id} . ENTAO 404 'Ciclo não encontrado' e ciclo continua ativo

### POST /api/hub/ciclos/executar
- **Auth:** requireCrmGestor + isolamento de tenant do ciclo → 404. CRON_SECRET lido do ENV server-side (nunca vai ao browser).
- **Proposito:** 'Executar agora': resolve o runner (diretor/gerente/atendente) e o nomeCiclo pelo nome do ciclo, e chama internamente GET /api/ciclos/{runner}?ciclo=...&hub_ciclo_id=... com Authorization Bearer CRON_SECRET.
- **Regras:** ciclo_id obrigatório (400); ciclo inexistente/cross-tenant → 404; CRON_SECRET ausente no ambiente → 503 com instrução; runner responde não-2xx → 502 com status+trecho; erro de rede → 502; sucesso = {ok:true, runner, nomeCiclo, ciclo_id}.
- **Casos de teste:**
  - **Executar ciclo do tenant** - DADO Ciclo 'Follow-up' do agente 'mari' no tenant da sessão, CRON_SECRET configurado . QUANDO POST {ciclo_id:'<uuid>'} . ENTAO 200 {ok:true, runner:'atendente', nomeCiclo:'followup', ciclo_id}
  - **CRON_SECRET ausente** - DADO Ambiente sem CRON_SECRET . QUANDO POST {ciclo_id:'<uuid válido>'} . ENTAO 503 'CRON_SECRET não configurado no ambiente...'
  - **Ciclo de outro tenant** - DADO ciclo_id de outro tenant . QUANDO POST /executar . ENTAO 404 'Ciclo não encontrado.' (runner não é chamado)

### POST /api/hub/ciclos/sugerir-ia
- **Auth:** requireCrmGestor + rate limit 20/tenant ('ciclos-sugerir').
- **Proposito:** IA sugere (a) descrição de ciclo ou (b) parâmetros de follow-up (horas_followup, arquivar_apos_dias), conforme body.acao.
- **Regras:** acao ∈ {descricao, followup} → 400 caso contrário; nome e agente_slug obrigatórios (400); acao=descricao aceita tipo_ciclo (default 'programado'), cron_resumo, texto_atual; falha IA → 503; sucesso = {texto} ou {horas_followup, arquivar_apos_dias}.
- **Casos de teste:**
  - **Sugerir descrição** - DADO Sessão de gestor, IA disponível . QUANDO POST {acao:'descricao', nome:'Follow-up manhã', agente_slug:'mari'} . ENTAO 200 {texto:'...'}
  - **acao inválida** - DADO Sessão de gestor . QUANDO POST {acao:'cron', nome:'X', agente_slug:'mari'} . ENTAO 400 'acao inválida. Use: descricao | followup.'
  - **Campos obrigatórios ausentes** - DADO Sessão de gestor . QUANDO POST {acao:'followup'} . ENTAO 400 'nome e agente_slug são obrigatórios.'

### GET /api/hub/ciclos-log
- **Auth:** requireCrmGestor (recurso global do Hub — hub_ciclos_log não tem tenant_id; gate só por nível).
- **Proposito:** Lista logs de execução de ciclos (hub_ciclos_log), mais recentes primeiro, com filtros ?agente_slug=, ?status=, ?ciclo_id=, ?limit= (1..200, default 20).
- **Regras:** limit clampado 1..200; erro de banco → 500; resposta {logs:[...]}.
- **Casos de teste:**
  - **Filtrar por agente e status** - DADO Sessão de gestor com logs existentes . QUANDO GET ?agente_slug=mari&status=erro&limit=10 . ENTAO 200 {logs} com ≤ 10 itens do agente 'mari' com status 'erro'
  - **Papel comum bloqueado** - DADO Sessão de atendente . QUANDO GET /api/hub/ciclos-log . ENTAO 403
  - **limit fora de faixa** - DADO Sessão de gestor . QUANDO GET ?limit=500 . ENTAO 200 com no máximo 200 logs (clamp)

### GET /api/hub/aprovacoes
- **Auth:** requireCrmAprovador: gestor/owner OU portador de capability de escrow (architect/operation). Fila SEMPRE filtrada por tenant_id da sessão (fallback sem filtro só se a coluna tenant_id não existir — 42703).
- **Proposito:** Lista a fila de aprovações do tenant (hub_aprovacoes) por ?status= (default 'pendente'), enriquecendo campos de exibição (descricao, agente_nome, valor_envolvido, confianca_ia sem default fabricado).
- **Regras:** Portador de escrow-capability que NÃO é gestor só LÊ os tipos de chave de escrow (query .in('tipo', TIPOS_ESCROW_CHAVE_TECNICA)) — nunca vê cotação/orçamento/genéricas; filtro reaplicado também no ramo legado sem tenant_id (fail-closed dupla ramificação); erro → 500 genérico 'Não foi possível carregar as aprovações.' (sem SQL cru).
- **Casos de teste:**
  - **Gestor vê a fila completa do tenant** - DADO Sessão de gestor com aprovações pendentes de vários tipos . QUANDO GET /api/hub/aprovacoes . ENTAO 200 {aprovacoes} com todos os tipos, só do tenant da sessão
  - **Portador de chave só vê tipos de escrow** - DADO Sessão de papel architect (escrow:chave_tecnica, não-gestor) . QUANDO GET /api/hub/aprovacoes . ENTAO 200 apenas com tipos em TIPOS_ESCROW_CHAVE_TECNICA (cotações/orçamentos ausentes)
  - **Papel sem capability** - DADO Sessão de atendente sem capability de escrow . QUANDO GET /api/hub/aprovacoes . ENTAO 403 (requireCrmAprovador nega)

### PATCH /api/hub/aprovacoes/{id}
- **Auth:** requireCrmAprovador (gestor/owner ou portador de escrow-capability). Tenant da SESSÃO passa para aprovar()/rejeitar(); identidade humana (userId + ehHumano) exigida para chaves de escrow.
- **Proposito:** Decide uma aprovação: body {status:'aprovado'|'rejeitado', observacao?, motivo?}. Aprovar dispara a cascata de efeitos (escrow liberado / aguardando 2ª chave etc.); rejeitar grava motivo.
- **Regras:** status ≠ aprovado/rejeitado → 400; dentro de aprovar(): tipos não-escrow exigem gestor+, chave de escrow é fail-closed por capability + duas autoridades humanas DISTINTAS; falha de negócio → 400 com erro; aprovado com dupla incompleta ainda responde 200 {ok:true, efeito} (texto deriva de efeito); rejeitar sem motivo usa 'Rejeitado pelo operador'.
- **Casos de teste:**
  - **Aprovar item comum como gestor** - DADO Aprovação pendente do tenant, sessão de gestor . QUANDO PATCH {status:'aprovado', observacao:'ok'} . ENTAO 200 {ok:true, efeito} e status da linha muda para aprovado
  - **status inválido** - DADO Sessão de aprovador . QUANDO PATCH {status:'talvez'} . ENTAO 400 'status deve ser aprovado ou rejeitado'
  - **Mesma pessoa não assina as duas chaves de escrow** - DADO Escrow onde o mesmo userId já assinou a 1ª chave . QUANDO PATCH {status:'aprovado'} na 2ª chave com o mesmo usuário . ENTAO 400 com erro do gate de duas autoridades distintas (aprovar() nega)

### GET /api/hub/alertas
- **Auth:** requireCrmGestor (hub_alertas é recurso global sem tenant_id — gate só por nível).
- **Proposito:** Lista alertas do Hub com filtros ?resolvido=true|false, ?agente_slug=, ?tipo=, ?limit= (1..200, default 30), mais recentes primeiro.
- **Regras:** limit clampado; erro de banco → 500; resposta {alertas:[...]}.
- **Casos de teste:**
  - **Alertas não resolvidos** - DADO Sessão de gestor com alertas pendentes . QUANDO GET ?resolvido=false . ENTAO 200 {alertas} contendo só resolvido=false
  - **Sem sessão** - DADO Request anônimo . QUANDO GET /api/hub/alertas . ENTAO 401
  - **Papel comum** - DADO Sessão de atendente . QUANDO GET /api/hub/alertas . ENTAO 403

### PATCH /api/hub/alertas/{id}
- **Auth:** requireCrmGestor (recurso global, sem filtro de tenant).
- **Proposito:** Atualiza um alerta: resolvido (boolean), resolvido_em (string/null), titulo, mensagem, tipo.
- **Regras:** Body JSON inválido → 400; nenhum campo válido → 400; alerta inexistente → 404; sucesso devolve a linha atualizada.
- **Casos de teste:**
  - **Resolver alerta** - DADO Alerta existente, sessão de gestor . QUANDO PATCH {resolvido:true, resolvido_em:'2026-07-12T12:00:00Z'} . ENTAO 200 com resolvido=true
  - **Patch vazio** - DADO Sessão de gestor . QUANDO PATCH {} . ENTAO 400 'Nenhum campo válido para atualizar.'
  - **Id inexistente** - DADO Sessão de gestor . QUANDO PATCH /api/hub/alertas/<uuid-inexistente> com {resolvido:true} . ENTAO 404 'Alerta não encontrado'

### GET /api/hub/canais
- **Auth:** requireCrmSessao + escopo de tenant via tenantScopeOrFilter (fallback sem filtro se coluna tenant_id ausente).
- **Proposito:** Lista canais WhatsApp (linhas de hub_agente_identidade com colunas uazapi_*), só leitura do banco (sem chamadas UAZAPI), sanitizadas antes de sair.
- **Regras:** Select fixo de colunas de canal (agente_slug, nome, ativo, arquivado_em, uazapi_instance_id/name/connection_status/token, modo_operacao, uazapi_snapshot_at) com fallback de colunas legadas; resposta é array de agentes sanitizados (token NÃO viaja ao browser — sanitizarAgenteHubParaCliente).
- **Casos de teste:**
  - **Listagem de canais sanitizada** - DADO Tenant com agentes WhatsApp conectados . QUANDO GET /api/hub/canais . ENTAO 200 array com uazapi_connection_status presente e uazapi_instance_token AUSENTE
  - **Anônimo bloqueado** - DADO Request sem sessão . QUANDO GET /api/hub/canais . ENTAO 401
  - **Isolamento de tenant** - DADO Dois tenants com agentes distintos . QUANDO GET com sessão do tenant A . ENTAO 200 apenas com agentes do tenant A (ou legado NULL do escopo)

### GET+POST /api/hub/autonomia-matriz
- **Auth:** requireCrmGestor (recurso global do Hub sem tenant_id — controla limites de gasto/autonomia dos agentes IA).
- **Proposito:** GET lista regras ATIVAS da matriz de autonomia de um agente (?agente_slug=, ordenadas por prioridade desc). POST cria regra (canal, prioridade, exige_aprovacao, limite_autonomia_brl, palavras_chave, regex).
- **Regras:** GET: agente_slug obrigatório na query (400); só ativo=true (DELETE arquiva). POST: agente_slug e nome obrigatórios (400); canal ∈ {whatsapp, instagram, email, interno, site, *} ou null → 400 se inválido; defaults prioridade=0, ativo=true, exige_aprovacao=false; sucesso = {regra}.
- **Casos de teste:**
  - **Criar regra de aprovação por valor** - DADO Sessão de gestor . QUANDO POST {agente_slug:'mari', nome:'Acima de 500', canal:'whatsapp', exige_aprovacao:true, limite_autonomia_brl:500} . ENTAO 200 {regra} com os campos persistidos
  - **Canal inválido** - DADO Sessão de gestor . QUANDO POST {agente_slug:'mari', nome:'X', canal:'telegram'} . ENTAO 400 'canal inválido (use whatsapp, instagram, email, interno, site, * ou omita)'
  - **GET sem agente_slug** - DADO Sessão de gestor . QUANDO GET /api/hub/autonomia-matriz . ENTAO 400 'Query agente_slug é obrigatória'

### PATCH+DELETE /api/hub/autonomia-matriz/{id}
- **Auth:** requireCrmGestor (recurso global, sem filtro de tenant).
- **Proposito:** PATCH atualiza uma regra da matriz por id (canal, nome, prioridade, ativo, exige_aprovacao, limite_autonomia_brl, palavras_chave, regex_opcional, observacao). DELETE arquiva a regra (ativo=false — 'só arquiva').
- **Regras:** id obrigatório (400); canal, se enviado, deve estar na allowlist ou null → 400; PATCH em id inexistente → 404; DELETE verifica existência antes → 404; DELETE sucesso = {ok:true}.
- **Casos de teste:**
  - **Subir prioridade da regra** - DADO Regra existente, sessão de gestor . QUANDO PATCH {prioridade:10} . ENTAO 200 {regra} com prioridade=10 e atualizado_em novo
  - **DELETE arquiva (não apaga)** - DADO Regra ativa . QUANDO DELETE /{id} . ENTAO 200 {ok:true}; GET ?agente_slug= não lista mais a regra, mas a linha permanece no banco com ativo=false
  - **Regra inexistente** - DADO Sessão de gestor . QUANDO DELETE /<uuid-inexistente> . ENTAO 404 'Regra não encontrada'

### GET+POST /api/hub/ferramentas-custom
- **Auth:** GET: requireCrmSessao; POST: requireCrmOwner (só owner cria — espelha a UI). Tenant da sessão em ambos (.eq tenant_id).
- **Proposito:** GET lista ferramentas custom do tenant (hub_ferramentas_custom; default só ativas, ?all=true inclui inativas). POST cria ferramenta apontando para uma implementação builtin do catálogo Hub, com schema de parâmetros herdado do builtin.
- **Regras:** POST: titulo obrigatório (400); slug_curto/titulo normalizado → ferramenta_key (400 se inválido); builtin_impl deve ser ID do catálogo (400); descricao_modelo obrigatória (400); smart_provider validado (400); chave duplicada → 409; tabela ausente → 503; sucesso 201.
- **Casos de teste:**
  - **Owner cria ferramenta** - DADO Sessão de owner . QUANDO POST {titulo:'Buscar imóvel', builtin_impl:'<id do catálogo>', descricao_modelo:'Busca imóveis por bairro'} . ENTAO 201 com ferramenta_key derivada e parametros_schema do builtin
  - **Gestor não cria** - DADO Sessão de gestor (não-owner) . QUANDO POST /api/hub/ferramentas-custom . ENTAO 403 (requireCrmOwner)
  - **builtin inexistente** - DADO Sessão de owner . QUANDO POST com builtin_impl:'ferramenta_inventada' . ENTAO 400 'builtin_impl deve ser um ID do catálogo Hub.'

### PATCH+DELETE /api/hub/ferramentas-custom/{id}
- **Auth:** requireCrmOwner. Writes SEMPRE com .eq('id').eq('tenant_id', sessão) — cross-tenant vira 404.
- **Proposito:** PATCH edita ferramenta custom (titulo, descricoes, builtin_impl com schema atualizado, smart_provider/model/prompt, ativo). DELETE arquiva (ativo=false — 'só arquiva').
- **Regras:** id obrigatório (400); builtin_impl inválido → 400; smart_provider inválido → 400; linha inexistente/de outro tenant → 404; DELETE sucesso = {ok:true, deleted:id}.
- **Casos de teste:**
  - **Trocar builtin e schema** - DADO Ferramenta do tenant, sessão de owner . QUANDO PATCH {builtin_impl:'<outro id válido>'} . ENTAO 200 com builtin_impl novo e parametros_schema do novo builtin
  - **DELETE cross-tenant** - DADO Ferramenta de outro tenant . QUANDO DELETE /{id} com owner do tenant A . ENTAO 404 'Ferramenta não encontrada.' (filtro tenant_id no update)
  - **Papel abaixo de owner** - DADO Sessão de gestor . QUANDO PATCH /{id} . ENTAO 403

### POST /api/hub/ferramentas-custom/sugerir
- **Auth:** requireCrmGestor + rate limit 20/tenant ('ferramentas-sugerir').
- **Proposito:** IA (Mistral) sugere a configuração de uma ferramenta custom a partir do título pedido.
- **Regras:** titulo obrigatório (400); falha IA → 502; sucesso = {sugestao}.
- **Casos de teste:**
  - **Sugestão gerada** - DADO Sessão de gestor, Mistral disponível . QUANDO POST {titulo:'Consultar tabela de preços'} . ENTAO 200 {sugestao}
  - **Sem título** - DADO Sessão de gestor . QUANDO POST {} . ENTAO 400 'titulo é obrigatório.'
  - **Rate limit** - DADO 21ª chamada na janela . QUANDO POST repetido . ENTAO 429

### GET+PATCH /api/hub/followup-config
- **Auth:** requireCrmGestor em ambos (config global de cadência de follow-up, tabela hub_followup_config sem escopo de tenant).
- **Proposito:** GET lista passos ativos de follow-up (passo, mercado, horas_espera) ordenados por mercado+passo. PATCH atualiza horas_espera em lote via {updates:[{passo, mercado, horas_espera}]} e devolve a lista atualizada.
- **Regras:** PATCH: updates[] obrigatório e não vazio (400); cada update é aplicado por (passo, mercado, ativo=true); erro de banco → 500; ambos devolvem {rows:[...]} normalizados a números.
- **Casos de teste:**
  - **Ajustar cadência** - DADO Config com passo 1 do mercado 'geral', sessão de gestor . QUANDO PATCH {updates:[{passo:1, mercado:'geral', horas_espera:4}]} . ENTAO 200 {rows} refletindo horas_espera=4 no passo 1
  - **updates ausente** - DADO Sessão de gestor . QUANDO PATCH {} . ENTAO 400 'updates[] obrigatório'
  - **Papel comum** - DADO Sessão de comercial . QUANDO GET /api/hub/followup-config . ENTAO 403

### POST /api/hub/playbook/analisar-conteudo
- **Auth:** requireCrmGestor + rate limit 20/tenant ('playbook-analisar-conteudo'). Metering best-effort (tokens estimados ~4 chars/token).
- **Proposito:** Analisa conteúdo de playbook ANTES de criar/publicar o agente (sem slug): body {content, filename?} → análise Mistral ou fallback local.
- **Regras:** content obrigatório após normalização (400); > 40.000 chars → 413; falha da Mistral vira 200 com analise de fallback local (model:'local-fallback', aviso); sucesso Mistral = {sucesso:true, model, analise, analise_origem:'mistral'} + consumo registrado (origem 'playbook_analisar_conteudo').
- **Casos de teste:**
  - **Análise pré-criação** - DADO Sessão de gestor, Mistral disponível . QUANDO POST {content:'# Playbook do SDR...', filename:'sdr.md'} . ENTAO 200 {sucesso:true, analise_origem:'mistral'} e linha em hub_ia_consumo
  - **Conteúdo grande demais** - DADO Sessão de gestor . QUANDO POST com content de 50.000 chars . ENTAO 413 'Playbook acima de 40000 caracteres. Reduza o tamanho.'
  - **Sem auth** - DADO Request anônimo . QUANDO POST /analisar-conteudo . ENTAO 401 (antes era rota sem auth — hoje exige gestor)

### POST /api/hub/playbook/visual-telemetry
- **Auth:** PÚBLICO — sem guard de auth (única rota do grupo sem sessão). Só grava log estruturado server-side, nada no banco.
- **Proposito:** Telemetria do editor visual de fluxo do playbook: registra eventos allowlisted (sideover_opened, markdown_applied, builder_fallback, publish_validation_invalid) via hub logger.
- **Regras:** event obrigatório e DEVE estar na allowlist ALLOWED_EVENTS (400 'Evento inválido.'); agente_slug obrigatório (400); metadata é higienizada: chaves com lead/telefone/phone/email/nome/markdown/content/message são DESCARTADAS; strings truncadas a 200 chars, arrays ≤ 8 itens; sucesso = {ok:true, trace_id}.
- **Casos de teste:**
  - **Evento válido registrado** - DADO Nenhuma sessão necessária . QUANDO POST {event:'playbook.flow_visual.sideover_opened', agente_slug:'mari', metadata:{steps:3}} . ENTAO 200 {ok:true, trace_id}
  - **Evento fora da allowlist** - DADO Request qualquer . QUANDO POST {event:'evento.qualquer', agente_slug:'mari'} . ENTAO 400 'Evento inválido.'
  - **PII descartada da metadata** - DADO metadata com {telefone:'11999...', steps:2} . QUANDO POST com evento válido . ENTAO 200 {ok:true}; o log gravado contém steps mas NÃO contém a chave telefone

### GET+PUT /api/crm/ia/config
- **Auth:** crmApiConfigError (503 se env do CRM ausente) + requireCrmOwner (owner-only). Config GLOBAL: escopo='global' e tenant_id IS NULL.
- **Proposito:** Lê/atualiza a config global de precificação de IA (hub_ia_config): markup, fx_usd_brl, valor_credito_brl, nome_moeda, modo (prepago/pospago), alerta_saldo_baixo.
- **Regras:** PUT: markup < 1 → 400 'Markup deve ser ≥ 1 — nunca vender IA abaixo do custo.' (MET-01, fail-closed); campos numéricos só entram se Number.isFinite; modo só aceita 'prepago'|'pospago'; alerta_saldo_baixo arredondado; patch vazio → 400 'Nada para atualizar.'; resposta {data: row|null}.
- **Casos de teste:**
  - **Owner atualiza markup válido** - DADO Sessão de owner . QUANDO PUT {markup:2.5} . ENTAO 200 {data} com markup=2.5
  - **Markup abaixo do custo** - DADO Sessão de owner . QUANDO PUT {markup:0.8} . ENTAO 400 'Markup deve ser ≥ 1 — nunca vender IA abaixo do custo.'
  - **Gestor não acessa** - DADO Sessão de gestor (não-owner) . QUANDO GET /api/crm/ia/config . ENTAO 403 (requireCrmOwner)

### GET+PUT /api/crm/ia/precos
- **Auth:** crmApiConfigError + requireCrmOwner (owner-only).
- **Proposito:** GET lista a tabela de preços por modelo (hub_ia_precos: modelo, input_usd_milhao, output_usd_milhao, ativo). PUT atualiza UM modelo por nome.
- **Regras:** PUT: modelo obrigatório (400); só campos finitos/boolean entram no patch; patch vazio → 400 'Nada para atualizar.'; modelo inexistente → 200 {data:null} (update .maybeSingle sem match — não é 404); erro de banco → 500.
- **Casos de teste:**
  - **Atualizar preço de um modelo** - DADO Sessão de owner e modelo 'mistral-large' na tabela . QUANDO PUT {modelo:'mistral-large', input_usd_milhao:2, output_usd_milhao:6} . ENTAO 200 {data} com os preços novos
  - **Sem modelo** - DADO Sessão de owner . QUANDO PUT {input_usd_milhao:2} . ENTAO 400 'Modelo obrigatório.'
  - **Papel abaixo de owner** - DADO Sessão de gestor . QUANDO GET /api/crm/ia/precos . ENTAO 403

### GET /api/crm/ia/creditos
- **Auth:** crmApiConfigError + requireCrmGestor. Tenant-scoped (.eq tenant_id da sessão).
- **Proposito:** Saldo de créditos (Tijolos) do escritório + extrato de consumo (hub_ia_consumo, últimos 50). Com ?origem= devolve a MÉDIA REAL de Tijolos daquela ação (até 200 amostras) para o aviso pré-execução.
- **Regras:** custo_brl (margem interna) NUNCA viaja ao browser (E-A1) — select só origem/modelo/creditos/criado_em; ?origem= sem histórico devolve media=null e amostras=0; resposta padrão {saldo, consumo[]}; com origem {saldo, origem, media, amostras}.
- **Casos de teste:**
  - **Saldo e extrato** - DADO Tenant com consumo registrado, sessão de gestor . QUANDO GET /api/crm/ia/creditos . ENTAO 200 {saldo, consumo ≤ 50 itens}; nenhum item contém custo_brl
  - **Média por origem sem histórico** - DADO Tenant sem consumo da origem 'blueprint_agente_ia' . QUANDO GET ?origem=blueprint_agente_ia . ENTAO 200 {saldo, origem, media:null, amostras:0}
  - **Papel comum** - DADO Sessão de atendente . QUANDO GET /api/crm/ia/creditos . ENTAO 403 (requireCrmGestor)


---

## DASHBOARD / ANALYTICS / RELATÓRIOS / CONFIG

### GET /api/crm/dashboard
- **Auth:** Sessão válida + conta ativa (getCallerContext — aceita qualquer role, inclusive papéis do ecossistema como client/supplier sem nível RBAC)
- **Proposito:** Cockpit persona-aware: agrega o painel do CRM (aggregateDashboard) recortado pela persona derivada do role (personaCockpitFromRole). Tenant sempre da sessão (cookie httpOnly), nunca do header x-tenant-id.
- **Regras:** Query param opcional `since` (ISO); default = meia-noite UTC de hoje. userId usado só para escopar a obra do cliente. Erro na agregação → 500 {error}. Sem validação de formato de `since` (passa cru ao agregador).
- **Casos de teste:**
  - **Painel do dia para sessão válida** - DADO usuário autenticado (qualquer papel) com cookie de sessão do tenant T . QUANDO GET /api/crm/dashboard sem `since` . ENTAO 200 com payload agregado do tenant T recortado pela persona do role, usando meia-noite UTC como início
  - **Sem sessão → rejeitado** - DADO request sem cookie de sessão e sem chave interna . QUANDO GET /api/crm/dashboard . ENTAO 401 (erro devolvido pelo getCallerContext)
  - **Header x-tenant-id forjado é ignorado** - DADO sessão do tenant T1 e header x-tenant-id=T2 . QUANDO GET /api/crm/dashboard . ENTAO 200 apenas com dados do tenant T1 (tenant vem da sessão)

### GET /api/crm/analytics
- **Auth:** requireCrmFinanceiro (owner/gestor/financeiro) — expõe números financeiros/KPI
- **Proposito:** Agrega analytics do tenant (aggregateAnalytics) por período, com filtro opcional por mercado.
- **Regras:** Checa config (crmConfigError → 503). `periodo` parseado por parseAnalyticsPeriodo. `mercado` (uppercase) deve estar em MERCADOS_PREFIXO; valor fora da lista → 400 com mensagem listando os válidos. Erro de agregação → 500 com mensagem composta (message/code/details/hint).
- **Casos de teste:**
  - **Analytics do período para financeiro+** - DADO sessão de owner/gestor/financeiro no tenant T . QUANDO GET /api/crm/analytics?periodo=30d . ENTAO 200 com payload agregado do tenant T
  - **Mercado inválido** - DADO sessão financeiro+ . QUANDO GET /api/crm/analytics?mercado=XYZ . ENTAO 400 com error 'Mercado inválido: XYZ...' listando os prefixos válidos
  - **Comercial/atendente barrado** - DADO sessão com role comercial ou atendente . QUANDO GET /api/crm/analytics . ENTAO 403 (nível financeiro exigido)

### GET /api/crm/metricas
- **Auth:** requireCrmSessao (qualquer nível CRM interno)
- **Proposito:** Métricas do CRM (fetchCrmMetricas) do tenant da sessão desde `since`.
- **Regras:** `since` opcional (ISO); default meia-noite UTC de hoje. Tenant sempre da sessão. Sem try/catch explícito além do padrão.
- **Casos de teste:**
  - **Métricas do dia** - DADO sessão CRM válida no tenant T . QUANDO GET /api/crm/metricas . ENTAO 200 com JSON de métricas do tenant T do dia corrente
  - **Anônimo rejeitado** - DADO request sem sessão . QUANDO GET /api/crm/metricas . ENTAO 401/403 do guard requireCrmSessao
  - **Since customizado** - DADO sessão válida . QUANDO GET /api/crm/metricas?since=2026-07-01T00:00:00Z . ENTAO 200 com métricas calculadas a partir da data informada

### GET /api/crm/funil-hub
- **Auth:** requireCrmComercial (comercial ou superior)
- **Proposito:** Dados brutos do Funil do Hub: leads, vínculos lead_origem, negócios e obras do tenant (service_role, 4 queries paralelas). O client fatia por mercado/origem.
- **Regras:** Todas as 4 queries com .eq('tenant_id') explícito. Retorna {data:{leads,vinculos,negocios,obras}} com arrays (vazios se null). Não retorna erro parcial — usa ?? [].
- **Casos de teste:**
  - **Funil completo do tenant** - DADO sessão comercial+ no tenant T com leads e negócios . QUANDO GET /api/crm/funil-hub . ENTAO 200 com data.leads/vinculos/negocios/obras somente do tenant T
  - **Sem sessão** - DADO request anônima . QUANDO GET /api/crm/funil-hub . ENTAO 401/403 do guard
  - **Isolamento de tenant** - DADO sessão do tenant T1; existem leads no tenant T2 . QUANDO GET /api/crm/funil-hub . ENTAO 200 sem nenhum registro do T2 nos arrays

### GET /api/crm/operacao-excecao
- **Auth:** requireCrmComercial (comercial ou superior)
- **Proposito:** Dados brutos de 'O que travou': negócios (status/atualizado_em/valor/proxima_acao), obras (status/data_previsao_fim) e pedidos de material do tenant. A exceção é computada no client.
- **Regras:** 3 queries paralelas com .eq('tenant_id'). Resposta {data:{negocios,obras,pedidos}} sempre 200 com arrays (nunca 500 por erro de query — usa ?? []).
- **Casos de teste:**
  - **Dados de exceção do tenant** - DADO sessão comercial+ no tenant T . QUANDO GET /api/crm/operacao-excecao . ENTAO 200 com negocios/obras/pedidos apenas do tenant T
  - **Anônimo barrado** - DADO request sem sessão . QUANDO GET /api/crm/operacao-excecao . ENTAO 401/403
  - **Atendente sem nível comercial** - DADO sessão com role abaixo de comercial . QUANDO GET . ENTAO 403 do requireCrmComercial

### GET /api/crm/alertas/parados
- **Auth:** requireCrmSessao
- **Proposito:** Lista leads 'parados': não-terminais (estagio fora de ganho/perdido/convertido_negocio) e sem proxima_acao, ordenados do mais antigo, com dias_parado calculado.
- **Regras:** 503 se config faltando. `limit` query param, default 50, teto 100. Filtro .eq('tenant_id') puro (nunca .or com is.null para não vazar PII de outro tenant sob service_role). dias_parado = floor((agora - atualizado_em|criado_em)/dia). Erro de query → 500.
- **Casos de teste:**
  - **Leads parados do tenant** - DADO tenant T com lead em estagio 'novo' sem proxima_acao e lead 'ganho' . QUANDO GET /api/crm/alertas/parados . ENTAO 200 com o lead 'novo' (com dias_parado) e SEM o lead 'ganho'; total = nº de rows
  - **Limit acima do teto** - DADO sessão válida . QUANDO GET ?limit=500 . ENTAO 200 com no máximo 100 registros
  - **Sem sessão** - DADO request anônima . QUANDO GET /api/crm/alertas/parados . ENTAO 401/403 (códigos e PII de lead não expostos)

### GET /api/crm/notificacoes
- **Auth:** requireCrmSessao
- **Proposito:** Notificações do Hub derivadas de hub_eventos (sem tabela própria): filtra 8 event_types relevantes (lead_distribuido, lead_recusado, lead_recolocado, lead_sem_proximo, gate_pendencia_bloqueio, gate_liberado, entrega_gerada, fornecedor_cobrado) e mapeia para {tipo,titulo,descricao,href,acionavel}.
- **Regras:** Lê últimos 40 eventos do tenant (tenantScopeOrFilter inclui legado NULL), devolve no máx. 20 notificações. href derivado de lead_id/negocio_id/fallback /crm/distribuicao. Erro de query → 500.
- **Casos de teste:**
  - **Evento relevante vira notificação** - DADO hub_eventos do tenant T com event_type=lead_distribuido e payload.parceiro_nome='ACME' . QUANDO GET /api/crm/notificacoes . ENTAO 200 com notificação tipo 'info', título 'Lead distribuído', descrição contendo 'ACME'
  - **Evento irrelevante filtrado** - DADO hub_eventos só com event_type fora da lista RELEVANTES . QUANDO GET . ENTAO 200 com notificacoes: []
  - **Sem sessão** - DADO request anônima . QUANDO GET /api/crm/notificacoes . ENTAO 401/403

### GET /api/crm/eventos
- **Auth:** requireCrmSessao
- **Proposito:** Feed cru de eventos da rede (hub_eventos) para o painel de gestão do Hub, ordenado por ts desc.
- **Regras:** `limite` query param, default 30, teto 100 (NaN → 30). Escopo tenant via tenantScopeOrFilter (tenant da sessão + legado NULL). Erro → 500.
- **Casos de teste:**
  - **Feed padrão** - DADO tenant T com 50 eventos . QUANDO GET /api/crm/eventos . ENTAO 200 com data de até 30 eventos, do mais recente ao mais antigo
  - **Limite respeita teto** - DADO sessão válida . QUANDO GET ?limite=999 . ENTAO 200 com no máximo 100 eventos
  - **Sem sessão** - DADO request anônima . QUANDO GET /api/crm/eventos . ENTAO 401/403

### GET /api/crm/rastreio
- **Auth:** requireCrmSessao (códigos são enumeráveis e a busca varre PII — guard obrigatório)
- **Proposito:** Resolve cadeia de rastreabilidade por código (ex. PS2026001) ou busca entidades por nome (busca do cabeçalho).
- **Regras:** 503 se config faltando. Requer `codigo` OU `q`; ambos ausentes → 400 "Informe 'q' (nome) ou 'codigo'". Com `codigo`: resolverRastreioCodigo escopado ao tenant; não achou → 404. Com `q`: se o texto normaliza como código válido resolve a cadeia, senão busca por nome (buscarPorNome) e devolve {resultados}.
- **Casos de teste:**
  - **Resolução por código** - DADO código de rastreio válido pertencente ao tenant T . QUANDO GET /api/crm/rastreio?codigo=PS2026001 . ENTAO 200 com {data: cadeia}
  - **Código de outro tenant / inexistente** - DADO código válido em formato mas de outro tenant . QUANDO GET ?codigo=PS2026001 . ENTAO 404 'Código não encontrado ou formato inválido.'
  - **Sem parâmetros** - DADO sessão válida . QUANDO GET /api/crm/rastreio . ENTAO 400 pedindo 'q' ou 'codigo'

### GET /api/crm/relatorio-diario
- **Auth:** requireCrmOwner (cookie de sessão OU chave interna + x-caller-auth-id para cron)
- **Proposito:** Relatório diário do tenant (aggregateRelatorioDiario), em JSON ou PDF para download.
- **Regras:** crmApiConfigError → 503. `date` parseado por parseRelatorioDate; `format` = json (default) ou pdf. format=pdf → application/pdf com Content-Disposition attachment e Cache-Control no-store. Erro de agregação → 500.
- **Casos de teste:**
  - **JSON do dia para owner** - DADO sessão owner no tenant T . QUANDO GET /api/crm/relatorio-diario . ENTAO 200 com payload JSON do relatório da data corrente
  - **Download PDF** - DADO sessão owner . QUANDO GET ?date=2026-07-10&format=pdf . ENTAO 200 com Content-Type application/pdf e filename obra10-relatorio-2026-07-10.pdf
  - **Não-owner barrado** - DADO sessão gestor/comercial . QUANDO GET /api/crm/relatorio-diario . ENTAO 403 do requireCrmOwner

### GET /api/crm/relatorios/complementos
- **Auth:** requireCrmSessao
- **Proposito:** Counts laterais da tela de Relatórios: aprovações pendentes (hub_aprovacoes status=pendente) e KPIs fora da meta nas últimas 24h (hub_kpis_resultados nivel_alerta != ok).
- **Regras:** Counts head-only no server com tenantScopeOrFilter (defesa em profundidade — substituiu query client com anon key). 503 se config faltando. Sempre 200 com {decisoesPendentes, kpisForaMeta} (null → 0).
- **Casos de teste:**
  - **Counts do tenant** - DADO tenant T com 2 aprovações pendentes e 1 KPI em 'atencao' criado há 1h . QUANDO GET /api/crm/relatorios/complementos . ENTAO 200 {decisoesPendentes:2, kpisForaMeta:1}
  - **KPI antigo não conta** - DADO KPI fora da meta criado há 48h . QUANDO GET . ENTAO 200 com kpisForaMeta:0 (janela de 24h)
  - **Sem sessão** - DADO request anônima . QUANDO GET . ENTAO 401/403

### GET /api/crm/relatorios/export
- **Auth:** requireCrmFinanceiro para entidades financeiro/contas_pagar/contas_receber; requireCrmSessao para as demais
- **Proposito:** Exporta relatório de uma entidade em CSV (download) ou JSON: leads, negocios, empresas, imoveis, contas_pagar, contas_receber, financeiro.
- **Regras:** `entidade` fora da lista → 400. Guard escolhido ANTES por tipo de entidade. CSV com anti formula-injection OWASP (célula iniciada em =+-@/TAB/CR ganha aspa simples) e aspas duplas escapadas. JSON devolve headers/rows/total (real no banco)/exibidos/truncado/aviso. Config faltando → 503. Erro do loader → 500.
- **Casos de teste:**
  - **CSV de leads** - DADO sessão CRM comum no tenant T . QUANDO GET ?entidade=leads&format=csv . ENTAO 200 text/csv com Content-Disposition attachment e apenas dados do tenant T
  - **Financeiro exige role financeiro** - DADO sessão comercial (sem nível financeiro) . QUANDO GET ?entidade=contas_pagar . ENTAO 403 do requireCrmFinanceiro
  - **Entidade inválida** - DADO sessão válida . QUANDO GET ?entidade=hackers . ENTAO 400 listando as entidades válidas
  - **Injeção de fórmula neutralizada** - DADO lead com nome '=HYPERLINK(...)' . QUANDO GET ?entidade=leads (csv) . ENTAO célula sai prefixada com aspa simples, não vira fórmula no Excel

### GET /api/crm/relatorios/logs-ia
- **Auth:** requireCrmOwner (SÓ owner extrai — spec do dono) + rate limit 10/min por tenant (requireIaRateLimit)
- **Proposito:** Relatório dos logs ocultos de uma entidade: junta hub_atividades (categoria=log OU arquivados), hub_eventos e, para lead, hub_acoes_ia (tokens/custo) — e AUDITA a própria extração (insere hub_eventos 'relatorio_logs_extraido').
- **Regras:** entity_type deve estar em {lead,pessoa,empresa,negocio,fornecedor,especialista,obra} e entity_id obrigatório, senão 400. Fontes com .eq('tenant_id'); acoes_ia só se o lead comprovadamente pertence ao tenant (fail-closed). UUIDs de autor resolvidos para nome real ('Equipe' se desconhecido — nunca código cru). Falha em fonte → relatório parcial com {parcial:true, fontes_falhas}. Máx. 800 linhas ordenadas desc. 503 se config faltando.
- **Casos de teste:**
  - **Owner extrai logs de um lead** - DADO owner no tenant T, lead do T com atividades log + ações IA . QUANDO GET ?entity_type=lead&entity_id=<uuid> . ENTAO 200 com linhas das 3 fontes ordenadas desc e um evento 'relatorio_logs_extraido' gravado em hub_eventos
  - **entity_type inválido** - DADO owner autenticado . QUANDO GET ?entity_type=banana&entity_id=x . ENTAO 400 'entity_type/entity_id inválidos'
  - **Gestor barrado** - DADO sessão gestor . QUANDO GET ?entity_type=lead&entity_id=<uuid> . ENTAO 403 (owner-only)
  - **Rate limit** - DADO owner fez mais de 10 extrações no minuto . QUANDO GET novamente . ENTAO 429 do requireIaRateLimit

### POST /api/crm/kpis/calcular
- **Auth:** Server-to-server: Authorization Bearer CRON_SECRET OU header x-api-key = INTERNAL_API_KEY (se ambos falharem → 401). Sem sessão de usuário.
- **Proposito:** Cron: calcula e grava 6 KPIs do funil comercial em hub_kpis_resultados (taxa_qualificacao, taxa_conversao_negocio, pipeline_aberto, leads_hoje, aprovacoes_pendentes, mensagens_fila_pendentes) com metas e nivel_alerta.
- **Regras:** Tenant vem de tenantIdFromRequest(headers) ou defaultTenantId() (esta É a exceção onde o header define o tenant — rota interna). Idempotente no dia: deleta resultados do agente 'crm' de hoje antes de inserir. Metas: qualificação ≥40, conversão ≥15, aprovações >5 = crítico, fila >10 atenção / >20 crítico. 503 config; erro de delete/insert → 500. Sucesso → {ok:true, inseridos:6, metricas}.
- **Casos de teste:**
  - **Cron autorizado calcula KPIs** - DADO CRON_SECRET configurado e leads/negócios no tenant default . QUANDO POST com Authorization: Bearer <CRON_SECRET> . ENTAO 200 {ok:true, inseridos:6} e 6 rows de hoje em hub_kpis_resultados (agente_slug=crm)
  - **Credencial errada** - DADO CRON_SECRET configurado . QUANDO POST com Bearer errado e sem x-api-key válida . ENTAO 401 'Não autorizado'
  - **Recálculo idempotente** - DADO KPIs de hoje já inseridos . QUANDO POST autorizado novamente . ENTAO 200 sem duplicar — resultados do dia foram deletados e reinseridos

### GET /api/crm/tarefas
- **Auth:** getCallerContext (qualquer sessão válida, incl. papéis do ecossistema)
- **Proposito:** Lista tarefas comerciais do tenant (hub_tarefas_comerciais), universal para qualquer entidade.
- **Regras:** Filtros: entity_type, entity_id, concluidas=1 (senão exclui status=concluida). Ordena por vencimento_em asc (nulls por último), limit 200. Tabela inexistente (42P01) → 200 {data:[]} (tolerante). Outros erros → 500. 503 se config.
- **Casos de teste:**
  - **Lista tarefas abertas** - DADO tenant T com tarefa aberta e tarefa concluída . QUANDO GET /api/crm/tarefas . ENTAO 200 só com a tarefa aberta
  - **Incluir concluídas** - DADO mesmo cenário . QUANDO GET ?concluidas=1 . ENTAO 200 com ambas
  - **Sem sessão** - DADO request anônima . QUANDO GET . ENTAO 401

### POST /api/crm/tarefas
- **Auth:** requireCrmComercial
- **Proposito:** Cria tarefa manual (origem='humano') em qualquer entidade via helper criarTarefa.
- **Regras:** Body JSON inválido → 400. `titulo` obrigatório (trim) → 400 'Informe o título da tarefa.'. Campos opcionais: descricao, entity_type/entity_id, lead_id, negocio_id, responsavel_id, prioridade, vencimento_em. tenant_id/ator vêm da sessão. Falha do helper → 400 com o retorno do helper.
- **Casos de teste:**
  - **Criar tarefa** - DADO sessão comercial+ no tenant T . QUANDO POST {titulo:'Ligar para lead', lead_id:<uuid>} . ENTAO 200 com resultado ok da criação, tarefa gravada com origem='humano' e tenant T
  - **Sem título** - DADO sessão comercial+ . QUANDO POST {descricao:'x'} . ENTAO 400 'Informe o título da tarefa.'
  - **Papel insuficiente** - DADO sessão sem nível comercial . QUANDO POST válido . ENTAO 403

### PATCH /api/crm/tarefas
- **Auth:** requireCrmComercial
- **Proposito:** Conclui (default) ou reabre (acao='reabrir') uma tarefa.
- **Regras:** Body JSON inválido → 400; `id` obrigatório → 400. Verifica antes que a tarefa existe E pertence ao tenant (tenant_id null-safe); senão → 404 'Tarefa não encontrada.'. reabrir → status='aberta', concluida_em=null. concluir via helper concluirTarefa; falha → 400.
- **Casos de teste:**
  - **Concluir tarefa** - DADO tarefa aberta do tenant T . QUANDO PATCH {id:<uuid>} . ENTAO 200 e status='concluida'
  - **Reabrir tarefa** - DADO tarefa concluída do tenant T . QUANDO PATCH {id, acao:'reabrir'} . ENTAO 200 {ok:true} e status volta a 'aberta'
  - **Tarefa de outro tenant** - DADO sessão do tenant T1 e id de tarefa do T2 . QUANDO PATCH {id} . ENTAO 404 (não revela existência)

### GET /api/crm/me/context
- **Auth:** getCallerContext (sessão válida, qualquer papel)
- **Proposito:** Contexto da sessão CRM: role, tenantId e nome de exibição do tenant.
- **Regras:** crmApiConfigError → 503. tenantNome com fallback 'Obra10+' se não encontrado.
- **Casos de teste:**
  - **Contexto do usuário logado** - DADO sessão gestor no tenant T com nome_exibicao 'ACME' . QUANDO GET /api/crm/me/context . ENTAO 200 {role:'gestor', tenantId:T, tenantNome:'ACME'}
  - **Sem sessão** - DADO request anônima . QUANDO GET . ENTAO 401
  - **Tenant sem nome** - DADO sessão válida, tenant sem nome_exibicao resolvível . QUANDO GET . ENTAO 200 com tenantNome fallback 'Obra10+'

### GET /api/crm/onboarding/status
- **Auth:** requireCrmOwner
- **Proposito:** Checklist de onboarding do tenant com 6 passos (env, tenant ativo, users, WhatsApp/canais, integrações opcionais, dados CRM) + progresso percentual e flag ready.
- **Regras:** 503 se config. Passos derivados de: buildHealthResponse (env), hub_tenants.ativo, count de public.users (>0), env UAZAPI_* ou canal em hub_agente_identidade, WINDSOR_API_KEY/ANTHROPIC_API_KEY, acesso a hub_leads_crm. Resposta {tenantId, progress, completed, total:6, ready, steps[]} com href por passo.
- **Casos de teste:**
  - **Status para owner** - DADO owner autenticado, tenant ativo com usuários . QUANDO GET /api/crm/onboarding/status . ENTAO 200 com steps[6], progress = round(completed/6*100) e ready coerente
  - **Não-owner barrado** - DADO sessão comercial . QUANDO GET . ENTAO 403
  - **Passo falho detalhado** - DADO UAZAPI_BASE_URL ausente e nenhum canal ativo . QUANDO GET . ENTAO 200 com step whatsapp ok:false e detail orientando configurar

### GET /api/crm/integracoes/status
- **Auth:** requireCrmOwner
- **Proposito:** Status das integrações da plataforma: WhatsApp (UAZAPI), Windsor.ai, IA (Anthropic/Mistral), e placeholders 'em_breve' (Meta Ads, Google Ads, GA4). Baseado só em env vars (nomes, não valores).
- **Regras:** 503 se config. WhatsApp: conectado se URL+token; 'erro' se só um dos dois; senão nao_configurado. IA: ANTHROPIC_API_KEY ou MISTRAL_API_KEY. Resposta {integracoes: IntegracaoStatus[6]}.
- **Casos de teste:**
  - **Status para owner** - DADO owner com UAZAPI completo e WINDSOR_API_KEY ausente . QUANDO GET /api/crm/integracoes/status . ENTAO 200 com whatsapp 'conectado' e windsor 'nao_configurado'
  - **Credencial parcial → erro** - DADO UAZAPI_BASE_URL definida sem UAZAPI_INSTANCE_TOKEN . QUANDO GET . ENTAO 200 com whatsapp status 'erro'
  - **Não-owner** - DADO sessão gestor . QUANDO GET . ENTAO 403 (superfície de env é owner-only)

### GET /api/crm/tenant-settings
- **Auth:** requireCrmGestor (gestor ou owner)
- **Proposito:** Lê as settings do tenant da sessão (hub_tenants.settings): horários, timezone, distribuição automática.
- **Regras:** 503 se config. Coluna settings ausente (migração não aplicada) → 200 {settings:{}} (tolerante). Outro erro → 500. Resposta {tenantId, settings}.
- **Casos de teste:**
  - **Ler settings** - DADO gestor no tenant T com settings gravadas . QUANDO GET /api/crm/tenant-settings . ENTAO 200 {tenantId:T, settings:{...}}
  - **Coluna ausente tolerada** - DADO banco sem coluna settings . QUANDO GET . ENTAO 200 {settings:{}}
  - **Comercial barrado** - DADO sessão comercial . QUANDO GET . ENTAO 403

### PATCH /api/crm/tenant-settings
- **Auth:** requireCrmGestor
- **Proposito:** Merge das settings do tenant com defaults: horario_inicio (08:00), horario_fim (18:00), timezone (America/Sao_Paulo), distribuicao_auto (true), distribuicao_validacao_horas (24).
- **Regras:** Body inválido tratado como {} (catch). Lê settings atuais e faz merge campo a campo (body > prev > default). Coluna settings ausente → 503 com instrução de migração 20260522180000. Outro erro → 500. Resposta {settings}.
- **Casos de teste:**
  - **Atualização parcial preserva o resto** - DADO settings com timezone customizado . QUANDO PATCH {horario_inicio:'09:00'} . ENTAO 200 com horario_inicio='09:00' e timezone anterior mantido
  - **Body vazio aplica defaults** - DADO tenant sem settings . QUANDO PATCH {} . ENTAO 200 com defaults (08:00/18:00/America/Sao_Paulo/true/24)
  - **Papel insuficiente** - DADO sessão comercial . QUANDO PATCH . ENTAO 403

### GET /api/crm/tenants
- **Auth:** requireCrmGestor; escopo depende do papel (owner vê TODOS os tenants; gestor só o próprio)
- **Proposito:** Lista escritórios (hub_tenants: id, slug, nome_exibicao, ativo) ordenados por nome, com currentTenantId.
- **Regras:** Se role não é owner (isCrmOwnerRole), força .eq('id', tenantId da sessão). Erro → 500. Config → 503.
- **Casos de teste:**
  - **Owner vê todos** - DADO owner autenticado, 3 tenants no banco . QUANDO GET /api/crm/tenants . ENTAO 200 com os 3 tenants + currentTenantId
  - **Gestor vê só o seu** - DADO gestor do tenant T1, existem T1 e T2 . QUANDO GET . ENTAO 200 com apenas T1
  - **Comercial barrado** - DADO sessão comercial . QUANDO GET . ENTAO 403

### POST /api/crm/tenants
- **Auth:** requireCrmOwner
- **Proposito:** Cria novo escritório (tenant) e opcionalmente convida o admin inicial por e-mail.
- **Regras:** nome_exibicao obrigatório → 400. Slug derivado do nome (ou body.slug) com deduplicação por sufixo -2..-6 (5 tentativas). Insert falhou → 500. Se admin_email: normaliza role (default gestor) e convida via convidarColaboradorCrm; convite falhou → 502 'Empresa criada, mas convite falhou' (tenant já criado). Sucesso → 201 {data:tenant, invitedAdmin}.
- **Casos de teste:**
  - **Criar tenant com admin** - DADO owner autenticado . QUANDO POST {nome_exibicao:'Nova Obra', admin_email:'a@b.com'} . ENTAO 201 com tenant ativo, slug 'nova-obra' e invitedAdmin preenchido
  - **Sem nome** - DADO owner . QUANDO POST {} . ENTAO 400 'Nome da empresa é obrigatório.'
  - **Slug duplicado** - DADO já existe tenant slug 'nova-obra' . QUANDO POST {nome_exibicao:'Nova Obra'} . ENTAO 201 com slug 'nova-obra-2'
  - **Gestor barrado** - DADO sessão gestor . QUANDO POST válido . ENTAO 403

### PATCH /api/crm/tenants/[id]
- **Auth:** requireCrmOwner
- **Proposito:** Ativa/desativa um escritório (flag `ativo`, reversível) e/ou renomeia (nome_exibicao).
- **Regras:** id ausente → 400. Aceita apenas ativo:boolean e nome_exibicao:string não-vazia; patch vazio → 400 'Nada para atualizar.'. Update .eq('id') SEM filtro adicional de tenant (owner opera cross-tenant). Erro → 500. Obs.: id inexistente resulta em 500 (single() falha), não 404.
- **Casos de teste:**
  - **Desativar tenant** - DADO owner e tenant T2 ativo . QUANDO PATCH /api/crm/tenants/T2 {ativo:false} . ENTAO 200 com data.ativo=false
  - **Nada para atualizar** - DADO owner . QUANDO PATCH {foo:'bar'} . ENTAO 400 'Nada para atualizar.'
  - **Não-owner** - DADO sessão gestor . QUANDO PATCH {ativo:false} . ENTAO 403

### GET /api/crm/usuarios
- **Auth:** requireCrmGestor
- **Proposito:** Lista a equipe (public.users) do tenant da sessão, com nome de empresa resolvido.
- **Regras:** Erros de schema desatualizado (mensagem contendo criado_em/tenant_id) → 503 orientando migração users_rbac_tenant. Outro erro → 500. Resposta {data, tenantId}.
- **Casos de teste:**
  - **Listar equipe** - DADO gestor no tenant T com 3 usuários . QUANDO GET /api/crm/usuarios . ENTAO 200 com data dos usuários do tenant T e tenantId=T
  - **Comercial barrado** - DADO sessão comercial . QUANDO GET . ENTAO 403
  - **Schema desatualizado** - DADO banco sem coluna tenant_id em users . QUANDO GET . ENTAO 503 com mensagem de migração

### POST /api/crm/usuarios
- **Auth:** requireCrmGestor; convidar em OUTRO tenant (body.tenant_id) é owner-only
- **Proposito:** Convida colaborador (cria user + convite) no tenant da sessão ou, para owners, em outro tenant.
- **Regras:** email obrigatório (lowercase) → 400. role obrigatório e válido via normalizeEquipaRole → 400. body.tenant_id + caller não-owner → 403 'Apenas owners podem convidar noutra empresa.'. resolveInviteTenantId inválido → 400. Owner convidando em tenant_id inexistente → 404. Falha do convite → status do helper. Sucesso → 201 {data, invited:true}.
- **Casos de teste:**
  - **Convite no próprio tenant** - DADO gestor do tenant T . QUANDO POST {email:'novo@x.com', role:'comercial'} . ENTAO 201 com invited:true e usuário no tenant T
  - **Gestor tenta outro tenant** - DADO gestor do T1 . QUANDO POST {email, role, tenant_id:T2} . ENTAO 403
  - **Role inválida** - DADO gestor . QUANDO POST {email:'a@b.com', role:'superadmin'} . ENTAO 400 'Permissão inválida.'

### PATCH /api/crm/usuarios/[id]
- **Auth:** requireCrmGestor + permissões granulares (crmPodeAlterarStatusUtilizador / crmPodeEditarPapelUtilizador / crmPodeAtribuirRole)
- **Proposito:** Edita um usuário da equipe: name, status (Ativo/Inativo) e role — com salvaguardas de owner.
- **Regras:** id deve ser UUID → 400. Usuário não encontrado → 404. Usuário de outro tenant → 403. status fora de {Ativo,Inativo} → 400. Sem permissão para status/papel/atribuição → 403. Owners fixos da plataforma (Ramon/Nice/Ariane) têm papel imutável → 403 e não podem ser desativados → 409. Rebaixar/desativar o ÚLTIMO owner (ativo) do tenant → 409. Nenhum campo → 400. Fallback para schemas sem tenant_id/atualizado_em (usa updated_at). Update escopado por tenant quando a coluna existe.
- **Casos de teste:**
  - **Alterar papel** - DADO gestor do tenant T e usuário comercial do T . QUANDO PATCH /api/crm/usuarios/<id> {role:'atendente'} . ENTAO 200 com role atualizado
  - **Último owner protegido** - DADO tenant com um único owner . QUANDO PATCH desse owner {role:'gestor'} . ENTAO 409 'Não é possível remover o último owner da equipa.'
  - **Usuário de outro tenant** - DADO gestor do T1 e id de usuário do T2 . QUANDO PATCH {name:'x'} . ENTAO 403 'Utilizador de outra empresa.'
  - **ID malformado** - DADO gestor . QUANDO PATCH /api/crm/usuarios/abc {name:'x'} . ENTAO 400 'ID inválido'

### GET /api/crm/pipelines
- **Auth:** requireCrmSessao
- **Proposito:** Lista pipelines ativos por tipo (lead|negocio, default lead) e opcionalmente por mercado, com estágios ordenados e cores de marca harmonizadas para etapas de sistema.
- **Regras:** Escopo tenant + legado NULL via tenantScopeOrFilter (service_role bypassa RLS — o filtro é a proteção). mercado adiciona .or(mercado_sigla.eq.X, is.null). Tabela inexistente OU zero resultados → fallback com pipeline 'global' sintético de ESTAGIOS_PADRAO. Cores de etapas-padrão sobrescritas pela cor de marca; customizadas mantêm a do usuário. Erro → 500; config → 503.
- **Casos de teste:**
  - **Pipelines de lead do tenant** - DADO tenant T com pipeline ativo tipo lead . QUANDO GET /api/crm/pipelines?tipo=lead . ENTAO 200 com pipeline do T e estágios ordenados por ordem
  - **Fallback sem pipelines** - DADO tenant sem nenhum pipeline do tipo pedido . QUANDO GET ?tipo=negocio . ENTAO 200 com pipeline id='fallback' e ESTAGIOS_PADRAO
  - **Sem sessão** - DADO request anônima . QUANDO GET . ENTAO 401/403

### POST /api/crm/pipelines
- **Auth:** requireCrmGestor
- **Proposito:** Cria pipeline do tenant com slug único (base + timestamp base36) e semeia os estágios padrão (ESTAGIOS_PADRAO, sistema=true).
- **Regras:** JSON inválido → 400. nome obrigatório → 400. tipo default 'lead'; mercado_sigla opcional. tenant_id da sessão. Insert do pipeline falhou → 500. Estágios inseridos em seguida (erro do insert de estágios NÃO é checado). Sucesso → 201 {data:pipeline}.
- **Casos de teste:**
  - **Criar pipeline** - DADO gestor do tenant T . QUANDO POST {nome:'Vendas SP', tipo:'negocio'} . ENTAO 201 com pipeline do tenant T e estágios padrão criados
  - **Sem nome** - DADO gestor . QUANDO POST {tipo:'lead'} . ENTAO 400 'Nome é obrigatório'
  - **Comercial barrado** - DADO sessão comercial . QUANDO POST válido . ENTAO 403

### POST /api/crm/pipelines/[id]/estagios
- **Auth:** requireCrmGestor + prova de posse do pipeline (assertPipelineDoTenant; pipeline de outro tenant → 404, null-safe p/ legado)
- **Proposito:** Adiciona estágio customizado (sistema=false) ao pipeline, com slug normalizado e ordem no fim por default.
- **Regras:** JSON inválido → 400. slug normalizado ([a-z0-9_], mín. 2 chars) → 400 se inválido. label default = slug; cor default #6B7280; tipo_fecho default 'aberto'; ordem default = count atual de estágios. Erro insert → 500. Sucesso → 201.
- **Casos de teste:**
  - **Criar estágio custom** - DADO gestor e pipeline do próprio tenant com 5 estágios . QUANDO POST {slug:'Visita Técnica'} . ENTAO 201 com slug 'visita_t_cnica'-normalizado, ordem 5 e sistema=false
  - **Pipeline de outro tenant** - DADO gestor do T1 e pipeline do T2 . QUANDO POST {slug:'x1'} . ENTAO 404 'Pipeline não encontrado' (não revela existência)
  - **Slug curto** - DADO gestor e pipeline próprio . QUANDO POST {slug:'a'} . ENTAO 400 'slug inválido'

### PATCH /api/crm/pipelines/[id]/estagios
- **Auth:** requireCrmGestor + assertPipelineDoTenant (404 se de outro tenant)
- **Proposito:** Edita um estágio do pipeline identificado por slug no body: ativo, label, cor, ordem (+ atualizado_em).
- **Regras:** JSON inválido → 400. slug obrigatório no body → 400. Update por pipeline_id+slug; estágio inexistente → 404 'Estágio não encontrado'. Erro → 500.
- **Casos de teste:**
  - **Renomear estágio** - DADO gestor, pipeline próprio com estágio 'novo' . QUANDO PATCH {slug:'novo', label:'Entrada', cor:'#00AA55'} . ENTAO 200 com estágio atualizado
  - **Slug inexistente** - DADO pipeline próprio . QUANDO PATCH {slug:'nao_existe', ativo:false} . ENTAO 404 'Estágio não encontrado'
  - **Pipeline de outro tenant** - DADO gestor do T1, pipeline do T2 . QUANDO PATCH {slug:'novo'} . ENTAO 404 'Pipeline não encontrado'

### GET /api/health
- **Auth:** requireCrmOwner (decisão G-D1: revela QUAIS env vars/segredos existem — nomes, não valores — logo owner-only)
- **Proposito:** Health check da plataforma via buildHealthResponse: status geral e lista de env vars obrigatórias faltantes.
- **Regras:** Único comportamento: guard owner e retorno do buildHealthResponse(). Não-owner recebe erro do guard (a UI de Configurações trata o 401/403 sem quebrar).
- **Casos de teste:**
  - **Health para owner** - DADO sessão owner com env completa . QUANDO GET /api/health . ENTAO 200 com status 'ok' e missingRequired vazio
  - **Anônimo barrado** - DADO request sem sessão . QUANDO GET /api/health . ENTAO 401 — nomes de env não vazam
  - **Gestor barrado** - DADO sessão gestor . QUANDO GET /api/health . ENTAO 403 (owner-only)

### GET /api/windsor/campanhas
- **Auth:** requireCrmOwner (conta Windsor é única/global da rede — dado do administrador; credencial-por-tenant é feature futura)
- **Proposito:** Proxy para Windsor.ai (connectors.windsor.ai/facebook): métricas de campanhas Meta (campaign, spend, clicks, impressions, cpc, ctr, conversions) do período.
- **Regras:** `periodo` ∈ {7d,14d,30d}, default seguro 7 (valor desconhecido → 7). Sem WINDSOR_API_KEY → 200 [] (não erro). Fetch com revalidate 6h. Resposta upstream não-ok ou exceção → 200 [] (fail-soft, nunca 500).
- **Casos de teste:**
  - **Campanhas do período** - DADO owner e WINDSOR_API_KEY válida . QUANDO GET /api/windsor/campanhas?periodo=30d . ENTAO 200 com array de campanhas dos últimos 30 dias
  - **Sem chave configurada** - DADO owner e WINDSOR_API_KEY ausente . QUANDO GET . ENTAO 200 [] (fail-soft)
  - **Não-owner barrado** - DADO sessão gestor . QUANDO GET . ENTAO 403


