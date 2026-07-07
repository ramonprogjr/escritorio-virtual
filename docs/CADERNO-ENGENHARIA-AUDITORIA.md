# CADERNO DE ENGENHARIA — Obra10+ / Auditoria técnica + especificação de implementação

> **Insumo do dono (07/jul/2026).** Auditoria de engenharia em fichas de trabalho (WI), ancorada em código real.
> **Incorporado aos 5 documentos vivos:** é a espinha do **04 — Roadmap & Plano**; os invariantes (Seção 16) e as
> WIs de schema/RLS/RPC entram no **03 — Arquitetura, Dados & Segurança**; a precisão das fases atualiza o **00 — Painel**.
> Preservado aqui na íntegra (histórico/fonte).

**Para:** time de desenvolvimento (Ramon + devs).
**Natureza:** este NÃO é um laudo executivo. É o backlog técnico da auditoria, em fichas de trabalho (WI = Work Item) que um dev abre e executa. Cada ficha é ancorada em artefato real (arquivo:linha, tabela, migração, RPC) extraído do recon.
**Base:** documento-mãe + anexos de recon (código lido em `C:\Users\wende\Documents\escritorio-virtual-ramon`).
**Convenção de estado:** [C] construído no runtime · [C-DORMENTE] código/migração pronta mas file-only ou atrás de flag · [D] desenhado, sem código · [BUG] defeito verificado.

---

## 0. COMO USAR ESTE CADERNO

Cada ficha tem:
- **Estado atual** — o que existe hoje, com âncora (arquivo/tabela/migração).
- **Defeito / lacuna** — o que está errado ou faltando, verificável.
- **Implementação (COMO)** — o caminho técnico concreto (schema, RPC, guard, endpoint, UI). Onde proponho schema novo, está marcado `[PROPOSTO]`.
- **Arquivos a tocar** — ponto de partida.
- **Aceite** — critério binário, testável (vitest / teste de integração / assert SQL).
- **Depende de** — outras WIs.
- **Fase / Esforço** — Fase 0–8; esforço P (<1d) / M (1–3d) / G (1–2 sem) / GG (>2 sem), na capacidade atual.

**Gates de qualidade (valem para TODA WI):** `tsc` limpo + `vitest` verde antes de merge; migração aditiva e reversível; nada de `push`/secret sem ordem do dono; migração em produção só na **janela do dono**; screenshot antes/depois em mudança de UI. **Quando memória e código divergem, o código é a verdade.**

**Princípio de ordenação:** irreversível primeiro (RAS-01), depois ligar o represado (Fase 2), depois operar sem planilha (Fase 3), depois cobrar (Fase 4), depois endurecer p/ rede (Fase 5). Não pule.

**Ambiente real:** Next.js 16 (App Router; middleware renomeado `proxy.ts`, server-only), Supabase (Postgres + Auth + Storage), deploy Render (web + worker dedicado + cron `*/5min`). `crmDb()` usa `SERVICE_ROLE_KEY` → **bypassa RLS**; logo a barreira primária de isolamento é o filtro `.eq('tenant_id')` no código, não a RLS.

---

# SEÇÃO 1 — FUNDAÇÃO & SCHEMA REPRODUTÍVEL

## FND-01 — Baseline migration (schema reconstruível do zero)
**Estado atual:** o repo `supabase/migrations/*` NÃO reconstrói o banco do zero. Migrações fora de ordem cronológica (datas 2026-07 e 2026-08 misturadas); a linhagem pai/raiz vive em `docs/APLICAR-TIER0-B-schema.sql` (aplicada à mão, fora do versionamento). [BUG estrutural]
**Defeito:** disaster recovery incerto; onboarding de dev impossível; drift schema-de-produção vs. schema-do-repo.
**Implementação (COMO):**
1. `supabase db dump --schema public` do banco de produção (na janela, read-only) → gera o estado real.
2. Criar `supabase/migrations/00000000000000_baseline.sql` com esse dump, marcado como baseline (todas as migrações anteriores viram histórico, não re-executáveis).
3. Reconciliar: tudo que está em `docs/*.sql` file-only e JÁ foi aplicado à mão (linhagem, identidade global) entra na baseline.
4. Documentar em `supabase/README.md` a regra: daqui pra frente, nova migração numerada e reprodutível; nada aplicado à mão sem virar arquivo.
5. Teste de restore: `supabase db reset` em ambiente limpo tem que subir sem erro.
**Arquivos a tocar:** `supabase/migrations/`, `docs/APLICAR-TIER0-B-schema.sql`, `docs/SEED-CONSULADO-V2-2-ecossistema.sql`.
**Aceite:** `supabase db reset` em banco vazio reconstrói o schema inteiro sem erro; `supabase db diff` contra produção retorna vazio.
**Depende de:** aproveitar a mesma janela da Fase 2 (aplicar isto junto com E6/AEC).
**Fase 2 · Esforço G.**

## FND-02 — Centralizar acesso ao banco (matar clients inline)
**Estado atual:** ~82 rotas API criam `createClient`/`db()` inline em vez de reusar `lib/crm/supabase-server.ts`. [BUG de superfície — obs 14122, 05/jul]
**Defeito:** cada rota inline é um ponto onde o filtro de tenant ou o guard pode faltar; superfície de auditoria de isolamento multiplicada por 82.
**Implementação (COMO):**
1. Grep por `createClient(` e `createServerClient(` fora de `lib/crm/supabase-server.ts` e `lib/*/supabase*`.
2. Substituir por `crmDb()` (ou o helper canônico) + `getCallerContext()`.
3. Lint rule (eslint custom ou `no-restricted-imports`) proibindo `@supabase/supabase-js` `createClient` fora da camada de infra.
**Arquivos a tocar:** varrer `app/api/**/route.ts`; `lib/crm/supabase-server.ts`; `.eslintrc`.
**Aceite:** grep retorna zero `createClient` em `app/api/`; regra de lint falha o CI se reintroduzido.
**Depende de:** —
**Fase 3 (contínuo) · Esforço G.**

---

# SEÇÃO 2 — RASTREABILIDADE & LINHAGEM (o irreversível)

## RAS-01 — Linhagem `negocio_pai_id` / `negocio_raiz_id` versionada E escrita pelo app ⚠️ IRREVERSÍVEL
**Estado atual:** o schema (colunas + trigger de raiz) existe em `docs/APLICAR-TIER0-B-schema.sql`, **aplicado à mão, não versionado**, e é **lido** (aba Relacionados) mas **NUNCA escrito por nenhum fluxo do app** — só por seed SQL (o caso Consulado). Confirmado: **7 negócios já entraram sem lead de origem** (MODELO §6/§10). [D no código de escrita; irreversível]
**Defeito:** cada negócio novo nasce com `negocio_pai_id = NULL` e `raiz = ele mesmo`. "De qual venda-de-imóvel nasceu esta obra" vira adivinhação permanente. Perda de dado em curso, todo dia.
**Implementação (COMO):**
1. **Versionar** o schema como migração real: `negocio_pai_id UUID REFERENCES hub_negocios(id) ON DELETE SET NULL`, `negocio_raiz_id UUID`; trigger `BEFORE INSERT OR UPDATE OF negocio_pai_id`:
   - `pai IS NULL` → `raiz = NEW.id`;
   - com pai → `raiz = COALESCE(pai.negocio_raiz_id, pai.id)`;
   - guardas: `pai <> NEW.id` (anti-auto-ref), pai existe, `pai.tenant_id = NEW.tenant_id` (linhagem não cruza tenant);
   - `negocio_pai_id` imutável após definido (RAISE em UPDATE).
   - backfill: `UPDATE hub_negocios SET negocio_raiz_id = id WHERE negocio_raiz_id IS NULL`.
