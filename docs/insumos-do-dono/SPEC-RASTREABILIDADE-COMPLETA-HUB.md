# Especificação Técnica – Sistema de Rastreabilidade Completa do Hub

> **INSUMO DO DONO — recebido 02/jul/2026, salvo verbatim (anti-perda).** Arquitetura-mãe do Hub. Base da Maratona 2 e além. Não editar o texto do dono; anotações do Code vão em `NOTAS-CODE` no fim.

## Objetivo

O Hub deve ser desenvolvido com um conceito de rastreabilidade total (End-to-End Traceability), onde toda informação cadastrada no sistema seja única, permanente e completamente vinculada às demais. O objetivo é permitir que qualquer pessoa consiga rastrear, a qualquer momento, toda a jornada de um imóvel, cliente, parceiro, projeto, obra ou serviço, desde sua origem até a última interação realizada dentro da plataforma.

O sistema não deve ser tratado como um conjunto de módulos independentes, mas como um único ecossistema de dados conectados.

## Princípio Fundamental

Todo elemento cadastrado no sistema deve possuir um identificador único (UUID/ID Global), permanente e imutável. Esse identificador jamais poderá ser reutilizado ou alterado, mesmo que o cadastro seja editado, transferido para outra empresa, desativado ou atualizado.

Devem possuir código único próprio:

* Pessoas físicas;
* Pessoas jurídicas;
* Empresas;
* Parceiros;
* Clientes;
* Imóveis;
* Produtos;
* Serviços;
* Projetos;
* Obras;
* Negócios;
* Contratos;
* Orçamentos;
* Propostas;
* Pedidos;
* Comissões;
* Documentos.

Todo relacionamento entre entidades deve ocorrer exclusivamente através desses IDs únicos, nunca utilizando nomes, descrições ou textos como referência.

## O Negócio como entidade central

O "Negócio" é a principal entidade do Hub.

Tudo que gera valor comercial deve ser representado por um negócio.

Exemplos:

* Venda de imóvel;
* Projeto arquitetônico;
* Projeto estrutural;
* Aprovação de prefeitura;
* Execução da obra;
* Marcenaria;
* Marmoraria;
* Automação residencial;
* Energia solar;
* Climatização;
* Paisagismo;
* Assistência técnica;
* Manutenção.

Cada um desses serviços é um novo negócio.

Entretanto, nenhum negócio nasce isolado.

Todo negócio obrigatoriamente deve possuir relacionamento com o negócio que o originou.

## Estrutura obrigatória de relacionamento

Todo negócio deverá armazenar, no mínimo:

* ID do próprio negócio;
* ID do negócio pai;
* ID do negócio raiz;
* ID do imóvel relacionado;
* ID do cliente;
* ID dos parceiros envolvidos;
* ID das empresas participantes;
* ID dos profissionais responsáveis;
* ID dos produtos e serviços envolvidos.

O Negócio Pai representa a origem imediata.

O Negócio Raiz representa a primeira oportunidade comercial daquela jornada.

Dessa forma, qualquer novo serviço poderá ser rastreado até a venda original do imóvel.

## Fluxo de funcionamento

Quando um parceiro cadastra um imóvel, esse imóvel recebe imediatamente um identificador único permanente.

O parceiro que cadastrou também possui seu próprio código único, independentemente de ser corretor autônomo, imobiliária, construtora, empresa parceira ou proprietário.

O imóvel fica permanentemente vinculado ao parceiro que realizou sua entrada no sistema.

Quando surge um cliente interessado nesse imóvel, o cliente recebe automaticamente seu próprio identificador único.

Nesse momento o sistema cria o primeiro Negócio da cadeia.

Esse negócio já nasce contendo automaticamente:

* Código do imóvel;
* Código do proprietário;
* Código do comprador;
* Código do corretor;
* Código da imobiliária;
* Código da empresa responsável;
* Código dos parceiros envolvidos;
* Canal de origem;
* Origem do lead;
* Campanha;
* Data;
* Histórico completo.

Quando a venda é concluída, o negócio apenas altera seu status para "Venda Concluída". Nenhum dado é perdido, apagado ou recriado.

Após a venda, o cliente é encaminhado para um arquiteto.

O arquiteto possui dois identificadores independentes:

* Código da pessoa física;
* Código da empresa de arquitetura.

Quando o projeto é contratado, o sistema cria automaticamente um novo Negócio.

Esse novo negócio não substitui o anterior.

Ele é um filho do primeiro negócio.

Ou seja:

Venda do imóvel → Projeto Arquitetônico.

O projeto passa a possuir:

* Seu próprio ID;
* O ID do negócio pai;
* O ID do negócio raiz.

Dessa forma, toda a cadeia permanece conectada.

Quando o projeto é aprovado, novos negócios poderão surgir automaticamente.

Por exemplo:

* Execução da obra;
* Marcenaria;
* Marmoraria;
* Automação;
* Energia solar;
* Climatização;
* Paisagismo;
* Decoração;
* Ferragens;
* Esquadrias;
* Vidros;
* Comunicação visual.

Cada um desses serviços gera um novo negócio independente.

