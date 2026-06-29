# Serviços + cadeia de contratação + monetização em camadas — insumo do dono (29/jun)

> Como o módulo de Serviços vira o marketplace/cadeia da rede, e por que isso é o motor de captura de valor. Complementa [[monetizacao-licenciamento-rede]], [[especialistas-cadastro-mao-de-obra]], [[integracao-contas-negocio-spine]].

## 1. Dentro de SERVIÇOS: toda a cadeia de ofícios
O módulo **Serviços** (dentro de Engenharia: Construção / Reforma / **Serviços** = base executiva) tem que ter todos os ofícios que o arquiteto contrata:
**marcenaria, marmoraria, vidraçaria, serralheria, pintura, elétrica** — e por aí (hidráulica, gesso/forro, climatização, impermeabilização, etc.). É a **cadeia de serviços** completa.

## 2. A HIERARQUIA de contratação (a cadeia da rede)
Quem contrata quem — cada nível é um elo no Hub:
```
ARQUITETO
   └─ contrata → ENGENHARIAS / EMPREITEIRAS (do Hub)
                    └─ contratam → PRESTADORAS DE SERVIÇOS (marcenaria, vidraçaria, ...)
                                      └─ contratam → MÃO DE OBRA cadastrada (quando há necessidade)
```
- São **contas/papéis distintos** transacionando **através do Hub** (que media, audita e registra — "nada se perde").
- A **mão de obra cadastrada** entra **quando há necessidade** (sob demanda) — liga ao cadastro de **especialistas = mão de obra** (sem login, base vinculada ao fornecedor).

## 3. Por que isso importa: CONTROLE + CAPITALIZAÇÃO em todo o processo
- Com a cadeia mapeada no Hub, temos **máximo controle** e podemos **capitalizar em TODO o processo** — cada **handoff de contratação é uma transação** onde o Hub captura valor (spread/comissão/split por código único; ver [[monetizacao-licenciamento-rede]]).
- **Razão estratégica do dono:** a **mão de obra é um commodity cada vez mais RARO e CARO.** Quem controla a cadeia + o pool de mão de obra controla o gargalo do mercado → valor defensável e recorrente.

## Como entra no produto
- **Módulo Serviços (Engenharia):** catálogo de ofícios + o cadastro de **prestadoras de serviços** por ofício; cada uma puxa **mão de obra** sob demanda.
- **Camada de contratação/marketplace:** modelar o elo "X contrata Y" (arquiteto→eng/empreiteira→prestadora→mão de obra) como **contratações encadeadas**, cada uma com código único p/ o split (monetização transacional).
- **Monetização:** spread/comissão por elo da cadeia (além da assinatura SaaS); o Hub é o trilho por onde tudo passa.
- **Auditoria:** cada contratação entra no log (nada se perde), com onboarding qualificando cada elo (eng. auditorial).