2. **Fazer o app ESCREVER** (a parte que falta de verdade). Pontos de escrita:
   - `app/api/crm/negocios/[id]/converter-obra/route.ts` — se a obra deriva de um projeto que veio de outro negócio, propagar.
   - `app/api/crm/projetos/[id]/gerar-obra/route.ts` — obra herda `negocio_pai_id` do negócio do projeto.
   - `app/api/crm/indicacoes/route.ts` — negócio indicado nasce filho do negócio de origem quando houver.
   - `app/api/crm/negocios/route.ts` (POST) — aceitar `negocio_pai_id` opcional no body (validado por posse de tenant).
3. **UI:** no cadastro de negócio e no painel "gerar entrega", campo Click-and-Go "Originado de" que lista negócios do mesmo cliente (`hub_negocio_vinculos` → pessoa).
**Arquivos a tocar:** nova migração; `app/api/crm/negocios/route.ts`; `.../[id]/converter-obra/route.ts`; `app/api/crm/projetos/[id]/gerar-obra/route.ts`; `app/api/crm/indicacoes/route.ts`; UI de negócio.
**Aceite:** (a) `supabase db reset` cria as colunas+trigger; (b) teste de integração: criar negócio B com `negocio_pai_id=A` → `B.negocio_raiz_id == A.negocio_raiz_id`; (c) tentar `pai` de outro tenant → erro; (d) após deploy, 100% dos negócios novos têm `negocio_raiz_id` não-nulo (query de monitoramento).
**Depende de:** FND-01 (idealmente na mesma baseline).
**Fase 0 · Esforço M.** **PRIORIDADE MÁXIMA — cada dia sem isto é dado perdido.**

## RAS-02 — UNIQUE de código + auto-código no banco
**Estado atual:** código gerado pela app (`lib/crm/codigos-rastreio.ts`, RPC `crm_proximo_codigo`, contador `hub_codigo_contador`). Fallback degradado `PREFIXO-AAAA-####` (COUNT+1) tem corrida. Insert via SQL Editor nasce SEM código. [BUG]
**Defeito:** duas linhas simultâneas podem colidir no fallback; linha inserida fora da app não tem código → some do rastreio.
**Implementação (COMO):**
1. `ALTER TABLE ... ADD CONSTRAINT uq_<t>_tenant_codigo UNIQUE (tenant_id, codigo) NULLS NOT DISTINCT` nas core que faltam (hub_pessoas já tem global unique; aplicar em hub_empresas, hub_negocios, hub_leads_crm, hub_obras, hub_projetos etc.).
2. Trigger `BEFORE INSERT` por tabela: se `codigo IS NULL`, chama `crm_proximo_codigo(entidade, mercado)` no próprio banco (mata o caso "insert por SQL nasce sem código").
3. Contador por-tenant: migrar `hub_codigo_contador` de `(entidade, ano)` para `(tenant_id, entidade, ano)` (decisão de identidade global 02/jul).
**Arquivos a tocar:** nova migração; `lib/crm/codigos-rastreio.ts` (fallback pode ser removido depois do trigger).
**Aceite:** inserir linha via SQL puro sem `codigo` → nasce com código válido; teste de concorrência (2 inserts paralelos) → sem colisão.
**Depende de:** —
**Fase 0 · Esforço M.**

## RAS-03 — `hub_eventos` com identidade do ator
**Estado atual:** `hub_eventos.ator` grava papel (`'humano'`/`'sistema'`), não quem. `lib/crm/registrar-evento.ts`. (Tier 0.5) [D]
**Defeito:** "qual pessoa aprovou/registrou" não volta na trilha — insuficiente para auditoria de dinheiro em rede.
**Implementação (COMO):**
1. `ALTER TABLE hub_eventos ADD COLUMN ator_id UUID, ADD COLUMN ator_codigo TEXT` (aditivo, nullable).
2. `registrarEvento(...)` passa a receber `ctx.userId` / `ctx.pessoaCodigo` e gravar.
3. Chamadas: propagar o `ctx` do `getCallerContext` até o `registrarEvento` (hoje muitas chamam sem ator identificado).
**Arquivos a tocar:** migração; `lib/crm/registrar-evento.ts`; todos os call-sites de `registrarEvento`.
**Aceite:** um evento gerado por ação humana grava `ator_id` = user da sessão; consulta "quem aprovou X" retorna a pessoa.
**Depende de:** —
**Fase 0 · Esforço P–M.**

## RAS-04 — Resolver de rastreio cobre prefixos cunhados
**Estado atual:** a RPC cunha 14 prefixos (PES/EMP/LED/NEG/PAR/IMO + FOR/ESP/OBR/PRJ/SRV/MRC/MMR/VDR), mas `lib/crm/resolver-rastreio-codigo.ts` só resolve os 6 de identidade. Colar `OBR2026001` na busca → **404**. [BUG de simetria]
**Defeito:** obra/projeto/serviço/fornecedor/especialista/produto têm código imutável mas sem "página de destino" no rastreio.
**Implementação (COMO):** adicionar branches em `resolverRastreioCodigo` para OBR→`hub_obras`, PRJ→`hub_projetos`, SRV→`hub_servicos`, MRC/MMR/VDR→tabelas de ofício, FOR→`hub_fornecedores`/`hub_parceiros`, ESP→`hub_especialistas`. Cada branch devolve o registro + `negocio_id` para religar à espinha. Manter `tenantId` obrigatório (segurança já existente).
**Arquivos a tocar:** `lib/crm/resolver-rastreio-codigo.ts`; `app/api/crm/rastreio/route.ts`.
**Aceite:** `GET /api/crm/rastreio?codigo=OBR2026001` (do tenant) retorna a obra + cadeia; código de outro tenant → 404.
**Depende de:** —
**Fase 3 · Esforço M.**

## RAS-05 — Fonte única de mão de obra + alocação obra↔especialista
**Estado atual:** `hub_especialistas` é ilha — sem CPF/dedup, sem tabela de alocação (quem executou qual obra é irrastreável); duplicada com stub `hub_profissionais`. (Tier 0.6) [D]
**Defeito:** se a tese de escassez de mão de obra é aposta estratégica, o histórico "quem executou o quê" é o produto futuro de MDO — e é irrecuperável retroativamente (como a linhagem).
**Implementação (COMO):**
1. Congelar `hub_profissionais` (deixar de escrever; migrar dados p/ `hub_especialistas`).
2. `hub_especialistas`: adicionar `cpf` + `UNIQUE(tenant_id, cpf)` (dedup PII-safe: checagem devolve só `{existe, codigo}`); prefixo de código `MDO-` (decisão do dono 02/jul).
3. `[PROPOSTO]` tabela `hub_obra_alocacoes` (`obra_id`, `especialista_id`, `frente_id`/`item_id`, `papel`, `periodo`, `tenant_id`) — liga execução à pessoa.
4. Superfície mínima na obra para alocar MDO (Click-and-Go a partir de `hub_especialistas`).
**Arquivos a tocar:** migração; `lib/crm/especialidades.ts`; `app/especialista/cadastro`; nova UI de alocação na obra.
**Aceite:** cadastrar 2 especialistas com mesmo CPF → 409; alocar especialista numa frente da obra → consulta "quem executou a obra X" retorna as pessoas.
**Depende de:** obra rodando (Fase 2/3).
**Fase 3 · Esforço G.**

---

# SEÇÃO 3 — MULTI-TENANT & ISOLAMENTO

> **Contexto:** hoje single-tenant (sentinela `00000000-0000-4000-8000-000000000001`). `crmDb()` bypassa RLS. Estas WIs são **GATE ABSOLUTO** antes do 2º tenant (Fase 5). Nenhuma vai para produção "solta" — vão juntas na janela de endurecimento.

