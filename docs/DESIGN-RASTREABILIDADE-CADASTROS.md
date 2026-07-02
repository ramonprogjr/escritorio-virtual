# 🧬 DESIGN — Rastreabilidade & Cadastros prontos para DADOS REAIS

> **Síntese do CEO** a partir da mesa redonda (5 especialistas: arquiteto-dados, produto, segurança-multitenant, migração, analytics — `wf_4d4c3c42-b23`) sobre a `SPEC-RASTREABILIDADE-COMPLETA-HUB.md`, avaliada contra o schema REAL. Diretriz: *avaliar antes de implantar*. **Nada aqui está aplicado — é para o dono avaliar.**

## Veredito (honesto)
**~80% da sua spec JÁ está construída.** Código único atômico e imutável, dedup CPF/CNPJ, `hub_eventos` append-only, participantes N:N (`hub_negocio_vinculos`), esteira negócio→entrega idempotente com confirmação humana — tudo vivo. **Há UM buraco verdadeiramente irreversível se você inserir dado real agora: a linhagem negócio↔negócio (pai/raiz) não existe.** O resto dos gaps ou já existe parcial, ou é aditivo-seguro depois. A boa notícia: o mínimo pra ficar seguro é pequeno e 100% aditivo.

## ✅ O que já está pronto (não reconstruir)
- Código único **atômico** por entidade/ano (`crm_proximo_codigo` + `hub_codigo_contador`), auto-atribuído nas rotas de UI (negócio, pessoa, empresa, imóvel, obra, projeto…).
- **Imutabilidade** do código do negócio por trigger (`hub_bloquear_alteracao_codigo_negocio`).
- **Dedup** CPF/CNPJ/telefone ANTES do insert, com 409 genérico (não vaza dado de outro tenant) no super-cadastro.
- `hub_eventos` append-only + `registrarEvento` (best-effort) já emitindo `lead_criado`/`negocio_criado`.
- Participantes N:N: `hub_negocio_vinculos` (com `codigo_rastreio`). Grafo imóvel→negócios já responde "quantos negócios um imóvel gerou" via `imovel_id`.
- Esteira negócio→entrega (obra/projeto/marcenaria/…) **idempotente**, com FK `negocio_id` de volta, e **humano confirma**.
- Relação **só por ID (uuid)** já é o padrão; `codigo` (texto) é handle humano separado.

## 🔴 TIER 0 — TRAVAR ANTES DE QUALQUER DADO REAL (aditivo, seguro, irreversível se ignorado)
| # | O quê | Por que é ANTES do dado real |
|---|-------|------------------------------|
| 0.1 | **`UNIQUE (tenant_id, codigo) NULLS NOT DISTINCT`** nas tabelas-core que faltam (negocios, pessoas, empresas, especialistas, propostas, obras, projetos, leads, imoveis, parceiros, catalogo, servicos) — pré-check 0 duplicatas | O fallback `COUNT(*)+1` (quando a RPC cai) tem **corrida** e não é por-tenant → 2 cadastros simultâneos = **código duplicado**. Depois que 2 linhas reais nascem iguais, a constraint **não sobe mais**. |
| 0.2 | **Trigger `BEFORE INSERT` de auto-código no BANCO** (preenche `codigo` via `crm_proximo_codigo` quando NULL) em toda tabela codificada | Você vai inserir **pelo SQL Editor**. Hoje o código só é gerado nas rotas do app → insert manual nasce **sem código** = o retrofit que você proibiu. O trigger fecha isso em qualquer caminho de entrada. |
| 0.3 | **Linhagem: `negocio_pai_id` + `negocio_raiz_id`** (nullable, self-FK, indexados) + trigger de raiz (pai NULL→raiz=self; senão herda a raiz do pai) + backfill self=raiz + **guardas anti-ciclo/mesmo-tenant** | **O único gap irreversível.** Negócio criado agora sem isso nasce órfão de árvore — "de qual venda-do-imóvel veio esta obra" vira adivinhação permanente. |
| 0.4 | **`hub_imoveis`: `captado_por_parceiro_id` + `captado_por_pessoa_id` + `captado_por_codigo` + `captado_via_link_id`** (nullable) | "**QUEM captou este imóvel?**" NÃO tem resposta hoje (só o proprietário/dono). É dado de **origem**; imóvel tem 0 linhas = janela perfeita. Impossível reconstruir depois. |
| 0.5 | **`hub_eventos`: `ator_id` + `ator_codigo`** (nullable) + instrumentar o catálogo de eventos com os códigos da cadeia no payload | Hoje `ator='humano'` (papel, não identidade). "Quem fez" fica **vazio em todo o histórico** se não instrumentar antes da carga (log é append-only). |
| 0.6 | **Mão de obra = `hub_especialistas` (fonte ÚNICA)**; congelar `hub_profissionais` (deprecated, não expor) + repontar 2 subscriptions de dashboard + UNIQUE no código | `hub_profissionais` duplica MDO **sem código/tenant**. MDO real lá nasce **fora do fio de rastreio**. Decidir antes do 1º especialista real evita migrar pessoas entre tabelas. |
| 0.7 | **`hub_propostas`: `codigo`** + branch `PROP` no `crm_proximo_codigo` (já deixar `CTR/COM/ORC`) | Você emite proposta assim que abrir negócio; proposta sem código permanente = retrofit (peça jurídica precisa de identidade estável). |
| 0.8 | **`hub_pessoas_empresas`: `valido_de` + `valido_ate`** (só as colunas agora) | Hoje `UNIQUE(pessoa,empresa)` + upsert **sobrescreve** o vínculo: trocar de empresa **apaga a história**. Vínculos reais de hoje já nascem temporal-ready. |
| 0.9 | **Travar o vocabulário de PAPEL** em `hub_negocio_vinculos` (comprador/vendedor/corretor/arquiteto/engenheiro/fornecedor/cliente/indicador…) — convenção no app, **zero DDL** | Hoje papel é genérico (contato_principal/participante) — não distingue comprador de vendedor → **LTV e comissão-por-papel impossíveis**. Cada negócio real entra com papel cego se não travar antes. |
| 0.10 | **Matar o spawn mágico**: `PATCH` etapa→ganho hoje **auto-insere a entrega (obra)**. Trocar por **propor + confirmar** | Com dado real, um "ganho" por engano cria uma **obra REAL** que a regra "nada se apaga" **te proíbe de limpar** = lixo imortal. Você foi explícito: filho é PROPOSTO. |

