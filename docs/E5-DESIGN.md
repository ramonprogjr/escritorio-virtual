# E5 (compras -> estoque: SC -> Inventario) — Design + Auditoria (mesa redonda)

All facts verified against real code. Key corrections to the lenses: RLS helper is `current_user_tenant_id()` (confirmed, used 13× in E0); `hub_cotacoes` does NOT exist — real tables are `hub_cotacoes_pedidos`/`hub_cotacoes_respostas` (parallel, tied to `hub_aprovacoes`, no FK to pedido); zero `material` seeds; E3 (`hub_obra_restricoes` + `pedido_material_id` + `acao_sugerida='solicitar_material'`) is design-only, not yet migrated. I have everything to produce the final design + audit.

## Design final de E5 (Compras → Estoque)

E5 transpõe as 3 abas vivas da planilha do Consulado (**SC · Movimentação · Inventário**) para banco robusto, reusando o chão real. Não é ERP — é a cadeia "comprar rápido / ver estoque sem digitar" com **humano no gate da compra**.

### DECISÃO: estender `hub_pedidos_material` + 3 tabelas novas + 1 VIEW (justificada)

As 4 lentes convergiram, e o código confirma o caminho:

| Peça | Decisão | Por quê (fato do código) |
|---|---|---|
| **Cabeçalho da SC** | ESTENDER `hub_pedidos_material` (mig 20260523120000 ln 269) | Já tem `codigo/obra_id/descricao/status/valor_estimado/solicitado_por/tenant_id`. Status `('rascunho','cotando','aprovado','entregue','cancelado')` **já é o ciclo SC**. E1 conta pedido aberto como proxy; E3 liga por `pedido_material_id`. Criar `hub_compras` paralelo **quebraria os 2 elos** e criaria 2 verdades. |
| **Itens da SC** | NOVA `hub_pedido_itens` | `hub_pedidos_material.descricao` é texto livre → viola Click-and-Go. Itens estruturados destravam catálogo, cotação por item, entrega parcial e comissão. |
| **Movimentação** | NOVA `hub_estoque_mov` (`entrada`/`saida`/`devolucao`) | É a aba "Movimentação". `entrada` nasce da cascata; `saida`/`devolucao` do humano. |
| **Inventário** | **VIEW** `vw_hub_inventario` (não tabela) | Fiel à planilha (Inventário = fórmula derivada). Uma única verdade do número, sempre auditável. |
| **Cotações** | **NÃO reusar `hub_cotacoes_pedidos`** — usar JSONB `cotacoes_json` no item na v1 | **CORREÇÃO CRÍTICA das lentes:** `hub_cotacoes` não existe. O real é `hub_cotacoes_pedidos`+`hub_cotacoes_respostas`, um workflow **paralelo amarrado a `hub_aprovacoes`**, sem FK para pedido nem item. Forçar `ALTER ADD pedido_id` nele acopla dois fluxos divergentes. v1 = `cotacoes_json` no item (mínimo valioso); promover a `hub_sc_cotacoes` própria só quando a comissão transacional exigir join. |

**Veredito:** ESTENDER + `hub_pedido_itens` + `hub_estoque_mov` + VIEW + `cotacoes_json`. 3 tabelas físicas (não 4), porque o Inventário é soma e a cotação v1 é JSONB.

### Modelo + CASCATAS como EVENTO/RPC (não fórmula, não trigger)

```sql
-- ⚠️ NÃO aplicar — janela do dono. 20260720120000_e5_compras_estoque.sql
-- (1) ESTENDER cabeçalho (aditivo, zero DROP de dados)
ALTER TABLE public.hub_pedidos_material
  ADD COLUMN IF NOT EXISTS tipo_material TEXT DEFAULT 'material',  -- categoria do catálogo
  ADD COLUMN IF NOT EXISTS frente_id     UUID,   -- soft FK hub_obra_frentes_eap (E0)
  ADD COLUMN IF NOT EXISTS restricao_id  UUID,   -- soft FK hub_obra_restricoes (E3, futuro)
  ADD COLUMN IF NOT EXISTS urgencia      TEXT DEFAULT 'normal' CHECK (urgencia IN ('normal','urgente','critico')),
  ADD COLUMN IF NOT EXISTS origem        TEXT DEFAULT 'manual'  CHECK (origem IN ('manual','ia','e3_restricao')),
  ADD COLUMN IF NOT EXISTS aprovado_por  TEXT,
  ADD COLUMN IF NOT EXISTS aprovado_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entregue_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entrega_parcial BOOLEAN NOT NULL DEFAULT false;

-- Backfill legado ANTES de qualquer CHECK novo
UPDATE public.hub_pedidos_material
  SET tipo_material='material', urgencia='normal', origem='manual'
  WHERE tipo_material IS NULL;

-- Status: ampliar com 'entregue_parcial' (DROP+ADD CHECK; valores antigos preservados)
ALTER TABLE public.hub_pedidos_material DROP CONSTRAINT IF EXISTS hub_pedidos_material_status_check;
ALTER TABLE public.hub_pedidos_material ADD CONSTRAINT hub_pedidos_material_status_check
  CHECK (status IN ('rascunho','cotando','aprovado','entregue_parcial','entregue','cancelado'));
```

