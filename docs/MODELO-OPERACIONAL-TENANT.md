# 🧭 Modelo Operacional do TENANT (Fornecedor) — blueprint VIVO

> Capturado 01/jul (noite) na conversa com o dono. **VIVO / a enriquecer** com: (1) as
> informações do **Asana** que o dono vai trazer, (2) estudo profundo da **planilha real**
> (`docs/insumos-do-dono/planilha-DUMP.md` + `ANALISE-planilha-gestao-obra.md`), (3) mesa-redonda
> pra travar antes de construir. **Não construir antes de entender MUITO bem** (pedido do dono).

## 1. Estratégia de construção (a ordem)
- **Eixo QUEM:** **Tenant (fornecedor) PRIMEIRO → Hub DEPOIS.** Não dá pra projetar quem gerencia
  todo mundo (Hub) sem saber o que o fornecedor faz. A visão do Hub **emerge** da operação real do
  tenant. (= "construir a COLUNA primeiro".)
- **Eixo CAMADA (dentro do tenant, de baixo pra cima):**
  **mão de obra → prestadores → serviços → engenharia (obra) → arquitetura (projeto) → cliente.**
  Dominar a base destrava o elo de cima.

## 2. O padrão de tela: CARTEIRA → CENTRAL (não funil de lead)
- **Fornecedor = portfólio.** Ele tem **vários projetos e/ou obras**.
- A tela do módulo lista a **CARTEIRA** (cards); cada card abre a **CENTRAL** daquele item — a tela
  que **unifica a cadeia por baixo**. (Engenharia/Obras já segue isso; Arquitetura está errada como
  funil de LEAD — deve virar carteira de PROJETOS.)

## 3. A espinha (a cadeia) — opção A travada
```
NEGÓCIO (fechado, CRM comercial)
  └─► PROJETO   (arquitetura)  → carteira "Arquitetura" → central do projeto (fases + obra(s) que gera)
         └─► OBRA (engenharia) → carteira "Engenharia"  → cockpit da obra (EAP/frentes)
                └─► SERVIÇOS/frentes → mão de obra + prestadores → financeiro/escrow → CLIENTE (portal)
```
- **Projeto e Obra = entidades LIGADAS** (não a mesma). Um projeto gera 1+ obras; uma obra pode
  existir **sem projeto** (reforma direta) — fork "com/sem projeto" (já na planilha). Cross-linkadas.
- Já existe no banco: `hub_negocios → hub_projetos → hub_obras`.

## 4. ⭐ O SERVIÇO = a UNIDADE UNIVERSAL DE EXECUÇÃO (a peça que unifica tudo)
Qualquer serviço — **da instalação de uma banheira ao empreiteiro geral ao serralheiro** — segue o
**MESMO ciclo**. O módulo de **Serviços serve pra TODOS**:

> **Escopo → Contrato → Preço → Cronograma → Compras (materiais) → Check-in (campo) → Diário de obra
> → Medição → Aprovação → Entrega → Pagamento.**

- O **serviço é o átomo de execução**. Uma **OBRA = um conjunto de serviços/frentes** (cada frente é
  um serviço com esse ciclo). Bate 1:1 com o `Detalhamento` da planilha (subitem por disciplina×andar,
  com início/término, % avanço, bloqueios, medição).
- Por isso o serviço é o **alicerce** da cadeia de baixo pra cima: é o que o **prestador / mão de obra**
  realmente executa. (Liga ao marketplace/rede de ofícios — "iFood da construção".)

## 5. Os 4 tipos de fornecedor (tenant) sobre a espinha
| Tipo | Opera | Unidade de carteira |
|---|---|---|
| **Arquitetura** | gestão de **projetos** | Projeto → central do projeto |
| **Engenharia** | gestão de **obras** | Obra → cockpit da obra |
| **Serviços** | execução de **serviços** (banheira→empreiteiro→serralheiro) | Serviço → ciclo universal (§4) |
| **Produtos** | **catálogo / pedidos / estoque** | Produto/Pedido ("iFood da construção") |
Um fornecedor pode ser **mais de um tipo** (arquiteto que também faz obra) → carteiras cross-linkadas.
Transversal a todos: **CRM comercial + Dashboard + Central de Aprovações**.

## ⭐ Fonte ÚNICA, LENTES por papel (o modelo de COLABORAÇÃO)
Quando o arquiteto **FECHA um projeto**, ele já nasce **conectado ao negócio + ao cliente**, e daí puxa
**engenharia, marcenaria, serviços**. **Todos veem a MESMA COISA (fonte única de verdade — o mesmo
projeto/obra), mas cada um com o SEU ponto de vista** — a fatia + os **controles** + a **automação** da
sua necessidade:
- **Arquiteto:** fases do projeto, pranchas, aprovação do cliente.
- **Engenheiro:** a obra que decorre — EAP, cronograma, medição, financeiro.
- **Marceneiro / serralheiro / prestador de serviço:** SÓ a sua frente/serviço (escopo, cronograma dele,
  medição, aprovação, pagamento dele) — não vê o resto (anti-poluição).
- **Cliente:** o macro — avanço, marcos, o que ele precisa **aprovar** (portal que cura os 5 medos).
Um **único grafo** `negócio→projeto→obra→serviços`; cada papel **lê/escreve a SUA fatia**; o todo é
**auditável** (Hub = juiz; nada se perde). É **colaboração sobre 1 verdade**, não cópias soltas —
= "visão curada por papel / anti-poluição" + integração-de-contas (o negócio é a espinha).

## 6. ⭐ O MOAT = PREDITIVO por cruzamento de dados
Como TODO serviço/obra/projeto registra escopo, preço, compras, prazo, medição (append-only +
`hub_eventos` keystone), a IA **cruza tudo** e fica **preditiva em tudo**: elaboração do projeto,
**levantamento das planilhas orçamentárias**, compras de materiais, prazos, riscos. O cérebro da obra
é o diferencial. **IA-first + CONVERSACIONAL** (fala/escreve, a IA executa e prevê).

## 7. Premissas inegociáveis
**Click-and-Go / Talk-and-Go** (escolher e confirmar, não digitar) · **fácil de usar** · **IA-first e
conversacional como base** · telas para o JOB (não tabela) · marca verde+dourado dark · mobile-first ·
**nada se perde** (append-only + Hub recupera).

## 8. Pendências antes de construir
- [ ] Dono traz **infos do Asana** (docs de obra/gestão).
- [ ] Claude estuda **profundamente** a planilha (`planilha-DUMP.md`) — o modelo de dados real.
- [ ] Mesa-redonda pra **travar o modelo** (esta doc) + decidir o 1º entregável (recomendação: começar
      pela **base** = gestão de mão de obra/serviço, subindo).