## TEN-01 — Backfill `tenant_id NULL` → sentinela + NOT NULL
**Estado atual:** ~36 tabelas `hub_*` com policy `USING (tenant_id = current_user_tenant_id() OR tenant_id IS NULL)` e linhas legadas com `tenant_id NULL`. `20260626130000_multitenant_foundation.sql`. `hub_ia_creditos_mov` tem tenant nullable. [BUG adormecido]
**Defeito:** no 2º tenant, toda linha NULL fica visível/gravável por qualquer um.
**Implementação (COMO):** por tabela privada: `UPDATE ... SET tenant_id = '<sentinela>' WHERE tenant_id IS NULL` → `ALTER ... ALTER COLUMN tenant_id SET NOT NULL`. Fazer inventário das 36 e classificar: privada (backfill+NOT NULL) vs. master-data global (mantém NULL como "vale p/ todos" — poucas: catálogos, disciplinas, presets).
**Arquivos a tocar:** nova migração; usar `docs/AUDITORIA-TENANT-NULL-LEAK-05JUL.md` como checklist.
**Aceite:** `SELECT count(*) FROM <t> WHERE tenant_id IS NULL` = 0 em todas as privadas; coluna NOT NULL.
**Depende de:** RAS-02 (contador por-tenant coerente).
**Fase 5 · Esforço G.**

## TEN-02 — Trocar `OR tenant_id IS NULL` por `.eq` puro
**Estado atual:** helper `tenantScopeOrFilter` (`lib/tenant-default.ts:68`) inclui `tenant_id.is.null`; usado em tabelas privadas por herança de padrão.
**Defeito:** vazamento cross-tenant no 2º tenant (o NULL aparece p/ todos).
**Implementação (COMO):**
1. Nas policies RLS das privadas: remover `OR tenant_id IS NULL`.
2. No código: substituir `tenantScopeOrFilter(tid)` por `tenantScopeExact(tid)` (`.eq` puro, linha 55) em toda leitura de tabela privada. Manter `tenantScopeOrFilter` só em master-data.
3. Regra de lint/PR: `tenantScopeOrFilter` exige comentário justificando "master-data global".
**Arquivos a tocar:** migração de policies; grep por `tenantScopeOrFilter` em `lib/` e `app/api/`.
**Aceite:** com 2 tenants em staging, tenant B não lê nenhuma linha de A por nenhuma rota; teste automatizado de isolamento.
**Depende de:** TEN-01.
**Fase 5 · Esforço G.**

## TEN-03 — Fechar RLS das tabelas abertas
**Estado atual:** `hub_fornecedores` SEM RLS (`20260701120000`); `hub_negocio_vinculos` teve `USING(true)` + GRANT anon (espinha do split!); `hub_pedidos_material` com policy ANON; família `hub_parceiros_*` frágil.
**Defeito:** tabelas críticas (rede e dinheiro) sem isolamento.
**Implementação (COMO):** por tabela: `ENABLE ROW LEVEL SECURITY`; `REVOKE ALL FROM anon, authenticated`; policy tenant-scoped `.eq` (padrão-ouro já usado no motor de comissões `20260706170000`). Especial atenção a `hub_negocio_vinculos` — é pré-condição para aplicar o motor de comissões em produção (ver FIN-01).
**Arquivos a tocar:** migração por tabela.
**Aceite:** `anon` não lê nenhuma dessas tabelas; `service_role` (app) lê só o tenant filtrado no código.
**Depende de:** TEN-01/02.
**Fase 5 (mas `hub_negocio_vinculos` antecipa p/ Fase 2 — ver FIN-01) · Esforço M.**

## TEN-04 — Hierarquia de tenant (`tenant_type` / `parent_tenant_id`)
**Estado atual:** `hub_tenants` não modela hierarquia; colunas não existem. Modelo A (parceiro vira tenant próprio) depende disso. [D]
**Implementação (COMO):** `ALTER TABLE hub_tenants ADD COLUMN tenant_type TEXT CHECK (tenant_type IN ('hub','parceiro')) DEFAULT 'hub', ADD COLUMN parent_tenant_id UUID REFERENCES hub_tenants(id)`. `is_hub_admin()` passa a exigir `tenant_type='hub'` raiz (fecha SEC-05).
**Arquivos a tocar:** migração; `lib/rbac/role-map.ts`; funções RLS que usam `is_hub_admin()`.
**Aceite:** criar tenant parceiro com `parent_tenant_id = Hub`; `is_hub_admin` de um owner de tenant parceiro → false.
**Depende de:** TEN-01/02/03.
**Fase 5 · Esforço M.**

---

# SEÇÃO 4 — RBAC, AUTENTICAÇÃO & GUARDS

## RBAC-01 — `INTERNAL_API_KEY`: rotacionar + tirar do browser
**Estado atual:** segredo estático único; `NEXT_PUBLIC_INTERNAL_API_KEY` mandava a chave interna ao **browser**. `lib/crm/crm-api-auth.ts`. [BUG]
**Defeito:** vazamento personifica qualquer tenant pelo caminho interno.
**Implementação (COMO):**
1. Remover toda referência a `NEXT_PUBLIC_INTERNAL_API_KEY` (grep no client).
2. Rotacionar o segredo (novo valor no Render, não no client).
3. `[PROPOSTO]` reescopar: em vez de uma chave global, token curto assinado por integração/tenant (HMAC com claim de tenant + expiração), validado em `tenantIdFromRequest`.
**Arquivos a tocar:** `lib/tenant-default.ts` (`tenantIdFromRequest:87`), `lib/crm/crm-api-auth.ts`, envs Render, grep `NEXT_PUBLIC_INTERNAL`.
**Aceite:** nenhum bundle do client contém a chave; caminho interno exige token válido; token de tenant A não move dado de B.
**Depende de:** —
**Fase 5 (rotação pode antecipar como hotfix) · Esforço M.**

## RBAC-02 — Chave Hub amarrada à pessoa física (não ao nível `owner`)
**Estado atual:** a Chave Hub do escrow usa `isCrmOwnerRole` genérico. `lib/ia/aprovacoes.ts`. Decisão D7. [BUG p/ modelo A]
**Defeito:** quando um parceiro licenciar e virar `owner` do próprio tenant, ele assinaria a Chave Hub do próprio pagamento (juiz + parte).
**Implementação (COMO):** amarrar `escrow:chave_hub` a uma allowlist de pessoa física do **Hub raiz** (por `pessoa_id`/email do tenant raiz), não ao papel `owner`. `[PROPOSTO]` coluna/config `hub_escrow_key_holders` (tenant raiz + pessoa).
**Arquivos a tocar:** `lib/ia/aprovacoes.ts` (`validarChaveEscrow:327`), `lib/rbac/role-map.ts`.
**Aceite:** owner de tenant parceiro NÃO consegue assinar `pagamento_obra_hub`; só a pessoa do Hub raiz.
**Depende de:** TEN-04.
**Fase 5 · Esforço M.**

## RBAC-03 — `resolveInviteTenantId` restrito ao próprio tenant/filhos
**Estado atual:** owner pode convidar para QUALQUER `tenant_id` UUID. `lib/crm/crm-api-auth.ts`. [BUG]
**Implementação (COMO):** owner só pode indicar o próprio `tenant_id` ou `tenant_id` cujo `parent_tenant_id` seja o seu. Validar contra `hub_tenants`.
**Aceite:** owner de A tentando convidar p/ tenant B → 403.
**Depende de:** TEN-04.
**Fase 5 · Esforço P.**

## RBAC-04 — `CRM_OWNER_EMAILS` hardcoded + arquivar revoga acesso
**Estado atual:** `crm-permissoes.ts:46` tem `ramonexercito`, `nice.engemp`, `ariane.ot` hardcoded (dual-source com `users.role`, em drift). `getCallerContext` só barra `status != 'ativo'` — arquivar usuário sem setar status mantém acesso. [BUG]
**Implementação (COMO):**
1. Remover allowlist hardcoded; owner vem só de `users.role` (D8: owner = Wendel/obradezmais; Ramon→admin; Ariane→commercial). Migração de dados.
2. Arquivar usuário passa a setar `status != 'ativo'` (não só `arquivado_em`).
**Arquivos a tocar:** `lib/crm/crm-permissoes.ts`, `lib/crm/crm-api-auth.ts`, migração de `users.role`.
**Aceite:** remover email da allowlist não muda mais permissão (é `users.role`); usuário arquivado → 401 na próxima request.
**Depende de:** —
**Fase 5 · Esforço P–M.**

