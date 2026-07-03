---
name: escrow-universal-chave-tecnica-arq-ou-eng
description: Escrow dupla-chave é UNIVERSAL (todos os pagamentos); a 2ª chave técnica é do responsável — arquiteto (projetos) OU engenharia (obra/prestadores)
metadata:
  type: project
---

Ajuste do dono (03/jul) sobre a mesa RBAC/escrow ([[modelos-contrato-escrow-auditoria]]):

- **O fluxo escrow (dupla-chave) é para TODOS os pagamentos**, não só os de arquitetura. Todo pagamento que move dinheiro passa pelas 2 chaves.
- **A ENGENHARIA (`operation`) também tem fluxo de aprovação** — em especial dos **prestadores de serviço** (mão de obra/serviços da obra).
- Portanto a "Chave 2" NÃO é só do arquiteto. É a **CHAVE TÉCNICA/EXECUÇÃO**, do **responsável técnico daquele pagamento**:
  - pagamento de **projeto/arquitetura** → chave do **arquiteto** (`architect`) responsável;
  - pagamento de **obra / prestador de serviço** → chave da **engenharia** (`operation`) responsável.
- A outra chave é sempre a do **Hub** (pessoa física do Hub raiz — [[modelos-contrato-escrow-auditoria]]). **Nunca o mesmo humano nas duas.**
- Implicação no RBAC: a capability antes chamada `escrow:chave_arquitetura` generaliza para `escrow:chave_tecnica`, atribuída por **papel (architect|operation) + ser o responsável da linha (projeto/obra) + identidade humana distinta + só cookie humano**. Ver docs/DESIGN-RBAC-MULTITENANT.md e [[processo-aprovacao-tela-e2e-mesa-ceo]].

No Consulado: arquiteto responsável = Marcos Takiguthi (`architect`); engenharia responsável = a conta `operation` da Nice (ex.: Roberto Nunes — Eng. Residente). O Hub (owner) = a chave do Hub.
