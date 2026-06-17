# Comandos WhatsApp — pausar e reativar a IA

Manual para operadores que controlam a IA da linha comercial pelo WhatsApp, **sem o cliente ver os comandos**.

---

## Visão geral

| Conceito | Descrição |
|----------|-----------|
| **Onde enviar** | Celular **autorizado** → chat com o **número da linha IA** (salve nos contatos). **Nunca** no chat do lead. |
| **Quem pode** | Telefones em `WHATSAPP_CMD_PHONES` **ou** CRM → Contatos → **Pode comandar IA** |
| **Pausa global** | `/ia-off` até `/ia-on` — nenhum lead recebe resposta automática |
| **Pausa por lead** | `/ia pausa 55…` / `/ia retoma 55…` — só aquela conversa |
| **Confirmação** | Resposta automática **só para quem enviou** o comando (mesmo chat operador → linha) |

---

## Configuração inicial

### 1. Salvar o número da linha

No celular pessoal do operador:

1. Adicione o número comercial da instância UAZAPI nos contatos (ex.: «Obra10 IA»).
2. Abra esse chat — é aqui que todos os comandos devem ser enviados.

### 2. Autorizar o operador

**Opção A — variável de ambiente** (servidor):

```env
WHATSAPP_CMD_PHONES=5511999998888,5511888777666
```

- DDI 55, apenas dígitos, separados por vírgula.
- Reinicie o worker/web após alterar.

**Opção B — CRM:**

1. Acesse **CRM → Contatos**.
2. Localize o contato do operador (telefone com DDI).
3. Ative **Pode comandar IA**.
4. O contato deve estar **ativo**.

### 3. Slug do humano no celular (opcional)

Quando alguém responde um lead **pelo aparelho conectado** à linha (não por comando), o sistema grava quem assumiu em `humano_responsavel`. Configure o slug padrão:

```env
WHATSAPP_DEVICE_HUMAN_SLUG=wendel
```

Se omitido, o slug padrão é `celular`.

---

## Comandos

Todos os comandos são **case-insensitive**. Barra inicial (`/`) é opcional.

| Comando | Aliases | Efeito |
|---------|---------|--------|
| `/ia-off` | `ia off`, `ia pausar`, `ia pausar geral` | Pausa a IA **em toda a linha** |
| `/ia-on` | `ia on`, `ia ativar`, `ia retomar geral` | Reativa a IA na linha inteira |
| `/ia pausa 5511999887766` | `assumir 5511…` | Pausa a IA **só** nesse lead |
| `/ia retoma 5511999887766` | `devolver 5511…`, `ia on 5511…` | Devolve **só** esse lead para a IA |
| `/ia status` | `status` | Linha on/off + contagem em atendimento humano |
| `/ia ajuda` | `ajuda`, `help` | Lista os comandos |

### Formato do telefone do lead

- DDI **55** + DDD + número, **somente dígitos** (ex.: `5511999887766`).
- O sistema normaliza automaticamente; espaços e `+` são ignorados no parse.

### Respostas esperadas (exemplos)

| Comando | Resposta típica |
|---------|-----------------|
| `/ia-off` | `✅ IA pausada em *toda* a linha (sdr). Jobs cancelados: N. Use /ia-on para reativar.` |
| `/ia-on` | `✅ IA reativada na linha (sdr). Novos leads voltam a ser atendidos pela IA.` |
| `/ia pausa 5511…` | `✅ IA pausada no lead 5511…7766. Jobs cancelados: N.` |
| `/ia retoma 5511…` | `✅ IA reativada no lead 5511…7766.` |
| `/ia status` | `*Status IA — sdr*` + linha 🟢/🔴 + conversas em humano |
| Comando inválido | `Comando não reconhecido. Envie /ia ajuda para ver a lista.` |

### Comportamento com IA pausada globalmente

- Mensagens **de leads** são aceitas pelo webhook (HTTP 200) mas **não enfileiram** job de IA.
- **Nenhuma** resposta automática é enviada (silêncio no MVP).
- Jobs já enfileirados são marcados `done` com `last_error: ia_global_pausada` (webhook ao pausar + revalidação no worker).

### Comportamento com pausa por lead

- Outros leads continuam com IA ativa.
- O lead pausado fica com `humano_responsavel` preenchido e `hub_conversas.ia_ativa = false`.
- Jobs pendentes daquele telefone são cancelados.

