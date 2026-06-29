---
name: pendencias-etapa-copiloto-agentes
description: "Pendências da etapa copiloto/agentes — o que foi ENTREGUE e o que ainda espera o dono (chave Mistral) ou é feature futura (follow-up, catálogo de cargos)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

Etapa de auditoria/copiloto/agentes (27/jun). Conecta [[copiloto-voz-global]], [[agent-builder-ia-fase1]], [[design-overhaul-deferido]], [[metodo-auditoria-adversarial-validacao]].

## ✅ ENTREGUE e DEPLOYADO (feature/escritorio-visual)
- **#16 IA-first na PORTA da criação** — 3º modo "✨ Descrever para a IA montar" no passo 1 do wizard (ao lado de Cargo / Só playbook). Fluxo: nome+mercados → "Criar e montar com IA" cria agente mínimo → reusa AgenteBuilderIaPanel com o slug → gera → publica. Tolerante à falta da chave (cria o agente, geração erra gracioso). A GERAÇÃO AO VIVO ainda exige `MISTRAL_API_KEY` no Render.
- **#13 conhecimento/tarefas EDITÁVEL na ficha** — painel colapsável "Conhecimento e tarefas" na aba Config + endpoint novo `/api/hub/agentes/[slug]/conhecimento` (GET+PUT, service-role, upsert manual).
- **setor_ia (Fase 6 opção A)** — coluna aplicada na produção E wirada: wizard salva o setor derivado, editor mostra/edita (select), leitura cai no derivado do cargo se nula.
- **Dogfooding crítico (o dono criou agente e apontou)** — DEPLOYADO: matou o JARGÃO técnico da etapa de operação ("Trabalha nos bastidores" vs "Atende no WhatsApp", sem hub_ciclos_ia/cron/"legado"); badge "Recomendado" CONTEXTUAL (cargo de atendimento/comercial → WhatsApp); catálogo de cargos COLAPSA após escolha (+"Trocar cargo"); "Criar e finalizar" + "Agente criado — finalize abaixo" (fim do "3 passos" enganoso); pt-PT→pt-BR (INACTIVO→INATIVO, Actualizar→Atualizar em 8 arquivos).
- **🧪 Teste de criação completa** — FEITO ao vivo pelo Code (criou "Teste Crítico" e "Verifica" ponta a ponta, validou criar+operar, e APAGOU via DELETE /api/hub/agentes/[slug] ok:true). O dono também criou "Marina" com sucesso.

## 🔜 PENDE DO DONO / FEATURE FUTURA
- **🔑 `MISTRAL_API_KEY` + `COPILOTO_HMAC_SECRET` no Render (dono, por último)** — sem a chave nenhuma IA do web service responde (copiloto, Agent Builder/#16, atendimento). COPILOTO_HMAC_SECRET: sem ela o copiloto retorna 503 (fail-closed).
- **#6 Follow-up mais claro/customizável** — pedido do dono no dogfooding. É FEATURE (cadência, nº de tentativas, gatilhos de reativação), não troca de texto. Hoje follow-up é 1 chip de tarefa ("Fazer follow-up de quem ficou sem resposta"). Propor desenho quando o dono quiser.
- **Catálogo de cargos — limpeza** (dono: "por hora está bom", fazer com sinal): em `hub_cargos_catalogo` (23 cargos ativos). (1) cargo slug `mari_pre_vendedora_imobiliaria_e_de_proj` tem "Mari —" no título = nome de AGENTE num CARGO (errado, renomear pra genérico); (2) redundantes no Comercial (slug `sdr` "Qualificador de Leads" + slug `sdr_qualificacao` "SDR - Qualificação"; dois "Atendente"); (3) muitos cargos Marketing/Operações talvez não usados → desativar (ativo=false, reversível) os que o dono confirmar. É dado no DB (UPDATE); checar se há seed no repo antes (provável que NÃO — só migrations de RPC/config).

## 🔒 copiloto-global seed (Fase 6, deferido) — NÃO feito
O seed `hub_agente_identidade` slug=copiloto-global foi DEFERIDO (o copiloto não lê agente do DB; seria schema morto). Só a coluna setor_ia foi aplicada. Não refazer sem necessidade real.
