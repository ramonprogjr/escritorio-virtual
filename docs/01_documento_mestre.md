# Documento mestre (Obra10+)

> Exportação automática de `01_documento_mestre.docx` para leitura no repositório. Para o layout original, abra o arquivo Word.

---

Table of Contents

OBRA10+ - DOCUMENTO MESTRE DO PROJETO

Versão: 1.0 Data: 08 de Maio de 2026 Cliente: Obra10+ (Wendel Nice, CEO) Destinatários: Time de Desenvolvimento (2 devs seniors) Meta de entrega: 27 de Maio de 2026

SUMÁRIO EXECUTIVO

Pessoal,

Este documento existe porque eu, Wendel, não sou desenvolvedor. Construí este sistema com apoio da IA Claude ao longo de várias sessões, aprendendo no caminho. O resultado é um sistema robusto (1.2GB, 29.332 linhas de código, 113 tabelas no banco), mas com fragilidades importantes que vocês precisam endereçar antes que cresçamos.

A meta é ambiciosa e clara: até 27 de Maio de 2026, ter a plataforma 100% funcional para parceiros e fornecedores. Tenho 2 devs seniors no time, então o prazo é apertado mas viável.

Este documento contém tudo que vocês precisam saber, do zero, para entender o projeto, replicar minha cabeça, organizar o que existe, corrigir débitos técnicos, construir o que falta, e entregar a Fase 1 do produto. Está dividido em 15 seções que vão da visão de produto até as tarefas específicas que peço da equipe.

Leiam com calma. Quando terminarem, terão o quadro completo e vamos alinhar prioridades juntos.

Conta comigo, vocês fazem parte do time.

ÍNDICE

Visão Geral do Produto

Estado Atual do Sistema

Arquitetura Técnica

Hierarquia e Atores do Negócio

Os 28 Agentes IA

Funcionalidades Construídas

Funcionalidades em Construção

Visão Futura - O Sistema Completo

Setores que Faltam Construir

WhatsApp, Check-in e Pedido de Material

Dashboards por Persona

Multi-Empresa - Como Vai Funcionar

Cronograma até 27/05

O Que Eu Peço de Vocês (Tarefas Específicas)

Padrões de Qualidade e Regras Supremas

1. VISÃO GERAL DO PRODUTO

1.1 O que é o Obra10+

O Obra10+ é uma agência de marketing/growth com uma plataforma de intermediação de parceiros acoplada. O diferencial: tudo é orquestrado por agentes de Inteligência Artificial que fazem o trabalho operacional de uma equipe humana inteira.

A plataforma “Escritório Virtual” é a interface visual onde o usuário vê os agentes IA trabalhando como se fossem funcionários numa empresa real. Cada agente tem cargo, personalidade, ciclos de trabalho, ferramentas e regras de autonomia.

1.2 O Problema que Resolvemos

Empresas pequenas e médias dos setores de construção, arquitetura e imobiliário precisam de: - Marketing digital constante (anúncios, conteúdo, campanhas) - Atendimento ao cliente 24/7 (WhatsApp principalmente) - CRM para acompanhar leads e oportunidades - Gestão de fornecedores e parceiros - Controle de obras, projetos e materiais

Mas elas não têm budget para montar uma equipe completa de marketing + atendimento + comercial + gestão. Nossa proposta: essas empresas contratam o Obra10+ e ganham instantaneamente uma “equipe de IA” trabalhando 24/7, monitorada por humanos quando preciso.

1.3 Filosofia do Sistema

Três pilares filosóficos que regem todas as decisões:

Pilar 1 - Parâmetros pré-fixados Cada agente tem cargo, área, nível e modelo de IA fixos. Isso permite que o prompt seja cacheável (economiza tokens). Isso significa que o sistema é mais barato de operar e aprende melhor com o tempo.

Pilar 2 - IA observa, sugere, prepara - humano aprova A IA nunca executa decisões financeiras, contratuais ou irreversíveis sozinha. Ela monta o “card” de aprovação com a análise pronta, e o humano (eu, no momento) aprova com 1 clique. Toda decisão crítica passa pela Central de Aprovações.

Pilar 3 - CEO Humano Único Eu sou o único CEO. Não existe agente IA com cargo de CEO. Esta é uma regra absoluta da arquitetura. O diretor_geral_ia coordena, mas não decide pelo dono.

1.4 Visão de Longo Prazo

A plataforma deve evoluir para:

Multi-tenancy completo: cada empresa cliente cadastra-se e tem seu próprio Escritório Virtual personalizado. Cada uma com seus agentes IA, suas regras, seus parceiros, seus clientes.

Workflow de obra ponta a ponta: desde a captação do imóvel pelo arquiteto até a venda do produto final, passando por venda imobiliária, projeto arquitetônico, execução de obra, fornecimento de materiais, e pós-venda.

Operação WhatsApp-first: todo o controle operacional acontece pelo WhatsApp. Operários fazem check-in escrevendo “cheguei”. Pedem material escrevendo “preciso de 5 latas de tinta”. Aprovações chegam para o responsável certo. A IA orquestra tudo.

Painel visual de cada obra: cada obra ativa tem um painel visual, igual ao Escritório Virtual de marketing, mostrando todos os participantes, status do dia, materiais, andamento.

Setores empresariais por IA: marketing, comercial, financeiro, compras, projetos, obras, RH, todos rodando com agentes IA dedicados, dentro do mesmo sistema.

2. ESTADO ATUAL DO SISTEMA

2.1 Onde Está o Código

Pasta principal (versão ativa):

C:\Users\wende\Documents\escritorio-virtual

Versões e backups encontrados no computador: - C:\Users\wende\OneDrive\Documentos\obra10+ sistema backup\ - backups na nuvem - C:\Users\wende\Documents\Codex\backups\obra10-central-operacional_2026-05-01_20-09-46 - backup de 01/05 - C:\Users\wende\Documents\backup_escritorio_20260508_2033.tar.gz - backup recente (57MB) - C:\Users\wende\OneDrive\Área de Trabalho\backup_escritorio_20260508_2033.tar.gz - cópia OneDrive

Importante: o projeto antes se chamava “office” e foi renomeado para “escritorio-virtual” em algum momento. O nome /office ainda aparece na rota da URL.

2.2 Estado do Controle de Versão (Git)

Situação atual (preocupante): - Existe um repositório git local (.git inicializado) - Branch ativa: feature/escritorio-visual (não main) - Sem remote configurado para GitHub ou GitLab - Os commits dos últimos dias só existem no PC do Wendel - O Vercel faz deploy via CLI direto (npx vercel --prod), não por push de branch

Risco: se o computador pifar, perde-se os últimos commits que ainda não foram para o Vercel. O Vercel mantém um histórico de deploys, mas não é backup completo.

2.3 Estado do Servidor (Vercel)

URL pública: https://escritorio-virtual-xi.vercel.app Project ID: prj_xwKS3ai1ER5AHdJrjwrjj9dUV5c0 Status: No ar, recebendo requisições normalmente Conta: wendelnice-devs-projects Último deploy: 13h atrás (até 08/05/2026)

Variáveis de ambiente em produção: - ✅ SUPABASE_SERVICE_ROLE_KEY - ✅ EVOLUTION_API_URL - ✅ EVOLUTION_API_KEY - ✅ EVOLUTION_INSTANCE - ❌ ANTHROPIC_API_KEY (FALTANDO - causa raiz da IA não responder leads do WhatsApp)

2.4 Estado do Banco de Dados (Supabase)

Project ID: cdjlqsznerdhwqyunodl Total de tabelas: 113 Distribuição:

Categoria

Quantidade

Observação

Hub (core do sistema)

71

Tabelas principais com prefixo hub_

CRM

7

Tabelas modernas crm_*

Legado / genéricas

35

Tabelas antigas que precisam ser auditadas e possivelmente arquivadas

Backups: pg_cron rodando a cada 30 minutos, 924+ backups acumulados.

2.5 Estado do WhatsApp (Evolution API)

Hospedagem: Railway (projeto lovely-commitment) Plano: Trial gratuito - 28 dias ou $4.67 (o que vier primeiro) Status atual: Online, 3/3 serviços rodando (Redis, Evolution API, Postgres) Histórico recente: Caiu várias vezes em 04/05 às 22h39, voltou sozinho.