## 🔒 TIER 1 — SEGURANÇA antes de EXPOR links/rede (aditivo)
- **`hub_links_cadastro`: `tenant_id` + `gerador_codigo` + `gerador_tipo`** (a atribuição na origem que você pediu) **E** fechar o `SELECT` anônimo (hoje a página pública lê `select('*')` via anon) + resolver `token→tenant/gerador` **no servidor** (nunca do body — senão reintroduz o bug forjável do `x-tenant-id`) + **409 genérico** na rota pública (hoje devolve `codigo`+`parceiro_id` = oráculo de enumeração/LGPD).
- **Imutabilidade do código** estendida às identidades (PES/EMP/IMV/PRD/SVC) — hoje só o negócio é protegido; sem isso, `UPDATE` de código via service-role = **hijack de identidade**.
- **`users.pessoa_id`** (FK `hub_pessoas`) — login aponta pra identidade global (fecha a decisão de 2 camadas: mesmo código do cadastro E do acesso).

## 🕓 TIER 2 — DEFERIDO (documentar, NÃO bloqueia dado real)
- **Contador por-tenant**: `hub_codigo_contador` hoje é PK `(entidade, ano)` = sequência **global** (contraria "documento por-tenant"). Inofensivo com 1 escritório (UNIQUE é por-tenant → sem colisão). Migrar antes do **2º tenant**; códigos já emitidos não mudam.
- **Identidade global**: hoje é **per-tenant** (com 1 escritório, per-tenant == global). O split (identidade global + tabela de membership papel/acesso por-tenant) entra **antes de abrir a rede**; **não** é retrofit em dado real (o valor do código sobrevive).
- **Comissão como aresta**: hoje `percentual_comissao`/`comissao_calculada` é escalar único no negócio → split por parceiro impossível. Virar comissão por-participante / `hub_comissoes` **antes de deal com split**.
- **Tabelas novas** (`hub_contratos` CTR → `hub_comissoes` COM → `hub_documentos`): aditivas, criar quando o fluxo exigir (1º contrato, 1º split, 1º anexo). Só `hub_propostas.codigo` (0.7) é imediato.
- **FK ambígua `lead_id`** (`hub_leads` legado × `hub_leads_crm`): higiene — fixar a fonte antes de analytics finos.
- **`hub_pessoas_empresas`**: trocar `UNIQUE(pessoa,empresa)` por parcial `WHERE valido_ate IS NULL` + upsert "fecha ativo + insere novo" (coordenado app+DB).

## ❓ Decisões que preciso de VOCÊ (avaliar antes de implantar)
1. **Prefixo da mão de obra:** manter `ESP-` (já vivo) ou adotar `MDO-` (da sua spec)? *Recomendo `MDO-`* (bate com seu modelo mental; é um branch trivial no gerador).
2. **Identidade per-tenant AGORA + global depois?** *Recomendo sim* — não é retrofit em dado real, e destrava você inserir já. (Documento em DECISIONS.)
3. **Contador global agora, por-tenant antes do 2º tenant?** *Recomendo sim* (mesma lógica).
4. **Matar o spawn mágico (ganho→obra) para propor+confirmar?** *Recomendo sim, antes do dado real* — muda um comportamento atual, por isso peço seu OK.
5. **Escopo do apply:** aplico **só o TIER 0 + o essencial do TIER 1** na sua janela, **antes** de você inserir dados reais?

