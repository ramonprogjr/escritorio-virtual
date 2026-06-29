# Plataforma transversal (negocio-espinha + nada-se-perde + mensageria + RBAC/ABAC) — Design ideal (mesa redonda)

## Plataforma transversal — design ideal

As 4 lentes convergiram. O que segue é fiel ao doc do dono (`integracao-contas-negocio-spine-logs.md` + `portal-cliente`) e ao chão real verificado (`hub_negocios`, `hub_eventos`/`registrarEvento`, `crm-permissoes.ts`, soft-delete por status, trigger `block_unauthorized_delete`, `current_user_tenant_id()`).

---

### Negócio = espinha de integração entre contas (os elos)

O `hub_negocios` **já é** o centro do CRM dentro de um escritório. O salto da plataforma transversal é fazer o **mesmo `negocio_id` ser o eixo entre CONTAS DISTINTAS** (cliente, arquiteto, engenharia, fornecedor, Hub) — cada uma com seu `tenant_id` próprio, cada uma vendo sua fatia.

```
IMÓVEL (origem = venda)
   │ imovel_id
   ▼
┌─────────────────────────────────────────────┐
│   hub_negocios  ── A ESPINHA ──              │
│   tenant_id = HUB   origem_tipo='venda_imovel'│
└──┬────────┬────────┬────────┬────────┬───────┘
   │ negocio_id em TODOS os derivados (o elo)
   ▼        ▼        ▼        ▼        ▼
 PROJETO   OBRA   FINANCEIRO PEDIDOS MENSAGENS
 t=ARQ    t=ENG   (todos)    (eng+forn) (por papel)
```

**Decisão de produto (não de schema):** todo módulo compartilhado carrega `negocio_id` + `tenant_id` do dono daquele módulo. Assim `hub_negocios.tenant_id`=Hub, `hub_projetos.tenant_id`=Arquiteto, `hub_obras.tenant_id`=Engenharia — todos costurados pelo mesmo `negocio_id`. "Tudo que aconteceu neste negócio" vira um `SELECT WHERE negocio_id = $x`.

**Elos faltando hoje (verificados, aditivos):**
- `hub_negocios`: `+ imovel_id`, `+ origem_tipo` (venda do imóvel como origem)
- `hub_contas_pagar`, `hub_pedidos_material`, `hub_aprovacoes`: `+ negocio_id`
- `hub_obras`: `+ projeto_id` (elo à fonte única da Arquitetura)
- nova tabela pivot **`hub_negocio_acessos`** (`negocio_id, tenant_id, papel, nivel`) — o ABAC cross-tenant que não existe hoje (o RBAC atual é 100% interno a um escritório).

**Projeto puxa da Arquitetura = fonte única (decisão do dono):** a Engenharia lê `hub_projetos` via `negocio_id` (cross-tenant read), **não copia**. O arquiteto atualiza, todos veem a versão atual. A desatualização **fica visível** ("desatualizado há X dias") — pressão honesta, não escondida. Se o arquiteto sai, o **Hub assume custódia** da última versão (nada se perde).

---

### 'NADA SE PERDE' transversal (event log + soft-delete + Hub recupera) — como aplicar a todos

Três camadas que se complementam. **As peças já existem no chão** — falta padronizar como invariante de TODOS os módulos e dar cara de produto.

```
┌──────────────────────────────────────────────────────┐
│ CAMADA 1 · soft-delete padronizado (cada tabela)     │
│   apagado_em / apagado_por — DELETE físico vira UPDATE│
├──────────────────────────────────────────────────────┤
│ CAMADA 2 · hub_eventos (append-only, IMUTÁVEL)       │
│   trigger bloqueia UPDATE/DELETE; payload={antes,depois}│
├──────────────────────────────────────────────────────┤
│ CAMADA 3 · Hub backstop (service_role, vê apagados)  │
│   hub_recuperar_negocio() / hub_restaurar_registro() │
└──────────────────────────────────────────────────────┘
```

**Como aplicar a todos SEM reescrever cada módulo — dois helpers SQL + um helper TS:**

