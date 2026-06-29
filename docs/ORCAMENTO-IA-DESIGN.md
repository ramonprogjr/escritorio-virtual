# Orcamento IA (memorial descritivo -> planilha executiva) — Design + implantacao (mesa redonda)

Confirmado o estado real. Achados decisivos:

1. **E6 NÃO está migrado** (`hub_obra_orcamentos`/`_itens` não existem em nenhuma migração — só em E6-DESIGN.md). As duas lentes que assumem "ADD COLUMN em hub_obra_orcamento_itens" estão erradas sobre a precedência.
2. **`hub_catalogo` existe** mas o CHECK de categoria NÃO inclui `'atividade'` nem `'ambiente'` (só disciplina/material/servico/equipamento/mao_de_obra/area_andar). A taxonomia-fundação realmente não existe.
3. **`hub_fornecedor_catalogo` NÃO existe na migração E5** (E5 migrou `hub_pedido_itens`+`hub_estoque_mov`, com cotações em `cotacoes_json`). É design do marketplace, não migrado.
4. **O chão de código existe**: `lib/hub/rag.ts`, `lib/ia/llm-completion.ts`, `lib/playbook/gerar-fluxo-ia.ts`, `lib/ia/metering.ts`, `lib/ia/engine.ts` — todos reais.

Isso muda a precedência do plano. Consolido o design fiel ao dono e ao código real, corrigindo as suposições das lentes.

---

## Orçamento IA (memorial → planilha) — design ideal

Visão do dono (textual, insumo 29/jun): a IA pega o memorial descritivo PDF, **classifica** na taxonomia ambiente→disciplina→atividade (não extrai texto livre), precifica do catálogo de fornecedores, monta a planilha executiva/custos/financeira. Auditável: cada linha = atividade-padrão + preço rastreável + humano aprova. **Contraponto aceito pelo dono:** quantidade quase nunca está no memorial ("tomadas conforme projeto") → vem da planta. Faseamento: **v1** IA monta estrutura+descritivo+preço, humano confirma quantidades; **v2** IA lê a planta; **norte** 100% sozinha.

### Pipeline (PDF→classificar→quantidade→precificar→orçamento)

```
[1] PDF memorial ──upload──> Storage
        │
[2] EXTRAI TEXTO    REUSA lib/hub/rag.ts (PDF→texto local; já detecta scan)
        │           edge scan/imagem → ragErroPdfSemTexto() → avisa honesto (OCR=v2)
        ▼  markdown
[3] IA CLASSIFICA   REUSA o molde lib/playbook/gerar-fluxo-ia.ts (2 fases + parse/
    NA TAXONOMIA    validate + auto-fix 2x + fallback) via completarChatPreferindoMistral
        │           Fase A: segmenta memorial → ambiente>disciplina (temp~0.3)
        │           Fase B: classifica cada item → atividade_codigo da taxonomia (temp 0)
        │           Vocabulário controlado = hub_catalogo categoria='atividade' no system prompt
        │           Saída JSON: {ambiente, disciplina, atividade_codigo, descritivo,
        │             quantidade|null, confianca_class, confianca_qtd, trecho_fonte, flag_revisar}
        ▼
[4] QUANTIDADE      número explícito no texto → origem='memorial'
        │           "conforme projeto"/ausente → null, flag CONFIRMAR (caminho ESPERADO da v1)
        │           IA pode propor palpite (confiança ≤0.50) mas linha fica 🟡 até toque humano
        ▼
[5] PRECIFICA       (determinístico, sem LLM)
        │           atividade → preço do catálogo de fornecedor (marketplace)
        │           sem preço → preco_status='sem_preco', valor=null, badge "a cotar" + CTA [Cotar]→SC
        ▼
[6] GRAVA ORÇAMENTO (E6)  status='rascunho', origem='ia_memorial'
        │           cada item: confianca_ia, flag_revisar, trecho_memorial, catalogo_id,
        │           fornecedor_id, preco_status  (rastro ponta-a-ponta)
        │           registrarConsumoIA (origem='orcamento_ia') — metering de tokens
        ▼
[7] TELA "A IA MONTOU ASSIM, confirme"  (human-in-the-loop, Click-and-Go)
```

