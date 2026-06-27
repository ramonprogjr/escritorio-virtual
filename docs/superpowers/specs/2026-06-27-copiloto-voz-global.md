# 🎙️ Copiloto de Voz Global + Agentes por Setor + WhatsApp Agnóstico

> Spec (mesa redonda de 5 lentes com auditoria do código). 27/jun/2026. Conecta [[visao-ia-first-comando-multimodal]], [[agent-builder-ia-fase1]], [[central-aprovacoes-agentes-setor]], [[creditos-ia-metering-visao]].

## A virada
Um **botão verde flutuante e arrastável** em TODA tela do CRM (PC+mobile). 1 toque → o dono fala → vê a **transcrição ao vivo** → a IA **confirma o que entendeu + a ação** antes de executar (sugere→confirma, anti-quebra) → faz qualquer coisa via tool-calling. Anthropic (potente/crítico) × Mistral (cotidiano+transcrição). É o "Copiloto · Em breve" do menu (`/crm/agentes-reais`).

## Decisões-chave (resolvidas por evidência no código)
- **Endpoint fino dedicado** (`/api/copiloto/*`), NÃO reusar `engine.ts/processarMensagem` (que tem side-effects de fila/WhatsApp). Chamar `executarFerramentaHub(tool, argsJson, {tenantId})` + `completarChatPreferindoMistral` direto.
- **Segurança por construção:** Fase 1 só as 4 ferramentas `HubFerramentaNivelAcesso==='leitura'` (mapa já existe no registry: hub_lead_resumo, hub_lead_memorias, hub_lead_lookup_por_telefone, hub_metricas_escritorio) + navegação client-side. Escrita IMPOSSÍVEL na fase 1; o endpoint rejeita.
- **Leitura executa direto** (sem fricção); **escrita SEMPRE** mostra card "O que vou fazer" com params EXATOS (JSON colapsável) + Confirmar.
- **Confirmação stateless** = `confirmacaoId = HMAC(COPILOTO_HMAC_SECRET, ferramenta+JSON(params)+timestamp)`, TTL 5min. Sem tabela nova (serverless-safe).
- **Transcrição:** Web Speech API (browser, grátis, ao vivo, lang pt-BR, interimResults) principal; **Voxtral** (`mistralTranscreverAudioBuffer`, já existe) fallback. NÃO debita Tijolos a transcrição local.
- **Interação:** tap-para-iniciar / tap-para-parar (toggle), auto-stop por silêncio 3s. iOS exige `SpeechRecognition.start()` direto no handler do toque.
- **FAB** no `app/crm/layout.tsx` (desktop+slimMobile), dynamic import `ssr:false`. Mobile canto inf. direito; desktop inf. esquerdo (CrmQuickAdd ocupa a direita). Drag threshold 8px, snap ao canto, posição em localStorage. Some quando modal CRM aberto.
- **Roteamento:** Mistral p/ intenção/cotidiano (~80%); Claude Haiku p/ crítico (valor alto/criação/confiança<0.75); degrada p/ Mistral sem erro se sem ANTHROPIC_API_KEY; chip do modelo visível.
- **Tenant SEMPRE da sessão Supabase**, nunca do body; validar leadId↔tenant. Rate-limit ~30/min. Checar `saldoCreditos()<0`.
- **Setor do agente:** runtime via `hub_cargos_catalogo.segmento` (sem migração); coluna `setor_ia` = migração futura (Fase 6, bloqueada).

## Fases (aditivo, gate tsc+vitest+build + DEPLOY por fase)
- **Fase 0 — Fundação:** 3 endpoints (`transcrever`/`interpretar`/`executar`) + `hooks/useCopilotoVoz.ts` + `.env.example` (COPILOTO_HMAC_SECRET) + rate-limit. Gate por construção (só leitura). **Testável por curl.** Risco médio.
- **Fase 1 — Copiloto visível:** `CopilotoVozFab` + `CopilotoVozSheet` (3 zonas: status+chip modelo · transcrição ao vivo · ação/resultado) + `CopilotoVoz` + montar no layout + substituir `agentes-reais` (central do copiloto + histórico de `hub_ia_consumo` origem `copiloto_%`). Só leitura. Risco médio.
- **Fase 2 — Dores mobile:** editor do agente em **abas no mobile** (Config padrão / Comportamento+Ferramentas / Atividade no fundo — logs/memórias/limpar); leads mobile sem sobreposição (header+PipelineTabsBar numa sticky de 56px, kanban scroll-snap). Mover blocos JSX inteiros, sem tocar handlers. Risco médio.
- **Fase 3 — Copiloto de ESCRITA:** liberar `hub_registar_nota_lead` + `hub_atualizar_lead` com card + diff campo-a-campo + JSON; Claude p/ crítico. Risco alto.
- **Fase 4 — Setor + tarefas:** `lib/hub/agente-setor.ts` (segmento→setor→ferramentas) + `lib/hub/tarefas-setor-catalogo.ts` (chips) + wizard pré-seleciona ferramentas recomendadas + passo Tarefas (salva em `hub_tarefas` ref_tipo=agente). Sem migração. Risco médio.
- **Fase 5 — WhatsApp agnóstico + polish:** `lib/whatsapp/whatsapp-provider.ts` (interface) + `uazapi-adapter.ts` + `whatsapp-send.ts` usa `getWhatsappProvider()` (env WHATSAPP_PROVIDER); NÃO tocar webhook/worker; renomear labels "UAZAPI"→"WhatsApp (via UAZAPI)"; shell detalhe + tabela→cards + 8 passos. Risco médio.
- **Fase 6 — BLOQUEADA (seu OK):** seed `copiloto-global` + `ALTER TABLE … ADD COLUMN setor_ia`. SQL pronto p/ revisão + rollback. NÃO aplicar sem aprovação.

## Riscos & mitigações
- Web Speech irregular (Safari iOS/Firefox Android) → fallback Voxtral; HTTPS obrigatório (testar em prod).
- iOS: start() direto no toque.
- **Escrita errada por transcrição** = maior risco → Fase 1 só leitura (gate por construção); escrita só na 3 com params exatos+diff+HMAC.
- Multi-tenant: tenantId da sessão, validar leadId↔tenant.
- Claude dormente → degrada p/ Mistral; chip do modelo visível.
- Drag×scroll kanban → threshold 8px.
- Mover ~1300 linhas p/ tabs → mover blocos inteiros, gate+visual, commit reversível.
- Custo por spam → rate-limit + saldo.

## Régua
Voz que comanda qualquer tela, **mostra o que entendeu e o que vai fazer antes de fazer**, e nunca escreve sem confirmação. Aditivo, mobile-first, na marca verde+dourado.