## Ordem de apply (janela do dono, aditivo/idempotente)
1. **Pré-check** duplicatas de código nas tabelas sem UNIQUE (regularizar se houver — hoje deve ser 0).
2. **Script A (statements avulsos, SEM transação):** `CREATE UNIQUE INDEX CONCURRENTLY` parcial `(tenant_id, codigo)` nas tabelas do passo 1.
3. **Script B (1 transação, idempotente):** trigger auto-código; `ADD` linhagem + trigger de raiz + backfill; `ADD` captador em imóveis; `ADD` `ator_id/ator_codigo` em eventos; `ADD` `valido_de/ate`; `ADD` `codigo` em propostas + branches no gerador; imutabilidade de identidade; `users.pessoa_id`; `hub_links_cadastro` tenant/gerador.
4. **Verificação:** inserir 1 linha teste via SQL Editor SEM código/raiz → confirmar que **nasce** com código + raiz; depois `ROLLBACK`/`DELETE` do teste.
5. **Comportamento (app):** propor+confirmar no ganho; fechar anon em `hub_links_cadastro`; 409 genérico na rota pública; repontar dashboards MDO. *(Estes são código — vão num commit, gate tsc/vitest/build.)*
6. **SÓ ENTÃO:** liberar a inserção de dados reais.

---

## ✅ DECISÕES DO DONO (travadas 02/jul) + ajuste de escopo
1. **Mão de obra = prefixo `MDO-`** (branch novo no gerador; fonte segue `hub_especialistas`).
2. **Matar o spawn mágico:** ganho→obra vira **propor + confirmar** (1 clique humano).
3. **IDENTIDADE GLOBAL AGORA** (o dono escolheu o caminho mais correto, não o adiado). ⇒ os itens de identidade **sobem do Tier 2 para o Tier 0**:
   - **Código de identidade GLOBAL unique** em PES/EMP/IMV/PRD/SVC (pessoa já tem `hub_pessoas_codigo_key` global; replicar nas demais).
   - **Contador por-tenant para DOCUMENTOS**: `hub_codigo_contador` PK `(entidade, ano)` → `(tenant, entidade, ano)`; nova assinatura `crm_proximo_codigo(entidade, mercado, tenant)` mantendo a antiga como default (aditivo). Identidade continua global; documento reinicia por tenant.
   - **`hub_identidade_acesso` (NOVA):** identidade(pessoa global) ↔ tenant ↔ papel/acesso. Hoje só o tenant default; nasce pronta pra rede.
   - **`users.pessoa_id`** (FK `hub_pessoas`) — login aponta pra identidade global.
   - **Dedup GLOBAL PII-safe (blindagem):** busca por CPF/CNPJ é global e devolve **só `{existe, codigo}`**; nome/contato/endereço **só** dentro do tenant com vínculo. Remover `.or(is.null)` das leituras de PII. Rota pública: **409 genérico** (sem `codigo`/`parceiro_id`).
4. **Apply aprovado** — preparar o bundle Tier 0 (aditivo/idempotente) pra janela do dono.

## 🔎 Raio-x da identidade (02/jul, confirmado no banco)
- `hub_pessoas.codigo` JÁ é global unique (`hub_pessoas_codigo_key`) — identidade-global do código já parcialmente pronta.
- `users` = id, auth_id, email, name, phone, role, status, tenant_id — **sem `pessoa_id`**.
- `hub_identidade_acesso` **não existe**. Contador PK `(entidade, ano)` = global.
- Dedup atual (`buscarPessoaPorDocumento`) é **escopado por `tenantId`** → precisa virar global-PII-safe.

## 🛠️ Plano de build (ordenado, cada peça verificável; o dono revê o bundle antes de rodar)
- **Script A — anti-duplicata (statements avulsos, sem transação):** `CREATE UNIQUE INDEX CONCURRENTLY` — GLOBAL `(codigo)` nas tabelas de IDENTIDADE; `(tenant_id, codigo)` NULLS NOT DISTINCT nas de DOCUMENTO. Pré-check 0 duplicatas.
- **Script B — schema aditivo (1 transação idempotente):** trigger auto-código; linhagem `negocio_pai/raiz` + trigger de raiz (guardas anti-ciclo/mesmo-tenant) + backfill; `captado_por` em imóveis; `ator_id/codigo` em eventos; `valido_de/ate` em pessoas_empresas; `codigo` em propostas; imutabilidade de identidade; `hub_links_cadastro` tenant/gerador.
- **Script C — identidade global (1 transação):** contador `(tenant,entidade,ano)` + nova assinatura da RPC; `hub_identidade_acesso`; `users.pessoa_id` + backfill do(s) user(s); prefixo `MDO-` no gerador.
- **Commit de código (gate tsc/vitest/build):** propor+confirmar no ganho; dedup global-PII-safe; fechar anon em `hub_links_cadastro` + 409 genérico; repontar dashboards MDO.
- **Verificação:** inserir linha teste via SQL Editor SEM código/raiz → nasce com ambos; rollback do teste. Só então: dado real.
