# A2 (elo Gerar Obra: projeto -> obra) — Design + Auditoria (mesa redonda)

Confirmado o chão real definitivo. Pontos decididos pela evidência: `obra_id` existe em `hub_projetos` mas é FK CASCADE-SET-NULL para `hub_obras`; `hub_obras` NÃO tem `observacao` nem `projeto_id`; tipologias canônicas têm 6 slugs (residencial, corporativo, interiores, reforma, comercial, paisagismo); status do funil de projeto usa `estagio_slug` com slug `entregue` e eixo separado `aprovacao_status` (sem_aprovacao/aguardando/aprovado/reprovado). Tenho tudo para o design final.

---

## Design final de A2

A2 é **reuso + 1 ponte de mapeamento + 1 elo já existente**. Não é feature nova de criação de obra — é o *acendimento* do stub. As 4 lentes convergiram; divergiram só em 2 pontos que decido abaixo com base no schema real.

### Mapeamento projeto→obra + vínculo persistido + idempotência

**Mapa de campos (o anti-redigitação):**

| `hub_projetos` (A0) | → | `hub_obras` (E0) | regra |
|---|---|---|---|
| `titulo` | → | `titulo` | direto |
| `tipologia` (livre, 6 slugs) | → | `tipo_obra` (CHECK 7 valores) | `mapTipologiaParaTipoObra()` |
| `area_m2` | → | `area_total_m2` | direto |
| `cliente_pessoa_id` / `cliente_empresa_id` | → | idem (soft FK) | herda, pula passo cliente |
| `negocio_id` | → | `negocio_id` | preserva linhagem negócio→projeto→obra |
| `id` (projeto) | → | `hub_projetos.obra_id` ← gravado de volta | o elo |
| fases `tipo='comodo'` (Programa) | → | **texto no resumo** | NÃO vira frente (cômodo≠disciplina) |

**Mapa tipologia→tipo_obra** (novo, in-code em `lib/obras/eap-presets.ts`, aditivo). Decisão CEO baseada nos 6 slugs reais + default seguro:

```
residencial → construcao    corporativo → construcao
interiores  → reforma        reforma     → reforma
comercial   → servico        paisagismo  → servico
null/desconhecida → reforma  (default seguro; humano troca o chip)
```
O `tipo_obra` derivado escolhe o preset de EAP via `getPresetPorTipo()` (E0 intacto).

**Vínculo persistido — DECISÃO: usar a coluna existente `hub_projetos.obra_id`, ZERO migração para o MVP.** O schema real confirma: `hub_projetos.obra_id UUID REFERENCES hub_obras(id) ON DELETE SET NULL` (linha 288). É lida no `SELECT_A0` e gravável no `PATCH /api/crm/projetos/[id]`. O `ON DELETE SET NULL` é um bônus: se a obra for deletada, o elo zera sozinho e o botão "Gerar obra" reaparece — resolve o edge-case do elo órfão **no banco**, sem código de validação.

**Rastro reverso `hub_obras.projeto_id`: DEFERIDO** (não é bloqueante). A navegação obra→projeto resolve-se por lookup (`hub_projetos WHERE obra_id = :id`) ou pelo `negocio_id` comum. Se o dono quiser FK reversa dura, é aditivo numa migração futura — não entra no A2 core.

**Programa de cômodos: DECISÃO — não persiste na obra no MVP** (resolve a divergência das lentes). Evidência: `hub_obras` **não tem coluna `observacao`** (só `hub_aprovacoes` tem). As opções eram (a) migrar `observacao` agora, ou (b) deixar o programa só no projeto. Escolho **(b)** para o core: o programa fica acessível via o elo (a ficha da obra busca o projeto e mostra o programa read-only). Anexar como `observacao` na obra é melhoria opcional numa migração A2 posterior. Isto evita poluir o MVP com migração só para um campo de contexto.

