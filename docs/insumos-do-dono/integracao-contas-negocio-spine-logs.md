# Integração entre contas: o NEGÓCIO como espinha + "nada se perde" + visão por papel — insumo do dono (29/jun)

> Diretriz arquitetural de como as contas (cliente, arquiteto, engenharia/obra, Hub) se integram. Complementa [[portal-cliente-medos-cura]] e [[modelos-contrato-escrow-auditoria]].

## 1. O NEGÓCIO é a espinha que interliga TODAS as contas
- **O que interliga tudo é o NEGÓCIO do projeto** — e, na origem, **o negócio do IMÓVEL (a venda).** **Todos os outros derivam dali** (projeto → obra → financeiro → pedidos → ...).
- Confirma o que já temos: **negócio = o centro** do CRM. Agora explícito: ele é o **eixo de integração entre contas distintas**, não só dentro de um escritório.
- Cada conta **compartilha** os módulos, **cada uma com o seu acesso e a sua visão** (RBAC+ABAC por papel).

## 2. Módulos compartilhados — com fonte única e visão por papel
- **Projetos:** puxa os dados **diretamente da Arquitetura** (fonte única). Efeito de design intencional: **força o arquiteto a manter os projetos atualizados** — se todos puxam da fonte, a desatualização aparece.
- **Financeiro** e **Pedidos:** módulos que **todos têm que ver** (cada um com o seu acesso).

## 3. "NADA SE PERDE" — log/registro de ABSOLUTAMENTE TUDO (invariante forte)
- **Registro e log de absolutamente tudo.** Regra dura: **nada se perde — mesmo se apagar, o Hub recupera.**
- Implicação técnica: **event log append-only + soft-delete (nunca DELETE físico) + trilha de auditoria imutável**, com o **Hub como backstop de recuperação** (camada acima que guarda o histórico mesmo que o tenant apague). Liga ao "somos juízes" — o Hub tem a verdade histórica.

## 4. Área de MENSAGENS / troca de informações robusta
- Um espaço de **comunicação e troca de informações robusto** entre as partes — **cada um com o seu acesso** (cliente↔arquiteto↔engenharia↔Hub, com escopo por papel). Toda troca também entra no log (nada se perde).

## 5. Anti-POLUIÇÃO: cada papel vê só o que precisa
- O **cliente NÃO precisa ver os pormenores da obra** (a interface pesada de execução).
- O **arquiteto NÃO precisa ver (salvo necessidade) as "entranhas" da empresa de engenharia.**
- Objetivo: **sem poluição** — cada papel recebe a visão curada e relevante. (Casa com o Portal do Cliente dashboard-first e com a régua "não engessado".)

## Como entra no produto
- **Camada de integração:** o `hub_negocios` (negócio) é a chave estrangeira que costura projeto↔obra↔financeiro↔pedidos↔mensagens entre contas; o imóvel/venda é a origem.
- **Auditoria/recuperação:** padronizar event log + soft-delete + recuperação no Hub como invariante de TODOS os módulos (não só alguns).
- **Mensageria:** módulo de mensagens com escopo por papel + log.
- **RBAC/ABAC por papel** governando a visão curada (anti-poluição) em cada módulo compartilhado.