## RBAC-05 — Guard de papel nas ~32 rotas service-role
**Estado atual:** ~32 rotas usam `crmDb()` (service_role) sem guard de papel fino; proxy libera qualquer sessão logada. [BUG]
**Defeito:** um atendente pode atingir DELETE/PATCH em valor/comissão em rotas mal-guardadas.
**Implementação (COMO):** inventariar as rotas de valor/comissão/escrow; aplicar `requireCrmFinanceiro`/`requireCrmAprovador`/`requireCrmGestor` conforme a ação. Teste por rota: sessão de atendente → 403.
**Arquivos a tocar:** `app/api/crm/**/route.ts` (financeiro, negócios, comissões, aprovações), guards de `crm-api-auth.ts`.
**Aceite:** matriz de teste papel×rota: atendente barrado em toda rota de dinheiro.
**Depende de:** FND-02 (centralização ajuda).
**Fase 5 · Esforço G.**

> Nota: o bypass de cookie forjável (JWT `sub` decodificado localmente) **já foi corrigido** em 05/jul (`resolveCallerAuthId:40` valida contra `/auth/v1/user`). Não é WI aberto — é regressão a proteger com teste (adicionar teste que rejeita cookie com assinatura inválida).

---

# SEÇÃO 5 — MOTOR DE LEADS & DISTRIBUIÇÃO

## LEAD-01 — SLA com relógio + cron de redistribuição
**Estado atual:** SLA (15min/24h/48h) é conceito; não há `ts_oferta`/`ts_resposta` nem cron. Cascata só dispara por recusa explícita. `lib/crm/distribuir-lead.ts`, `hub_encaminhamentos`. [D]
**Defeito:** o flywheel de mérito pune só pendência financeira, não desempenho; lead parado não redistribui.
**Implementação (COMO):**
1. `ALTER TABLE hub_encaminhamentos ADD COLUMN ts_oferta TIMESTAMPTZ, ADD COLUMN ts_resposta TIMESTAMPTZ, ADD COLUMN sla_status TEXT`.
2. `enviarLeadAoParceiro` grava `ts_oferta`.
3. Cron (Render `*/5min`, novo endpoint `app/api/cron/sla-encaminhamentos`) varre `enviado` sem `ts_resposta` além do limite → dispara a MESMA cascata da recusa (`app/api/crm/encaminhamentos/[id]/recusar` lógica reusada) + evento `lead_sla_estourado`.
4. Penalidade de mérito persistida: decremento consumível pelo `scoreParceiro` (nova coluna `hub_parceiros.penalidade_sla` ou métrica derivada de eventos).
**Arquivos a tocar:** migração; `lib/crm/notificar-parceiro-lead.ts`; `app/api/crm/encaminhamentos/[id]/recusar/route.ts` (extrair a lógica de cascata p/ lib reusável); novo cron; `lib/crm/distribuir-lead.ts` (score).
**Aceite:** lead enviado e não respondido em N min → redistribuído automaticamente pelo cron; parceiro que estoura SLA perde pontos no próximo score.
**Depende de:** —
**Fase 3 · Esforço G.**

## LEAD-02 — Consolidar vocabulário de estágio (risco do loop P0)
**Estado atual:** dois vocabulários coexistem; `legacyToFunil()` colapsa `"qualificado"`→`"qualificando"` (`lib/crm/estagio-map.ts`); a fila filtra literal `"qualificado"`, o `sugerir` valida `legacyToFunil(...)==='qualificando'` (`sugerir-encaminhamento-auto.ts:59-67`). Já causou loop P0. [BUG latente]
**Defeito:** qualquer edição que volte a comparar contra o literal reabre o loop; frágil por design.
**Implementação (COMO):** normalizar num único ponto: toda leitura de estágio passa por `legacyToFunil` ANTES de comparar; nunca comparar slug cru. Adicionar teste que trava a regressão (um lead legado `"qualificado"` tem que aparecer na fila E passar o gate do `sugerir`). Documentar o mapa canônico.
**Arquivos a tocar:** `lib/crm/estagio-map.ts`, `lib/crm/pipelines.ts`, `app/api/crm/distribuicao/fila/route.ts`, `lib/crm/sugerir-encaminhamento-auto.ts`.
**Aceite:** teste: lead com `estagio='qualificado'` aparece na fila e é elegível a encaminhamento; nenhum caminho compara slug literal.
**Depende de:** —
**Fase 3 · Esforço M.** (Fazer ANTES de EST-01, que multiplica funis.)

## LEAD-03 — Paginação/pré-filtro no motor (teto de 100)
**Estado atual:** `distribuir-lead.ts` lê candidatos com `.limit(100)`; inconsistência entre `STATUS_HOMOLOGADO` do score `{homologado,ativo,aprovado}` e o `.eq("status","homologado")` estrito da query. [dívida futura]
**Defeito:** em rede densa por mercado/tenant, trunca candidatos legítimos antes do score; `ativo`/`aprovado` são inalcançáveis hoje.
**Implementação (COMO):** pré-filtrar por região/mercado no SQL (reduz o conjunto antes do score em JS); alinhar o filtro de status (decidir: só `homologado` ou os três — e refletir na query). Baixa urgência com base pequena; obrigatório antes de volume.
**Arquivos a tocar:** `lib/crm/distribuir-lead.ts`.
**Aceite:** com >100 parceiros elegíveis num mercado, o top-5 é estável e correto.
**Depende de:** —
**Fase 6 · Esforço M.**

---

# SEÇÃO 6 — ESTEIRA DE ENTREGA & NEGÓCIOS

## EST-01 — Funis próprios por mercado
**Estado atual:** o seed `20260620183000_hub_pipelines_seed_mercados.sql` instala os MESMOS 8 estágios genéricos (`novo→qualificando→...→ganho/perdido`) para os 8 mercados. A arquitetura suporta estágios próprios via `hub_pipeline_estagios.tipo_fecho` (`aberto/ganho/perdido`) + `PipelineConfigSideover`, e `negocio-fecho.ts` já sabe fechar com slugs distintos (`obra_criada`, `servico_fechado`...). [C a espinha; D os estágios próprios]
**Defeito:** serviço (fecha em horas) e obra (fecha em meses) usam a mesma régua de 8 estágios — mente sobre ambos.
**Implementação (COMO):** é **configuração**, não re-arquitetura. Para cada mercado, editar `hub_pipeline_estagios` (via `PipelineConfigSideover` ou seed próprio) instalando os estágios reais, cada um com o `tipo_fecho` correto:
- IMB: `Novo→Captação→Visita agendada→Visita realizada→Proposta→Negociação→Fechamento(ganho)`;
- SRV enxuto: `Novo→Orçamento→Agendado→Em execução→Concluído(ganho)`;
- ENG: `Novo→Visita técnica→Orçamento/EAP→Proposta→Negociação→Contrato→Obra criada(ganho)`.
O `tipo_fecho` garante que os KPIs de dinheiro não quebram com o vocabulário novo.
**Arquivos a tocar:** seed/migração de estágios por mercado; `PipelineConfigSideover`. **Fazer LEAD-02 antes.**
**Aceite:** cada mercado mostra seus estágios; um "ganho" em `obra_criada` continua contando nos KPIs de dinheiro (teste do `tipoFechoDaEtapa`).
**Depende de:** LEAD-02.
**Fase 3 · Esforço M.**

