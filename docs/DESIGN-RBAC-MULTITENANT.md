# Design — Matriz de Atribuições (RBAC) + Modelo Multi-Tenant

> **Status:** proposta para aprovação do dono · **Data:** 2026-07-03 · **Branch:** wendel/dev
> **Escopo:** desenho de papéis, permissões por tela e tenancy. **Não é código** — é o mapa que o código vai seguir.
> **Fiel aos princípios:** código de identidade escondido (o usuário chama pelo NOME) · DELETE = ARQUIVA (nunca apaga) · Hub = juiz/auditor · cockpit por persona (cada um vê o SEU job) · Central de Aprovações unificada · Click-and-Go / Talk-and-Go · design system dark **verde + dourado** (`--obra-*`), nunca o azul/Shadcn.

---

## 1. Resumo executivo + o gap que resolve

### O gap (confirmado no código real)

Hoje existem **DOIS** sistemas de papel desalinhados — não três. (Correção importante: `filterCrmNavGroupsForRole` **já** delega 100% para `crmPodeVerRota → crmNivelFromRole`, o mesmo guard das rotas de API. O nav **não** é uma terceira implementação — é consumidor fiel do RBAC. A duplicidade real é só entre estes dois:)

1. **`lib/crm/crm-api-auth.ts` (`crmNivelFromRole`)** — a fronteira de segurança de verdade (guarda de API + nav). Entende papéis em **PT/legado** (`owner`, `gestor`, `comercial`, `financeiro`, `atendente`). Para os papéis do ecossistema em **inglês** (`commercial`, `operation`, `architect`, `client`, `supplier`, `admin_hub`, `super_admin`, `broker`, `real_estate`) retorna **`null`** → `requireCrm*` devolve **403**.
2. **`lib/crm/persona-cockpit.ts` (`personaCockpitFromRole`)** — só decide qual cockpit de UI renderizar. Entende os papéis em inglês, mas cai em **`comercial` por default** e manda `broker`/`real_estate` para o **dashboard comercial completo do Hub**.

**Sintomas vivos:**

- **Ariane (`commercial`)** → `crmNivelFromRole` retorna `null` → **sidebar vazia + 403 em todo o CRM**. Caso mais urgente.
- **`operation` / `architect` / `client` / `supplier`** → 403 em tudo; veem só um cockpit com cards mortos (`—`).
- **`broker` / `real_estate`** → paradoxo: o cockpit os joga no **dashboard comercial completo do Hub** (vazamento de visão gerencial) **e** 403 nas rotas abaixo.
- **Escrow quebrado na raiz:** a 2ª chave (Arquitetura) exige nível `gestor` e `architect` nunca vira `gestor` → a **dupla-chave não fecha**.

### A cura (uma frase)

Uma **fonte única server-side** (`lib/rbac/role-map.ts`), keyed pelos **13 valores canônicos do enum `app_role`** (inglês), onde cada papel carrega **4 campos ortogonais** — `nivel` (o que pode commitar), `persona` (qual cockpit/JOB), `escopo_tenant` (hub | guest | próprio-ao-licenciar | plataforma) e `capacidades[]` (ações discretas, incluindo as chaves do escrow). Os dois mapeamentos de hoje passam a **ler desse único mapa**. Default **fail-closed**: papel desconhecido = sem nível, cockpit "sem acesso configurado" — **nunca** o dashboard do Hub.

### Decisões estruturais que atravessam tudo

- **RBAC-first para o QUE pode + ABAC de linha OBRIGATÓRIO para personas externas.** Papel sem checagem de linha é IDOR-por-papel: `client` por `cliente_pessoa_id`, `supplier` por `fornecedor_id`, `architect` por projeto vinculado, parceiro por `parceiro_id`.
- **As DUAS chaves do escrow são a MESMA coisa:** capability explícita `role + vínculo de linha + identidade humana distinta`, **nunca** deduzida de rank. (Corrige o furo em que qualquer papel que ganhe nível `owner`/`gestor` reabre o cofre.)
- **Multi-tenant híbrido por FASE:** hoje TODOS são papel dentro do tenant Hub (modelo B); tenant próprio (modelo A) só para quem **licencia** a plataforma, e só **depois** da janela do dono endurecer RLS+backfill. O **cliente é sempre GUEST**, nunca membro de tenant.
- **Isolamento vem SÓ da sessão** (cookie httpOnly), jamais de header do browser. Como `crmDb()` é service-role e **bypassa RLS**, a barreira **primária** é o filtro `.eq('tenant_id', ctx.tenantId)` puro no código; RLS é camada 2.

---

## 2. Fonte única: papel → (nível + persona + escopo + capacidades)

**Um módulo canônico: `lib/rbac/role-map.ts`.** Dono único da verdade. Keyed pelos 13 valores do enum `app_role`. Cada entrada tem 4 campos **ortogonais** (não confundir nível com persona — são eixos diferentes):

| Campo | O que responde | Valores |
|---|---|---|
| **`nivel`** | O que a pessoa pode **commitar** / autoridade | `owner` > `gestor`/aprovar > `operar` > `ler` · **escada linear só para papéis internos do Hub.** Papéis externos têm conjunto próprio, `null` na escada. |
| **`persona`** | Qual **cockpit / JOB** de UI | `hub-auditor` · `comercial` · `financeiro` · `engenharia` · `arquiteto` · `fornecedor` · `parceiro` · `cliente` · `restrito` (fail-closed) |
| **`escopo_tenant`** | Onde a pessoa enxerga | `hub` · `guest` · `proprio-ao-licenciar` (futuro) · `plataforma` (cross-tenant, só staff Hub) |
| **`capacidades[]`** | Ações discretas + chaves | lista fechada; inclui `escrow:chave_hub` e `escrow:chave_arquitetura`, atribuídas por **papel + vínculo de linha**, jamais por rank |

**Regras duras da fonte única:**

