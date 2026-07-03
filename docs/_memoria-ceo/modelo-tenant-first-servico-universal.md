---
name: modelo-tenant-first-servico-universal
description: "DIREÇÃO (01/jul): construir a visão do TENANT/fornecedor PRIMEIRO (Hub depois); SERVIÇO = unidade universal de execução; carteira→central; preditivo por cruzamento de dados"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

Direção do dono (01/jul noite), refinando a sequência de construção. Doc vivo: **docs/MODELO-OPERACIONAL-TENANT.md**.

## Ordem de construção (travada)
- **Tenant (fornecedor) PRIMEIRO → Hub DEPOIS.** Não se projeta quem gerencia todo mundo (Hub) sem saber o que o fornecedor faz; a visão do Hub EMERGE da operação real do tenant. (= [[arquitetura-camadas-negocio]] "coluna primeiro".)
- **De baixo pra cima:** mão de obra → prestadores → serviços → engenharia(obra) → arquitetura(projeto) → cliente.

## Padrão de tela: CARTEIRA → CENTRAL (não funil de lead)
Fornecedor = portfólio (vários projetos/obras). A tela lista a **carteira** (cards); o card abre a **central** que unifica a cadeia por baixo. **Engenharia/Obras já acerta** isso; **Arquitetura está ERRADA** (é funil de LEAD com estágios Novos/Qualificando/Proposta + copiloto falando "lead") → deve virar **carteira de PROJETOS**.

## ⭐ Fonte ÚNICA, lentes por papel (colaboração)
Projeto FECHADO nasce conectado ao negócio+cliente e puxa engenharia/marcenaria/serviços. **Todos veem a MESMA coisa (1 grafo negócio→projeto→obra→serviços), mas cada papel com SEU ponto de vista** (fatia + controles + automação da sua necessidade): arquiteto=fases/pranchas/aprovação cliente; engenheiro=obra/EAP/medição; marceneiro/serralheiro/prestador=SÓ sua frente (escopo/medição/pagamento dele); cliente=macro/marcos/aprovar (portal). Cada um lê/escreve a SUA fatia; todo auditável (Hub=juiz). Colaboração sobre 1 verdade, não cópias. = visão curada por papel/anti-poluição + [[integracao-contas-negocio-spine]].

## ⭐ SERVIÇO = unidade UNIVERSAL de execução (a peça que unifica)
Da instalação de uma banheira ao empreiteiro ao serralheiro = MESMO ciclo: **Escopo→Contrato→Preço→Cronograma→Compras→Check-in→Diário de obra→Medição→Aprovação→Entrega→Pagamento.** O serviço é o ÁTOMO; **OBRA = conjunto de serviços/frentes** (bate com o `Detalhamento` da planilha: subitem disciplina×andar). Módulo de Serviços serve pra TODOS. Liga a [[marketplace-rede-servicos-ifood]] e [[estrutura-unificada-orcamento-cronograma-escopo]].

## Espinha (opção A travada)
`Negócio→Projeto(opcional)→Obra→serviços/frentes→mão de obra/prestadores→cliente`. Projeto e Obra = entidades LIGADAS (não a mesma); projeto gera 1+ obras; obra pode existir SEM projeto (reforma direta). Já no banco: hub_negocios→hub_projetos→hub_obras.

## Moat = PREDITIVO por cruzamento
Todo serviço registra escopo/preço/compras/prazo/medição (append-only + hub_eventos) → IA cruza tudo → preditivo em TUDO (projeto, planilha orçamentária, compras). IA-first + CONVERSACIONAL. Premissa: Click-and-Go + fácil.

## Pendências ANTES de construir (pedido: "entender MUITO bem antes")
1. Dono vai trazer infos do **Asana**. 2. Claude estuda a fundo a **planilha** (planilha-DUMP.md). 3. Mesa-redonda pra travar o modelo. Relaciona [[modulo-arquitetura-requisitos]], [[modulo-engenharia-obra]], [[insumos-dono-e-asana-pendente]], [[portal-cliente-medos-cura]].
