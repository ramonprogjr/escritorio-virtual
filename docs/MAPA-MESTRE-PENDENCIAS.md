# 🗺️ MAPA-MESTRE DE PENDÊNCIAS — varredura dos 207 docs (06/jul)
> Consolidacao EXAUSTIVA pedida pelo dono para ZERAR de uma vez. ~749 brutas -> ~119 unicas. Substitui a nuvem de docs de pendencia espalhados. Cruzado com o que ja foi feito no ciclo 06/jul.

> **Legenda:** 🔑 VOCE (dono) = janela/credencial/deploy/acesso · 🛠️ EU = codigo · 🧭 DECISAO = escolha de produto · 🚀 roadmap.

## Resumo
Entrada: ~749 pendencias brutas extraidas de 207 docs (muitos historicos, com repeticao massiva entre docs-mestre, backlogs e handoffs). Apos deduplicar e remover o que foi entregue no ciclo 06/jul, sobram ~119 pendencias unicas abertas: 24 dependem de VOCE (dono: janela/credencial/deploy/acesso), 34 sao EU (codigo que o assistente faz), 37 sao DECISAO de produto e 24 sao features grandes de roadmap. 22 itens que os docs ainda listavam ja foram fechados neste ciclo. Regra usada: modulo grande = roadmap; bug/tela/guard pontual = EU; migracao/credencial/acesso = VOCE; escolha de negocio = DECISAO. Onde um doc historico so narrava algo ja concluido, nada foi extraido.

## ✅ JA RESOLVIDO neste ciclo (sair da cabeca) (22)

1. Bug do dinheiro A1: venda de mercado ganha agora gera obra/recebivel/KPI (fix por tipo_fecho)
2. Foto + video da medicao: tira da camera e sobe pro bucket (AUT-6)
3. Historico de medicao com tela + paginacao que nao trunca mais em 500 (AUT-3/4)
4. Diario de obra (RDO) basico: tela + salvar criados
5. JANELA de seguranca aplicada: fechou 24 politicas USING(true), revogou 7 funcoes anonimas, dropou o indice redundante de taxonomia (AUT-7)
6. Card 'Previsto' que mostrava sempre R$ 0 agora soma o contratado dos itens
7. Autor da medicao aparece por nome, nao por codigo
8. Medicao salva de forma consistente (nao grava o avanco antes de registrar)
9. Custo de IA nao falha mais calado: registra pra conciliar (SEC-8)
10. Leak tenant-null Faixa A fechado
11. Buckets de midia do negocio criados
12. Backup + ponto-de-retorno feitos
13. Motor de comissoes: 4 tabelas + rpc_apurar + rpc_recebimento criados e testados
14. Erros do login traduzidos para portugues amigavel (AUT-14)
15. Seletores de 100+ participantes trocados por busca/combobox (AUT-11)
16. Saida e devolucao de estoque deixaram de usar o mesmo handler (AUT-12)
17. Dedup do lead que entra por formulario, por telefone (AUT-2) — ainda falta virar pessoa/FK
18. Vazamento entre clientes nas Aprovacoes tratado (SEC-1)
19. Rotas mortas /comando e /agentes (sobre dados falsos) removidas (AUT-16)
20. Azul off-brand pontual corrigido (AUT-5) — o sweep completo dos 97 azuis segue aberto
21. Ajuste de EAP AUT-8 fechado
22. Confirmado: backup-auto.yml removido e .env fora do OneDrive (risco refutado)

## 🔑 DEPENDE DE VOCE (dono) (24)

