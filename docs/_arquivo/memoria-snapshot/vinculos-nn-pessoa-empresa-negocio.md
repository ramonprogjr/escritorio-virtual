---
name: vinculos-nn-pessoa-empresa-negocio
description: REQUISITO (implantar em momento oportuno) — nos cadastros de pessoa/empresa/negócio, relacionar pessoas↔empresas (e vice-versa) e todos ao negócio, N:N
metadata:
  type: project
---

Pedido do Wendel (25/jun/2026): nos cadastros de **pessoa, empresa e negócio**, tem que dar pra **relacionar pessoas a empresas e vice-versa**, e **todos ao negócio** — relacionamento **N:N** (uma empresa tem vários contatos; uma pessoa pode estar em várias empresas; o negócio reúne pessoas + empresas). **"Implantar em momento oportuno"** → registrar agora, executar no ponto certo do cronograma (como [[navegacao-renomear-operacoes-arquitetura-engenharia]]).

**Já existe (base para construir em cima):**
- `hub_negocio_vinculos` (N:N negócio↔entidade): colunas `negocio_id`, `entidade_tipo` (pessoa|empresa|parceiro|lead), `entidade_id`, `papel` (cliente|contato_principal|lead_origem|empresa|parceiro|indicador|participante), `codigo_rastreio`, `tenant_id`. Lib `lib/crm/negocio-vinculos.ts` (`criarVinculosNegocioFromLead`). A Ficha do negócio já mostra o bloco "Vínculos".
- Cadastro Ficha (`CadastroContactoSideover`) tem aba **"Vínculos"** (`CadastroVinculosPessoaEmpresa`, `entityType: "pessoa"`) + aba "Leads e negócios" (`/api/crm/pessoas/[id]/vinculos`).
- `hub_pessoas.empresa_id` (FK pessoa→empresa, 1:1) — insuficiente para N:N (pessoa em várias empresas).

**Gap (a implantar):**
- Modelo N:N **pessoa↔empresa** real (não só `empresa_id` 1:1): provável tabela `hub_pessoa_empresa_vinculos` (pessoa_id, empresa_id, papel, tenant_id) OU reusar `hub_negocio_vinculos` generalizado. Decidir o modelo com o dono.
- UI **nos três cadastros**: na Ficha da pessoa → adicionar/listar empresas; na Ficha da empresa → adicionar/listar pessoas; no negócio → adicionar pessoas + empresas (já parcial). Bidirecional, Click-and-Go (picker, não digitar).
- Bidirecionalidade: relacionar em um lado reflete no outro.

Casa com [[spec-funcional-crm-hub-obra10]] (lead/pessoa/empresa separados, vínculos N:N) e [[crm-prioridade-codigo-unico]] (vínculos N:N sem duplicar). Aditivo, gates, mesa redonda UX.