## EST-02 — Entrega correta de IMB / FOR / PRO
**Estado atual:** `derivar-negocio.ts:32-38` — IMB, PRO e FOR caem no default → `hub_obras`. MMR/VDR têm entrega mas não estão em `MERCADOS_PREFIXO` (`negocio-cadastro.ts:5`). [BUG semântico]
**Defeito:** vender imóvel "cria uma obra"; homologar fornecedor "cria uma obra". Polui KPI e dado.
**Implementação (COMO) + DECISÃO do dono:**
- IMB ganho = negócio terminal + registro leve de fechamento. `[PROPOSTO]` `hub_fechamentos_imobiliarios` (ou flag `negocio.fechamento_tipo`) — NUNCA `hub_obras`.
- FOR ganho = atualização de status em `hub_parceiros`/`hub_fornecedores` (homologado), sem entrega.
- PRO = pedido em E5 (`hub_pedido_itens`), não obra.
- MMR/VDR: decidir 1ª classe vs. subtipo. Recomendação: subtipo por ora (menos funis) — adicionar em `MERCADOS_PREFIXO` só quando houver volume.
**Arquivos a tocar:** `lib/crm/derivar-negocio.ts` (`ENTREGA_POR_MERCADO`, `resolverEntrega`); `negocio-cadastro.ts`; nova migração se `hub_fechamentos_imobiliarios`.
**Aceite:** ganhar negócio IMB não cria linha em `hub_obras`; ganhar FOR atualiza status do parceiro.
**Depende de:** DECISÃO #7/#8 (lista mestra do laudo).
**Fase 3 · Esforço M.**

## EST-03 — Blindar CHECK de `hub_atividades` (quebra silenciosa)
**Estado atual:** `derivarEntregaDoNegocio` grava atividade `tipo='status_change'`; os CHECK de `hub_atividades.tipo`/`feito_por_tipo` quebram o insert **silenciosamente** se o valor sai do enum. [BUG recorrente]
**Defeito:** extensão de vocabulário de atividade quebra a esteira sem alarme.
**Implementação (COMO):**
1. Regra de processo: estender o CHECK junto com qualquer novo tipo (documentar).
2. Teste de esteira no CI que exercita `derivarEntregaDoNegocio` para os 6 mercados e falha se o insert de atividade der erro.
3. `[opcional]` trocar o insert best-effort por um que loga o erro em vez de engolir.
**Arquivos a tocar:** `lib/crm/derivar-entrega.ts`; testes.
**Aceite:** teste cobre os 6 mercados; adicionar tipo fora do CHECK falha o CI (não a produção).
**Depende de:** —
**Fase 3 · Esforço P.**

> Nota: o "spawn mágico" (auto-criar entrega no ganho) **já foi revertido** para gate humano (`negocios/[id]/route.ts:295-299`, decisão 02/jul). A memória `distribuicao-leads-motor.md:40` ("disparo AUTOMÁTICO") está desatualizada — não seguir. Não é WI; é regra a preservar.

---

# SEÇÃO 7 — OBRA / EAP / ESCOPO / MEDIÇÃO

> **Estado macro:** código em `lib/obras/*` pronto e rodando em fallback; migrações E0–E7/A0–A1 são **file-only** (não aplicadas em prod). A aplicação é a Fase 2 (janela).

## OBR-01 — Aplicar camada AEC (E0–E7, A0–A1) na janela
**Estado atual:** `20260705130000_e0...`, `20260711120000_e0b`, `20260710120000_e2`, `20260712120000_e3`, `20260720120000_e5`, `20260815120000_e7`, `20260816120000_e7b`, `20260705140000_a0`, `20260705150000_a1` — todas file-only. Código espelho: `lib/obras/escopo.ts`, `criar-obra-com-eap.ts`, `taxonomia.ts`, `eap-presets.ts`. [C-DORMENTE]
**Defeito:** obra real roda em fallback degradado (`isMissingPgColumn` → `migracao_pendente`); medição com evidência, EAP persistida e views de margem/peso não existem no banco.
**Implementação (COMO):** aplicar as migrações JUNTAS na janela do dono, na ordem E0→E0b→E2→E3→E5→E7→E7b→A0→A1. Ensaiar em staging antes. Validar contra a obra real corrente (Consulado): EAP semeada, itens por ambiente, `custo_total` GENERATED batendo com o espelho `escopo.ts`.
**⚠️ Armadilha Postgres a preservar:** `custo_total` NÃO pode virar `custo_unitario * quantidade` (Postgres não encadeia GENERATED STORED) — mantém a soma inline `(loc+mat+mo)*qtd`, como está em E7 e no espelho `escopo.ts:98-112`.
**Arquivos a tocar:** aplicar migrações; validar `lib/obras/*`.
**Aceite:** obra real ganha EAP + itens + views (`vw_hub_obra_item_margem`, `vw_hub_obra_item_peso`, `vw_hub_obra_itens_situacao`) sem `migracao_pendente`; `custo_total` do banco == cálculo do espelho.
**Depende de:** FND-01 (baseline), FIN-02 (E6 vai junto).
**Fase 2 · Esforço G.**

## OBR-02 — Medição append-only atômica
**Estado atual:** `app/api/crm/obras/[id]/medicoes/route.ts` (E7c) — se o insert append-only falha após avançar o item, reverte o pct com guarda otimista; sem E7c grava só o avanço e avisa. Atomicidade real exige RPC transacional. [C-DORMENTE parcial]
**Defeito:** avanço e medição não são atômicos; sob concorrência pode divergir.
**Implementação (COMO):** RPC `rpc_registrar_medicao(obra_id, item_id, qtd, evidencia, criado_por)` que numa transação: insere medição imutável + atualiza `pct_avanco` (via `derivarPctAvanco`) + grava evento. Endpoint passa a chamar a RPC.
**Arquivos a tocar:** nova RPC; `app/api/crm/obras/[id]/medicoes/route.ts`.
**Aceite:** falha no meio → rollback total (nem avanço nem medição gravam); teste de concorrência sem divergência.
**Depende de:** OBR-01.
**Fase 2 · Esforço M.**

---

# SEÇÃO 8 — FINANCEIRO: COMISSÕES & ESCROW

## FIN-01 — Aplicar motor de comissões em produção
**Estado atual:** 4 tabelas + 3 RPCs construídas e **testadas via MCP** (`20260706170000_financeiro_rede_comissoes_fundacao.sql` + `...171000/172000/173000`), em overlay. As migrações do motor estão represadas porque a espinha `hub_negocio_vinculos` tinha RLS aberta. [C testado, não em prod]
**Defeito:** o dinheiro da rede não é rastreado em produção; take blended = zero na tela.
**Implementação (COMO):**
1. **Pré-condição:** TEN-03 sobre `hub_negocio_vinculos` (fechar `USING(true)` + GRANT anon) — antecipar este item para a Fase 2.
2. Aplicar as migrações do motor na janela.
3. Operar os 5 estados nos negócios reais: PREVISTA→APURADA (`rpc_apurar_comissoes`, humano confirma as fatias em jsonb; fail-closed se `valor_fechado` NULL)→EXIGÍVEL (`rpc_registrar_recebimento_negocio`, cash-basis pro-rata)→APROVADA (`rpc_liberar_pagamento_comissao`, dupla chave)→PAGA (baixa manual).
**Arquivos a tocar:** aplicar migrações; `app/api/crm/negocios/[id]/financeiro-rede/route.ts`; `app/api/crm/financeiro-rede/route.ts`.
**Aceite:** um negócio real fechado gera POTE = `valor_fechado × percentual_comissao`; split apurado com residual explícito ao Hub; soma das fatias ≤ pote (teste da RPC já existe — replicar em prod).
**Depende de:** TEN-03 (parcial, só a espinha), FND-01.
**Fase 2 · Esforço M.**

