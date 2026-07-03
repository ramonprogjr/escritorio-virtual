# VISÃO DO CEO — Seed do Ecossistema Consulado (mesa redonda 02/jul)

> Mesa redonda de 5 lentes (schema · modelo · segurança · visibilidade · rollback) + síntese do CEO.
> **Resumo de uma linha: modelo APROVADO, seed atual REPROVADO.** Nada é semeado até você decidir os 3 pontos abaixo.

---

## 1. VEREDITO

O **conceito está certo** (negócio com linhagem pai/raiz imutável, tudo por ID, pessoa↔empresa temporal com cargo, user sem senha) e **o schema já suporta ~95% dele**. O problema não é arquitetura — é que o **seed atual não materializou o grafo** que deveria provar, e **ancorou a raiz no nó errado**.

**4 bloqueantes antes de semear a v2:**

1. **A RAIZ está na ENGENHARIA e a linhagem é IMUTÁVEL — urgente-no-tempo.** A raiz é `NGENG2026013`, mas seu modelo diz que nasce na ARQUITETURA (Takiguthi). O trigger congela `negocio_pai_id` quando deixa de ser NULL e não recomputa a raiz dos filhos. **Cada filho grudado na raiz errada trava o erro** e reancorar depois fica mais caro.
2. **`pipeline_id` NULL esconde o negócio da tela** (confirmado nos dois: raiz e Marcenaria). A tela só monta abas por pipeline e faz `.eq('pipeline_id')`; NULL não casa → somem 100%. É o bug de "não tem nada em Negócios". Conserto = UPDATE.
3. **O grafo está VAZIO.** `hub_pessoas_empresas` = 0 linhas (Marcos↔Takiguthi, Nice↔responsável, Consulado↔rep **não existem** no N:N — só o campo legado `empresa_id`). `hub_negocio_vinculos` = 0 para o Consulado. Hoje a ficha do negócio mostra **só o cliente** — Marcos, Takiguthi e Nice não aparecem. Puro defeito de seed.
4. **2 ramos do seu modelo não têm casa no schema:** PRODUTO (`hub_produtos` não existe; `hub_catalogo` não liga a fornecedor) e SERVIÇO-de-obra (`hub_servicos` é catálogo de **marketing**, sem prestador/atribuição).

**Não é bloqueante do seed, mas é de LIGAR LOGIN (pós-M3):** middleware/IDOR/rate-limit/RLS. Confirmado por 2 caminhos que **`auth_id NULL` = sem login**, então semear users login-off é seguro. Sua decisão de ligar logins só depois da M3 está certa.

---

## 2. AS 3 DECISÕES QUE SÃO SUAS (com recomendação do CEO)

**1) A raiz do Consulado nasce na ARQUITETURA ou fica na ENGENHARIA?**
→ **Recomendo ARQ e reancorar AGORA.** A primeira oportunidade no Hub aqui é a arquitetura Takiguthi; a Nice é filho derivado. Reancorar agora é barato; a imutabilidade encarece a cada filho.
→ **Ressalva de produto:** NÃO hardcode "raiz=ARQ" como regra. A regra é **"raiz = a primeira oportunidade da jornada no Hub"** — numa jornada que começa por venda de imóvel, a raiz seria IMB.

**2) PRODUTO agora (criar `hub_produtos` + tela) ou deferir?**
→ **Recomendo deferir** e modelar o fornecimento como **NEGÓCIO derivado** (mercado PRO, `empresa_id`=fornecedor) — que é exatamente como a Marcenaria já ficou. Criar `hub_produtos` sem tela = dado invisível. A tabela + listagem entram numa migração própria quando houver a tela.

**3) Rodar UM DDL aditivo agora, ou semear "achatado" e migrar depois?**
O DDL seria: expandir os papéis de `hub_negocio_vinculos` (add arquiteto/engenharia_executora/prestador/fornecedor), ligar produto/serviço/user ao grafo, e consertar o vazamento do `hub_servicos`.
→ **Recomendo rodar o DDL nesta mesma janela** (ela já abre pra reancorar a raiz). Entrega os papéis fiéis + paga a dívida de segurança de uma vez.
→ **Alternativa segura:** semear achatado ('parceiro'/'participante') agora — mas aí a ficha "Relacionados" não distingue arquiteto de prestador até um 2º DDL.

