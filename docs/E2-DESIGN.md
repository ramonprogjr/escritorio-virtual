# E2 (item x subitem: Situacao auto x Andamento manual) — Design + Auditoria (mesa redonda)

I now have the full real ground. I have everything I need to produce the final E2 design and audit.

## Design final de E2 — Item × Subitem (coração operacional da planilha)

### DECISAO: reconciliação item/subitem × `hub_obras_cronograma` (justificada)

**Tabela NOVA `hub_obra_itens` (com auto-join item→subitem) pendurada nas frentes (E0). `hub_obras_cronograma` fica INTACTO.** As 4 lentes convergiram nisto; eu ratifico com a evidência do código real:

- `hub_obras_cronograma` é uma lista **plana de FASES** (`fase TEXT, percentual, data_prevista, concluida boolean, tenant_id`). Não tem hierarquia, disciplina, andar, nem o par Situação×Andamento, nem bloqueios.
- **E1 já lê essa tabela diretamente** (confirmado em `docs/E1-DESIGN.md`): atrasados = `data_prevista < hoje AND concluida=false`; próximos-15d; barra = média de `percentual`. Qualquer ALTER de semântica nela quebra o cockpit.
- A planilha tem **dois níveis reais distintos**: aba *Gestão* (item de contrato por andar) e aba *Detalhamento* (subitem/EAP fina, fonte de datas/avanço/bloqueios). Forçar isso na tabela plana seria infiel e destrutivo.

**Correção sobre um ponto das lentes (engenheira):** o avanço por frente do E1 hoje **NÃO existe** — E1 usa `cronograma.percentual` por fase, e `docs/E1-DESIGN.md §133` decide explicitamente *não prometer ponderado-por-frente na UI hoje*. Portanto o **bridge E2→cronograma fica DESLIGADO por padrão (RPC manual, opt-in por obra)**, não trigger automático. Justificativa: (1) trigger em batch de importação (164 itens) dispararia 164 UPDATEs; (2) o match por nome `frente.nome = cronograma.fase` é frágil; (3) o dono pode ter digitado fases que não batem com frentes. RPC manual = seguro, reversível, degradação graciosa. (Decisão MEDIA → flag do dono, ver fim.)

**Veredito:** `hub_obra_itens` (item nível-0, `parent_id NULL`) + subitens (`parent_id NOT NULL`) na **mesma tabela** com auto-referência — escolho o modelo da lente backend-architect/ai-engineer-1 (auto-join) sobre duas tabelas separadas (`hub_obra_subitens`) porque: item e subitem têm os **mesmos campos** (datas, avanço, andamento, bloqueios, situação derivada); auto-join evita duplicar a view de situação e os 4 tools de voz; espelha a numeração da planilha (`A=item`, `B=X.Y.N=subitem`) com `codigo` único por obra. Subitem que cruza andar continua válido (campo `area_codigo` próprio).

---

### Modelo de dados (campos exatos, aditivo, sem quebrar E1)

