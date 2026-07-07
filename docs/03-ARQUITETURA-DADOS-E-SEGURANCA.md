# Arquitetura, Dados & Segurança

> **Documento VIVO — um dos 5 que o time SEMPRE segue.** Derivado dos 115+ docs originais (arquivados, não seguidos) + do CADERNO-ENGENHARIA-AUDITORIA.md. Atualizado 07/jul/2026. Quando um doc antigo conflitar, este ganha.
> Companheiros: [00-Painel](00-PAINEL-DE-CONTROLE.md) · [01-Negócio](01-NEGOCIO-E-ESTRATEGIA.md) · [02-Produto/UX](02-PRODUTO-TELAS-E-UX.md) · [03-Arquitetura](03-ARQUITETURA-DADOS-E-SEGURANCA.md) · [04-Roadmap](04-ROADMAP-E-PLANO.md).


> Documento vivo — 1 dos 5 masters que o time SEMPRE segue. Derivado da síntese dos 115+ docs de `docs/`. Atualizado 07/jul. Cobre o COMO técnico: stack, modelo de dados, as 2 altitudes, RBAC/multitenant/RLS, rastreabilidade/linhagem, motor financeiro-técnico e segurança. **Honesto: distingue CONSTRUÍDO de DESENHADO de GATED.** Onde um doc antigo conflita, ganham `MODELO-DE-NEGOCIO-E-FLUXOS-COMPLETO`, `ANALISE-CEO-E-PLANO-DE-UNIFICACAO`, `00-PAINEL-DE-CONTROLE` e a memória do CEO.

---

## 0. Leitura rápida — o estado real em 8 fatos

1. **Stack:** Next.js 16 (App Router) + Supabase (Postgres + RLS) + Render (deploy) + Mistral/Groq (IA, **desligada**) + UAZAPI (WhatsApp).
2. **Espinha do domínio = NEGÓCIO** (`hub_negocios`). Fluxo canônico: `lead → negócio → (ganho) → deriva entrega (obra OU projeto) → serviços/frentes → financeiro/escrow → cliente`.
3. **Single-tenant disfarçado.** A fundação multi-tenant existe, mas só 1 tenant provisionado (Obra10, sentinela `00000000-0000-4000-8000-000000000001`). A barreira **primária** de isolamento é o **filtro no código** (`.eq('tenant_id')`), porque `crmDb()` roda com **service_role e bypassa RLS**.
4. **2 altitudes: Altitude 2 (Obra/Engenharia, série E) CONSTRUÍDA** no schema; **Altitude 1 (Arquitetura, série A) construída como átomo mas com carteira represada**; camada Hub-rede e portais **DESENHADOS**.
5. **IA/Mistral OFF há ~60 dias** (item nº1 do MVP): tudo que é conversacional/Talk-and-Go/orçamento-IA/copiloto **dorme e degrada para manual**. O que carrega o dia é Click-and-Go determinístico.
6. **Motor de comissões CONSTRUÍDO + TESTADO, mas GATED** (4 tabelas, tabelas vazias). "Faixa B" aplicada = **endurecimento anti-leak**, NÃO leitura da rede.
7. **Escrow (E6) CONSTRUÍDO mas DORMENTE/seguro** — nenhum código invoca `rpc_liberar_escrow` automaticamente; MVP é escrow **virtual/contábil** (`provedor='interno'`), nunca banco real ainda.
8. **Segurança:** advisors Supabase = 0 ERROS. Vetores de API endurecidos (Faixa A commitada). Bombas-relógio de multi-tenant (RLS `USING(true)`, `tenant_id IS NULL`) **latentes** — disparam sozinhas no go-live do 2º tenant.

---

## 1. Stack & Infraestrutura

| Camada | Tecnologia atual | Supera (histórico) |
|---|---|---|
| Front/App | **Next.js 16 (App Router, RSC)** | — |
| Banco | **Supabase / Postgres + RLS** | — |
| Deploy | **Render** (`escritorio-virtual-1.onrender.com`, branch `feature/escritorio-visual` = prod, auto-deploy) | Vercel |
| LLM | **Mistral-first + Groq fallback** (provider-agnóstico; Claude "pluga no Bloco H") | Anthropic Claude |
| WhatsApp | **UAZAPI** | Evolution API / Railway |
| Auth/sessão | Cookie **httpOnly**; tenant vem SEMPRE da sessão, nunca de header/body | — |

**Acesso ao banco no código:** `crmDb()` = cliente **service_role** → **bypassa RLS**. Consequência arquitetural central: **o filtro de tenant no código é a barreira nº1; a RLS é camada 2**. Todo endpoint/view precisa `.eq('tenant_id', ctx.tenantId)` explícito.

**⚠ Ponto a confirmar (não inventar):** dois project-refs Supabase aparecem nos docs — **`zollengyqtmyhnbrkepu` (OBRA10, ativo em `.env.local` e migrações)** vs **`cdjlqsznerdhwqyunodl`** (citado nos ROTEIROS de rotação de chave e MCP legado). **Confirmar qual é prod hoje antes de rotacionar chave.**