Mensagens já recebidas pelo sistema: 8 leads reais via WhatsApp. Mensagens enviadas pelo sistema: 0 (a IA nunca respondeu nada porque a API key da Anthropic não está em produção).

2.6 Status das Funcionalidades

Módulo

Status

Webhook WhatsApp recebendo mensagens

✅ Funcional

Criação de leads automaticamente

✅ Funcional

Escritório Virtual visual (canvas 3D)

✅ Funcional

Agentes IA cadastrados no banco

✅ 28 agentes

Ciclos IA cadastrados

✅ 8 ciclos (mas 3 com bug)

IA respondendo lead automaticamente

❌ Falha (sem API key)

Ciclos rodando autônomos

❌ Nunca executaram (total_execucoes = 0)

Hub de Parceiros

⚠️ Parcial (cadastro existe, fluxo não)

CRM (leads, atendimento, KPIs)

✅ Funcional, mas KPIs zerados

Dashboard agentes/relatórios

⚠️ Parcial

Mobile responsivo

❌ Não implementado

Multi-empresa (multi-tenant)

❌ Não implementado

Cadastro de empreiteiras com CNPJ

❌ Não implementado

Operários com CPF + check-in WhatsApp

❌ Não implementado

Pedido de material por WhatsApp

❌ Não implementado

Cotação automática com fornecedores

❌ Não implementado

Painel visual de cada obra

❌ Não implementado

Fluxo Imóvel → Projeto → Obra → Produto

❌ Não implementado

2.7 Débitos Técnicos Identificados

Débito 1 - HMAC desligado no webhook WhatsApp

Severidade: ALTA Origem: Commit 9313dd7 em 07/05/2026 Descrição: A validação de assinatura HMAC do webhook foi desligada temporariamente para debug pré-reunião. Hoje qualquer pessoa pode mandar requisição falsa para o webhook se souber a URL. Solução: Reativar HMAC com gestão de chave secreta entre Evolution API e o webhook.

Débito 2 - 5 rotas API expostas sem autenticação

Severidade: MÉDIA Origem: Commits d55c020 e 65ee954 Descrição: As rotas /api/whatsapp, /api/hub/cargos, /api/hub/agentes, /api/crm/atendimento, /api/health estão liberadas no proxy sem nenhuma checagem de origem ou auth. Solução: Migrar para fetch helper global com autenticação por token interno.

Débito 3 - 3 ciclos IA apontando para slug inexistente

Severidade: ALTA (mas só importa quando os ciclos forem ativados) Descrição: Os ciclos “Diretor — Análise Matinal”, “Diretor — Análise Noturna” e “Diretor — Tráfego 6h” usam agente_slug = 'diretor', mas esse slug não existe na tabela hub_agente_identidade. Os slugs reais são diretor_comercial, diretor_operacoes e diretor_geral_ia. Solução: Decidir qual diretor herda cada ciclo (ver seção 14 - Tarefas), e fazer UPDATE.

Débito 4 - Agentes duplicados

Severidade: BAIXA Descrição: Os agentes ariane e diretora_marketing têm o mesmo cargo “Diretora de Marketing”. Provavelmente um deve ser arquivado ou renomeado.

Débito 5 - Branch errada como ativa

Severidade: MÉDIA Descrição: A branch ativa do projeto é feature/escritorio-visual. Não existe main configurada como produção. Isso quebra o fluxo padrão de Git.

Débito 6 - Sem GitHub remote

Severidade: ALTA Descrição: O código está apenas no PC do Wendel + nas builds do Vercel. Sem GitHub remote, não há fonte de verdade para o time colaborar, sem histórico colaborativo, sem CI/CD baseado em git.

Débito 7 - Backup automático não funciona

Severidade: ALTA Descrição: Foi prometido na sessão anterior um sistema de backup automático a cada 20-30 minutos no Google Drive. Nunca foi implementado. O único backup confiável hoje é o pg_cron do Supabase (apenas banco) e o OneDrive sincronizando arquivos do PC.

Débito 8 - 35 tabelas legadas no banco

Severidade: BAIXA Descrição: Existem 35 tabelas que não seguem o padrão hub_* ou crm_*. Provavelmente são de versões anteriores do sistema. Precisam ser auditadas: usar, migrar ou arquivar (nunca deletar - regra suprema).

Débito 9 - 14 KPIs definidos mas tabela de resultados vazia

Severidade: MÉDIA Descrição: A tabela hub_kpis_definicao tem 14 KPIs configurados, mas hub_kpis_resultados está zerada. Não há cálculo automático rodando.

Débito 10 - 5 tabelas de negócio vazias

Severidade: ALTA (impede fluxo completo) Descrição: As tabelas hub_negocios, hub_empresas, hub_imoveis, hub_parceiros e várias outras estão com 0 registros. O fluxo de negócio não foi instanciado ainda.

3. ARQUITETURA TÉCNICA

3.1 Stack Tecnológico

Camada

Tecnologia

Versão

Frontend Framework

Next.js

16.2.4

UI Library

React

19

Linguagem

TypeScript

5.x

Estilização

Tailwind CSS

4

Banco de Dados

PostgreSQL (Supabase)

15+

Autenticação

Supabase Auth

-

LLM

Anthropic Claude

Haiku 4.5 / Sonnet 4.6 / Opus 4.7

WhatsApp

Evolution API

self-hosted

Marketing Data

Windsor.ai

MCP

Hospedagem App

Vercel

-

Hospedagem WhatsApp

Railway

-

3.2 Estrutura de Pastas

escritorio-virtual/├── app/                           # Páginas Next.js (App Router)│   ├── crm/                       # Módulo CRM│   │   ├── page.tsx               # Dashboard principal│   │   ├── leads/                 # Lista de leads│   │   ├── contatos/              # Pessoas/contatos│   │   ├── empresas/              # Empresas cadastradas│   │   ├── negocios/              # Negócios/oportunidades│   │   ├── parceiros/             # Hub de parceiros│   │   ├── kpis/                  # KPIs e métricas│   │   ├── relatorios/            # Relatórios│   │   ├── atendimento/           # Tela de atendimento│   │   ├── conteudo/              # Conteúdo/copy│   │   ├── ciclos/                # Configuração de ciclos IA│   │   ├── aprovacoes/            # Central de Aprovações│   │   └── configuracoes/         # Configurações│   ├── office/                    # Escritório Virtual visual│   ├── agentes/                   # Catálogo de agentes IA│   ├── comando/                   # Painel de comando│   ├── parceiro/                  # Cadastro de parceiros via token│   └── api/                       # 27 endpoints de API│       ├── whatsapp/webhook/      # Webhook do WhatsApp│       ├── hub/agentes/           # CRUD de agentes│       ├── ciclos/                # Execução de ciclos│       │   ├── atendente/│       │   ├── gerente/│       │   └── diretor/│       ├── ml/aprovar/            # ML/aprovações│       ├── validar/cpf/│       ├── validar/cnpj/│       └── windsor/campanhas/     # Integração Windsor.ai├── components/                    # Componentes React reutilizáveis│   └── office/                    # Componentes do escritório virtual├── lib/                           # Lógica de negócio│   ├── agent-prompts.ts           # 67KB - Prompts dos agentes IA│   ├── office-intelligence.ts     # 24KB - Inteligência do escritório│   ├── personality-matrix.ts      # 21KB - Matriz de personalidade│   ├── agent-states.ts            # 14KB - Estados dos agentes│   └── ia/                        # Engine de IA│       └── prompt-builder.ts      # Montagem de prompts em camadas└── public/                        # Assets estáticos    └── avatars/                   # Avatares dos agentes (Ariane, etc.)

3.3 Fluxo de Dados Principal

WhatsApp (cliente)    ↓Evolution API (Railway)    ↓ (webhook POST)Next.js /api/whatsapp/webhook (Vercel)    ↓identifica intenção/mercado    ↓busca ou cria lead em hub_leads_crm    ↓busca agente apropriado em hub_agente_identidade    ↓constrói prompt em camadas (lib/ia/prompt-builder.ts)    ↓ (chama Anthropic)Claude API (Haiku ou Sonnet)    ↓recebe resposta    ↓grava nas tabelas (após CMD-OBS-1):    - hub_prompt_logs    - hub_conversas    - hub_mensagens    - hub_ciclos_log    - hub_ciclos_ia (incrementa total_execucoes)    - hub_fila_mensagens    - hub_acoes_ia    - hub_memorias_lead    - hub_atividades    ↓envia resposta de volta    ↓Evolution API → WhatsApp do cliente

