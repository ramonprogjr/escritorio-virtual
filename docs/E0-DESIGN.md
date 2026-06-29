# E0 (espinha Obra+EAP+Catalogo) — Design + Auditoria (mesa redonda)

Confirmei o código real. Pontos auditados: o gerador atual usa `count` GLOBAL sem `.eq("tenant_id")` (linha 44) — o product-owner está certo, é um bug real de vazamento entre tenants. A página é o input morto. Auth via `tenantIdFromRequest` (divergente de `/projetos` que usa `getCallerContext`). Tenho o que preciso. Produzo o design final.

---

# E0 — A ESPINHA (Obra + EAP + Catálogo) · Design final + Auditoria

> CEO/tech-lead consolidando as 4 lentes. Tudo aditivo, fiel à planilha do Consulado, reusando a coluna ao máximo. **Nada foi editado** — isto é o blueprint que você lê de manhã e eu executo.

## Design final de E0 (tudo pensado)

### Princípio que rege E0 (o "porquê")
A planilha real tem **dois níveis**: `Gestao` (164 itens de contrato por andar) e `Detalhamento` (subitens/EAP por disciplina×andar). **E0 entrega só o nível-1 da espinha: as FRENTES por disciplina.** O cruzamento ×andar e os itens de contrato são E2 — não obrigatórios para a obra "nascer". Isso protege os ≤3 toques e não engessa. Tudo mais (itens, situação×andamento, bloqueios, compras) pendura nesta espinha depois.

### Modelo de dados (campos exatos, aditivo)

**Decisão de nomenclatura (CEO):** o PLANO-BLOCOS diz `fronts_eap`; as lentes propuseram `hub_obra_frentes_eap`. **Adoto `hub_obra_frentes_eap`** — o prefixo `hub_` é o padrão de TODAS as tabelas do projeto (consistência vale mais que o nome curto do plano). Registro a divergência no DECISIONS.

Arquivo: `supabase/migrations/20260705130000_e0_obra_eap_catalogo.sql` (ajustar timestamp ao último real no momento da execução).

**(1) ALTER `hub_obras` — aditivo:**
```
tipo_obra      TEXT NOT NULL DEFAULT 'reforma'
               CHECK (tipo_obra IN ('construcao','reforma','servico',
                      'manutencao','consultoria','projeto','assistencia'))
codigo_legivel TEXT                 -- CON.2026.0001 / REF.2026.0004 (gerado por tenant)
cliente_pessoa_id  UUID             -- soft FK (sem hard, aditivo seguro)
cliente_empresa_id UUID
area_total_m2  NUMERIC(10,2)
valor_contrato NUMERIC(14,2)
pipeline_id    UUID REFERENCES hub_pipelines(id) ON DELETE SET NULL
estagio_slug   TEXT DEFAULT 'planejamento'
```
Relaxar status (mesmo padrão da migração 20260620180000 que já fez DROP+ADD em hub_negocios):
```
-- ANTES de dropar: migrar valor legado
UPDATE hub_obras SET status='ativa' WHERE status='em_andamento';
ALTER TABLE hub_obras DROP CONSTRAINT IF EXISTS hub_obras_status_check;
ALTER TABLE hub_obras ADD CONSTRAINT hub_obras_status_check
  CHECK (status IN ('planejamento','mobilizacao','ativa','atencao',
                    'critica','pausada','encerrada','cancelada'));
CREATE UNIQUE INDEX IF NOT EXISTS hub_obras_codigo_tenant_unique
  ON hub_obras (tenant_id, codigo_legivel) WHERE codigo_legivel IS NOT NULL;
```
> **Auditoria-fix incorporada:** o `UPDATE em_andamento→ativa` ANTES do DROP é obrigatório — sem ele a migração quebra em qualquer base com obras já criadas pelo input atual. A AI-lens e a backend-lens divergiam aqui; **a backend-lens está certa**, fica o UPDATE.