**Deploy/branch (regra travada):** `wendel/dev → feature/escritorio-visual`; sempre `git pull` antes de push. Repo herdado do dev demitido → backups nos 2 GitHubs; **GitHub próprio de backup é pendência do dono**.

---

## 2. Modelo de Dados — tabelas `hub_*`

Fonte de verdade do schema vivo = **`MAPA-CONEXOES-CADASTROS.md` (04/jul)** + o código (`lib/crm-nav-groups.ts`, migrações `hub_*`). O que segue consolida e descarta os snapshots pré-pacote-integral (`crm-schema-audit`, `crm-modelo-dados`, `database-schema-context` = **superados**, valem só como genealogia de migração).

### 2.1 Entidades-núcleo (todas com código atômico + `tenant_id`)

| Entidade | Tabela | Prefixo | Papel |
|---|---|---|---|
| Pessoa (PF/PJ, raiz de identidade, dedup CPF/CNPJ) | `hub_pessoas` | PES | Raiz de identidade; `codigo` já é **global unique** (`hub_pessoas_codigo_key`) |
| Empresa | `hub_empresas` | EMP | — |
| Vínculo P↔E (N:N, cargo + principal) | `hub_pessoas_empresas` | — | — |
| Lead | `hub_leads_crm` | LED | Entrada do funil |
| **Negócio (a ESPINHA)** | `hub_negocios` | NG+mercado | Centro do domínio; carrega `valor_fechado` + `percentual_comissao` (base do split) |
| Vínculo de negócio (N:N por PAPEL) | `hub_negocio_vinculos` | — | A verdade do "quem é quem" (cliente/arquiteto/eng/fornecedor/parceiro) |
| Obra (entrega física — Altitude 2) | `hub_obras` | OBR | EAP, medições, escrow; `tipo_contrato`, `bdi_fator`, `segmento`, `projeto_id`, `negocio_id` |
| Projeto (entrega ARQ — Altitude 1) | `hub_projetos` | PRJ | `responsavel_id` = chave técnica do escrow; `obra_id` = elo p/ gerar obra |
| Parceiro (rede externa) | `hub_parceiros` | PAR | `comissao_pct` (fallback do split); `status_acesso` (guard de pagamento) |
| Especialista / mão de obra (sem login) | `hub_especialistas` | **MDO** | Fonte de verdade da MDO; **ILHADO** (sem FK obra↔especialista) |
| Imóvel | `hub_imoveis` | IMO | FKs de captação **não populadas** |
| Catálogo materiais/disciplinas | `hub_catalogo` | codigo TEXT | `NULL=global` (master-data, intencional) |
| Pedido/SC de material | `hub_pedidos_material` | PED/SC | ⚠ **ZERO policy / `USING(true)`** |

**Legado a congelar:** `hub_profissionais` (sem `tenant_id`, duplica MDO — decisão travada: MDO segue `hub_especialistas`).

### 2.2 Tabelas de operação/financeiro/auditoria vivas

`hub_eventos` (append-only, auditoria/keystone) · `hub_aprovacoes` (gate de dupla-chave) · `hub_cotacoes_pedidos`/`_respostas` · `hub_encaminhamentos` · `hub_kpis_definicao/metas/resultados` (cron **morto** no Render → não usar p/ TV) · `hub_obras_cronograma/diario/fotos/ocorrencias` · `hub_obra_itens` (E2, item de escopo) · `hub_obra_frentes_eap` · `hub_obra_restricoes` (E3) · `hub_obra_orcamentos`/`_itens` (E6) · `hub_obra_pagamentos` · `hub_obra_escrow_contas`/`_movimentos` · `hub_medicoes`/`_itens`/`_retencoes` (E7) · `hub_operarios_checkin` · `hub_contas_pagar`/`_receber` · `hub_projetos_fases` · `hub_autonomia_matriz` · `hub_pipelines` · `hub_obra_taxonomia` · `hub_codigo_contador` · `hub_ia_creditos_mov` (metering "Tijolos") · `hub_ia_config` (markup/spread) · `users`.

**A criar (gap Tier 0, aprovado p/ janela):** `hub_identidade_acesso` (identidade↔tenant↔papel) · `users.pessoa_id` (FK).

### 2.3 Convenção de códigos

Código atômico e imutável por entidade/ano via RPC `crm_proximo_codigo` + `hub_codigo_contador`. Trigger `hub_bloquear_alteracao_codigo_negocio` protege o negócio. **Gaps reais:** (a) identidades PES/EMP/IMV/PRD/SVC ainda **não** têm trigger de imutabilidade (gap Tier 1); (b) contador é **GLOBAL** (`(entidade, ano)`), não por-tenant — decisão travada 02/jul: **identidade = global unique agora; contador por-tenant só para DOCUMENTOS** `(tenant, entidade, ano)`; (c) `/api/crm/rastreio` só resolve 6 prefixos (PES/EMP/LED/NEG/PAR/IMO) — `PD/FR/ES/OB/PJ/SV` dão **404**.