Todos possuem seus próprios responsáveis, contratos, cronogramas, propostas, documentos e indicadores.

Entretanto, todos permanecem ligados ao mesmo negócio raiz.

Assim, anos depois será possível identificar exatamente qual imóvel originou determinada obra, qual corretor captou o imóvel, quem realizou a venda, qual arquiteto desenvolveu o projeto, quais fornecedores participaram, quais empresas executaram cada etapa, quais contratos foram assinados, quais serviços adicionais foram vendidos e quanto cada participante gerou de faturamento.

## Pessoas e empresas

Toda pessoa física possui um código permanente.

Caso ela mude de empresa, o histórico permanece intacto.

Da mesma forma, toda empresa possui seu próprio identificador.

O relacionamento entre pessoas e empresas é feito através de vínculos históricos.

Assim será possível saber em qual empresa determinado profissional trabalhava em qualquer momento da linha do tempo.

## Produtos e serviços

Todo produto ou serviço também deve possuir identificador próprio.

Exemplos:

* Imóvel;
* Projeto;
* Reforma;
* Marcenaria;
* Marmoraria;
* Automação;
* Energia Solar.

Esses elementos não são apenas descrições comerciais.

Eles também são entidades rastreáveis dentro do banco de dados.

## Histórico imutável

Nenhuma informação deve ser apagada.

Todas as alterações devem gerar eventos.

Exemplos:

* Lead criado;
* Primeiro contato;
* Agendamento;
* Visita;
* Proposta enviada;
* Negociação;
* Venda;
* Projeto iniciado;
* Projeto aprovado;
* Início da obra;
* Entrega da obra;
* Garantia;
* Pós-venda.

Cada evento permanece armazenado para auditoria.

## Linha do tempo

Ao abrir qualquer negócio, o usuário deverá visualizar toda a árvore de relacionamentos.

Exemplo:

Imóvel → Cliente interessado → Venda → Projeto → Obra → Marcenaria → Marmoraria → Assistência técnica.

Toda essa cadeia deve ser exibida automaticamente, permitindo navegar entre todos os negócios relacionados.

## Participantes

Cada negócio deve armazenar todos os participantes envolvidos.

Exemplos:

* Corretor;
* Imobiliária;
* Proprietário;
* Comprador;
* Arquiteto;
* Engenheiro;
* Designer;
* Construtora;
* Fornecedores;
* Prestadores de serviço;
* Financeiro;
* Jurídico;
* Administrativo.

Todos relacionados através de seus respectivos códigos únicos.

## Inteligência e Analytics

Essa estrutura permitirá responder automaticamente perguntas como:

* Quem captou este imóvel?
* Quantos negócios esse imóvel gerou ao longo dos anos?
* Qual corretor gera mais obras?
* Qual arquiteto converte mais projetos em execução?
* Quanto faturamento total uma única venda de imóvel gerou para o Hub?
* Quanto cada parceiro recebeu em comissões?
* Quais empresas participaram da jornada?
* Quais fornecedores trabalharam nessa obra?
* Quanto tempo levou entre a venda, o projeto e a conclusão da obra?
* Quais serviços complementares foram vendidos posteriormente?
* Qual é o Lifetime Value (LTV) de cada cliente?
* Qual canal gera clientes mais lucrativos?
* Quais parceiros possuem maior taxa de conversão?
* Qual empresa gera mais receita para o ecossistema?

## Conceito Arquitetural

O Hub deve ser construído utilizando uma arquitetura baseada em relacionamentos (Graph Thinking), e não apenas em tabelas isoladas.

Pessoas, empresas, imóveis, produtos, serviços, contratos, documentos e negócios representam nós dessa rede.

Os relacionamentos entre esses nós representam toda a inteligência do sistema.

A IA deverá utilizar essa rede de conexões para gerar recomendações, previsões, análises, indicadores, automações, distribuição inteligente de leads, cálculo automático de comissões, rastreabilidade completa, auditoria de processos e visão integrada de toda a jornada do cliente.

O objetivo final é que absolutamente tudo dentro do Hub seja conectado, rastreável, auditável e mensurável, permitindo acompanhar qualquer oportunidade desde sua origem até todos os negócios derivados ao longo de sua vida útil, formando uma cadeia única de relacionamentos que nunca se perde e que alimenta continuamente a inteligência do sistema.

---

## NOTAS-CODE (não faz parte do texto do dono)
- Recebido 02/jul/2026, logo após a série AEC ir no ar. Complementa `VISAO-CODIGO-RASTREAMENTO-UNIVERSAL.md` (mão de obra/check-in/totem/link com atribuição).
- Keystone técnico novo = **linhagem do negócio (`negocio_pai_id` + `negocio_raiz_id`)** + participantes por ID + vínculos temporais + timeline/árvore + analytics de grafo.
- Relacionados: `arquitetura-camadas-negocio`, `integracao-contas-negocio-spine`, `crm-prioridade-codigo-unico`, `vinculos-nn-pessoa-empresa-negocio`, `central-performance-metricas` (hub_eventos), `monetizacao-licenciamento-rede`, `modelo-tenant-first-servico-universal`.
