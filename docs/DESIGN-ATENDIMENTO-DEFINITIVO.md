# DESIGN DEFINITIVO — Atendimento Mari no WhatsApp (pausa, mídia, quebras, log, card-resumo)

> Arquiteto-chefe (Fable), 09/jul/2026, madrugada. Baseado no CÓDIGO REAL (arquivo:linha citados) + mecanismo UAZAPI confirmado por teste ao vivo (`GET /labels` e `POST /chat/find`).
> Princípios: (1) SEGURANÇA — não responder cliente errado; (2) CIRÚRGICO — reaproveitar o que existe; (3) click-and-go.
> Complementa e detalha `docs/PLANO-GOLIVE-MARI-ATENDIMENTO.md` (as 5 correções do Cenário B viram implementação concreta aqui).

---

## 0. Mapa do pipeline hoje (onde cada coisa acontece)

```
UAZAPI → POST /api/whatsapp/webhook (route.ts)
  ├─ fromMe (dono pelo celular) → ativarAtendimentoHumanoPorMensagemDoCelular (route.ts:443-478)
  ├─ inbound lead → encontrarOuCriarLead (route.ts:644) → enqueueWhatsappJob (route.ts:708) [INCONDICIONAL]
  └─ worker tick inline/async (route.ts:726-744)

Worker (lib/workers/whatsapp-job-worker.ts)
  ├─ claim + supersede-check (:279-281)
  ├─ re-lê lead FRESCO do banco (:344-363)  ← ponto de verdade anti-corrida
  ├─ isolamento telefone×lead (:365-380)
  └─ processarMensagemInboundWhatsapp (lib/whatsapp/inbound-message-processor.ts)
        ├─ GATE humano_responsavel (:146-174)  ← único gate real hoje
        ├─ persiste entrada na fila (:198-222)
        ├─ playbook dinâmico (:263-305) → flow-engine (já tem split de bolhas!)
        ├─ LLM engine (:350-372) → envia resposta em 1 mensagem única (:467)
        └─ grava hub_conversas/hub_mensagens/ciclos (:499-594)
```

O que é FACHADA hoje (confirmado): `hub_agente_identidade.ia_whatsapp_pausada` e `hub_conversas.ia_ativa` têm **0 leituras** no gate (só escritas em `atendimento-handoff.ts:197/282`, `human-handoff-from-device.ts:130`, `processor:519`); o toggle "Agente pausado" do painel escreve `ativo` via PATCH (`app/crm/agentes/page.tsx:694-733`) que o pipeline WhatsApp **nunca lê**; `toggleIA` de `hooks/useSupabaseLeads.ts:92-104` escreve na tabela `hub_leads` (canvas antigo), também nunca lida. "Só leads novos" não existe (`isNovo` não gateia nada; `route.ts:708` enfileira sempre).

---

## 1. ARQUITETURA DA PAUSA — 3 formas + trava temporal + guard de mídia

### 1.1 Princípio: UM gate central, no choke point

Todas as formas de pausa convergem para **uma função nova** e **um ponto de corte**:

- **Função:** `lib/whatsapp/pausa-atendimento.ts` (CONSTRUIR, ~120 linhas)
  ```ts
  verificarPausaAtendimento(supabase, {
    telefone,            // canônico (telefoneConversaId)
    agenteSlug,
    leadCriadoEm,        // vem do re-read do worker
    leadMetadata,        // p/ override ia_liberada
  }): Promise<{ pausada: boolean; motivo: string | null; fonte: string | null }>
  ```
- **Ponto de corte:** `lib/whatsapp/inbound-message-processor.ts`, logo APÓS o gate de `humano_responsavel` (inserir após a linha 174). É o único caminho de resposta da IA (o worker é o único chamador, `whatsapp-job-worker.ts:383`), e o worker já re-lê o lead fresco antes (`:344-363`) — a mesma robustez anti-corrida do handoff vale de graça para a pausa.

**Comportamento quando pausada:** silêncio total ao cliente (nenhum fallback — é exatamente o caso "cliente ativo, não fale com ele"), MAS **sempre persistir a mensagem recebida** (ver §4 Log) + `hub_atividades` com `skip_ia: true` e o motivo — espelhando o padrão do gate humano (`processor:161-172`).

**Ordem de verificação (barato → caro), curto-circuito:**
1. `humano_responsavel` (já existe, `processor:146`) — não mexe.
2. **Pausa do agente** — `hub_agente_identidade.ia_whatsapp_pausada` (a coluna morta, ressuscitada).
3. **Deny-list** (etiqueta + comando + seed) — tabela nova `hub_atendimento_pausas`.
4. **Trava temporal** — lead nascido antes de `IA_GOLIVE_AT` e sem override.

Itens 2+3 = 2 queries leves, rodáveis em `Promise.all`; item 4 = zero query (dados já vêm do re-read do worker). Volume de mensagens é baixo (dezenas/dia) — 2 queries indexadas por mensagem é aceitável; ainda assim, cache in-process TTL 30s (Map module-level em `pausa-atendimento.ts`), invalidado por `/pausa`, pelo sync de etiquetas e pelo botão do painel. **Nunca** se consulta a UAZAPI no hot path — só o Postgres.

### 1.2 Deny-list: tabela `hub_atendimento_pausas` (CONSTRUIR — migração aditiva)

