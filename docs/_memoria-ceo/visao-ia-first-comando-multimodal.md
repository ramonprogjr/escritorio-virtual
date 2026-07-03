---
name: visao-ia-first-comando-multimodal
description: Visão-norte do dono — IA-first como interface principal (comando universal + voz + multimodal + agêntico), arquitetura "rails + IA"
metadata:
  type: project
---

O dono cravou a visão central do produto (27/jun): a **IA é a interface principal**. Usuário fala/digita/envia mídia (áudio, foto, vídeo, PDF, planta) → a IA **entende e EXECUTA** via tool-calling sobre o sistema determinístico. Tudo medido em **Tijolos** (pré-pago) — robustez (Claude/visão/long-context) = mais Tijolos = receita (por isso quis Claude + Tijolos).

**Arquitetura travada: "RAILS + IA"** — as telas/funções fixas continuam (trilhos confiáveis); a IA é a camada por cima que entende, customiza e **chama as funções como ferramentas**. NÃO jogar as telas fora. Sempre **sugere→usuário confirma** (nunca age cego), principalmente em compra/pagamento/leitura de documento.

**Respostas às 3 perguntas do dono:** (1) telas fixas? sim, como trilhos; (2) IA-first principal? entrada universal (FAB+voz+conversa) agindo via tool-calling; (3) planejar ou iniciar? ambos — norte documentado + começar pelo beachhead.

**Decomposição (cada um = spec próprio, ordem de alavancagem):** V1 menu simplificado (Analytics/Relatórios viram botões no Dashboard) · **V2 = F3 IA-first onde o motor já existe (Distribuição fila/Atendimento sugerir/Dashboard Ação agora) — APROVADO, em andamento** · V3 **FAB de comando "fale com o sistema"** (texto+voz→engine tool-calling→executa+Tijolos) = KEYSTONE · V4 workspace multimodal (Relatórios=Claude-cowork: áudio/vídeo/foto/PDF na tela + Q&A de documento "quantas tomadas a 1,10m") · V5 fluxos agênticos iFood (comprar→fornecedor→orçamento→pedido→pagamento→entrega→follow-up; TRAVA gateway) · V6 dashboard que aprende.

Doc completo: `docs/superpowers/specs/2026-06-27-visao-ia-first-comando-multimodal.md`. Conecta com [[creditos-ia-metering-visao]] (Tijolos), [[agentes-ia-llm-anthropic]] (Claude), [[ceo-mandato-produto]] (telas pro JOB, IA-first), [[diagnostico-tela-a-tela-plano-acao]] (F0-F6; F3 é o beachhead desta visão).
