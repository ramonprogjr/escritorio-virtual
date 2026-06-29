# E4 Cronograma + Curva S (baseline + pesos + previsto x realizado honesto) — Design (mesa redonda)

Os dois designs-âncora confirmam o chão real: `hub_obras_cronograma` flat (fase/percentual/data_prevista/concluida) intocável, `hub_obra_itens` (E2: pct_avanco, datas, peso, frente_id, parent_id, andamento), `hub_obra_frentes_eap` (E0: peso_fisico/peso_financeiro DEFAULT 0). As 4 lentes convergem; vou sintetizar o veredito do CEO/tech-lead com as correções de fidelidade que as âncoras impõem.

## E4 Cronograma + Curva S — design ideal

O E4 cura a falha nº4 da planilha do dono: **% avanço solto sem âncora**. Ele NÃO inventa cronograma novo — adiciona a **baseline** (a foto do plano), liga os **pesos** que já existem (E0) e produz a **Curva S honesta** (previsto×realizado, físico+financeiro) com **reprogramação append-only**. É o que o Portal do Cliente precisa: previsto×realizado sem maquiar.

**Veredito do CEO sobre as 4 lentes:** convergência total no núcleo (3 tabelas novas + view + RPC, append-only, baseline versionada). Adoto a estrutura da lente backend/ai-engineer (tabela de pontos de curva + baseline JSONB) **fundida** com o corte de MVP da lente PO (E4.1 = Curva S física + baseline já cura o medo). Uma correção de fidelidade que as âncoras impõem e nem todas as lentes captaram: **o realizado físico NÃO tem histórico hoje** — `hub_obra_itens.pct_avanco` é "agora", sem série temporal. Sem capturar snapshots, a Curva S realizada teria só o ponto de hoje. Por isso a tabela `hub_obra_avanco_diario` (append-only) é **obrigatória no MVP**, não opcional.

### Modelo (baseline + pesos + Curva S prevista x realizada) + reconciliação

**Princípio inegociável:** ZERO ALTER/DROP em `hub_obras_cronograma`, `hub_obras`, `hub_obra_frentes_eap`, `hub_obra_itens`. E4 lê E0/E2/E6 e **pendura** — dependência unidirecional. E1/E2 nunca dependem de E4.

**3 tabelas novas + 1 view + 2 RPCs** (migração `20260810120000_e4_curva_s_baseline.sql`, marcada "⚠️ NÃO aplicar — janela do dono"):

**1. `hub_obra_baseline` — snapshot append-only (a âncora que faltava)**
```
id, obra_id, tenant_id, versao INT (1,2,3…), rotulo TEXT,
vigente BOOLEAN (só 1 true por obra — UNIQUE INDEX parcial WHERE vigente=true),
baseline_anterior_id UUID (árvore de reprogramações),
motivo TEXT (NOT NULL a partir de versao>1),
tipo_motivo TEXT CHECK IN ('chuva','falta_material','mao_de_obra','projeto','cliente','aditivo_contratual','embargo','outro'),
data_inicio_plan DATE, data_termino_plan DATE,
valor_contrato_plan NUMERIC(14,2),
frentes_snapshot JSONB  -- [{frente_id, disciplina_slug, peso_fisico, peso_financeiro}] congelado
criado_por_id/nome, congelado_em TIMESTAMPTZ, criado_em
UNIQUE(obra_id, versao)
```
Decisão-chave do CEO: **append-only por versão**. Reprogramar cria `versao=N+1` com motivo obrigatório e marca a anterior `vigente=false` — NUNCA UPDATE/DELETE na v1. É exatamente o que torna o Portal do Cliente confiável: a v1 prova o quanto o plano escorregou.

**2. `hub_obra_baseline_pontos` — a curva PREVISTA congelada**
```
id, baseline_id, tenant_id, periodo DATE (1º dia da semana ISO),
granularidade TEXT DEFAULT 'semana' CHECK IN ('semana','mes'),
pct_fisico_plan NUMERIC(5,2), pct_financeiro_plan NUMERIC(5,2), valor_plan NUMERIC(14,2)
UNIQUE(baseline_id, periodo, granularidade)
```

**3. `hub_obra_avanco_diario` — a MEMÓRIA do realizado (obrigatória — pct_avanco não tem histórico)**
```
id, obra_id, tenant_id, data DATE,
pct_fisico_real NUMERIC(5,2), pct_financeiro_real NUMERIC(5,2), valor_realizado NUMERIC(14,2),
origem TEXT CHECK IN ('snapshot_cron','manual','ia','retroativo'),
UNIQUE(obra_id, data)  -- 1 ponto/dia, último ganha no mesmo dia
```