1. Rotacionar as chaves-mestras do Supabase (service_role + token pessoal sbp_) e reescopar a INTERNAL_API_KEY — a chave do dev demitido ainda vale ate 2036
2. Rotacionar/trocar as chaves do Render + trocar a senha exposta no chat + configurar o reset de senha do Supabase (Redirect URL, SMTP proprio, expiracao, politica)
3. Tirar as chaves NEXT_PUBLIC_* (INTERNAL_API_KEY e TENANT_ID) do Render/bundle e retestar o login
4. Ligar o toggle de senha vazada (HaveIBeenPwned) no painel de Autenticacao do Supabase
5. Colocar as chaves de IA no Render (Mistral/Groq/Anthropic + COPILOTO_HMAC_SECRET) — liga a IA, o item nº1 do MVP parado ~60 dias
6. Setar CRON_SECRET e MOTOR_FONTE=fornecedores no Render e mover o cron dos KPIs pro Render rodando em todos os tenants
7. Fechar a seguranca do banco (Faixa B / cross-tenant): backfill do tenant vazio, filtro por tenant exato (~50 lugares), ligar RLS em fornecedores, corrigir a policy do financeiro, super_admin so leitura, fechar a policy anonima de hub_pedidos_material, trancar o schema crm_* legado
8. Aplicar na janela o bloco grande de migracoes represadas (AEC/obra/escrow/RLS financeiro/medicao/estrutura unificada/BDI — E0/E2/E4/E5/E6/E8/taxonomia)
9. Aplicar as migracoes pontuais: dropar a FK morta que trava salvar Negocio (N1); FK+indice unico obra<->projeto; indice unico anti-recebivel-duplicado; trilha 'quem deu baixa' no financeiro; coluna CPF anti-duplicado de especialista; tenant em hub_leads_crm; coluna de arquivo pro delete=arquiva; migracao baseline que reconstroi o banco do zero (destrava CI/E2E); JANELA-03 (engenheiro responsavel da obra); revisar juntos o merge de pessoas com backup antes
10. Aplicar as migracoes da Arquitetura A0/A1 (funil de projeto + programa/aprovacoes do cliente)
11. Higiene do banco: mover as extensoes pg_net/vector do schema public e fixar o search_path da funcao _norm_tel
12. Apagar as funcoes antigas de exclusao fisica esquecidas no banco
13. Restringir a listagem publica dos buckets (o de mao de obra tem documento pessoal) e criar os buckets de midia restantes (Passo D) ligando o envio de documento
14. Trocar o rate-limit de memoria por um servico compartilhado (Redis) — precisa provisionar o servico
15. Configurar as credenciais Meta (Lead Ads/Direct) + chave Windsor + login Meta/Google (trafego pago)
16. Finalizar o push pro seu GitHub proprio de backup (o repositorio atual e do dev demitido)
17. Limpeza de acessos: remover o login de teste e2e-arq@obra10.app; rebaixar Ramon (owner->admin) e Ariane (owner->comercial); promover obradezmais a owner/admin definitivo, avisando os afetados
18. Escolher o parceiro de bancarizacao/BaaS + KYC/compliance p/ o escrow guardar dinheiro real (fase 2) e abrir as contas-escrow por obra
19. Semear dinheiro real (recebiveis/medicoes do Consulado) + preencher o funil e o valor dos negocios/leads antigos, pra o sistema mostrar numeros de verdade
20. Trazer os dados/documentos do Asana (o estudo se perdeu) + validar o preset 'Reforma = Consulado' + fornecer a lista real de atividades e descritivos por disciplina (seed do Orcamento IA)
21. Rodar comigo o E2E ao vivo dos fluxos da obra e os 3 testes de IA (gerar fluxo, WhatsApp, copiloto de voz), conferir logado a Fase 2.3 (CrmShell/CrmLayout) e o review visual do mobile no aparelho
22. Desfazer o DEMO do escrow (R$ 15 mil liberado no teste) quando quiser
23. Fornecer os textos de termos de uso e politica de privacidade
24. Ligar o middleware de autenticacao (~60 rotas hoje abertas) depois de decidir a captacao publica

## 🛠️ EU FACO (codigo) (34)