- **`normalizeRole()` de borda** dobra os sinônimos PT/legado (`comercial=commercial`, `financeiro=financial`, `admin=gestor`, `vendedor`/`atendente`) **UMA vez**, com **log de uso** em `hub_eventos` para forçar o backfill — nunca espalhados pelo código.
- **Três consumidores leem o mapa, um só é fronteira:** `requireCrm*` (guarda de API — a fronteira REAL de segurança); `filterCrmNavGroupsForRole` (nav — conveniência de UX, já delega ao guard); `personaCockpitFromRole` (cockpit — conveniência de UX). **Nav e cockpit nunca são fronteira de segurança.**
- **Default absoluto fail-closed:** papel não mapeado → `nivel=null`, `persona='restrito'`, `capacidades=[]`, escopo nenhum → tela neutra "sem acesso configurado". **Nunca** o dashboard comercial.
- **Toda nova entrada de papel nasce no guard do servidor.** O nav e o cockpit são derivados.

**Nota de arquitetura (correção de crítica):** preencher `role-map.ts` corrige `nivel`/`persona` e destrava o `requireCrm*` (API) para os papéis internos do Hub. Mas **NÃO** produz automaticamente um nav coerente para as personas externas: `CRM_NAV_GROUPS` + `ROTA_MIN_NIVEL` são keyed nas rotas Hub-internas (`/crm/leads`, `/crm/negocios`, `/crm/financeiro`), desenhadas para os ranks PT. As personas externas **não navegam por ali** — renderizam o próprio cockpit (`persona-cockpit.ts` via `app/crm/page.tsx`). Por isso o **nav próprio de cada cockpit externo é entregável explícito** (Onda 2/3), não subproduto da Onda 1.

---

## 3. Matriz dos 13 papéis

> Rótulo de UI = **título humano do job** (ex.: "Engenharia", "Arquiteto"), **nunca** o valor cru (`operation`, `architect`). Código de identidade escondido.

### 3.1 Cluster Hub (staff — os únicos que veem o conceito de "tenant")

| Papel | Nível | Persona | Escopo tenant | PODE | NÃO PODE |
|---|---|---|---|---|---|
| **owner** | Autoridade máxima de NEGÓCIO no tenant Hub + capability `escrow:chave_hub` (pessoa física — hoje só Wendel: nice.engemp + obradezmais) | hub-auditor | **hub** (hoje = ecossistema inteiro, pois só existe o tenant sentinela) | Ver/configurar tudo no tenant Hub; **operar as bancadas de trabalho do dia a dia** (funil, obra, financeiro — ver §5.1); ser a **Chave Hub** do escrow; editar regras comerciais centrais (modelos de contrato, BDI, split), integrações, precificação; gerir usuários/papéis (arquivar); ver linhagem/auditoria completa (`hub_eventos`) e o ledger de custódia | Ser a **Chave Arquitetura do MESMO pagamento** (segregação de funções é regra dura); mover fundos sem log; **apagar** (owner também só arquiva); ser removido/arquivado por papel abaixo |
| **super_admin** | Plataforma — staff técnico Obra10+, **cross-tenant READ-only**; escrita só via break-glass auditado | hub-auditor global (sala de máquinas) | **plataforma** (único papel legitimamente multi-tenant; só quando o usuário pertence ao tenant Hub raiz, `tenant_type='hub'`) | Ler métricas/dados de TODOS os tenants para suporte/auditoria (via **guard SELECT-only dedicado** — ver §4); manutenção/provisionamento; observador na Central de Aprovações | Ser **qualquer** chave do escrow; **escrever** cross-tenant fora de break-glass nomeado e logado; alterar quem é owner; hard-delete |
| **admin_hub** | Operacional do Hub — mesma banda cross-tenant de `super_admin` no RLS (`is_hub_admin` trata os dois igual), READ-first | hub-auditor (operacional) | **plataforma** (staff Hub, leitura cross-tenant) | Auditar métricas de todos os tenants (leitura); operar config operacional do Hub (não-financeira); regras de distribuição de leads/comissão; gerir equipe do tenant Hub | Ser chave de escrow; escrever cross-tenant fora de break-glass; integrações/precificação estratégica (owner-only). **⚠️ Candidato a fusão em `super_admin`** enquanto não houver staff-plataforma real (ver decisão D4) |
| **admin** | Gestor **técnico** do tenant Hub (Ramon/dev) — rank de gestor, **sem** poder de negócio | hub-auditor (variante técnica) | **hub** (LOCAL — NÃO cross-tenant) | Config técnica, integrações operacionais, agentes/IA, EAP/config, logs/erros; gerir equipe operacional; aprovações operacionais do dia a dia | Ser **Chave Hub NEM Chave Arquitetura** (bloqueio explícito por papel — rank "gestor" não qualifica); ser owner (drift a corrigir: **remover Ramon de `CRM_OWNER_EMAILS`**); editar regras comerciais/precificação; acessar dado financeiro/pessoal de cliente além do necessário a suporte (com trilha "modo suporte") |

### 3.2 Cluster operacional interno (tenant Hub)