**LLM:** uma chamada de classificação (memorial médio = 30–80 itens, maxTokens ~4096, JSON mode, temp 0 — é classificação, não criação). Memorial grande → chunk por ambiente (o RAG já limita MAX_CHUNKS). O insight do dono está correto e é o que torna o problema tratável: a taxonomia serializada no system prompt transforma extração-livre (impreciso) em classificação (preciso, auditável).

### Human-in-the-loop (confirmar quantidades) + confiança por linha

A IA **nunca** aprova o orçamento — espelha o gate de dinheiro do E5/E6. A IA monta o rascunho; o humano confirma qtd e aprova. Semáforo por linha:

| Estado | Regra | Cor | Ação humana |
|---|---|---|---|
| Pronto | class ≥0.85 **e** qtd do memorial **e** tem preço | 🟢 | revisar por amostragem; "confirmar lote" |
| Verificar | class 0.60–0.84 **ou** qtd inferida fraca | 🟡 | confirmar 1 toque (stepper) |
| Confirmar qtd | quantidade ausente ("conforme projeto") | 🟡 | preencher stepper (foco automático) |
| Sem preço | nenhum fornecedor cotou | 🔴 | [Cotar] / [definir preço] / [pular] |
| Fora da taxonomia | atividade_codigo=NAO_MAPEADO | ⚪ | classificar via chips / cadastrar atividade |

Regras de produto: linhas que exigem ação ficam no topo; o filtro abre em "Confirmar qtd" (o trabalho real, não "Tudo"); **o botão "Gerar orçamento" fica travado enquanto houver linha sem qtd ou 🔴 sem decisão** — nunca fecha orçamento com quantidade NULL. Voz no fim: "confirma 12 tomadas na sala" preenche o stepper, mas o CONFIRMAR continua sendo toque.

### Auditabilidade (rastro memorial→item→preço)

Cada `hub_obra_orcamento_itens` guarda o rastro de 3 saltos: **memorial (trecho + página) → atividade-padrão (taxonomia) → preço (catalogo_id/fornecedor_id + data)**. Clicar no ⓘ da linha abre o trecho exato do PDF que a gerou, com highlight, + a decomposição "como a IA entendeu". Append-only, nada se perde; re-rodar gera nova versão (não sobrescreve aprovado). É o "somos juízes" tornado tangível — nada de caixa-preta.

### Tela "A IA montou assim, confirme" + ASCII

Vive numa aba **"Orçamento IA"** em `/crm/obras/[id]` (espelha `ObraComprasEstoqueSecao.tsx`, tokens `--obra-*` dark verde+dourado, zero CSS novo). Três momentos: porta (dropzone + progresso 4-passos honesto), revisão (árvore), rastro (ⓘ).

```
┌─ A IA montou assim · confirme ──── 🔒 ADMINISTRAÇÃO · livro aberto ─┐
│ ✨ 47 atividades em 6 ambientes · R$284k (12 itens s/ qtd = R$ —)   │
│ ┌──────────┬───────────┬──────────┬─────────────┐                  │
│ │31 prontas│ 8 confirmar│ 2 s/preço│ 1 fora taxon│  ← baldes=triagem │
│ │  🟢 79%  │  🟡 qtd    │  🔴      │  ⚪          │     clicáveis     │
│ └──────────┴───────────┴──────────┴─────────────┘                  │
│ [Tudo][🟡 Confirmar qtd 8][🔴 Sem preço 2][⚪ Revisar 1]  🔎       │
│                                                                     │
│ ▾ SALA · ELÉTRICA                                                   │
│   🟢 Tomada 2P+T 1,10m         qtd 24 un × R$38 = R$912  IA94% ⓘ   │
│   🟡 Tomada 2P+T 0,30m   "memorial: 'conforme projeto'"     ✨     │
│       qtd [− 12 +] un × R$38 = R$456   ⓘ ver trecho ›  [Confirmar✓]│
│   🔴 Spot LED 7W         qtd 8 × R$?  "nenhum fornecedor cotou"     │
│       [✨ Pedir cotação] [Definir preço] [Pular]                    │
│ ▸ COZINHA (9 · R$210k) 🟢🟡          ▸ HIDRÁULICA (4) 🟢            │
│                                                                     │
│ ⚠ Aprovar gera o orçamento (E6). É ato HUMANO. A IA só prepara.    │
│ [Salvar rascunho]  [Confirmar 8 qtd]  [Gerar orçamento ▸](travado  │
│                                          até qtd/preço resolvidos)  │
└─────────────────────────────────────────────────────────────────────┘
```

