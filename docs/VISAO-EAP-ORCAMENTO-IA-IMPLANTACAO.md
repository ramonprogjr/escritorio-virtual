# A VISÃO + a IMPLANTAÇÃO — EAP-taxonomia + Orçamento IA (síntese do CEO)

> Síntese das 2 mesas (EAP refinada + Orçamento IA) na minha visão de produto + o plano concreto de implantação, sobre o que já está no ar. Designs detalhados: `docs/EAP-REFINADA-DESIGN.md` + `docs/ORCAMENTO-IA-DESIGN.md`.

## A VISÃO — o que isso É (e por que muda o jogo)
Com a EAP refinada + o Orçamento IA, o sistema **deixa de ser "gestão de obra" e vira "a obra se orça e se planeja sozinha — e você audita".**
- **Entra:** um memorial descritivo (PDF). **Sai:** a planilha executiva, de custos e financeira — estruturada por ambiente→disciplina→atividade, precificada pelos fornecedores, **auditável linha a linha.**
- É a **convergência de tudo que construímos:** a EAP (estrutura) + a taxonomia (vocabulário) + o catálogo/fornecedor (preço) + o E6 (orçamento) + a engine de IA. Ninguém copia isso sem ter o cérebro completo da obra.

**Os 2 fossos (por que funciona):**
1. **A taxonomia controlada** transforma "extrair texto livre" (impreciso, não-confiável) em **"classificar"** (preciso, fechado, auditável). Foi o seu insight — e é o que torna a IA confiável aqui.
2. **O rastro de 3 saltos** (memorial→atividade-padrão→preço de fornecedor) torna o **"somos juízes" tangível**: clica na linha, vê o trecho exato do PDF que a gerou. Zero caixa-preta. Cura o medo de ser enganado na origem do orçamento.

**A honestidade do faseamento:** a quantidade quase nunca está no memorial ("tomadas conforme projeto") — vem da planta. Então a v1 não promete mágica: **a IA monta a estrutura + descritivo + preço; o humano confirma as quantidades** (1 toque, Click-and-Go). Já é horas→minutos. A v2 lê a planta. O norte é 100% sozinha — mas a v1 já é o diferencial, e é honesta.

## A IMPLANTAÇÃO — sequência concreta (sobre o que já está no ar)
A mesa do Orçamento descobriu a **precedência real** (E6 e o catálogo de fornecedor ainda são só-design). Então:

### Fase 0 — EAP-taxonomia (ADITIVO sobre E0/E2 — pode começar JÁ, não depende de nada)
Um bloco novo, 100% aditivo (nada quebra; refino opt-in por obra nova):
- Tabela **`hub_obra_taxonomia`** (atividade canônica + sinônimos + descritivo padrão + FTS p/ a IA) + seed das atividades (começar pela **Elétrica** do seu exemplo, depois as outras disciplinas).
- Colunas nullable: `hub_obras.segmento`, `hub_obra_itens.ambiente` + `taxonomia_id`, `hub_obra_frentes_eap.tipo_no` (default 'frente' = tudo no ar intacto), `hub_eap_presets.segmento`.
- **5 presets por segmento** (residencial/comercial/corporativo/clínicas/PDV) com ambientes + atividades-default.
- UI: 3º eixo **Ambiente** no toggle do cockpit/EAP (ambiente-first "na sala, o que tem").
→ Já melhora a EAP **e** prepara o terreno da IA. **É o próximo bloco construível** (chamo de **E0.5 / EAP-taxonomia**).

### Fase 1 — os pré-requisitos do Orçamento IA (o destino e o preço)
- **E6 financeiro+escrow** (já desenhado) — o **destino** do orçamento gerado. Pré-req: o fix do vazamento `lib/ia/aprovacoes.ts`.
- **Marketplace fundação** (`hub_fornecedor_catalogo` com preço) — a **fonte de preço**. (E5 já deu a base; isto é o próximo degrau do marketplace.)

### Fase 2 — o pipeline Orçamento IA (a capability-mãe)
Reusa o que já existe: `lib/hub/rag.ts` (PDF→texto, já detecta scan) + o molde `lib/playbook/gerar-fluxo-ia.ts` (classificação 2 fases + auto-fix + fallback) + `metering` (tokens). Pipeline: PDF → classifica na taxonomia → quantidade (memorial ou flag-confirmar) → precifica do catálogo → grava orçamento E6 (origem='ia_memorial') → tela **"A IA montou assim, confirme"** (semáforo por linha; "Gerar orçamento" travado enquanto houver qtd nula/sem-preço; **humano aprova**).
- **v1:** estrutura+descritivo+preço, humano confirma qtd. **v2:** IA lê a planta. **Norte:** 100% sozinha.

## Sequência no MASTERPLAN
`...E5(no ar) → **E0.5 EAP-taxonomia** (aditivo, já) → E6+escrow → marketplace-preço → **Orçamento IA** (v1) → v2 planta`.
Acende pleno com a chave **Mistral** (sem ela, tudo funciona manual). A taxonomia (descritivo padrão) é o **ativo estratégico** — quanto mais rica, melhor a IA; vale o dono/equipe curarem.

## Decisão do CEO
**Endosso e recomendo construir nesta ordem.** A Fase 0 (EAP-taxonomia) eu posso começar já — é aditiva, não depende de você nem de migração aplicada, e destrava tanto a visualização ambiente-first quanto o Orçamento IA. O resto pluga na sequência do masterplan. **É a feature que vira o jogo do produto.**