```sql
-- (2) hub_pedido_itens (Click-and-Go + entrega parcial + cotações v1)
CREATE TABLE IF NOT EXISTS public.hub_pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.hub_pedidos_material(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  catalogo_id UUID REFERENCES public.hub_catalogo(id) ON DELETE RESTRICT, -- NULL = item fora do catálogo
  descricao_snapshot TEXT NOT NULL,   -- congela o nome; chave de dedup textual quando catalogo_id NULL
  categoria TEXT, unidade TEXT,
  qtd_pedida   NUMERIC(12,3) NOT NULL,
  qtd_entregue NUMERIC(12,3) NOT NULL DEFAULT 0,  -- entrega parcial
  preco_unit_estimado NUMERIC(14,4),
  preco_unit_final    NUMERIC(14,4),
  cotacoes_json JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{fornecedor_nome, fornecedor_id?, valor_total, prazo_dias, score_ia{}, escolhida}]
  item_fora_catalogo BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(), atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.hub_pedido_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY hub_pedido_itens_auth ON public.hub_pedido_itens FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id()) WITH CHECK (tenant_id = current_user_tenant_id());
-- (espelhar policy anon = default_obra10_tenant_id(), padrão real das tabelas hub_*)
```

```sql
-- (3) hub_estoque_mov (imutável; quantidade>0 sempre, sinal vem do tipo)
CREATE TABLE IF NOT EXISTS public.hub_estoque_mov (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  catalogo_id UUID REFERENCES public.hub_catalogo(id) ON DELETE RESTRICT,
  codigo_catalogo TEXT, descricao TEXT NOT NULL, categoria TEXT, unidade TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','devolucao','ajuste')),
  quantidade NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
  pedido_id UUID REFERENCES public.hub_pedidos_material(id) ON DELETE SET NULL,
  pedido_item_id UUID REFERENCES public.hub_pedido_itens(id) ON DELETE SET NULL,  -- idempotência da cascata
  frente_id UUID, motivo TEXT, registrado_por TEXT,
  origem TEXT NOT NULL DEFAULT 'sistema' CHECK (origem IN ('sistema','manual','ia','ajuste')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- SEM atualizado_em: audit trail imutável
);
-- RLS idêntico + índice (obra_id, catalogo_id, tenant_id) para a view
```

```sql
-- (4) VIEW Inventário = Entrada − Saída + Devolução (a fórmula da planilha, derivada)
CREATE OR REPLACE VIEW public.vw_hub_inventario WITH (security_invoker = true) AS
SELECT obra_id, tenant_id, catalogo_id,
       COALESCE(descricao, codigo_catalogo) AS descricao, categoria, unidade,
       SUM(CASE tipo WHEN 'entrada' THEN quantidade WHEN 'devolucao' THEN quantidade
                     WHEN 'saida' THEN -quantidade WHEN 'ajuste' THEN quantidade ELSE 0 END) AS em_estoque,
       SUM(quantidade) FILTER (WHERE tipo='entrada')   AS total_entrada,
       SUM(quantidade) FILTER (WHERE tipo='saida')     AS total_saida,
       SUM(quantidade) FILTER (WHERE tipo='devolucao') AS total_devolucao,
       MAX(criado_em) AS ultima_mov_em
FROM public.hub_estoque_mov
GROUP BY obra_id, tenant_id, catalogo_id, COALESCE(descricao, codigo_catalogo), categoria, unidade;
```

