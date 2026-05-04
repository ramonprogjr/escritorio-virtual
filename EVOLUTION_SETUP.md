# Evolution API Setup

## 1. Deploy no Railway

1. Acesse railway.app
2. New Project → Deploy from GitHub
3. Selecione este repositório
4. Configure as variáveis de ambiente abaixo
5. Deploy

## Variáveis de Ambiente no Railway:

```
SERVER_URL=https://SEU_PROJETO.railway.app
AUTHENTICATION_API_KEY=obra10plus_evolution_key
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://postgres:[PASSWORD]@db.cdjlqsznerdhwqyunodl.supabase.co:5432/postgres
WEBHOOK_GLOBAL_URL=https://escritorio-virtual-xi.vercel.app/api/whatsapp/webhook
WEBHOOK_GLOBAL_ENABLED=true
WEBHOOK_EVENTS_MESSAGES=true
WEBHOOK_EVENTS_CONNECTION=true
QRCODE_LIMIT=30
LANGUAGE=pt-BR
```

## 2. Conectar WhatsApp

Após deploy, acesse:
```
https://SEU_PROJETO.railway.app/manager
```
1. Crie uma instância
2. Clique em **Conectar**
3. Escaneie o QR Code com o WhatsApp do número desejado

## 3. Testar

Envie uma mensagem para o número conectado e verifique:
- Logs no Railway
- Tabela `hub_leads_crm` no Supabase (novo lead criado)
- Tabela `hub_atividades` (atividade registrada)
- Tabela `hub_fila_mensagens` (mensagem na fila)

## 4. Variáveis adicionais no .env.local

```
EVOLUTION_API_URL=https://SEU_PROJETO.railway.app
EVOLUTION_API_KEY=obra10plus_evolution_key
EVOLUTION_INSTANCE=obra10plus
```

## 5. Enviar mensagem de volta (via Evolution API)

```bash
curl -X POST https://SEU_PROJETO.railway.app/message/sendText/obra10plus \
  -H "apikey: obra10plus_evolution_key" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999990000",
    "text": "Olá! Sou a Ariane da Obra10+. Como posso ajudar?"
  }'
```

## Fluxo completo

```
WhatsApp → Evolution API → POST /api/whatsapp/webhook
                                    ↓
                          identificarMercado()
                                    ↓
                          encontrarOuCriarLead()
                                    ↓
                          hub_leads_crm + hub_atividades
                                    ↓
                          hub_fila_mensagens (pendente)
                                    ↓
                          buscarAgentePorMercado()
                                    ↓
                          hub_acoes_ia (log)
                                    ↓
                          [futuro] processarMensagem() → resposta automática
```