```sql
CREATE TABLE IF NOT EXISTS hub_atendimento_pausas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  telefone text NOT NULL,                     -- canônico: só dígitos, E.164 sem '+'
  telefone_sufixo11 text GENERATED ALWAYS AS (right(telefone, 11)) STORED,
  fonte text NOT NULL CHECK (fonte IN ('etiqueta','comando','painel','seed')),
  labelid text,                               -- quando fonte='etiqueta'
  motivo text,
  criado_por text,                            -- 'wendel' | 'sync' | ...
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (telefone, fonte)
);
CREATE INDEX IF NOT EXISTS idx_pausas_sufixo11 ON hub_atendimento_pausas (telefone_sufixo11);
```

- **Consulta do gate:** `WHERE telefone_sufixo11 = right(<tel>, 11) LIMIT 1`. O sufixo-11 é a MESMA regra de equivalência já usada pelo isolamento (`lib/crm/isolamento-conversa-lead.ts:9-20`, `telefonesConversaEquivalentes` compara `slice(-11)`) — cobre DDI faltante e o 9º dígito na maior parte dos casos. Reaproveita a semântica existente em vez de inventar outra.
- **RLS:** padrão das demais `hub_*` (service-role escreve; leitura via API interna). Delete real permitido AQUI (é uma lista operacional, não dado de negócio — não conflita com a regra "delete só arquiva").

### 1.3 Forma (a) — Etiqueta "pausa" do WhatsApp Business (sync UAZAPI → deny-list)

**Mecanismo confirmado por teste (não reinventar):**
- `GET /labels` (header `token` da instância) → `[{ name, labelid }]`. A etiqueta **"pausa" ainda não existe — o dono cria no WhatsApp Business** (Etiquetas → Nova etiqueta → "pausa"). Labels que JÁ existem e interessam depois: `Arquitetos Homologados`=16, `Aquitetos Homologação`=15, `Cliente Reforma`=19, `Lead`=25, `Fornecedor Homologado`=18.
- **Não há filtro server-side de chats por label** (`/chat/find` com `labels/label/labelid` → 0 resultados ou 500, testado).
- `POST /chat/find` body `{"limit": N}` → lista de chats; **cada chat traz `wa_label`** (além de `phone`, `lead_name`, `lead_status`, `wa_contactName`, `lead_field01..20`).

**Sync (CONSTRUIR: `lib/whatsapp/sync-etiquetas-pausa.ts`):**
1. `GET /labels` → acha `labelid` cujo `name` normalizado (lower, sem acento, trim) == `pausa`. Não achou → warning `wa.pausas.label_ausente` e no-op (o dono ainda não criou — nunca falha o pipeline).
2. `POST /chat/find {"limit": 500, "offset": ...}` paginado até esgotar → para cada chat, se `wa_label` contém o labelid → telefone canônico de `phone` (via `telefoneConversaId`).
3. **Espelho transacional** na deny-list: upsert dos presentes (`fonte='etiqueta'`, `labelid`) e delete dos `fonte='etiqueta'` que saíram da etiqueta (tirou a etiqueta no celular = IA volta a atender). Fontes `comando/painel/seed` NUNCA são tocadas pelo sync.
4. **Fail-safe:** qualquer erro na UAZAPI → mantém a deny-list como está (não limpa nada) + `hub_alertas` se falhar 3 syncs seguidos.

**Disparo / cadência (o "cache" pedido):**
- **Piggyback no worker:** em `runWhatsappWorkerTick` (`whatsapp-job-worker.ts:490`), disparo fire-and-forget com throttle module-level de **3 min** (`lastSyncAt`). Zero infra nova: o tick já roda a cada webhook e no cron.
- **Botão "Sincronizar etiquetas agora"** → `POST /api/whatsapp/pausas/sync` (auth interna, `internalApiHeaders`) — click-and-go para quando o dono acabou de etiquetar alguém e quer efeito imediato.
- Token da instância: o da Mari (`hub_agente_identidade.uazapi_instance_token`, resolvido como em `tokenInstanciaPorAgente`, worker:227-244).
- Janela de exposição honesta: etiquetou → até 3 min para valer (ou botão = imediato). Documentar isso pro dono.

**Bônus (fase 2, não bloqueia go-live):** o mesmo sync pode espelhar `Arquitetos Homologados`/`Aquitetos Homologação` para alimentar homologação de parceiros no direcionamento (§5) — o mecanismo é idêntico, muda só a tabela destino.

### 1.4 Forma (b) — Comando `/pausa` pelo celular do dono (fromMe)

**Onde:** `app/api/whatsapp/webhook/route.ts`, no branch `inbound.kind === "outgoing_human"` (linhas 443-478), ANTES de chamar `ativarAtendimentoHumanoPorMensagemDoCelular`. O parse fromMe já existe e funciona (`webhook-inbound.ts:474-495`).

**Sintaxe (mais fácil que digitar número):**
| Comando | Onde o dono digita | Efeito |
|---|---|---|
| `/pausa` | dentro da conversa do cliente | pausa AQUELE número (o `telefone` do evento fromMe já é o chat de destino) |
| `/pausa 11 98888-7777` | qualquer chat (ex.: mensagem para si mesmo) | pausa o número citado (normaliza; sem DDI assume 55) |
| `/retoma` / `/retoma <número>` | idem | remove pausas `fonte IN ('comando','painel')` do número **e** limpa `humano_responsavel` do lead (devolve à IA de propósito — documentar) |

**Fluxo:** detectou prefixo `/pausa` ou `/retoma` (case-insensitive, trim) → grava/remove na deny-list (`fonte='comando'`, `criado_por=slugHumanoPadraoCelular()`) → cancela jobs pendentes do número (REAPROVEITAR `cancelarJobsIaPendentesTelefone`, `human-handoff-from-device.ts:20-45`) → `hub_atividades` no lead se existir → **return imediato** (NÃO segue para o handoff humano: um "/pausa" não deve virar `hub_mensagens` nem preview de conversa).