## FIN-02 — Corrigir bugs do escrow ANTES de aplicar E6
**Estado atual:** `20260730120000_e6_financeiro_contrato_escrow.sql` marcada "⚠️ NÃO aplicar". BUG: `rpc_liberar_escrow` usa `GREATEST(0, saldo_custodia - v_valor)` (mascara saldo negativo = "custódia fantasma") + falta `FOR UPDATE`. [BUG crítico — dinheiro de terceiros]
**Defeito:** liberar mais que o saldo não falha, some; concorrência sem lock.
**Implementação (COMO):**
1. Trocar `GREATEST(0, saldo - v)` por checagem que **falha** (`RAISE EXCEPTION` se `saldo < v_valor`).
2. Adicionar `SELECT ... FOR UPDATE` na conta de custódia dentro da transação.
3. Só então aplicar E6 (com OBR-01, mesma janela).
4. Validar com um pagamento real da obra corrente pela dupla chave (`escrow:chave_tecnica` engenharia + `escrow:chave_hub` dono).
**Arquivos a tocar:** `20260730120000_e6_...sql` (corrigir a RPC antes de aplicar); `lib/ia/aprovacoes.ts`; `lib/obras/financeiro.ts`.
**Aceite:** liberar valor > saldo → exceção (não custódia fantasma); 2 liberações concorrentes → serializadas; um pagamento real percorre bloqueado→liberado→autorizado→pago com as 2 chaves de humanos distintos.
**Depende de:** OBR-01, RBAC-02 (idealmente, mas RBAC-02 é Fase 5 — para o tenant zero a Chave Hub = dono está OK; RBAC-02 é gate só para o modelo A).
**Fase 2 · Esforço M.** **Fecha a constatação C2 (dinheiro de terceiros em camada dormente).**

## FIN-03 — Guard de UI para `valor_fechado` NULL no ganho
**Estado atual:** `rpc_apurar_comissoes` recusa honesto (`erro:'sem_valor_fechado'`), mas a UI não avisa antes. [BUG de UX financeira]
**Defeito:** negócio ganho sem valor → comissão "some em silêncio" para o operador.
**Implementação (COMO):** na ficha do negócio, ao marcar ganho/gerar entrega, se `valor_fechado` é NULL/≤0, bloquear com banner "Defina o valor fechado antes de apurar comissão". Validação no cliente + no endpoint.
**Arquivos a tocar:** `app/crm/negocios/[id]/page.tsx` (`NegocioFinanceiroRedeSection`), endpoint de ganho.
**Aceite:** ganhar sem valor mostra aviso; não deixa apurar até preencher.
**Depende de:** —
**Fase 0 · Esforço P.**

---

# SEÇÃO 9 — METERING / TIJOLOS / CARTEIRA / BILLING

## MET-01 — Fix do markup 0/negativo (IA de graça)
**Estado atual:** `app/api/crm/ia/config/route.ts:41-43` valida só `Number.isFinite(Number(body.markup))` — **aceita markup 0/negativo**. Sem CHECK no banco. [BUG — furo direto na margem]
**Implementação (COMO):**
1. No PUT: `if (!(markup >= 1)) return 400`.
2. No banco: `ALTER TABLE hub_ia_config ADD CONSTRAINT chk_markup CHECK (markup >= 1)`.
**Arquivos a tocar:** `app/api/crm/ia/config/route.ts`; migração.
**Aceite:** PUT com markup 0 ou -1 → 400; INSERT/UPDATE no banco com markup <1 → erro.
**Depende de:** —
**Fase 0 · Esforço P.** **Fazer antes de ligar a IA (Fase 1).**

## MET-02 — Consumo de IA atômico (SEC-8)
**Estado atual:** `registrarConsumoIA` faz 2 inserts (`hub_ia_consumo` + `hub_ia_creditos_mov`) **sem transação**; `saldoCreditos` soma O(n) em JS. `lib/ia/metering.ts`. [BUG]
**Defeito:** sob concorrência, consumo e débito podem divergir; saldo não-atômico.
**Implementação (COMO):** RPC `rpc_registrar_consumo_ia(...)` que faz os 2 inserts + retorna saldo numa transação. `saldoCreditos` vira `SELECT SUM(creditos)` no banco (ou coluna materializada com trigger).
**Arquivos a tocar:** nova RPC; `lib/ia/metering.ts`.
**Aceite:** falha no meio → rollback; teste de concorrência (N débitos paralelos) → saldo correto.
**Depende de:** —
**Fase 4 · Esforço M.**

## MET-03 — Carteira fase 1 + top-up PIX
**Estado atual:** Tijolo já é `hub_ia_creditos_mov` (`20260626210000_ia_metering.sql`); a "carteira ampla" = promover esse ledger. Colunas novas e `hub_carteira_topups` só em docs. [D]
**Implementação (COMO):**
1. `ALTER hub_ia_creditos_mov ADD COLUMN origem TEXT, ref_tipo TEXT, valor_brl NUMERIC(14,2), idempotency_key TEXT UNIQUE, estorna_mov_id UUID, criado_por UUID`; trigger de imutabilidade; backfill + `SET NOT NULL` de `tenant_id` (hoje nullable).
2. `[PROPOSTO]` `hub_carteira_topups` (estados `aguardando→pago→creditado`/`expirado`/`divergente`/`arquivado`). Tijolo só nasce em `status→pago` via RPC idempotente com 3 cadeados (idempotência de evento + UNIQUE 1 crédito/topup + `FOR UPDATE`).
3. Top-up PIX manual (fase 1): admin confirma pagamento → RPC credita.
**Arquivos a tocar:** migração; `lib/ia/metering.ts`; novo endpoint de top-up; UI `/crm/creditos`.
**Aceite:** confirmar top-up 2× com mesma `idempotency_key` credita 1 vez; Tijolo nasce só em `pago`.
**Depende de:** MET-02.
**Fase 4 · Esforço G.**

## MET-04 — Régua de aviso 7/3/1 + ligar `IA_HARD_CAP`
**Estado atual:** `assertSaldoAntesDoLLM` em modo sombra (`IA_HARD_CAP` ausente = `permitido=true`). `lib/ia/metering.ts`. [C-sombra]
**Defeito:** ligar o hard-cap sem carteira/recarga mata o copiloto no meio do atendimento.
**Implementação (COMO):** régua de aviso (saldo baixo em 7/3/1 dias de consumo estimado → notifica tenant); só depois `IA_HARD_CAP=on`. **Ordem travada:** MET-03 (carteira+top-up) → régua → `on`.
**Arquivos a tocar:** `lib/ia/metering.ts`; job de aviso; env Render.
**Aceite:** com saldo baixo, tenant recebe avisos antes do bloqueio; com `on`, saldo <0 bloqueia LLM (não em sombra).
**Depende de:** MET-03.
**Fase 4 · Esforço M.**

## MET-05 — Billing SaaS/MRR mínimo
**Estado atual:** `hub_planos`/`hub_tenant_assinatura`/`hub_tenant_modulos`/`hub_tenant_creditos` **só em docs** (Grep confirmou). Billing ~3%. [D]
**Implementação (COMO):**
1. `[PROPOSTO]` `hub_planos` (nome, preco_brl, blocos_mes, franquia_tijolos, modulos[]), `hub_tenant_assinatura` (tenant, plano, seats, status, vencimento).
2. Job mensal de fatura: gera cobrança BRL (fase 1 = manual/PIX, fora da carteira) + credita franquia de Tijolos via `hub_ia_creditos_mov` tipo `'assinatura'` (o tipo JÁ existe no CHECK).
3. `hub_tenant_modulos` + guard por módulo no `lib/crm-nav-groups.ts` (entitlements).
**Arquivos a tocar:** migração; job de fatura; `lib/crm-nav-groups.ts`; UI de plano.
**Aceite:** criar assinatura → franquia de Tijolos creditada no mês; módulo não contratado não aparece no menu.
**Depende de:** MET-03 (carteira p/ creditar franquia). Decisões #1/#2 do dono.
**Fase 4 · Esforço G.**

