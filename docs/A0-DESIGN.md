# A0 (funil de Projeto / Arquitetura) — Design + Auditoria (mesa redonda)

Bug confirmado (linha 44: `count` global sem `.eq('tenant_id')`). E0 já fez o ALTER do `tipo` para incluir `'projeto'`. Tenho tudo o que preciso.

## Design final de A0

**Premissa load-bearing confirmada no código:** E0 (`20260705130000_e0_obra_eap_catalogo.sql`) **já** estendeu `hub_pipelines.tipo` para `('lead','negocio','obra','projeto')`. Portanto **A0 NÃO toca o CHECK de `hub_pipelines`** — só seeda o pipeline e altera `hub_projetos`. As 3 lentes que repetem o ALTER do tipo estão **redundantes/conflitantes com E0** (ver auditoria). `hub_projetos.status` tem CHECK rígido `('briefing','desenvolvimento','aprovacao_cliente','concluido','cancelado')` e o POST tem o bug de `count` global.

### Dados (campos exatos, aditivo)

Migração `supabase/migrations/<ts>_a0_arquitetura_projeto.sql` (aditiva, idempotente, sem perda):

**1. Relaxar status (funil editável exige):**
```sql
-- migrar legado ANTES de dropar
UPDATE hub_projetos SET status='estudo'     WHERE status='desenvolvimento';
UPDATE hub_projetos SET status='aprovacao'  WHERE status='aprovacao_cliente';
UPDATE hub_projetos SET status='entregue'   WHERE status='concluido';
ALTER TABLE hub_projetos DROP CONSTRAINT IF EXISTS hub_projetos_status_check;
-- sem re-impor enum: status passa a espelhar estagio (igual hub_negocios.etapa)
```

**2. Colunas aditivas em `hub_projetos`:**
```sql
ALTER TABLE hub_projetos
  ADD COLUMN IF NOT EXISTS estagio          TEXT NOT NULL DEFAULT 'briefing',
  ADD COLUMN IF NOT EXISTS pipeline_id      UUID REFERENCES hub_pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel_id   UUID,            -- soft FK (sem REFERENCES, igual padrão obras)
  ADD COLUMN IF NOT EXISTS tipologia        TEXT,            -- dropdown na app, sem CHECK no banco
  ADD COLUMN IF NOT EXISTS area_m2          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cliente_pessoa_id  UUID,
  ADD COLUMN IF NOT EXISTS cliente_empresa_id UUID,
  ADD COLUMN IF NOT EXISTS cliente_nome     TEXT,            -- desnormalizado p/ card sem JOIN
  ADD COLUMN IF NOT EXISTS proxima_entrega  TEXT,
  ADD COLUMN IF NOT EXISTS proxima_entrega_em DATE,
  ADD COLUMN IF NOT EXISTS aprovacao_status TEXT DEFAULT 'sem_aprovacao'
     CHECK (aprovacao_status IN ('sem_aprovacao','aguardando','aprovado','reprovado'));

CREATE INDEX IF NOT EXISTS idx_hub_projetos_tenant_estagio ON hub_projetos (tenant_id, estagio, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_projetos_pipeline       ON hub_projetos (pipeline_id, estagio);
CREATE UNIQUE INDEX IF NOT EXISTS hub_projetos_codigo_tenant_uniq ON hub_projetos (tenant_id, codigo) WHERE codigo IS NOT NULL;
```
> Decisão: `tipologia`/`status`/`estagio` **sem CHECK de enum** — o funil é editável; enum fixo mata o "não-engessado". `aprovacao_status` é um eixo separado e estável (o gargalo do arquiteto), então pode ter CHECK.

