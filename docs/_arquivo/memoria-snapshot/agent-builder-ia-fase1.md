---
name: agent-builder-ia-fase1
description: Agent Builder por IA — dono descreve por texto/PDF/áudio e a IA monta o playbook (fluxo+regras); Fases 1-3 ENTREGUES e deployadas
metadata:
  type: project
---

**Agent Builder por IA** ("caprichar na Mari"): o dono DESCREVE (texto, PDF/DOCX ou ÁUDIO) como o agente deve atender e a IA monta o **playbook (fluxo conversacional) + regras** (tom, o que coletar, pode/não-pode). Princípio sugere→confirma: a IA NUNCA publica — gera um rascunho, o dono revisa e publica pelo fluxo existente. **As 3 entradas alimentam o MESMO gerador** (texto/PDF/áudio são só portas; áudio→transcrição→descrição; pelo áudio monta o fluxo+workflow igual ao texto).

**Fases 2-3 ENTREGUES e deployadas (27/jun):** Fase 2 PDF/DOCX/TXT — endpoint aceita `{documento:{base64,mimeType,nomeArquivo}}` → `extrairTextoDocumentoRag` → mesmo gerador (UI: botão "Enviar PDF/DOCX", teto 8MB). Fase 3 ÁUDIO — `mistralTranscreverAudioBuffer` (novo: transcreve os BYTES direto, sem URL pública/Storage/SSRF — destravou o atrito), endpoint aceita `{audio:{...}}` → transcreve (voxtral) → devolve a transcrição nos avisos; UI: "Gravar áudio" (MediaRecorder+timer) e "Enviar áudio", teto 25MB. Deploy via push `wendel/dev:feature/escritorio-visual` (fast-forward).

**Fase 1 (TEXTO) — ENTREGUE (27/jun/2026, branch wendel/dev):**
- `lib/playbook/gerar-fluxo-ia.ts` — `gerarPlaybookViaIa(opts, {llm?})`: geração em **2 fases** (narrativa+regras temp~0.4 → JSON do fluxo temp~0.2), validação imediata (`validatePlaybookFlowDefinition`), **auto-fix** reenviando os `errors[]` (até 2 tentativas, 2ª escala p/ `claude-sonnet-4-6`), e **fallback** `ensureMarkdownWithWhatsappFlow` (o dono nunca fica sem playbook editável). LLM injetável. 4 testes verdes.
- `app/api/hub/agentes/[slug]/playbook/gerar-por-ia/route.ts` — POST {descricao}; service-role; resolve agente em `hub_agente_identidade`; debita **Tijolos** por fase (origem=`playbook_builder_ia`); devolve {markdown, flowDefinition, regras, avisos} SEM persistir.
- `components/crm/AgenteBuilderIaPanel.tsx` — bloco "Gerar com IA" (textarea + 3 chips de exemplo + botão) ligado no `AgentePlaybookCalibracaoDrawer` acima do editor; ao gerar faz `setMarkdown` → flui no editor+publish existentes.

**Reuso (mesa redonda confirmou: só o gerador era novo):** parse/validate, montagem de markdown, fallback, persistência (PUT `/playbook/conteudo` já valida+salva+invalida cache), análise de qualidade (`analyzePlaybookWithMistral`), calibração (`calibracao-chat`), simulador (`briefing-flow-simulator`), metering. Spec em `docs/superpowers/specs/2026-06-27-agent-builder-ia.md`.

**Validação navegador:** fiação OK (UI→endpoint→agente→gerador→erro limpo). Geração ao vivo exige `MISTRAL_API_KEY` — **ausente no .env.local** (local só URL+ANON+service-role), **presente em produção/Render**. Testar a geração real após deploy.

**Próximo:** Fase 2 = PDF/DOCX (reusa `extrairTextoDocumentoRag`); Fase 3 = áudio (reusa `mistralTranscreverAudioUrl`, precisa subir ao Storage p/ URL pública + anti-SSRF); Fase 4 = instrumentação (hub_eventos).

**Dogfooding do wizard de criação (achados p/ depois):** 8 passos intimida; **mercados em siglas crípticas** (IMB/ARQ/RFM…) precisam de rótulos; **bug de glyph** no checkmark dos passos ("—S"/"—x"); card do agente sem "Editar"/"Conversar". A matriz 5×5 + passo Modelo funcionam ao vivo. Conecta [[visao-ia-first-comando-multimodal]], [[agentes-ia-audit-redesign]], [[creditos-ia-metering-visao]].