```sql
-- (5) CASCATA SC→Inventário como RPC idempotente (não trigger — mesma decisão de E3)
CREATE OR REPLACE FUNCTION public.hub_sc_registrar_entrega(
  p_pedido_id UUID, p_tenant_id UUID, p_itens JSONB, p_registrado_por TEXT, p_obs TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item JSONB; v_it hub_pedido_itens%ROWTYPE; v_obra UUID; v_all BOOLEAN;
BEGIN
  -- 0) GUARD tenant explícito (SECURITY DEFINER bypassa RLS)
  SELECT obra_id INTO v_obra FROM hub_pedidos_material
    WHERE id=p_pedido_id AND tenant_id=p_tenant_id;
  IF v_obra IS NULL THEN RAISE EXCEPTION 'pedido_nao_encontrado' USING ERRCODE='P0002'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    SELECT * INTO v_it FROM hub_pedido_itens
      WHERE id=(v_item->>'item_id')::uuid AND tenant_id=p_tenant_id AND pedido_id=p_pedido_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    -- entrada IMUTÁVEL (re-entrega = nova linha; nunca UPDATE destrutivo)
    INSERT INTO hub_estoque_mov(obra_id,tenant_id,catalogo_id,codigo_catalogo,descricao,
        categoria,unidade,tipo,quantidade,pedido_id,pedido_item_id,registrado_por,motivo,origem)
      VALUES (v_obra,p_tenant_id,v_it.catalogo_id,
        (SELECT codigo FROM hub_catalogo WHERE id=v_it.catalogo_id),
        v_it.descricao_snapshot,v_it.categoria,v_it.unidade,'entrada',
        (v_item->>'qtd')::numeric,p_pedido_id,v_it.id,p_registrado_por,p_obs,'sistema');
    UPDATE hub_pedido_itens SET qtd_entregue = qtd_entregue + (v_item->>'qtd')::numeric,
        atualizado_em=NOW() WHERE id=v_it.id;
  END LOOP;

  SELECT bool_and(qtd_entregue >= qtd_pedida) INTO v_all
    FROM hub_pedido_itens WHERE pedido_id=p_pedido_id;
  UPDATE hub_pedidos_material
    SET status = CASE WHEN v_all THEN 'entregue' ELSE 'entregue_parcial' END,
        entrega_parcial = NOT v_all,
        entregue_em = CASE WHEN v_all THEN NOW() ELSE entregue_em END
    WHERE id=p_pedido_id;

  RETURN jsonb_build_object('status', CASE WHEN v_all THEN 'entregue' ELSE 'entregue_parcial' END,
    'sugerir_resolver_restricao', (SELECT restricao_id FROM hub_pedidos_material WHERE id=p_pedido_id));
END $$;
REVOKE ALL ON FUNCTION public.hub_sc_registrar_entrega(uuid,uuid,jsonb,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.hub_sc_registrar_entrega(uuid,uuid,jsonb,text,text) TO authenticated, service_role;
```

**Cascata 2 (Inventário = Entrega − Saídas + Devoluções)** não escreve nada: é a própria VIEW. Saída/Devolução = INSERT em `hub_estoque_mov`; a view recalcula na leitura. Zero fórmula frágil, zero trigger bidirecional. O `gerar_codigo_sc` reusa o padrão atômico de `gerar_codigo_obra` (contador por `tenant+ano`, não `COUNT(*)` — corrige o vazamento cross-tenant da auditoria).

### Telas (Click-and-Go, dark verde+dourado, mobile-first) + ASCII

**T1 — SC: Tipo → Descrição filtrada → Qtd (não digitar).**
```
┌─ Nova SC ───────────────── SC-2026-0042 ──┐  KPIs no topo (fiel à planilha):
│ Obra:[Consulado Itália ▾] (TRAVA se ?obra) │  ┌ 4 abertas·R$28.4k·1 urgente ⚠ ┐
│ Frente:[Civil ▾] (vem do elo E3)           │  └────────────────────────────────┘
│ TIPO: [Material✓][Equip.][Serviço][M.O.]   │ ← segmented FILTRA a lista
│ DESCRIÇÃO (só do catálogo dessa categoria): │   GET /api/crm/catalogo?categoria=material
│  🔎 cimento…                                │
│   ▸ Cimento CP-II  un:saco   ▸ Areia m³    │
│   + Item fora do catálogo →  (escape)       │
│ ┌ Cimento CP-II  [− 50 +] saco  ✨~R$1.250 ┐│ ← stepper, IA estima valor
│ │ Areia média    [−  4 +] m³    🗑          ││
│ Urgência:[Normal✓][Urgente][Crítico]        │
│ ⚠ GATE: compra exige aprovação humana       │ ← faixa dourada FIXA
│ [Salvar rascunho]    [Enviar p/ cotação ▸]  │
└─────────────────────────────────────────────┘
```