| Papel | Nível | Persona | Escopo tenant | PODE | NÃO PODE |
|---|---|---|---|---|---|
| **commercial** | Operar comercial (= antigo PT `comercial`, reconhecido também em inglês) — Ariane e vários | comercial | **hub** | Funil/Kanban, leads, negócios, cadastro (pessoa/empresa), atendimento, canais, tarefas, propostas do próprio tenant; converter lead em negócio | Ver financeiro/escrow (bloqueio **ortogonal**, não hierárquico — comercial de rank alto não entra no financeiro); aprovações de nível gestor; gerir usuários/config; ver outro tenant; ser chave de escrow. **🔴 BUG VIVO:** `commercial`(EN) → `null` → Ariane sidebar vazia + 403 |
| **financial** | Financeiro — **conjunto exato** de capacidades (não rank) | financeiro | **hub** | Contas a pagar/receber, conciliação, relatórios; ver o ledger/custódia do escrow (**somente leitura**); emitir cobranças, registrar baixas | **Liberar escrow sozinho** — não é chave por padrão (só se o dono designar — ver D6); editar leads/negócios fora do escopo; gerir equipe/papéis. **🔴 BUG:** `financial`(EN) → `null`; só `financeiro`/`finance` passam hoje |
| **operation** | Operar obra — papel operacional próprio (fora da escada de rank), escopo tenant + **obra atribuída (ABAC de linha)** | engenharia | **hub** (+ ABAC por obra alocada) | Obras/cronograma/EAP/escopo/medições/pedidos-SC/estoque das obras do próprio tenant; **lançar** medição, registrar avanço, abrir pedido, **enviar** medição para aprovação | **Aprovar a própria medição** (segregação: quem lança não aprova — aprova o cliente/arquiteto); ver obras fora da alocação; financeiro amplo do Hub; ser chave de escrow. **🔴 HOJE:** `operation` → `null` → 403 |
| **architect** | Aprovar (gestor-equivalente **NÃO-owner**) + capability `escrow:chave_arquitetura` — por **role explícito + vínculo de linha ao projeto**, NUNCA por rank | arquiteto | **hub** (+ ABAC por projeto vinculado; candidato a modelo A se for escritório terceirizado) | Projetos/fases atribuídos: fila de aprovação de entregáveis, briefings, disparidade orçamento×projeto; **aprovar fase**; ser a **Chave Arquitetura** SOMENTE nos projetos em que é o responsável (`responsavel_id`) | Aprovar/liberar escrow de projeto a que **NÃO** está vinculado (checagem de LINHA); ser Chave Hub (segregação owner × arquitetura); liberar dinheiro sozinho; pipeline comercial/financeiro do Hub além do necessário. **🔴 CRÍTICO:** `architect` → `null` → dupla-chave quebrada na raiz |

### 3.3 Cluster externo (hoje modelo B; escopo por LINHA, não tenant-wide)

| Papel | Nível | Persona | Escopo tenant | PODE | NÃO PODE |
|---|---|---|---|---|---|
| **supplier** | Operar escopado externo — **só os próprios direcionamentos** (row por `fornecedor_id`) | fornecedor | **hub** hoje (view por `fornecedor_id`) → **próprio** ao licenciar (modelo A) | Ver cotações/ordens **direcionadas a ele**, aceitar/recusar, responder cotação; acompanhar os SEUS pedidos e cadastro | Ver cotações/preços/ordens de **outros fornecedores** (mesmo no mesmo tenant — escopo por `fornecedor_id`); ver a fila **global** de distribuição do Hub; CRM/financeiro do Hub; ser chave de escrow. **Gap:** não há tela "meus direcionamentos" hoje |
| **broker** | Parceiro (indicação/comissão) — escopo externo, **só os leads próprios** (row por `parceiro_id`) | **parceiro** (fundida com `real_estate`) | **hub** hoje (por `parceiro_id`) → **próprio** ao licenciar | Cadastrar/indicar leads próprios; acompanhar status de encaminhamento e comissão **do que ele trouxe** | Ver leads/negócios/comissão de **outros parceiros**; mover negócio de terceiro; funil comercial completo do Hub; financeiro; obras. **🔴 BUG VIVO:** cockpit joga `broker` → dashboard comercial completo (vazamento) + 403 abaixo |
| **real_estate** | Parceiro — mesmo tratamento de `broker` | **parceiro** (fundida com `broker`) | **hub** hoje (por `parceiro_id`) → **próprio** ao licenciar | Idem `broker`, escopado à carteira de imóveis/leads próprios | Idem `broker`. **Colapso:** PF (`broker`) vs PJ (`real_estate`) fazem o MESMO job → **1 persona "parceiro"**; PF/PJ é **atributo do cadastro**, não papel. Ambos os valores do enum permanecem gravaveis (aditivo) |
| **client** | Convidado escopado (**GUEST**) — a persona mais sensível e estratégica; escopo por `cliente_pessoa_id`, nunca tenant-wide | cliente | **guest** (cross-tenant: janela escopada para a SUA obra, que pode ser executada por >1 tenant — **NUNCA** membro de tenant) | Ver SÓ a(s) própria(s) obra(s): avanço real por item, cronograma/prazo, canal com a equipe; **aprovar** medição/fase da própria obra; ver o saldo em **custódia/escrow** do SEU contrato (retido × liberado) | Ver qualquer outra obra/dado de outro cliente; custos internos/margem do Hub/fornecedor; operar CRM; editar cronograma; ser chave de escrow (é o **beneficiário**, não autoridade). **Gap:** NÃO existe tela dedicada — só cards `—`. Falta `/minha-obra` + inbox de aprovação + custódia. **Falta policy RLS** equivalente ao `buildCliente` do app |

### 3.4 Não-humano

| Papel | Nível | Persona | Escopo tenant | PODE | NÃO PODE |
|---|---|---|---|---|---|
| **ai_agent** | Principal de **serviço** não-interativo (system) — **allowlist fixa** de ações, NENHUM rank humano | **nenhuma** (sem assento de UI; server-to-server) | tenant do **contexto** da conversa/negócio que processa (grava sempre o `tenant_id` correto do pai; nunca cruza) | Executar ações pré-aprovadas via `hub_autonomia_matriz` (responder, sugerir, rascunhar, auto-aprovar trivial), sob rate-limit por tenant/usuário/IP + HMAC/`INTERNAL_API_KEY` | Ser contado como "gestor" ou qualquer nível (deve ser **estruturalmente impossível**); autenticar via cookie humano; ter cockpit; ser chave de escrow; **aprovar dinheiro** (ver §4 — escrow rejeita todo caminho não-humano); cair no default → `comercial`; exceder limite de autonomia/gasto |