3.4 Engine de Prompts em 7 Camadas

A lógica do agente é montada em camadas, permitindo personalização sem reescrever código:

Camada

Fonte

O que adiciona ao prompt

1 - Identidade

hub_agente_identidade + hub_personalidade

Cargo, system_prompt_base, personalidade

2 - Conhecimento

hub_agente_conhecimento

Empresa, serviços, objeções, exemplos

3 - Mercado

parâmetro

Adapta linguagem ao segmento (imobiliário, reforma, etc.)

4 - Regras

hub_regras_ia + campos do agente

nao_pode_fazer, sempre_dizer, nunca_dizer

5 - Memórias

hub_memorias_lead

O que o agente lembra do lead (top 5 por confiança)

6 - Etapa do fluxo

parâmetro

Contexto da etapa atual

7 - Universais

hardcoded

Limite 3 linhas, nunca inventar, etc.

3.5 Modelos de IA por Nível

A escolha de modelo depende do nível hierárquico do agente:

Nível

Cargo

Modelo Padrão

Modelo Crítico

1

CEO IA / Diretor Geral

Opus / Haiku

Opus / Sonnet

2

Diretores

Sonnet

Sonnet ou Opus

3

Gerentes/Gestores

Sonnet

Sonnet ou Opus

4

Operadores

Haiku

Sonnet

5

Especialistas auxiliares

Sonnet ou Haiku

Sonnet

Regra de negócio: se o mercado for imobiliário (mais caro, decisão de alto valor), todos os agentes usam o modelo_critico. Se for outro mercado, usam modelo_padrao.

4. HIERARQUIA E ATORES DO NEGÓCIO

4.1 Quem Usa o Sistema

A plataforma tem 5 tipos principais de atores, cada um com função, permissão e interface diferentes:

Ator 1 - Wendel (CEO Humano Único)

Único dono real do sistema

Aprova decisões financeiras, contratuais e críticas

Vê todas as empresas, todos os parceiros, todos os leads

Define regras de negócio globais

Ator 2 - Empresas Clientes (Multi-tenant)

Empresas que contratam o Obra10+ e ganham seu próprio Escritório Virtual.

Exemplos: - Imobiliárias - Construtoras - Escritórios de arquitetura - Empresas de reforma

Cada empresa cliente vai ver apenas seus dados, seus agentes IA, seus parceiros.

Ator 3 - Parceiros

Definição precisa (alinhamento Wendel): parceiros são imobiliárias e corretores.

Características: - Trazem leads / oportunidades de venda - Recebem comissão por intermediação - Passam por homologação antes de operar - Têm CPF (corretor) ou CNPJ (imobiliária) - Visualizam apenas seus próprios leads e comissões

Ator 4 - Fornecedores

Definição precisa (alinhamento Wendel): fornecedores são todos os profissionais que prestam serviços para a obra, organizados por área.

Áreas de fornecedor: - Arquitetura - Engenharia - Empreiteiras (executoras de obra) - Marcenaria - Elétrica - Hidráulica - Pintura - Cerâmica/Pisos - Materiais (lojas) - Serralheria - Vidraçaria - (Lista expansível conforme negócio cresce)

Fornecedores não são clientes. Eles fazem parte da operação. Cada fornecedor: - Tem CNPJ - Pode ter funcionários (CPFs) - Pode receber pedidos automáticos do sistema - Pode dar cotações e prazos - É avaliado por performance

Ator 5 - Operários (Pessoas Físicas)

Funcionários das empreiteiras parceiras

Cada um com CPF único

Acessam o sistema apenas pelo WhatsApp

Ações: check-in/check-out, pedido de material, registro de fotos da obra

Não acessam interface visual

Ator 6 - Clientes Finais

Pessoa física ou jurídica que compra o serviço

Pode ser dono de imóvel, comprador de imóvel, ou contratante de reforma

Conversam pelo WhatsApp com a IA

Aprovam orçamentos pelo WhatsApp

4.2 Fluxo de Negócio Completo (Visão Wendel)

Sequência idealizada de uma obra ponta-a-ponta:

1. CAPTAÇÃO DO IMÓVEL   Arquiteto A (parceiro) cadastra um imóvel no sistema   → vai para hub_imoveis2. VENDA DO IMÓVEL   Corretor B (parceiro) vende esse imóvel   → muda status do imóvel   → registra comissão do corretor   → cria oportunidade de projeto3. PROJETO ARQUITETÔNICO   Arquiteto C (fornecedor) fecha o projeto com o cliente que comprou   → cadastra projeto no sistema   → recebe comissão pelo projeto4. VENDA DA OBRA   Sua empresa (Obra10+) vende a execução da obra para esse projeto   → vira contrato5. VENDA DE PRODUTOS/CENÁRIO   Sua empresa também vende produtos para o projeto   → móveis, decoração, etc.6. EXECUÇÃO DA OBRA   Empreiteiras (fornecedoras) cadastradas executam   → cada empreiteira tem CNPJ   → empreiteira tem operários com CPF7. CHECK-IN DOS OPERÁRIOS   João (operário) chega na obra   → manda "cheguei" no WhatsApp   → aparece no painel da obra como presente   → começa a contar tempo trabalhado8. PEDIDO DE MATERIAL   João precisa de 5 latas de tinta   → manda no WhatsApp: "preciso 5 latas tinta amanhã"   → IA cria tarefa   → IA notifica todos os envolvidos (gestor de obra, comprador)   → IA busca fornecedores cadastrados de tinta na região   → IA pede orçamento e prazo automaticamente para 3 fornecedores   → fornecedores respondem   → IA monta card de aprovação   → empresa aprova com 1 clique   → IA confirma pedido com fornecedor   → IA agenda entrega na obra9. PAINEL VISUAL DA OBRA   Todos os envolvidos veem em tempo real:   - Quem está na obra agora   - Quais materiais foram pedidos   - Status de cada material (pedido / aprovado / a caminho / entregue)   - Andamento do cronograma   - Fotos do dia   - Decisões pendentes

4.3 Estrutura Hierárquica Atual no Banco

A tabela hub_hierarquia armazena a estrutura organizacional. As tabelas relacionadas:

hub_pessoas - cadastro unificado de PFs (clientes, operários, etc.)

hub_empresas - cadastro unificado de PJs (parceiros, fornecedores, clientes PJ)

hub_profissionais - vinculação pessoa-empresa (quem trabalha onde)

hub_responsabilidades - quem responde por o quê

5. OS 28 AGENTES IA

5.1 Visão Geral

O sistema tem 28 agentes IA cadastrados, organizados em 5 níveis hierárquicos. Cada agente é uma “pessoa virtual” com cargo, personalidade, conhecimento, regras e ciclos de trabalho.

Por que 28 e não 16? Quando começamos eram 16. Foram adicionados 12 ao longo das sessões para cobrir cargos novos: closer, customer success, designer, motion designer, copywriter, gestor de conteúdo, dev IA, revisor IA, monitor de qualidade, pesquisador, gestor de projetos, gerente de vendas, e outros.

5.2 Tabela Completa de Agentes

Nível 1 - Comando

Slug

Cargo

Modelo Padrão

Função

ceo

CEO IA

Opus 4.7

NÃO USAR - é proibido (Wendel é o CEO único)

diretor_geral_ia

Diretor Geral IA

Haiku 4.5

Coordena todos os agentes, prepara cards de aprovação para Wendel

Nível 2 - Diretoria

Slug

Cargo

Modelo Padrão

Função

ariane

Diretora de Marketing

Sonnet 4.6

Coordena marketing - personagem visual no canvas

diretora_marketing

Diretora de Marketing

Sonnet 4.6

DUPLICATA de ariane - precisa decisão (arquivar uma)

diretor_comercial

Diretor Comercial

Sonnet 4.6

Coordena área comercial e vendas

diretor_operacoes

Diretor de Operações

Sonnet 4.6

Coordena operações, possivelmente tráfego e infra

Nível 3 - Gerência

Slug

Cargo

Modelo Padrão

Função

gerente_atendimento

Gerente de Atendimento

Sonnet 4.6

Supervisiona equipe de atendimento