**3. `hub_projetos_fases` vira o "Programa" (reuso, zero tabela nova):**
```sql
ALTER TABLE hub_projetos_fases
  ADD COLUMN IF NOT EXISTS tipo          TEXT DEFAULT 'fase',   -- 'fase' (etapa) | 'comodo' (programa)
  ADD COLUMN IF NOT EXISTS categoria     TEXT,                  -- 'ambiente'|'servico'|'lazer'|'tecnico'
  ADD COLUMN IF NOT EXISTS metragem_m2   NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS observacao    TEXT,
  ADD COLUMN IF NOT EXISTS aprovacao_status TEXT DEFAULT 'pendente'
     CHECK (aprovacao_status IN ('pendente','enviado','aprovado','rejeitado')),
  ADD COLUMN IF NOT EXISTS entregavel_url TEXT,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_hub_projetos_fases_projeto ON hub_projetos_fases (projeto_id, tipo, ordem);
```
> A coluna `tipo` separa **etapa do funil** × **cômodo do programa** na mesma tabela. Aba Programa filtra `tipo='comodo'`; entregáveis por etapa usam `tipo='fase'`. Reversível se o dono quiser tabela própria depois.

**4. RPC tenant-scoped (corrige o bug do POST):**
```sql
CREATE OR REPLACE FUNCTION gerar_codigo_projeto(p_tenant_id UUID) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE seq INT; ano TEXT := to_char(NOW(),'YYYY');
BEGIN
  SELECT COUNT(*)+1 INTO seq FROM hub_projetos
   WHERE tenant_id = p_tenant_id AND codigo LIKE 'PRJ-'||ano||'-%';
  RETURN 'PRJ-'||ano||'-'||LPAD(seq::text,4,'0');
END;$$;
GRANT EXECUTE ON FUNCTION gerar_codigo_projeto(UUID) TO anon, authenticated;
```

**5. Seed do pipeline `projeto` (editável) + `lib/crm/projeto-funil-defaults.ts`:**
```
slug='projetos-arq' (global, tenant_id NULL) tipo='projeto'
estágios: briefing #6B7280 · estudo #E0B86A · anteprojeto #C9A24A ·
          executivo #EAB308 · aprovacao #D6A129(gargalo) · entregue #22C55E(ganho) · arquivado #EF4444(perdido)
```
`ESTAGIOS_PROJETO_FALLBACK_UI` + `PipelineTipo += 'projeto'` em `pipeline-defaults.ts` (1 linha). Seed idempotente `ON CONFLICT DO NOTHING`. **Não** repetir o ALTER do `tipo` (E0 já fez). Backfill: `UPDATE hub_projetos SET pipeline_id=<projetos-arq>, estagio=mapa(status) WHERE pipeline_id IS NULL`.

### /crm/arquitetura (kanban) + ASCII

Clone de `app/crm/negocios/page.tsx`. Trocas cirúrgicas: fetch `tipo=projeto`, PATCH em `/api/crm/projetos/[id]`, card = projeto, KPIs do funil de projeto. KPI keystone = **Em aprovação** (a fila do gargalo).

