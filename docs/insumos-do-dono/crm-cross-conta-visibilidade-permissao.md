# CRM cross-conta: visibilidade do negócio + permissão por envolvimento — insumo do dono (29/jun)

> Como o negócio/lead/imóvel aparece nos CRMs de todos os envolvidos, com permissão diferenciada e a cor do mercado de origem. **Mesa redonda quando chegar a hora** (pedido do dono). Liga a [[integracao-contas-negocio-spine]], [[distribuicao-leads-motor]] (lead mestre×vinculado), [[modelos-contrato-escrow-auditoria]], e ao design `docs/PLATAFORMA-DESIGN.md` (hub_negocio_acessos).

## 1. O Hub vê os pipelines/CRM dos usuários
No sistema principal (Hub), **acesso aos pipelines e CRM dos usuários** — ver os **leads e negócios** de todos. (É a camada de auditoria/gestão-da-gestão sobre os CRMs dos membros.)

## 2. Funis customizáveis + funil obrigatório no mercado principal
- **Todos os funis são customizáveis/editáveis** — tanto no **Hub** quanto no **membro** (escritório/usuário).
- **OBRIGATÓRIO:** todo usuário tem **um funil no seu mercado principal** (não pode ficar sem).

## 3. O negócio cross-conta: aparece para TODOS os envolvidos (mas 1 dono)
Quando um **arquiteto traz um imóvel** para o **corretor** e o imóvel está sendo negociado:
- O **cadastro do imóvel**, a **movimentação do lead** E o **negócio** aparecem no **CRM de todos os envolvidos**.
- **Mas só o DONO do negócio (e nós, o Hub) pode EDITAR ou MOVER** na esteira.
- Aparece em todos os CRMs envolvidos **com as cores e informações do MERCADO ORIGINAL** (a cor do mercado de onde o negócio nasceu).

## 4. Permissão por envolvimento (o coração)
| Papel no negócio | Vê | Move na esteira | Comenta / atribui info |
|---|---|---|---|
| **Dono do negócio** | ✓ | ✓ (só ele) | ✓ |
| **Hub** | ✓ (todos) | ✓ (juiz) | ✓ |
| **Envolvido** (ex.: arquiteto que trouxe o imóvel) | ✓ (cor do mercado original) | ✗ **não move** | ✓ comenta + atribui informações |

**Exemplo do dono:** o arquiteto vê o **lead imobiliário** no seu CRM, **sabe que é porque está envolvido no negócio**, **acompanha o avanço**, mas só pode **comentar e atribuir informações — não mover na esteira**.

## 5. Como entra no produto (pré-leitura p/ a mesa)
- É a evolução do **lead MESTRE×VINCULADO** ([[distribuicao-leads-motor]]: compartilha, não duplica) + o **negócio-espinha cross-conta** ([[integracao-contas-negocio-spine]]) + o **RBAC/ABAC por papel** (`hub_negocio_acessos` do design da Plataforma).
- **Modelo provável:** o negócio é MESTRE no CRM do dono (mercado de origem, cores do mercado); aos envolvidos aparece como VINCULADO (read + comentar/atribuir, sem mover), carregando a cor/badge do mercado original (anti-confusão: "é imobiliário, você está envolvido").
- **Visual:** badge/cor do mercado de origem + selo "você está envolvido (não é o dono)". A esteira fica travada (read-only) pro envolvido; comentários/atribuições liberados.
- **Hub:** vê tudo (auditoria), pode mover (juiz).

## 6. Tem que ENXERGAR fácil no HUB — dashboards/analytics/relatórios absurdamente bons
Diretriz do dono: ele precisa **enxergar isso fácil na tela do Hub**. Os **dashboards, analytics e relatórios** do Hub devem fazer um papel **absurdamente bom, claro e eficiente** — esta é a régua de qualidade da camada Hub (camada 7 do masterplan).
- Para a visibilidade cross-conta: o Hub vê **todos os negócios/leads/envolvimentos** de forma cristalina — quem é dono, quem está envolvido, em que mercado, em que etapa, com a cor do mercado de origem; filtrar por mercado/escritório/etapa/saúde; ver o avanço da rede num olhar.
- **Régua:** clareza > densidade; cada número acionável; nada de tabela-bruta como tela (relatórios densos só em `/crm/relatorios`); o dashboard responde a pergunta antes de o dono formular. Liga ao blueprint de métricas já existente ([[central-performance-metricas]], docs/CENTRAL-PERFORMANCE-METRICAS.md) — agora elevado a "absurdamente bom".

## 7. Pendência: MESA REDONDA quando chegar a hora
O dono pediu **mesa redonda específica** para este ponto quando for construir (provável: ao avançar a camada Plataforma/Hub do masterplan). Pontos a fechar: o que é "atribuir informações" (campos? anexos?), notificação ao dono quando o envolvido comenta, como o envolvimento é criado (quem adiciona quem ao negócio), e a herança de cor por mercado.
