---
name: comunidade-elo-crm-pendente
description: O elo Comunidade(Membros)→CRM NÃO existe ainda; cadastro manual funciona; plano pronto; PARADO até o dono explicar
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

Mapeamento (28/jun/2026) confirmou: o **elo que traria membros homologados da Comunidade pra -ramon como fornecedor NÃO EXISTE** (zero webhook/sync/import; sem campo `membro_id`/`liberado_crm`). Existe só: grupo de nav "Comunidade" RESERVADO (comentado), taxonomia de especialidades igual à do Membros (vocabulário, não dados), e o espelho INTERNO parceiro→fornecedor (quando homologa, `hub_parceiros`→`hub_fornecedores`).

**Cadastro MANUAL funciona ponta a ponta** (isso é "foco aqui"): fornecedor (form + chips de mercados, dedup CNPJ/CPF/tel), especialista (chips, convite por link, SEM login, vinculado ao tenant), parceiro (captacao→em_homologacao→homologado → espelha fornecedor com `status_acesso=aprovado`).

**PARADO por ora** — dono (28/jun): "no momento correto eu te explico e avançamos com a comunidade, por hora foco aqui". NÃO agir nisso até ele explicar.

**PLANO PRONTO (quando ele explicar):** P0 = decisão de produto: **push** (webhook HMAC — recomendado, mesmo padrão do copiloto) / **pull** (import manual) / **link** (auto-cadastro tipo convite). P1 = migração aditiva `membro_id`+`origem`(manual|parceiro_interno|membro_comunidade)+`homologado_em` em hub_fornecedores/especialistas, unique em membro_id (idempotência). P2 = endpoint webhook HMAC (upsert por membro_id). P3 = tela de import. P4 = unificar `status_acesso` × `status`. Slot `origem="indicado_membro"` já existe em hub_especialistas (sem pipeline). Ver [[membros-cadastro-formato]], [[fluxo-core-captacao-direcionamento]], [[plataforma-arquitetura-visao]].
