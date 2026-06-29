# EAP refinada (segmento->ambiente->disciplina->atividade + taxonomia) — Design + implantacao (mesa redonda)

Tenho o chão real completo. Os 4 desenhos divergem num ponto-chave (AMBIENTE como nível da árvore vs campo desnormalizado), e o insumo do dono é explícito ("ambiente-first", "descritivo padrão = taxonomia controlada", "v1 = estrutura+descritivo, humano confirma qtd"). Produzo o design ideal consolidado.

## EAP por ambiente→disciplina→atividade — design ideal

**Veredito do CEO:** ENDOSSO o refino. É genuinamente **aditivo** sobre E0/E2 deployados: 1 tabela nova (taxonomia) + ~4 colunas nullable + presets por segmento. Zero DROP, nada-se-perde. As 4 lentes convergem em 90%; resolvo os 2 conflitos abaixo com decisão fechada.

**Conflito resolvido #1 — AMBIENTE: nível da árvore OU campo desnorm?**
Decisão: **AMBOS, mas o campo desnorm é a fonte de verdade da UI; o nó-árvore é opcional.** O dado canônico de agrupamento é `hub_obra_itens.ambiente` (texto/slug). O nó "ambiente" em `hub_obra_frentes_eap` (via `tipo_no='ambiente'`) é opt-in, só quando o usuário quer pesos físico/financeiro POR ambiente. Razão: o E2 já provou que o toggle Disciplina↔Andar funciona com campo desnorm (`area_codigo`) sem árvore — ambiente segue o mesmo padrão validado. Mais simples de query, zero JOIN, e não força reorganizar a árvore. A árvore fica como enriquecimento futuro (E4 pesos).

**Conflito resolvido #2 — taxonomia: tabela própria OU categoria em hub_catalogo?**
Decisão: **tabela própria `hub_obra_taxonomia`.** A taxonomia tem estrutura rica que `hub_catalogo` (codigo/descricao/unidade plano) não comporta: `sinonimos[]`, `descricao_padrao` longo, `qtd_padrao`, `ambiente_tipico[]`, `valor_ref` — e precisa de índice GIN/FTS para a IA classificar. Forçar em hub_catalogo poluiria o master de dropdowns. Tabela separada = limpo e indexável.

### Modelo (segmento/ambiente/disciplina/atividade na árvore E0/E2, aditivo)

Os 4 níveis do dono mapeiam assim no chão real:

```
SEGMENTO   = atributo do PRESET + campo em hub_obras  (NÃO é nível da árvore)
             5 segmentos = 5 presets em hub_eap_presets (como "Reforma Padrão" hoje é 1)
AMBIENTE   = campo desnorm hub_obra_itens.ambiente (fonte da UI)
             + nó opcional na árvore (tipo_no='ambiente') p/ pesos por ambiente
DISCIPLINA = hub_obra_frentes_eap (frente, disciplina_slug) — JÁ EXISTE (E0)
ATIVIDADE  = hub_obra_itens (E2) — JÁ EXISTE; ganha taxonomia_id + ambiente
```

Árvore real (Consulado, segmento='corporativo'):
```
hub_obras (.segmento='corporativo')                    ← +1 coluna
 └ hub_obra_frentes_eap (DISCIPLINA — já existe)
     ├ ELET  disciplina_slug='eletrica'
     └ HIDR  disciplina_slug='hidraulica'
 └ hub_obra_itens (ATIVIDADE — já existe; +3 colunas)
     • Tomada 1,10m  frente_id=ELET  ambiente='recepcao'
                     taxonomia_id=T-ELET-TOMADA-110  qtd=8  un
     • Dados e voz   frente_id=ELET  ambiente='recepcao'  taxonomia_id=T-ELET-DADOS-VOZ
```