---

## O que **não** fazer

| Erro | Consequência |
|------|--------------|
| Digitar `/ia-off` no **chat com o cliente** | O cliente **vê** a mensagem |
| Enviar comando de outro número não autorizado | Comando ignorado; mensagem tratada como lead normal |
| Esquecer `/ia-on` após pausa global | Linha fica muda para todos — use `/ia status` ou reative no CRM |

---

## Handoff automático pelo celular (`fromMe`)

Alternativa aos comandos: responder o lead **diretamente pelo WhatsApp conectado à linha** (mensagem normal no chat do cliente, no aparelho onde a UAZAPI está logada).

### Como funciona

1. O webhook UAZAPI recebe o evento com `fromMe: true` (mensagem enviada pelo aparelho da linha).
2. O branch `outgoing_human` em `app/api/whatsapp/webhook/route.ts` intercepta **antes** do fluxo de lead/comando.
3. `ativarAtendimentoHumanoPorMensagemDoCelular` executa:
   - Define `hub_leads_crm.humano_responsavel` com o slug configurado.
   - Marca `hub_conversas.ia_ativa = false` e status `em_atendimento_humano`.
   - Cancela jobs de IA pendentes para aquele telefone (`human_takeover_from_device`).
   - Registra a mensagem em `hub_mensagens` e atividade no CRM.

### Variável `WHATSAPP_DEVICE_HUMAN_SLUG`

```env
# Slug gravado em hub_leads_crm.humano_responsavel quando alguém responde pelo celular da linha.
WHATSAPP_DEVICE_HUMAN_SLUG=wendel
```

| Valor | Efeito no CRM |
|-------|---------------|
| `wendel` | `humano_responsavel = "wendel"` — aparece no atendimento e métricas |
| *(omitido)* | `humano_responsavel = "celular"` |

### Diferença: comando vs fromMe

| | Comando `/ia pausa 55…` | Resposta fromMe no chat do lead |
|--|-------------------------|----------------------------------|
| Onde | Chat operador → número da linha | Chat lead no celular da linha |
| Cliente vê? | Não | Sim (é a resposta normal) |
| Escopo | Qualquer lead pelo telefone | Só a conversa respondida |
| Slug humano | Slug do operador autorizado | `WHATSAPP_DEVICE_HUMAN_SLUG` |

### Quando usar cada um

- **Comando**: pausar sem abrir o chat do cliente; pausa global; retomar remotamente.
- **fromMe**: atendimento natural — você já está respondendo o lead pelo celular.

### Regressão

O fluxo `fromMe` é independente dos comandos operador. Testes automatizados: `lib/whatsapp/webhook-inbound.test.ts` (parse) e cenário 9 na homologação abaixo.

---

## Homologação UAZAPI — linha real

Checklist de **10 cenários** para validar em ambiente com instância UAZAPI conectada, worker ativo e pelo menos um operador autorizado.

### Pré-requisitos

- [ ] Instância UAZAPI conectada e webhook apontando para `/api/whatsapp/webhook`
- [ ] `WEBHOOK_SECRET` configurado; worker rodando (`npm run worker:whatsapp` ou cron)
- [ ] Operador de teste em `WHATSAPP_CMD_PHONES` ou CRM com **Pode comandar IA**
- [ ] Telefone de lead de teste (não o do operador)
- [ ] Migration `ia_whatsapp_pausada` aplicada em `hub_agente_identidade`
- [ ] Scripts úteis: `npm run diagnose:webhook`, `npm run check:jobs`, `npm run process:jobs`

### Checklist

