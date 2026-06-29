# Marketplace / iFood da construcao — Design ideal (mesa redonda, FASE 2 sobre E5)

Tenho a fundação E5 verificada e os três insumos do dono lidos. As 4 lentes convergiram com forte fidelidade. Consolido o design ideal, reconciliando os pontos onde as lentes divergiram da realidade do E5 (cotacoes_json no item, não tabela própria; hub_fornecedores já existe via espelho-motor; nada de hub_cotacoes).

## Marketplace / iFood — design ideal

O JOB que importa medir: **"comprar sem largar a obra"** — derrubar o tempo "percebi que falta → pedido a caminho" de ~3h (largar a obra, doc campo §7) para <3min. O moat NÃO é entregar rápido (commodity caro); é o **cérebro da obra prevendo a falta antes do peão** (EAP+estoque E5+restrição E3). Tudo abaixo serve a esse número. Asset-light: Obra10 orquestra (trilho + demanda + predição + escrow + spread), o fornecedor cumpre, Lalamove entrega o urgente.

**Camadas (alvo Fase 2 sobre E5):** Totem de voz → Motor preditivo → Matching geo/ranking → Catálogo self-service → **Fundação E5** (`hub_pedidos_material` + `hub_pedido_itens` + `hub_estoque_mov` + `vw_hub_inventario` + RPC `hub_sc_registrar_entrega`). É camada, não sistema novo.

### Catálogo self-service do fornecedor + matching geo/ranking

O fornecedor do marketplace **é o mesmo** `hub_fornecedores` já homologado (espelho-motor `20260701120000`, já tem status/cidade/estado/score/recebe_leads). Não duplicar CNPJ/endereço. Tabelas novas mínimas:

- **`hub_fornecedor_catalogo`** (o SKU vendável, N:N sobre `hub_catalogo`): `fornecedor_id`, `tenant_id`, `catalogo_id` (NULL = item próprio fora do canônico), `descricao_snapshot`, `marca`, `categoria`, `unidade`, `preco_unit`, `preco_rede` (negociado com o Hub), `preco_atualizado_em` (frescor), `estoque_disponivel`, `estoque_reservado`, `lead_time_dias`, `entrega_urgente`, `lead_time_urgente_h`, e o porte físico: `peso_kg`, `volume_m3`, `dimensoes JSONB`. `UNIQUE(fornecedor_id, catalogo_id)`. RLS: fornecedor edita só o seu; Hub (service_role) lê global p/ matching.
- **`hub_fornecedor_cobertura`** (geo): `cidade/estado/cep_base`, `lat`, `lng`, `raio_km`. Cold-start começa simples (cidade/estado já existem em `hub_fornecedores`); `lat/lng` + PostGIS é evolução.

**Matching = reúso do motor de leads** (`lib/crm/distribuir-lead.ts` — score geo+aderência, novo objeto = item em vez de lead). Não inventar engine. Fluxo:
1. **Geo filter** (Haversine em app no cold-start; PostGIS é Fase 3) — fornecedores dentro do raio.
2. **Catálogo filter** — quem tem o item com `estoque_disponivel − estoque_reservado ≥ qtd`.
3. **Score composto:** `0.40·preço + 0.25·distância + 0.25·score_SLA + 0.10·frescor`. **Pesos calibráveis pelo dono em `hub_tenants.config_json`** (mesma pendência aberta dos pesos de cotação de E5 — não inventar a régua).
4. **Top-N (3-5)** → escreve em `hub_pedido_itens.cotacoes_json` — **o campo JÁ EXISTE em E5**. A tela T2 de cotações de E5 renderiza esses cartões **sem mudança**. Trocamos só a *fonte* das cotações: de manual → automática.

**Notificação sequencial por score, nunca broadcast simultâneo** (evita spam e múltiplos aceites). #1 tem timeout (default 30 min) → cai p/ #2 → … → #5 → cotação aberta manual.

```
[E5 hub_pedido_itens] --(item + geo da obra)--> [matching = motor de leads reusado]
        |                                                |
        | <-- escreve cotacoes_json (top-3) ------------ [hub_fornecedor_catalogo + cobertura]
        v
[T2 cotações E5 — JÁ EXISTE] -> humano aprova (gate) -> preço TRAVA no pedido
```