**(2) `hub_obra_frentes_eap` (NOVA):**
```
id                UUID PK
obra_id           UUID NOT NULL REFERENCES hub_obras(id) ON DELETE CASCADE
tenant_id         UUID NOT NULL REFERENCES hub_tenants(id) ON DELETE CASCADE
parent_id         UUID REFERENCES hub_obra_frentes_eap(id) ON DELETE CASCADE  -- árvore (E2 usa ×andar)
codigo            TEXT NOT NULL          -- "CIVIL", "ELET" (frente-mãe) — único por obra
nome              TEXT NOT NULL          -- "Elétrica" (renomeável; código imutável)
disciplina_slug   TEXT                   -- liga ao catálogo (desnormalizado p/ query rápida)
area_label        TEXT                   -- "Andar 8" (NULL no nascimento; E2 preenche)
cor               TEXT                   -- acento por disciplina (do catálogo)
peso_fisico       NUMERIC(5,2) DEFAULT 0  -- opcional em E0; trava 100% só em E4
peso_financeiro   NUMERIC(5,2) DEFAULT 0
ativo             BOOLEAN NOT NULL DEFAULT true   -- toggle = oculta, NÃO deleta
ordem             INTEGER NOT NULL DEFAULT 0
origem            TEXT DEFAULT 'preset' CHECK (origem IN ('preset','manual','ia','aditivo'))
criado_em / atualizado_em  TIMESTAMPTZ
```
Índice: `UNIQUE (obra_id, codigo)`; `(obra_id, ativo, ordem)`. RLS: `current_user_tenant_id()` (copiar verbatim de hub_obras).

> **Decisão CEO:** `situacao` e `andamento` NÃO entram em E0. As lentes os colocaram aqui; eu **movo para E2**, onde nascem os itens de contrato (é lá que situação×andamento da planilha vive). Frente nível-1 não tem prazo no nascimento — pôr campos de status agora seria modelar vazio. Mantém E0 enxuto.

**(3) `hub_catalogo` (NOVA)** — master de dropdowns, `tenant_id NULL = global`:
```
id, tenant_id (NULL=global), categoria CHECK('disciplina','material','servico',
  'equipamento','mao_de_obra','area_andar'), codigo, descricao, unidade, grupo,
  disciplina_slug, ativo, ordem, criado_em
UNIQUE (COALESCE(tenant_id,'00..0'), codigo)
RLS read: tenant_id IS NULL OR = current_user_tenant_id()
RLS write: = current_user_tenant_id()   -- ninguém edita o global pelo app
```
Seed global: as **15 disciplinas reais** da planilha (Preliminares, Civil, Demolições, Revestimento, Pintura, Elétrica, Hidráulica, Instalações, Esquadrias, Serralheria, Forro, Climatização, Impermeabilização, Elevadores, Limpeza) + ~20 `area_andar` (Andar 8/9, Roof Top, Halls, Subsolo, Elevadores).

**(4) `hub_eap_presets` (NOVA)** — espelho de `hub_pipelines` (template global editável por tenant):
```
id, tenant_id (NULL=global), tipo_obra, slug, nome, sistema BOOL, ordem,
frentes_json JSONB,  -- [{disciplina_slug, nome, peso_fisico, peso_financeiro}]
criado_em
```
Seed: 3 presets globais (Reforma Padrão = **idêntico à planilha do Consulado**, Construção Residencial, Serviço Pontual). RLS igual ao catálogo.

**(5) `hub_pipelines.tipo` — ALTER CHECK aditivo:** `+ 'obra','projeto'` (mesmo DROP+ADD de 20260620180000). Seed do pipeline-obra global (estágios = os 8 status). *Auditoria: ver risco P2 abaixo — pipeline_id é "nice-to-have" em E0, não bloqueia.*

**(6) `lib/obras/eap-presets.ts` (NOVO, espelha `lib/crm/pipeline-defaults.ts`):** `DISCIPLINAS_PADRAO` (15) + `EAP_PRESETS` (3) + `getPresetPorTipo()` + `gerarCodigoObra()` + **`EAP_PRESETS_FALLBACK`** (quando a migração não foi aplicada — padrão `ESTAGIOS_FALLBACK_UI`).

### Tela 'Nova obra' Click-and-Go (passo a passo + ASCII)

Sideover (clone de `CadastroWizard` / `CadastroPremiumSideover`), modo passo-a-passo, **≤3 toques**: cliente(1) + tipo(1) + criar(1). O preset já entrega a EAP — o passo 3 é revisar, não preencher.

