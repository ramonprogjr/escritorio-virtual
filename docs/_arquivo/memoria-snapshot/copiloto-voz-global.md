---
name: copiloto-voz-global
description: Copiloto de Voz Global (FAB→fala→transcreve→confirma→age) — Fases 0-5 ENTREGUES/deployadas; Fase 6 (migração) espera OK do dono
metadata:
  type: project
---

**Copiloto de Voz Global** = botão verde flutuante/arrastável em toda tela do CRM (PC+mobile) → fala → transcrição ao vivo → IA classifica intenção → leitura responde direto, ESCRITA mostra "Vou fazer X" + params + [Confirmar] antes de agir. Anthropic (crítico) × Mistral (cotidiano). É o "Copiloto" do menu (`/crm/agentes-reais`). Spec: `docs/superpowers/specs/2026-06-27-copiloto-voz-global.md`. Conecta [[visao-ia-first-comando-multimodal]], [[agent-builder-ia-fase1]].

**ENTREGUE e DEPLOYADO (27/jun, branch wendel/dev→feature/escritorio-visual):**
- Endpoints `app/api/copiloto/{transcrever,interpretar,executar}` + `lib/copiloto/copiloto-core.ts` (gate por `HUB_FERRAMENTA_ACESSO`, allowlist escrita `COPILOTO_FERRAMENTAS_ESCRITA_FASE3`=[hub_registar_nota_lead,hub_atualizar_lead], `ferramentaExecutavel()`, HMAC `assinar/validarConfirmacao` TTL 5min, rate-limit, prompt) + `copiloto-auth.ts` (cookie CRM, tenant runtime via defaultTenantId). 14 testes.
- `hooks/useCopilotoVoz.ts` + `components/crm/CopilotoVoz.tsx` (FAB arrastável, painel 3 zonas, montado em `app/crm/layout.tsx` dynamic ssr:false nos 2 branches). `agentes-reais` = central do copiloto (histórico hub_ia_consumo origem copiloto_%).
- **Segurança:** escrita NUNCA auto-executa (só `confirmarAcao()` no botão); HMAC validado 1º no /executar; tenantId da sessão; estágios ganho/perdido bloqueados no servidor.
- **NÃO reusa engine.ts** (chama `executarFerramentaHub` + `completarChatPreferindoMistral` direto, p/ evitar side-effects da fila WhatsApp).
- **Fix pós-feedback do dono** ("não fecha / não escuta"): `aoTocarFab` fecha (era reabrir) + backdrop + X maior; erros do SpeechRecognition agora visíveis; **fallback Voxtral** (grava→/transcrever) p/ iOS Safari (sem Web Speech).

**Junto vieram:** Fase 2 editor do agente em ABAS no mobile (Config padrão/Ferramentas&Canal/Atividade-no-fundo) + leads mobile sticky→relative; Fase 4 `lib/hub/agente-setor.ts`+`tarefas-setor-catalogo.ts` (agente sabe o setor → ferramentas+tarefas recomendadas no wizard, tarefas via conhecimento_secoes, sem migração); Fase 5 `lib/whatsapp/whatsapp-provider.ts`+`adapters/uazapi-adapter.ts` (envio provider-agnóstico, `getWhatsappProvider()` env WHATSAPP_PROVIDER default uazapi, delegação pura — webhook/worker intocados).

**Fase 6 BLOQUEADA (espera OK do dono):** seed `hub_agente_identidade` slug=copiloto-global + `ALTER TABLE hub_agente_identidade ADD COLUMN setor_ia TEXT`. É MIGRAÇÃO → precisa aprovação. Sistema funciona 100% em runtime SEM ela (otimização/persistência). Quando o dono aprovar, escrever SQL+rollback lendo o schema real.

**Env nova:** `COPILOTO_HMAC_SECRET` (obrigatória em prod — assinar propostas). `WHATSAPP_PROVIDER` (default uazapi).