### Frete automático (porte→veículo→cotação, Lalamove)

O item **carrega peso/volume** no catálogo → o engine deriva o porte do **pedido agregado** (não por item), escala sempre para cima:

```
peso≤5kg  & vol≤0.02m³ → moto      | peso≤300kg & vol≤1.5m³ → van
peso≤30kg & vol≤0.10m³ → carro     | peso≤3t & vol≤15m³ → caminhão_pequeno | acima → caminhão_grande
fragil → upgrade automático       | item.requer_veiculo (override) só escala para cima
```

**Nível decidido automaticamente:** origem `predicao`/`manual` normal → **planejado** (fornecedor entrega, mais barato, default); origem `e3_restricao`/urgência `urgente|critico` → **imediato** (Lalamove). **Faseamento honesto do frete:** Fase 2 = **tabela estática** (porte × faixa-km, determinística, zero dependência externa). Fase 3 = **Lalamove API real** (quotation por serviceType MOTORCYCLE/SEDAN/VAN/TRUCK + webhook de ETA/mapa). O frete aparece **separado** no pedido — nunca escondido no spread. Sem dimensões → defaults conservadores por categoria + aviso "frete estimado, confirmar com fornecedor" (badge "dados completos" dá boost de score a quem preenche).

### Spread honesto (preço de rede)

Regra de ouro contra o **medo #4 do dono ("ser enganado")**: **nunca markup escondido**. Dois modos transparentes, e o sistema **escolhe o admissível pelo modelo de contrato** (que ele já conhece via escrow):
- **Preço-de-rede (preferido):** cliente paga o preço de rede negociado, que é **menor** que comprar sozinho. Ex.: varejo R$32/saco → rede R$28 (fornecedor) → cliente R$30 → Hub fica R$2. Card mostra "**R$30/saco — você economiza R$2 vs varejo**". O ganho do Hub aparece como *desconto do cliente*, não como taxa.
- **Taxa de serviço transparente:** linha "Taxa de rede Obra10 (X%)" visível. **Obrigatório em obra por administração** (cliente vê unitário real — markup embutido violaria o contrato). O sistema bloqueia preço-de-rede embutido nesse modo.

Persistência (auditável, append-only): ao aprovar, gravar em `hub_pedido_itens` → `preco_unit_final` (cliente), `custo_fornecedor`, `spread_tipo`, `spread_valor`. O cliente **nunca** vê `custo_fornecedor`/`spread` via API (RLS service_role only); vê só o comparativo de varejo. Isso alimenta o split/comissão por código único. Spread default por categoria (em `config_json`, calibrável): básico 8-12% · instalação 12-18% · equipamento 15-25% · ferramenta 10-15%.

### Predição (EAP/cronograma → pedido por fase) = o moat

**Isto é o produto; o resto é encanamento.** Nenhum app genérico tem o cérebro da obra. Sinais que **já existem**: EAP (`hub_obra_frentes_eap`), avanço (E2), estoque (`vw_hub_inventario` de E5), restrição "falta material" (E3). **Sem tabela nova obrigatória:** `hub_pedidos_material.origem` só ganha `'predicao'` (hoje aceita `manual|ia|e3_restricao`). O resto é leitura de views. (Uma `hub_predicao_pedido` opcional registra sugestão/confiança/desfecho para auditoria, mas não é bloqueante.)

**Motor (cron noturno — o Render cron já existe, não é infra nova), determinístico primeiro:**
```
para cada frente com início em [hoje+3d, hoje+21d]:
  consumo_previsto = f(disciplina, m²/ml, tipo_obra)   # coef. da EAP/curva
  estoque_na_fase  = estoque_atual − (taxa_consumo_diária × dias_até_fase)
  se estoque_na_fase < consumo_previsto*0.5 → 'critico'
  elif estoque_na_fase < consumo_previsto  → 'atencao'  → gera sugestão de SC (rascunho)
  quando_pedir = data_início − prazo_entrega − margem
```
Saída = card no "Hoje" (NÃO alarme chato — doc campo §4: pessoa certa, momento certo, o mínimo; agrupa por frente/dia, silencia o que já tem pedido em rota):
```
┌─ Atenção: Tinta em baixo ──────────────────────────────┐
│ Fase Pintura Andar 8 começa em 5 dias                  │
│ Estoque: 3 latas · Necessário: 8 · Pedir: 5            │
│ FerreMax (2,1 km) · R$89/lata × 5 = R$445 (preço rede) │
│            [Ignorar]   [Gerar pedido agora ▸]          │
└────────────────────────────────────────────────────────┘
```
[Gerar pedido] → abre T1 de E5 pré-preenchida (obra+frente+item+qtd, `origem='predicao'`) → **gate humano** (nunca compra sozinho). **Honesto sobre maturidade:** v1 = regra simples (estoque < necessidade da próxima frente). ML que aprende consumo real é Fase 3 — mas a regra simples já é o moat porque ninguém mais tem os dados. **Degradação graciosa:** obra sem EAP → predição vazia, mostra "Adicione o cronograma para ativar alertas" (o totem ainda funciona manual).

