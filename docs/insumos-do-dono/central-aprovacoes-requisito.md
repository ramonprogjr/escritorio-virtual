# Central de Aprovações — requisito (insumo do dono, 29/jun)

> A tela que faz TODAS as frentes andarem. Complexa → mesa redonda dedicada. Liga a [[central-aprovacoes-agentes-setor]], [[modelos-contrato-escrow-auditoria]] (escrow dupla-aprovação), [[portal-cliente-medos-cura]] (aprovações do cliente), `hub_aprovacoes`.

## O requisito (palavras do dono)
- **Tudo controlado IA-first + conversacional.**
- A **tela Aprovações** deve existir em **TODOS os usuários** e ser **metodicamente pensada** — tem **peso enorme** para **facilitar o avanço de TODAS as frentes, para todos os usuários**.
- Organizada **por MERCADO, ATIVIDADE e TIPO**.
- Definir como funciona **para cada local / cada persona E para o Hub.**
- Parece complexo → **mesa redonda** (o dono pediu).

## Por que é central (minha leitura)
É a **superfície unificadora de TODOS os gates** que já espalhamos pelo sistema:
- Medição de obra (E7), **escrow + dupla-aprovação arquitetura+Hub** (E6), aprovações do **cliente** (A1: medição/aditivo/escopo/marco), **compra/SC** (E5), **restrições/SST** (E3), liberação de acesso (campo), orçamento aprovado (E6/Orçamento IA).
- Hoje cada um tem seu gate; a Central os reúne numa **fila priorizada pela IA**, por persona, com **auto-aprovação do trivial** + **humano no checkpoint do crítico** + a **decisão ENSINA o agente** (loop) — o conceito de [[central-aprovacoes-agentes-setor]], agora elevado a tela de 1ª classe em todos os perfis.

## A definir na mesa (cada persona + o Hub)
- **Por persona:** o que o cliente / arquiteto / engenharia / fornecedor / gestor APROVA, e como a fila aparece pra cada um (escopo por papel, anti-poluição).
- **O Hub (juiz):** vê e decide tudo (auditoria); a 2ª chave do escrow; o que pode auto-aprovar.
- **Eixos de organização:** mercado × atividade × tipo (filtros e agrupamento).
- **IA-first:** a IA prepara, prioriza, recomenda e auto-aprova o trivial (por nível de autonomia 1→5); humano confirma o crítico; conversacional ("aprovar medição 3").
- **Dados:** unificar sobre `hub_aprovacoes` (com o **fix do vazamento tenant** — pré-req) + os elos de cada bloco; cross-conta (o envolvido vê, só o dono/Hub decide — ver [[crm-cross-conta-visibilidade-permissao]]).

## Status
Mesa redonda em execução (29/jun). Resultado → `docs/CENTRAL-APROVACOES-DESIGN.md`.