**Confirmação ao dono sem vazar pro cliente:** a resposta de confirmação ("⏸️ IA pausada para ***7777") vai SEMPRE para o próprio número da linha (mensagem-para-si-mesmo via `whatsappSendText` ao número da instância), **nunca** para o chat onde o comando foi digitado — se o dono digitou `/pausa` dentro da conversa do cliente, o cliente não pode receber nada. O `/pausa` em si o cliente vê (foi enviado no chat dele) — aceitável e até útil ("estou assumindo aqui").

**Cheque de smoke test obrigatório:** confirmar que mensagens enviadas PELA API (respostas da Mari) não chegam ao webhook como `fromMe` (se chegarem, filtrar por campo `wasSentByApi`/`fromApi` do payload antes do branch outgoing_human — senão a Mari se auto-handoffa a cada resposta; o E2E anterior sugere que não acontece, mas é barato conferir).

**Observação:** o handoff automático por fromMe (qualquer resposta do dono pelo celular já cala a Mari naquele lead — `human-handoff-from-device.ts:50`) continua como está. O `/pausa` adiciona 2 coisas que ele não cobre: número **sem lead no CRM** (`lead_nao_encontrado`, `:75-82` — a deny-list é por telefone, não exige lead) e intenção explícita auditável.

### 1.5 Forma (c) — Botão de pausa REAL no agente

- **Coluna:** `hub_agente_identidade.ia_whatsapp_pausada` (já existe no banco; 0 refs no código — ressuscitar).
- **Leitura:** `verificarPausaAtendimento` consulta `ia_whatsapp_pausada` do `agenteSlug` (1 query cacheada 30s). Alternativa mais barata: incluir no select de `tokenInstanciaPorAgente` (`whatsapp-job-worker.ts:235`) e passar via contexto — mas esse caminho é pulado quando o payload já traz `instanceToken` (`worker:285`), então a query própria no gate é a única à prova de furo. **Decisão: query própria no gate.**
- **Escrita:** PATCH `/api/hub/agentes/[slug]` passa a aceitar `{ ia_whatsapp_pausada: boolean }` (whitelist do campo no route). UI: botão "⏸️ Pausar atendimento WhatsApp" na ficha do agente (`/crm/agentes/[slug]`) e no card (`app/crm/agentes/page.tsx`, ao lado do `alternarAtivo` :694) — **separado** do toggle `ativo` (que segue significando "agente existe/roda ciclos"). Ao pausar: também cancelar jobs pendentes da instância? Não — cancelamento é por telefone; a pausa do agente é gate no processor e pega os jobs na hora de processar. Suficiente.
- Este é o **botão de pânico global** (a Mari é o único agente atendendo): 1 clique → nenhuma resposta de IA sai, sem depender de env/deploy.

### 1.6 Trava temporal (só lead nascido pós go-live)

- **Env:** `IA_GOLIVE_AT` (ISO 8601 com timezone, ex. `2026-07-09T12:00:00-03:00`) no Render.
- **Regra no gate:** `leadCriadoEm < IA_GOLIVE_AT` **e** `leadMetadata.ia_liberada !== true` → pausada (`motivo='lead_pre_golive'`). Override click-and-go: botão "Liberar IA para este lead" na ficha grava `metadata.ia_liberada=true`.
- **Plumbing:** o re-read do worker (`whatsapp-job-worker.ts:347-349`) ganha `criado_em, metadata` no select e repassa ao processor (2 campos no tipo `ReconstructedContext.lead`).
- **Limite honesto:** cliente ativo que NÃO está no CRM nasce como lead novo (`criado_em` = agora) e passa pela trava. Quem fecha esse buraco é a etiqueta (§1.3) e/ou o **seed** da lista de clientes ativos: `POST /api/whatsapp/pausas` aceita lote de telefones (`fonte='seed'`) — o dono cola a lista uma vez. As 3 camadas se somam; nenhuma sozinha basta.

### 1.7 Guard de mídia (até a visão/transcrição entrar)

**Onde:** `inbound-message-processor.ts`, DEPOIS dos gates de pausa (nunca responder mídia a cliente pausado) e ANTES do playbook/LLM (~linha 226). `tipoMidia` já vem classificado do parse (`webhook-inbound.ts:463-469`; placeholder `"[<tipo> recebido]"` em `:503`).

| tipoMidia | Hoje à noite (fase 0) | Fase 2 |
|---|---|---|
| `audio` | **LIGA a transcrição** (§2.1) — o fallback educado já vem embutido | — |
| `imagem` | resposta fixa educada + registra + NÃO chama o LLM | visão Mistral (§2.3) |
| `documento` | resposta fixa educada + registra + NÃO chama o LLM | ingestão PDF (§2.2) |
| `video` | resposta fixa educada + registra + NÃO chama o LLM | (fica) |

Resposta fixa (exemplo): *"Recebi seu arquivo! 🙌 Já vou dar uma olhada — enquanto isso, me conta em uma frase o que você precisa?"* — e `hub_atividades` marca `midia_nao_processada` para o humano ver no CRM. Sem placeholder `"[imagem recebido]"` indo pro LLM (hoje vai e a Mari responde fora de contexto).

---

## 2. MÍDIA — plano cirúrgico

### 2.1 Áudio (esforço P — literalmente 1 chamada; o módulo inteiro já existe)