> **MDO (mão de obra, sem login)** — **não é papel do enum**, não tem assento nem tela própria. É **registro** vinculado ao fornecedor, cadastrado/alocado pela persona **Engenharia** (`operation`). Falta a superfície de cadastro/alocação (gap de produto — Onda 3).

---

## 4. Modelo multi-tenant recomendado + por quê

**Recomendação: híbrido por FASE, com a tenancy amarrada ao TIER de negócio.** Regra elegante e única:

> **Assinatura SaaS = vira tenant próprio (modelo A).** **Só comissionamento/direcionamento = continua view no Hub (modelo B).** **Cliente = sempre GUEST, nunca tenant.**

### Fases

1. **HOJE / DEFAULT = MODELO B.** Todos são **papel** dentro do tenant Hub (sentinela `00000000-0000-4000-8000-000000000001` = efetivamente single-tenant), com visão filtrada por persona + **ownership de linha** (`cliente_pessoa_id`, `fornecedor_id`, `parceiro_id`, projeto). É o que a realidade suporta **sem** depender da janela de RLS.
2. **UPGRADE = MODELO A (tenant próprio isolado).** `supplier`/parceiro/`architect`-escritório que **licencia** vira tenant próprio; o Hub o enxerga por view cross-tenant (`super_admin`/`admin_hub`) e continua distribuindo lead + auditando. A troca B→A é **migração local** (criar linha em `hub_tenants` com `tenant_type='parceiro'` + `parent_tenant_id=Hub`, mover as linhas daquele fornecedor/parceiro para o novo `tenant_id`, dar-lhe um `owner` local) — **não** re-arquitetura de RLS, pois o RLS já é 100% baseado em `tenant_id` + `current_user_tenant_id()`.
3. **EXCEÇÃO IMUTÁVEL — o CLIENTE nunca é tenant nem membro de tenant.** É GUEST cross-tenant com janela escopada para a SUA obra. Evita acoplar o cliente a um tenant único e evita vazar obras de outros clientes (a obra pode ser executada por mais de um tenant).

### Invariantes de segurança (não regredir)

- **Tenant SEMPRE da sessão** (cookie httpOnly), jamais de header do browser. Já está correto.
- **Barreira primária = filtro no código.** Como `crmDb()` é service-role e **bypassa RLS**, `.eq('tenant_id', ctx.tenantId)` puro é a barreira de verdade (revisão obrigatória em todo endpoint novo). RLS é **camada 2** / defesa-em-profundidade.
- **`super_admin` "read-only cross-tenant" NÃO se resolve reusando os endpoints normais.** Todo endpoint usa service-role e filtra por `ctx.tenantId` (tenant da sessão). Ler cross-tenant exige **guard dedicado SELECT-only** (endpoints especiais que ignoram o filtro de sessão **mas só fazem SELECT**). No mesmo client service-role, um endpoint que ignora o filtro também permitiria escrita — por isso a assimetria read/write precisa de guard próprio, não convenção.

### Bombas-relógio a desarmar ANTES de qualquer 2º tenant

- **`tenantScopeOrFilter` com ramo `tenant_id IS NULL`** e policies `x OR tenant_id IS NULL` — vazamento cross-tenant **adormecido**. Inofensivo com 1 tenant; no dia do 2º, toda linha NULL fica visível/gravável por qualquer um. → **Backfill NULL→sentinela + NOT NULL + trocar OR-filter por `.eq` puro.**
- **Caminho interno `x-tenant-id` honrado quando `x-api-key==INTERNAL_API_KEY`** — segredo **estático único** cujo vazamento personifica **qualquer** tenant. Tratar como credencial crítica: **rotacionar e reescopar por integração/tenant** (token curto-vivido assinado), nunca chave global.
- **`is_hub_admin()`** precisa exigir `tenant_type='hub'` **raiz** — senão o modelo A cria super-admins locais com poder global por engano.
- **`resolveInviteTenantId`** — owner pode convidar para **qualquer** `tenant_id` UUID (a sentinela é pública). Com modelo A, um owner local injeta usuários no tenant Hub. **Restringir owner → próprio tenant (ou filhos via `parent_tenant_id`)** antes do 2º tenant.

### 🔴 Furo crítico do escrow no modelo A (a corrigir na definição da Chave Hub)

Hoje a **Chave Hub = `isCrmOwnerRole`** (nível owner). Quando um parceiro licencia e vira **owner do próprio tenant** (modelo A), ele passaria `isCrmOwnerRole` e assinaria a Chave Hub do **próprio** pagamento → vira executor **E** juiz. A premissa "Hub = juiz neutro = Wendel" colapsa. **Cura:** a Chave Hub é capability amarrada à **pessoa física / allowlist do tenant Hub raiz** (`tenant_type='hub'`), **nunca** ao nível `owner` genérico.

---

## 5. UX por persona (nav · cockpit · como a permissão aparece)

**Regras de UX transversais:**

- **Sem 403 cru e sem link morto.** Um componente único **"Este espaço não é seu"** com três modos: **esconder** (ausência total no nav — padrão para o que a persona nunca usa), **desabilitar-com-tooltip** (quando o item precisa ser visível mas travado), **tela-de-estado** (quando a rota foi acessada direta). Aplicar **só depois** que a Onda 1 corrigir o RBAC — aplicar "ausência" sobre RBAC quebrado esconderia funcionalidade legítima.
- **Rótulo do papel = título humano do job** ("Comercial", "Engenharia"), nunca `commercial`/`operation`.
- **Rota inicial por persona** (redirect pós-login) — acabar com o `/crm` genérico.
- **Click-and-Go / Talk-and-Go:** aprovar = **escolher + confirmar nomeado** ("Aprovar liberação de R$ X para {fornecedor}?"), nunca "Tem certeza?" nem digitação livre.