Colunas aditivas (todas nullable → linhas existentes intactas):
```sql
-- hub_obras
ADD segmento TEXT CHECK (segmento IN ('residencial','comercial','corporativo','clinicas','pdv'));
-- hub_obra_itens (E2)
ADD ambiente TEXT;            -- 'recepcao','sala','cozinha' — chave do toggle ambiente-first
ADD taxonomia_id UUID REFERENCES hub_obra_taxonomia(id) ON DELETE SET NULL;
-- hub_obra_frentes_eap (E0)
ADD tipo_no TEXT NOT NULL DEFAULT 'frente' CHECK (tipo_no IN ('frente','ambiente','disciplina'));
-- hub_eap_presets (E0)
ADD segmento TEXT;           -- NULL = genérico (os 3 presets atuais ficam NULL = nada quebra)
-- índice ambiente-first
CREATE INDEX idx_hub_obra_itens_ambiente ON hub_obra_itens (obra_id, ambiente, disciplina_slug) WHERE ativo = true;
```
`DEFAULT 'frente'` em `tipo_no` é o que garante nada-se-perde: toda frente já no ar continua idêntica (disciplina-first). O refino é opt-in por obra nova.

### Taxonomia / descritivo padrão (catálogo de atividades) — o enabler da IA

A peça verdadeiramente nova. É o "modelo a inserir" do dono = lista controlada que a IA **classifica** (problema fechado e auditável) em vez de extrair texto livre.

```sql
CREATE TABLE public.hub_obra_taxonomia (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES hub_tenants(id) ON DELETE CASCADE,  -- NULL = global
  disciplina_slug  TEXT NOT NULL,                    -- FK lógica ao hub_catalogo
  codigo           TEXT NOT NULL,                    -- 'ELET-TOMADA-110' (estável, alvo da IA)
  nome             TEXT NOT NULL,                    -- "Tomada 1,10m"
  descricao_padrao TEXT,                             -- o memorial pronto (NBR, altura, bitola)
  sinonimos        TEXT[] NOT NULL DEFAULT '{}',     -- ['tomada alta','TUG 1,10'] — vocabulário p/ a IA
  unidade          TEXT,                             -- 'un','m','m²','pt','vb'
  qtd_padrao       NUMERIC(10,3),                    -- sugestão; humano confirma (v1 do dono)
  ambiente_tipico  TEXT[] DEFAULT '{}',              -- ['sala','recepcao'] — guia do preset/IA
  segmento_tipico  TEXT[] DEFAULT '{}',
  valor_ref_unitario NUMERIC(14,2),                  -- liga ao marketplace E5 depois
  ativo BOOLEAN NOT NULL DEFAULT true, ordem NUMERIC(6,2) DEFAULT 0,
  origem TEXT NOT NULL DEFAULT 'sistema' CHECK (origem IN ('sistema','tenant','ia')),
  criado_em TIMESTAMPTZ DEFAULT NOW(), atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, codigo)      -- PG15 (Supabase) suporta
);
CREATE INDEX idx_taxonomia_disc ON hub_obra_taxonomia (disciplina_slug, ativo, ordem);
CREATE INDEX idx_taxonomia_fts  ON hub_obra_taxonomia
  USING GIN (to_tsvector('portuguese', nome || ' ' || array_to_string(sinonimos,' ')));
CREATE INDEX idx_taxonomia_sin  ON hub_obra_taxonomia USING GIN (sinonimos);
```
RLS = espelho de `hub_catalogo` (read: `tenant_id IS NULL OR = current_user_tenant_id()`; write: só tenant). `sistema=NULL` global, ninguém edita o global pelo app.

**Decisão de modelagem (corrijo a backend-lens):** a taxonomia NÃO carrega `(segmento, ambiente)` na chave única. Uma "Tomada 1,10m" é a MESMA atividade em qualquer segmento — o que varia (onde aparece, quanto) vai em `ambiente_tipico[]`/`segmento_tipico[]` (guias) e o `qtd_padrao` por contexto vai no **preset** (`atividades_default`), não na taxonomia. Isso evita 3.750 linhas duplicadas (5 seg × 10 amb × 15 disc × 5 atv) e mantém a taxonomia enxuta (~80-120 atividades canônicas).