**Pesos: JÁ EXISTEM (E0), E4 só TRAVA o uso.** A Curva S física = `Σ(item.pct_avanco × frente.peso_fisico) / Σ(frente.peso_fisico)`. Como hoje os pesos podem somar ≠100 (E0 nasce DEFAULT 0), o E4 **normaliza na leitura** (divide pela soma real) e mostra selo não-bloqueante "pesos somam 96% — normalizado". Se todos = 0 → degrada para média simples (= comportamento E2 de hoje) com nota honesta "sem pesos — média simples".

**View `vw_hub_obra_curva_s` (`security_invoker=true`):** junta `baseline_pontos` (previsto) × `avanco_diario` (realizado) por período → série previsto×realizado física+financeira. Derivada, nunca gravada (padrão `vw_hub_obra_itens_situacao` do E2). Desvio = `real − plan` (negativo = atraso) como coluna GENERATED.

**RPC 1 `criar_baseline(p_obra_id, p_motivo, p_pontos jsonb)` SECURITY DEFINER:** congela a foto (frentes_snapshot + pontos previstos), marca vigente, swap atômico em transação. Append-only — nunca trigger. `REVOKE public/anon` + `GRANT authenticated/service_role`.

**RPC 2 `atualizar_curva_s_realizada(p_obra_id, p_tenant_id)` SECURITY DEFINER:** upsert do ponto de hoje em `avanco_diario` com `Σ(pct_avanco × peso_fisico)/Σ(peso_fisico)` dos itens E2 raiz (`parent_id IS NULL`, `andamento != 'cancelado'`). Chamada por botão "Atualizar Curva S" + cron diário.

**Reconciliação (como NÃO quebra E1):**
| Bloco | Tabela | E4 faz |
|---|---|---|
| E1 cockpit | `hub_obras_cronograma` | **INTOCÁVEL** — E1 lê, E4 nem toca |
| E2 itens | `hub_obra_itens` (pct_avanco/peso/frente_id) | E4 só **LÊ** via JOIN |
| E0 frentes | `hub_obra_frentes_eap` (peso_fisico/financeiro) | E4 **LÊ e normaliza** |
| E6 pagamento | `hub_obra_pagamentos` | E4 **LÊ** (degrada gracioso se ⌀) |
| E4 NOVO | baseline + baseline_pontos + avanco_diario | escreve só no próprio |

Crítico (precedente do vazamento de 28/jun): **todo endpoint filtra `tenant_id` E `obra_id` explicitamente** — `crmDb()` é service-role e bypassa RLS. View `security_invoker=true` + filtro no endpoint = dupla defesa.

### Telas (Curva S + cronograma + reprogramar) + ASCII

Vive como **5ª aba "Cronograma"** em `app/crm/obras/[id]` (ADITIVA: Hoje·Itens·**Cronograma**·Compras·Financeiro). Tokens dark `--obra-*`/`--brand-*`. **SVG-à-mão** (sem lib de chart — idioma real do projeto: `OfficeCanvas`/`layout.tsx` já fazem polyline/path). Cores fiéis ao seed E0/E2.

**TELA A — CURVA S (o coração; gráfico honesto)**
```
┌─ REF-2026-0004 · Curva S ─────────────── [Física|Financeira][🎤]┐
│ ✨ IA: 6 dias atrás do plano · ritmo cai · término provável     │
│    15/ago (faixa 08–28/ago, confiança 65%)        [Explicar ▸] │
│ 100%┤                              ╭──── Previsto (baseline)    │
│     │                        ╭─────╯      ▒ faixa projeção(cone)│
│  60%┤                 ╭──────╯·····●  realizado (hoje 47%)      │
│     │          ╭─────╯········                                  │
│   0%┼────┬────┬────┬────┬────┬────┬────┬──→                     │
│     mar  abr  mai  jun ◆HOJE jul  ago                           │
│  Previsto hoje 53% · Realizado 47% · DESVIO −6pts 🔴            │
│  [◉ Física] [○ Financeira]  Baseline: v2 (reprog.12/mai) ▾      │
│  △ ver v1 original (tracejada) — quanto o plano escorregou      │
└──────────────────────────────────────────────────────────────────┘
```
Honestidade visual: PREVISTO = linha sólida dourada (`#c9a24a`, baseline vigente). REALIZADO = linha verde sólida (`#22C55E`) até HOJE, **para no hoje** (não inventa futuro). PROJEÇÃO = **cone/faixa pontilhada cinza** (`#484f58`) — nunca linha única dourada (cenário, não promessa; o cone abre com a incerteza). Toggle Física↔Financeira sem recarregar. Desvio em pts + cor (🔴<−5, 🟡−5..−2, 🟢≥−2). Eixo Y fixo 0–100% (sem auto-escala enganosa). Seletor de baseline sobrepõe v1 original tracejada (anti-maquiagem).