---

## 3. PLANO DE BUILD (ordem = dependência de FK; aditivo · idempotente · service_role · janela do dono)

**Fase A — DESTRAVAR (antes de qualquer filho novo):**
- **A0. Reancorar a raiz p/ ARQ** (só funciona nesta ordem pela imutabilidade): (1) INSERT do negócio ARQ com `pai=NULL` (protagonista Takiguthi/Marcos); (2) UPDATE `NGENG2026013` set `pai=NGARQ` (permitido: pai atual é NULL); (3) "tocar" `NGMRC2026014` com `UPDATE pai=pai` p/ recomputar a raiz→NGARQ.
- **A1. Pipelines + `mercado_slug`:** ARQ→`024c0e7d`, ENG→`ac30946f`, MRC→`dd2ea8cc`; projeto PRJ→`eaee3615` (armadilha latente).

**Fase B — POPULAR O GRAFO (INSERT puro):**
- **B1/B2.** empresas + pessoas faltantes (funcionários da Nice) — `codigo=NULL`→trigger; `tenant_id=Obra10` SEMPRE.
- **B3. `hub_pessoas_empresas`** — cargo TEXTO padronizado ("Arquiteto Titular", "Responsável Técnico", "Representante Consular", "Mestre de Obras", "Marceneiro"), `principal`, **`valido_de=CURRENT_DATE` (NOT NULL!)**, `tenant_id`.
- **B4. `users`** — `auth_id=NULL`, email único, role no enum, `pessoa_id`, **`status='Inativo'`** enquanto login off.
- **B5. Negócios derivados** — `pai=NGARQ`, pipeline+mercado coerentes.
- **B6. `hub_negocio_vinculos`** — cliente/contato/arquiteto/engenharia (papéis ricos só com o DDL da decisão 3).

**"Disputa entre engenharias":** 1 negócio-FILHO por engenharia concorrente (todas em `negocios-eng`), vencedora→`fechado_ganho`, perdedoras→`fechado_perdido`. É o MESTRE×VINCULADO no nível do negócio.

**Seed mínimo-representativo (provar cada aresta 1x):** ~6 empresas, ~9 pessoas/users (login-off), Nice com 2 funcionários, 1 engenharia perdedora, 1 prestador, 1 fornecedor.

**Trava de ouro:** `tenant_id='00000000-0000-4000-8000-000000000001'` em TODA linha (projetos/obras usam `.eq` estrito e somem com NULL; e NULL vira vazamento cross-tenant nas outras policies).

---

## 4. PONTO DE RETORNO (rollback) — Supabase FREE = SEM PITR

A rede real é um **restore-point IN-DB antes de semear** (`CREATE SCHEMA _rollback_consulado` + `CREATE TABLE … AS SELECT *` das linhas do ecossistema). Re-inserir dessas cópias restaura **os mesmos UUIDs e códigos**.

- **Âncora:** selo `dados_extras->>'seed'` (só empresas/pessoas têm a coluna) + **linhagem** `negocio_raiz_id` (o resto).
- **Hard-delete é viável:** `SET LOCAL app.delete_authorized=true` destrava hub_pessoas/empresas numa transação; guard `AND auth_id IS NULL` nos users; conferir contagens antes do COMMIT.
- **Modo B (não-destrutivo):** `arquivado_em`/`status`/`pipeline_id=NULL` quando a entidade virou compartilhada.
- **Não volta:** contadores de código (cosmético — código é interno); CASCADE da obra REF-2026-0001 leva ~14 filhas (conferir escrow/pagamentos antes — hoje dormente).

Scripts completos (Passo 0 restore-point, Passo 2 hard-delete, Passo 3 soft) estão prontos — gero o arquivo `.sql` quando você aprovar o plano.

---

## 5. O QUE FICA PÓS-MARATONA 3 (não agora)
Ligar logins (criar em `auth.users` + `users.auth_id`) só com os bloqueantes de segurança fechados. Prestador/fornecedor como **conta/tenant própria** também é pós-M3 (migrar do Obra10 depois é caro pelos triggers de imutabilidade/linhagem).
