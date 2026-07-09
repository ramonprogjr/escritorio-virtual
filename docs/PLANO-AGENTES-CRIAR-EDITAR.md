# 🤖 Plano — Criar & Editar TODOS os agentes IA (cirúrgico, faseado)

> Fonte: laudo Fable-max 09/jul (4 designs independentes → júri → síntese). Escopo = **todos os tipos** de agente
> (atendimento/WhatsApp, copiloto interno, obra, arquitetura, financeiro), **criar E editar** — o de atendimento foi
> só o exemplo do dono. Espinha da **concatenação da IA** (ver [00-PAINEL — A ESPINHA](00-PAINEL-DE-CONTROLE.md)).
> Disciplina: **cirúrgico, aditivo, motor WhatsApp intocado, IA nunca auto-aplica, migração só na janela.**

## A visão (uma experiência, duas portas, uma verdade)

**CRIAR** — porta principal **"Criar com IA — descreva seu agente"** (voz/texto/PDF/DOCX): a IA devolve um **blueprint
validado no servidor** contra os catálogos reais (`/api/hub/cargos` casa cargo→setor_ia→ferramentas; `agente-ferramentas-registry`
é a única fonte de ids — id inexistente é descartado com aviso, nunca persiste). Interno é o **default**; `canal_whatsapp`
só se a descrição fala de atendimento. Revisão em **cards por capacidade** (ajuste por conversa re-gera só o card afetado;
fluxo em preview read-only só p/ atendimento; conexão UAZAPI "agora/depois", nunca bloqueia) → 1 clique cria pelo **mesmo
payload do wizard** (lib pura, teste de paridade) e publica com o **publicar-1-clique** já feito. Porta secundária: o wizard
atual + **passo-0 humano** "O que este agente vai fazer?".

**EDITAR** — a ficha `/crm/agentes/[slug]` vira **pilha de seções-cards** montada por um registry declarativo `aplicaA(agente)`:
todos veem Identidade · Instruções · Conhecimento · Ferramentas; **atendimento soma** Canal WhatsApp · Fluxo da Conversa ·
Acompanhamento. Cada seção **salva sozinha** (PATCH parcial). Instruções simples por padrão, markdown cru em "Avançado ▸".

**VERDADE** — farol `AgenteEstadoVivoCard` no topo (ficha + fim do wizard) lendo as **mesmas funções do runtime**:
atendimento = Ativo · WhatsApp conectado · Fluxo válido · **Roteamento RODA?** (expõe o buraco Mari-only por env, hoje
invisível) · N conversas ativas; interno = Ativo · Modelo · Ferramentas · Conhecimento.

**SEGURANÇA** — nenhuma mudança da IA se aplica sem **diff antes→depois + confirmação + desfazer** (badge AO VIVO);
instrução/fluxo ganham **rascunho→prévia (simulador tap-a-tap)→publicar (diff humano)→reverter** na fase de janela.

## As 10 fases (impacto alto + risco baixo primeiro)