```sql
-- supabase/migrations/20260710120000_e2_obra_itens.sql
-- ⚠️ NÃO aplicar — janela do dono. ADITIVA: zero DROP, zero ALTER em hub_obras_cronograma.
CREATE TABLE public.hub_obra_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  frente_id       UUID REFERENCES public.hub_obra_frentes_eap(id) ON DELETE SET NULL, -- E0; nullable
  parent_id       UUID REFERENCES public.hub_obra_itens(id) ON DELETE CASCADE,        -- NULL=item, set=subitem
  -- Identificação (planilha: A=item, B=subitem)
  codigo          TEXT NOT NULL,           -- "HAD8.01" | "2.1.3"
  nome            TEXT NOT NULL,           -- Atividade (col C)
  descricao       TEXT,                    -- col D
  disciplina_slug TEXT,                    -- desnorm. da frente (catálogo E0) — query sem JOIN
  area_codigo     TEXT,                    -- "ANDAR8" (hub_catalogo categoria=area_andar)
  area_label      TEXT,                    -- "Andar 8" (desnorm. p/ exibição)
  tipo            TEXT NOT NULL DEFAULT 'contrato' CHECK (tipo IN ('contrato','aditivo','servico_extra')),
  -- Datas (fonte: Início/Término do Detalhamento)
  data_inicio     DATE,
  data_termino    DATE,
  -- Avanço (col O) — MANUAL
  pct_avanco      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pct_avanco BETWEEN 0 AND 100),
  -- SITUAÇÃO = AUTOMÁTICA → NÃO é coluna; derivada na VIEW. Só guarda override p/ aditivo de prazo:
  situacao_override TEXT CHECK (situacao_override IN ('a_iniciar','em_andamento','atrasado','concluido','cancelado')),
  -- ANDAMENTO = MANUAL (col H da planilha; KPI "Finalizados" conta ISTO)
  andamento       TEXT NOT NULL DEFAULT 'nao_iniciado'
                  CHECK (andamento IN ('nao_iniciado','iniciado','paralisado','finalizado','cancelado')),
  -- Bloqueios (planilha cols J–N = "Não")
  falta_pessoa BOOLEAN NOT NULL DEFAULT false, falta_documento BOOLEAN NOT NULL DEFAULT false,
  falta_material BOOLEAN NOT NULL DEFAULT false, falta_ferramenta BOOLEAN NOT NULL DEFAULT false,
  falta_equipamento BOOLEAN NOT NULL DEFAULT false, bloqueio_obs TEXT,
  -- Medição / contrato / responsável / evidência
  quantidade NUMERIC(10,3), unidade TEXT, valor_contrato NUMERIC(14,2),
  responsavel_id UUID, responsavel_nome TEXT,
  tem_evidencia BOOLEAN NOT NULL DEFAULT false, evidencia_url TEXT, observacoes TEXT,
  -- Controle
  peso NUMERIC(5,2) NOT NULL DEFAULT 0, ordem INTEGER NOT NULL DEFAULT 0, ativo BOOLEAN NOT NULL DEFAULT true,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','ia','importacao','aditivo')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obra_id, codigo)
);
CREATE INDEX idx_hub_obra_itens_obra       ON public.hub_obra_itens (obra_id, ativo, ordem);
CREATE INDEX idx_hub_obra_itens_tenant     ON public.hub_obra_itens (tenant_id);
CREATE INDEX idx_hub_obra_itens_frente     ON public.hub_obra_itens (frente_id);
CREATE INDEX idx_hub_obra_itens_parent     ON public.hub_obra_itens (parent_id);
CREATE INDEX idx_hub_obra_itens_disciplina ON public.hub_obra_itens (obra_id, disciplina_slug);
CREATE INDEX idx_hub_obra_itens_area       ON public.hub_obra_itens (obra_id, area_codigo);
CREATE INDEX idx_hub_obra_itens_atrasados  ON public.hub_obra_itens (obra_id, data_termino)
  WHERE ativo = true AND pct_avanco < 100 AND andamento NOT IN ('finalizado','cancelado');

DROP TRIGGER IF EXISTS hub_obra_itens_ts ON public.hub_obra_itens;       -- reusa função existente
CREATE TRIGGER hub_obra_itens_ts BEFORE UPDATE ON public.hub_obra_itens
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

ALTER TABLE public.hub_obra_itens ENABLE ROW LEVEL SECURITY;             -- padrão das ~36 tabelas
DROP POLICY IF EXISTS hub_obra_itens_rls ON public.hub_obra_itens;
CREATE POLICY hub_obra_itens_rls ON public.hub_obra_itens FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id()) WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_itens TO authenticated, service_role;
```

**VIEW da Situação (AUTO, nunca gravada):**
```sql
CREATE OR REPLACE VIEW public.vw_hub_obra_itens_situacao WITH (security_invoker = true) AS
SELECT i.*,
  CASE
    WHEN i.andamento = 'cancelado' THEN 'cancelado'
    WHEN i.andamento = 'finalizado' OR i.pct_avanco >= 100 THEN 'concluido'  -- andamento manda no fecho
    WHEN i.situacao_override IS NOT NULL THEN i.situacao_override            -- aditivo de prazo aprovado
    WHEN i.data_termino IS NULL OR i.data_inicio IS NULL THEN 'sem_data'     -- planilha tolera s/ data
    WHEN i.data_termino < CURRENT_DATE AND i.pct_avanco < 100 THEN 'atrasado'
    WHEN i.data_inicio > CURRENT_DATE THEN 'a_iniciar'
    WHEN i.data_termino BETWEEN CURRENT_DATE AND CURRENT_DATE + 3 AND i.pct_avanco < 70 THEN 'atencao'
    ELSE 'em_andamento'
  END AS situacao,
  CASE WHEN i.data_termino IS NOT NULL THEN (CURRENT_DATE - i.data_termino)::int END AS dias_atraso
FROM public.hub_obra_itens i WHERE i.ativo = true;
GRANT SELECT ON public.vw_hub_obra_itens_situacao TO authenticated;
```

