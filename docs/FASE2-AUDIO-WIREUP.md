# Fase 2 — Ligar a transcrição de ÁUDIO (plano verificado, ~20 min de manhã)

> Por que não foi feito na madrugada: o wire-up depende de coisas **não-verificáveis sem a UAZAPI viva** — os endpoints de mídia da UAZAPI e a disponibilidade do modelo `voxtral` na conta Mistral do dono. Fazer às cegas arriscava shippar algo que cai no fallback em silêncio. Melhor 20 min verificados com o dono. O código JÁ existe e é robusto.

## O que já existe (pronto, só falta plugar)
- `lib/whatsapp/enriquecer-mensagem-audio.ts` → `enriquecerMensagemInboundAudio()`: tenta transcrição do payload → endpoint UAZAPI (`uazapiTranscreverAudioMensagem`) → download + Mistral voxtral (`mistralTranscreverAudioUrl`) → fallback educado. Nunca lança.
- `lib/whatsapp/mistral-transcribe-audio.ts` (voxtral-mini-latest, PT) e `lib/whatsapp/uazapi-transcribe-audio.ts` (URL/transcrição via UAZAPI).
- Hoje esse código é **dead code** (ninguém chama). O guard de mídia (resposta educada) é o backstop atual.

## Onde plugar (decisão de arquitetura)
**No WORKER, não no webhook.** Transcrição leva até ~90s; no webhook trava o 200 de resposta. O worker já re-lê o lead e chama o processor — é o lugar certo.

Ponto exato: `lib/workers/whatsapp-job-worker.ts`, dentro de `processJob`, **depois** do `reconstruirContexto` e **antes** de `processarMensagemInboundWhatsapp` (perto da linha ~391). Só quando `contexto.tipoMidia === "audio"`.

Esboço (adaptar o contexto ao tipo `NormalizedWhatsappInbound` que a função espera):
```ts
if (contexto.tipoMidia === "audio") {
  const { enriquecerMensagemInboundAudio } = await import("@/lib/whatsapp/enriquecer-mensagem-audio");
  const enr = await enriquecerMensagemInboundAudio({
    inbound: {
      telefone: contexto.telefone, pushName: contexto.pushName, messageId: contexto.messageId,
      timestamp: contexto.timestamp, fromMe: false, isGroup: false, tipoMidia: "audio",
      texto: "", mensagemFinal: contexto.mensagemFinal, instance: contexto.instanceKey ?? undefined,
    },
    instanceToken: contexto.waSendOpts?.instanceToken ?? null,
    // rawBody não está no worker — o caminho "payload" é pulado; UAZAPI/voxtral cobrem.
  });
  contexto.mensagemFinal = enr.mensagemFinal; // vira a transcrição (ou o fallback educado)
}
```
Nota: o guard de mídia no processor deixa de disparar para áudio (o `mensagemFinal` já não é o placeholder). Áudio passa a ser transcrito; foto/PDF/vídeo continuam no guard (fase 2 deles depois: pixtral/OCR).

## Smoke test (com o dono, webhook pode estar ON já)
1. Confirmar na Render que `MISTRAL_API_KEY` tem acesso a `voxtral-mini-latest` (senão setar `MISTRAL_TRANSCRIBE_MODEL` pro modelo disponível).
2. Mandar um áudio de um número de TESTE (não cliente) → conferir no log `wa.audio` / `transcricaoFonte` qual caminho pegou (webhook/uazapi/mistral/fallback).
3. Se cair sempre em `fallback`: testar `uazapiObterUrlAudioMensagem` isolado (o endpoint de mídia da UAZAPI desta instância pode ter outro path) e ajustar `uazapi-transcribe-audio.ts`.
4. Só considerar "ligado" quando um áudio real virar texto e a Mari responder no contexto.

## Fotos/PDF (fase 2 posterior)
Mesmo padrão: pixtral (visão) para foto de planta + OCR de PDF. Guard educado continua cobrindo até lá. Ver `docs/DESIGN-ATENDIMENTO-DEFINITIVO.md` §2.