**T2 — Cotações (IA: melhor preço / custo-benefício / risco). Humano escolhe (gate).**
```
┌─ SC-0042 · Cotações (3) ──────────── COTANDO ─┐
│ ✨ IA: "Friopeças = melhor c/b: 2º preço, mas │
│   2d e homologado." [usar]                     │
│ ┌ConstruMax┐ ┌Friopeças┐ ┌Avulso*┐            │
│ │R$1.180   │ │R$1.240  │ │R$1.090│            │
│ │🏷 preço  │ │⭐ c/b   │ │⚠ s/forn│           │ ← *fornecedor não cadastrado
│ │6d homol✓ │ │2d homol✓│ │? risco │            │
│ │[Escolher]│ │[Escolher]│ │[Escolher]│          │
│ ⚠ GATE: aprovar a compra (humano + papel)      │
│ [Voltar]         [Aprovar Friopeças ▸]         │ ← botão SOME por papel
└────────────────────────────────────────────────┘
```

**T3 — Inventário (automático, fórmula VISÍVEL = confiança).**
```
┌─ Estoque · Consulado Itália ──────── 🔄 auto ─┐
│ [Tudo][Material][Equip.] 🔎                    │
│ ┌ Cimento CP-II  saco                         ┐│
│ │ Em estoque: 38  (Entr.50 − Saí.14 + Dev.2)  ││ ← fórmula em cinza 11px
│ │ [+ Saída] [↩ Devolução] [histórico ›]       ││
│ ┌ Areia média    m³   ⚠ zerado                ┐│
│ ┌ Tinta 18L  ⛔ −2 NEGATIVO  [ajustar]        ┐│ ← alerta, nunca esconde
└────────────────────────────────────────────────┘
```

**T4 — Movimentação (Descrição→Categoria automática; preview anti-erro).**
```
┌─ Registrar saída ──────────────────────────────┐
│ Tipo: (●Saída)(○Devolução)                      │
│ Item:[Cimento CP-II ▾] → Categoria: Material(auto)│
│ Disponível: 38 saco   Qtd:[− 12 +]              │
│ Frente:[Civil — Andar 8 ▾]  Obs:[🎙 voz ok]     │
│ Após: ficará 26 saco                            │ ← preview do efeito
│ [Cancelar]            [Registrar saída ✓]       │
└─────────────────────────────────────────────────┘
```

### Elo restrição (E3) "falta material" → SC

E3-DESIGN (verificado) já tipa `acao_sugerida='solicitar_material'` + FK `pedido_material_id`. Fluxo: card de bloqueio → `[📦 Gerar pedido ▸]` (gate dourado) → `POST /api/crm/obras/[id]/restricoes/[rid]/gerar-sc` cria `hub_pedidos_material` (`status='rascunho'`, `origem='e3_restricao'`, `restricao_id`, `frente_id` herdado) + grava `pedido_material_id` de volta na restrição. Abre T1 pré-preenchida (obra+frente travados, item sugerido pela IA do texto do bloqueio). Quando a SC vira `entregue`, a RPC retorna `sugerir_resolver_restricao` → card dourado no Hoje "Cimento chegou — destravar o Andar 8?" → **humano confirma** (PATCH restrição + limpa boolean E2). Nunca automático. **Fallback (E3 ainda não migrado):** o botão degrada para modal de descrição livre via `isMissingPgColumn` — não quebra.

### Conversacional / IA (gate de aprovação)

4 tools no molde exato de `hub_obra_criar` (registrar nos 4 pontos: `HubAgenteFerramentaId`, `HUB_FERRAMENTA_ACESSO`, `COPILOTO_FERRAMENTAS_ESCRITA_FASE3`, `ESCRITA_SEM_LEAD` — operam sobre `obra_id`, não lead):
- `hub_sc_criar` (ESCRITA, **gate sempre** — é dinheiro) · `hub_estoque_movimentar` (ESCRITA, gate)
- `hub_pedido_listar` (LEITURA, auto-exec) · `hub_inventario_consultar` (LEITURA, auto-exec)