**Bridge OPT-IN (E2→E1), nunca trigger:** RPC `update_cronograma_from_itens(p_obra_id, p_frente_id DEFAULT NULL)` (`SECURITY DEFINER`, sem `public/anon`), liga pelo nome `frente.nome = cronograma.fase`, atualiza `percentual = AVG(pct_avanco)` + `concluida` **só onde já existe linha de cronograma** (preserva o % manual do gestor). Chamada por botão "Sincronizar cronograma" na tela E2. Se ninguém liga, E1 segue intacto com os dados que já tem.

**Reconciliação garantida:** zero ALTER/DROP em `hub_obras_cronograma`, `hub_obras`, `hub_obra_frentes_eap`. `frente_id` nullable → E2 funciona mesmo sem E0 aplicado (degrada via `disciplina_slug` desnorm.). E1 nunca depende de E2 (dependência unidirecional e opcional).

---

### Telas + ASCII · Situação (auto) × Andamento (manual)

E2 vive como **aba "Itens"** em `app/crm/obras/[id]` (disjunta da aba "Hoje"=E1). Rota `/crm/obras/[id]/itens`. Reusa o board/toggle de `app/crm/negocios` e `NegocioKanbanCard` como molde.

**GRAMÁTICA DE NÃO-COLISÃO (o insight genial da planilha em pixels):**
- **SITUAÇÃO = canal COR** → barra/borda-esquerda preenchida + ícone + 🔒 (readonly, calculada). CAPS. Cores fiéis ao seed E0: a_iniciar `#6B7280`, em_andamento/ok `#C9A24A`, atenção `#F59E0B`, atrasado `#EF4444`, concluído `#22C55E`, sem_data `#484f58`, cancelado `#6E7781` riscado.
- **ANDAMENTO = canal FORMA+TEXTO** → chip contornado, à direita, clicável (pointer, hover dourado). Title Case. nao_iniciado cinza, iniciado `#3B82F6`, paralisado `#F97316`, finalizado `#22C55E`, cancelado riscado.
- **Regra crítica:** SEMPRE lado a lado, nunca um colapsa o outro. A tensão "Situação=Atrasado × Andamento=Iniciado" = alarme visível. **KPI "Finalizados" conta `andamento='finalizado'`, NUNCA situação.**

**TELA A — Lista/Kanban, toggle Disciplina↔Andar:**
```
┌─ REF-2026-0004 · Itens & Avanço ───────────────── [+ Item][🎤]┐
│ ╭Hoje╮╭ITENS╮╭Cronograma╮╭Diário╮   Agrupar:(◉Disciplina)(○Andar)│
│ ✨ IA: 2 atrasados críticos · falta material        [Ver ▸]    │
│ Σ obra 63% ▓▓▓▓▓▓▓░  Finalizados 41/164  Atrasados 7  Bloq. 4  │
│ Filtro: ●Atrasados(7) ◐Em risco(12) ⛔Bloqueados(4) [Cards|Lista]│
├─ ▼ ELÉTRICA · 18 itens · ▓▓▓▓▓▓▓░ 72% ───────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐ │
│  │▌ HAE8.01 Spot embutir · Andar 8                          │ │
│  │  █ATRASADO 🔒          ⟨Iniciado⟩  ← cor(esq) | chip(dir)│ │
│  │  ▓▓▓▓▓▓░░ 60%  term.28/06 (−2d) ⛔material 📷2  [9 sub ▸]│ │
│  └──────────────────────────────────────────────────────────┘ │
├─ ▼ CIVIL · 31 · ▓▓▓░ 28% [colapsado] ─────────────────────────┤
└────────────────────────────────────────────────────────────────┘
Toggle "Andar" → colunas viram Andar 8/9/Roof Top; disciplina vira tag de cor no card.
Mesma grade, só muda o eixo (sem recarregar). Borda-esq do card = COR da Situação.
```