**Regra de identidade (travada):** usuário acha tudo pelo **NOME**; código de rastreio é interno/escondido (não expor `PS2026013` na UI). Dedup global **PII-safe**: retorna só `{existe, codigo}`, 409 genérico.

---

## 3. As 2 Altitudes — estado honesto

A "altitude" é a camada de execução sobre a espinha `NEGÓCIO`. Marco de virada: os E/A-designs nasceram com "⚠ design-only / NÃO aplicar" (29/jun); **em 02/jul a janela do dono abriu e o schema AEC foi aplicado** (`AEC-ATIVACAO-BACKLOG`, verificado por query MCP: 6 views, 6 functions, colunas novas em `hub_obras`/itens/pagamentos/orçamentos presentes). **Não repetir "é só desenho" sobre a série E.**

### 3.1 Altitude 2 — Obra / Engenharia (série E) · CONSTRUÍDA

Cadeia: **escopo → orçamento → compra → execução → medição → pagamento → curva-S**, tudo pendurado no item de escopo (`hub_obra_itens`).

| Bloco | O que é | Estado |
|---|---|---|
| **E0/E0b** | Espinha `hub_obras` + `hub_obra_frentes_eap` + taxonomia ambiente→disciplina→atividade (`hub_obra_taxonomia`, FTS GIN) + presets por segmento | **CONSTRUÍDO** (P0 real corrigido: `count` global sem `.eq(tenant)` vazava código → `gerar_codigo_obra(tenant,tipo)`) |
| **E1** | Cockpit "HOJE" + Carteira por urgência (`/crm/obras`) | **CONSTRUÍDO** (gap: card "Previsto" sempre R$0) |
| **E2** | `hub_obra_itens` (item↔subitem `parent_id`) — **Situação=AUTO (cor+🔒) × Andamento=MANUAL (chip)**, nunca colapsam | **CONSTRUÍDO** |
| **E3** | Restrições/bloqueios `hub_obra_restricoes` (1ª classe) | **CONSTRUÍDO** |
| **E4** | Cronograma + Curva-S honesta (baseline append-only + avanço diário; projeção em FAIXA/cone) | **PARCIAL** — estrutura existe, baseline/snapshots não populados |
| **E5** | Compras→Estoque (estende `hub_pedidos_material`; Inventário = view Entrada−Saída+Devolução; cascata via RPC `hub_sc_registrar_entrega`) | **CONSTRUÍDO** — dep. de PRONTO: **seed de ~20 materiais** (bloqueante: compra abre vazia) |
| **E6** | Financeiro + 2 modelos de contrato + **ESCROW** | **CONSTRUÍDO mas GATED/DORMENTE** (ver §6) |
| **E7** | Medição com gate (`medido≤contratado`) + retenção + margem; boletim aprovado CRIA pagamento E6 | **DESENHADO/PARCIAL** — bucket `medicoes` inexistente (foto vazia), medição não-transacional |

### 3.2 Altitude 1 — Arquitetura / Projeto (série A) · construída como átomo, carteira represada

| Bloco | O que é | Estado |
|---|---|---|
| **A0** | Funil de Projeto (kanban `/crm/arquitetura`, clone de negócios) + ficha 5-abas | **CONSTRUÍDO** (schema `20260705140000`). ⚠ A0 **NÃO** re-altera `hub_pipelines.tipo` (E0 já o fez; re-ADD derrubaria `'obra'`) |
| **A1** | Programa de necessidades + loop de aprovação do cliente (reusa `hub_projetos_fases`, zero tabela nova) | **CONSTRUÍDO**; resposta do cliente = "Registrar" manual (portal público = fase 2) |
| **A2** | Elo "Gerar Obra" (projeto→obra via `hub_projetos.obra_id`, zero migração; idempotência pelo `obra_id`) | **CONSTRUÍDO** — `gerar-obra/route.ts` é o **molde canônico** arq→eng (gate server-side + idempotência + linhagem `negocio_id` + tenant-guard) |

**Represado:** `DECISAO-CEO-LAUDO` (01/jul) mandou represar a evolução "Arquitetura funil→carteira" (retrabalho garantido antes do rebuild tenant-first). Tela do arquiteto: `buildArquiteto()` hoje entrega 3 cards estáticos; a **v2** (card-mãe "O que precisa de você" + financeiro isolado em `/crm/arquitetura/financeiro`) é o alvo, gated por E6/ABAC de linha.

### 3.3 Estrutura Unificada (a tese-mãe da obra)

Toda a operação gira em torno de **UM dado — o item de escopo** (`hub_obra_itens`) — que projeta 7 artefatos (memorial, orçamento, contrato, compra, medição, pagamento/escrow, curva-S) por `SELECT`, sem redigitar.

