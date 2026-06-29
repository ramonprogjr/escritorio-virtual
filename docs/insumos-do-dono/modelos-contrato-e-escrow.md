# Modelos de contrato + Escrow + Engenharia auditorial — insumo do dono (29/jun)

> Respostas do dono (eng. civil + corretor) às perguntas do Portal do Cliente. **Reescreve o financeiro (E6) e o Portal do Cliente.** Ver [[portal-cliente-medos-cura]].

## 1. DOIS modelos de execução (definidos no FECHAMENTO do contrato — IMUTÁVEIS)
O que o cliente vê no financeiro **DEPENDE do tipo de contrato**. São dois formatos que **não podem ser alterados** depois:

### a) Obra por ADMINISTRAÇÃO (campo: "gerenciamento")
- O **engenheiro faz o gerenciamento** da obra; o **cliente efetua os pagamentos**; o **arquiteto geralmente faz o acompanhamento**.
- O cliente **sabe exatamente o valor UNITÁRIO de tudo** (transparência total de custos — é o modelo de gestão aberta).
- Em ambos os cadastros pode-se nomear o campo **"gerenciamento"**.

### b) Obra por PREÇO FECHADO (turn-key)
- A **empresa executante assume** mão de obra, materiais, impostos — tudo (turn-key).
- As informações ao cliente são **SEMPRE sobre os TOTAIS** (não unitário; a composição interna é da executante).

**Implicação de produto:** o módulo financeiro (E6) e o Portal do Cliente **BIFURCAM por tipo de contrato**:
- Administração → mostra valor **unitário** de tudo (gestão aberta), cliente paga cada item.
- Preço fechado → mostra **totais** (avanço × valor de etapa/medição), sem composição interna.
O tipo é um atributo IMUTÁVEL da obra/contrato, escolhido no cadastro.

## 2. Como o Hub garante a verdade (o "selo" — "somos juízes")
Processo rigoroso de **engenharia auditorial** (o Hub é juiz/auditor, não parte interessada):
1. **Onboarding qualifica o fornecedor** (entra na rede já filtrado).
2. **Processos de execução + visitas in loco** — garantem avanços, medidas e prazos (verificação física real, não só declarada).
3. **IA de análise de risco** — riscos futuros, encontrar gargalos antes de virarem problema (proativo, não reativo).
4. **Regime de CONTA ESCROW** (módulo financeiro a implantar) — garante que:
   - o **fornecedor não toma calote** do cliente;
   - o **cliente só paga MEDIANTE APROVAÇÃO** da arquitetura **e, o mais importante, da gente (o Hub)**.
   → o dinheiro fica em custódia e é liberado por gatilho auditado (aprovação dupla: arquitetura + Hub).
5. **Acompanhamento rigoroso:** avanço, diário de obra, análises técnicas de pendências e de projeto.
6. **Forçar os fornecedores a cumprir métricas** + controle de **chegada, acessos, permanência e execução** — para que **nada seja reativo, tudo previsto**.

## 3. O que o cliente aprova na obra
**Todos** — medições, aditivos, mudanças de escopo, marcos — **cada um no seu devido momento, de um jeito simples.** O Hub **faz a ponte e a comunicação clara entre todas as partes** (cliente ↔ arquiteto ↔ fornecedor/obra ↔ Hub).

## Onde isto entra
- **E6 (orçamento→pagamento):** adicionar o eixo **tipo de contrato** (administração/preço fechado) governando unitário×total; e o **gate de pagamento via escrow** (custódia + liberação por aprovação dupla arquitetura+Hub) como evolução do "Aprovado libera pagamento".
- **Portal do Cliente:** a tela financeira renderiza conforme o tipo de contrato; as aprovações (medição/aditivo/escopo/marco) chegam simples, com a ponte do Hub.
- **Hub Arq+Eng:** o processo de auditoria (onboarding→visita in loco→IA de risco→escrow→métricas→controle de acesso) é o módulo de **conduta/qualidade/segurança**, com o time eng/arq/seg/advogado/contador.