```
┌─ Arquitetura · Residencial · 12 projetos ──── [+ Novo projeto][Kanban|Lista][🔍][Funil ⚙]┐
│ [Residencial][Corporativo][Interiores][+]                         ← PipelineTabsBar       │
│ ┌Hoje:2┐ ┌Em aprovação:4┐ ┌Atrasados:1┐ ┌Entregues/mês:3┐         ← KPIs 4-col           │
├─Briefing 3─┬─Estudo 2──┬─Anteproj 4─┬─Executivo 1─┬─Aprovação 4⚠─┬─Entregue─┬─Arquivado─┤
│┌─────────┐ │           │┌─────────┐ │             │┌─────────┐   │          │           │
││Casa Lago│ │           ││Loft VM  │ │             ││Apto SP  │   │          │           │
││PRJ-26-04│ │           ││PRJ-26-02│ │             ││PRJ-26-07│   │          │           │
││👤 Marina│ │           ││🏢 Vila  │ │             ││👤 Ana   │   │          │           │
││[Residenc·248m²]       ││[Interi·85m²]            ││[Reforma·60m²]            │           │
││📅 Estudo 04jul│        ││🔴 5jun ATRASOU│         ││🟡 aprov · 8 dias│       │           │
││⬜ sem envio│           │└─────────┘ │             │└─────────┘   │          │           │
│└─────────┘ │           │            │             │              │          │           │
└────────────┴───────────┴────────────┴─────────────┴──────────────┴──────────┴───────────┘
                                                                   [🎤 FAB copiloto verde]
```
**Card (`ProjetoKanbanCard`, clone de `NegocioKanbanCard`):** L1 título · L2 `PRJ-26-04`(mono dourado)+👤responsável · L3 chip tipologia(dourado 25%)+`248m²` · L4 **próxima entrega** (cor por `classificarAcao`: 🔴atrasada/🟡hoje/🟢futura; oculta se ausente) · L5 **chip aprovação** ⬜sem envio/🟡aguardando·N dias/🟢aprovado/🔴reprovado. Borda-esquerda = cor do estágio. Selo `ATRASOU` é **auto** (`proxima_entrega_em < hoje && estagio≠entregue`) — a "Situação" da planilha; estágio é o "Andamento" manual. Desktop drag-drop (reusa `moverEtapa`); mobile snap-x carousel + bottom-sheet "Mover".

### /crm/arquitetura/[id] (ficha em abas) + ASCII

5 abas, default = **Conversar** (IA-first). Coração do valor = **Programa** + **Entregáveis** (gate de aprovação do cliente).