```
┌─ Nova obra ───────────── [Engenharia] ── ✕ ─┐
│ ●━━━━○────○   passo 1 de 3                   │
│ De quem é a obra?                            │
│ [ 🔍 Buscar cliente · nome/CPF/CNPJ … ]      │  ← EntitySelect (reuso direto)
│ Recentes:                                    │
│  👤 Carlos Mendes        PES-2026-014   →    │  ← toque = seleciona e avança
│  🏢 Consulado Itália     EMP-2026-003   →    │
│ + Cadastrar novo cliente                     │  ← abre CadastroWizard por cima, volta selecionado
│ ‹ sem cliente / obra interna ›               │  ← não trava
│                              [ Continuar → ] │
├──────────────────────────────────────────────┤
│ ●━━━━●━━━━○   passo 2 de 3                    │
│ Que tipo de obra?                            │
│ [🏗️ Construção] [🔨 Reforma•] [🛠️ Serviço]    │  ← chips grandes (clone seletor PF/PJ); ‹outros tipos ⌄›
│ Endereço (opcional)  [⌄ Mesmo do cliente]    │  ← colapsado; pré-preenche do cliente
│                  [← Voltar]  [ Continuar → ] │
├──────────────────────────────────────────────┤
│ ●━━━━●━━━━●   passo 3 de 3                    │
│ Reforma · Consulado Itália                   │
│ Código: REF-2026-0007 (automático)           │  ← read-only, mono, dourado
│ A IA já montou a EAP (preset Reforma):       │
│  ☑ Preliminares  ☑ Demolições  ☑ Civil       │  ← chips marcáveis; desmarcar o que não tem
│  ☑ Revestimento  ☑ Pintura     ☑ Elétrica    │
│  ☑ Hidráulica    ☑ Forro       ☑ Limpeza     │
│  + Adicionar frente   ·   Editar tudo (EAP)↗ │  ← "Editar tudo" abre o editor completo
│                  [← Voltar]  [ Criar obra ✓ ]│  ← verde #238636
└──────────────────────────────────────────────┘
```
- **Gatilhos:** FAB "+ Nova obra" na carteira **ou** "Gerar obra" do negócio (`?negocio_id=`). Vindo do negócio → cliente herdado, passo 1 pulado → vira 2 toques.
- **Pós-criar:** toast verde "Obra REF-2026-0007 criada · 9 frentes" → navega à ficha.
- **Carteira (Tela C):** substitui o input morto atual por cards on-brand + chips de filtro (Todas/Construção/Reforma/Serviço) + FAB. Card de obra sem EAP ganha selo `⚠ montar EAP`.

### Editor de EAP
Clone quase 1:1 de `PipelineConfigSideover` (linha com barra-de-cor + `CrmToggleSwitch` + "Adicionar estágio"→"Adicionar frente"). Aberto por "Editar tudo (EAP)" ou pela ficha da obra.
```
┌─ Frentes da obra ───────── [EAP] ── ✕ ─┐
│ Reforma · Consulado Itália             │
│ Desative frentes p/ ocultá-las.        │
│ Itens já lançados permanecem.          │
│ ▍↑↓ Preliminares    civil_prelim ◉━    │  ← reorder por SETAS (drag depois — ver auditoria)
│ ▍↑↓ Demolições                  ◉━    │
│ ▍↑↓ Pintura (inativa esmaecida) ━○    │
│ ┌ Nova frente ─────────────────────┐   │
│ │ Disciplina [chips do Catálogo ▾] │   │  ← Click-and-Go (não digita)
│ │ Nome (auto) "Elétrica"           │   │
│ │        [ + Adicionar frente ]    │   │
│ └──────────────────────────────────┘   │
│ ⚙ Avançado (peso físico/financeiro) ⌄  │  ← COLAPSADO (não assusta o leigo)
└────────────────────────────────────────┘
```
Toggle = ativar/ocultar (semântica idêntica ao pipeline). Renomear = label inline, código imutável. Peso = colapsado (entra de fato em E4). Frente nova entra **ativa, no fim da ordem**, sem mexer nas existentes (= "adicionar estágio").

### Camada conversacional/IA
Reusa `CopilotoVoz` + `/api/copiloto` (HMAC/gate) **sem modificar o pipeline**. Adições cirúrgicas:
- `obraIdDaRota(pathname)` em `CopilotoVoz.tsx` + `obraId?` em `CopilotoContexto` (aditivo).
- 4 tools novas no registry/switch: `hub_obra_criar` (escrita→gate), `hub_obra_eap_montar` (escrita→gate), `hub_obra_resumo` (leitura), `hub_obra_listar` (leitura). Allowlist escrita += as duas.
- `FERRAMENTAS_OBRA_DOC` injetado em `construirPromptCopiloto` só quando rota contém `/obras`|`/engenharia`.
- Fluxo: *"cria obra de reforma do Consulado, preset padrão"* → card dourado "A IA entendeu assim: Reforma · Consulado · 9 frentes [ver]" → **Confirmar** (1 toque). A IA **nunca** cria sozinha (gate é lei). Sem cliente → pergunta UMA coisa, não inventa.
- **Acende com Mistral.** Sem chave: telas manuais 100% funcionais; voz degrada para "IA indisponível" (nunca quebra).