1. **`hub_ativar_softdelete('tabela')`** — adiciona `apagado_em/apagado_por`, índice parcial `WHERE apagado_em IS NULL`, e um trigger `BEFORE DELETE` genérico (`hub_softdelete_intercept`) que converte DELETE em UPDATE e suprime o físico (`RETURN NULL`). Uma linha por tabela na migração.
2. **`hub_ativar_audit('tabela')`** — instala trigger `AFTER INSERT/UPDATE/DELETE` (`hub_audit_trigger`) que escreve em `hub_eventos` extraindo `negocio_id`/`tenant_id` da linha via `to_jsonb`. Uma linha por tabela.
3. **`lib/crm/registrar-evento.ts` (já existe, append-only)** — continua sendo a porta única para eventos de aplicação (ações de IA, mensagens). No client: nunca `.delete()`; sempre `.is('apagado_em', null)` nas listagens + helper `softDelete()`.

**Recuperação pelo Hub:** `service_role` bypassa RLS → o Hub sempre enxerga `WHERE apagado_em IS NOT NULL`. `hub_recuperar_negocio(id)` reconstrói a linha do tempo via `payload.antes` mesmo sem restaurar; `hub_restaurar_registro(tabela,id)` desfaz o soft-delete (checando conflito de unicidade antes — edge case real). Mantém-se a trava já aplicada (`block_unauthorized_delete` + RPC `service_role`-only): **nenhum módulo novo expõe delete físico ao client.** Isso é o que torna o invariante "FORTE".

**Cara de produto:** Lixeira/Desfazer no escritório; selo **"recuperável pelo Hub"** e **"✓ registrado"** para o cliente — o invariante técnico vira cura do medo de ser enganado.

> Nota de risco (a validar em dev antes de prod): a ordem `BEFORE DELETE → RETURN NULL` faz o soft-delete virar UPDATE, e é o trigger de UPDATE do audit que captura o evento — confirmar que dispara. Particionar `hub_eventos` por mês quando o volume justificar; payload de UPDATE só com o diff.

---

### Mensageria por papel + ASCII

**Não é chat solto nem extensão do inbox WhatsApp** (esse é o eixo lead↔captação — papel diferente; não reusar). É um **módulo novo pendurado no negócio**: toda mensagem = `{negocio_id, sala, autor_papel}`. O modelo mental são **SALAS por assunto** com participantes fixos por papel — a curadoria é **estrutural**, não um toggle.

```
NEGÓCIO "Apto 1203 — Ed. Aurora"
  ├ Sala GERAL ......... cliente + arquiteto + Hub
  ├ Sala PROJETO ....... cliente + arquiteto (Hub leitura)
  ├ Sala OBRA .......... arquiteto + engenharia + Hub   (cliente NÃO entra)
  ├ Sala FINANCEIRO .... cliente + Hub + financeiro
  ├ Sala PEDIDOS ....... engenharia + fornecedor + Hub
  └ Sala ARBITRAGEM .... oculta; surge só quando o Hub abre disputa
```

```
 LISTA DE SALAS (de um negócio)        THREAD (uma sala)
 ┌─────────────────────────────┐   ┌─────────────────────────────┐
 │ ‹ Apto 1203 — Ed. Aurora    │   │ ‹ Obra · Apto 1203      [⋮]  │
 │   Negócio #IMV-0291  ●ativo │   │  arquiteto·engenharia·Hub   │
 ├─────────────────────────────┤   ├─────────────────────────────┤
 │ ▣ Geral            2 novas ›│   │  ┌─ Eng · 09:12 ──────────┐  │
 │ ◈ Projeto              ›    │   │  │ Laje 4º concluída      │  │
 │ ⚒ Obra             5 novas ›│   │  │ [📷] [✓ medição]       │  │
 │ $ Financeiro       ! escrow │   │  └────────────────────────┘  │
 │ ⚖ Arbitragem    (oculta)    │   │      ┌─ Arq · 09:20 ───────┐ │
 └─────────────────────────────┘   │      │ Aprovado. Pode seguir│ │
   badge "novas" POR SALA e         │      └──────────────────────┘ │
   POR PERSONA                      │  ····· Hub registrou ✓ ·····  │
                                    ├─────────────────────────────┤
                                    │ [➤ anexar] Escreva…   [Send]│
                                    │ 🔒 tudo nesta sala é logado │
                                    └─────────────────────────────┘
```