**Idempotência — 3 camadas (a Camada 1 é o coração):**
1. **Elo no banco (lock real):** antes de criar, lê `projeto.obra_id`. Se `!= null` → NÃO cria; botão vira "Ver obra →". O `obra_id` **é** o lock.
2. **Anti-double-tap:** botão `disabled` enquanto salvando + a dedup existente do `POST /api/crm/obras` (titulo+tenant, 60s) cobre a corrida entre o `POST /obras` e o `PATCH /projetos`.
3. **Idempotência visual/conversacional:** UI e copiloto leem `obra_id` antes de oferecer a ação.

Resultado: **nunca 2 obras para o mesmo projeto.**

### Tela 'Gerar obra' (sideover de confirmação) + ASCII

**Gate de habilitação — DECISÃO CEO:** aceitar **`estagio_slug === 'entregue'` OU `aprovacao_status === 'aprovado'`**. O stub atual só checa `entregue`; A2 adiciona o `aprovado` porque o handoff real é "cliente aprovou o executivo" — destrava o caso legítimo sem esperar o clique formal de entrega. Server-side é o guard definitivo (não confiar só no `disabled`).

```
ABA "Engenharia" da ficha /crm/arquitetura/[id]  — 3 estados

ESTADO 1 — não pode (não entregue E não aprovado):
┌──────────────────────────────────────────────┐
│ ⏳ Aguardando entrega do projeto             │  ← card âmbar, NÃO botão morto
│ A obra é gerada ao entregar/aprovar o exec.  │
│ Estágio atual: ● Executivo                   │
│ [ Marcar como entregue → ]  (atalho)         │
└──────────────────────────────────────────────┘

ESTADO 2 — pode gerar (entregue/aprovado, obra_id null):
┌──────────────────────────────────────────────┐
│ ✓ Projeto entregue · pronto p/ executar      │
│ Casa Lago · Residencial · 180m² · João Silva │  ← preview do que vira obra
│ Programa: Sala, 3 Suítes, Cozinha (8 amb.)   │
│ ┌──────────────────────────────────────────┐ │
│ │ 🏗  Gerar obra deste projeto   →         │ │  ← CTA verde, full-width mobile
│ └──────────────────────────────────────────┘ │
│ 🎙️ ou diga "gera a obra do Casa Lago"        │  ← affordance de voz inline
└──────────────────────────────────────────────┘

ESTADO 3 — já gerada (obra_id != null) — botão de gerar SOME:
┌──────────────────────────────────────────────┐
│ 🔗 Obra vinculada · borda dourada            │
│ CON-2026-0042 · Casa Lago                    │
│ status: planejamento · 12 frentes na EAP     │
│ [ Abrir obra → ]                             │
└──────────────────────────────────────────────┘


SIDEOVER de confirmação (reusa CadastroPremiumSideover; PASSO ÚNICO):
╔════════════════════════════════════════════════╗
║  [×]  Gerar obra · do projeto Casa Lago        ║  ← subtítulo = o elo visível
╟────────────────────────────────────────────────╢
║  ┌─ DE ──────────┐    ┌─ PARA ────────────┐   ║  ← o HANDOFF como diagrama
║  │ 📐 Projeto     │ →  │ 🏗️ Obra (nova)    │   ║
║  │ Casa Lago      │    │ herda tudo ✓      │   ║
║  │ Entregue ✓     │    │ você confirma     │   ║
║  └────────────────┘    └───────────────────┘   ║
║                                                ║
║  A IA preencheu (ajuste se precisar):          ║  ← Click-and-Go
║  Tipo  [🏗 Construção ✓][🔨 Reforma][🛠 Serviço]║  ← chip pré-marcado por mapTipologia
║  Cliente: João Silva   (herdado) 🔒            ║  ← read-only
║  Área:    180 m²       (herdado)               ║
║  Nome da obra: [ Casa Lago            ]        ║  ← editável
║                                                ║
║  EAP já montada (preset Construção · 12):      ║  ← reusa chips de frentes do preset
║  [☑ Fundação][☑ Alvenaria][☑ Hidráulica]…+9   ║
║  ▸ Programa (8 ambientes) fica vinculado ao    ║  ← contexto, sem migração
║    projeto de origem (não redigita).           ║
╟────────────────────────────────────────────────╢
║  [ Cancelar ]          [ Gerar obra ✓ ]        ║  ← CTA verde = o GATE humano
╚════════════════════════════════════════════════╝

Após "Gerar obra ✓":
 1. POST /api/crm/projetos/{id}/gerar-obra  (orquestrador fino)
 2. toast verde "Obra CON-2026-0042 criada · 12 frentes"
 3. aba re-renderiza no ESTADO 3 (obra_id gravado)
 4. router.push('/crm/obras/{obra.id}')  ← engenheiro cai no cockpit

Mobile: sideover full-screen; DE→PARA empilha vertical (DE ↓ PARA);
CTA "Gerar obra ✓" sticky no rodapé (zona do polegar); chips em wrap rolável.
```