Seed Elétrica (o exemplo literal do dono):
```
ELET-DADOS-VOZ   Dados e voz        pt  sin:[ponto de rede,RJ45,cabo de rede]
ELET-TOMADA-110  Tomada 1,10m       pt  sin:[tomada alta,tomada uso geral,TUG]
ELET-TOMADA-030  Tomada 0,30m       pt  sin:[tomada baixa,tomada fogão]
ELET-ILUM-LED    Iluminação LED     pt  sin:[spot,plafon,ponto de luz,luminária embutida]
ELET-ILUM-PLAFON Iluminação plafon  pt  sin:[plafon,luminária sobrepor]
ELET-QDL         Quadro de luz      un  sin:[QDL,disjuntor,quadro elétrico]
```

### Templates por segmento

`hub_eap_presets.frentes_json` evolui (campos novos opcionais — retrocompat total):
```jsonc
[{
  "disciplina_slug": "eletrica", "nome": "Elétrica", "peso_fisico": 10,
  "ambientes": [                                  // NOVO, opcional
    { "codigo": "RECEPCAO", "label": "Recepção",
      "atividades_default": [                      // refs a taxonomia.codigo + qtd POR contexto
        { "codigo": "ELET-TOMADA-110", "qtd": 8 },
        { "codigo": "ELET-DADOS-VOZ",  "qtd": 4 },
        { "codigo": "ELET-ILUM-LED",   "qtd": 6 } ] } ] }]
```
5 presets novos: `residencial-padrao`, `comercial-padrao`, `corporativo-padrao`, `clinicas-padrao`, `pdv-padrao` (cada um com `segmento` preenchido). Os 3 presets atuais ficam `segmento=NULL` = genérico, intocados.

### UI (navegar por ambiente) + ASCII

Reusa o toggle do E2 (hoje Disciplina↔Andar); ganha 3º eixo **Ambiente** (default nos segmentos Residencial/Clínicas/PDV). Mesmo board, só muda o `GROUP BY`. Gramática preservada: Situação=COR(borda+selo+🔒), Andamento=chip clicável.

```
┌─ REF-2026-0007 · Itens & Avanço ──────────────── [+][🎤]┐
│ ╭Hoje╮╭ITENS╮╭Cronograma╮  Agrupar:(◉Ambiente)(○Discipl.)(○Andar)│
│ Segmento: Corporativo ▾   Σ 63% ▓▓▓▓▓▓▓░  Finaliz. 41/164 │
├ ▼ 🚪 RECEPÇÃO · 13 itens · ▓▓▓▓░ 48% ─────────────────────┤
│   ▼ ⚡ Elétrica · 8                                        │
│     ▌ Tomada 1,10m   ×8  █EM ANDAM.🔒 ⟨Iniciado⟩          │
│     ▌ Dados e voz    ×4  █A INICIAR🔒 ⟨Não inic.⟩         │
│     ▌ Iluminação LED ×6  █CONCLUÍDO🔒 ⟨Finalizado⟩  [desc▸]│
│   ▶ 🚿 Hidráulica · 5                                      │
│   + atividade na Recepção (do catálogo ▾)                 │ ← Click-and-Go
├ ▶ 🗣 SALA DE REUNIÃO · 9 [colapsado] ─────────────────────┤
└────────────────────────────────────────────────────────────┘
Toggle "Disciplina" → 1º nível vira Elétrica/Hidráulica (visão do subempreiteiro),
ambiente vira tag no card. Mesmo dado, eixo pivotado (já é assim no E2).
Item sem ambiente (legado/NULL) → agrupa em "Sem ambiente definido" + CTA "+ definir".
```
**Criação (wizard E0):** passo novo "Segmento?" (chips: 🏠Residencial 🏢Comercial 🏬Corporativo 🩺Clínicas 🛒PDV + Geral) entre tipo e EAP. Sem segmento = preset genérico atual (backward compat). Selecionado → entrega ambientes típicos com atividades pré-marcadas (desmarca o que não tem).

**Ficha da atividade** ganha bloco "Descritivo padrão" (vem da taxonomia, editável) + stepper de quantidade (o único número que o humano confirma na v1).

### A taxonomia serve a IA (Orçamento IA v1 — capability que pluga depois)