**TELA B — CRONOGRAMA POR FRENTE (Gantt de LEITURA, não MS-Project)**
```
┌─ Cronograma por frente ──────────── Agrupar:(◉Frente)(○Andar)┐
│ Σ obra: prev 53% │ real 47% │ −6pts 🔴 │ térm. 15/ago (faixa)│
│ 🔴 Elétrica · peso 9% · prev 70% real 60% −10 🔴 [Reprogramar]│
│   ░░▓▓▓▓▓▓██ início 03/03 → 28/06 (replan 05/07) ⛔ material  │
│ 🟢 Civil · peso 14% · prev 30% real 31% +1 🟢                 │
│   ▓▓▓░░░░ ... no ritmo                                        │
│ ⚠ pesos somam 96% — normalizado [ajustar na EAP ▸]           │
└──────────────────────────────────────────────────────────────┘
```
Decisão do CEO: **NÃO Gantt corporativo** (drag/dependências/caminho crítico violam Click-and-Go e mobile, e são vaidade — o dono gere por % e prazo). Gantt-de-leitura: frente atrasada sobe ao topo; tocar a barra → drawer reprogramar. ░=previsto (trilho fantasma), ▓=realizado, █=hoje. Bolinha = Situação (reusa `COR_SITUACAO` do E2). Mobile: vira lista de cards verticais ("vence 12/jul · −18%").

**TELA C — REPROGRAMAR (Click-and-Go, motivo obrigatório, gate dourado)**
```
┌─ Reprogramar · Elétrica ──────────────────────────── ✕ ┐
│ Isto cria a Baseline v3 — a v2 fica guardada (histórico).│
│ Atual: térm.28/jun · realizado 60% · −18%               │
│ Novo término   [+3d][+1sem][+15d][outro 📅]  ● 13/jul   │
│ Motivo* (chips): ⟨Chuva⟩⟨Falta material●⟩⟨Mão de obra⟩  │
│   ⟨Aditivo escopo⟩⟨Aprovação cliente⟩⟨Embargo⟩⟨Outro🎤⟩ │
│ ✨ IA sugere +9d (ritmo real); você escolheu +7d         │
│ Impacto AO VIVO: Σ térm. 28/set → 05/out (+7d)          │
│ ⚠ Esta frente vira o gargalo do cronograma              │
│ [Cancelar]              [Confirmar reprogramação ★]     │
└──────────────────────────────────────────────────────────┘
```
Gate dourado (reusa `acaoPendente` do `CopilotoVoz`). Motivo é CHIP (catálogo curto, `hub_catalogo` categoria `motivo_reprog`), não texto solto; "Outro"+voz para o raro. "Impacto" recalcula a projeção AO VIVO antes de confirmar. Confirmar = nova versão append-only; toast "Baseline v3 criada, v2 preservada". Sem motivo → `Confirmar` desabilitado (gate bloqueia).

**INTEGRAÇÃO NO COCKPIT (E1) — aditiva, sem tocar a query do E1:**
- Card da carteira ganha micro-selo de tendência "▾−6%" (verm) / "▴+2%" (verde) / "— no prazo". Só com baseline; sem E4 o card fica idêntico ao de hoje.
- "Hoje" ganha linha proativa "📉 3 obras abrindo desvio >5pts [ver Curva S]". Acende só com dados E4. Novo campo `curva_s_resumo` no payload do `/cockpit` (opcional — `null` é ignorado, não quebra E1).
- **Portal do Cliente** (futuro, memória 9/jul): MESMO componente `CurvaSChart` com prop `somenteLeitura` — sem botões reprogramar. É o que cura o medo do cliente.

### IA (prever/explicar desvio, projeção em faixa honesta)

Reusa `CopilotoVoz` + gate dourado. **A matemática roda local** (`lib/obras/curva-s-projecao.ts`, TypeScript puro testável); o Mistral só **interpreta os números prontos** em linguagem natural — o gráfico funciona 100% sem chave Mistral.