| # | Cenário | Passos | Resultado esperado | OK |
|---|---------|--------|-------------------|-----|
| **1** | `/ia-off` autorizado | Do celular autorizado, chat com número da linha, envie `/ia-off` | Confirmação no chat operador; `hub_agente_identidade.ia_whatsapp_pausada = true` | ☐ |
| **2** | Lead com linha pausada | Com IA global off, lead de teste envia mensagem | HTTP 200 `ia_global_pausada`; **sem** resposta da IA; sem novo job `pending` | ☐ |
| **3** | `/ia-on` | Operador envia `/ia-on` | Confirmação; flag global `false`; lead novo recebe IA | ☐ |
| **4** | Pausa por lead | `/ia pausa 55XXXXXXXX` (lead existente) | Só esse lead com `humano_responsavel`; outros leads com IA | ☐ |
| **5** | Retoma por lead | `/ia retoma 55XXXXXXXX` | `humano_responsavel` limpo; `ia_ativa = true`; IA responde o lead | ☐ |
| **6** | Não autorizado | Telefone **fora** da allowlist envia `/ia-off` | Linha **não** pausa; sem confirmação de comando | ☐ |
| **7** | Lead escreve «ia off» | Lead (não operador) manda texto «ia off» ou «/ia-off» | Tratado como mensagem comum (pode responder IA se ativa) | ☐ |
| **8** | Sem lead fantasma | Operador envia `/ia status` | **Não** cria lead CRM com telefone do operador | ☐ |
| **9** | Handoff fromMe | No celular da linha, responda mensagem de um lead existente | `human_takeover` no log; `humano_responsavel` = slug configurado; jobs do telefone cancelados | ☐ |
| **10** | Corrida lead + `/ia-off` | Lead envia msg; **imediatamente** operador `/ia-off` antes do worker processar | Job existente termina `done` / `ia_global_pausada`; lead **não** recebe resposta IA | ☐ |

### Verificações por cenário

**Cenário 1–3 (global):**

```bash
npm run check:jobs
```

- CRM → Agente (canal WhatsApp): badge «Linha em modo manual» quando pausada.
- Log: `wa.webhook.operador_comando` / `wa.worker.job_skip_global_pause`.

**Cenário 4–5 (por lead):**

- CRM → Atendimento: lead aparece em humano.
- `/ia status`: contagem «Conversas em humano» incrementa/decrementa.

**Cenário 9 (fromMe):**

- Log: `wa.webhook.human_takeover_from_device` com `ok: true`.
- `hub_atividades`: «Atendimento assumido automaticamente (slug)».

**Cenário 10 (corrida):**

1. Envie mensagem do lead.
2. Envie `/ia-off` em &lt; 2 s.
3. Confirme job com `last_error = ia_global_pausada` e ausência de mensagem IA no WhatsApp do lead.

### Testes automatizados (CI)

| Arquivo | Cobre |
|---------|--------|
| `lib/whatsapp/operador-comandos.test.ts` | Parse de todos os comandos + telefone inválido |
| `lib/whatsapp/ia-global-pause.test.ts` | Revalidação de pausa antes do processor |
| `lib/workers/whatsapp-job-worker.test.ts` | Resolução de `agente_slug` no job |
| `lib/whatsapp/webhook-inbound.test.ts` | Parse `fromMe` → `outgoing_human` |

```bash
npm test
```

---

## Variáveis de ambiente

```env
# Telefones autorizados a comandos (DDI 55, vírgula)
WHATSAPP_CMD_PHONES=5511999998888,5511888777666

# Slug em humano_responsavel quando operador responde pelo celular da linha (fromMe)
WHATSAPP_DEVICE_HUMAN_SLUG=wendel

# Alerta CRM se pausa global > N horas (default 4)
WHATSAPP_IA_PAUSE_ALERT_HORAS=4
```

Ver também `.env.example` e [UAZAPI_SETUP.md](./UAZAPI_SETUP.md).

---

## CRM

| Tela | Função |
|------|--------|
| **Contatos** | Toggle «Pode comandar IA» por operador |
| **Atendimento** | Badge «Linha em modo manual» quando `ia_whatsapp_pausada` |
| **Agente** (canal WhatsApp) | Toggle «IA WhatsApp pausada» — espelha `/ia-off` e `/ia-on` |

API: `GET/PATCH /api/hub/agentes/[slug]/ia-whatsapp`

---

## Arquitetura (referência rápida)

```
Inbound lead ──► webhook ──► ia_global_pausada? ──► skip enqueue
                    │
Operador autorizado ──► parse comando ──► executar ──► confirma operador (200, sem lead)

Job enfileirado ──► worker ──► revalidar ia_whatsapp_pausada ──► processor IA
                                    │
                                    └── pausada → done (ia_global_pausada)

fromMe (celular) ──► outgoing_human ──► handoff por conversa (independente de comandos)
```

Código principal: `lib/whatsapp/operador-comandos.ts`, `lib/whatsapp/ia-global-pause.ts`, `lib/workers/whatsapp-job-worker.ts`, `lib/whatsapp/human-handoff-from-device.ts`.