### 5.0 Cores — respeitar a TRAVA do dono (correção de crítica)

A proposta original de **8 acentos por persona** (verde-lima, terracota, petróleo, cobre, oliva, champagne, platina, pewter) **viola** a trava (dark **verde + dourado** `--obra-*`, 2 cores) e cria **3 dourados diferentes** que confundem exatamente o sinal mais importante — a custódia. **Decisão de design:**

- **Base `--obra-*` (verde + dourado) em TODAS as personas internas.** Sem paletas novas.
- **Dourado reservado SÓ a dinheiro e às 2 chaves do escrow.** Em nenhum outro lugar.
- **A persona se distingue por: ÍCONE + rótulo do job + o que aparece no nav** — não por cor de marca nova.
- **UM único diferenciador de acento** permitido: o **cliente** (o coração do produto) pode receber um tom de acolhimento próprio (champagne quente), porque é guest e a experiência dele é deliberadamente distinta. Nada além disso.

### 5.1 Hub / Auditor (owner, super_admin, admin_hub, admin)

- **Correção de crítica — o owner opera, não só audita.** Hoje é single-tenant e **Wendel é o operador diário** (roda funil, obra, financeiro). O cockpit do owner **inclui as bancadas de trabalho** — não esconde tudo atrás de "ver como persona". O modo auditoria é uma **lente adicional**, não o estado padrão.
- **Nav:** completa do Hub, agrupada por domínio (comercial, engenharia, arquitetura, financeiro, IA/agentes, usuários, config). **Crachá de tenant** fixo no topo ("Auditando: {nome legível}", nunca "ID 000...001"). Trocar de tenant é gesto **explícito e assinado** (selo "modo auditoria"), nunca dropdown escondido. **Só o cluster Hub vê o conceito de tenant.**
- **Cockpit:** dashboards consolidados + **Central de Aprovações consolidada** (todas as filas). Owner vê o ledger de custódia e opera a **Chave Hub** (selo dourado, glifo de balança).
- **Variantes:** `admin` (técnico) = escopo local, sem seletor cross-tenant; `super_admin` = painel "sala de máquinas" (denso, sem KPI de negócio); `admin_hub` = autoridade grande **subordinada, sem** o selo dourado da Chave Hub.
- **Permissão na tela:** ações de alto risco (aprovar escrow, arquivar usuário, mudar papel) pedem **confirmação nomeada**. Toda leitura/escrita cross-tenant é logada em `hub_eventos`. Cards nunca linkam para **edição** de dado de outro tenant sem entrar no contexto daquele tenant.
- **"Ver como persona" (impersonação):** **estruturalmente read-only** — durante impersonação o principal perde capacidades de escrita **em nível de código** (não pode segurar/acionar chave nem gravar); faixa permanente na tela reforça. Não é convenção visual.

### 5.2 Comercial

- **Nav (o JOB):** "Meu Funil / Meus Leads / Meus Contatos / Atendimento / Canais / Tarefas / Propostas". Rota inicial = **Funil (Kanban)**, nunca `/crm` genérico.
- **Cockpit:** funil, conversão, SLA de atendimento + fila de aprovações comerciais (descontos/exceções dentro do limite).
- **Permissão na tela:** financeiro/escrow e usuários/config **somem** do nav (fechamento por ausência). Desconto acima do limite vai para a **fila de aprovação**, não edição direta.

### 5.3 Financeiro

- **Nav:** "A Pagar / A Receber / Conciliação / Relatórios / Custódia (leitura)". Rota inicial = Financeiro.
- **Cockpit:** fluxo de caixa do tenant, status do escrow (valor em custódia, histórico) **sem** poder assinar liberação.
- **Permissão na tela:** o gate de liberação do escrow aparece com **cadeado** — nunca botão ativo (não é chave). Funil bruto de outros setores some.

### 5.4 Engenharia (operation)

- **Nav:** "Minhas Obras / Cronograma / EAP / Escopo / Medições / Pedidos-SC / Estoque". Rota inicial = lista de Obras. Ícone capacete/régua.
- **Cockpit:** obras **alocadas**, medições a lançar, pedidos, avanço por item + Central de Aprovações **filtrada às pendências de obra**.
- **Permissão na tela:** o botão "aprovar medição/pagamento" **não existe** aqui (some, não aparece desabilitado) — **quem lança não aprova**. Financeiro consolidado do Hub some; só o da(s) obra(s) que executa.
- **MDO:** aqui vive o cadastro/alocação de mão de obra (sem login, vinculada ao fornecedor) — **entregável a construir** (§3.4).

### 5.5 Arquiteto (architect)

- **Nav:** "Minha Fila de Aprovação / Projetos / Fases / Briefings". Rota inicial = Fila de Aprovação. Ícone esquadro/prancheta.
- **Cockpit:** fila de entregáveis a aprovar, fases dos projetos **vinculados**, disparidade orçamento×projeto + o gate "assinar escrow (**Chave Arquitetura**)".
- **Permissão na tela:** a Chave Arquitetura é um selo "pela metade" que **só fecha quando encontra a Chave Hub** (cerimônia sóbria de movimento — a única animação "grande" do sistema). Projetos de **outros** arquitetos não aparecem (ABAC de linha). CRM comercial/financeiro do Hub some.

### 5.6 Fornecedor (supplier)

- **Nav (mobile-first, enxuto):** "Minhas Cotações / Minhas Ordens / Meu Cadastro". Rota inicial = Meus Direcionamentos. Ícone caixa/paleteira.
- **Cockpit:** cotações e ordens **direcionadas a ele**, aceitar/recusar, histórico próprio.
- **Permissão na tela:** cotações/preços de outros fornecedores **nem existem** na navegação (ausência total). A fila global de distribuição some. Escopo por `fornecedor_id`.

### 5.7 Parceiro (broker + real_estate fundidos)