**Projeção em FAIXA (honestidade algorítmica):**
```
término = hoje + (trabalho_restante / velocidade)
velocidade em 3 janelas (regressão dos últimos pontos) →
  P90/otimista (média 30d) · P50/provável (média 14d) · P10/pessimista (média 7d se ritmo cai)
confiança cai com poucos pontos: <3 coletas → "dados insuficientes (mín. 2–3 semanas)", NÃO inventa faixa
velocidade ≤0 (parada/regredindo) → "no ritmo atual não converge — ação necessária", NÃO "término: nunca"
```
NUNCA promessa única. Texto da IA: "provável 15/ago, faixa 08–28/ago (confiança 65%)" — cura o medo dando verdade, não otimismo falso.

**3 tools (`rotaObra=true`, seguem padrão E2 `hub_obra_item_*`):**
1. `hub_obra_curva_s_resumo` (LEITURA, auto-executa): "como está a curva S?" → desvio físico+financeiro, baseline vigente, projeção, gargalo_frente.
2. `hub_obra_desvio_explicar` (LEITURA/análise): "por que estou atrasado?" → cruza frentes em desvio + bloqueios E2 (`falta_material`) + reprogramações → "Elétrica −10pts puxa o atraso; material travado desde 18/jun".
3. `hub_obra_reprogramar` (ESCRITA, gate SEMPRE): "remarca pro dia 5, choveu" → card dourado ⟨Elétrica⟩⟨+7d⟩⟨chuva⟩ → Confirma → nova versão. Ambiguidade (qual frente) → chip-picker antes do gate.

Situação/baseline NUNCA escritas por voz sem gate. **Alerta proativo determinístico** (sem IA, no payload do `/cockpit`): `desvio < −15% OU 3 semanas piorando → crítico (banner vermelho)`; `−15..−5% → atenção (chip âmbar)`. Auditoria em `hub_ia_consumo` (padrão existente).

### Implantação aditiva (não quebrar E1) + faseamento

Migração: `supabase/migrations/20260810120000_e4_curva_s_baseline.sql`, marcador "⚠️ NÃO aplicar — janela do dono", padrão E0/E2 (RLS `current_user_tenant_id()`, trigger `hub_atualizar_timestamp()`, RPC SECURITY DEFINER + REVOKE public/anon). **Ordem de apply:** E0 → E2 → E5 → E6 → E4 (timestamps garantem). E4 lê E6 mas degrada se ⌀ → não bloqueia.

- **E4.0 — DADOS (1 sem):** migração (3 tabelas + view + 2 RPCs); `lib/obras/curva-s-projecao.ts` (projeção pura) + `lib/obras/curva-s-alertas.ts` (regras locais). Snapshot diário: começa **on-write debounced** (sem custo de cron); cron Render depois. Gate: SELECT real validando a view nos 7 estados de série.
- **E4.1 — LEITURA física (1 sem) = O MVP QUE CURA O MEDO:** `lib/crm/curva-s-aggregate.ts` (gêmeo de `cockpit-aggregate`: `Promise.all`+`safeCount`+`isMissingPgColumn`); `GET /api/crm/obras/[id]/curva-s`; aba "Cronograma" com TELA A (física) + TELA B + botão "Definir baseline". Degrada: sem baseline → empty-state "Congele a baseline [Congelar agora]"; sem E6 → financeira "chega em breve". **Entrega valor sem Mistral nem E6.**
- **E4.2 — BASELINE + REPROGRAMAÇÃO (3d):** `POST /api/crm/obras/[id]/baseline` (congela/reprograma com gate); TELA C com chips de motivo + seletor v1/v2 sobreposto; histórico visível.
- **E4.3 — FINANCEIRA + IA (3d):** liga curva financeira (lê E6); 3 tools + projeção em faixa + integração no cockpit (sparkline + linha proativa). Acende com chave Mistral.

**Gates por fase:** `tsc 0` + `vitest` (add `curva-s.test.ts`: desvio correto, peso normalizado, projeção em faixa, regressão de avanço, baseline append-only não apaga v1) + `build` + `_chk23` + navegador (desktop+mobile, sem botão quebrado).

**Recomendação soberana do CEO:** cortar o MVP em **E4.1 (Curva S física + baseline)** — é o menor incremento que já antecipa o atraso e já serve o Portal honesto. Financeira+IA são incrementos, não pré-requisitos.