### Edge cases tratados
| Caso | Tratamento |
|---|---|
| Sem preset (tipo "outros") | EAP vazia + CTA dourado "Adicionar frente"; nunca cadastro morto |
| Obra sem EAP ainda | Card com selo `⚠ montar EAP`; ficha abre no editor com EmptyState |
| Aditivo de frente (obra andando) | "Nova frente" sempre disponível; entra ativa no fim, `origem='aditivo'` |
| Frente repetida (Civil A8 + Civil A9) | **Permitir** (é a planilha real); unicidade por `(obra_id, codigo)`, não por disciplina; avisa só se nome 100% idêntico (amarelo, não-bloqueante) |
| Migração não aplicada | Fallback gracioso (padrão `ESTAGIOS_FALLBACK_UI`): cria obra só com código+tipo+cliente, aviso "personalização de frentes ainda não ativa". Nunca tela quebrada |
| Código race/duplicado | Sequência **por tenant+tipo+ano** + UNIQUE index como guard + retry. Nunca dois REF-2026-0004 |
| Voz sem Mistral | FAB visível, responde "recurso por voz em breve"; toque nunca depende da voz |
| Mobile/teclado no combobox | sideover full-screen (100vw já no código); `safe-area-inset-bottom`; rodapé sticky não cobre campo |
| Muitas frentes | lista rolável agrupada por disciplina (laranja = item principal, como a planilha) |
| Double-tap criar | idempotência: mesma `titulo+tenant` em <60s retorna a obra existente, não duplica |

### O que reusa da coluna × o que é novo
**Reusa (sem reconstruir):** casca do sideover + WizardSection + seletor de tipo (`CadastroWizard`/`CadastroPremiumSideover`) · editor EAP ≈1:1 (`PipelineConfigSideover` + `CrmToggleSwitch`) · seletor cliente/disciplina (`EntitySelect`) · `EmptyState` · tokens da marca · `CopilotoVoz`+`/api/copiloto`+gate dourado · pipeline-infra (`hub_pipelines`/`_estagios`) · padrão de código sequencial (`gerar_codigo_pessoa`) · RLS `current_user_tenant_id()` · `requireCrm*`/`createCrmSupabaseClient`.
**Novo (mínimo):** 3 tabelas (`hub_obra_frentes_eap`, `hub_catalogo`, `hub_eap_presets`) + ALTERs · `lib/obras/eap-presets.ts` · `/api/obras` (reescrito) + `/api/obras/[id]/eap` + `/api/catalogo` · 4 tools de IA · reescrita de `app/crm/obras/page.tsx` (carteira) + `NovaObraSideover`. **Única peça de UI verdadeiramente nova: reorder de frentes** (o pipeline só toggla).

---

## AUDITORIA das decisões (riscos, conflitos, o que validar)

**P0 — Bug real confirmado no código atual (corrigir em E0):** `app/api/crm/obras/route.ts` linha 44 faz `count` **GLOBAL sem `.eq("tenant_id")`** → o número do código pula entre tenants e **vaza contagem entre empresas** (multi-tenant!). A reescrita do POST resolve com `gerar_codigo_obra(tenant_id, tipo)`. Isto sozinho já justifica E0 mexer no route.

**P0 — Migração de status legado:** há obras com `status='em_andamento'` (CHECK atual). O `UPDATE → 'ativa'` ANTES do `DROP CONSTRAINT` é obrigatório, senão a migração falha. Incorporado.

**P1 — Divergência de auth (não inventada por mim, já mapeada na memória obs 9242):** `/obras` usa `tenantIdFromRequest`; `/projetos` usa `getCallerContext`. As lentes assumiram `requireCrmUser`. **Decisão:** E0 unifica `/api/obras/*` no padrão mais seguro (`getCallerContext`/`requireCrm*`) — não manter o header-based frouxo numa tabela que vai distribuir leads multi-tenant. Validar que o front injeta a sessão certa (hoje usa `internalApiHeaders()`).

**P1 — Conflito de escopo entre lentes (situação×andamento):** backend e ai-engineer puseram `situacao`/`andamento` em `hub_obra_frentes_eap`. **Resolvi por E2** (é onde os itens de contrato/Detalhamento vivem na planilha). Risco se não respeitar: modelar status de prazo num nível que não tem prazo → confusão e campos vazios. Validar com o dono se ele quer "andamento" já na frente-mãe (aposto que não — ele rastreia no subitem).