- **Nav (enxuto):** "Meus Leads / Minhas Indicações / Comissão". Rota inicial = só o que ele indicou. Ícone chave residencial (distinto do cadeado de custódia).
- **Cockpit:** leads que indicou, status de encaminhamento, trilha simples de comissão.
- **Permissão na tela — CORREÇÃO DO VAZAMENTO ATUAL:** o dashboard comercial **completo** do Hub (hoje mostrado por bug) **deixa de aparecer**. Funil interno, dashboards gerenciais, outros parceiros e financeiro do Hub somem. PF/PJ é atributo do cadastro, mesma persona.

### 5.8 Cliente (client) — o coração do produto

- **Nav mínima:** "Minha Obra / Aprovações / Custódia / Falar com a equipe". Rota inicial = Minha Obra. **Sem** seletor de tenant (é guest — tenant é invisível). Acento champagne (o único diferenciador permitido).
- **Cockpit "recepção":** espaçoso, tipografia grande, **anel de % de avanço** no lugar de tabela, narrativa de progresso. Avanço real por item, cronograma/prazo, **inbox de aprovação** (medições/fases), e o **"cofre/custódia"** mostrando as **DUAS chaves** (Hub + Arquitetura) e status **retido × liberado** — curando os 5 medos (atrasar/não-acabar/não-saber/ser-enganado/perder-dinheiro) + selo de auditoria do Hub (juiz neutro).
- **Permissão na tela:** o saldo em custódia é **VISÍVEL com cadeado dourado** + texto explicando **QUEM segura cada chave** (nunca escondido, nunca "acesso negado") — o cliente vê que **ninguém sozinho** libera o dinheiro dele. Aprovar = escolher + confirmar (Click-and-Go / atalho de voz no mobile). Nenhuma outra obra/dado existe na tela.
- **Gap de fluxo:** falta a tela de **convite/onboarding do cliente** — como o guest ganha conta e é amarrado à obra dele (a obra convida o cliente → cria o vínculo `cliente_pessoa_id`). Sem convite, não há cliente logado. **Gargalo dos 5 medos — entregável explícito (Onda 3).**

### 5.9 Auditoria do ai_agent (assento do HUMANO)

O agente age por allowlist, mas o **humano precisa ver e auditar o que o agente fez/aprovou**. A Central de Aprovações ganha um **filtro "ações do agente"** com trilha — sem isso o dono perde o controle sobre a autonomia da IA (princípio: humano é checkpoint). **Entregável (Onda 3).**

---

## 6. Plano de ondas aditivas (cada uma com gate)

> **Princípio:** aditivo, sem quebrar. Gate padrão de código = `tsc` + suíte (`crm-permissoes.test.ts` deve passar **sem alteração** — preserva 100% os papéis PT). Gate de dados/RLS = testar em **branch do Supabase** + `get_advisors` antes do apply em prod.

### ONDA 0 — VERIFICAR PROD ANTES DE TUDO (correção de crítica — bloqueante)

Via Supabase MCP (read-only), **antes** de qualquer código:
- (a) existe alguma linha com `tenant_id NULL` nas tabelas escopadas? (premissa "todos no sentinela" precisa ser **verificada**, não assumida — as Ondas 1-3 dependem dela);
- (b) **status real do Lucas** — `getCallerContext` só barra `status != 'ativo'`; arquivado com status ainda `'ativo'` **mantém acesso**. Confirmar que arquivar seta status para Inativo/Suspenso;
- (c) o `users.role` real de cada pessoa em prod (inglês vs PT);
- (d) **os projetos em prod têm `responsavel_id` populado?** Se **nenhum** tiver, a Onda 1b **trancaria o escrow** (ninguém qualifica como 2ª chave → pagamento nunca libera). Backfillar antes.
- **`normalizeRole()` com log** pode entrar já aqui (puramente aditivo, zero risco) para começar a coletar quais sinônimos aparecem de verdade.

**Gate:** relatório dos 4 pontos aprovado pelo dono. Sem isso, não começa a Onda 1.

### ONDA 1 — FONTE ÚNICA (code-safe) — **atômica com a 1b**

Criar `lib/rbac/role-map.ts` (13 entradas × 4 campos) + `normalizeRole()`. Reescrever `crmNivelFromRole`, `isCrmOwnerRole`, `isCrmGestorRole`, `personaCockpitFromRole`, `filterCrmNavGroupsForRole` e os `requireCrm*` como **wrappers finos** que leem o mapa (mesma assinatura). **Destrava o 403 da Ariane** e dá nível/persona aos papéis internos.

⚠️ **Correção crítica de over-grant:** as personas **externas** (`client`/`supplier`/`broker`/`real_estate`) entram com **`nivel=null`** desde a Onda 1 — **não** recebem CrmNivel para "sair do 403". Se recebessem qualquer nível, herdariam os endpoints existentes que filtram **só** por `tenant_id` (leads, negócios) e leriam o tenant **inteiro**. Elas entram **só por rotas próprias com ABAC de linha** (Onda 3), nunca pela escada CRM.

**Gate:** `crm-permissoes.test.ts` verde sem mudança + **nova suíte 13 papéis × rotas** provando que externas **não** leem leads/negócios tenant-wide.

### ONDA 1b — ESCROW: capability única para as 2 chaves (code-safe, **mesmo commit que a 1**)

Trocar **AS DUAS** chaves do modelo rank-based (`isCrmOwnerRole` / `isCrmGestorRole && !isCrmOwnerRole`) para **capability explícita** numa função única `podeAssinarChave(role, tipo, ctx, linha)`:
- **Chave Hub** = capability amarrada à pessoa física / allowlist do tenant Hub **raiz** (não nível `owner` genérico — fecha o furo do modelo A);
- **Chave Arquitetura** = `role==='architect'` + vínculo de linha ao projeto (`responsavel_id` — **nome real da coluna**, não `arquiteto_responsavel_id`);
- **identidade humana DISTINTA** entre as 2 aprovações do mesmo pagamento (comparar `aprovado_por`/`user_id` das 2 linhas — hoje a segregação é por **role**, não por **pessoa**);
- **rejeitar todo caminho não-humano:** escrow **não libera** sem cookie de sessão humana real (sem `INTERNAL_API_KEY`, sem worker, sem `ai_agent`). Fecha o furo em que 1 segredo global personifica owner + gestor e drena o cofre em 2 chamadas.