gerente_vendas

Gerente de Vendas

Sonnet 4.6

Supervisiona equipe de vendas

gestor_conteudo

Gestor de Conteúdo

Sonnet 4.6

Aprova copy e arte antes de publicar

gestor_projetos

Gestor de Projetos

Sonnet 4.6

Acompanha projetos em andamento

gestor_trafego

Gestor de Tráfego

Sonnet 4.6

Gerencia campanhas Meta/Google

Nível 4 - Operação

Slug

Cargo

Modelo Padrão

Função

sdr

Qualificador de Leads

Haiku 4.5

Primeiro contato com leads, qualifica

atendente

Atendente de Primeiro Contato

Haiku 4.5

Atende leads qualificados, conduz fluxo

closer

Closer

Haiku 4.5

Fecha negociação, leva à conversão

cs

Customer Success

Haiku 4.5

Pós-venda, retenção

crm_ia

CRM IA

Haiku 4.5

Manutenção da base CRM

analista_trafego_meta

Analista de Tráfego Meta

Haiku 4.5

Análise diária Meta Ads

analista_trafego_google

Analista de Tráfego Google

Haiku 4.5

Análise diária Google Ads

analytics_ia

Analytics IA

Haiku 4.5

Consolida dados, gera relatórios

copywriter

Copywriter

Haiku 4.5

Cria textos para anúncios

designer

Designer

Haiku 4.5

Cria artes para campanhas

motion_designer

Motion Designer

Haiku 4.5

Cria vídeos para anúncios

social_media

Social Media

Haiku 4.5

Posts em redes sociais

revisor_ia

Revisor IA

Haiku 4.5

Revisão de qualidade de outputs

dev_ia

Dev IA

Haiku 4.5

Tarefas técnicas auxiliares

Nível 5 - Especialistas Auxiliares

Slug

Cargo

Modelo Padrão

Função

estrategista

Estrategista Digital

Sonnet 4.6

Planeja estratégia de longo prazo

monitor_qualidade

Monitor de Qualidade

Haiku 4.5

Monitora qualidade dos outputs dos agentes

pesquisador

Pesquisador

Haiku 4.5

Pesquisa concorrência, tendências

5.3 Os 8 Ciclos IA Configurados

Ciclos são a forma como agentes “trabalham” autonomamente. Cada ciclo é executado por um cron job ou continuamente.

#

Nome

Agente

Tipo

Frequência

Status atual

1

SDR — Resposta Imediata

sdr

contínuo

webhook

OK

2

Atendente — Monitor SLA

atendente

programado

a cada 2 min

OK

3

Atendente — Follow-up Leads

atendente

programado

a cada 30 min

OK

4

Gerente — Supervisão

gerente_atendimento

programado

a cada 30 min

OK

5

Gerente — Relatório Matinal

gerente_atendimento

programado

08h diário

OK

6

Diretor — Análise Matinal

diretor (INVÁLIDO)

programado

07h diário

❌ BUG slug

7

Diretor — Análise Noturna

diretor (INVÁLIDO)

programado

19h diário

❌ BUG slug

8

Diretor — Tráfego 6h

diretor (INVÁLIDO)

programado

a cada 6h

❌ BUG slug

TODOS OS 8 CICLOS ESTÃO COM total_execucoes = 0. Nunca executaram. Isso confirma que o sistema autônomo não roda hoje.

5.4 Por que os ciclos não rodam

Diagnóstico técnico:

SDR (contínuo): dispara via webhook quando lead novo entra. Mas a ANTHROPIC_API_KEY não está configurada no Vercel, então a chamada Claude não acontece, e o ciclo nunca completa.

Programados via cron: dependem de algum mecanismo (Vercel Cron Jobs ou pg_cron) chamar /api/ciclos/executar?ciclo=X. Esse mecanismo não está ligado. A rota existe (app/api/ciclos/{atendente,gerente,diretor}/), mas ninguém a aciona automaticamente.

Diretor: mesmo se ligado, daria erro porque o agente_slug = 'diretor' não existe.

6. FUNCIONALIDADES JÁ CONSTRUÍDAS

6.1 Módulo CRM (parcialmente funcional)

Localização: app/crm/

6.1.1 Dashboard CRM (/crm)

Visão geral de KPIs (atendimento, parceiros, conversão)

Cards com números principais

Bug conhecido: fontes muito pequenas (10-11px) e overflow-hidden cortando conteúdo. Já diagnosticado, não corrigido.

6.1.2 Atendimento (/crm/atendimento)

Lista de leads em atendimento

Filtros por estágio

Já corrigido em 07/05 (3 bugs empilhados)

Status: Funcional com 8 leads reais

6.1.3 Leads e Pessoas

/crm/leads - lista de leads

/crm/pessoas - cadastro unificado de PFs

/crm/contatos - contatos secundários

6.1.4 Empresas

/crm/empresas - cadastro PJs

6.1.5 Negócios e Oportunidades

/crm/negocios - estrutura existe, mas tabela está vazia (0 registros)

6.1.6 Hub de Parceiros (/crm/parceiros)

Cadastro de parceiros

Homologação

Performance

Convites

Captação

Status: Estrutura no banco (10+ tabelas), interface parcial

6.1.7 KPIs (/crm/kpis)

14 KPIs definidos em hub_kpis_definicao

hub_kpis_resultados está vazio

Status: Visual existe, cálculo automático não roda

6.1.8 Relatórios (/crm/relatorios)

Tela existe

Status: Construção nova faltando, sem dados

6.1.9 Ciclos (/crm/ciclos)

Visualização dos 8 ciclos cadastrados

Status: Visual OK, ciclos não executam

6.1.10 Aprovações (/crm/aprovacoes)

Central de Aprovações

3 cards mockados (não reais)

Status: Funcional para visualização, sem aprovações reais ainda

6.1.11 Configurações (/crm/configuracoes)

Tela existe

Status: Construção nova faltando

6.2 Escritório Virtual (/office)

A interface visual mais característica do produto. Canvas isométrico onde os agentes IA aparecem como personagens em uma planta de escritório real.

Funcionalidades:

25 agentes posicionados em salas (CEO Office, Marketing Director, Closer Room, etc.)

Personagem da Ariane (Diretora de Marketing) renderizada com avatar completo (5 poses: normal, andando, apresentando, alerta, dúvida)

Painel lateral direito com leads em tempo real (8 leads atualmente)

Aba Office / Analytics

Botões de Aprovações, Alertas, Atendimento

Versão mobile (5 abas: Escritório, Marketing, Atendimento, Comando, Analytics)

Componentes principais:

components/office/OfficeCanvas.tsx - canvas desktop

components/office/MobileExperience.tsx - mobile com 5 abas

components/office/Ariane.tsx - componente especial da Ariane

6.3 Módulo Agentes (/agentes)

Catálogo dos 28 agentes IA. Mostra cada agente com cargo, descrição, status, modelo IA usado.

6.4 Painel de Comando (/comando)

Visão executiva consolidada. Métricas, decisões pendentes, alertas.

6.5 Cadastro de Parceiros (/parceiro)

Página de auto-cadastro via token. Fluxo: parceiro recebe link com token, preenche dados, sistema homologa.

6.6 Webhook WhatsApp

app/api/whatsapp/webhook/route.ts - 100% funcional.

Faz: - Recebe mensagem da Evolution API - Identifica intenção (imobiliário, reforma, etc.) - Cria lead em hub_leads_crm - Identifica agente apropriado (sdr, atendente, etc.) - Constrói prompt em camadas - Chama Anthropic Claude - Envia resposta de volta via Evolution API - (recém adicionado em CMD-OBS-1) Grava observabilidade em 5 tabelas

6.7 Outras APIs

/api/hub/agentes - CRUD de agentes

/api/hub/cargos - listagem de cargos

/api/hub/empresas - CRUD de empresas

/api/hub/leads - CRUD de leads

/api/ciclos/atendente|gerente|diretor - execução dos ciclos

/api/ml/aprovar - integração ML para aprovações

/api/validar/cpf - validação de CPF

/api/validar/cnpj - validação de CNPJ

/api/windsor/campanhas - integração Windsor.ai

/api/health - healthcheck

7. FUNCIONALIDADES EM CONSTRUÇÃO

7.1 Observabilidade do Webhook (CMD-OBS-1)