- **REAPROVEITAR:** `lib/whatsapp/enriquecer-mensagem-audio.ts:46` (`enriquecerMensagemInboundAudio`) — hoje **dead code, 0 chamadores**. Cascata já pronta: transcrição vinda no webhook → UAZAPI `POST /message/download {transcribe:true}` (`uazapi-transcribe-audio.ts:11`; usa `OPENAI_API_KEY` se existir, `:20-28`) → fallback URL + **Mistral voxtral** (`mistral-transcribe-audio.ts:68`, modelo `voxtral-mini-latest`, `MISTRAL_API_KEY`) → fallback educado embutido ("pode repetir em texto?").
- **Plug:** no processor (não no webhook — transcrição pode levar segundos e o worker tem retry): se `tipoMidia==='audio'` e `mensagemFinal` é placeholder, montar o inbound sintético e chamar:
  ```ts
  const enr = await enriquecerMensagemInboundAudio({
    inbound: { ...campos de params..., tipoMidia: "audio" },
    instanceToken: params.waSendOpts?.instanceToken ?? null,
  });
  params.mensagemFinal = enr.mensagemFinal;  // segue o pipeline normal
  ```
  Requisitos já disponíveis no processor: `messageId` (params) e `instanceToken` (params/worker :285-296). Persistir `transcricao_fonte` no metadata da fila.
- **Fallback sem chave:** embutido no módulo — sem `MISTRAL_API_KEY`/UAZAPI-transcribe, o cliente recebe o pedido educado de texto. Nada quebra.

### 2.2 PDF / documento (esforço M)

- **Obter o arquivo:** REAPROVEITAR `uazapiObterUrlAudioMensagem` (`uazapi-transcribe-audio.ts:59`) — é um `POST /message/download {return_link:true}` genérico; **renomear para `uazapiObterUrlMidiaMensagem`** (serve para qualquer mídia) e manter alias.
- **Extrair texto (máximo Mistral):** novo `lib/whatsapp/entender-documento.ts`:
  1. **Mistral OCR** — `POST https://api.mistral.ai/v1/ocr`, modelo `mistral-ocr-latest`, `document: {type:"document_url", document_url}` → markdown por página. Lê PDF escaneado (o caso real de planta/memorial fotografado).
  2. Fallback local: `extractPdfTextBasic` (`lib/hub/rag.ts:148`) para PDF textual — já existe, é o extrator regex do RAG.
  3. Truncar ~6.000 chars, `mensagemFinal = "[Cliente enviou documento <nome>]\nConteúdo:\n<texto>"` → segue ao LLM.
- Limites: só `application/pdf` até 15 MB; outros tipos mantêm o guard educado. Sem chave → guard educado.

### 2.3 Foto (visão Mistral — esforço M)

- Novo `lib/whatsapp/entender-imagem-mistral.ts`:
  1. URL pública via `uazapiObterUrlMidiaMensagem`.
  2. `POST /v1/chat/completions`, modelo `MISTRAL_VISION_MODEL` (default **`pixtral-large-latest`**; `pixtral-12b-2409` como opção barata), messages com `content: [{type:"text", text: PROMPT}, {type:"image_url", image_url: url}]`.
  3. PROMPT dirigido ao domínio: *"Você analisa fotos enviadas por clientes de construção/reforma/imóveis. Descreva objetivamente o que aparece (ambiente, obra, planta, documento), transcreva TODO texto/medidas legíveis (OCR) e diga o que o cliente provavelmente quer."*
  4. `mensagemFinal = "[Cliente enviou uma foto${caption ? ` com legenda: ${caption}` : ""}]\nAnálise: <descrição>"` → segue ao LLM. A legenda já chega hoje como texto (`webhook-inbound.ts:209-237` lê `caption`) — quando há legenda, ela continua indo mesmo se a visão falhar.
  5. Fallback (sem chave / erro / timeout 45s): guard educado do §1.7.
- **Plug (2.2 e 2.3):** mesmo lugar do áudio no processor — um único bloco `switch (tipoMidia)` substituindo o guard da fase 0. Rate-limit por remetente já protege custo (`route.ts:566`, `iaRateLimitExcedido`).

---

## 3. QUEBRAS DE MENSAGEM + acesso fácil ao editor de fluxos

### 3.1 Quebras — o runtime do playbook JÁ faz; falta o caminho LLM

- **JÁ EXISTE (reaproveitar, zero mudança):** `lib/playbook/flow-engine.ts` — nó `send_text` com `split: true` (`:40`) divide por linha em branco (`splitTextIntoBubbles`, `:149`) e envia bolha a bolha com delay humanizado de 800 ms (`FLOW_SPLIT_BUBBLE_DELAY_MS`, `:137`, sobrescrevível por env). O adapter grava cada bolha na fila (`playbook-flow-maria.ts:1554-1571`).
- **FALTA (P):** a resposta do **LLM** sai inteira numa mensagem única (`inbound-message-processor.ts:467`). Mudança cirúrgica:
  ```ts
  import { splitTextIntoBubbles } from "@/lib/playbook/flow-engine";
  const bolhas = resposta.length > 280 ? splitTextIntoBubbles(resposta).slice(0, 4) : [resposta];
  // envia sequencial com ~800ms entre bolhas; 1ª falha → aborta o resto (não manda metade do meio)
  ```
  Regras: quebra só por `\n\n` (parágrafos que o modelo já produz); máx. 4 bolhas (resto concatena na última); `hub_mensagens` continua gravando **1 registro** com o texto completo (`metadata.bolhas = N`) para não poluir o Inbox.