---

# SEÇÃO 10 — IA / AGENTES

## IA-01 — Ligar Mistral + validar engine
**Estado atual:** `MISTRAL_API_KEY` ausente ~60 dias; engine (`lib/ia/engine.ts`), copiloto, Agent Builder = latentes. [C-DORMENTE]
**Implementação (COMO):** setar `MISTRAL_API_KEY` (billing validado — dependência do dono); UAZAPI conectada; validar `processarMensagem` ao vivo; manter `IA_HARD_CAP` em sombra até MET-04. Qualificação em modo "sugere e mostra" (flag `CRM_IA_AUTO_CADASTRO` continua OFF até confiança).
**Arquivos a tocar:** env Render; `lib/ia/feature-flags`.
**Aceite:** lead entra pelo WhatsApp, é qualificado pela IA, humano confirma em 1 toque, de ponta a ponta.
**Depende de:** MET-01 (markup), IA-02.
**Fase 1 · Esforço P (código) + dependência de credencial.**

## IA-02 — `ml.ts` sem modelo hardcoded
**Estado atual:** `lib/ia/ml.ts` usa `claude-haiku-4-5` **hardcoded sem fallback** → `/api/ml/*` quebra sem chave Anthropic. [BUG]
**Implementação (COMO):** migrar `ml.ts` para o wrapper `lib/ia/llm-completion.ts` (que roteia Mistral↔Claude com fallback). Nenhuma rota deve depender de um provider fixo.
**Arquivos a tocar:** `lib/ia/ml.ts`.
**Aceite:** `/api/ml/*` responde com Mistral quando Anthropic está vazia; sem 500 por chave ausente.
**Depende de:** —
**Fase 0 · Esforço P.**

## IA-03 — Caminho de tools para Anthropic (quando/ se ativar Claude)
**Estado atual:** o gate `podeToolsMistral` exige `isMistralFamilyModelId` → um agente configurado com `claude-*` **perde as ferramentas**. `lib/ia/mistral-chat-tools.ts`. [D]
**Implementação (COMO):** só se/quando quiser rodar agentes em Claude com tools: implementar o caminho de function-calling Anthropic no `llm-completion-tools`. Baixa prioridade enquanto Mistral-first.
**Aceite:** agente Claude executa uma tool sem cair no caminho sem-ferramentas.
**Depende de:** IA-01.
**Fase 4+ · Esforço M.**

---

# SEÇÃO 11 — EVENTOS, ANALYTICS & CAC