**API — DECISÃO de arquitetura:** rota **orquestradora fina** `POST /api/crm/projetos/[id]/gerar-obra`, não um POST direto do cliente. Por quê: centraliza o gate server-side (estagio/aprovacao), a idempotência por `obra_id`, e o `PATCH` de volta numa transação lógica única — o cliente não pode pular o lock. Ela **reusa** internamente a lógica do `POST /api/crm/obras` (extrair função compartilhada `criarObraComEAP()` em vez de duplicar INSERT+EAP). `tipo_obra` e preset vêm no body como overrides opcionais; todo o resto é derivado do projeto server-side. `tenant_id` **sempre** do caller, nunca do body.

### Handoff (engenharia recebe)

O engenheiro recebe, **sem redigitar nada**, ao cair em `/crm/obras/{id}`:
- código próprio (CON/REF-AAAA-NNNN, atômico por tenant via `gerar_codigo_obra`), título, cliente, `area_total_m2`, `tipo_obra` herdados;
- EAP por disciplina já semeada do preset; status `planejamento`;
- `negocio_id` comum (linhagem comercial preservada);
- contexto do programa via o elo (a ficha da obra busca o projeto de origem).

**Status pós-handoff:** o projeto **permanece** `entregue` (gerar obra ≠ arquivar projeto). O `obra_id` é o sinal de "já passou para engenharia". O elo é **bidirecional na UI** mesmo com 1 coluna física: projeto→obra via `obra_id`; obra→projeto via lookup. **Notificação ativa à engenharia é backlog**, não MVP — o handoff é passivo (a obra aparece no funil de Obras, tenant-scoped) + a navegação direta. Não inventar canal de push nesta fatia.

### Conversacional/IA (gate)

Nova tool `arq_gerar_obra` no registry do copiloto (`lib/hub/agente-ferramentas-registry.ts`): entry no catálogo + item no union `HubAgenteFerramentaId` + `mergeUsoFerramentasComPadrao` (default `false`) + `HUB_FERRAMENTA_ACESSO: "escrita"`.

```
Usuário 🎙️: "gera a obra do projeto Casa Lago"
  ↓ resolve por título (ILIKE, tenant-scoped). 0 → "não encontrei";
    >1 → lista candidatos (título+código+cliente) p/ escolher.
  ↓ aplica as MESMAS guards do botão:
    se obra_id != null  → "O Casa Lago já tem a obra CON-2026-0042. Abrir?"
    se não entregue/aprov → "Está em Executivo. Marco como entregue e gero?"
  ↓ a IA PROPÕE o payload mapeado (tipo, cliente, área, preset, nº frentes)
    e ABRE o mesmo sideover pré-preenchido (ou card de confirmação).
  ↓ GATE: a obra só nasce no "Confirmar" explícito (regra do copiloto:
    ler livre, escrever só com Confirmar — coerente com HMAC/allowlist).
  ↓ pós-criar: PATCH obra_id + "Obra criada, abrindo" + navega.
```
Acesso `escrita` ⇒ exige o gate dourado existente. A IA nunca cria sem confirmação.