```
┌─ ← Casa Lago Sul · PRJ-26-04 ── [Residencial][248m²] · 👤Marina · 🟡 aguardando cliente ─✕┐
│   ⌂ Residência nova · origem NEG-26-118 →                                                  │
│   [Conversar] [Programa] [Funil] [Entregáveis] [Engenharia]                                │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ CONVERSAR (default · fila de decisões + criar/mover por voz)                                 │
│  💡 "Aprovação parada há 8 dias — reenviar lembrete à Marina?"   [Confirmar][✕]              │
│  ┌ A IA entendeu assim ─────────────┐                                                        │
│  │ mover → Anteprojeto              │  [✓ Confirmar][✎ Corrigir][✕]   ← nunca auto-confirma  │
│  └──────────────────────────────────┘                                                        │
│  timeline: briefing criado · programa montado (8 cômodos) · enviado p/ aprovação             │
│  [🎤 Fale ou escreva...]                                                                      │
├─ PROGRAMA (tipo='comodo' · chips Click-and-Go, dropdown do catálogo) ────────────────────────┤
│  [+ Sala][+ Suíte][+ Cozinha][+ adicionar cômodo ▾]                                          │
│  ┌ Suíte máster 18m² ▸ closet, varanda [editar]┐  ┌ Cozinha 12m² ▸ gourmet, ilha [editar]┐  │
│  Estilo: ◉Contemporâneo ○Clássico   Total programa: 153m² · contratada: 248m²                │
│  [IA: Montar programa por tipologia →]                                                        │
├─ FUNIL (stepper do ciclo) ───────────────────────────────────────────────────────────────────┤
│  ●Briefing─●Estudo─◉Anteprojeto─○Executivo─○Aprovação─○Entrega   [Avançar p/ Executivo →]    │
│  data planejada (Situação auto) · status (Andamento) · "Editar etapas ↗"(PipelineConfigSideover)│
├─ ENTREGÁVEIS (tipo='fase' · gate de aprovação = JOB nº1) ─────────────────────────────────────┤
│  📄 Estudo v2  🟢 aprovado 02jun · visibilidade [Cliente]                                     │
│  📄 Anteproj v1 🟡 enviado 21jun · aguardando  [Reenviar lembrete]                            │
│  📄 Executivo  ⬜ rascunho  [Enviar p/ aprovação]   + Anexar (foto 2 toques)                  │
├─ ENGENHARIA (ponte E0 · stub) ───────────────────────────────────────────────────────────────┤
│  "Executivo aprovado? Gere a obra p/ orçar e executar."                                       │
│  [🏗 Gerar obra]  ← só habilita em estagio=entregue; idempotente (1 obra/projeto); tooltip    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
Mobile: abas viram `select` no topo (padrão CRM). "Gerar obra" desabilitado com tooltip "disponível ao entregar" (disjunto de E0 — A0 não desenha a obra).

### 'Novo projeto' Click-and-Go

Drawer ≤3 toques (clone de `EntitySelect` + chips do `CadastroWizard`):
```
┌ Novo projeto ──────────────────────── ✕ ┐
│ 🎤 "ou descreva por voz"                  │
│ Tipologia: [Residencial•][Corporativo]    │  Toque 1: chip (default Residencial)
│            [Interiores][Reforma]          │
│ Cliente:   [▼ buscar pessoa/empresa]      │  Toque 2: EntitySelect (opcional)
│ Título:    auto "Projeto — <Cliente>"     │  IA pré-preenche
│ Área m²:   [____] (opcional)              │
│            [Criar projeto ✓]              │  Toque 3 → ficha em Conversar
└───────────────────────────────────────────┘
```
- Só tipologia é obrigatória → nasce em "Briefing". Código `PRJ-AAAA-NNNN` **por tenant** (RPC).
- Gatilho `?negocio_id=`: herda cliente+título, pula passo 1 (**2 toques**), banner "Origem: NEG-26-118"; **se o negócio já tem projeto, oferece abrir o existente** (idempotência).
- Pós-criar: toast "PRJ-26-04 criado" → navega à ficha.

### Conversacional/IA

Reusa `CopilotoVoz` + `/api/copiloto`, **mesmo padrão que E0** (prefixo de tools por módulo, gate HMAC+TTL+allowlist, card dourado "A IA entendeu assim", escrita só com Confirmar). `CopilotoContexto += { projetoId?, modulo? }`; prompt `construirPromptCopilotoArq` selecionado quando a rota contém `/arquitetura`. 3 tools de escrita + 1 leitura:

| Tool | Ação | Rota interna |
|---|---|---|
| `arq_criar_projeto` (escrita) | "cria projeto residencial p/ Marina 200m²" | POST /api/crm/projetos |
| `arq_mover_estagio` (escrita) | "move Casa Lago p/ anteprojeto" | PATCH /api/crm/projetos/[id] {estagio} |
| `arq_programa_item` (escrita) | "monta programa: sala, 3 suítes, cozinha" | POST /api/crm/projetos/[id]/programa (array) |
| `arq_resumo` (leitura) | "o que está parado em aprovação?" | GET filtrado |

Sem `MISTRAL_API_KEY`: telas manuais 100% funcionais; voz degrada "IA indisponível" (nunca quebra). Executor sempre aplica `.eq('tenant_id')` no UPDATE/INSERT.

### Edge cases

- **Sem seed/migração:** `ESTAGIOS_PROJETO_FALLBACK_UI` (7 estágios) — nunca tela em branco; colunas novas degradam p/ null.
- **Estágio renomeado/extinto** pelo dono: projetos órfãos → coluna "Sem etapa" (cinza) com CTA mover; card nunca some.
- **Sem tipologia/m²/entrega:** chip "[Sem tipologia]" cinza; oculta linha (—), nunca "0m²"/data falsa.
- **Sem cliente:** "⌂ Sem cliente" (briefing exploratório permitido).
- **`?negocio_id` já tem projeto:** oferece abrir, não duplica.
- **Drag p/ Entrega sem entregável aprovado:** permite + toast "sem entregável aprovado" (não bloqueia — bloqueio duro é da obra/SST).
- **Mover por voz/move-etapa:** valida slug contra `hub_pipeline_estagios` do `pipeline_id` do projeto (evita etapa-fantasma; gap do kanban de negócio).
- **Double-tap criar / voz repetida:** idempotência mesmo título+tenant <60s.
- **`status` legado:** PATCH escreve `status=estagio` (compat até A1).
- **Contagem por coluna:** usar `estagio_counts` do backend, não só cards carregados (bug de paginação do negócio).
- **HMAC TTL 60s expirado:** "a proposta expirou — fale de novo", sem execução silenciosa.
- **`area_m2` string da voz:** `Number()` no executor antes do INSERT.
- **RBAC:** criar/mover = `requireCrmComercial`; ver = `requireCrmSessao`; validado no **backend**, não só escondido na UI.

### Reuso x novo

**Reusar (não recriar):** `negocios/page.tsx`→`arquitetura/page.tsx`; `NegocioKanbanCard`→`ProjetoKanbanCard`; `PipelineTabsBar`, `PipelineConfigSideover(tipo='projeto')`, `pipeline-defaults.ts`, `EntitySelect`, `CadastroWizard`, `CopilotoVoz`+`useCopilotoVoz`, `useNarrowViewport`, `EmptyState`, `COR_ACAO`/`classificarAcao`; `requireCrmComercial`/`requireCrmSessao`, `crmDb`, RLS `current_user_tenant_id()`; tabelas `hub_projetos`(+ALTERs), `hub_projetos_fases`(+ALTERs), `hub_pipelines`/`hub_pipeline_estagios`(só seed). **Novo mínimo:** `lib/crm/projeto-funil-defaults.ts`; **reescrita do POST** `/api/crm/projetos` (fix bug + RPC + campos); GET individual + PATCH `/[id]` (estagio) + `/[id]/programa`; `arquitetura/page.tsx`+`[id]/page.tsx`; `NovoProjetoSideover`; `ProjetoKanbanCard`; 4 tools IA; migração aditiva. **Disjunto de E0:** zero obra/EAP/catálogo tocados.

---

## AUDITORIA das decisões

**CRÍTICO**
1. **Conflito A0×E0 no ALTER do `tipo` (3 das 4 lentes erram).** Confirmei no código: E0 (`20260705130000`) **já** fez `CHECK (tipo IN ('lead','negocio','obra','projeto'))`. backend-architect, ai-engineer e product-owner propõem **repetir** o `DROP/ADD CONSTRAINT`. Se A0 rodar **depois** de E0, o re-ADD volta a `IN ('lead','negocio','projeto')` e **derruba `'obra'`** → quebra E0. **Decisão CEO: A0 NÃO altera `hub_pipelines.tipo`.** Se quiser cinto-e-suspensório, usar só o seed idempotente; nunca re-impor o CHECK. Esta é a divergência mais perigosa entre as lentes.
2. **Bug cross-tenant confirmado (P0).** `route.ts:44` faz `count` global sem `.eq('tenant_id')` → `PRJ-AAAA-NNNN` vaza contagem entre tenants. A0 corrige via RPC `gerar_codigo_projeto(tenant_id)` + UNIQUE `(tenant_id, codigo)`. Idêntico ao que E0 corrigiu p/ obras — **mesma decisão**, consistente.
3. **Auth do PATCH `/[id]`.** A memória (obs 9242) alerta: `/projetos` e `/obras` têm padrões de auth inconsistentes (`getCallerContext` vs `tenantIdFromRequest`). O PATCH atual de projetos precisa de `.eq('id',id).eq('tenant_id',tenantId)` no update (não só no select) p/ impedir update cross-tenant. **A auditar na implementação** — não assumir que já está scoped.

**ATENÇÃO**
4. **`responsavel_id` sem FK.** As lentes divergem: backend-architect põe `REFERENCES users(id)`, ai-engineer deixa soft. **Decisão: soft FK (sem REFERENCES)** — segue o padrão de `hub_obras` no E0 e evita acoplar a `users` (membro/arquiteto pode não ser `users`). JOIN para nome é opcional no card.
5. **Reuso de `hub_projetos_fases` p/ Programa (mistura semântica fase×cômodo).** Aposta de menor esforço; mitigada por `tipo`. Risco real se a UI não filtrar por `tipo` em cada aba → cômodo aparece no Funil. **Critério de pronto inclui o filtro.** Reversível (aditivo) se o dono pedir tabela própria.
6. **`status` sem CHECK.** Decisão deliberada (funil editável). Trade-off: perde validação no banco; ganha não-engessamento. Espelha `hub_negocios.etapa`. PATCH grava `status=estagio` p/ compat até A1 remover a dualidade.
7. **Slugs de estágio no enum das tools IA.** Se o dono renomeia o funil, a tool não conhece o slug custom → `nao_entendi`. Aceitável p/ A0; fase 2 = prompt busca slugs dinâmicos do pipeline ativo.

**MELHORIA OPCIONAL**
8. KPI "Em aprovação" como filtro clicável (fila do gargalo). 9. Lembrete de aprovação como sugestão proativa da IA no Conversar. 10. `cliente_nome` desnormalizado pode ficar stale se a pessoa for renomeada — aceitável p/ card; ficha lê do vínculo real.

**Sem divergência de auth cross-tenant nas telas** desde que (2) e (3) sejam aplicados. As lentes convergem em RLS `current_user_tenant_id()` + guards `requireCrm*`.

## Critério de PRONTO

- [ ] Migração aplica **sem tocar `hub_pipelines.tipo`**; seed idempotente; backfill mapeia status→estagio sem perda.
- [ ] POST gera código via RPC tenant-scoped; **2 tenants não colidem** PRJ; UNIQUE `(tenant_id,codigo)` ativo.
- [ ] PATCH `/[id]` faz update com `.eq('tenant_id')` (sem update cross-tenant); mover-etapa valida slug no pipeline.
- [ ] Kanban renderiza com migração e **também no fallback** (sem seed) sem tela branca; contagens vêm do backend.
- [ ] Novo projeto ≤3 toques (≤2 via `?negocio_id`); só tipologia obrigatória; não duplica projeto do mesmo negócio.
- [ ] Ficha: aba Programa filtra `tipo='comodo'`, Entregáveis `tipo='fase'`; "Gerar obra" desabilitado fora de `entregue`.
- [ ] Copiloto: escrita só com Confirmar; HMAC+TTL; sem Mistral → manual intacto; executor sempre tenant-scoped.
- [ ] Gate do projeto: `tsc` limpo + `vitest` + `_chk23` OK; nada de obra/EAP/catálogo tocado (disjunto de E0).

## O que precisa da janela do dono

1. **Aplicar a migração aditiva A0** (janela de migração — o MCP caiu antes; aplicar junto). Irreversível-parcial: o `DROP CONSTRAINT` de `hub_projetos.status` + UPDATE de legado deve rodar com backup.
2. **Validar o ciclo de 7 estágios** (Briefing→Estudo→Anteprojeto→Executivo→Aprovação→Entregue→Arquivado) — é uma aposta de fidelidade ao fluxo real do arquiteto dele; o funil é editável, mas o seed parte daqui.
3. **`MISTRAL_API_KEY`** p/ acender o conversacional pleno (já pendente na memória; A0 funciona manual sem ela).
4. **OK p/ reusar `hub_projetos_fases` como Programa** (col `tipo`) vs criar `hub_projetos_programa` — recomendo reusar (reversível).

Arquivos relevantes: `c:\Users\wende\Documents\escritorio-virtual-ramon\app\api\crm\projetos\route.ts` (bug linha 44), `app\api\crm\projetos\[id]\route.ts`, `supabase\migrations\20260523120000_crm_integral_core.sql` (schema base linhas 283-303), `supabase\migrations\20260705130000_e0_obra_eap_catalogo.sql` (E0 já estende tipo, linhas 142-144), `app\crm\negocios\page.tsx` (kanban a clonar), `lib\crm\pipeline-defaults.ts`.