| # | Fase | Esf | Impacto | Risco | O quê (resumo) |
|---|------|-----|---------|-------|----------------|
| **F1** | **Verdade visível** | M | alto | **baixo** | GET `estado-runtime` read-only (compõe `agenteUsaPlaybookMaria` + `resolverRoteamentoPlaybookAgente` + `validatePlaybookFlowDefinition` + snapshot UAZAPI + count leads `wa_playbook_active`) + `AgenteEstadoVivoCard` (luzes por tipo) numa inserção única na ficha (~l.652). Banner âmbar honesto quando fluxo publicado NÃO roteia. Deep-links Follow-up/Ciclos. **Zero escrita, motor intocado, fail-open.** |
| **F2** | Fluxo a 1 clique | P | alto | baixo | Flag `playbookFlowVisualSideover` default ON (kill-switch por env mantido). Card `SecaoFluxoConversa` (resumo + badge "Rodando no WhatsApp" + "Editar fluxo" abre React Flow direto). 7-9 cliques → ≤2. |
| **F3** | Documento→instrução | M | alto | baixo | Lib `documento-para-instrucao` reusa `extrairTextoDocumentoRag` (PDF+DOCX); upload de calibração e wizard aceitam **PDF/DOCX com PREVIEW confirmável** antes de salvar (nunca sobrescreve sem confirmar; guarda do Regenerar intacta). |
| **F4** | Ficha adaptada por tipo | M | médio | baixo | `agente-secoes-registry` declarativo (`aplicaA`). Extrai as 2 seções de menor risco (Conhecimento, Acompanhamento). Rótulos UAZAPI traduzidos + "Detalhes técnicos ▸". **Strangler: 1 seção = 1 commit**, estado migra p/ dentro da seção. |
| **F5** | Extração pura do payload de criação | P | médio | baixo | Extrai a montagem do payload do wizard p/ **lib pura** + teste de **paridade** (3 perfis). Habilitador da F6. |
| **F6** | **Criar com IA (o diamante)** | G | alto | médio | `agente-blueprint` (schema + prompt provider-trocável + **validação servidor** contra catálogos) + rota + página `novo-ia` (input-trio voz/texto/doc) + `AgenteBlueprintPreview` (revisão em cards). Botão principal vira "Criar com IA". Rate-limit + metering. |
| **F7** | Passo-0 humano + prontidão | M | médio | baixo | "O que este agente vai fazer?" (6 cards humanos derivam modo/setor/cargo; modelo→avançado). Passo final embute o farol (F1). Atendimento **nasce pausado**; interno nasce ativo. |
| **F8** | Ajustar por conversa (diff) | G | médio | médio | Rota `ajuste-por-ia`: pedido PT → **DIFF tipado** só p/ campos simples (identidade/horário/tom/toggles/conhecimento). **Fluxo por conversa fica FORA** (resposta honesta + link). Snapshot + Desfazer. Aplica pelos PUTs existentes. |
| **F9** | Rascunho→prévia→publicar→reverter + roteamento generalizado | G | alto | médio | **JANELA DO DONO.** Migração aditiva (`playbook_draft_*`, `playbook_flow_roteamento` default 'auto' = Mari byte a byte). Save grava draft; publicar/reverter atômicos; prévia tap-a-tap; diff humano. Envelope null-safe = **único toque** em `playbook-flow-maria.ts`. Rollout 9a (exibe) → 9b (toggle c/ confirmação). |
| **F10** | Mídia de 1ª classe no fluxo | M | médio | médio | Galeria do bucket `playbook-media` nos nós já suportados (send_document/send_audio). Imagem/vídeo **só com spike validado em sandbox** (o engine é o que atende a Mari). |

**Primeiro passo (fazer agora):** F1 — `GET /api/hub/agentes/[slug]/estado-runtime` + `AgenteEstadoVivoCard`.
Passo unânime nos 4 designs e no júri, **risco ~zero** (nenhuma rota de escrita, motor intocado, sem flag, sem migração),
e destrava o resto: expõe o buraco mais perigoso (fluxo publicado que NÃO roda por env Mari-only, falhando em silêncio).

## NÃO FAZER (travas)
- **Não tocar** `lib/whatsapp/*` (engine/webhook) até a F9 — e lá só envelope null-safe com default 'auto' (Mari byte a byte).
- **Não** refazer o já-corrigido (publicar-1-clique, guarda do Regenerar) — usar como está.
- **Não** big-bang no god-file (page.tsx 1790 l.) nem no wizard (3896 l.): só strangler, 1 seção = 1 commit, tsc+vitest verdes.
- **IA não auto-aplica nada**: sempre diff + confirmação + desfazer (cliente real AO VIVO).
- **Não** começar por "editar FLUXO por conversa" (motor mais difícil): fica fora da F8.
- **Não** adicionar imagem/vídeo ao engine sem spike em sandbox — galeria (PDF/áudio) primeiro.
- **Não** migrar fora da janela do dono; código novo roda null-safe com coluna ausente.
- **Não** remover o wizard nem o markdown cru: viram fallback / "Avançado ▸".
- **Não** criar rota de ESCRITA para campo que já tem PUT: diff aplica pelos existentes; rotas novas só leitura/geração.
- **Não** mudar o default do roteamento Mari-only até a F9b (até lá só EXIBE a verdade).
- **Não** vender o resumo-IA da instrução como fonte de verdade: o que RODA é o markdown cru ("Ver texto completo ▸").
