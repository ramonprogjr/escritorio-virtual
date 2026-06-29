# E3 (restricoes/bloqueios) — Design + Auditoria (mesa redonda)

I have all the load-bearing facts verified against real code: the §13 taxonomy (Restrição≠Pendência≠Ocorrência≠Risco), §19 SST blocking power, the real allowlists (no GATE_REFORÇADO constant exists yet — it's a pattern to add), `hub_pedidos_material` exists (migration 20260523120000), and the E2 boolean names. The E3-DESIGN.md was written by the backend-architect lens. Now I produce the synthesized CEO/tech-lead final design + audit.

## Design final de E3

E3 = RESTRIÇÕES/BLOQUEIOS: contar e **resolver** o que trava a obra (os 5 faltas da planilha), fiel a §13 do dono, reusando o chão de E1/E2/copiloto. As 4 lentes convergiram. Ratifico e corrijo abaixo.

### DECISÃO: tabela de restrição 1ª classe × view sobre booleans de E2 (justificada)

**Veredito: HÍBRIDO — tabela `hub_obra_restricoes` de 1ª classe + VIEW de união. Os 5 booleans `falta_*` de E2 continuam a ÚNICA verdade do "tem bloqueio agora?".**

As 4 lentes convergiram nisto; ratifico com a evidência do código real:

- **Por que não só view sobre os booleans:** uma view CONTA, mas não guarda QUEM resolve, PRAZO, IMPACTO em dias, HISTÓRICO (aberta→em_resolução→resolvida→reaberta), nem o elo para o pedido SC (E5). O dono pediu **resolver**, não só ver.
- **Por que não tabela 100% paralela com seus próprios `falta_*`:** duplicaria E2 e criaria **duas verdades** (card de E2 diz "falta material", restrição diz "resolvido" → divergência). Proibido: 1 dado, 1 dono.
- **Híbrido evita ambos:** o boolean de E2 = "está bloqueado agora?" (estado presente, editável no item). O registro E3 = o **dossiê de resolução** pendurado num `falta_*` (quem/prazo/impacto/histórico/ação). Eles se sincronizam **na resolução** (E3 limpa o boolean de E2), não por duplicação.

**Regra de não-colisão (a mesma de E2 Situação×Andamento):** o boolean nasce em E2 e é a fonte. E3 lê, **promove** (cria o dossiê) e **limpa** (na resolução). A contagem grossa do Dashboard segue lendo os 5 booleans; a contagem fina **por caso** (responsável/prazo/impacto) vem de `hub_obra_restricoes`.

**Correção sobre as lentes (importante):** as 4 lentes divergiram no mecanismo de sincronização E2→E3:
- backend-architect (lente 1) e ai-engineer (lente 4): sync **no endpoint** (PATCH do toggle chama a RPC `promover`; PATCH de resolução limpa o boolean). **Escolho esta.**
- product-owner (lente 3): propôs **trigger de banco bidirecional**. **Rejeito para E3-v1** — pela mesma razão que rejeitamos trigger em E2: trigger bidirecional cria risco de laço, dispara em import batch e é frágil de testar. Sync explícito no endpoint = seguro, reversível, auditável.

### Modelo de dados (aditivo, sem duplicar E2, alimenta E1)

A migração já está escrita em `docs/E3-DESIGN.md §2` (linhas 100-316). Ratifico o schema com **3 emendas de produto** abaixo. Tabela `hub_obra_restricoes`:

- **Contexto:** `obra_id` + `tenant_id` (ambos NOT NULL, FK).
- **Origem flexível:** `item_id` (FK E2, nullable) **OU** `frente_id` (FK E0, nullable) **OU** ambos NULL (bloqueio da obra inteira). Cobre os 3 níveis sem forçar item.
- **Tipo:** CHECK `('material','pessoa','documento','ferramenta','equipamento','outro')` — **1:1 com os 5 booleans de E2** (cols J–N da planilha) + escape `outro`.
- **Ciclo de vida:** `status` CHECK `('aberta','em_resolucao','resolvida','reaberta')`.
- **Resolução:** `responsavel_id/nome`, `prazo_resolucao DATE`, `impacto_dias INTEGER`, `impacto_frente_id` (cross-frente), `acao_sugerida` (tipada), `pedido_material_id` (FK E5), `resolvido_*`, `origem`.
- **RLS:** `tenant_id = current_user_tenant_id()` (padrão das ~36 tabelas); índice **parcial** `WHERE status NOT IN ('resolvida')` (caminho quente do cockpit).

**EMENDA 1 (minha, fidelidade a §13) — separar Restrição de Pendência no próprio status.** A §13 do dono distingue Restrição (impedimento físico) de Pendência (decisão em aberto). Adicionar ao CHECK: `status IN (...,'virou_pendencia')` + coluna `pendencia_id UUID` (soft FK). Quando um "falta material" na verdade é "esperando decisão do cliente", o gestor reclassifica → o boolean de E2 **apaga** (não é mais falta de insumo) e nasce uma pendência. Sem dado fantasma. (Pendência é módulo futuro; o campo já fica pronto.)

**EMENDA 2 (minha, fidelidade a §19 SST) — bloqueio de documento com poder de SST é readonly-resolver.** `tipo='documento'` cuja origem é SST (ASO/ART/NR vencida, §19) **não pode ser resolvido por voz nem em 1 toque** — só por regularização auditada. Marca `acao_sugerida='solicitar_documento'` e o botão [Resolver] fica desabilitado com tooltip "regularização auditada (SST)". Fiel à regra do dono: doc vencido = bloqueio real de acesso/execução até regularização formal.

**EMENDA 3 (minha) — `impacto` categórico além de `impacto_dias`.** Adicionar `impacto TEXT CHECK ('trava','atrasa','observa')`. `impacto_dias` é a estimativa numérica; `impacto` é o selo visual (trava agora = vermelho sólido; atrasa = âmbar; observa = só registra). Permite o cockpit ordenar e colorir sem depender de o usuário ter estimado dias.

**VIEW `vw_hub_obra_bloqueios_hoje`** (`security_invoker=true`) — UNION ALL de (A) restrições E3 abertas/em_resolução + (B) booleans de E2 **sem** E3 aberto (cláusula `NOT EXISTS` por item+tipo). `fonte='e3'|'e2_boolean'`. **Nunca duplica:** E2 só entra quando E3 não cobre — garante que um `falta_*` legado (ligado antes de E3 existir) nunca se perca no cockpit. Alimenta E1 §3 trocando o proxy de `hub_obras_ocorrencias severidade='critico'` pelo dado fino, **na mesma moldura de componente**, degradando via `isMissingPgColumn` se a view não existir.

**RPC `hub_obra_restricao_promover`** (SECURITY DEFINER, idempotente SELECT-first): chamada pelo backend do PATCH de E2 quando `falta_X=true`. Se já existe E3 aberto para item+tipo → no-op. Seguro em double-submit/race.

### Telas (item + cockpit/Hoje) + ASCII · resolver em 1 toque

Três superfícies, todas reúso — zero tela nova pesada.

**[A] No item (ficha E2, sem alterar o design E2):** a linha "Bloqueios [👤ok][📄ok][📦Falta material!][🔧ok][🚜ok]" que E2 já tem vira **acionável**. Ligar o toggle → backend chama `promover` → cria o dossiê E3. Tocar o ⛔ → mini-card da restrição.

```
┌ Bloqueios deste item ───────────────────────────────┐
│ 📦 MATERIAL · falta cimento CP-II      ⛔ TRAVA      │
│    resp: João · prazo 02/jul · há 2 dias            │
│    [📦 Gerar pedido] [✓ Resolver] [→ Pendência]     │
│ 👤 ok   📄 ok   🔧 ok   🚜 ok        [+ registrar]   │
└──────────────────────────────────────────────────────┘
```
Múltiplos no mesmo item: cluster `⛔ 📦📄 +1` (não empilha 5 chips e quebra o mobile).

**[B] Cockpit Hoje (E1 §3 BLOQUEIOS — troca o proxy pelo dado fino, MESMA UI):** cada restrição = 1 FATO (ícone+tipo+item+obra) + 1 IMPACTO (trava/atrasa/observa · +Nd · quem) + ação TIPADA por categoria. Ordenado `trava>atrasa>observa`, depois `impacto_dias DESC`.

```
┌── ⛔ BLOQUEIOS · 4 · travam +7d ────────────────────────────┐
│┃ 📦 Falta material · Spot embutir A8 · Itália              │
│┃    trava · +2d · sem responsável                          │
│┃    [Gerar pedido ▸] [Atribuir] [Resolver ✓]               │ ← 1 toque
│├────────────────────────────────────────────────────────────┤
│┃ 👤 Falta pessoa · Alvenaria A9 · Itália                   │
│┃    atrasa · +3d · Resp: João (avisado há 1d)              │
│┃    [Cobrar João] [Resolver ✓]                             │
│├────────────────────────────────────────────────────────────┤
│┃ 📄 ART vencida · Frente Elétrica · Casa Pinheiros         │
│┃    trava (SST) · resolução só por regularização auditada  │ ← Emenda 2
│└────────────────────────────────────────────────────────────┘
│ ✨ "4 bloqueios travam 7 dias. 2 viram pedido. [Resolver em lote ▸]"│
└──────────────────────────────────────────────────────────────┘
Vazia → "✓ Nenhum bloqueio — obra fluindo" (anti-tela-morta).
```

**[C] Resolver em 1 toque (bottom-sheet mobile / drawer 440px):** o caminho já vem sugerido (Click-and-Go). `📦→[Gerar pedido]` (rascunho SC, gate dourado), `👤→[Cobrar/Atribuir]`, `📄→[Anexar doc]`, mais `[Já chegou — resolvido ✓]` (desliga o boolean), `[→ Pendência]`. O badge `+Nd` é clicável → "término 28/06 → 30/06 se não resolver" (explica o efeito, **nunca reprograma sozinho**).

### Conversacional/IA

Reusa **integralmente** o `CopilotoVoz` (FAB + card dourado `acaoPendente`) e o `copiloto-core` (HMAC, allowlists, `escritaSemLead`, gate). 4 tools novas, no molde exato de `hub_obra_criar`/`hub_obra_eap_montar` já registradas:

- `hub_obra_restricao_listar` (LEITURA, auto-exec) · `hub_obra_restricao_resumo` (LEITURA, auto-exec)
- `hub_obra_restricao_criar` (ESCRITA, gate sempre) · `hub_obra_restricao_resolver` (ESCRITA, **gate reforçado**)

Registrar nos 4 pontos reais do código: `HubAgenteFerramentaId` (union, `agente-ferramentas-registry.ts`), `HUB_FERRAMENTA_ACESSO`, `COPILOTO_FERRAMENTAS_ESCRITA_FASE3` e `COPILOTO_FERRAMENTAS_ESCRITA_SEM_LEAD` (`copiloto-core.ts` linhas 37/54), `mergeUsoFerramentasComPadrao` (base). Injetadas só com `rotaObra=true`. Auditoria em `hub_ia_consumo` (before/after).

- Criar: *"tá faltando cimento no Andar 9"* → card dourado `📦 Falta material · Andar 9 · [+ Gerar SC?]` → Confirmar → POST E3 `origem='ia'`. Match único na área liga ao item; ambíguo → chip-picker `[A9-Norte][A9-Sul][obra toda]` **antes** do gate.
- Resolver: *"o cimento do 9 chegou"* → `listar` (leitura) acha → `resolver` (gate reforçado) → PATCH resolvida + limpa `falta_material` em E2.
- Leitura livre: *"o que trava a elétrica hoje?"* → auto-exec, injeta no banner do Hoje.

**Nota sobre o gate reforçado:** não existe constante `GATE_REFORÇADO` no código hoje — é o **padrão** que E2 usa para `finalizado`/`cancelado`. E3 segue o mesmo padrão (aviso extra no card dourado). Situação/SST nunca escritas por voz.

### Edge cases (bloqueio→pendência, bloqueio→SC, impacto no prazo)

- **Múltiplos no mesmo item** (material E pessoa): 2 registros E3 independentes (2 responsáveis, 2 prazos). Item só "destrava" quando **todos** os E3 ativos fecharem. View os retorna separados (UNION ALL). Vários do MESMO tipo (2 materiais): 1 boolean `falta_material`, N registros — boolean = OR das abertas do tipo.
- **Bloqueio de frente** (sem item): `frente_id NOT NULL, item_id NULL`. Ex: ART vencida trava a Elétrica inteira. View filtra por `obra_id` normalmente.
- **Bloqueio → PENDÊNCIA (§13, Emenda 1):** `[→ Pendência]` → `status='virou_pendencia'`, grava `pendencia_id`, **apaga o boolean de E2**. Não trata decisão como falta de insumo. Fiel à taxonomia do dono.
- **Bloqueio → SC (E5):** `[Gerar pedido]` cria `hub_pedidos_material` (rascunho) ligado por `pedido_material_id`, **via gate dourado** (dinheiro = humano aprova, regra de ouro). Quando o pedido vira `entregue` (cascata SC→Inventário, planilha §14/§16), o sistema **sugere** resolver ("chegou o material, destravar?") — humano confirma. Se E5 não estiver pronto: fallback cria ocorrência simples + marca em-resolução, sem botão quebrado.
- **Impacto no prazo:** `impacto_dias`/`impacto` é ESTIMATIVA. `hub_obras_cronograma` só se move via RPC `hub_obra_cronograma_adiar` + **gate dourado** — nunca automático (regra de ouro: prazo → humano). Resolver antes do prazo não recua o cronograma sozinho. Cross-frente: `impacto_frente_id ≠ frente_id`; cálculo de caminho crítico é E4, não E3.
- **Falha parcial na resolução** (boolean fantasma): PATCH resolvida persiste mesmo se limpar o boolean falhar (item deletado). A view (`NOT EXISTS` sobre E3 aberto) o retorna de novo como `e2_boolean` → gestor resolve de novo. Risco aceitável MVP; E3-v2 usa RPC transacional.
- **Boolean órfão legado** (E2 ligado antes de E3 existir): a view materializa uma restrição "órfã" mínima ao ler o boolean, com [Detalhar] para enriquecer. Nunca ignora um `falta_*` verdadeiro.
- **SST (§19, Emenda 2):** `tipo='documento'` de SST → [Resolver] desabilitado; só regularização auditada.
- **Mobile:** bottom-sheet, alvos ≥56px, ações verticais (não dropdown); swipe-right→Resolver, swipe-left→detalhes; FAB de voz reposiciona.
- **Permissão (§43 do spec):** operário vê e cria; [Gerar pedido]/aprovar impacto exige papel (eng/gestor) — botão **some por papel** (não só desabilita), e a IA não sugere o que o papel não pode.

### Reúso/reconciliação × novo

| Reúsa (não duplica) | Novo em E3 |
|---|---|
| `hub_obra_itens.falta_*` (E2) — fonte de verdade do boolean | `hub_obra_restricoes` — registro 1ª classe |
| `hub_obras_ocorrencias` (mig. 20260523120000) — proxy de fallback E1; permanece como FATO/§13 Ocorrência | `vw_hub_obra_bloqueios_hoje` — view unificada |
| `hub_pedidos_material` (mig. 20260523120000, real) — FK `pedido_material_id` (elo E5) | RPC `promover` (idempotente) + `cronograma_adiar` (gate) |
| `hub_obra_frentes_eap` (E0) — FK nullable `frente_id` | 4 endpoints `/api/crm/obras/[id]/restricoes*` |
| `CopilotoVoz` + `copiloto-core` (gate, HMAC, allowlists ln 37/54) | 4 tools `hub_obra_restricao_*` |
| `hub_obras_cronograma` (E1 lê) — INTACTO, só RPC opt-in desloca | linha de trava no card + bottom-sheet resolver |
| `requireCrmSessao`/`g.ctx.tenantId`/`crmDb`/`isMissingPgColumn`; `hub_atualizar_timestamp()`/`current_user_tenant_id()`; `hub_ia_consumo`; tokens `--obra-*`/`--brand-*` | — |

---

## AUDITORIA das decisões (riscos, conflito com E1/E2, fidelidade à planilha)

1. **Sync E2↔E3 — mecanismo (MÉDIO, resolvido).** As 4 lentes divergiram: trigger de banco (product-owner) vs sync no endpoint (backend-architect/ai-engineer). **Decido sync no endpoint** — trigger bidirecional repete o erro que E2 já rejeitou (laço, dispara em import batch, frágil de testar). O endpoint PATCH limpa o boolean de E2 na resolução; a RPC `promover` é idempotente na criação. Reversível e auditável.

2. **Falha parcial deixa boolean fantasma (BAIXO, mitigado pela view).** Se resolver a restrição mas o PATCH do boolean falhar, a view o retorna de novo como `e2_boolean` — o gestor resolve de novo. Sem perda de dado, sem crash. E3-v2 = RPC transacional.

3. **Impacto no cronograma (MÉDIO, gate humano).** A RPC `cronograma_adiar` liga por nome (`fase ILIKE frente_nome`) — **mesma fragilidade documentada do bridge E2→E1**. Mitigado: nunca automático, só via botão "Aplicar no cronograma" + gate dourado. E3-v2 adiciona `frente_id` em `hub_obras_cronograma` (aditivo).

4. **RLS / vazamento cross-tenant (CRÍTICO, mandatório).** `crmDb()` é service-role e **bypassa RLS** — isolamento depende 100% do `.eq('tenant_id', tenantId)` no código (precedente: vazamento corrigido em 28/jun). Todo endpoint filtra `tenant_id` **E** `obra_id`. A view usa `security_invoker=true` mas expõe `tenant_id` — o endpoint ainda filtra explícito. **A diferença de E3:** a tool de voz `resolver` muda estado operacional — o gate reforçado + HMAC + `hub_ia_consumo` são obrigatórios, não opcionais.

5. **Conflito com E1 (BAIXO).** E3 só **troca a query** da §3 (proxy → view), sem mudar a estrutura de componentes; degrada via `isMissingPgColumn` para o proxy se a view não existir. `hub_obras_ocorrencias` permanece intacta (continua sendo a Ocorrência/§13, semântica distinta de Restrição).

6. **Conflito com E2 (BAIXO).** Zero ALTER/DROP em `hub_obra_itens`. E3 só lê os booleans e os limpa na resolução via PATCH. `item_id`/`frente_id` nullable → E3 funciona sem E0/E2 totalmente aplicados.

7. **Fidelidade à planilha (ALTA, reforçada pelas emendas).** Os **5 faltas contados** = `tipo` 1:1 com cols J–N. A §13 (Restrição≠Pendência≠Ocorrência≠Risco) agora é honrada via Emenda 1 (`virou_pendencia`+`pendencia_id`). A §19 (SST com poder de bloqueio) via Emenda 2 (doc SST readonly-resolver). Dashboard conta os booleans (grosso) + restrições abertas (fino) — sem recontar.

---

## Critério de PRONTO

- Migração `20260712120000_e3_obra_restricoes.sql` **aditiva** (zero DROP/ALTER em E1/E2; marcador "⚠️ NÃO aplicar — janela do dono") com Emendas 1–3 incorporadas; `tsc + vitest + build + _chk23` verdes.
- `vw_hub_obra_bloqueios_hoje` testada com SELECT real: UNION sem duplicar (item com E3 aberto **não** aparece como `e2_boolean`); boolean legado sem E3 aparece.
- E1 §3 Bloqueios renderiza o dado fino; com a view ausente, **degrada** para o proxy de ocorrências (sem crash).
- Ficha do item (E2): toggle `falta_X=true` cria E3 via `promover` (idempotente — duplo toggle não duplica); tocar ⛔ abre o dossiê.
- Resolver em 1 toque desktop+mobile: `[Gerar pedido]` passa por gate dourado; `[Resolver]` limpa o boolean de E2 e some do Hoje; `[→ Pendência]` reclassifica e apaga o boolean.
- SST doc (§19): [Resolver] desabilitado com tooltip de regularização auditada.
- 4 tools de voz: leitura auto-exec; criar/resolver com gate (resolver = reforçado); ambiguidade → chip-picker; auditoria em `hub_ia_consumo`.
- Todos os endpoints filtram `tenant_id` + `obra_id` (teste de regressão cross-tenant).
- Impacto no cronograma **nunca** automático — só via botão + gate.

## O que precisa da janela do dono

1. **Aplicar as migrações** E0 (`20260705130000`), E2 (`20260710120000`) e E3 (`20260712120000`) — banco em prod, decisão do dono (E3 depende de E2 aplicado).
2. **Flag — impacto no prazo:** confirmar que `impacto_dias` só **alerta** (recomendo) e nunca reprograma o cronograma sozinho (a UI já assume isso; é decisão de negócio).
3. **Flag — bloqueio→SC:** liberar o elo `[Gerar pedido]` → `hub_pedidos_material` (depende de E5 existir e da cascata SC→Inventário, planilha §14/§16).
4. **Validar ao vivo** os 2 fluxos de voz (criar/resolver bloqueio) em prod — depende de `MISTRAL_API_KEY` no Render (já pendente em memória). O cockpit §3 e o resolver-em-1-toque funcionam 100% **sem** Mistral (modo manual).
5. **Confirmar Emenda 2 (SST):** doc de SST vencido fica readonly-resolver (só regularização auditada) — recomendo, fiel a §19; valida com o dono se há exceção formal permitida.

---

**Arquivos-âncora (chão real, nada editado — design-only):** `docs/E3-DESIGN.md` (migração + view + RPCs detalhados), `docs/E2-DESIGN.md` (booleans `falta_*`, `hub_obra_itens`), `docs/E1-DESIGN.md` (cockpit §3), `docs/insumos-do-dono/especificacao-plataforma-gestao-obras.md` (§13 taxonomia, §19 SST, §43 papéis), `lib/copiloto/copiloto-core.ts` (allowlists ln 37/54), `lib/hub/agente-ferramentas-registry.ts` (registry, HUB_FERRAMENTA_ACESSO), `supabase/migrations/20260523120000_crm_integral_core.sql` (`hub_pedidos_material` ln 269, `hub_obras_ocorrencias`). O `docs/E3-DESIGN.md` existente é o backend; este documento adiciona as 3 emendas de produto (Pendência/SST/impacto categórico) e a decisão final sobre o mecanismo de sync.