- **FALTA (P):** instruir o prompt do agente (agent-prompts da Mari) a responder em parágrafos curtos separados por linha em branco — é o que alimenta o split naturalmente.
- **FALTA (P, editor):** expor o toggle `split` do nó mensagem no editor visual (checkbox "Dividir em bolhas" no painel de propriedades do nó em `PlaybookFlowReactFlowPanel.tsx`/`FlowCanvas.tsx`) e fazer `gerar-fluxo-ia.ts` marcar `split:true` em textos > 300 chars.

### 3.2 Acesso ao editor visual (hoje flag-gated)

- **Cadeia real:** `lib/crm/feature-flags.ts:28-32` (`playbookFlowVisualSideover`, default ON só em dev) ← env build-time `NEXT_PUBLIC_CRM_PLAYBOOK_FLOW_VISUAL_SIDEOVER` ← `render.yaml:108-109` (declarada `"true"`). Gate de render: `AgentePlaybookCalibracaoDrawer.tsx:107` → `PlaybookFlowVisualSideover.tsx:101` → `PlaybookFlowReactFlowPanel`.
- **Risco real:** a env é `NEXT_PUBLIC_*` = **inlinada no build**. O deploy atual está no Render NOVO (`escritorio-virtual-51c8`) configurado à mão — se a env não estiver no dashboard, o editor **não existe em produção** mesmo com render.yaml certo. **Ação: conferir no dashboard + Manual Deploy (rebuild).**
- **Simplificação recomendada (P):** mudar o default da flag para `true` (`feature-flags.ts:31`: fallback `true` em vez de `NODE_ENV==="development"`). O editor já foi validado; flag continua existindo para DESLIGAR se precisar, mas deixa de depender de env presente para LIGAR. 1 linha.
- **Click-and-go (P):** botão "🧩 Fluxo" direto no card do agente (`app/crm/agentes/page.tsx`) abrindo a Calibração já com o sideover visual aberto (query param `?fluxo=1`), em vez de ficha → aba → drawer → botão. Criação segue pelo wizard que já reusa `AgenteBuilderIaPanel` (`AgenteNovoWizard.tsx:1834`) — PDF/voz/texto → fluxo, nada a construir.

---

## 4. LOG DE TUDO (conversas recebidas E enviadas + auditoria da IA)

### 4.1 O que JÁ grava (reaproveitar — não criar tabela nova de log)

| Tabela | O que registra | Onde no código |
|---|---|---|
| `hub_fila_mensagens` | **Ledger bruto por direção** (`direcao: entrada/saida`, `conteudo`, `status`, `metadata.feito_por`) | entrada: `processor:198-222`; saída LLM: `lib/ia/engine.ts:469`; saídas do playbook (texto/mídia/menu): `playbook-flow-maria.ts:1558/1586/1619`; fallback: `processor:66-84`; msg do celular do dono: `human-handoff-from-device.ts:154-177` |
| `hub_conversas` + `hub_mensagens` | **Visão de conversa do Inbox** (remetente lead/ia/humano, preview) | `processor:499-558`; `human-handoff-from-device.ts:117-151` |
| `hub_atividades` | Timeline do lead (mensagem recebida com IA calada, notas, handoffs) | `processor:161-172`; `atendimento-handoff.ts:206-217`; playbook `:1644` |
| `hub_ciclos_log` / `hub_ciclos_ia` | Auditoria de execução da IA (tokens, custo, ação) | `processor:560-594` |
| `hub_eventos` | Eventos de negócio (lead_distribuido, gates) | `registrar-evento` (ex.: `notificar-parceiro-lead.ts:173-182`) |
| Logs técnicos | JSON estruturado com `traceId` no stdout (Render Logs) — não é banco | `lib/observability/hub-log.ts` |

### 4.2 Os 4 buracos e o fix cirúrgico de cada um

1. **Mensagem recebida com humano ativo NÃO vira mensagem** — o gate humano grava só `hub_atividades` (`processor:161-172`); a fala do cliente não entra em `hub_fila_mensagens` nem `hub_mensagens` (a entrada só é persistida em `:198`, DEPOIS do gate). **Fix (P): mover o bloco de persistência da entrada (`processor:198-222`) para ANTES de todos os gates** (logo após `:145`), com `status` refletindo o desfecho (`processado` / `recebido_humano_ativo` / `recebido_ia_pausada`). O novo gate de pausa nasce já atrás dessa persistência → **nenhuma mensagem recebida se perde, nunca**.
2. **`hub_mensagens` só grava quando a IA responde sem aprovação** (`processor:532-558` está dentro de `if (!resultado.precisaAprovacao)`). Fluxo playbook e mensagens sob pausa não aparecem no Inbox como mensagem. **Fix (P):** extrair um helper `registrarMensagemConversa(supabase, {leadId, remetente, conteudo, tipoConteudo, messageId})` (reaproveita o upsert de conversa de `:499-527`) e chamá-lo: na entrada (sempre), na saída do playbook (adapter `sendText`) e no ramo pausado. Cirúrgico: 1 função, 3 call-sites.
3. **Entrada duplicada** — processor grava a entrada (`:215`) e o engine grava de novo (`engine.ts:464`, `feito_por:'engine'`). **Fix (P):** engine só grava entrada quando `canal !== 'whatsapp'` (o processor é dono do registro no WhatsApp).
4. **Saídas do dono pelo celular** já são logadas (`enviada_celular`) — ok; conferir no smoke que o webhook fromMe está recebendo TODAS (depende da config de webhook da UAZAPI incluir eventos fromMe).