```
PDF memorial → MarkItDown (já existe) → texto → chunk por ambiente
   ↓ Mistral: "classifique cada menção em {disciplina,codigo da taxonomia}; qtd se houver; senão null"
JSON classificado → card dourado de revisão (Click-and-Go):
   [✓] Recepção/Elétrica/Tomada 1,10m  qtd:[8]  conf.97%
   [⚠] Recepção/Elétrica/dimmer        CUSTOM   conf.<70% ← humano nomeia
   ↓ Confirmar (gate HMAC) → RPC insere em hub_obra_itens (origem='ia', taxonomia_id)
```
A taxonomia transforma NLP aberto em **classificação fechada** (85-92% nos itens comuns). Cada linha = atividade padrão + preço rastreável + humano aprova ("somos juízes"). **Fora do MVP da refatoração** — pluga perto do E5/marketplace. v1: IA monta estrutura+descritivo, **humano confirma qtd** (fiel ao contraponto honesto do dono: qtd vem da planta, não do memorial).

### PLANO DE IMPLANTAÇÃO (passos aditivos sobre E0/E2 deployados, faseado, sem quebrar)

Migração única `supabase/migrations/2026XXXX_e0b_taxonomia_ambiente_segmento.sql` (marcador "⚠ NÃO aplicar — janela do dono"; timestamp > E2/E3, < E5). **Ordem intra-arquivo:** cria `hub_obra_taxonomia` ANTES do `ALTER hub_obra_itens ADD taxonomia_id` (a FK exige a tabela existir).

**R0 — Fundação (a taxonomia; faz PRIMEIRO; maior alavancagem, menor risco):**
1. Migração: CREATE `hub_obra_taxonomia` + RLS + índices GIN; ALTERs aditivos (hub_obras.segmento, hub_obra_itens.ambiente/taxonomia_id, frentes_eap.tipo_no DEFAULT 'frente', presets.segmento); índice ambiente-first; RPC `classificar_memorial_em_taxonomia` (SECURITY DEFINER, sem anon); seed ~60 atividades nas 5 disciplinas-núcleo (Civil/Elétrica/Hidráulica/Revestimentos/Pintura, começando pela elétrica completa do dono). Seed volumoso (full) em script separado, não na migração.
2. `lib/obras/taxonomia.ts` (NOVO, espelha `eap-presets.ts`): tipo `TaxonomiaAtividade`, `SEGMENTOS` (5) + `AMBIENTES_POR_SEGMENTO`, `TAXONOMIA_FALLBACK` in-code (UI funciona sem migração).
Gate: tsc + vitest + build.

**R1 — Presets por segmento + ambiente na montagem:**
3. `lib/obras/eap-presets.ts`: adicionar `SEGMENTOS_PADRAO` + presets com `ambientes`/`atividades_default` (NÃO mexer no existente). Seed espelho na migração.
4. `lib/obras/criar-obra-com-eap.ts` (JÁ existe, 213 linhas): quando preset tem `ambientes`, gravar `ambiente` nos itens (e nó-árvore opcional). Caminho flat atual (Reforma Padrão) intocado.

**R2 — UI ambiente-first:**
5. Aba Itens (E2): `AgruparPor = 'disciplina'|'andar'|'ambiente'` (2→3); default 'ambiente' só se houver `ambiente` nos itens, senão cai em disciplina (= comportamento atual). `+ Atividade` usa EntitySelect filtrado pela taxonomia (traz descritivo+unidade+qtd).
6. Wizard `NovaObraSideover`: passo Segmento (chips) + preview por ambientes marcáveis.
7. Ficha: bloco "Descritivo padrão" + stepper qtd.

**R3 (FORA do MVP, pluga depois, perto do E5):** Orçamento IA (memorial→planilha): endpoint `/api/crm/obras/[id]/classificar-memorial` + `ClassificarMemorialSideover` + 2 tools no copiloto (`hub_obra_classificar_memorial` escrita→gate; `hub_obra_taxonomia_sugerir` leitura). Só acende com `MISTRAL_API_KEY`; sem chave, botão "Importar memorial" mostra "IA em breve" (nunca esconde).