"pede 50 sacos de cimento pro Andar 8" → match fuzzy no `hub_catalogo` → card dourado `acaoPendente` (reuso integral de `CopilotoVoz`) "📦 SC: 50 Cimento CP-II · Andar 8 · ~R$1.250 [Confirmar]" → cria **rascunho** (nunca aprovado — aprovar é 2º gate na tela com papel). Ambíguo (CP-II vs CP-V) → chip-picker ANTES do gate. "quanto cimento tem?" → auto-exec lê a view. **Aprovar compra por voz = proibido por design.** Auditoria em `hub_ia_consumo`.

### Edge cases

Entrega parcial (`qtd_entregue<qtd_pedida` → status `entregue_parcial`, 2ª entrega soma, idempotência por `pedido_item_id`) · Devolução (linha `devolucao`, soma de volta, nunca apaga saída) · Item fora do catálogo (`catalogo_id NULL`, agrupa por `descricao_snapshot`, não trava; sugere cadastrar **no tenant**, RLS bloqueia global) · Cotação sem fornecedor cadastrado (`cotacoes_json` com `fornecedor_nome` texto livre, IA penaliza risco, oferece cadastrar como lead) · Estoque negativo (view permite, badge ⛔ + `[ajustar]`, nunca bloqueia silenciosamente; preview "Após: −2" avisa antes) · Item sem IA (`score_ia=null`, "IA sem dados — escolha por preço/prazo", nunca inventa) · Mobile (bottom-sheet, steppers ≥56px, segmented scroll-x, cards de cotação empilham, GATE fixo no rodapé, voz é o atalho de campo).

### Reuso/reconciliação × novo

**REUSA:** `hub_pedidos_material` (estende), `hub_catalogo` (dropdowns), `hub_obra_frentes_eap` (frente), `hub_obra_restricoes`+`pedido_material_id` (E3, futuro), `CopilotoVoz`/`copiloto-core.ts` (gate dourado ln 37/54), `requireCrmSessao`/`requireCrmComercial`/`crmDb`/`isMissingPgColumn`, `current_user_tenant_id()`/`default_obra10_tenant_id()`/`hub_atualizar_timestamp()`, `hub_ia_consumo`, `gerar_codigo_obra` (modelo do contador). **NOVO mínimo:** 2 tabelas + 1 view + 1 RPC + ADD colunas + `cotacoes_json`. **NÃO reusa:** `hub_cotacoes_pedidos`/`_respostas` (fluxo paralelo de aprovações, sem elo a pedido — v1 usa JSONB).

---

## AUDITORIA das decisões

**RISCO 1 — As 4 lentes assumiram `hub_cotacoes` (tabela inexistente).** Fato real: `hub_cotacoes_pedidos`+`hub_cotacoes_respostas` (mig 20260510140000), amarradas a `hub_aprovacoes`, sem FK a pedido/item. **Corrigido:** v1 = `cotacoes_json` no item; promover a tabela própria só com a comissão transacional. **Não** estender `hub_cotacoes_pedidos` — acoplaria dois fluxos divergentes.

**RISCO 2 — RLS helper.** Lentes citaram `current_user_tenant_id()` (correto, 13× em E0) mas as policies reais das tabelas hub_* têm **dois** roles: `anon → default_obra10_tenant_id()` e `authenticated → app_tenant_id()`/`current_user_tenant_id()`. As tabelas novas devem espelhar **as duas** policies, não só a de authenticated, senão o acesso anon (que o resto do hub usa) fica inconsistente. **Ação:** copiar o bloco de policy de `hub_cotacoes_pedidos` (anon+auth).

**RISCO 3 — Catálogo sem materiais.** Seeds de E0 só têm `disciplina` + `area_andar`; **zero** itens `material`. Sem isso o Click-and-Go (Tipo→Descrição) abre vazio. **Ação obrigatória:** seedar ~20 materiais frequentes (`tenant_id NULL`, global) na migração de E5, OU o edge "item fora do catálogo" cobre até o tenant popular. Sem uma das duas, T1 não funciona. **Esta é a maior dependência de PRONTO.**