⚠️ **1 + 1b são atômicas.** Destravar `architect`→nível na Onda 1 **enquanto** a chave ainda é rank-based **alargaria** a 2ª chave (architect/admin/qualquer gestor recém-mapeado qualificaria). Nunca deixar janela com escrow mais fraco que o de hoje. **Mudança FINANCEIRA → teste dedicado + sign-off do dono.**

**Gate:** teste dedicado provando (i) `architect` NÃO assina Chave Hub; (ii) `admin`/`admin_hub` NÃO assinam nenhuma chave; (iii) caminho `INTERNAL_API_KEY` NÃO libera escrow; (iv) mesma pessoa não assina as 2.

### ONDA 1c — FAIL-CLOSED + ALLOWLIST (code-safe) — **entra em prod DEPOIS da Onda 0/4**

Trocar o default de `personaCockpitFromRole` de `comercial` (fail-open, vaza dashboard) para **`restrito`** (tela neutra). Reconciliar `CRM_OWNER_EMAILS`: manter nice.engemp, **incluir obradezmais**, **remover ramonexercito** (vira `admin`), **remover ariane.ot** (vira `commercial`); planejar depreciar a allowlist em favor de `users.role` como fonte única (estado transitório dual-check + flag, não corte seco).
⚠️ **Ordem:** a auditoria de roles reais em prod (Onda 0) roda **antes** de 1c entrar em prod — senão um role com typo/seed antigo fica sem UI nenhuma.

**Gate:** nenhum usuário real de prod cai em `restrito` por acidente (validado contra o levantamento da Onda 0).

### ONDA 2 — UX DE BLOQUEIO (code-safe)

Componente único **"Este espaço não é seu"** (esconder / desabilitar-com-tooltip / tela-de-estado) substituindo todo 403 cru e link morto. Rota inicial por persona (redirect pós-login), fim do `/crm` genérico. Trocar "item cinza desabilitado" por "item ausente" — **só depois** da Onda 1.

**Gate:** varredura sem nenhum 403 cru / card morto nas telas das 8 personas.

### ONDA 3 — TELAS ÓRFÃS + NAV PRÓPRIO DAS PERSONAS EXTERNAS (code-safe)

Aqui entra o **segundo sistema de nav** (próprio de cada cockpit externo — não reaproveita `CRM_NAV_GROUPS`/`ROTA_MIN_NIVEL`). Construir: **`/minha-obra`** do cliente (avanço + aprovar medição + custódia com as 2 chaves) + **onboarding/convite do cliente**; **`/meus-direcionamentos`** do fornecedor; **inbox de aprovação por persona** (Central de Aprovações vira componente embutido filtrado por autoridade de linha) + **filtro "ações do agente"**; cockpit de parceiro restrito (fecha o vazamento broker/real_estate); **cadastro/alocação de MDO**. Acentos ADITIVOS **só** o do cliente (§5.0). **Prioridade: Cliente e Arquiteto** (maior gap de produto).

**Gate:** cada tela nova exercitada com um usuário de cada papel provando o escopo de linha (cliente A não vê obra de B, fornecedor X não vê cotação de Y).

### ONDA 4 — JANELA DO DONO (dados) — desarmar a bomba

Ajustar roles / `CRM_OWNER_EMAILS` em prod (owner só Wendel; Ramon=`admin`; Ariane=`commercial`). **Backfill de todo `tenant_id NULL`→sentinela**, depois **NOT NULL + DEFAULT** (no-op de negócio, fecha o vazamento). `ADD tenant_type`/`parent_tenant_id` em `hub_tenants` (aditivo, default `'hub'`).

**Gate:** `get_advisors` sem novos erros; contagem de `tenant_id NULL` = 0.

### ONDA 5 — JANELA DO DONO (RLS) — endurecer

Com NULL impossível: trocar toda policy `x OR tenant_id IS NULL` por `tenant_id = current_user_tenant_id()` puro; fechar as `USING(true)`/0-policies (`hub_pedidos_material` e família `hub_parceiros_*` têm **ZERO** policy — confirmar via `get_advisors`); `ADD tenant_id` às tabelas sem isolamento. Só então aposentar o ramo `is.null` do `tenantScopeOrFilter`. Adicionar a **policy RLS do cliente** (equivalente ao `buildCliente`).

**Gate:** advisors limpo; testado em branch antes do apply.

### ONDA 6 — JANELA DO DONO (auditoria cross-tenant)

Redefinir `is_hub_admin()` p/ exigir `tenant_type='hub'` raiz; adicionar como OR **só em policies de SELECT** (nunca escrita); **guard SELECT-only dedicado** para `super_admin` (a leitura cross-tenant não reusa endpoints normais — §4). Instrumentar `hub_eventos`: mudanças de papel, ações das 2 chaves, leituras/escritas cross-tenant, **e o caminho interno** (distinguir humano real de impersonação via `x-caller-auth-id`), 403 repetidos (sondagem). **Especificar o mecanismo concreto de break-glass** — sem ele, "escrita cross-tenant só via break-glass" é aspiracional.

### ONDA 7 — SEGURANÇA OPERACIONAL — **antecipar (pré-requisito, não última onda)**

Rotacionar `service_role` key; reescopar `INTERNAL_API_KEY` por integração/tenant (token curto-vivido assinado). **É pré-requisito do escrow seguro e de destravar personas que ampliam a superfície de chamada** — priorizar junto com a Onda 1b, não deixar por último.