**Resultado:** histórico completo por lead = `hub_fila_mensagens WHERE lead_id=? ORDER BY criado_em` (bruto, com direção separada) e Inbox = `hub_conversas/hub_mensagens` (curado). Auditoria IA = `hub_atividades` + `hub_ciclos_log` + `traceId` nos logs Render. Zero tabela nova.

---

## 5. CARD-RESUMO no direcionamento (estilo Kommo)

### 5.1 O que existe (reaproveitar)

- Motor de sugestão: `lib/crm/sugerir-encaminhamento-auto.ts:30` — top-5 candidatos por mercado/cidade; **já persiste JSON em `hub_encaminhamentos.criterio_selecao`** (`:118-125`: parceiro, score, motivo, candidatos).
- Envio ao parceiro: `lib/crm/notificar-parceiro-lead.ts:105-114` — hoje manda um texto pobre (nome/telefone/mercado + link genérico do portal).
- UI de direcionamento: `DirecionarLeadDrawer.tsx` (confirmar/manual) e `encaminhamento-manual.ts`.
- Matéria-prima do resumo: `hub_fila_mensagens` (conversa completa, §4), `lead.metadata` (`interesse_principal`, `valor_estimado` — o prompt IA-01 já grava; `primeira_mensagem` — `webhook route.ts:295`), `hub_pessoas.cidade/estado` (`sugerir-encaminhamento-auto.ts:88-96`).

### 5.2 Design (CONSTRUIR `lib/crm/gerar-card-lead.ts` — esforço M)

**`montarCardResumoLead(supabase, leadId)`** → objeto persistível:
```ts
{ nome, telefone, email?, cidade, estado, mercado, codigo,
  pedido_resumo,        // 1-2 frases geradas por IA: "Cliente quer orçamento de cobertura retrátil ~40m² em Moema, prazo 2 meses."
  pontos: string[],     // bullets: escopo, orçamento citado, prazo, endereço/bairro
  ultimas_falas: [{de, texto, em}],  // 3 últimas do cliente (cru, curto)
  gerado_em }
```
- **Fonte:** últimas ~30 linhas de `hub_fila_mensagens` do lead → `mistral-small-latest` com prompt de sumarização dirigida ("resuma O PEDIDO do cliente para um parceiro que vai orçar; não invente"). **Fallback sem chave/erro:** card determinístico com `interesse_principal` + `primeira_mensagem` + `valor_estimado` — o card SEMPRE sai.
- **Persistência (reaproveitar, sem coluna nova):** merge no JSON `hub_encaminhamentos.criterio_selecao` (campo `card_resumo`) + espelho em `lead.metadata.resumo_conversa` (cache reutilizável; regenera se > 24h ou se houve mensagens novas).
- **Quando gera:** dentro de `sugerirEncaminhamentoAutomatico` (antes do insert `:127`) e em `enviarLeadAoParceiro` se o encaminhamento não tiver card (cobre o caminho manual do Drawer).

### 5.3 Como o parceiro recebe (as duas superfícies)

1. **WhatsApp (imediato — trocar o texto pobre de `notificar-parceiro-lead.ts:105-114`):**
   ```
   🔔 *Novo lead para você!*
   *Nome:* Maria Silva (LED-0231)
   *Telefone:* (11) 98888-7777 · *Cidade:* São Paulo/SP
   *Mercado:* Arquitetura

   📋 *Pedido:* Cliente quer orçamento de cobertura retrátil ~40m², prazo 2 meses.
   💬 *Última fala:* "consegue me passar um valor até sexta?"

   ▶️ Abrir WhatsApp do cliente: https://wa.me/5511988887777
   ▶️ Fazer orçamento: {APP_URL}/parceiro/leads/{encaminhamentoId}
   ```
   Links = click-and-go universal (funciona em qualquer WhatsApp). Botões nativos via `enviarMenuUazapi` são upgrade opcional — só se o parceiro estiver na MESMA instância UAZAPI; links não têm essa dependência. **Decisão: links primeiro.**
2. **Tela no Hub (fase 2):** `/parceiro/leads/[id]` renderiza o card (mesmo JSON de `criterio_selecao.card_resumo`) no layout Kommo do print do dono: cabeçalho com dados, bloco "Pedido", histórico (últimas falas), botões "Fazer Orçamento" / "Abrir WhatsApp". O `DirecionarLeadDrawer` ganha um preview do card antes do envio (o dono vê o que o parceiro vai receber — 1 seção nova no drawer).

---

## 6. ROLEPLAY — 5 cenários tap-a-tap

### Cenário 1 — Lead novo de arquitetura manda ÁUDIO
**Tap-a-tap:** João (novo) manda áudio de 40s: "quero reformar meu apê, fazer projeto de interiores, uns 80 metros".
**Hoje quebraria:** parse marca `tipoMidia=audio`, `mensagemFinal="[audio recebido]"` (`webhook-inbound.ts:503`) → o LLM recebe o placeholder → Mari responde fora de contexto ("Como posso ajudar?") — cliente repete, frustra.
**Com o design:** webhook enfileira → worker re-lê lead (novo, pós-golive, sem pausa) → gates passam → §2.1 transcreve (UAZAPI ou voxtral) → `mensagemFinal` = a fala real → playbook/LLM seguem com contexto → resposta em 2 bolhas (§3.1) + menu de triagem. Se a transcrição falhar: "pode repetir em texto?" (embutido). Fila registra entrada com `transcricao_fonte`.