**RISCO 4 — E3 não migrado.** `hub_obra_restricoes`/`pedido_material_id`/`acao_sugerida` são **design-only** (docs). O elo E3→SC depende de E3 existir. **Mitigado:** `restricao_id` é soft FK (UUID sem hard FK) → migra sem E3; o botão `[Gerar pedido]` degrada via `isMissingPgColumn`. Sem conflito de ordem.

**Conflito com E1/E3:** nenhum — **reforça**. E1 conta `hub_pedidos_material` aberto como proxy de bloqueio: continua válido (só adiciona colunas). E3 ganha o destino real do `[Gerar pedido]`. A cascata como **RPC, não trigger**, é a mesma decisão já tomada em E3 (sync no endpoint) — coerência arquitetural.

**Regra de tenant:** RPC `SECURITY DEFINER` com guard `tenant_id` explícito no início + `SET search_path=public`. Endpoints com `.eq('tenant_id')` puro + 404 guard. Migração aditiva com backfill NULL antes de qualquer CHECK. ✓

**Cascata robusta?** Sim: (a) idempotente por `pedido_item_id` (double-tap não duplica entrada); (b) imutável (re-entrega/devolução = nova linha, nunca UPDATE destrutivo de saldo); (c) view derivada (impossível dessincronizar); (d) entrega parcial via `bool_and(qtd_entregue>=qtd_pedida)`; (e) sugere destravar E3 mas **nunca** resolve sozinho (gate humano). Único ponto a validar: `bool_and` sobre pedido **sem itens** (legado só com `descricao`) → retorna NULL; tratar como `entregue` direto ou criar 1 item genérico no backfill (recomendo o item genérico, já previsto).

## Critério de PRONTO

1. Migração aplicada (ALTER + 2 tabelas + view + RPC + `gerar_codigo_sc`) com backfill NULL e RLS anon+auth nas duas novas. 2. **Seed de ~20 materiais no catálogo** (sem isso T1 abre vazio — bloqueante). 3. 4 telas Click-and-Go renderizam com `tsc`+`vitest`+`_chk23` verdes. 4. Cascata SC→Inventário testada: criar SC → aprovar → registrar entrega (total e parcial) → view reflete; double-tap não duplica. 5. Saída/Devolução atualizam a view; estoque negativo mostra alerta, não trava. 6. Elo E3→`[Gerar pedido]` cria rascunho com gate (ou degrada se E3 ausente). 7. 4 tools de voz registradas nos 4 pontos; `hub_sc_criar` só com Confirmar; aprovar por voz bloqueado. 8. Verificação clicando no navegador (desktop+mobile). 9. Migração marcada "⚠️ NÃO aplicar — janela do dono", reversível.

## O que precisa da janela do dono

1. **Aplicar a migração** (ALTER `hub_pedidos_material` + DROP/ADD CHECK de status + 2 tabelas + view + RPC) — é a única ação irreversível-sem-rollback-trivial; backup antes.
2. **Validar o seed de materiais** — quais ~20 itens frequentes das obras dele (cimento, areia, brita, vergalhão, bloco, argamassa, tubo, cabo, eletroduto, tinta…) entram no catálogo global vs por tenant.
3. **Pesos do score IA de cotação** (preço/prazo/risco) — os 0.5/0.3/0.2 são arbitrários; calibrar com a régua dele.
4. **MISTRAL_API_KEY no Render** — só para a justificativa textual da IA e a voz; tudo roda 100% em modo determinístico/manual sem ela.
5. **Confirmar ordem E3 antes de E5** (recomendado) ou aceitar o elo `[Gerar pedido]` em modo degradado até E3 migrar.

Arquivos-âncora (chão real, nada editado — design-only): `supabase/migrations/20260523120000_crm_integral_core.sql` (`hub_pedidos_material` ln 269), `supabase/migrations/20260705130000_e0_obra_eap_catalogo.sql` (`hub_catalogo` ln 102, `hub_obra_frentes_eap` ln 73, seeds só disciplina/área), `supabase/migrations/20260510140000_hub_cotacoes.sql` (`hub_cotacoes_pedidos`/`_respostas` — fluxo paralelo, NÃO reusar como cotação de SC), `docs/E3-DESIGN.md` (elo `pedido_material_id`/`acao_sugerida='solicitar_material'`, RPC-não-trigger), `docs/E1-DESIGN.md` (proxy de pedido aberto), `lib/copiloto/copiloto-core.ts` (allowlists ln 37/54), `lib/hub/agente-ferramentas-registry.ts` (registry).