Status: Código pronto, commit feito (0978a3e), aguardando deploy no Vercel.

O que foi adicionado: após chamada bem-sucedida à Anthropic, gravar em 5 tabelas: - hub_prompt_logs - prompt + resposta + tokens + custo - hub_conversas - conversa do lead (criar ou reusar aberta) - hub_mensagens - 2 inserts (uma do lead, uma da IA) - hub_ciclos_log - execução do ciclo - hub_ciclos_ia - incrementa contador

Cada INSERT em try/catch isolado, falha silenciosa se algum bloco der erro (não interrompe o webhook principal).

7.2 Resposta Automática da IA

Status: Bloqueado por configuração.

A IA está pronta no código. O webhook está pronto. Mas a ANTHROPIC_API_KEY não está configurada no Vercel para produção. Precisa adicionar com:

npx vercel env add ANTHROPIC_API_KEY production

Após adicionar, fazer redeploy, e a IA volta a responder.

8. VISÃO FUTURA - O SISTEMA COMPLETO

Esta seção descreve o sistema completo que Wendel idealiza. Não é o escopo da Fase 1. É a visão de longo prazo que orienta as decisões arquiteturais.

8.1 Multi-Tenancy

Cada empresa cliente tem seu próprio Escritório Virtual.

Quando uma empresa se cadastra, automaticamente: 1. Cria-se um tenant_id único 2. Provisiona-se uma instância visual do escritório virtual com nome dela 3. A empresa pode customizar: - Nome do escritório - Cores/branding - Quais agentes IA quer ativar - Quem são os funcionários humanos - Quem são os parceiros e fornecedores dela 4. A IA “cresce” personalizada para o contexto daquela empresa

Implicação técnica: TODA tabela de dados do sistema precisa ter tenant_id para isolar empresas.

8.2 Escritórios Virtuais por Setor

Hoje temos um Escritório Virtual focado em marketing. A visão é replicar isso para outros setores:

Escritório Virtual de Imobiliária

Agentes: corretor virtual, gestor de imóveis, captador, qualificador

Visualização: vitrines, salas de visita, sala do gerente

Funcionalidades: cadastro de imóveis, agendamento de visitas, propostas

Escritório Virtual de Empreiteira

Agentes: gestor de obra, comprador, RH, financeiro

Visualização: canteiro de obra, depósito, escritório

Funcionalidades: pedido de material, controle de operários, cronograma

Escritório Virtual de Arquitetura

Agentes: assistente de projeto, prospector, especificador

Visualização: ateliê, mesa de projeto, biblioteca de materiais

Funcionalidades: cadastro de projetos, especificação técnica, orçamento

8.3 Dashboards Gerenciais

Cada empresa terá dashboards específicos para visualizar suas operações:

Dashboard de Obra (visual)

Igual ao Escritório Virtual mas para uma obra específica: - Quem está na obra agora (avatares dos operários presentes) - Materiais em uso, pedidos, entregues - Andamento das frentes de trabalho - Decisões pendentes - Fotos do dia - Cronograma com marco atingido

Dashboard Financeiro

Faturamento por mês

Custos por obra

Margens

Contas a pagar / receber

Comissões a pagar para parceiros

Dashboard de Compras

Materiais em estoque

Pedidos abertos

Fornecedores ativos

Cotações em aberto

Comparativo de preços histórico

Dashboard de Projetos

Projetos em andamento (Kanban)

Projetos por fase

Pendências por projeto

Próximas entregas

Dashboard Comercial

Leads por origem

Funil de conversão

Negócios em aberto

Performance por vendedor / parceiro

Dashboard Marketing (já parcial)

Custos de campanha

CPL por canal

ROAS

Performance por criativo

8.4 Sistema de Aprovações Universal

Toda ação que envolve dinheiro, contrato, comissão ou risco passa por aprovação. Hoje existe a Central de Aprovações (/crm/aprovacoes). A visão é expandir:

Aprovação de pagamento de fornecedor

Aprovação de comissão para parceiro

Aprovação de pedido de material acima de X reais

Aprovação de novo parceiro/fornecedor

Aprovação de campanha publicitária

Aprovação de envio de proposta acima de Y reais

Cada card de aprovação tem: - Resumo do que está sendo decidido - Análise da IA (recomendação) - Documentos relacionados - Botões: Aprovar / Reprovar / Pedir mais informações

9. SETORES QUE FALTAM CONSTRUIR

Esta seção lista os setores empresariais que ainda não têm representação no sistema. Cada um vai virar um “departamento” do Escritório Virtual com seus próprios agentes IA.

9.1 Financeiro

Agentes a criar: - analista_financeiro - lança contas, concilia - controller - analisa indicadores, alerta sobre desvios - cobranca_ia - faz cobrança de inadimplentes via WhatsApp - pagamentos_ia - processa pagamentos a fornecedores

Funcionalidades: - Contas a pagar / receber - Conciliação bancária - DRE simplificado - Fluxo de caixa projetado - Comissões a pagar - Notas fiscais (recebidas e emitidas) - Integração com banco (PIX, boleto)

Tabelas necessárias (provavelmente novas): - hub_contas_pagar - hub_contas_receber - hub_pagamentos - hub_recebimentos - hub_dre_mensal - hub_notas_fiscais

9.2 Compras

Agentes a criar: - comprador_ia - cota com fornecedores automaticamente - negociador_ia - busca melhores preços, prazos - recebedor - confere entregas, gera ocorrência

Funcionalidades: - Solicitação de cotação automática (gatilho: pedido por WhatsApp do operário) - Comparativo de cotações - Aprovação de pedido - Acompanhamento de entrega - Histórico de preços por fornecedor - Avaliação de fornecedores

Tabelas necessárias: - hub_pedidos_material - hub_cotacoes - hub_cotacoes_respostas - hub_recebimentos_obra - hub_avaliacoes_fornecedor

9.3 Obras / Execução

Agentes a criar: - gestor_obra_ia - acompanha execução - mestre_obra_ia - aciona operários, organiza tarefas - seguranca_ia - monitora EPIs, ocorrências - qualidade_obra_ia - inspeciona entregas

Funcionalidades: - Cadastro de obra com endereço e CNPJ do contratante - Cronograma de obra - Ponto eletrônico via WhatsApp (check-in/out) - Diário de obra (texto + fotos) - Pedidos de material vinculados à obra - Vinculação operário → empreiteira → obra - Relatório semanal automático para o cliente

Tabelas necessárias: - hub_obras - hub_obras_cronograma - hub_obras_diario - hub_operarios_checkin - hub_obras_ocorrencias - hub_obras_fotos

9.4 Projetos / Arquitetura

Agentes a criar: - assistente_projeto_ia - apoia o arquiteto - especificador_ia - sugere materiais e produtos - revisor_projeto_ia - confere consistência

Funcionalidades: - Cadastro de projeto vinculado a um cliente - Fases do projeto (briefing, anteprojeto, executivo, detalhamento) - Lista de especificação técnica - Orçamento detalhado - Visualização (3D, plantas) - Controle de revisões

Tabelas necessárias: - hub_projetos - hub_projetos_fases - hub_projetos_especificacoes - hub_projetos_revisoes

9.5 Imobiliária

Agentes a criar: - corretor_ia - apresenta imóveis - captador_ia - encontra novos imóveis - avaliador_ia - estima preço de imóveis - agendador_visitas_ia - marca visitas

Funcionalidades: - Cadastro de imóveis com fotos, endereço, valor - Vitrine pública / privada - Agendamento de visitas - Propostas de compra - Negociação assistida - Comissões de venda

Tabelas existentes: hub_imoveis (vazia), properties (legada)

9.6 Administrativo / RH

Agentes a criar: - rh_ia - cadastros, contratos, ponto - juridico_ia - revisa contratos - documentos_ia - organiza arquivos

Funcionalidades: - Cadastro de funcionários - Contratos (cliente, fornecedor, empreiteira) - Folha de ponto consolidada - Documentos por pasta - Lembretes de vencimento

9.7 Pós-Venda / Customer Success

Agentes a criar (já existe cs): - Expandir o cs existente

Funcionalidades: - Fluxo de onboarding após venda - NPS pós-entrega - Solução de chamados - Manutenção pós-obra - Programa de indicação

10. WHATSAPP, CHECK-IN E PEDIDO DE MATERIAL