**TELA B — Ficha do item (drawer 440px / bottom-sheet mobile):**
```
┌─ HAE8.01 · Spot embutir · Elétrica · Andar 8 ────────── ✕ ┐
│ SITUAÇÃO (automática)            ANDAMENTO (você declara)  │
│ ┌ █ ATRASADO 🔒 ┐               ⟨Não inic.⟩⟨Iniciado●⟩    │
│ │ venceu há 2d  │               ⟨Paralisado⟩⟨Finalizado⟩  │
│ └ readonly ─────┘               ⟨Cancelado⟩  (Click-and-Go)│
│ Avanço            [🎤 "marca 75%"]                         │
│ 0 ▓▓▓▓▓▓▓▓░░░░ ●━ 100   75%   [25][50][75][✓100]          │
│ Datas  Início 03/03  Término 28/06 🔴   (date picker grande)│
│ Bloqueios [👤ok][📄ok][📦Falta material!][🔧ok][🚜ok]      │
│ 9 subitens ─ 2.1.1 Isolamento  ●a iniciar 0% · [+ ver 7]  │
│ ⚠ "Spot" também aparece em Andar 9 — ver lá (aviso planilha)│
│ Observações [...]  [📷 Evidência] [💾 Salvar]              │
└────────────────────────────────────────────────────────────┘
Subitem = ficha idêntica, breadcrumb Elétrica→HAE8.01→2.1.3, sem seção subitens.
Mobile: slider vira bottom-sheet [25][50][75][100][Outro], alvos ≥44px; FAB de voz reposiciona.
```
**% do item:** editável direto **se folha** (sem subitens); **read-only derivado** (média dos subitens ativos não-cancelados) se tiver subitens — "calculado dos N subitens", nunca dois donos do mesmo número.

---

### Conversacional/IA

Reusa `CopilotoVoz` (FAB + evento `copiloto:abrir`), `copiloto-core` (`assinarConfirmacao`/`validarConfirmacao` HMAC, `escritaSemLead`, `ferramentaExecutavel`, gate `acaoPendente` dourado), padrão de `hub_obra_criar`/`hub_obra_eap_montar` já registrados. As 4 tools só são injetadas quando `rotaObra=true` (`/\/(obras|engenharia)/i` já existe). Registrar em `HubAgenteFerramentaId` + `HUB_FERRAMENTA_ACESSO` + (as 2 de escrita) em `COPILOTO_FERRAMENTAS_ESCRITA_FASE3` e `COPILOTO_FERRAMENTAS_ESCRITA_SEM_LEAD`:

1. **`hub_obra_item_listar`** (LEITURA, auto-executa): "o que está atrasado na elétrica do Andar 8?" → GET com filtros disciplina/area/situação.
2. **`hub_obra_item_avanco`** (ESCRITA, gate SEMPRE): "marca 60% na alvenaria do Andar 8" → card dourado `⟨Item: Alvenaria A8⟩⟨Avanço: 60%⟩` → Confirmar → PATCH. Se 100% → pergunta opcional "marcar Finalizado também?".
3. **`hub_obra_item_andamento`** (ESCRITA, gate SEMPRE; `finalizado`/`cancelado` = **gate reforçado** com aviso, irreversível operacional): "item 3.2 paralisado, falta cimento" → `{andamento:'paralisado', falta_material:true}`.
4. **`hub_obra_item_resumo`** (LEITURA): "resumo da obra hoje" → injeta no banner dourado do painel.

**Situação NUNCA é escrita por voz** (é derivada). **Ambiguidade** ("marca 60% na alvenaria" com 3 andares) → chip-picker `[A8][A9][Roof Top]` antes do gate, nunca aplica a múltiplos. Auditoria em `hub_ia_consumo` (before/after) — compatível com metering existente.

---

### Edge cases