Regras: (a) cliente **nunca fala direto com a obra** — sempre mediado pelo Hub; (b) fornecedor vê só a sala PEDIDOS dos negócios em que tem item; (c) toda mensagem grava evento (`mensagem_enviada/editada/removida/promovida`) → append-only; (d) **ponte entre contas** via "↑ Promover ao cliente" / @menção que promove **uma** mensagem para sala compartilhada (consentimento explícito, nunca expõe a thread inteira). Mensagem é **append-only**: editar/remover viram nova linha no histórico — o Hub vê o original.

---

### RBAC/ABAC + visão curada (anti-poluição) por persona

Eixo **ortogonal** ao RBAC atual: os 5 níveis de `crm-permissoes.ts` (owner/gestor/comercial/financeiro/atendente) continuam sendo papéis **dentro** de um escritório. A plataforma adiciona a **PERSONA do negócio** (cliente/arquiteto/engenharia/fornecedor/hub), resolvida por participação ancorada em `negocio_id` via `hub_negocio_acessos` — **acesso por conjunto exato** (molde do `ROTA_ROLES_EXATAS` já usado no Financeiro), **nunca rank linear**. A UI **não renderiza** o que o ABAC não autoriza (sala/botão ausente, não desabilitado). A curadoria de colunas é feita por **views por persona** (`vw_projeto_cliente`, `vw_obra_cliente`, `vw_projeto_engenharia`) — a RLS cross-tenant abre a porta, a view filtra as colunas.

```
DADO / MÓDULO       | CLIENTE | ARQUITETO | ENGENHARIA | FORNECEDOR | HUB
--------------------|---------|-----------|------------|------------|----
Avanço físico obra  |    ~    |     ~     |     ●      |     ✗      |  ●
Cronograma/Curva-S  |    ●    |     ~     |     ●      |     ✗      |  ●
Diário+fotos        |    ●    |     ~     |     ●      |   só seu   |  ●
Projeto entregável  |    ●    |     ●     |   ● (lê)   |     ✗      |  ●
EAP/SC/cotações     |    ✗    |     ✗     |     ●      |   só sua   |  ●
Custo fornecedor    |    ✗    |     ✗     |     ●      |   só seu   |  ●
MARGEM / spread Hub |    ✗    |     ✗     |     ✗      |     ✗      |  ●
Financeiro DO CLI.  |    ●    |     ~     |     ~      |     ✗      |  ●
Pagam. a fornecedor |    ✗    |     ✗     |     ●      |   só seu   |  ●
Mensagens           | c/ Hub  | c/escrit. |  interna   | c/escrit.  | TUDO
Logs / histórico    |    ✗    | só seus   |  só seus   |  só seus   | TUDO
                          ● vê   ~ resumo curado   ✗ não vê
```

**Default do PO (a confirmar com o dono): cliente NÃO vê custo de fornecedor nem margem.** A margem/spread do Hub é o segredo comercial mais sensível — `✗` para todos exceto Hub. Vazar margem mata a monetização. Cada persona externa = acesso estrito por `negocio_id+papel`, e **nunca** pode cair no SELECT tolerante a `tenant_id IS NULL` (vazamento via fallback do `current_user_tenant_id()`). Detalhe de IA: resumos para um papel filtram `visivel_para` **no banco, antes do LLM** — a IA gera "para um papel", nunca "para um tenant".

---

### Faseamento · Reuso x novo · Edge cases

**Faseamento (aditivo, gate tsc+vitest+_chk23; reusa o que existe):**

- **F0 — Fundação invisível (baixo esforço, peças quase prontas):** `hub_eventos`+trigger genérico; `hub_ativar_audit`/`hub_ativar_softdelete` nos módulos existentes; `negocio_id` nos elos faltando. Resultado: "nada se perde" vira verdade transversal **sem tela nova**. **Corrigir ANTES o P0 de segurança** (`lib/ia/aprovacoes.ts` sem filtro de tenant — vazamento confirmado).
- **F1 — Portal do Cliente read-mostly (alto impacto comercial):** persona CLIENTE + login + matriz curada (só leitura + aprovar) consumindo o que E2/E4/E6/E8 já produzem + selo de auditoria. É o diferencial de venda (cura dos 5 medos).
- **F2 — Mensageria com salas + escopo por papel:** começa com 1 sala GERAL por negócio (prova o pilar com 1 tela), depois multi-sala; `pode_ver_sala` deriva a navegação.
- **F3 — Personas externas arquiteto/fornecedor + shells curados + RLS cross-tenant** (maior esforço; depende do handoff multi-tenant — fazer quando houver job real).
- **F4 — Lixeira/recuperação com cara + "recuperado pelo Hub"** como UX; arbitragem/promoção entre contas.

