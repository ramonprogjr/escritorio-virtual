---
name: codigos-rastreio-internos-nao-visiveis
description: Códigos de rastreamento (PS/EM/NG/OB/PJ/REF…) são chave de auditoria INTERNA — NUNCA informação de tela; usuário vê nome/título
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

DIRETRIZ DO DONO (02/jul/2026, verbatim): "ESTES CÓDIGOS DE RASTREAMENTO NÃO DEVEM SER VISÍVEIS, É PARA O NOSSO CONTROLE, ENTENDE?"

## DUAS NATUREZAS de código (decisão do CEO 02/jul, dono delegou "o CEO decide")

**1. CÓDIGO DE IDENTIDADE → ESCONDE.** pessoa(PS), empresa(EM), negócio(NG), obra(OB/REF), projeto(PJ), lead, fornecedor, mão de obra(MDO), imóvel(IM). O usuário chama pelo **NOME/título** ("Marcos", "Obra do Consulado"). O código é só chave de auditoria/junção interna. NÃO aparece.

**2. NÚMERO DE ORDEM/DOCUMENTO → APARECE.** pedido de compra(SC), ordem de serviço(OS), medição, proposta(PP), contrato(CT). Aqui o número **É a etiqueta de rastreamento** da transação — o usuário/fornecedor/campo cita "cadê a SC-0001?", "a OS do serviço X". É como OS/nota fiscal. Esconder quebraria o rastreamento da compra/serviço. FICA visível.

**Regra-teste:** chamou pelo NOME → esconde; é uma ORDEM/documento com número de rastreio (compra, serviço, medição, proposta, contrato) → mostra. (Dono 02/jul: "o pedido de compra deve aparecer para rastreamento da compra ou do serviço como se fosse uma OS".) Insight de produto: pedido de compra e OS convergem num conceito único de "ordem" (compra OU serviço) — relevante à Maratona 2 (serviço universal).

Os códigos de IDENTIDADE são a **espinha de auditoria/junção INTERNA** — plumbing. O **usuário vê NOME e TÍTULO**, nunca esse código. O código liga tudo por baixo (linhagem, rastreio, dedup) sem aparecer.

## RASTREIO = automático, por NOME, em RELACIONADOS (dono 02/jul)
"O RASTREIO DEVE SER AUTOMÁTICO, DEVE APARECER EM RELACIONADOS — as empresas, pessoas e negócios." A rede que os códigos montam APARECE pro usuário — automática, por NOME — na aba **Relacionados** de pessoa/empresa/negócio (deriva de FK/vínculos, sem link manual). Grafo bidirecional: pessoa mostra empresas+negócios; empresa mostra pessoas+negócios; negócio mostra pessoas+empresas+obra/projeto. Só o código CRU é que fica escondido (admin vê a cadeia crua; super_admin edita). [[vinculos-nn-pessoa-empresa-negocio]]

**Why:** o produto é Click-and-Go e IA-first; código na tela polui, parece sistema legado/ERP, e não é linguagem do usuário. A rastreabilidade é um poder do sistema, não um dado que o cliente/parceiro/MDO precise ler. Isso também protege: código exposto num portal externo (cliente/fornecedor) revelaria a topologia interna.

**How to apply:**
- Todo cadastro/seed NASCE com código (imutável, único) — isso continua. Só a **exibição** muda.
- Na UI de produto: mostrar nome/título; **não** renderizar `.codigo` como badge/mono/gold ao lado do nome.
- Exposição atual (02/jul): ~25 telas mostram código — cards de negócio/lead, listas, selects `nome (código)`, obra/projeto/pedidos/especialistas/fornecedores/SC, e o componente `CrmRastreioCadeia` (`RASTREIO · {codigo}`). Precisa de varredura pra esconder.
- "Nosso controle" = a EQUIPE/admin ainda pode precisar ver a cadeia de rastreio (ex.: view interna de auditoria) — confirmar com o dono se some pra todos ou só pros portais externos. [[spec-rastreabilidade-hub-blueprint]]
- Formato do código virou IRRELEVANTE (é interno) — não gastar esforço em "código bonito"; só único+imutável+consistente como chave de junção. [[aec-schema-completo-02jul]]