**Decisões TRAVADAS pelo dono (29/jun) — LEI:**
1. **Unificar E2+E6:** `hub_obra_itens` = o ÚNICO item (custo+preço+avanço+datas); `hub_obra_orcamento_itens` = proposta/versão 1:1.
2. `status_escopo` = **reusar** o `tipo` de E2 (estender CHECK).
3. **BDI = fator único por empresa** (`hub_obras.bdi_fator`, planilha usa 1.06). Margem: administração=transparente / preço-fechado=privada (Hub audita cobertura).
4. **Medição/avanço = POR ITEM** (`peso`+`pct_avanco`); ambiente = agregação bottom-up.
5. **Disparidade = AVISA** (amarelo → card na Central; NÃO trava).
6. **Manual-first ANTES de "memorial PDF→IA orça".**
7. Escrow cross-conta OK (`chave1_papel`).
8. Aba "Escopo" nova de 1ª classe.

**⚠ Fios rompidos verificados:** (a) `gerar-obra/route.ts` — o fio Arq→Eng **já foi fechado** (passa `segmento` a `criarObraComEAP`) — não é mais pendência; (b) duas verdades paralelas (`hub_obra_itens` × `hub_obra_orcamento_itens` ligadas por `item_id` nullable `ON DELETE SET NULL`) → `vw_hub_obra_compatibilizacao` filtra `WHERE item_id IS NOT NULL` e **retorna zero se o orçamento nasce sem `item_id`** (bug latente em prod).

---

## 4. RBAC / Multitenant / RLS

Fonte de verdade = **`DESIGN-RBAC-MULTITENANT.md` (03/jul)**.

### 4.1 O problema-raiz (código real)

Dois mapeamentos de papel **desalinhados**: `crmNivelFromRole` (`lib/crm/crm-api-auth.ts`, a fronteira real de API+nav) só entende papéis **PT** (owner/gestor/comercial/financeiro/atendente); papéis **EN** do enum (`commercial`, `operation`, `architect`, `client`, `supplier`, …) retornam **`null` → 403**. Bugs vivos: `commercial` → sidebar vazia + 403; `operation`/`architect`/`client`/`supplier` → 403 total; `broker`/`real_estate` → vazam dashboard comercial do Hub; **escrow quebrado na raiz** (2ª chave exige `gestor`, `architect` nunca vira `gestor`).

**A cura (desenhada):** fonte única server-side `lib/rbac/role-map.ts`, keyed pelos **13 valores do enum `app_role`** (EN canônico), 4 campos ortogonais: `nivel` (owner>gestor/aprovar>operar>ler), `persona` (cockpit/JOB), `escopo_tenant` (hub|guest|proprio|plataforma), `capacidades[]`. `normalizeRole()` de borda dobra PT→EN com log. **Default fail-closed = `restrito`.** O nav **não** é 3º sistema — delega ao guard.

### 4.2 Multitenant híbrido por FASE (= as "altitudes" de acesso)

- **HOJE = MODELO B:** todos os papéis dentro do tenant Hub sentinela; escopo por persona + ownership de linha (ABAC).
- **MODELO A (tenant próprio):** só para quem **licencia** (SaaS) — migração local em `hub_tenants` (`tenant_type='parceiro'` + `parent_tenant_id=Hub`), **não** re-arquitetura de RLS.
- **CLIENTE = sempre GUEST**, nunca tenant/membro (obra pode ter >1 tenant executor). Persona `cliente` isolada por `negocio_id` (vínculo, não tenant); acesso indevido → **404**.
- Regra elegante: **assinatura SaaS = tenant próprio (A); só comissionamento = view no Hub (B); cliente = GUEST.**

### 4.3 Os 13 papéis (enum `app_role`)

- **Hub/staff** (owner, super_admin, admin_hub, admin) — únicos que veem "tenant". `owner` = allowlist fixa de 3 e-mails de plataforma (por isso os "3 P0 de RBAC" do laudo original foram **refutados** — não são dívida).
- **Operacional interno:** commercial, financial, operation, architect.
- **Externo por LINHA/ABAC:** supplier (`fornecedor_id`), **broker+real_estate fundidos em "parceiro"** (`parceiro_id`), client = **GUEST** (`cliente_pessoa_id`).
- **Não-humano:** ai_agent (allowlist fixa) — **a IA NUNCA é chave de escrow**.
- MDO **não é papel** — é registro vinculado ao fornecedor.

### 4.4 Plano de ondas 0→9 (desenhado)

Onda 0 verificar prod → 1/1b/1c **atômicas** (role-map + escrow capability + fail-closed) → 2 UX de bloqueio → 3 telas órfãs (Cliente+Arquiteto) → **4 janela dono-dados (backfill NULL→sentinela + NOT NULL)** → **5 janela-RLS (trocar `x OR tenant_id IS NULL` por `.eq` puro; fechar `USING(true)`)** → 6 auditoria cross-tenant → 7 rotação de chaves → 8 Modelo A → 9 decisão de enum. **Caminho crítico serial-bloqueante:** janela do dono → ligar IA/middleware → RLS+backfill tenant → escrow correto → multi-tenant dinâmico → entitlements → ativação AEC.