### Edge cases

| Caso | Tratamento |
|---|---|
| Projeto não entregue/sem aprovação | ESTADO 1 (card âmbar + atalho), sem botão morto; rota retorna 400 server-side |
| Gerar 2× / 2 abas / double-tap | idempotência tripla; corrida residual cai na dedup 60s do POST → 200 com obra existente |
| Projeto sem programa (0 cômodos) | obra nasce normal (EAP vem do preset); sideover omite a linha de programa |
| Tipologia null / sem equivalente | `mapTipologia()` → `reforma` (default); chip pré-marcado **editável** + microcopy "confirme o tipo" |
| Tipo sem preset | comportamento E0: obra sem frentes + aviso "adicione frentes na EAP depois" |
| Migração E0 não aplicada | `POST /obras` degrada (obra sem EAP + aviso); `obra_id` no SELECT_LEGADO; elo persiste |
| Obra deletada (elo órfão) | `ON DELETE SET NULL` zera `obra_id` no banco → ESTADO 2 reaparece sozinho |
| Cliente removido | herda só nome desnormalizado; IDs nulos não quebram o POST (opcionais) |
| Cross-tenant / 404 | rota busca projeto com `.eq('tenant_id')` puro; payload da obra usa tenant do caller; UNIQUE seria (tenant_id, …) se houver rastro reverso |
| Mobile | sideover full-screen, CTA sticky no rodapé, chips em wrap; alvo ≥44px |

### Reuso de E0/A0 × novo

**Reuso (zero duplicação):** `hub_projetos.obra_id` (coluna existente, o elo) · `PATCH /api/crm/projetos/[id]` (já aceita `obra_id`) · `GET /api/crm/projetos/[id]` (já entrega tipologia/area_m2/cliente/negocio/aprovacao/obra_id) · `POST /api/crm/obras` lógica (extraída para função compartilhada) · `gerar_codigo_obra` RPC · `getPresetPorTipo` + `frentesDoPresetParaInsert` + `TIPOS_OBRA` · `CadastroPremiumSideover` · gate dourado de escrita do copiloto · `requireCrmComercial`.

**Novo (tudo aditivo):**
- `lib/obras/eap-presets.ts` ← + `mapTipologiaParaTipoObra()` (in-code, no arquivo existente);
- `app/api/crm/projetos/[id]/gerar-obra/route.ts` ← orquestrador fino;
- refactor mínimo em `app/api/crm/obras/route.ts` ← extrair `criarObraComEAP()` (sem mudar comportamento);
- `components/crm/gerar-obra-sideover.tsx` ← passo único pré-preenchido;
- `app/crm/arquitetura/[id]/page.tsx` ← trocar `onClick` do stub pelos 3 estados + `router.push`;
- 1 entry de tool `arq_gerar_obra` no registry.
- **Nenhuma migração obrigatória.** `hub_obras.projeto_id` e `hub_obras.observacao` são melhorias opcionais futuras.

---

## AUDITORIA das decisões

**Riscos:**
- **R1 (médio) — `mapTipologiaParaTipoObra` é heurística de produto.** `comercial→servico` e `corporativo→construcao` são palpites; a tipologia é campo *livre* (sem CHECK), então pode chegar valor fora dos 6 slugs. **Mitigação:** default seguro `reforma` + chip sempre editável + microcopy. Nunca bloqueia. **Precisa do dono** para validar os rótulos (ver abaixo).
- **R2 (baixo) — janela entre `POST /obras` e `PATCH obra_id`.** Se o PATCH falhar, a obra existe sem elo. A dedup 60s cobre a re-tentativa imediata; fora dos 60s poderia nascer 2ª obra. **Mitigação robusta:** na rota orquestradora, fazer o PATCH e, em caso de falha, retornar erro **mantendo** a obra + instruir re-tentativa idempotente (que reencontra a obra por título/negocio). Aceitável para MVP; rastro reverso `projeto_id` + UNIQUE eliminaria de vez (deferido).
- **R3 (baixo) — divergência de status legado.** `hub_projetos.status` tem CHECK rígido (`briefing/desenvolvimento/aprovacao_cliente/concluido/cancelado`), mas o funil usa `estagio_slug`. A2 lê `estagio_slug`/`aprovacao_status`, **não** `status` — correto, evita o CHECK travado (observação 9262 confirma a rigidez).