- **Item sem subitem:** válido e comum (itens de *Gestão* sem *Detalhamento*); slider editável direto no item; CTA "+ subitem" não obriga.
- **Subitem/código repetido em outro bloco/andar:** `UNIQUE(obra_id, codigo)` → 409 + sugestão de código alternativo; nome similar em outra área = **aviso amarelo não-bloqueante** (fiel à planilha que avisa, não bloqueia). Import batch: card de revisão antes de inserir.
- **Frente sem item:** coluna com empty-state "0 itens · + adicionar"; `pct_frente = NULL` (não 0%) p/ distinguir; bridge NÃO toca cronograma (preserva % manual).
- **% por frente:** E2-v1 usa `AVG(pct_avanco) FILTER (WHERE andamento != 'cancelado')` (honesto, sem fingir ponderação por peso — `peso` existe mas só trava em E4).
- **Conflito Situação×Andamento** (Finalizado mas Atrasado pelo prazo): mostra **ambos** sem "resolver" — info real (terminou atrasado); KPI conta Finalizado; histórico registra atraso.
- **`pct_avanco=100` não força `finalizado`:** a separação é sagrada (decisão do dono); UI sugere, não força.
- **Cancelado/Paralisado:** cancelado sai do numerador; **decisão do dono** se encolhe também o denominador da barra da obra (default: excluído de ambos). Paralisado pinta Situação âmbar (humano sobrepõe a máquina visualmente) e não conta como "atrasado acionável do dia".
- **Mobile:** slider 48px/thumb 32px; <400px vira bottom-sheet de chips; andamento via bottom-sheet de botões ≥56px, não dropdown.
- **Voz em obra barulhenta:** `interimResults` ao vivo; confiança baixa → confirmação textual editável; fallback Voxtral.
- **Migração E0 não aplicada:** `frente_id` nullable; `disciplina_slug` desnorm. garante agrupamento; resumo não faz JOIN com frentes.
- **Volume (164+321):** paginação (limit 50, cursor por ordem); seções colapsadas com count no header; `/resumo` = único `GROUP BY ... FILTER` sem N+1.
- **Concorrência:** MVP "último ganha" (`.eq(id).eq(tenant_id)`); E2-v2 adiciona `If-Match` por `atualizado_em`.

### Reuso/reconciliação × novo

| Reusa (não duplica) | Novo (E2) |
|---|---|
| `hub_obra_frentes_eap` (E0) — `frente_id` pendura | `hub_obra_itens` (item+subitem auto-join) |
| `hub_catalogo` `area_andar`/disciplina — dropdowns | `vw_hub_obra_itens_situacao` (situação AUTO) |
| `hub_obras_cronograma` — **INTACTO** (E1 lê) | RPC `update_cronograma_from_itens` (bridge opt-in) |
| `CopilotoVoz` + `copiloto-core` (gate, HMAC) | 4 tools `hub_obra_item_*` |
| `app/crm/negocios` kanban/lista + `NegocioKanbanCard` | aba "Itens" em `app/crm/obras/[id]` |
| `requireCrmSessao`/`g.ctx.tenantId`/`crmDb`/`isMissingPgColumn`; `hub_atualizar_timestamp()`; `current_user_tenant_id()` | 5 endpoints `/api/crm/obras/[id]/itens*` |
| tokens `--obra-*`/`--brand-*` (globals.css); cores E0 | — (zero hex fora do catálogo) |

---

## AUDITORIA das decisões

**1. Bridge E2→E1 frágil (risco MEDIO, mitigado).** Liga por `frente.nome = cronograma.fase` (texto). Se o gestor digitou fases diferentes das frentes, não liga. As 3 lentes que propuseram **trigger automático** (`sync_cronograma_por_frente AFTER UPDATE`) estão **erradas para E2-v1**: (a) import de 164 itens dispara 164 UPDATEs + risco de recursão; (b) `docs/E1-DESIGN.md §133` decidiu *não* prometer ponderado-por-frente agora. **Resolvido:** RPC manual opt-in. E2-v2 adiciona `frente_id UUID` em `hub_obras_cronograma` p/ ligar por UUID (aditivo, futuro).

**2. Conflito com E1 (BAIXO).** E1 lê `hub_obras_cronograma(fase, percentual, data_prevista, concluida)` — E2 não altera estrutura nem semântica. As lentes que escreveram `cronograma.descricao`/string "Finalizado" repetiram o **erro de nome de coluna** já flagrado em `docs/E1-DESIGN.md §132`. **Resolvido:** bridge usa `fase`/`percentual`/`concluida` reais. Sem o bridge, E1 fica idêntico ao de hoje.