1. Blindar as rotas ainda abertas com guard de papel+tenant (nota de negocio, especialista por id, imoveis, cotacoes, editar lead, atividades, encaminhamentos, GETs internos) e fechar o vazamento entre empresas ao aprovar/listar
2. Corrigir o cron/webhook forjavel: HMAC real com timestamp/nonce e comparacao segura; WhatsApp so via worker
3. Copiloto grava no tenant errado — resolver o tenant real do usuario e assina-lo no HMAC
4. Fechar a injecao de filtro na busca (virgula/parentese burla o tenant) e trocar o filtro frouxo por filtro por tenant exato validado no servidor (nunca do navegador)
5. RBAC num ponto unico (menu/tela/API nao divergem): permissao fina por rota, 2o eixo 'funcao' (arq/eng/campo/compras), fail-closed (papel desconhecido cai em 'sem acesso'), lente de campo no servidor (cliente/prestador nunca recebem custo/margem/fornecedor) e criar o papel 'arquiteto'
6. Trocar a senha dentro do app deve exigir a senha atual antes
7. Trocar 'apagar' por arquivar nos endpoints que ainda apagam de verdade (contatos, canais, distribuicao, cadastro, propostas, fases, docs da IA, vinculos, midias) — lado do codigo
8. Corrigir o codigo da obra e os codigos de cadastro que vazam contagem entre empresas ou repetem sob concorrencia — gerar por sequencia unica por tenant
9. Corrigir inserts que nascem sem tenant, a derivacao de entrega que nao valida o tenant do negocio e o export CSV da visao financeira sem protecao por tenant
10. Blindar a IA: prompt-injection (nome do WhatsApp vira comando), RAG cross-tenant e memory-poisoning entre leads
11. Wrapper unico de IA sempre medindo tokens (fim das chamadas cegas) + gate atomico de creditos ANTES de chamar a IA + rate-limit distribuido
12. SEC-7: as acoes de escrita da IA gravarem auditoria (nada da IA fica sem registro) — mesa dedicada junto da Central de Aprovacoes
13. Consertar a camada de IA: bug do Mistral (interpretar cai em fallback claude-haiku), inverter a ordem dos provedores (Groq/Anthropic antes do Mistral enquanto idle) e mostrar o motivo real do erro (sem credito/chave invalida/quota)
14. Fazer o dinheiro fluir de verdade: modelar MEDICAO estruturada (boletim, trava medido<=contratado, retencao, margem por frente), o negocio-raiz gerar recebivel/medicao/escrow, custodia real (remover o fantasma GREATEST/FOR UPDATE, trava anti-pagamento-duplo) e a dupla-chave EXIGIR as 2 aprovacoes (Arquitetura x Hub, papeis/pessoas distintos, amarrada ao responsavel da linha, registrando quem usou cada chave) — inclui a rpc_liberar_pagamento_comissao e as telas do financeiro
15. Comissao imutavel: tirar a 'foto' do valor no fechamento (hoje da pra editar) + auditada
16. Lancamentos financeiros automaticos por evento (negocio ganho->a receber; medicao/compra->a pagar), recebivel puxando QUEM deve do negocio ganho e consolidacao das 4 fontes por ligacoes reais (elimina #REF!)
17. Bugs em producao: exigir vinculo do item de escopo ao lancar custo (orcamento nasce solto, cobertura mostra zero); padronizar nome do ambiente (Sala/sala/SALA quebra subtotais); cascata de aprovacao rodar no endpoint que a tela realmente chama; alinhar a fonte unica de 'andamento' da obra (status x estagio divergem no Consulado); Campanhas 'Conversoes' sempre 0
18. Registros por entidade (nota/ligacao/visita/timeline/proxima-acao) alimentando os indicadores de verdade (hub_eventos + timeline nos 4 cadastros + SLA real) e as funcoes que faltam (agendar reuniao, registrar ligacao/visita, follow-up automatico)
19. KPIs/Analytics: recalculo automatico diario (tirar o botao 'Atualizar KPIs'), ligar o hub_eventos que alimenta os numeros (Painel/Analytics zerados apesar de negocios reais) e corrigir alertas duplicados e numeros com o mesmo rotulo divergindo (ao vivo x gravado)
20. Dedup e vinculos: lead do formulario virar pessoa (FK) + codigo unico; validacao forte de CPF/CNPJ + dedup por documento; vinculo real pessoa<->empresa N:N com tela nos dois lados
21. Relatorios: ligar o Exportar (CSV/Excel) que ja existe no backend, filtro de periodo, linha clicavel, busca/ordenacao, tirar o dump cru/SQL exposto e por faixa de insight da IA + cards no celular
22. Atendimento (inbox): tempo real (nao 30s), item mostrando ultima mensagem+nao-lida+horario, corrigir quem enviou (IA x humano), limpar copy tecnica e trocar as 4 respostas fixas por 'Sugerir resposta (IA)' + resumo + proximo passo
23. Esteira de entrega ao fechar negocio: trocar o 'spawn magico' ganho->obra por propor-e-confirmar (1 clique), 'Gerar projeto' do negocio ganho, o Gerar Obra levar segmento/memorial/ambientes (hoje nasce vazia), bloquear criar obra por texto livre e convergir os oficios no atomo universal (aposentar tabelas-fantasma marcenaria/vidracaria/marmoraria)
24. Sweep de identidade visual: repintar os 97 azuis/roxos off-brand (29 arquivos) para verde+dourado e tokenizar as telas de detalhe fora do CRM
25. Polimento UX transversal: avisos de erro/sucesso (telas falham em silencio), confirmar/desfazer nas acoes de impacto (Perdido/Concluir/Marcar pago/Marcar recebido/cortar acesso/rebaixar papel/remover contato), mascaras de telefone/CPF, loading/skeleton, trocar window.confirm nativo por componente e toasts
26. Acessibilidade: reabilitar o zoom, corrigir contraste (AA), mover o kanban por teclado, respeitar 'reduzir animacoes' e por indicador de scroll horizontal
27. Mobile: remover o 3o header (migrar o rodape de sessao pro MobileShell), unificar o menu mobile ao do desktop (matar a barra inferior + o botao 'Pulso', virar drawer em secoes), funil em lista vertical e destravar criar pessoa/empresa no celular
28. Limpar os vazamentos de fachada/copy tecnica visiveis ao cliente ('reinicie o servidor porta 3001', nomes de tabela, Windsor.ai, 'PDF Pt.14', slugs/tokens UAZAPI, env vars, placeholders 'PES/LED/NEG', pt-PT 'actuar/activar/registo')
29. Padronizar o esqueleto das 7 telas fora do padrao (+ revisar ~16 parciais) e virar as tabelas pesadas em cards/Kanban (Cadastros/Parceiros/Imoveis/Leads/Canais/Ficha360/Tarefas/Pedidos), podando KPIs duplicados e colunas tecnicas (Tenant/UUID/JSON/endereco/auditoria)
30. Onda de telas comerciais: KPIs/somas vindo do backend sobre TODOS os registros (nao so os 20 da tela — Pipeline aparece menor), matar a barra de progresso falsa (42%) e o '85%' de confianca inventado, unificar a regua de urgencia dos leads, Caixa de Oportunidades como tela unica (Lista -> Relatorios), motivo de perda obrigatorio + desfazer arraste e debounce na busca
31. Onda de telas de operacao: trocar 'digitar UUID' por seletor por nome, renomear Obras->Engenharia / Projetos, cards enriquecidos (cliente/tipo/status/avanco/foto), busca/filtro, painel da obra honesto ('em construcao' + 1 acao real), imoveis em grid com foto (campo de imagem no banco), especialistas com busca e UF-por-DDD, fornecedor nascendo ligado ao motor (mercados/recebe-leads/status) e area de atuacao em chips
32. Onda de telas financeiro: valor exato com centavos (nao arredondado em tela de conciliacao), loading/desfazer/aviso em Marcar pago e Marcar recebido, link direto por id (nao lista generica) e recolorir o azul/roxo fora da marca
33. Onda de telas IA/Agentes/Admin: aneis de saude com valor fixo (0.35/85%) -> dado real, criar agente IA-first (chips + 'gerar instrucoes'), horario em Brasilia (nao UTC), blindar a Precificacao (Salvar sobrescreve a cobranca da rede), health-check real das Integracoes, esconder painel tecnico/secrets do cliente (super-admin), separar 'Guardar horario/distribuicao', validar telefone dos contatos de alerta e tornar Escritorios clicavel
34. Injetar IA de verdade nas telas-ancora (negocio/lead/atendimento hoje 100% manuais): explicar prioridade, sugerir a proxima acao com data (1 toque), preview da mensagem de encaminhamento, descarte com motivo, sugerir fornecedor na distribuicao (motor existe, falta tela), card 'A IA entendeu assim', barra fixa 'Perguntar a IA' que cria ACOES, capturar motivo ao rejeitar aprovacao (chips) e fazer cada decisao virar aprendizado do agente (ligar a extracao de memoria ja no codigo)

## 🧭 VOCE DECIDE (produto) (37)

1. Desembaralhar fornecedor x parceiro x empresa-cadastro (tripla sobreposicao; /crm/empresas mistura tenant e empresa PJ): unificar ou separar; uma tabela de fornecedor com papeis (rede x executor) ou duas; PF sai de Fornecedores (fornecedor = so PJ) para Especialistas
2. Valor no comercial: faixa ou numero exato? (destrava o preenchimento inteligente/SmartField)
3. Score do lead: virar ordenacao explicada ou sair da tela (hoje aparece em 3 lugares sem servir)
4. Distribuicao de lead: a 1 fornecedor (exclusivo) ou a 2-3 (o mais rapido ganha)? + visibilidade do lead proprio do fornecedor por plano + pesos do score por mercado
5. Liberar a juncao de cadastros duplicados (merge): quem pode mesclar e em qual ambiente
6. Etapas proprias do funil por mercado (hoje 8 genericas p/ todos) + os 7 estagios do funil da Arquitetura
7. Canais de WhatsApp: definir no banco quais agentes sao canais (hoje o sistema adivinha por regra escondida)
8. 'Caixa de Oportunidades' e a tela principal do gestor (Kanban vira so visao de pipeline)? + cadastro no computador: tabela ou cards?
9. Follow-up customizavel (cadencia, tentativas, gatilhos) + resolver o agente repetido (Ariane x Diretora de Marketing)
10. Escrow/medicao — regras do dinheiro: as 2 chaves sao papeis/pessoas distintos? alcada por valor na 2a chave, adiantamento sem orcamento, spread de gerenciamento, quando o tipo de contrato trava, % de retencao padrao, tratamento do excedente, medicao retroativa, de onde vem o custo realizado
11. O Hub enxerga a margem real (custo x preco) mesmo no preco fechado, ou e segredo da executante? + o que o cliente ve em cada modelo de contrato
12. Honorario do arquiteto: por projeto (pre-obra) ou so quando virar obra? + modelo de tenant do escritorio do arquiteto (tenant proprio x membro do Hub), que bloqueia o financeiro dele
13. Lado de entrada do escrow: quem confirma o recebimento (Hub manual? Pix/gateway?)
14. Comissao travada no fechamento (foto do valor ao ganhar) + % de comissao dos parceiros
15. Creditos de IA: markup por escritorio ou por mercado + rotulo claro (hoje 10 = 10x/1000%) + quando ligar o bloqueio por saldo de Tijolos negativo + quando entra a compra/recarga
16. Planos SaaS (nomes/precos/o que cada um libera: Starter/Pro/Enterprise) + cobranca Hub-Parceiro (assinatura + comissao/split)
17. Financeiro: saldo bancario real/conciliacao ou so projecao (receber - pagar)? + alcada por valor (pagamento acima de X exige um superior)
18. Nota Fiscal: so anexar o PDF/XML ja emitido ou emitir de verdade (SEFAZ/prefeitura)?
19. Regras de operacao/negocio soltas: comodato, frete Lalamove (repassado ou no spread), 3-4 KPIs do fornecedor, 'entregue x aprovado', mapa tipologia->tipo de obra, gatilho 'Gerar obra' (em 'entregue' ou 'aprovado'), spread por modelo de contrato
20. Multi-tenant: modelo A/B + quando ligar o 1o tenant real + ligar agora a separacao total por escritorio ou depois + canonizar os papeis em ingles (PT vira sinonimo) ou manter os dois
21. Abrir login externo (cliente/fornecedor/mao de obra) + o elo Comunidade(Membros)->CRM + o contrato Membro->fornecedor (regra de elegibilidade, campos, gatilho)
22. Captacao publica: quais formularios ficam sem login (landing cria parceiro/fornecedor? cadastro publico de empresa cria escritorio sozinho? link 'rede' e intencional?) e parar de mandar a chave interna pro navegador (raiz do risco dos portais)
23. Recorte do painel por perfil: aprovar a v1 (Hub + engenharia + cliente) + densidade do dashboard (5 ou 7 cards) + mostrar o bloco de rede/Parceiros so pro Hub
24. Multi-tenant nos paineis: alertas/observacoes de IA/ciclos de todos os escritorios ganham dono (tenant) ou viram 'do Hub'; 'Homologados' conta a rede toda ou por escritorio; regra unica p/ registros antigos sem dono
25. Privacidade: quem pode ver o telefone/WhatsApp do contato (hoje aparece p/ todos) + /health publico revela quais segredos existem (deixar so o basico)
26. Stubs no menu (/crm/conteudo, Tarefas, Ferramentas IA, agentes-reais, trafego): esconder / 'Em breve' / owner-only ou construir agora (nao deixar stub quebrado a vista do cliente)
27. Armazenamento de midia publico x privado + contrato/NF/foto de medicao privados (link assinado) ou publicos
28. Voz (Talk-and-Go): no aparelho ou por servico (custo x privacidade) + agentes do membro Mistral ou Anthropic + agente sem fluxo (Cargo/So-playbook) auto-gera atendimento ou so avisa + SLA maximo de resposta da IA
29. Portal do Cliente: o que ele enxerga (tudo com custo/margem ou so a visao honesta dele) + selo de auditoria automatico (IA+amostragem) ou humano assina + cliente comenta/pede ajuste (vira pendencia auditada) ou so visualiza/aprova
30. Operacao de campo: operario sem smartphone (PIN/biometria/cracha-QR?) + tablet-comodato e condicao de entrada ou comecar com celular+geofence + condicao de entrada do fornecedor
31. Modelar PRODUTO e SERVICO-de-obra no schema agora ou deferir (hub_produtos nao existe; hub_servicos hoje so catalogo de marketing) + definir o catalogo de produto fisico (hoje so 'mercado')
32. Catalogo de materiais: definir os ~20 itens (sem eles a compra abre vazia — bloqueante), os pesos do score de cotacao, aceitar ferramenta/EPI/EPC e importar os ~500 itens reais
33. Validacoes de obra (E0-E7/EAP): preset Reforma=Consulado, separador do codigo (ponto/hifen), andamento no subitem, 'Cancelado' encolhe a barra?, sincronizacao item->cronograma, regras de bloqueios (so avisa, nunca reprograma), captura da Curva S (robo diario ou ao salvar) e granularidade, lista de ambientes por segmento, taxonomia-nucleo das 5 disciplinas, quantidade padrao em branco ou pre-preenchida, estoque negativo, onde mora o estoque minimo
34. Posicionamento/arrumacao de telas: Analytics/Relatorios viram botoes no Dashboard? Relatorios = so consultar/exportar (tirar o mini-dashboard)? Ferramentas IA vira 'Habilidades' dentro do Agente? Logs/Alertas viram notificacao+relatorio (Ciclos como unica tela)? Escritorios vira hub de gestao da rede quando houver billing? Unificar /office com o menu do CRM? Manter so Meta Ads ou multi-canal?
35. Decisoes menores de UX + docs: cor da custodia (violeta x dourado), onboarding com tour ou aprender-fazendo, esclarecer o 'ponytail' que voce pediu e reconciliar os 2 documentos-mestre (fonte de verdade ou fundir)
36. Estrategia de receita: escolher 1 fonte cobravel cedo + um 'pronto' curto e datado (IA ligada + nucleo + 1 cliente piloto) + go/no-go para liberar parceiros e fornecedores reais + definir quem aprova o que (permissoes por papel)
37. Decisoes do marketplace/campo (fase futura): matching (preco+distancia+SLA), transparencia do spread, selo de frescor + trava de preco, cold-start regional, teste inicial (SP ~20 fornecedores), frete repassado ou no spread, % de comissao por elo e gate por valor minimo

## 🚀 ROADMAP (modulos grandes) (24)

1. Coracao IA-first conversacional cobrindo o fluxo inteiro (recebe leads -> pede fornecedores -> levantamento -> orcamento -> compras -> follow-up -> check-in -> coordena a obra empurrando pendencias) — o nº1 do produto
2. Orcamento por IA (o moat): memorial em PDF -> planilha executiva/custos/financeira auditavel, precificando pelo catalogo (humano confirma quantidades na v1, IA le a planta na v2) + EAP-taxonomia (E0.5) + base de precos propria por usuario + IA que cruza memorial x orcamento e sinaliza disparidade
3. Espinha da Obra completa (E0-E7): Nova Obra em 3 toques + carteira + editor de EAP + Catalogo; Cockpit 'Hoje'/carteira por urgencia; Itens & Avanco (situacao automatica x andamento manual, por disciplina/andar, com voz); Restricoes/Bloqueios de 1a classe; Cronograma + Curva S com linha de base; Compras->Estoque; Financeiro da obra (2 modelos de contrato + escrow); Medicao estruturada — tudo sobre a arvore de escopo unica (1 item vira memorial/orcamento/contrato/compra/medicao/cronograma) com AMBIENTE elevado a nivel de EAP e BDI
4. Central de Aprovacoes unificada (todos os gates numa fila por setor/tipo, IA prioriza e auto-aprova o trivial, aprovar em lote, loop que ensina o agente, escrow 2 chaves, persona cliente)
5. Gestor de Tarefas universal + Tela 'Hoje' universal por perfil (todo verbo vira tarefa: criador/executor humano-ou-agente/aceite/prazo/registro, dependencias, IA orquestra a teia e o humano so ve o que precisa dele)
6. Portal do Cliente pleno (login proprio + painel que cura os 5 medos: avanco/financeiro/fotos/aprovar/selo, escrow/dupla-chave, Curva S, RDO, IA de risco, push, PDF, multi-obra) sem mostrar custo/margem
7. Portal do Fornecedor real (hoje prototipo/403): cotacoes direcionadas + status das propostas + pedidos a entregar, com link expiravel e jornada completa
8. Monetizacao SaaS: planos/assinatura/modulos + creditos de IA (carteira Tijolos com teto de gasto, recarga, previsao 'dura X dias', semaforo, alerta de saldo baixo, botao Recarregar e saldo no topbar) + comissao com rateio/split por codigo unico + funil de 2 niveis Hub x Parceiro com KPIs/SLA
9. Multi-tenant real (tenant dinamico lendo users.tenant_id + >=2 tenants provisionados + suite de teste de isolamento lado a lado + Dashboard do Hub 'cada um ve so o seu, Hub ve tudo' + Saude da Rede) e Configuracoes self-service (empresa cadastra funcionarios + permissoes finas)
10. Operacao de campo (E8-E10): RDO por voz/foto, check-in por GPS/geofence, IA-campo anti-fraude por especialidade (cruza respostas+fotos+projeto), totem de compra por voz, SST com poder de bloqueio, copiloto executivo e 'rigidez invisivel' (campo so ve Foto/Problema/Concluir)
11. Marketplace / 'iFood da construcao' (fase 2-3): catalogo do fornecedor + matching + frete por tabela/Lalamove API + spread honesto + escrow no gate + cadeia de oficios com split por elo + preditivo determinístico (o moat) + tablet-comodato + ML
12. Modulo Servicos com todos os oficios (marcenaria/marmoraria/vidracaria/serralheria/pintura/eletrica) + prestadoras puxando mao de obra sob demanda + cadeia de contratacao encadeada (arquiteto->engenharia->prestadora->mao de obra) com codigo unico por elo + motor de 'modelo por oficio' (presets + taxonomia + travas da IA como dado) + Servico Universal (instancia leve do atomo de obra) + fluxos conversacionais por segmento com protecoes
13. Modulo Arquitetura de verdade (carteira de PROJETOS, nao funil de lead): funil de projeto editavel + ficha do arquiteto + programa de necessidades + aprovacoes do cliente + elo Projeto->Obra ('Gerar Obra' herda o projeto) + aba Escopo/Orcamento + financeiro do arquiteto (Tijolos, pagamentos por projeto, honorario) + plantas/fases/BIM no futuro
14. Tela de Produtos + ficha (onde e usado/preco/obras) + estoque global como lente + as telas que faltam: cockpit de Compras, Estoque global, Central de Documentos e a tela central de IA
15. Rastreabilidade total (blueprint-mae): linhagem pai/raiz viva no fluxo real, entidades hoje ilhadas conectadas (mao de obra/imovel/produtos), codigos param de dar 404, negocio-filho automatico ligado ao pai/raiz, tela de linha do tempo/arvore, analytics de grafo e link de cadastro que ja embute o codigo de quem gerou
16. Central de Performance Comercial (metricas por perfil, SLA acionavel, ranking de fornecedores, forecast, dashboards por persona) + analytics de grafo que respondem sozinhos
17. Motor de distribuicao de leads persistido pleno (a tabela hub_lead_distribuicao nao existe): fila com score/SLA/redistribuicao, cascata de rejeicao, gate financeiro do fornecedor, painel do Hub, indice de aderencia, agente auditor de SLA e leitura dos canais cadastrados
18. Fundacao 'nada se perde' transversal (arquivar + trilha automatica + negocio_id nos elos que faltam + lixeira/recuperacao pelo Hub acima de TODOS os modulos) + Mensageria por papel (salas por negocio, acesso por participacao) + Comunidade integrada com feed em tempo real
19. CRM cross-conta pleno (negocio aparece no CRM de todos os envolvidos com a cor do mercado + selo 'voce esta envolvido'; so o dono e o Hub movem; envolvido ve/comenta/atribui; Hub enxerga todos os pipelines com dashboards) + fichas cruzadas estilo Pipedrive + itens do negocio (servico/etapa qtd x preco) + campos ricos + notificacoes in-app/push + modulos de Tarefas e Agenda
20. Base pre-producao: CI/CD + healthcheck + observabilidade (logger em todas as ~187 rotas, PII redigida, log central de erros, fim dos catch vazios) + performance (paginacao, virtualizacao, realtime incremental, resolver N+1 do motor/agentes, indices/FKs) + recuperacao de desastre + ESLint/npm audit + religar o E2E no CI + smoke-test no deploy + testes de render dos componentes compartilhados + quebrar os arquivos gigantes + componente unico de gaveta CRUD + deletar o codigo morto do 'escritorio virtual' legado (~50 orfaos)
21. Marketing/trafego com IA (Google + Meta) + IA preditiva de atraso da obra + analise automatica de foto (classificar/verificar evidencia) + importador de Asana + relatorios generativos (BI sob demanda) + Dashboard que aprende o que cada pessoa quer ver
22. 2FA + auditoria por usuario (dispara com o 2o tenant real) + camada Enterprise/escala (LGPD, governanca, API publica, SLA, multi-unidade)
23. Marketplace de materiais asset-light + entrega em 2 niveis (fornecedor entrega o planejado + Lalamove para o imediato) + alerta preditivo de material (cruza estoque com o cronograma/EAP)
24. Editor de fluxo visual do agente / Agent Builder por IA (gera o fluxo ja na criacao, baloes separados, nos de PDF/audio, editar falando) + Copiloto de Voz Global (setor fixo no banco)