---

## 5. Rastreabilidade & Linhagem

Veredito honesto (`DESIGN-RASTREABILIDADE` + `MAPA-CONEXOES`): **~80% da spec do dono JÁ construída** — código atômico imutável, dedup CPF/CNPJ, `hub_eventos` append-only, N:N `hub_negocio_vinculos`, esteira negócio→entrega idempotente com confirmação humana.

**Linhagem imutável (decisão CEO):** negócio tem **pai/raiz imutável** (trigger congela `negocio_pai_id`); **raiz = a primeira oportunidade da jornada no Hub** (NÃO hardcode "raiz=ARQ"). "Fechar linhagem" = `negocio_id` viaja negócio→projeto→obra (A0/A2 preservam).

**🔴 Gaps estruturais (o trabalho real):**
1. **Linhagem `negocio_pai_id`/`negocio_raiz_id` é DORMENTE** — lida na UI, mas **nunca escrita** pelo app (só seed SQL).
2. Árvore de negócios e esteira de entregas são **grafos separados**.
3. **Especialista/MDO ilhado** (sem FK obra↔especialista → não se rastreia quem executou).
4. **Imóvel desconectado** (FKs de captação nunca gravadas).
5. Parceiro some do "Relacionados".

**🟡 Semânticos:** `lead_id` ambíguo (FK aponta p/ `hub_leads` legado; verdade está no vínculo); papéis fragmentados sem enum central; atores de compra são TEXTO, não FK; fornecedor da cotação vive em JSON.

**Decisões travadas 02/jul:** matar o **spawn mágico** (ganho→obra vira **propor+confirmar**, 1 clique humano — ⚠ `AUDITORIA-VISAO-DEFINITIVA` alerta que ainda há PATCH etapa→ganho que auto-insere obra: **P0 a corrigir**); IDENTIDADE GLOBAL AGORA; criar `hub_identidade_acesso` + `users.pessoa_id`.

---

## 6. Motor Financeiro-Técnico

**Princípio-mãe (arbitra tudo):** *uma base, um snapshot, um trilho, duas moedas que nunca se misturam.* O mesmo padrão **append-only / snapshot imutável / estorno = linha negativa** aparece 3× (comissões, Tijolos, escrow) — **uma regra, três instâncias.**

### 6.1 Trilho único de dupla-chave (o alicerce reusado por tudo)

= **DOIS registros em `hub_aprovacoes`** ligados ao mesmo pagamento, papéis distintos; libera só quando **ambos** `aprovado`. RPCs `SECURITY DEFINER` com guard de tenant ANTES de mutar (porque `crmDb` bypassa RLS): `rpc_aprovar_orcamento_frente`, `rpc_liberar_escrow` (retorna `aprovacao_dupla_incompleta` se falta chave). **A IA nunca é chave** — prepara o card, humano clica. Aprovador único (escritório pequeno) = 2 atos separados em log, nunca 1 clique = 2 chaves.

**Escrow — decisão travada do dono (03/jul), supera "chave_arquitetura":** escrow é **UNIVERSAL** (todos os pagamentos). **Duas chaves = mesma coisa** (capability = role + vínculo de linha + identidade humana distinta, **nunca deduzida de rank**): **Chave Hub** (pessoa física/allowlist do tenant Hub raiz) + **Chave Técnica** (`escrow:chave_tecnica`: **arquiteto** em projetos via `responsavel_id`, **engenharia/`operation`** em obra/prestadores). Nunca o mesmo humano nas duas. Escrow **rejeita todo caminho não-humano**.