**Conflito com E0/A0:** nenhum. A2 não altera schema de E0/A0, não reescreve EAP, não toca auth. O único refactor (`criarObraComEAP()`) é extração sem mudança de comportamento — preserva a dedup e o retry 23505 existentes.

**Regra de tenant:** ✅ rota busca projeto com `.eq('tenant_id', tenantId)` puro + guard 404; `tenant_id` da obra = caller, nunca do body; PATCH do projeto tenant-scoped. Sem cross-tenant.

**Idempotência:** ✅ sólida. Camada 1 (`obra_id` como lock) é a defesa de ouro e **não depende de migração**. As lentes que propunham UNIQUE INDEX em `projeto_id` assumiam uma coluna que não existe; a decisão correta é usar o `obra_id` existente — mais simples e já protegido por `ON DELETE SET NULL`.

**Correção sobre as lentes:** duas lentes propuseram migração com `UNIQUE (tenant_id, projeto_id)` e/ou `observacao`. **Auditei e rejeitei para o MVP:** `hub_obras` não tem essas colunas hoje, e o elo `hub_projetos.obra_id` já entrega idempotência + navegação sem migração. Migrar agora seria custo sem necessidade. Fica como melhoria opcional explícita.

## Critério de PRONTO

- [ ] Botão "Gerar obra" reflete os 3 estados (não-pode/pode/já-gerada) lendo `estagio_slug`/`aprovacao_status`/`obra_id`.
- [ ] Sideover passo-único pré-preenchido (tipo via mapa, cliente/área herdados, EAP do preset), humano confirma.
- [ ] `POST /gerar-obra` cria obra+EAP, grava `hub_projetos.obra_id`, retorna 201 com handoff; idempotente (2º clique → 200 obra existente).
- [ ] Gate server-side: 400 se não entregue/aprovado; 404 cross-tenant.
- [ ] `router.push('/crm/obras/{id}')` pós-criação; ESTADO 3 ao voltar.
- [ ] Tool `arq_gerar_obra` no copiloto com gate de escrita; resolve por nome; respeita as guards.
- [ ] Mobile: full-screen, CTA sticky, alvo ≥44px.
- [ ] Edge cases verificados: 0 cômodos, tipologia null, E0 não aplicado, obra deletada (elo zera).
- [ ] Gates: `tsc` + `vitest` + `_chk23` OK. Nenhuma migração aplicada sem janela do dono.

## O que precisa da janela do dono

1. **Validar o mapa `tipologia→tipo_obra`** (R1): confirmar `comercial→servico`, `corporativo→construcao`, `interiores→reforma`. É decisão de negócio; meu default é seguro mas é palpite.
2. **Confirmar o gate de habilitação ampliado** (`entregue` **OU** `aprovado`). O mínimo conservador é só `entregue` (comportamento atual); recomendo incluir `aprovado` mas o dono decide.
3. **(Não-bloqueante) Aplicar migração** — só se quiser o rastro reverso `hub_obras.projeto_id` + `observacao` (programa anexado à obra). MVP funciona 100% sem isso. Aplicar é decisão do dono (janela).

Nenhum item bloqueia a implementação do A2 core — os 3 são refinamentos/aprovações, não pré-requisitos de arquitetura.