Esta seção detalha a operação WhatsApp-first, que é central na visão do produto.

10.1 Filosofia

Operários, prestadores de serviço e clientes finais não acessam interface visual. Tudo acontece pelo WhatsApp. A IA traduz mensagens humanas casuais em ações no sistema.

10.2 Comandos Suportados (visão completa)

Para Operários

Mensagem (exemplo)

Ação no sistema

“cheguei”

Registra check-in na obra atual

“saí” / “saindo”

Registra check-out

“preciso de 5 latas de tinta amanhã”

Cria pedido de material

“está faltando massa corrida”

Cria pedido com prioridade alta

“[envia foto]”

Anexa foto ao diário da obra

“concluí parede 3”

Atualiza cronograma

“problema com o piso”

Abre ocorrência

Para Clientes

Mensagem

Ação

“olá, quero saber sobre projeto”

Cria lead, SDR responde

“aprovado” (em resposta a card)

Confirma aprovação de etapa

“como está minha obra?”

Envia resumo automático com fotos

Para Parceiros / Fornecedores

Mensagem

Ação

“cotação 1500 prazo 5 dias”

Registra cotação para um pedido

“entrego dia 12”

Agenda entrega

“novo lead [nome] [telefone]”

Registra lead trazido pelo parceiro

10.3 Identificação Automática

O sistema precisa identificar: - Quem é quem mandou (cliente / operário / parceiro / fornecedor) - Em qual obra/contexto está - Qual ação está pedindo

Como identificar quem é: 1. Buscar telefone em hub_pessoas, hub_profissionais, hub_parceiros, hub_empresas 2. Se encontrar, usar role e contexto cadastrado 3. Se não encontrar, tratar como lead novo (fluxo SDR)

Como identificar contexto: 1. Operário tem obra_atual no cadastro (atualizado quando faz check-in) 2. Cliente pode ter múltiplas obras, IA pergunta “qual obra?” 3. Parceiro pode ter múltiplos leads, IA confirma

10.4 Fluxo Detalhado de Pedido de Material

1. João (operário, CPF cadastrado) manda no WhatsApp:   "Preciso 5 latas tinta branca amanhã"2. Webhook recebe, identifica João pelo telefone3. IA chama hub_profissionais → João trabalha na empreiteira X   IA chama hub_operarios_checkin → João está na obra Y agora4. IA cria registro em hub_pedidos_material:   - obra_id: Y   - operario_id: João   - empreiteira_id: X   - item: "tinta branca"   - quantidade: 5   - unidade: "lata"   - prazo: amanhã   - status: "novo"5. IA notifica via WhatsApp:   - Gestor da obra Y   - Comprador da empresa cliente   - (responde para João: "Anotado! Vou cotar e te aviso")6. IA busca em hub_empresas WHERE setor='tinta' E ativo=true   Pega top 3 fornecedores7. IA envia WhatsApp para cada fornecedor:   "Olá [nome], orçamento para 5 latas de tinta branca, entrega obra [endereço]   amanhã dia X. Por favor responda valor e prazo."8. Fornecedores respondem (em horários diferentes):   - Fornec A: "tinta x marca y por R$ 80 cada, entrego 9h"   - Fornec B: "R$ 75 cada, mas só consigo entregar dia depois"   - Fornec C: "R$ 90 cada, entrego antes 8h"9. IA estrutura cotações em hub_cotacoes_respostas10. IA cria card de aprovação em hub_aprovacoes:    Tipo: pedido_material    Resumo: "5 latas tinta branca para obra Y"    Recomendação IA: "Fornecedor A (melhor relação preço x prazo)"    Detalhes: tabela das 3 cotações    Valor total: R$ 400 (Fornec A)11. Wendel (ou pessoa autorizada da empresa cliente) recebe    notificação no app/celular, aprova com 1 clique12. IA confirma com Fornecedor A:    "Pedido confirmado! 5 latas tinta branca, entrega amanhã 9h    obra [endereço]. Nosso responsável é [nome]"13. IA reserva valor em contas a pagar14. No dia da entrega, recebedor faz check-in da entrega:    "Recebi 5 latas tinta - tudo ok"    IA registra recebimento, libera pagamento15. Tudo aparece no painel visual da obra Y em tempo real.

10.5 Tabelas Necessárias para Esse Fluxo

A maioria não existe ainda: - hub_obras (não existe) - hub_operarios_checkin (não existe) - hub_pedidos_material (não existe) - hub_cotacoes (não existe) - hub_cotacoes_respostas (não existe) - hub_aprovacoes (existe, expandir tipo) - hub_recebimentos_obra (não existe) - hub_contas_pagar (não existe)

Existem hoje: hub_empresas, hub_pessoas, hub_aprovacoes, hub_atividades, hub_log.

10.6 Check-in / Check-out

Mecânica: 1. Operário escreve “cheguei” ou similar no WhatsApp 2. IA verifica: tem obra_atual cadastrada? Sim → registra 3. Se não tem ou ambíguo, IA pergunta “em qual obra você está?” 4. Registro vai para hub_operarios_checkin com tipo='entrada', data_hora, obra_id, operario_id 5. Painel da obra atualiza: avatar do operário aparece como “presente” 6. Quando “saí” / “saindo” / horário ultrapassado, registra tipo='saida' 7. Sistema calcula horas trabalhadas, integra com folha de ponto

Parâmetros configuráveis: - Horário esperado de chegada (alerta se atraso) - Geolocalização opcional (foto com localização) - Foto opcional (selfie ou foto da obra)

11. DASHBOARDS POR PERSONA

Cada tipo de usuário precisa de uma visão diferente do sistema. Esta seção mapeia cada dashboard.

11.1 Dashboard Wendel (CEO Humano - visão global)

Propósito: ter pulso de tudo que acontece, decidir prioridades.

Cards principais: - Receita do mês vs meta - Pipeline projetado (oportunidades x probabilidade) - Top 10 oportunidades quentes - Decisões pendentes de aprovação - Alertas críticos do dia - Custo de operação IA (tokens consumidos por agente) - Empresas clientes ativas - Saúde do sistema (banco, deploy, integrações)

Visual: painel executivo, dados em tempo real, possibilidade de drill-down.

11.2 Dashboard Empresa Cliente (CEO de uma empresa contratante)

Propósito: dono da empresa cliente vê sua operação inteira no Obra10+.

Cards principais: - Leads novos hoje/semana/mês - Funil de conversão - Obras em andamento (com painel visual) - Pedidos pendentes de aprovação - Decisões pendentes (cards no formato “1 clique”) - Performance dos parceiros dela - Performance dos fornecedores dela - Faturamento do mês

11.3 Dashboard Comercial (de uma empresa)

Leads por origem (WhatsApp, indicação, parceiro)

Funil completo com taxa de conversão entre estágios

Tempo médio de primeira resposta

Tempo médio de qualificação

Tempo médio de fechamento por mercado

Leads parados há mais de X dias

Top motivos de perda

Performance de cada agente IA (atendimentos, taxa de qualificação, satisfação)

11.4 Dashboard Marketing (de uma empresa)

Reaproveita o que já existe parcialmente.

Meta Ads: investimento hoje/semana/mês, CPL por campanha, CTR, ROAS, frequência, alcance

Google Ads: mesma estrutura

Performance por criativo

Performance por campanha

Custo por lead qualificado (CPLQ)

Custo por oportunidade

Custo por venda fechada

Fontes: Windsor.ai e Supermetrics (já temos MCP), Meta Ads API, Google Ads API.

11.5 Dashboard de Compras (de uma empresa)

Pedidos abertos

Cotações em andamento

Comparativo de preços recente

Top fornecedores por volume

Top fornecedores por confiabilidade

Alertas de prazo

Histórico de preços (gráfico)

11.6 Dashboard Financeiro (de uma empresa)

Faturamento por mês (gráfico)

Custos por obra

Margem por obra

Contas a pagar (próximos 30 dias)

Contas a receber (próximos 30 dias)

Inadimplência

Comissões a pagar

11.7 Dashboard de Obra (visual, por obra)

Replica o conceito do Escritório Virtual mas focado em uma obra específica.

Mapa do canteiro (visual)

Operários presentes (avatares)

Frentes de trabalho ativas

Materiais a caminho / na obra

Decisões pendentes

Foto do dia

Cronograma com linha do tempo