Rastro (clicar ⓘ): bottom-sheet com trecho do memorial em highlight (pág. 4) + "como a IA entendeu" (ambiente/disciplina/atividade/qtd=conforme projeto🟡/preço FerreMax 3d) + [Discordo]/[Está certo✓] — o feedback ensina a taxonomia (loop v3).

### PLANO DE IMPLANTAÇÃO + FASEAMENTO

**Precedência dura (corrige as lentes — verifiquei o código):** E6 e o marketplace **não estão migrados** (não existe `hub_obra_orcamentos` nem `hub_fornecedor_catalogo` em `supabase/migrations/`; só em DESIGN.md). O catálogo existe mas **sem categoria `'atividade'`**. Logo, a ordem obrigatória é: **aplicar E6** (destino) → **aplicar marketplace/`hub_fornecedor_catalogo`** (preço) → **FASE 0 taxonomia** → pipeline. Todas as migrações são da "janela do dono".

**FASE 0 — TAXONOMIA (fundação; baixo esforço, alto impacto; precisa do dono):**
- Migração aditiva: `hub_catalogo` DROP+ADD do CHECK adicionando `'atividade'` (e decidir `'ambiente'` vs reuso de `'area_andar'` — **pendência p/ o dono**) + colunas `descricao_padrao`, `unidade_padrao`, `quantidade_tipica`, `palavras_chave[]`, `disciplina_slug` (já existe).
- Seed de ~40–80 atividades por disciplina com descritivo padrão (elétrica: tomada 1,10m / 0,30m / dados-voz / iluminação LED; civil/revest/pintura/hidráulica…). **Ativo estratégico: a lista real vem do dono** (eng. civil; a planilha do Consulado Itália — 20 abas — já tem o vocabulário). Sem seed, a IA classifica no vazio → bloqueante de PRONTO.
- Presets por segmento (residencial/comercial/clínica/PDV) reusando `hub_eap_presets` (`frentes_json` já existe); v1 começa com residencial+comercial.

**FASE 1 — PIPELINE v1 (estrutura+descritivo+preço; humano confirma qtd):**
- Migração aditiva nas tabelas do E6 (após E6 migrado): 4 colunas em `hub_obra_orcamentos` (`origem`, `memorial_texto`, `memorial_nome`, `confianca_geral`) + colunas de rastro em `hub_obra_orcamento_itens` (`confianca_ia`, `flag_revisar`, `trecho_memorial`, `atividade_codigo`, `quantidade_ausente`, `preco_status`, `catalogo_id`, `fornecedor_id`).
- `lib/orcamento/classificar-memorial.ts` no molde exato de `gerar-fluxo-ia.ts` (2 fases + auto-fix 2x + fallback → estrutura editável vazia se IA falhar, profissional nunca trava).
- Extração: reusa `lib/hub/rag.ts`. Precificação: `lib/orcamento/precificar.ts` (atividade→preço do marketplace; sem preço→null+flag). Metering: `registrarConsumoIA` (candidato a feature paga — alinha com créditos de IA).
- Endpoints: `POST /api/crm/obras/[id]/orcamento-ia/gerar`, `GET .../revisao`, `PATCH .../item/[iid]/confirmar`, `POST .../aprovar` (abre o gate duplo do E6 / `hub_aprovacoes`). Auth `requireCrmSessao` + `.eq('tenant_id')` puro; `isMissingPgColumn` → 503 `migracao_pendente` se E6 ausente (degrada, não quebra).

**FASE 2 — TELA (`components/crm/obras/OrcamentoIaSecao.tsx`):** dropzone+progresso 4-passos, árvore com semáforo, steppers ≥56px, filtros por balde, rastro ⓘ, gate dourado sticky. Verificar no navegador (Playwright desktop 1280 + mobile 390). Gates tsc+vitest+_chk23.