**Nada bloqueia o que está no ar:** sem aplicar a migração, a UI cai no fallback in-code (taxonomia/segmento dormem, EAP segue disciplina-first). Gate por onda: tsc + vitest + build + _chk23.

### Reuso × novo · Edge cases

**Reusa (zero reconstrução):** `hub_obra_frentes_eap` (parent_id/area_label já existem — só +1 coluna `tipo_no`) · `hub_obra_itens` (só +3 colunas nullable) · `hub_catalogo` (intocado) · `hub_eap_presets` (só +segmento) · `eap-presets.ts`/`criar-obra-com-eap.ts` (só adicionar) · toggle Disciplina↔Andar do E2 (só +eixo) · `vw_hub_obra_itens_situacao` (intocada) · `EntitySelect`/`CrmToggleSwitch`/sideover · RLS `current_user_tenant_id()` · MarkItDown · `hub_ia_consumo` (metering) · CopilotoVoz+gate dourado.
**Novo (mínimo):** 1 tabela (`hub_obra_taxonomia`) + 4 colunas + 5 presets + `lib/obras/taxonomia.ts` + eixo "Ambiente" no toggle + (R3) endpoint/sideover/2 tools.

**Edge cases:**
- **Ambiente custom** ("Sala de Jogos"): `hub_obra_itens.ambiente` é texto livre, sem CHECK → chips do segmento + "+ Outro ambiente". Nunca trava.
- **Atividade fora da taxonomia**: IA retorna `codigo='CUSTOM'` (conf<0.70) ou usuário escolhe "Outra (digitar)" → item com `taxonomia_id=NULL`, selo amarelo "fora do padrão" (não-bloqueante) + CTA "promover à taxonomia do tenant" (vira linha `origem='tenant'`).
- **Obra multi-andar** (Banheiro A8 × A9): ambiente + `area_codigo` coexistem (ortogonais); UI agrupa por `(ambiente, area_codigo)` quando andar preenchido, tag de andar no card. Não força ambiente-first — toggle resolve (a planilha real do Consulado segue disciplina×andar).
- **Segmento misto** (PDV térreo + Corporativo): `segmento` da obra = predominante (p/ relatório); ambiente é texto livre, então o usuário puxa ambientes de qualquer segmento no editor. v2: `segmento TEXT[]` (aditivo).
- **Qtd ausente** ("conforme projeto"): IA retorna `qtd=null`; stepper dourado pulsante; botão Confirmar bloqueado se `qtd=null` e `unidade≠'vb'`. Validação no endpoint, não bloqueio silencioso.
- **Migração não aplicada / parcial**: endpoints checam coluna via `isMissingPgColumn` (padrão do projeto); toggle Ambiente oculto, cai em disciplina; itens `ambiente=NULL` agrupam por disciplina. Nunca 500.
- **Mistral indisponível**: endpoint 503 → UI oferece "Opção 2: template do segmento" (100% local, 0% IA). Nunca tela morta.
- **Duplicidade** (mesmo `codigo`+ambiente de 2 chunks): RPC agrega qtd; ambientes diferentes = linhas separadas; `UNIQUE(obra_id,codigo)` protege o resto.

**Confiança:** ALTA no modelo e no faseamento (li E0/E2 deployados + insumo + os 4 desenhos; aditivo puro, fallback gracioso, nenhuma obra existente afetada). **3 flags de negócio para o dono validar antes de R1/seed final:** (a) lista de ambientes-padrão por segmento (5-8 cada); (b) taxonomia-núcleo das 5 disciplinas (confirmar a elétrica dele + completar as outras 4); (c) `qtd_padrao` no preset — NULL (humano sempre confirma, recomendado p/ v1) ou pré-preenchido. Nada-se-perde respeitado; tudo reversível.

Arquivos-âncora: `lib/obras/eap-presets.ts`, `lib/obras/criar-obra-com-eap.ts`, `components/crm/obras/NovaObraSideover.tsx`, aba Itens em `app/crm/obras/[id]`, `docs/E0-DESIGN.md`, `docs/E2-DESIGN.md`. A criar: `supabase/migrations/2026XXXX_e0b_taxonomia_ambiente_segmento.sql`, `lib/obras/taxonomia.ts`.