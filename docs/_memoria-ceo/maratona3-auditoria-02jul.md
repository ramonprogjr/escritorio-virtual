---
name: maratona3-auditoria-02jul
description: "Auditoria de segurança M3 (02/jul) — middleware VIVO (não morto), furo anon-RLS crítico, lista code-safe × janela do dono"
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

Auditoria da Maratona 3 (02/jul/2026, 4 lentes + verificação própria ao vivo). Corrige e supera a [[auditoria-enterprise-01jul]].

## CORREÇÃO GRANDE: MIDDLEWARE NÃO ESTÁ MORTO
Provado: `node_modules/next/dist/lib/constants.js` → `PROXY_FILENAME='proxy'`. **O Next 16 renomeou `middleware`→`proxy`.** O `proxy.ts` da raiz É o middleware e RODA (node middleware; runtime: GET /crm sem cookie → 307 /login; /api → 401 com o JSON do proxy). O `middleware-manifest.json` vazio é POR DESIGN (node middleware usa functions-config-manifest). **NÃO apagar nem renomear proxy.ts** (renomear→EDGE, quebra; apagar→perde auth de página+/api coarse). O proxy só faz auth GROSSA ("tem sessão?") — SEM tenant/role; **os guards por-rota são a camada real de autorização** e ficam.

## 🚨 CRÍTICO — anon faz CRUD/DELETE AGORA (janela do dono, URGENTE)
Verificado em pg_policies + grants: `hub_obras`, `hub_projetos`, `hub_tarefas_comerciais`, `hub_contatos_notificacao` têm política FOR ALL `{anon}` (tenant NULL OR Obra10) + GRANT anon → qualquer um na internet com a anon key apaga/edita tudo. Legadas `leads`/`crm_deals`/`crm_persons` (schema inglês órfão, PII) idem. FIX pronto: **docs/APLICAR-URGENTE-RLS-anon.sql** (seguro — app é service-role). `hub_pessoas`/`hub_empresas`/`hub_negocios`/`hub_pipelines` JÁ endurecidas.

## Code-safe (EU conserto, sem o dono) — IDOR/guards por-rota faltando
GET fornecedores/[id] (sem guard+sem tenant → vaza PII+comissão); PATCH leads/[id] (busca tenant mas não checa); canais-entrada/[id] PATCH+DELETE; distribuicao/regras/[id] PATCH+DELETE; pedidos/[id] PATCH; parceiros/[id]/liberar POST; POST /api/leads (api_leads_legacy, grava no default); agents/[id] GET/PUT (mock, sem guard); kpis/calcular count de hub_fila_mensagens sem tenant. Ponto cego do gate: `guard-coverage.test.ts` casa guard no ARQUIVO todo (multi-método passa com 1 método guardado) → refatorar por-método.

## Rate-limit IA (EU conserto — pedido do dono [[rate-limit-ia-anti-abuso]])
Só `/api/copiloto/interpretar` tem limite hoje. Faltam (code-safe): negocios/copilot + hub/playbook/analisar-conteudo (SEM auth+RL+metering — pôr os 3), copiloto/transcrever (25MB áudio), hub/agentes/*chat/sugerir/gerar/*, whatsapp/webhook (por telefone). Infra existe: `lib/rate-limit-memoria.ts` rateLimitExcedido + copiloto-core dentroDoRateLimit. Fatorar `requireIaRateLimit`. Bônus: gate `saldoCreditos()` ANTES do LLM (hoje só interpretar).

## Janela do dono (SQL/migração) — além do anon-RLS urgente
authenticated com USING(true)/qual=true sem tenant em ~várias hub_* + schema legado inglês; tenant NULL backfill → então trocar tenantScopeOrFilter (is.null+default) por eq puro; migração forward que codifica o estado endurecido (repo↔live drift: `supabase db reset` recriaria as políticas anon inseguras); dropar schema legado inglês (destrutivo). Injeção PostgREST em hub/ciclos `q` sem sanitizar = code-safe (sanitizarBuscaPostgrest). Footgun: proxy.ts:118 401 menciona NEXT_PUBLIC_INTERNAL_API_KEY (reintroduziria vuln fechada) = tirar frase.