Alertas (atraso, falta de material, ocorrência)

11.8 Dashboard Hub Parceiros

Visão para Wendel acompanhar a rede de parceiros.

Parceiros ativos por mercado

Parceiros em homologação

Match rate (quantos leads viraram match)

Tempo médio do match até fechamento

NPS por parceiro

Comissões geradas por parceiro

Parceiros sem match há X dias (alerta)

11.9 Dashboard Parceiro (visão restrita)

Cada parceiro vê apenas seus próprios dados.

Seus leads em andamento

Seus matches concluídos

Comissões a receber

Histórico de pagamentos

Desempenho (NPS, taxa de fechamento)

11.10 Dashboard Fornecedor (visão restrita)

Cada fornecedor vê apenas seus próprios dados.

Pedidos pendentes de cotação

Pedidos confirmados aguardando entrega

Pedidos entregues recentes

Faturamento com a plataforma

Avaliação geral

Histórico de relacionamento

12. MULTI-EMPRESA - COMO VAI FUNCIONAR

12.1 Conceito

Cada empresa que se cadastrar no Obra10+ ganha: - Um identificador único (tenant_id) - Uma instância visual personalizada do Escritório Virtual - Acesso a um conjunto pré-definido de agentes IA (com customização) - Isolamento total de dados (vê só os dados dela) - Possibilidade de cadastrar seus parceiros, fornecedores, clientes

12.2 Onboarding de Nova Empresa Cliente

1. Empresa preenche formulário de cadastro:   - Razão social, CNPJ, endereço   - Setor (imobiliária, construtora, arquitetura, etc.)   - Plano contratado (Starter, Pro, Enterprise)   - Email do CEO/responsável2. Sistema cria:   - tenant_id único   - Workspace dela no banco (rows com tenant_id)   - Login do CEO   - Configurações padrão baseadas no setor3. Wizard de onboarding:   - Personalização do Escritório (nome, cores)   - Seleção dos agentes ativos   - Cadastro dos primeiros parceiros   - Cadastro dos primeiros fornecedores   - Conexão WhatsApp Business4. Empresa começa a operar

12.3 Implementação Técnica

Estratégia recomendada: Multi-tenancy por linha (single database, tenant_id em cada tabela).

Mudanças necessárias: 1. Adicionar coluna tenant_id UUID NOT NULL em todas as tabelas hub_* 2. Criar tabela hub_tenants (empresas clientes) 3. Aplicar Row Level Security (RLS) no Supabase 4. Toda query do sistema filtra por tenant_id automaticamente 5. Authentication retorna tenant_id no JWT 6. Frontend usa tenant_id de contexto

Plano de migração: 1. Marcar dados atuais como tenant_id = 'OBRA10' (empresa raiz) 2. Adicionar coluna em todas as tabelas 3. Implementar RLS gradualmente, tabela por tabela 4. Testar isolamento criando 2 tenants de teste 5. Liberar para empresas reais

13. CRONOGRAMA ATÉ 27/05

Hoje: 08/05/2026 Meta: 27/05/2026 Tempo total: 19 dias corridos Recursos: 2 devs seniors + Claude (IA assistente) + Wendel (PO/CEO)

13.1 Premissas

Devs trabalhando full-time

Wendel disponível para validações diárias

Acesso a tudo (banco, repositório, deploy)

Decisões de produto via Wendel em até 24h

13.2 Cronograma Sugerido (Fases)

Fase 0 - Setup e Saneamento (08-10/05) - 3 dias

Objetivo: organizar a casa antes de construir.

Entregas: - ✅ Backup do projeto feito (já feito em 08/05) - Configurar GitHub remote - Configurar Vercel para deploy automático via push (branch main) - Configurar backup automático diário (Google Drive ou GitHub Actions) - Adicionar ANTHROPIC_API_KEY no Vercel (5 min) - Reativar HMAC do webhook - Auditar tabelas legadas, marcar quais arquivar - Corrigir slug dos 3 ciclos do Diretor - Resolver duplicata ariane vs diretora_marketing - Documentação de setup do projeto (README) - Configurar ambiente de staging separado de produção

Fase 1 - IA Operacional (10-13/05) - 4 dias

Objetivo: os 8 ciclos rodando autonomamente, leads sendo respondidos.

Entregas: - IA respondendo lead WhatsApp em < 30s - Os 8 ciclos rodando (todos com total_execucoes > 0) - KPIs sendo calculados automaticamente - Aprovações reais sendo geradas pela IA (substituir mocks) - Dashboard CRM com dados reais - Mobile responsivo (mínimo)

Fase 2 - Parceiros (13-17/05) - 5 dias

Objetivo: parceiros (imobiliárias e corretores) podem se cadastrar e operar.

Entregas: - Fluxo completo de cadastro/homologação de parceiro - Login para parceiros com dashboard restrito - Parceiro cadastra leads via app + WhatsApp - IA distribui leads para parceiros automaticamente - Painel de comissões - Cálculo automático de comissão por venda - Notificações por WhatsApp para parceiros

Fase 3 - Fornecedores (17-22/05) - 6 dias

Objetivo: fornecedores cadastrados, recebendo cotações.

Entregas: - Cadastro de fornecedores por área (arquitetura, engenharia, empreiteira, etc.) - Categorização e tags - Estrutura de empresa + funcionários (CNPJ + CPFs) - Login para fornecedor com dashboard restrito - Sistema de cotação (interface) - Workflow: pedido → cotação automática → comparação → aprovação → confirmação - Avaliação de fornecedor

Fase 4 - Multi-Empresa Básico (22-25/05) - 4 dias

Objetivo: plataforma suporta mais de uma empresa cliente.

Entregas: - Modelo multi-tenant com tenant_id em todas as tabelas hub_* - Onboarding de nova empresa cliente - Personalização básica do Escritório Virtual por empresa - RLS configurado no Supabase - Cadastro de Wendel + 1 cliente piloto

Fase 5 - Polimento e Validação (25-27/05) - 3 dias

Objetivo: sistema pronto para uso real.

Entregas: - Testes end-to-end com cliente piloto real - Bugs críticos corrigidos - Performance otimizada - Documentação para usuário final - Termo de uso, privacidade - Logs e monitoramento configurados - Plano de contingência (rollback)

13.3 O Que NÃO Cabe em 27/05 (Fases Futuras)

Estas funcionalidades são da visão completa mas não cabem no prazo:

Fase 6 (Junho): - Check-in operário via WhatsApp - Pedido de material via WhatsApp - Cotação automática

Fase 7 (Julho): - Painel visual de cada obra - Workflow imóvel → projeto → obra → produto

Fase 8 (Agosto): - Setores: financeiro, compras, projetos - Múltiplos escritórios virtuais (por setor)

Fase 9+ (em diante): - Pós-venda completo - App nativo - Integrações (banco, NFe, etc.) - Marketplace de parceiros

14. O QUE EU PEÇO DE VOCÊS - TAREFAS ESPECÍFICAS

Esta é a seção mais importante do documento. Lista as tarefas concretas, com prioridade.

14.1 Tarefas Imediatas (até 10/05)

TAREFA 1 - Auditoria geral e diagnóstico próprio

Prazo: 09/05 fim do dia Quem: ambos os devs Descrição: Façam vocês mesmos a auditoria completa do projeto. Não confiem só neste documento. Naveguem o código, rodem o sistema localmente, vejam o que funciona e o que não.

Entregas: - Documento curto (1-2 páginas) com observações próprias - Lista de bugs encontrados - Sugestões de melhorias arquiteturais - Estimativa de quanto tempo precisam para chegar até 27/05

TAREFA 2 - Configurar GitHub

Prazo: 09/05 Quem: 1 dev Descrição: O projeto não tem GitHub remote. Configurem.

Passos: - Criar organização “obra10” (ou similar) no GitHub - Adicionar Wendel como owner - Criar repositório escritorio-virtual (privado) - Adicionar os 2 devs como admins - Push do código atual - Configurar branch protection: main precisa de PR review - Configurar .gitignore direito (sem expor secrets)

TAREFA 3 - Conectar Vercel ao GitHub

Prazo: 09/05 Quem: mesmo dev da Tarefa 2 Descrição: Hoje o deploy é manual via CLI. Configurar deploy automático.

