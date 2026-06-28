# Editor visual de fluxo do playbook — DESIGN (mesa de investigação 28/jun)

> Origem: o dono pediu o fluxo visual estilo n8n (gerado do playbook, ajuste fino de mensagens, IA+voz). Investigação (4 leitores + arquiteto) descobriu que **a feature já existe no código**, só está desligada em produção. Diretriz de produto do dono: **a IA CRIA, o humano AJUSTA; simples a ponto de uma criança de 5 anos usar; ajustável > construível.**

## Achado-chave
**Nada foi removido.** Editor visual de fluxo por nós 100% presente (commit `b527bc8`, 03/jun), intacto após a reorganização do wizard. **Está oculto em produção** pela flag `NEXT_PUBLIC_CRM_PLAYBOOK_FLOW_VISUAL_SIDEOVER` (default `true` só em dev, `false` em prod; não declarada no render.yaml). Caminho: Ficha do agente → "Playbook — Calibração" → "Editar fluxo visual" (flag) → `PlaybookFlowVisualSideover` → `PlaybookFlowReactFlowPanel` → `FlowCanvas` (`@xyflow/react`, 919 linhas).

## O que JÁ existe (reusar, não reescrever)
- **Modelo de dados:** `PlaybookFlowDefinition` (bloco JSON `obra10_playbook_flow` embutido no markdown do playbook; sem tabela nova). 4 tipos de nó: `message`, `input`, `menu` (múltipla escolha: list/button/text), `complete`.
- **Geração IA (o "a IA cria"):** `lib/playbook/gerar-fluxo-ia.ts` → `gerarPlaybookViaIa()` — Mistral 2 fases (regras → fluxo JSON), auto-fix, escala p/ claude-sonnet na 3ª. **Já gera o fluxo do texto/PDF.** (Precisa da MISTRAL_API_KEY.)
- **Canvas:** `FlowCanvas.tsx` (919) + `FlowCustomNodes.tsx` (672) — auto-layout, drag-conectar, inspector lateral, minimap. Camadas de conversão Definition↔Visual↔ReactFlow prontas.
- **Round-trip seguro:** `upsertPlaybookFlowBlockInMarkdown()` regrava só o bloco JSON (preserva o texto); `compilePlaybookFlowToEngine()` compila p/ o runtime WhatsApp.

## Gaps reais (não regressão)
1. **Flag desligada em prod** (Fase 0).
2. **Wizard não auto-gera** o bloco de fluxo na criação → "Bloco não encontrado" (Fase 1; precisa chave).
3. **Cores fora da marca** no canvas (azul #9ecbff / navy #0b1425) (Fase 2).
4. **Separação de mensagens** (split em bolhas) — o motor concatena `send_text` (Fase 3).
5. **PDF e áudio outbound** não existem como nó/runtime (Fase 4; depende de endpoints UAZAPI).
6. **IA/voz editar nós** — copiloto não tem ferramenta de editar fluxo (Fases 5–6; precisa chave).

## Plano faseado
- **Fase 0 (1h, zero risco, SEM chave):** ligar a flag no render.yaml → editor aparece.
- **Fase 1 (SEM chave o plumbing; geração precisa chave):** wizard chama gerar-por-ia na criação + botão "Gerar fluxo agora" quando faltar bloco.
- **Fase 2 (SEM chave):** cores na marca verde+dourado.
- **Fase 3 (SEM chave):** separação de mensagens (bolhas + delay).
- **Fase 4 (SEM chave o editor/runtime; precisa confirmar UAZAPI):** nós de PDF e áudio + `uazapiSendDocument()`/`uazapiSendAudio()`.
- **Fase 5 (precisa chave):** editar nó por instrução de IA (`/playbook/editar-fluxo-ia`).
- **Fase 6 (precisa chave):** copiloto de voz edita nós (`hub_editar_fluxo_passo` + `applyVoicePatch`).

## Diretriz de simplicidade (refino do dono — aplicar)
O canvas atual é "n8n-ish" (arrasta-conecta). O dono quer **mais simples**: a IA gera, o humano AJUSTA, criança de 5 anos usa. Refino proposto: **default = visão guiada simples** (fluxo como lista vertical de passos grandes/clicáveis + voz), **canvas livre = modo avançado**. Mobile = somente-leitura (edita por voz). Aditivo sobre o mesmo modelo de dados.

## Decisões que precisam do dono
1. **UAZAPI**: existem `/send/audio`, `/send/document`? aceitam URL pública ou base64? (define a Fase 4)
2. **Delay** entre bolhas: por nó ou fixo do sistema?
3. **Onde ficam os áudios** pré-gravados? (bucket Supabase `playbook-media`? URL externa?)
4. **Editor no wizard ou só na ficha?**
5. **Backfill** de agentes antigos sem bloco (consome créditos IA + pode sobrescrever)?

## Dependência-chave
O "coração" (gerar o fluxo do texto/PDF/voz + ajustar por IA/voz) usa a **MISTRAL_API_KEY** — que o dono sobe no fim. Então: construir TODA a infraestrutura sem-chave agora (flag, marca, split, plumbing de PDF/áudio, visão guiada simples, wiring do wizard); quando a chave subir, o miolo de IA acende e o conjunto funciona.