**P2 — `pipeline_id`/pipeline-obra:** útil para E1 colorir cards por estágio, mas **não bloqueia E0**. Mantenho o ALTER do CHECK (barato) e o seed, mas o app pode ignorar `pipeline_id` até E1. Não atrasar a espinha por isto.

**P2 — Pesos no preset:** as 3 lentes deram pesos diferentes (somam ~100 mas valores divergem). Em E0 peso é **cosmético/opcional** (trava só em E4). **Não validar pesos agora** — seed com os do backend-lens (mais completos) e refinar em E4 com o dono.

**Conflitos com a planilha real? Nenhum estrutural.** A planilha tem 2 níveis (Gestao/Detalhamento) e E0 entrega o nível-1 (frentes por disciplina) — fiel. As 15 disciplinas batem 1:1. **A validação viva é o preset Reforma = obra do Consulado** — confirmar com o dono que a lista de 14-15 frentes do preset reproduz a planilha dele (é a única aposta de fidelidade que precisa de olho humano).

**O que validar com o dono:** (a) preset Reforma == planilha do Consulado? (b) "andamento" fica no subitem (E2) e não na frente — ok? (c) prefixos de código CON/REF/SRV ok (spec usa `CON.2026.0001` com pontos; código atual usa `OBR-2026-0001` com hífens — **decidir separador**; mantenho hífen p/ não quebrar obras já criadas, mas a spec pede ponto).

## Critério de PRONTO de E0
1. Criar obra em ≤3 toques (cliente→tipo→criar), código auto **por tenant**, sem digitar UUID.
2. Obra nasce com EAP do preset (ex.: Reforma → 14 frentes), todas ativas.
3. Editor de EAP: ativar/ocultar/renomear/reordenar/+frente funcionando, reusando o sideover.
4. Catálogo dirige os dropdowns (disciplina vem da lista, não digitação livre).
5. Carteira substitui o input morto; obra sem EAP mostra CTA, não erro.
6. Fallback gracioso quando a migração não está aplicada (não quebra).
7. (Com Mistral) "cria obra de reforma do X, preset padrão" → gate dourado → Confirmar.
8. Gates verdes: `tsc` + `vitest` + `build` + `_chk23`.

## O que precisa da janela do dono (migração) vs o que já funciona
**Precisa da janela (migração aditiva — trava do projeto):** criar `hub_obra_frentes_eap`, `hub_catalogo`, `hub_eap_presets`; ALTER `hub_obras` (tipo_obra, codigo_legivel, status relaxado, +`UPDATE em_andamento→ativa`); ALTER `hub_pipelines.tipo`; seeds (15 disciplinas, 3 presets); RPC `gerar_codigo_obra`. **Tudo aditivo, reversível, padrão já usado** — mas aplicar é decisão do dono (janela).
**Já funciona sem a janela (posso codar agora, com fallback):** `NovaObraSideover` + carteira nova + `lib/obras/eap-presets.ts` (fallback in-code) + as 4 tools de IA registradas (dormentes sem Mistral) + correção do P0 do código (sequência por tenant pode usar `count` filtrado por `.eq("tenant_id")` mesmo antes da RPC). A UI degrada graciosamente: cria obra com tipo+cliente+código e mostra "frentes ainda não ativas" até a migração rodar.
**Acende com a chave Mistral (futuro, não bloqueia):** o fluxo conversacional pleno voz→intent→confirm→execute.

**Arquivos-âncora (caminhos absolutos):**
- `c:\Users\wende\Documents\escritorio-virtual-ramon\app\api\crm\obras\route.ts` (P0: count global linha 44 → reescrever)
- `c:\Users\wende\Documents\escritorio-virtual-ramon\app\crm\obras\page.tsx` (input morto → carteira)
- `c:\Users\wende\Documents\escritorio-virtual-ramon\components\crm\leads\PipelineConfigSideover.tsx` (molde do editor EAP)
- `c:\Users\wende\Documents\escritorio-virtual-ramon\components\crm\cadastro\CadastroWizard.tsx` (molde do NovaObraSideover)
- `c:\Users\wende\Documents\escritorio-virtual-ramon\lib\crm\pipeline-defaults.ts` (molde de `lib/obras/eap-presets.ts`)
- A criar: `supabase/migrations/20260705130000_e0_obra_eap_catalogo.sql`, `lib/obras/eap-presets.ts`, `app/api/obras/route.ts`, `app/api/obras/[id]/eap/route.ts`, `app/api/catalogo/route.ts`, `components/crm/obras/NovaObraSideover.tsx`.