### Reuso x novo · Edge cases

| Reusa (a coluna) | Novo (E4) |
|---|---|
| `hub_obra_frentes_eap` (pesos E0) — só lê/normaliza | `hub_obra_baseline` + `_pontos` + `avanco_diario` |
| `hub_obra_itens` (pct_avanco/peso E2) — só lê | `vw_hub_obra_curva_s` (security_invoker) |
| `hub_obras_cronograma` — **INTOCÁVEL** | `criar_baseline` + `atualizar_curva_s_realizada` (RPC) |
| `hub_obra_pagamentos` (E6) — lê, degrada se ⌀ | `lib/obras/curva-s-projecao.ts` + `curva-s-alertas.ts` |
| `CopilotoVoz`/gate `acaoPendente`/HMAC | 3 tools `hub_obra_curva_*` |
| SVG-à-mão (`OfficeCanvas`), tokens `--obra-*`, `COR_SITUACAO` E2 | `CurvaSChart.tsx` + `CronogramaFrentesGantt.tsx` + `ReprogramarDrawer.tsx` |
| `requireCrmSessao`/`g.ctx.tenantId`/`isMissingPgColumn` | 4 endpoints `/api/crm/obras/[id]/curva-s*` |

**Edge cases (todos honestos, nada bloqueia E1/E2/E3):**
- **Obra sem baseline (estado inicial de TODA obra):** não inventa previsto fantasma. Mostra só a linha realizada (do E2, valor parcial desde o dia 1) + empty-state "Congele a baseline contratual [Congelar agora]". Nunca gráfico vazio que parece bug.
- **Avanço que regride (retrabalho/correção):** `pct_avanco` PODE cair — é a verdade. `avanco_diario` append-only guarda o pico e a queda. Marca ▼ âmbar + tooltip; IA sinaliza "avanço regrediu Elétrica −15pts [investigar]" como alerta, não erro. Nenhum CHECK de monotonia.
- **Pesos somando ≠100:** normaliza na leitura (`Σ/soma real`); selo não-bloqueante. Todos = 0 → média simples com nota "sem pesos". Nunca finge ponderação que não existe.
- **Reprogramação em cadeia (v5, v6…):** `baseline_anterior_id` forma árvore; UNIQUE parcial garante 1 vigente; RPC faz swap atômico. Seletor colapsa "ver histórico (6 versões)"; IA pode dizer "obra reprogramada 5x — padrão de planejamento otimista".
- **Sem E6/financeiro:** curva financeira "chega em breve" (cinza, NÃO erro); física funciona 100% sozinha; toggle Financeira desabilitado com tooltip.
- **Sem E2/itens:** realizada sem pontos → "Adicione itens na aba Itens para a Curva S nascer". Distingue "sem dado" de "0%".
- **Desvio positivo (adiantado):** verde "+X%"; IA comenta "adiantado, mas valide se o avanço tem evidência de campo" (nunca celebra sem ressalva — risco de avanço superestimado).
- **<3 coletas:** "dados insuficientes para projetar (mín. 2–3 semanas)". Nunca inventa faixa nem data otimista mentirosa.
- **Item/frente cancelado:** sai do numerador E do denominador (alinhado ao E2, fiel à planilha que separa "Cancelado"). Flag do dono se encolhe o denominador (default: excluído de ambos).
- **Cross-tenant (CRÍTICO):** endpoint filtra `tenant_id`+`obra_id` explícito + view `security_invoker=true` (dupla defesa, precedente 28/jun).
- **E0 não aplicada (sem frentes/pesos):** degrada para média de `hub_obras_cronograma.percentual` com nota "cronograma simples (sem EAP ponderada)". Nunca quebra.

**Precisa da janela do dono (travas):** (1) aplicar a migração E4 (banco prod); (2) flag — snapshot por cron ou só on-write (recomendo on-write no MVP, sem custo); (3) flag — granularidade da baseline (recomendo semana <6 meses, mês em obras longas); (4) flag — linear vs S-curve na curva prevista (recomendo linear em E4.0, S-curve opção em E4.1, validar com a obra do Consulado); (5) chave Mistral p/ E4.3; (6) validar a projeção em faixa ao vivo com obra real. **Nada foi editado — design-only.** Documentos reais lidos: `docs/E1-DESIGN.md`, `docs/E2-DESIGN.md`, `docs/insumos-do-dono/ANALISE-planilha-gestao-obra.md`, `docs/PLANO-BLOCOS-ARQ-ENG.md`.