## EVT-01 — Analytics consome `hub_eventos` + captura UTM
**Estado atual:** `hub_eventos` grava (`lib/crm/registrar-evento.ts`, best-effort), mas o analytics NÃO consome como fonte (STATUS-MODULOS #15); sem `utm_*` no lead. Windsor.ai cobre só Facebook Ads; Meta/Google/GA4 = placeholders. [D]
**Defeito:** CAC por canal/vertical incalculável (sem denominador de custo casado a lead).
**Implementação (COMO):**
1. Capturar `utm_source/medium/campaign` no `metadata` do lead (webhook WhatsApp `app/api/whatsapp/webhook/route.ts` + forms/landing) — hoje click-to-WhatsApp perde a atribuição.
2. Analytics passa a ler `hub_eventos` (a matéria-prima já existe: `lead_criado`, `lead_distribuido`, `negocio_ganho`...).
3. Painel de coorte MERCADO×ORIGEM: leads→qualificados→encaminhados→ganhos por coorte; cruzar com custo Windsor = primeiro CAC real.
**Arquivos a tocar:** webhook; forms; `app/api/crm/analytics/*`; `lib/crm/eventos-formato.ts`.
**Aceite:** um lead de anúncio chega com `utm_*` preenchido; o painel mostra conversão por origem/mercado; CAC por vertical calculável.
**Depende de:** RAS-03 (ator ajuda mas não bloqueia).
**Fase 3 · Esforço G.**

---

# SEÇÃO 12 — PORTAL DO CLIENTE

## POR-01 — Portal do Cliente MVP
**Estado atual:** rota `/portal`, persona `cliente`, `hub_portal_clientes`, `requirePortalSessao` **não existem no código** (Glob/Grep vazios). Desenho completo em `docs/PORTAL-CLIENTE-DESIGN.md`. Reusa engine pronto: `lib/crm/cockpit-aggregate.ts` (`aggregateCockpit` já aceita `opts.negocioId`), `cockpit-classificar.ts` (`derivarSaude`, `avancoMedio`, `proximoMarco`). [D]
**Implementação (COMO):**
1. Papel `cliente` (guest) — já existe no tipo (`role-map.ts`); ativar no login (`LOGIN_ALLOWED_APP_ROLES` só para `/portal`).
2. `[PROPOSTO]` `hub_portal_clientes` (`auth_id ↔ negocio_id/obra_id`); convite por token uso-único, expira 7d, invalida no 1º uso.
3. `requirePortalSessao`: deriva `negocio_id`+`tenant_id` **da sessão, nunca do body**; sem vínculo → 404.
4. Rota `/portal` dashboard-first reusando `aggregateCockpit(supabase, tenantId, {negocioId})` — só LÊ o payload curado.
5. Financeiro bifurcado: a defesa-na-query já existe em `lib/obras/financeiro.ts` (preço fechado nunca seleciona `valor_unitario`). Lista negra de colunas nunca projetada: `responsavel_id`, `margem`, `custo_interno`, `falta_*`, `bloqueio_obs`.
6. Aprovações = visão filtrada de `hub_aprovacoes` por `aprovador=cliente`; "Tenho dúvidas" abre canal, não rejeita; nunca botão [Pagar], só [Aprovar].
7. Selo nasce **ⓘ declarado** (honesto) até existir processo real de visita in loco; nunca ⓥ falso.
**Arquivos a tocar:** novo `app/portal/*`; `hub_portal_clientes` (migração); guard novo; reuso de cockpit/financeiro/aprovações.
**Aceite:** cliente convidado vê só a própria obra (outro `negocio_id` → 404); no preço fechado, DevTools não revela `valor_unitario`; observador não vê botão Aprovar; principal aprova uma medição e ela vira uma das 2 chaves do escrow.
**Depende de:** OBR-01/02 (engine de obra em prod), FIN-02 (escrow p/ aprovação real). Pode antecipar a leitura (dashboard/diário) após Fase 3 e deixar aprovação p/ depois da Fase 2.
**Fase 7 (leitura antecipável p/ pós-Fase 3) · Esforço G.**

---

# SEÇÃO 13 — LGPD / COMPLIANCE TÉCNICO

## LGPD-01 — Fluxo de anonimização (direito ao esquecimento)
**Estado atual:** "nada se perde" (append-only, delete-só-arquiva, `lib/crm/excluir-cadastro-crm.ts`) colide com o direito de exclusão; não há fluxo de anonimização. [D]
**Defeito:** titular que exige apagamento não é atendido por "arquivar"; passivo real no 1º cliente de terceiro.
**Implementação (COMO):** RPC/fluxo `anonimizarPessoa(pessoa_id)` que **preserva a linhagem/rastreio** (mantém código, vínculos, negócios) mas **zera PII**: nome→hash, CPF→NULL, contatos→removidos, marca `anonimizado_em`. Distinto do soft-archive. Auditar onde PII vaza (o helper `buscarPessoaPorDocumento` está flagado HIGH).
**Arquivos a tocar:** nova RPC; `lib/crm/excluir-cadastro-crm.ts`; rota de solicitação.
**Aceite:** anonimizar uma pessoa mantém a árvore de negócios íntegra mas sem PII recuperável; busca por nome/documento não retorna o titular.
**Depende de:** RAS-01 (linhagem preservada).
**Fase 5 · Esforço M.** (Antes do 2º tenant.)

---

# SEÇÃO 14 — BACKLOG MESTRE (ordenado por dependência)

Prioridade: P0 = irreversível/bloqueia dinheiro · P1 = MVP/receita · P2 = rede/escala.

| WI | Título | Fase | Prio | Esf. | Depende de |
|---|---|---|---|---|---|
| RAS-01 | Linhagem pai/raiz (escrita pelo app) | 0 | **P0** | M | FND-01 |
| RAS-02 | UNIQUE código + auto-código no banco | 0 | P0 | M | — |
| RAS-03 | `hub_eventos.ator_id` | 0 | P1 | P–M | — |
| MET-01 | Fix markup ≥1 | 0 | **P0** | P | — |
| IA-02 | `ml.ts` sem hardcoded | 0 | P1 | P | — |
| FIN-03 | Guard UI `valor_fechado` NULL | 0 | P1 | P | — |
| EST-03 | Blindar CHECK `hub_atividades` | 0/3 | P1 | P | — |
| IA-01 | Ligar Mistral + validar engine | 1 | P1 | P* | MET-01, IA-02, credencial |
| FND-01 | Baseline migration | 2 | P1 | G | — |
| OBR-01 | Aplicar AEC (E0–E7/A0–A1) | 2 | P1 | G | FND-01 |
| OBR-02 | Medição atômica (RPC) | 2 | P1 | M | OBR-01 |
| FIN-02 | Fix escrow + aplicar E6 | 2 | **P0** | M | OBR-01 |
| FIN-01 | Motor de comissões em prod | 2 | P1 | M | TEN-03(vínculos), FND-01 |
| LEAD-02 | Consolidar vocabulário estágio | 3 | P1 | M | — |
| EST-01 | Funis por mercado | 3 | P1 | M | LEAD-02 |
| EST-02 | Entrega correta IMB/FOR/PRO | 3 | P1 | M | decisão dono |
| LEAD-01 | SLA com relógio + cron | 3 | P1 | G | — |
| RAS-04 | Resolver cobre prefixos | 3 | P2 | M | — |
| RAS-05 | MDO fonte única + alocação | 3 | P1 | G | obra em prod |
| EVT-01 | Analytics + UTM + CAC | 3 | P1 | G | — |
| FND-02 | Matar clients inline | 3 | P2 | G | — |
| MET-02 | Consumo IA atômico | 4 | P1 | M | — |
| MET-03 | Carteira + top-up PIX | 4 | P1 | G | MET-02 |
| MET-04 | Régua 7/3/1 + hard-cap on | 4 | P1 | M | MET-03 |
| MET-05 | Billing SaaS mínimo | 4 | P1 | G | MET-03, decisões |
| TEN-01 | Backfill NULL + NOT NULL | 5 | **P0(rede)** | G | RAS-02 |
| TEN-02 | `.eq` puro nas policies | 5 | P0(rede) | G | TEN-01 |
| TEN-03 | Fechar RLS abertas | 5 (vínculos→2) | P0(rede) | M | TEN-01/02 |
| TEN-04 | Hierarquia de tenant | 5 | P0(rede) | M | TEN-01/02/03 |
| RBAC-01 | Rotacionar chave interna | 5 | P0(rede) | M | — |
| RBAC-02 | Chave Hub à pessoa física | 5 | P0(rede) | M | TEN-04 |
| RBAC-03 | Invite restrito | 5 | P0(rede) | P | TEN-04 |
| RBAC-04 | Owners hardcoded + arquivar revoga | 5 | P1 | P–M | — |
| RBAC-05 | Guard papel nas 32 rotas | 5 | P0(rede) | G | FND-02 |
| LGPD-01 | Anonimização | 5 | P1 | M | RAS-01 |
| POR-01 | Portal do Cliente MVP | 7 (leitura→pós-3) | P1 | G | OBR-01, FIN-02 |
| LEAD-03 | Paginação motor (>100) | 6 | P2 | M | — |
| IA-03 | Tools Anthropic | 4+ | P2 | M | IA-01 |

\* IA-01 é esforço de código baixo, mas gated por credencial+billing (dependência do dono).

---

# SEÇÃO 15 — ORDENAÇÃO EM SPRINTS (sugestão)

**Sprint 1 (Fase 0 — estancar o irreversível):** RAS-01, RAS-02, MET-01, IA-02, FIN-03, RAS-03, EST-03.
*Fim do sprint:* nenhum negócio novo sem raiz; markup <1 rejeitado; `/api/ml/*` não quebra; ganho sem valor avisa.

**Sprint 2 (Fase 1 — IA):** IA-01 (assim que a chave Mistral + billing estiverem liberados pelo dono).
*Fim:* lead WhatsApp → qualificado por IA → confirmado em 1 toque.

**Sprint 3–4 (Fase 2 — janela grande):** FND-01, OBR-01, OBR-02, FIN-02, FIN-01 + TEN-03(só `hub_negocio_vinculos`). Uma janela do dono.
*Fim:* obra real com EAP+medição+escrow dupla-chave; comissão real PREVISTA→PAGA; **dinheiro de terceiros só na camada aplicada (fecha C2)**; schema reconstruível.

**Sprint 5–7 (Fase 3 — operar sem planilha):** LEAD-02, EST-01, EST-02, LEAD-01, RAS-04, RAS-05, EVT-01, FND-02, runbook operacional.
*Fim (critério-mãe do MVP):* próximo cliente real roda ponta-a-ponta sem planilha.

**Sprint 8–10 (Fase 4 — cobrar):** MET-02, MET-03, MET-04, MET-05.
*Fim:* primeiro real de MRR + primeiro Tijolo cobrado.

**Sprint 11+ (Fase 5 — endurecer p/ rede):** TEN-01/02/03/04, RBAC-01/02/03/04/05, LGPD-01.
*Fim (gate do 2º tenant):* 12/12 do checklist + teste de intrusão interno passa.

**Depois:** Fase 6 (piloto de rede), Fase 7 (Altitude 1 + Portal), Fase 8 (escala/internacional/patente).

---

# SEÇÃO 16 — REGRAS QUE VALEM PARA TODO O TIME (invariantes a não quebrar)

Estas já existem no sistema e são critério de rejeição de PR se violadas:
1. **Dinheiro só com humano distinto.** `escrow:chave_hub` ≠ `escrow:chave_tecnica`, nunca a mesma pessoa nas duas (`aprovacoes.ts:377-387`); IA/worker/chave interna nunca aprovam; nunca por voz.
2. **Duas moedas nunca somam na UI.** Tijolo (não-sacável) e BRL (comissão sacável) em ledgers separados; ponte só por referência cruzada (`ref_tipo/ref_id`). `hub_comissoes.moeda CHECK='BRL'`.
3. **Append-only onde há dinheiro/prova.** Correção = linha negativa/estorno, nunca UPDATE/DELETE. Triggers `trg_hub_comissoes_imutavel`, `hub_append_only_guard()`.
4. **Delete só arquiva.** `arquivado_em`, nunca `DELETE FROM` em ação de usuário.
5. **`tenant_id` sempre da sessão**, nunca do body; posse por 404, não 403.
6. **Defesa na query.** No preço fechado, o endpoint NÃO seleciona `valor_unitario`.
7. **Estender CHECK junto com vocabulário** (atividades, aprovações, tipos) — senão insert quebra silencioso.
8. **Migração = aditiva, reversível, na janela do dono.** Nada aplicado à mão sem virar arquivo versionado (lição da linhagem).

---

*Este caderno é vivo: ao concluir uma WI, atualizar o estado no documento-mãe (DESENHADO→CONSTRUÍDO, represado→ligado). A honestidade que existe no código vale para o board: nunca marcar verde o que está âmbar.*
