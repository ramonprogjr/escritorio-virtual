---
name: spec-rastreabilidade-hub-blueprint
description: "Blueprint-mãe do Hub (dono, 02/jul): rastreabilidade total — negócio com linhagem pai/raiz, tudo por ID, imutável, graph-thinking. Base da Maratona 2."
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

O dono entregou a **spec-mãe da arquitetura do Hub** (02/jul), salva verbatim em `docs/insumos-do-dono/SPEC-RASTREABILIDADE-COMPLETA-HUB.md` (+ `VISAO-CODIGO-RASTREAMENTO-UNIVERSAL.md`). É a base da **Maratona 2** e não pode se perder.

**Núcleo:** rastreabilidade end-to-end. Toda entidade (pessoa, empresa, imóvel, produto, serviço, projeto, obra, negócio, contrato, orçamento, proposta, pedido, comissão, documento) = nó com ID único imutável; relações só por ID (nunca texto). **Negócio = entidade central**, e todo negócio guarda `negocio_pai_id` + `negocio_raiz_id` (venda do imóvel = raiz; projeto/obra/marcenaria/... = filhos) → rastreia qualquer serviço até a venda original. Nada se apaga: tudo vira evento (`hub_eventos`). Timeline/árvore navegável no negócio. Analytics (LTV, comissão, conversão) cai de graça do grafo.

**Avaliação do CEO (refinos travados):** (1) separar **UUID** interno (join, já existe) do **código humano** por entidade; (2) **código de IDENTIDADE global** (`PES-`/`EMP-`/`IMV-`/`PRD-`/`SVC-`, dedup CPF/CNPJ, = cadastro = acesso multi-tenant; user aponta pra ele) × **código de DOCUMENTO por-tenant** (`NEG-`/`OBR-`/`CTR-`… via crm_proximo_codigo) — identidade global, papel/acesso por-tenant; (3) linhagem = ÁRVORE (pai/raiz), participantes = GRAFO N:N (não misturar); (4) "cada serviço = novo negócio" mas separar COMERCIAL (kanban) de DERIVADO (árvore), e filho é PROPOSTO (humano confirma), nunca spawn mágico; (5) vínculo pessoa↔empresa TEMPORAL (valido_de/ate); (6) **graph-thinking ≠ banco de grafo** — Postgres (FK+junção+CTE+raiz_id+views) entrega tudo, NÃO trocar de engine; (7) emitir evento em toda mutação; (8) **a RAIZ (fonte de rastreio) = o PRIMEIRO e PRINCIPAL negócio da jornada, de QUALQUER mercado — NUNCA hardcodar um mercado como "a raiz"** (dono 03/jul). No caso Consulado a raiz virou ARQ só porque a 1ª oportunidade no Hub foi a arquitetura; noutra jornada que comece por venda de imóvel a raiz seria IMB. A regra é "primeiro+principal", não o mercado. [[codigos-rastreio-internos-nao-visiveis]]

**Processo (diretriz [[ceo-avaliar-melhorar-antes-de-implantar]]):** raio-x do real (código/DB) → DESIGN interpretado para o dono AVALIAR → só então implantar, aditivo/incremental, começando pela linhagem do negócio. Relaciona [[arquitetura-camadas-negocio]], [[integracao-contas-negocio-spine]], [[crm-prioridade-codigo-unico]], [[vinculos-nn-pessoa-empresa-negocio]].