**FASE 3 — calibração com o memorial real do Consulado** (mapear NAO_MAPEADO → enriquecer taxonomia; confirmar cobertura de preços).

**v2 (planta→quantidade):** a MESMA tela; linhas 🟡 passam a vir pré-preenchidas com badge "✨ qtd lida da planta · confira". O desenho não muda — prova que a tela v1 já é a final. **Norte:** classificador aprende com o feedback humano + calibra preços por histórico.

### Reuso · Edge cases

**Reuso (verificado no código real):** `lib/hub/rag.ts` (PDF→texto, já detecta scan) · `lib/playbook/gerar-fluxo-ia.ts` (molde 2-fases+auto-fix+fallback) · `lib/ia/llm-completion.ts` `completarChatPreferindoMistral` (Mistral-first/Anthropic fallback) · `lib/ia/metering.ts` `registrarConsumoIA` · `hub_catalogo` (taxonomia, já existe) · `hub_eap_presets` (`frentes_json`) · `requireCrmSessao`/`crmDb`/`isMissingPgColumn` · padrão visual `ObraComprasEstoqueSecao.tsx` + tokens `--obra-*` + barra "IA X%" de `/crm/aprovacoes`. **A construir:** E6 e `hub_fornecedor_catalogo` (não existem ainda), categoria `'atividade'` + seed, pipeline `lib/orcamento/*`, endpoints, `OrcamentoIaSecao.tsx`.

**Edge cases (todos com saída, nunca trava):**
- **PDF scan/imagem** → `ragErroPdfSemTexto` detecta → "PDF digitalizado, confirme manual / OCR é v2" + textarea de memorial manual.
- **Memorial ruim/incompleto** → classifica o que reconhece, banner honesto "leu só parte (18 de ~50 esperados)" + [adicionar atividade]; nunca alucina item ausente.
- **Atividade fora da taxonomia** → NAO_MAPEADO + chips de sugestão + [cadastrar atividade] (ensina a taxonomia); nunca descarta.
- **Sem preço de fornecedor** → preco_status='sem_preco', valor null, [Cotar]→SC; total mostra "R$X + N itens sem preço", nunca total falso.
- **Quantidade ausente** → o caso CENTRAL e ESPERADO da v1; 🟡 com a frase citada + stepper foco-automático; orçamento não fecha com qtd NULL.
- **JSON inválido do LLM** → extrai bloco ```json``` → re-prompt 2x → fallback estrutura editável.
- **MISTRAL_API_KEY ausente** → fallback Anthropic; se ambos faltam → "IA indisponível, crie manual" (modo determinístico funciona sem IA).
- **Memorial gigante** → chunk por ambiente (RAG MAX_CHUNKS) + progresso "montando 60%".
- **Duplo envio / re-leitura** → idempotente: abre rascunho existente ("já leu em 28/jun · [continuar]/[refazer]"); re-rodar = nova versão, não sobrescreve aprovado.
- **E6/marketplace não migrados** → `isMissingPgColumn` → 503; aba mostra "Orçamento IA chega quando o financeiro for ativado"; zero quebra.
- **Multi-tenant** → `.eq('tenant_id')` puro em todo endpoint; taxonomia global (tenant NULL) + atividades do tenant; RPC SECURITY DEFINER com guard de tenant como 1ª operação.

---

**Pendências para o dono (decisões, não inventadas):** (1) a **lista real de atividades+descritivos por disciplina** — o ativo estratégico do seed (vem da planilha do Consulado); (2) `'ambiente'` como categoria nova vs reuso de `'area_andar'`; (3) Orçamento IA como **feature paga** (créditos/Tijolos), dado o custo de token; (4) **janela para aplicar E6 + marketplace ANTES** (hoje só existem como DESIGN.md — esta é a correção mais importante às lentes, que assumiam ambos migrados).

**Honestidade:** nada foi editado — é desenho + plano. Verifiquei no código real que E6 e `hub_fornecedor_catalogo` **não estão migrados** e que `hub_catalogo` **não tem** categoria `'atividade'`; corrigi a precedência das lentes em cima desses fatos. A precisão da IA em v1 (classificação por taxonomia) é alta por construção, mas só se confirma testando com o memorial real do Consulado (Fase 3).