**Estado do escrow (E6):** 5 tabelas construídas (`hub_obra_orcamentos`, `_itens`, `hub_obra_pagamentos` com Gate 2 duplo `aprovacao_arq_id`+`aprovacao_hub_id`, `hub_obra_escrow_contas`, `_movimentos` append-only). **DORMENTE/seguro** — nenhum código invoca `rpc_liberar_escrow` automaticamente. MVP = escrow **VIRTUAL/contábil** (`provedor='interno'`; custódia é estado contábil, não banco real; BaaS/conta escrow real = fase 2, decisão do dono em aberto). **⚠ bug do `GREATEST` latente** atrás do gate humano (fix #5 antes de usar escrow). **Pré-req herdado:** `lib/ia/aprovacoes.ts` (`buscar/aprovar/rejeitar`) roda **sem `.eq('tenant_id')`** → um tenant aprovaria escrow de outro — **fix é pré-requisito de go-live**.

### 6.2 Motor de comissões (rede) — CONSTRUÍDO + TESTADO, GATED

Base do split = **POTE** = `valor_fechado × percentual_comissao` (colunas que já existem em `hub_negocios`). Fatia = % do pote, nunca % do valor. **4 tabelas novas** (o desenho canônico):

1. **`hub_split_regras`** — onde a regra nasce (config mutável, delete=arquiva). Precedência determinística 4 degraus: ajuste manual → regra `escopo='negocio'` → regra `escopo='parceiro'` (casa papel) → fallback `hub_parceiros.comissao_pct` (5%). Sem regra → 100% fica no Hub.
2. **`hub_comissoes`** — o **SNAPSHOT** (append-only, congelado por VALOR), `moeda CHECK('BRL')` (trava BACEN), `estorna_comissao_id` (correção = linha negativa, nunca UPDATE), sem coluna de status. Fatia do Hub = linha explícita `regra_origem='residual_hub'`.
3. **`hub_negocio_titulos`** — financeiro por-negócio (contas a pagar/receber); `valor_exigivel` = coração do **cash-basis**. Gate 2 duplo: `pagamento_comissao_ok` + `pagamento_comissao_hub`. `rpc_liberar_pagamento_comissao` = clone da `rpc_liberar_escrow`.
4. **`hub_negocio_fin_movimentos`** — extrato append-only ("uma linha, duas lentes": o `pagar` do negócio é o "a receber" do participante).

**Ciclo de vida (5 estados):** PREVISTA → **APURADA** (ganho PROPÕE, humano CONFIRMA — nunca automático no drag do kanban) → EXIGÍVEL (cliente pagou, pro-rata) → APROVADA (2 chaves) → PAGA (baixa manual + comprovante).

**Cash-basis (travado):** `rpc_registrar_recebimento_negocio` distribui pro-rata; **o Hub nunca financia a rede com caixa próprio.**

**Anti-pirâmide:** Nível 1 (fase 1) = quem está em `hub_negocio_vinculos` com papel remunerável. Nível 2 (fase 2) = `indicado_por` self-FK com **hard-stop CHECK `nivel IN (1,2)`** — nível 3+ não existe; recompensa nível 2 = bônus em Tijolos não-sacáveis.

**Decisões travadas na memória do CEO (superam os "pendentes" do doc):** **clawback = COBRAR SEMPRE** (título de estorno a receber; supera pendência #12) · base = pote · cash-basis · snapshot no CONFIRMAR humano · fechar linhagem.

**Riscos verificados no código:** `hub_negocio_vinculos` tem `USING(true)` + GRANT anon (apertar é pré-condição) · `PUT /api/crm/ia/config` aceita `markup` 0/negativo (route.ts:41 = IA de graça, fix code-safe).

### 6.3 Tijolos / Blocos / Carteira (metering)

**NÃO existe moeda nova.** O Tijolo já existe em prod como crédito de IA (`lib/ia/metering.ts` + `hub_ia_creditos_mov`). "Moeda ampla" = promover esse ledger a Carteira do Tenant (migração aditiva). Criar 2ª moeda = único erro fatal.

- **Paridade:** 1 Tijolo = R$0,10 → 1 Bloco = 100 Tijolos = R$10,00 (de `hub_ia_config.valor_credito_brl`). "Compra em Blocos, gasta em Tijolos", vocabulário bancário (nunca de jogo).
- **Ledger:** evolução aditiva com `origem` (topup_pix/consumo_ia/franquia/bonus/comissao/…), `idempotency_key`, `estorna_mov_id`, trigger de imutabilidade. **Pré-req duro: backfill + `SET NOT NULL` em `tenant_id`** (hoje nullable = tenant-null-leak). Saldo via `rpc_carteira_saldo` no Postgres.
- **Fronteira Tijolo × Escrow (trava regulatória firme):** Tijolo = crédito pré-pago, **NÃO sacável nem transferível**; Escrow = dinheiro real, sacável, trilho E6. Ponte = referência cruzada (`ref_id`), **nunca** transferência de valor. Comissão sacável = **BRL sempre**; Tijolo nunca é comissão.
- **Top-up:** `hub_carteira_topups` (`aguardando→pago→creditado`); Tijolo só nasce em `pago` via RPC idempotente. Fase 1 = **PIX manual, baixa manual do Hub**.
- **Ordem de fases (trava):** Carteira → top-up → régua de aviso 7/3/1 → **só então** `IA_HARD_CAP=on` (bloquear IA sem recarga = matar o copiloto).
- **Planos SaaS (a validar preços):** FUNDAÇÃO ~R$99 · ESTRUTURA ~R$249 · ACABAMENTO ~R$499 · REDE (sem mensalidade). Entitlements `hub_planos` **NÃO existem** ainda.

### 6.4 Orçamento IA (o "moat") — DESENHADO, gated por Mistral OFF

Pipeline: PDF memorial → extrai texto → **IA CLASSIFICA na taxonomia** ambiente→disciplina→atividade → quantidade (memorial ou CONFIRMAR humano) → precifica (determinístico) → grava orçamento E6 → tela "A IA montou, confirme". Insight-chave: serializar a taxonomia no system prompt transforma extração-livre (impreciso) em **classificação** (preciso, auditável). Ordem obrigatória: E6 → marketplace → FASE 0 taxonomia → pipeline. IA **nunca aprova**. Ativo estratégico = lista real de atividades da planilha do Consulado Itália (20 abas).

---

## 7. Segurança

**Placar Supabase advisors:** **0 ERROS**, só WARN/INFO. `search_path` das funções já hardened (`20260701235500`). Pendente: toggle "Leaked Password Protection" (1 clique no painel).

### 7.1 Fechado / em fechamento

- **H-SEC-1** (`NEXT_PUBLIC_INTERNAL_API_KEY` embarcada no bundle do browser) — **fix shipado deploy #17 (30/jun)**; ROTEIROS mandam remover a var do Render. Padrão correto de referência já no projeto: portal do parceiro usa **HMAC-SHA256 + `timingSafeEqual`** (`lib/parceiro-portal.ts`).
- **Faixa A (tenant-null-leak, code-safe)** — **commitada** (`02f6471`, 05/jul): `fornecedores`, `alertas/parados`, `canais-entrada`, `auditor-autonomo`, guarda no SELECT de `hub_parceiros`; especialista antes (`a2b2566`).
- **Janela 06/jul** — 24 policies `USING(true)` fechadas, 7 funções anônimas revogadas, índice redundante dropado.

### 7.2 Latente / bombas-relógio pré-2º-tenant

- **Anti-padrão `tenant_id.is.null`:** 5 leaks reais (todos LATENTES, nenhum explorável hoje com 1 tenant) + 6 intencionais (`hub_catalogo`, `hub_ia_config`, `hub_pipelines`, `hub_obra_taxonomia` = `NULL=global`, **não tocar**). Disparam sozinhos no go-live multitenant.
- **Faixa B (precisa janela do dono):** `buscar-pessoa-documento` = oráculo de CPF/CNPJ + **1 linha NULL viva em `hub_pessoas`** (backfill `20260530120000` **não concluído**). Sequência: backfill NULL→sentinela → `.or→.eq` → reescrever teste que institucionaliza o leak → `UNIQUE(tenant_id, documento)` → guardas `row.tenant_id!==tid`. **⚠ Faixa B = ENDURECIMENTO, NÃO leitura da rede.**
- **Dívida residual:** helper `tenantScopeOrFilter` é a raiz do mesmo padrão em `app/api/leads`, `parceiros`, `[id]`, `atendimento-handoff.ts`.
- **Zero policy / `USING(true)`:** `hub_pedidos_material` e família `hub_parceiros_*`. `hub_negocio_vinculos` `USING(true)` + GRANT anon (sob o dinheiro).
- **`lib/ia/aprovacoes.ts` tenant-blind** (§6.1) = pré-requisito de go-live do escrow.
- **SEC-8:** `registrarConsumoIA` faz 2 inserts sem transação — Fase 1 da carteira fecha via RPC atômica.
- **SEC-7 (aberto, acionável):** tools de escrita da IA não gravam auditoria em `hub_acoes_ia`/`hub_eventos` — resolver junto da Central de Aprovações.

### 7.3 Rotação de chaves (procedimento pronto, aguarda janela do dono)

`service_role` legacy (JWT `eyJ…`, viva até 2036) possivelmente comprometida (esteve no repo do dev demitido). Plano zero-downtime: criar `sb_secret_`/`sb_publishable_` novas (convivem) → trocar no Render → apagar `NEXT_PUBLIC_INTERNAL_API_KEY` → testar → desativar legacy. **⚠ ambos os ROTEIROS usam ref `cdjlqsznerdhwqyunodl` — checar contra OBRA10 (`zollengyqtmyhnbrkepu`) antes de executar** (§1).

---

## 8. Invariantes travados (LEI — repetidos em ~todos os designs)

1. **Tenant guard explícito:** todo endpoint/view filtra `.eq('tenant_id')` E `obra_id` puro — nunca `.or(...is.null)`. Views `security_invoker=true` = dupla defesa.
2. **Humano aprova o dinheiro; voz nunca escreve financeiro.** A IA lê livre, escreve só com "Confirmar"; **a IA nunca é chave do escrow**. Régua de autonomia: nível 4 (escrow/pagamento/aditivo/SST/`tipo_contrato`) = **nunca por IA**.
3. **Append-only** no que é dinheiro/prova (escrow_movimentos, medições, comissões, baseline, estoque_mov, ledger de Tijolos); correção = nova linha/versão, nunca UPDATE destrutivo.
4. **Cascatas = RPC idempotente no endpoint, NÃO trigger de banco** (triggers escondem magia, disparam em import batch, laço).
5. **Delete = ARQUIVA** — o Hub nunca apaga (soft-delete + `hub_eventos` + backstop service_role).
6. **Situação (auto) × Andamento (manual)** = canais visuais distintos, nunca colapsam.
7. **Degradação graciosa:** `isMissingPgColumn`/`migracao_pendente` + fallback in-code → sem migração/sem Mistral a UI avisa honesto e nunca quebra.
8. **Migração aditiva/reversível/idempotente** — "nada quebra"; migrações em prod = sempre janela do dono.
9. **Situação de segurança sob service_role:** o código é a barreira nº1; toda RPC que muta valida tenant ANTES.

---

## 9. O que descartar (superado — consta no histórico)

| Doc / conceito | Por quê |
|---|---|
| `documento-mestre-obra10-v1`, `01_documento_mestre` | Era single-tenant/Anthropic/Vercel/28-agentes de maio; a "alma" (3 pilares) sobrevive, o resto é snapshot |
| `database-schema-context`, `crm-schema-audit`, `crm-modelo-dados`, `crm-gate0-inventory` | Pré-pacote-integral; superados por `MAPA-CONEXOES`; valem só como genealogia de migração |
| `hub_cotacoes` como tabela | **Inexistente**; o real é `hub_cotacoes_pedidos`/`_respostas` (+ `cotacoes_json` no item v1) |
| `hub_marcenaria`/`hub_vidracaria` (1 tabela por ofício) | **Tabelas-fantasma a aposentar**; fornecedor = CONTA multi-tenant, serviço = instância leve do átomo `hub_obras` |
| `crm_commissions` (tabela morta) | Não reusar; nomes `hub_*` novos |
| `escrow:chave_arquitetura` | Superado por **Chave Hub + Chave Técnica** (03/jul) |
| "3 P0 de RBAC" do laudo (owner vê preço/desativa tenant) | **Refutados** — owner = allowlist fixa de 3 e-mails de plataforma |
| Marcador "⚠ design-only" na série E/A | **Superado** — schema AEC aplicado 02/jul |
| Cockpit "DINHEIRO DO HUB cross-tenant" (AUDITORIA-DASHBOARD-CEO) | **Bloqueado** pelo single-tenant + comissões gated — é NORTE, não pendência acionável agora |

---

## 10. Pendências técnicas que atravessam este master (ponteiro p/ o Painel)

**Depende do dono (1 janela):** rotacionar chaves-mestras · **ligar IA (`MISTRAL_API_KEY`)** · Faixa B / backfill tenant NULL → `.eq` puro · aplicar migrações represadas · seed de ~20 materiais (bloqueante de compras) · escolher BaaS/KYC (escrow real) · confirmar project-ref de prod.

**Código acionável:** fix `lib/ia/aprovacoes.ts` tenant-blind · SEC-7 (auditoria de escrita da IA) · fix `markup>=1` no PUT config · corrigir spawn mágico ganho→obra (propor+confirmar) · escrever linhagem `negocio_pai_id` no app (hoje dormente) · fix bug `GREATEST` antes de usar escrow.

**Decisão do dono:** faixa×valor exato · planos SaaS (preços) · markup de créditos · modelo A/B + quando ligar 1º tenant · Hub vê margem no preço-fechado? · captação pública (liga middleware).

---

*Fim. Este master é derivado — quando conflitar com o código real ou com `MODELO-DE-NEGOCIO-E-FLUXOS-COMPLETO` / `00-PAINEL-DE-CONTROLE`, estes vencem.*

---

## Invariantes de Engenharia (critério de rejeição de PR — do CADERNO §16)

Estas já existem no sistema e reprovam um PR se violadas. Backlog técnico completo: **[CADERNO-ENGENHARIA-AUDITORIA.md](CADERNO-ENGENHARIA-AUDITORIA.md)** e **[04-ROADMAP-E-PLANO.md](04-ROADMAP-E-PLANO.md)**.

1. **Dinheiro só com humano distinto.** `escrow:chave_hub` ≠ `escrow:chave_tecnica`, nunca a mesma pessoa; IA/worker/chave interna nunca aprovam; nunca por voz.
2. **Duas moedas nunca somam na UI.** Tijolo (não-sacável) e BRL (comissão sacável) em ledgers separados; `hub_comissoes.moeda CHECK='BRL'`.
3. **Append-only onde há dinheiro/prova.** Correção = linha negativa/estorno, nunca UPDATE/DELETE (`trg_hub_comissoes_imutavel`, `hub_append_only_guard()`).
4. **Delete só arquiva.** `arquivado_em`, nunca `DELETE FROM` em ação de usuário.
5. **`tenant_id` sempre da sessão**, nunca do body; posse por 404, não 403.
6. **Defesa na query.** No preço fechado, o endpoint NÃO seleciona `valor_unitario`.
7. **Estender CHECK junto com vocabulário** (atividades, aprovações, tipos) — senão insert quebra silencioso.
8. **Migração = aditiva, reversível, na janela do dono.** Nada aplicado à mão sem virar arquivo versionado.

> **Estado real do multitenant (do CADERNO §3):** hoje single-tenant (sentinela `00000000-0000-4000-8000-000000000001`); `crmDb()` usa service_role e **bypassa RLS** — a barreira primária é o filtro `.eq('tenant_id')` no código. As WIs TEN-01..04 e RBAC-01..05 são **gate absoluto** antes do 2º tenant (ver 04-Roadmap Fase 5).