### ONDA 8 — MODELO A (futuro, sob demanda)

Só quando o 1º parceiro **licenciar**. Criar linha em `hub_tenants` (`tenant_type='parceiro'`, `parent_tenant_id=Hub`), mover as linhas daquele fornecedor/parceiro para o novo `tenant_id`, criar o `owner` local, testar em branch. Restringir `resolveInviteTenantId` (owner → próprio tenant/filhos). **Verdadeiro go-live multi-tenant.**

### ONDA 9 — DECISÃO DE ENUM (registrar uma vez)

Decidir se os valores PT (`gestor`/`comercial`/`financeiro` da migração `20260620190000`) são **aposentados** (canonizar só os 13 inglês) ou **mantidos como sinônimo permanente**. Registrar no módulo canônico — nunca deixar duas tabelas de mapeamento divergentes de novo.

> **Leitura enxuta (opcional):** se preferir menos frentes na primeira leva, as ondas colapsam em 3 baldes: **(A)** Ondas 0+1+1b+1c (fonte única + escrow blindado + cura da Ariane); **(B)** Onda 3, priorizando **Cliente e Arquiteto**; **(C)** Ondas 4-7 (janela do dono: dados + RLS + rotação de chaves). Ondas 6/8/9 são futuro puro — fora do caminho crítico.

---

## 7. Decisões que exigem o dono

> Objetivas — cada uma trava uma parte do design. Respostas curtas destravam a execução.

| # | Decisão | Por que precisa de você | Recomendação da mesa |
|---|---|---|---|
| **D1** | **Papel único vs multi-chapéu.** Enquanto Wendel faz tudo (owner + operar comercial + lançar obra), o cockpit do owner **inclui as bancadas de trabalho** (1 papel que enxerga operar tudo), ou você quer **papéis empilháveis** (multi-role por pessoa)? | `users.role` é coluna única hoje. Isso decide se o cockpit do owner tem a bancada embutida ou não — **bloqueia o design do §5.1**. | **Owner opera direto** (bancadas embutidas) por ora; multi-role formal só se aparecer uma 2ª pessoa que acumule papéis. |
| **D2** | **Enum PT vs EN.** Canonizar os **13 em inglês** (PT vira sinônimo depreciado) ou manter os dois permanentes? | Trava a fonte única — todo o `role-map.ts` depende disso. | **Canonizar os 13 em inglês**, PT como sinônimo com log até o backfill (Onda 9). |
| **D3** | **Colapso broker + real_estate = 1 persona "parceiro"** (PF/PJ vira atributo do cadastro)? Os dois valores do enum **continuam gravaveis** (delete=arquiva). | Fecha o vazamento e elimina drift. | **Sim, colapsar.** |
| **D4** | **admin_hub:** mantido como staff-plataforma cross-tenant **separado**, ou **fundido em super_admin** até existir staff real? Definir a hierarquia `admin_hub`(plataforma) vs `admin`(local) vs `super_admin`. | Hoje é ambíguo; 3 tiers de staff com 1 dono + 1 dev é cerimônia. | **Fundir admin_hub em super_admin** até existir pessoa de staff-plataforma real. |
| **D5** | **Escrow / Chave Arquitetura (mudança FINANCEIRA — sign-off).** Confirmar: `architect` = Chave Arquitetura por **role + vínculo `responsavel_id`**; o **mesmo humano nunca segura as 2 chaves**; escrow **rejeita todo caminho não-humano**. E: **quem é o `responsavel_id` de cada projeto** em prod? | Muda regra de dinheiro. Se nenhum projeto tem responsável populado, o cofre **tranca**. | **Confirmar a regra + backfillar `responsavel_id`** na Onda 0 antes de aplicar. |
| **D6** | **`financial` é chave do escrow?** Por padrão **NÃO** (só acompanha o ledger). Você quer poder designar `financial` como chave em casos específicos, ou manter estritamente **owner(Hub) + architect(Arquitetura)**? | Define a matriz de quem libera dinheiro. | **Manter estrito** (owner + architect). |
| **D7** | **Chave Hub amarrada à pessoa física do Hub raiz** (não ao nível `owner` genérico) — para que, no modelo A, um parceiro-owner **não** assine a Chave Hub do próprio pagamento. | Sem isso, o modelo A colapsa "Hub = juiz neutro". | **Sim, amarrar à allowlist do tenant Hub raiz.** |
| **D8** | **Rebaixamento visível (comunicar antes de aplicar):** Ramon `owner→admin`; Ariane `owner→commercial`; incluir **obradezmais** como owner. Broker/real_estate **perdem** o dashboard comercial completo que viam por bug. | São reduções de acesso perceptíveis. | **Aplicar na Onda 4**, avisando os afetados. |
| **D9** | **Segurança operacional (custo):** autorizar **rotação da service_role key** + **reescopo do INTERNAL_API_KEY** (por integração, não chave global) — pré-requisito antes de qualquer 2º tenant. Custo: revalidar integrações que usam a chave. | É o único segredo global que personifica qualquer tenant. | **Autorizar e antecipar** (junto da Onda 1b/7). |
| **D10** | **Modelo A vs B / tier:** aprovar a regra "assinatura SaaS = tenant próprio (A); só comissionamento = view no Hub (B); cliente sempre GUEST". Definir **quando** ligar o 1º tenant real (só após Ondas 4-7). | Define a estratégia de tenancy e o go-live multi-tenant. | **Aprovar a regra; ligar o 1º tenant só quando o 1º parceiro licenciar.** |

---

*Documento fiel aos princípios do dono: código de identidade escondido · delete = arquiva · Hub = juiz/auditor · cockpit por persona · Central de Aprovações unificada · Click-and-Go/Talk-and-Go · dark verde+dourado (`--obra-*`), dourado reservado a dinheiro e às 2 chaves.*