**Reuso x novo:**
- **REUSAR:** `hub_negocios` (espinha — só propagar `negocio_id`); `hub_eventos`/`registrarEvento` (keystone append-only — chamar, não reinventar); soft-delete por status já praticado (padronizar); trava `block_unauthorized_delete`+RPC `service_role` (manter); `crm-permissoes.ts` + `ROTA_ROLES_EXATAS` (molde das personas externas — estender); marca dark tokenizada (`--obra-*`/`--brand-*`); drawer-em-seções do Onboarding.
- **NOVO:** `hub_negocio_acessos` (pivot ABAC); `hub_mensagens_negocio` + salas; views curadas por persona; helpers `hub_ativar_softdelete`/`hub_ativar_audit`; RPCs `hub_recuperar_negocio`/`hub_restaurar_registro`.
- **EVITAR:** audit log paralelo; chat fora do padrão `negocio_id`; expor delete físico; rank linear a persona externa; duplicar dado entre contas (referenciar via `negocio_id`); estender o inbox WhatsApp como mensageria inter-contas.

**Edge cases (decididos):**
1. **Apagar e recuperar** — DELETE → soft-delete via trigger; `payload.antes` no log permite reconstruir mesmo sem restaurar; só o Hub (`service_role`) restaura; restauração checa conflito de unicidade (código único por tenant+ano).
2. **Mensagem entre contas / vazamento** — `visivel_para[]` + JOIN em `hub_negocio_acessos`; cliente sem linha ativa não vê a mensagem mesmo citado; fornecedor não vê thread de outro; thread órfã (sem `negocio_id`) recusada.
3. **Visão indevida** — RLS abre a porta cross-tenant, view curada filtra colunas; mitigar bypass com `REVOKE SELECT` na tabela bruta + `GRANT` só nas views; deep-link de sala alheia → "não faz parte do seu acesso" (não confirma existência).
4. **Vazamento de margem** — `✗` universal exceto Hub; persona externa nunca herda rank; IA filtra `visivel_para` antes do LLM.
5. **Fonte única desatualizada** — sinalizar "desatualizado há X dias" (não esconder); arquiteto inativo → Hub custodia a última versão.
6. **Fallback de tenant mascarando vazamento** — persona externa nunca cai no SELECT tolerante a `tenant_id IS NULL`; escopo estrito `negocio_id+papel`.
7. **Dois escritórios no mesmo negócio** (arq de um tenant, eng de outro) — conflito isolamento×compartilhamento exige handoff explícito; tratar na F3, não bloquear F0/F1.
8. **Cliente vê número ruim (atraso/estouro)** — honestidade é a alma do produto: mostrar a cura (alerta+plano), nunca maquiar.

**Confiança:** ALTA no modelo conceitual (3 camadas), na espinha `negocio_id` e na matriz curada (ancorados nos docs do dono + código real). MÉDIA nos detalhes SQL (ordem de triggers no soft-delete, índice composto em `hub_negocio_acessos`, RLS cross-tenant) — validar em dev antes de prod. MÉDIA na F3 (personas externas) — depende de 4 decisões de negócio em aberto no doc do dono (transparência do cliente, selo automático×humano, comentar×só ver, o que o cliente aprova) e do handoff multi-tenant ainda parado. **Não editei nada** — isto é o design. O P0 (`aprovacoes.ts` sem tenant) deve ser corrigido antes de qualquer fase.

Arquivos reais de referência: `c:\Users\wende\Documents\escritorio-virtual-ramon\lib\crm\crm-permissoes.ts`, `lib\crm\registrar-evento.ts`, `lib\ia\aprovacoes.ts` (P0), `docs\insumos-do-dono\integracao-contas-negocio-spine-logs.md`.