**3. Conflito com E0 (BAIXO).** `frente_id` é FK nullable `ON DELETE SET NULL` → desativar/excluir frente não derruba itens. `disciplina_slug`/`area_codigo` desnormalizados (do catálogo E0) garantem agrupamento sem JOIN e funcionam **mesmo com E0 não aplicado** (fallback). `current_user_tenant_id()` e `hub_atualizar_timestamp()` já existem.

**4. RLS / vazamento cross-tenant (CRÍTICO, mitigado).** `crmDb()` é service-role e **bypassa RLS** — o isolamento depende 100% do `.eq('tenant_id', tenantId)` no código (precedente: vazamento corrigido em 28/jun; `E1-DESIGN §135`). **Mandatório:** todo endpoint filtra `tenant_id` E `obra_id` (não só `obra_id IN`). A `vw_...situacao` usa `security_invoker=true` (respeita RLS de quem chama). A view expõe `i.*` incluindo `tenant_id` — OK, mas o endpoint ainda deve filtrar explicitamente.

**5. Fidelidade à planilha (ALTA).** Situação(máquina)×Andamento(humano) preservados como canais visuais distintos; item×subitem×disciplina×andar via `parent_id`+`frente_id`+`area_codigo`; KPI Finalizados = `andamento='finalizado'` (não situação/não pct=100); 5 bloqueios = cols J–N; aviso de duplicidade não-bloqueante; situação `sem_data` tolera item sem prazo. **Único desvio consciente:** subitem em tabela única (não `hub_obra_subitens` separada) — ganho de manutenção, sem perda de fidelidade.

**6. Risco de regressão do KPI (ATENÇÃO).** Há risco real de alguém ligar "Finalizados" à cor `situacao='concluido'`. **Travar em teste:** `KPI = COUNT(andamento='finalizado')`; item a 100% paralisado **não** conta.

---

## Critério de PRONTO

- Migração `20260710120000_e2_obra_itens.sql` aditiva (zero DROP, marcador "⚠️ NÃO aplicar — janela do dono"); `tsc + vitest + build + _chk23` verdes.
- `vw_hub_obra_itens_situacao` retorna situação correta para os 7 estados (testar com SELECT real, como exigiu E1 §132 — não confiar no `isMissingPgColumn` mascarando coluna errada).
- Aba "Itens" renderiza desktop + mobile; toggle Disciplina↔Andar sem recarregar; Situação(barra-cor readonly+🔒) e Andamento(chip clicável) visualmente distintos.
- Ficha: slider salva otimista; % derivado read-only quando há subitens; 5 bloqueios togglam; aviso de duplicidade aparece.
- 4 tools de voz: leitura auto-executa; escrita passa pelo gate dourado; `finalizado`/`cancelado` gate reforçado; ambiguidade → chip-picker; auditoria em `hub_ia_consumo`.
- KPI Finalizados = `andamento='finalizado'` (teste de regressão).
- Todos os 5 endpoints filtram `tenant_id` + `obra_id`.
- E1 (cockpit "Hoje") segue funcionando idêntico (bridge desligado).

## O que precisa da janela do dono

1. **Aplicar a migração E2** (e a E0 `20260705130000`, ainda pendente) — banco em prod, decisão do dono.
2. **Flag comercial — Cancelado:** encolhe o denominador da barra de progresso da obra, ou só é excluído do numerador? (default proposto: excluído de ambos, como a planilha que separa "Cancelado").
3. **Flag — Bridge E2→cronograma:** ligar o "Sincronizar cronograma" (RPC opt-in) por obra, ou manter E1 só com o % manual de fases? (recomendo manual/opt-in em v1).
4. **Validar ao vivo** os 3 fluxos de voz em prod (depende de `MISTRAL_API_KEY` no Render — já pendente em memória).

Arquivos-âncora (chão real): `supabase/migrations/20260705130000_e0_obra_eap_catalogo.sql`, `supabase/migrations/20260523120000_crm_integral_core.sql` (linhas 203–229), `docs/E1-DESIGN.md`, `lib/copiloto/copiloto-core.ts`, `lib/obras/eap-presets.ts`, `app/crm/negocios/page.tsx`, `components/crm/CopilotoVoz.tsx`. Nada foi editado — design-only.