### Cenário 2 — Cliente ATIVO etiquetado "pausa" manda mensagem
**Tap-a-tap:** Sr. Ricardo (obra em andamento, dono etiquetou "pausa" ontem; sync rodou) manda "Wendel, o pedreiro não veio hoje".
**Hoje quebraria:** Ricardo não está no CRM → `encontrarOuCriarLead` cria lead novo (`route.ts:644`) → `isNovo=true` → Mari responde como se fosse lead frio. **O pior cenário do go-live.**
**Com o design:** webhook cria o lead (ok, queremos o registro) e enfileira → processor: gate humano (vazio) → **gate deny-list acha o sufixo-11 (`fonte='etiqueta'`)** → silêncio total; entrada gravada (`recebido_ia_pausada`, §4.2-1) + `hub_atividades` → o dono vê no Inbox e responde pelo celular (o que, de quebra, seta `humano_responsavel` — dupla proteção).
**Furo residual honesto:** cliente ativo SEM etiqueta, SEM seed e SEM lead antigo = Mari responde. Por isso: etiquetar/colar a lista ANTES de ligar o webhook.

### Cenário 3 — Dono manda `/pausa`
**Tap-a-tap:** dentro da conversa da Dona Ana, o dono digita `/pausa` e envia.
**Hoje quebraria:** não existe comando; MAS o fromMe já dispara handoff (`route.ts:450`) — o "/pausa" viraria mensagem de humano gravada em `hub_mensagens` com preview "/pausa", e se Ana não tem lead → `lead_nao_encontrado` → **nada acontece**.
**Com o design:** branch outgoing_human detecta o prefixo ANTES do handoff → deny-list `fonte='comando'` (por telefone — funciona mesmo sem lead) → cancela jobs pendentes do número → confirmação "⏸️ IA pausada para ***4321" chega no chat do PRÓPRIO dono (mensagem-para-si), nunca no da Ana → return (sem poluir a conversa no CRM). `/retoma` desfaz.

### Cenário 4 — Lead manda FOTO de planta
**Tap-a-tap:** Carla manda foto da planta baixa com legenda "dá pra tirar essa parede?".
**Hoje quebraria:** `tipoMidia=imagem`; a legenda vira o texto (parse lê `caption`) — o LLM responde SÓ pela legenda, cego à planta; sem legenda, recebe "[imagem recebido]" e responde no vácuo.
**Com o design (fase 0, hoje):** guard educado — "Recebi sua planta! 🙌 Me conta em uma frase o que você quer mudar?" + atividade `midia_nao_processada` (humano vê a foto no celular). **(fase 2):** pixtral descreve a planta + OCR das medidas → `mensagemFinal = "[foto] Legenda: dá pra tirar essa parede? Análise: planta baixa de apto ~70m², 3 quartos..."` → Mari responde com contexto real e qualifica (→ card-resumo do §5 fica rico).

### Cenário 5 — Dono edita o fluxo no editor visual
**Tap-a-tap:** dono abre `/crm/agentes` → card da Mari → "🧩 Fluxo" → arrasta um nó mensagem novo ("manda o portfólio"), marca "Dividir em bolhas", conecta, salva/publica.
**Hoje quebraria:** o caminho existe (ficha → Calibração → "Editar fluxo visual") mas: (a) se `NEXT_PUBLIC_CRM_PLAYBOOK_FLOW_VISUAL_SIDEOVER` não estiver no build do Render novo, o botão **não renderiza** (`AgentePlaybookCalibracaoDrawer.tsx:107`); (b) não há atalho no card; (c) o toggle `split` do nó não está exposto na UI.
**Com o design:** flag default `true` + env conferida + botão no card + checkbox de bolhas → dono edita em 3 cliques; runtime (`playbook-flow-maria.ts`) atende a nova versão na mensagem seguinte (o estado por lead retoma no passo persistido).

---

## 7. PLANO DE IMPLEMENTAÇÃO ORDENADO (segurança primeiro)

Legenda: **[R]** reaproveitar · **[C]** construir · P/M/G esforço · 🌙 seguro hoje à noite (webhook OFF) · 🌅 exige smoke de manhã (webhook ON)

### FASE 0 — hoje à noite (tudo deployável com webhook desligado)

