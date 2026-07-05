---
name: sessao-entregas-jun2026
description: "Entregue na sessão Jun/2026 (branch wendel/dev, LOCAL, sem push/deploy) — CRM manual F#1–F#4, fix login autofill, fix drift hub_atividades; tudo provado ao vivo. Próximo = menu lateral + instrução p/ devs"
metadata: 
  node_type: memory
  type: project
  originSessionId: 635246fa-0a11-4787-bf12-7900cf1c8059
---

Estado ao fim da sessão de 24/06/2026 (branch **wendel/dev**, base feature/escritorio-visual). **Tudo commitado LOCAL — nada pushado, nada deployado.** Spec de sistema + handoff completo em **docs/INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md**.

**Entregue e PROVADO AO VIVO (logado no /crm local):**
- **F#1** — especialistas/fornecedores editáveis (GET+PATCH).
- **F1.1** — negócio flexível estilo Pipedrive: `hub_negocios.pessoa_id` e `lead_id` agora NULLABLE; criar negócio direto (código `NGIMB2026001`).
- **F#2** — roteamento de leads configurável (`hub_lead_routing_regras` + `resolverDestinoLead`, fallback heurístico). Ver [[distribuicao-leads-motor]].
- **F#3** — canais de entrada (`hub_canais_entrada` + CRUD + UI /crm/canais-entrada). CRUD provado 201/200.
- **F#4** — colunas customizáveis (localStorage) + ficha do negócio: **próxima-ação auto-save**, **nota na timeline**, **vínculo pessoa↔negócio** (picker busca + PATCH pessoa_id).
- **Fix login** — formulário lia só o state do React; autofill do navegador não dispara onChange → login falhava a menos que editasse os campos. Agora lê o valor real do DOM no submit. (A senha real do Wendel é a SALVA no navegador dele, NÃO "Obra10Wendel!2026", que é rejeitada.)
- **Fix drift `hub_atividades`** — faltava coluna `negocio_id` (timeline do negócio nunca funcionou, falhava em silêncio) + `lead_id` era NOT NULL. Adicionado negocio_id + lead_id nullable. Doc: docs/sql/fix-hub-atividades-negocio-APPLIED.sql.

**Mudanças de schema aplicadas via MCP (todas aditivas/reversíveis, doc em docs/sql/*-APPLIED.sql):** códigos atômicos (`crm_proximo_codigo` + `hub_codigo_contador`); negócio flexível; `hub_canais_entrada`; `hub_atividades` negocio_id+lead_id.

**PRÓXIMOS PASSOS (ordem):** 1) **arrumar o menu lateral** (refletir plataforma: Comercial/CRM · Operações/Obras · Fornecedores · Financeiro · IA/Agentes — ver [[plataforma-arquitetura-visao]]); 2) **gerar instrução detalhada p/ devs** (estava começando quando o Wendel pediu handoff); 3) detalhar módulo **Compras** (pendente, ver [[modulo-engenharia-obra]]); 4) IA/Bloco H = futuro. Travas em [[modo-operacional-code]].