Passos: - Conectar projeto Vercel ao GitHub - Branch main = produção - Branch develop = staging (criar) - Pull Request gera preview deploy automático - Garantir que push em main faz deploy automático

TAREFA 4 - Backup automático

Prazo: 10/05 Quem: 1 dev Descrição: Configurar backup automático diário do projeto.

Sugestão de solução: - GitHub Actions que faz dump do banco Supabase + zip do código - Salva em release no GitHub OU em bucket S3 OU em pasta no Google Drive - Email de confirmação semanal para Wendel

TAREFA 5 - Adicionar API key Anthropic

Prazo: 09/05 Quem: 1 dev Descrição: A IA não responde leads em produção. Adicionar variável de ambiente.

Passos: - npx vercel env add ANTHROPIC_API_KEY production - Pegar valor do .env.local ou pedir para Wendel - Redeploy - Testar com lead real (Wendel manda mensagem WhatsApp) - Confirmar resposta automática chegando

TAREFA 6 - Reativar HMAC do webhook

Prazo: 10/05 Quem: 1 dev Descrição: Foi desligado em 07/05 para debug. Reativar com segurança.

Passos: - Gerar secret HMAC novo - Configurar no Evolution API (Railway) - Configurar no Vercel - Reativar validação no código - Testar que mensagem válida passa, falsa rejeita

TAREFA 7 - Corrigir slugs dos 3 ciclos do Diretor

Prazo: 10/05 Quem: 1 dev (com decisão de produto antes) Descrição: 3 ciclos apontam para slug diretor que não existe.

Decisão de produto necessária (Wendel decide): - “Diretor — Análise Matinal” → vai para qual diretor? - “Diretor — Análise Noturna” → vai para qual diretor? - “Diretor — Tráfego 6h” → vai para qual diretor?

Sugestão: Análises Matinal e Noturna para diretor_geral_ia. Tráfego para diretor_operacoes ou criar diretor_marketing separado.

TAREFA 8 - Auditar tabelas legadas

Prazo: 10/05 Quem: 1 dev Descrição: 35 tabelas não seguem padrão hub_*. Avaliar cada uma.

Para cada tabela: - É usada pelo código atual? - Tem dados importantes? - Migrar para padrão hub_* ou marcar como _legacy?

REGRA: Nunca DELETE. Sempre ativo=false ou rename para legacy_*.

14.2 Tarefas de Construção (10-27/05)

Ver cronograma de Fases na Seção 13.

Para cada Fase, peço: - Diariamente: atualização rápida no chat (3 linhas: o que fiz hoje, o que farei amanhã, bloqueios) - Semanalmente: demo das funcionalidades entregues - A cada deploy: validação prévia em staging

14.3 Decisões de Produto que Preciso Tomar

Antes de vocês começarem certas Fases, eu preciso decidir:

Decisão 1 - Slug dos 3 ciclos do Diretor (urgente) Decisão 2 - Resolver duplicata ariane vs diretora_marketing Decisão 3 - Hierarquia de planos comerciais (Starter, Pro, Enterprise) - preços e diferenças Decisão 4 - Logo, paleta de cores e nome final do produto Decisão 5 - Permissões granulares (quem pode ver/aprovar o quê) Decisão 6 - Política de comissão de parceiros (% padrão, regras) Decisão 7 - SLA de resposta da IA (tempo máximo para responder lead)

Vocês podem me lembrar dessas decisões conforme avançam nas Fases.

14.4 Modo de Trabalho

Comunicação: - Chat dedicado do projeto (Slack, WhatsApp grupo, Discord, vocês escolhem) - Stand-up assíncrono diário às 9h (3 linhas: ontem/hoje/bloqueios) - Reunião semanal de 30 min (sextas) - Decisões de produto: vocês perguntam, eu respondo em até 24h

Código: - Tudo via Pull Request, nunca push direto em main - 2 reviewers em cada PR (vocês entre vocês) - Tag git de proteção antes de mudanças grandes - Nunca DELETE - sempre ativo=false ou similar

Banco: - Migrations versionadas - Nunca DROP TABLE - Sempre fazer backup antes de mudanças grandes

Segurança: - Não commitar secrets - HMAC sempre ativo - RLS no Supabase para todas as tabelas - Audit logs em mudanças críticas

15. PADRÕES DE QUALIDADE E REGRAS SUPREMAS

Estas são as 25 regras que rege o projeto. Pedi para Claude as manter de forma consistente em todas as nossas sessões. Vocês precisam respeitá-las também.

15.1 Regras de Proteção e Backup

Porta 3000 = Codex = INTOCÁVEL - existe outro projeto rodando na porta 3000 do PC do Wendel chamado Codex, jamais mexer. Testes locais sempre em porta 3001+.

Tag git de proteção SEMPRE antes de cada mudança grande - permite rollback rápido.

Nunca DELETE: usar ativo=false ou arquivamento reversível - sem exceção.

Sempre testar reversão antes de aplicar mudança destrutiva.

Sempre proteger contexto antes de operações longas.

15.2 Regras de Escopo

Escopo cirúrgico permanente - cada mudança mexe SÓ no que foi combinado. Sem oportunismo (ver bug ao lado e “aproveitar para corrigir”).

Nunca implantar tudo de uma vez - maturidade vem em camadas.

Toda mudança segue Meta-regra: escopo + backup + permissão + log + teste + impacto + ambiente.

15.3 Regras de Decisão

Toda ação que altere dinheiro/contrato/comissão/status NUNCA é executada direto pela IA - sempre via Central de Aprovações.

Decisões técnicas puras: vocês decidem. Estrutura/agentes/UI/dinheiro/risco: consulta com sugestão.

Toda pergunta a Wendel deve vir com sugestão + justificativa em 1 linha.

Se quebrar: PARAR + rollback + replanejar (não consertar em cima).

15.4 Regras de Comunicação

Comunicação direta, sem rodeio.

Sugestões sempre com justificativa.

Validação humana obrigatória pós-deploy antes de próxima mudança.

15.5 Regras de Ambiente

Local dev: porta 3001+ (NUNCA 3000).

Não tocar no Codex (C:\Users\wende\Documents\Codex).

15.6 Regras de Tempo

Timeout por tarefa: 15 min simples, 30 min complexa. Se passar, parar e replanejar.

Avisar Wendel a cada 5 minutos em sessões longas (saúde do trabalho).

15.7 Regras Operacionais

Salvar progresso em tempo real no hub_caderno - tabela do banco para registro contínuo.

Revisão de segurança a cada 5 min ativos: pg_cron, caderno, tags, codex, escopo, deletes.

Aviso 85% capacidade do chat - destaque no topo, repetir até salvar.

Toda vez que pensar em regra suprema útil, avisar para implantarmos.

Se alguma regra suprema divergir, sinalizar conflito e resolver junto.

Em handoff entre sessões, registro completo no hub_caderno.

15.8 Palavras-Gatilho

Em conversas com Wendel ou Claude, certas palavras têm significado especial:

“salva isso” = grava imediato no hub_caderno

“continua” = executa próximo passo lógico sem perguntar

“voltei” = nova sessão, ler caderno e pegar contexto

“errado” = parar e revalidar com SELECT no banco

“redundância” = backup triplo (git tag + caderno + outro)

“handoff” = registro completo no caderno para nova conversa

“confio em você” = pode decidir sem perguntar (raro)

CONCLUSÃO

Pessoal,

Esse é o quadro completo. Sei que é muita informação, mas eu não tinha como passar nada disso só por chat ou reunião. Agora vocês têm:

O contexto completo do produto

O estado real do código e do banco

Os débitos técnicos identificados

A visão futura

O cronograma até 27/05

Tarefas específicas que peço de vocês

As regras que regem o projeto

Próximos passos imediatos:

Vocês leem isso com calma (1-2 horas)

Auditam o sistema vocês mesmos (1 dia)

Me dão um retorno: “consigo entregar a meta de 27/05” ou “preciso mudar isso e aquilo no plano”

A gente alinha numa reunião curta (30 min)

Começamos a Fase 0

Estou disponível para qualquer pergunta, hoje, amanhã ou no fim de semana. Não trava de me perguntar nada. Vamos fazer isso acontecer juntos.

Conta comigo.

Wendel CEO Obra10+

Documento gerado em 08/05/2026. Versão 1.0. Para alterações ou dúvidas: contatar Wendel diretamente.