| # | Arquivo | Mudança | Tipo | Esf. | Testável |
|---|---|---|---|---|---|
| 1 | `supabase/migrations/20260709xxxx_pausas_atendimento.sql` | tabela `hub_atendimento_pausas` (§1.2) + garantir `ia_whatsapp_pausada boolean default false` | [C] | P | 🌙 via MCP (aditiva; mostrar SQL+resultado — trava padrão) |
| 2 | `lib/whatsapp/pausa-atendimento.ts` | `verificarPausaAtendimento` + `pausarTelefone`/`retomarTelefone` + cache 30s | [C] | P | 🌙 unit test |
| 3 | `lib/whatsapp/inbound-message-processor.ts` | (a) mover persistência de entrada p/ antes dos gates (§4.2-1); (b) gate pausa após `:174`; (c) bloco mídia: liga áudio + guard imagem/doc/vídeo (§1.7/§2.1); (d) quebras em bolhas no envio `:467` (§3.1) | [R]+[C] | P/M | 🌙 unit + 🌅 E2E |
| 4 | `lib/workers/whatsapp-job-worker.ts` | select `:347` ganha `criado_em, metadata`; tick `:490` dispara sync de etiquetas com throttle 3min | [R] | P | 🌙 |
| 5 | `lib/whatsapp/sync-etiquetas-pausa.ts` | GET /labels + POST /chat/find paginado → espelho deny-list (§1.3) | [C] | M | 🌙 **UAZAPI responde mesmo com webhook OFF** — dá pra criar a etiqueta, etiquetar 1 contato de teste e ver a deny-list encher HOJE |
| 6 | `app/api/whatsapp/webhook/route.ts` | comando `/pausa`/`/retoma` no branch `:443` antes do handoff (§1.4) | [C] | P | 🌅 (fromMe só chega com webhook ON) |
| 7 | `app/api/hub/agentes/[slug]/route.ts` + ficha/card do agente | PATCH aceita `ia_whatsapp_pausada`; botão "Pausar atendimento" (§1.5) | [R]+[C] | P | 🌙 UI + 🌅 gate E2E |
| 8 | `app/api/whatsapp/pausas/route.ts` (+`/sync`) | GET lista · POST lote (seed da lista de clientes ativos) · POST sync manual | [C] | P | 🌙 |
| 9 | `lib/ia/engine.ts:464` | entrada só quando `canal !== 'whatsapp'` (dedup §4.2-3) | [R] | P | 🌙 |
| 10 | `lib/crm/feature-flags.ts:31` | default do editor visual → `true`; conferir env no Render + Manual Deploy | [R] | P | 🌙 |
| 11 | Render env | `IA_GOLIVE_AT`; conferir `MISTRAL_API_KEY`, `NEXT_PUBLIC_CRM_PLAYBOOK_FLOW_VISUAL_SIDEOVER` | — | P | 🌙 |

**Pré-requisitos do dono (bloqueantes, pedir já):** criar a etiqueta **"pausa"** no WhatsApp Business e etiquetar os clientes ativos; OU/E colar a lista de telefones (seed via item 8). Confirmar hora do go-live para `IA_GOLIVE_AT`.

### FASE 1 — manhã (smoke test, webhook ON, ~30 min com o dono)

1. Ligar webhook → mandar msg de um número de teste NOVO → Mari responde (bolhas ok, entrada+saída na fila).
2. Etiquetar o número de teste com "pausa" → botão sync → mandar msg → **silêncio** + `recebido_ia_pausada` no banco.
3. Tirar a etiqueta → sync → volta a responder.
4. `/pausa` na conversa de teste → silêncio + confirmação no chat do dono; `/retoma` → volta. **Conferir que resposta da Mari via API não dispara fromMe/handoff** (§1.4).
5. Botão "Pausar atendimento" do agente → silêncio global → despausar.
6. Áudio de teste → transcreve e responde com contexto.
7. Lead antigo (pré-golive) manda msg → silêncio (`lead_pre_golive`).
8. Foto/PDF → resposta educada do guard (fase 0).

### FASE 2 — pós-smoke (em ordem de valor)

| # | Item | Base | Tipo | Esf. |
|---|---|---|---|---|
| 1 | Card-resumo no direcionamento (§5): `gerar-card-lead.ts` + template WhatsApp rico + preview no Drawer | criterio_selecao + notificar-parceiro-lead + fila | [R]+[C] | M |
| 2 | Foto → visão pixtral (§2.3) | download UAZAPI genérico | [C] | M |
| 3 | PDF → Mistral OCR + fallback rag (§2.2) | rag.ts:148 | [R]+[C] | M |
| 4 | `hub_mensagens` completo via helper (§4.2-2) | processor:499-558 | [R] | P |
| 5 | Toggle "Dividir em bolhas" no editor + gerador marca split (§3.1) | flow-engine.split | [R] | P |
| 6 | Botão "🧩 Fluxo" no card do agente (§3.2) | Calibração drawer | [C] | P |
| 7 | Sync labels `Arquitetos Homologados`/`Homologação` → homologação de parceiros p/ direcionamento | sync §1.3 (mesmo motor) | [R] | M |
| 8 | Tela `/parceiro/leads/[id]` com card Kommo-like | card_resumo JSON | [C] | M |

### O que NÃO fazer agora (anti-exagero)
- Não criar tabela nova de "log de conversas" — a fila + hub_mensagens cobrem (§4).
- Não construir UI dedicada de deny-list além de lista+botões básicos — a etiqueta no celular É a UI do dono.
- Não usar botões nativos UAZAPI no card do parceiro na v1 — links `wa.me`/portal funcionam sempre.
- Não mexer no dedup UNIQUE de telefone nesta janela (migração de dados = janela do dono; o sufixo-11 no gate já usa a equivalência existente).

---

## 8. Riscos residuais (honestos)

1. **Cliente ativo invisível** (sem etiqueta, sem seed, sem lead antigo) → Mari responde. Mitigação: disciplina do dono (etiquetar/lista) + regra de ouro já ativa: respondeu pelo celular = Mari cala naquele lead (`human-handoff-from-device.ts`).
2. **Janela do sync (≤3 min)** entre etiquetar e valer. Mitigação: botão sync + `/pausa` para efeito imediato.
3. **`/chat/find` com muitos chats** — paginar e medir; se a instância tiver milhares de chats, subir o intervalo do sync (não bloquear o tick).
4. **fromMe de mensagens da API** — se a UAZAPI ecoar envios da própria API como fromMe, o parse de comando e o handoff precisam filtrar (`wasSentByApi`). Item explícito do smoke (§7 fase 1.4).
5. **Custo de visão/OCR** — rate-limit por remetente já existe (`route.ts:566`); adicionar teto diário simples por tenant quando ligar foto/PDF (metering Tijolos já mede tokens).