### Totem de compra (voz) + tracking iFood + ASCII

**Totem = CopilotoVoz com contexto de obra+projeto**, não tela nova de IA. Reúso integral: FAB verde, transcrição live, card dourado `acaoPendente`, gate HMAC (`copiloto-core.ts`). Fluxo "comprar tinta":
1. Voz → copiloto puxa **projeto** (cor exata RAL/spec/marca já no sistema) + **frente do checkin** (geo+papel) + **estoque atual**.
2. **Cardápio** pré-montado (estilo McDonald's): foto + swatch da cor do projeto + qtd calculada do EAP — escolher, não digitar.
3. Card dourado: cria **rascunho** de `hub_pedidos_material` (`origem='totem'`). **Aprovar compra por voz = PROIBIDO por design** (é dinheiro — mesma trava de E5).
4. **Gate humano** (papel aprovador) na tela → matching → fornecedor #1.

Gatilho 1-toque no checkin (doc campo §5): "Você está na frente de Pintura A8. Estoque: 3 latas. Previsão hoje: 4. [📦 Pedir tinta agora]" — contexto carregado reduz a compra a 1 toque.

**Tracking iFood** = append-only. Pluga em E5: `hub_pedidos_material.status` já tem o ciclo; ADD `fase_entrega` + eventos em `hub_pedido_eventos` (quem/quando/onde, nada se perde). Realtime via **Supabase Realtime** (subscribe — zero infra). Confirmar recebimento → cascata E5 `hub_sc_registrar_entrega` (JÁ EXISTE) → inventário atualiza → se veio de E3, sugere destravar a frente (humano confirma).

```
Pedido SC-2026-0042 ─────────────────────── A caminho 🛵
 ●━━━━━●━━━━━●━━━━━◉╌╌╌╌╌○╌╌╌╌╌○
 Aprov. Aceito Separ. A cam. Entreg. Confirm.
  ✓     ✓     ✓   [agora · van · chega ~14h35 · 2,1km]
 13:04  💰 Pagamento em garantia (libera na entrega)   ← escrow = confiança
 [ Confirmar recebimento ]  ⚠ libera o pagamento ao fornecedor
```
Estados que **não escondem problema** (regra E5): parcial (◉ meio-dourado "2 de 3"), atraso (badge vermelho + ranking↓), recusar item no Confirmar (chips ✓/avariado/não veio).

### Cadeia de contratação (ofícios) + monetização por elo

**Mesma máquina, objeto diferente:** material = produto; ofício = serviço. O pedido (`hub_pedidos_material`, tipo `servico`) cobre o cabeçalho; `hub_pedido_itens` (tipo serviço) cobre o escopo. Hierarquia (doc serviços §2): arquiteto → eng/empreiteira → prestadora (marcenaria/vidraçaria/…) → mão de obra (especialistas, sem login, já modelados). Cada handoff "X contrata Y" = **contratação encadeada com código único** → split/comissão por elo:

```
Arquiteto→Empreiteira R$100k → Hub 3% = R$3.000
  Empreiteira→Prestadora R$20k → Hub 4% = R$800   (pai do contrato acima)
    Prestadora→Mão de obra R$8k → Hub 2% = R$160
Total Hub: ~R$3.960 numa obra, zero esforço logístico. O Hub é sempre o escrow.
```
Tabela fina nova: **`hub_contratacao`** (`codigo` único, `obra_id`, `contratante_id`/`contratado_id` + tipos, `oficio`, `escopo_json`, `valor`, `comissao_hub_pct/valor`, `modelo_contrato` administracao|preco_fechado, `status`, `escrow_status`, `contrato_pai_id` self-FK). Matching de ofício reúsa o **mesmo motor geo+score** (prestadora por ofício+praça+KPI). **Honesto: serviços é Fase 3** — escopo/medição/qualidade subjetiva são mais complexos; produto/material primeiro (mensurável, frete claro, dor diária mais aguda).

### KPIs do fornecedor

Resposta direta à pergunta #3 do dono (doc campo §45): começar com **exatamente 4**, não engessar os 20:
1. **% entrega no prazo** (o SLA — escrow é a alavanca: só paga na entrega confirmada)
2. **Fill rate** (atendeu o pedido completo? combate parcial crônica)
3. **Frescor de preço** (% do catálogo atualizado <7d — sem isso cai no ranking)
4. **Tempo de resposta** (aceitou/cotou rápido?)

(Devolução/defeito entra como 5º na Fase 3, quando houver volume p/ ser justo.) Tabela: **`hub_fornecedor_kpi`** = **view derivada** de `hub_pedidos_material`/`itens` (como o Inventário de E5 — uma só verdade, recalculada por cron). Score governa o peso `w_sla` no matching → bom fornecedor sobe, ruim some. **Permanência por mérito:** piso de score mantém no marketplace; abaixo do piso por N dias → suspenso (não deletado, append-only registra o porquê; o fornecedor vê o próprio score e a causa). Frescor velho: >7d perde posição; >30d fica oculto.

### Como pluga em E5 · Faseamento (fase 2 min / fase 3 logística)

**Pluga sem reconstruir:** `hub_pedidos_material` (cabeçalho/status/ciclo; ADD `origem='predicao'`, `fase_entrega`), `hub_pedido_itens` (`cotacoes_json` recebe o matching; ADD `custo_fornecedor/spread_tipo/spread_valor`), `hub_estoque_mov`+`vw_hub_inventario` (entrega), RPC `hub_sc_registrar_entrega`, telas T1-T4 (T2 inalterada), tool de voz `hub_sc_criar`, motor `distribuir-lead.ts`, `hub_fornecedores` (espelho-motor), `CopilotoVoz`/`copiloto-core.ts` (gate dourado), escrow/contratos (E6), `hub_catalogo` (dropdowns + edge item-fora-catálogo já tratado), E3→SC (origem prevista), `hub_ia_consumo`, `requireCrmSessao/crmDb/isMissingPgColumn`, RLS `current_user_tenant_id()` + `default_obra10_tenant_id()` (espelhar **as duas** policies anon+auth, como E5 corrigiu), `gerar_codigo_obra` (contador atômico p/ código de contratação). Cron preditivo = mais um job no Render existente. Tracking realtime = Supabase Realtime.

**Fase 2 — marketplace mínimo (asset-light, determinístico, ZERO infra nova):**
- `hub_fornecedor_catalogo` (self-service: preço/disponibilidade/porte) + `hub_fornecedor_cobertura`
- matching geo+ranking reusando o motor de leads → preenche `cotacoes_json` (T2 inalterada)
- frete por **tabela estática** (porte→faixa-km) — sem Lalamove ainda
- spread honesto (preço-de-rede OU taxa de serviço), gravado e visível
- 4 KPIs (view derivada) governando ranking
- totem (copiloto + contexto projeto/checkin) + tracking de status (timeline, sem mapa real)
- **predição v1** (regra estoque<necessidade da próxima frente) — o moat, só leitura de views
- escrow no gate (paga na entrega confirmada)
- portal self-service do fornecedor (rota `/fornecedor/*` no mesmo app)
- **4 tools de voz** (`hub_marketplace_pedir` ESCRITA-gate, `_cotacoes_ver`/`_tracking_ver`/`_predicao_ver` LEITURA) registradas nos 4 pontos do registry
- cold-start: SP capital, ~20 fornecedores, catálogo fresco = condição de entrada

**Fase 3 — logística densa + cadeia + inteligência (quando volume justificar):** Lalamove API real (cotação dinâmica + webhook ETA/mapa); cadeia de ofícios (`hub_contratacao` + split por elo); aluguel de equipamento como categoria; predição com ML; PostGIS; consolidação de pedidos por praça (milkrun); tablet-comodato premium (v1 = celular+geofence); 5º KPI (devolução). **Regra de ouro do faseamento: nada em Fase 2 depende de infra externa (Lalamove/ML/hardware)** — protege o cold-start.

### Cold-start (SP, 20 fornecedores) · Edge cases

**Cold-start:** ranking funciona com poucos candidatos (2 → compara 2; 1 → "único fornecedor na região"; 0 → cotação aberta). O gargalo real **não é o software** — é o trabalho comercial de negociar `preco_rede` com cada um dos 20 (e onboardar catálogo fresco). Predição só roda com EAP preenchido (degradação graciosa).

**Edge cases:**
- **Preço velho:** >7d penaliza score e desce; >30d oculto. Preço **trava no momento da aprovação** (`preco_unit_final` imutável). Alterar após aceite → 409. Todos velhos → "preço a confirmar", fornecedor confirma antes do escrow (nunca cobra preço que pode ter mudado).
- **Sem fornecedor próximo:** amplia raio 2× com aviso honesto → cotação aberta (fallback que o dono já previu) → split entre 2 (Fase 3). Nunca tela vazia; registra demanda não atendida p/ growth.
- **Item fora do catálogo:** E5 já trata (`catalogo_id NULL`, agrupa por `descricao_snapshot`). Vira cotação livre; sugere cadastrar no catálogo do tenant (RLS bloqueia global).
- **Entrega parcial:** E5 já trata (soma `qtd_entregue`, idempotência por `pedido_item_id`). Impacta fill rate; escrow libera proporcional; faltante dispara novo matching urgente.
- **Urgente/faltou agora:** nível imediato, urgência `critico` (campo E5 existe) pula predição → totem 1-toque; frete maior mostrado honestamente ("entrega hoje: +R$X").
- **Estoque reservado vs disponível:** aceite faz `estoque_reservado++` / `disponivel--` (UPDATE atômico com row lock); cancelamento compensa; matching concorrente vê o reservado.
- **Aprovar por voz:** bloqueado no `/interpretar` E no gate HMAC — "aprovação de compra exige seu toque (proteção do seu dinheiro)".
- **Duplo toque:** idempotência por (obra+catálogo+qtd+origem+janela 60s+tenant).
- **Lalamove indisponível/fora de cobertura (Fase 3):** degrada para planejado/fornecedor; nunca quebra o fluxo.
- **Preço-de-rede em obra por administração:** força taxa de serviço transparente (bloqueia markup embutido) — protege a régua "sem mentiras".
- **Anti-redundância:** antes de finalizar, se `vw_hub_inventario` já tem o item, banner "Você tem 12 latas em estoque — comprar mais?".
- **Offline na obra:** totem guarda rascunho local, envia ao reconectar (append-only, nada se perde).

---

**Decisões que precisam do dono (não inventei — registradas como pendência):** (1) pesos do ranking preço/dist/SLA/frescor; (2) frete repassado vs embutido (recomendo separado no cold-start = confiança); (3) % de comissão por elo (3/4/2% ilustrativos); (4) gate por valor mínimo (recomendo gate p/ TODOS no início — medo de enganação); (5) tablet-comodato desde o teste vs celular+geofence.

**Correções aplicadas às lentes (fidelidade ao código real):** cotações vão em `cotacoes_json` no item, **não** em tabela própria nem em `hub_cotacoes_pedidos` (fluxo paralelo de aprovações, sem FK a pedido — risco já documentado em E5); o fornecedor do marketplace **é** `hub_fornecedores` (espelho-motor existente), não uma `hub_*_fornecedores` nova; predição não exige tabela nova (só `origem='predicao'`); RLS deve espelhar **anon+auth**; matching reúsa `distribuir-lead.ts` (assinatura a confirmar em código antes de implementar). **Design-only — nada editado.** Arquivos-âncora: `docs/E5-DESIGN.md`, `docs/insumos-do-dono/{ifood-construcao-pedidos,servicos-cadeia-contratacao-monetizacao,campo-tablet-totem-entrega}.md`, `components/crm/CopilotoVoz.tsx`, `lib/copiloto/copiloto-core.ts`, `lib/crm/distribuir-lead.ts`, `app/globals.css`.