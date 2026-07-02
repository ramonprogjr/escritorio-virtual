# Visão Definitiva do Sistema por Usuário, Função, Tela, Clique e IA

> **INSUMO DO DONO — recebido 02/jul/2026, salvo verbatim (anti-perda).** Blueprint de UX/produto (o "como se usa") complementar à `SPEC-RASTREABILIDADE-COMPLETA-HUB.md` (o "como se conecta"). Base da Maratona 2 (módulos). Não editar o texto do dono.

## 1. Ideia central do sistema

O sistema deve ser desenhado para pessoas que trabalham com: arquitetura; engenharia; construção; reforma; marcenaria; serralheria; vidraçaria; pintura; empreiteiras; prestadores de serviço; fornecedores de produtos; equipes de campo; compras; financeiro; planejamento; coordenação; direção.

A base do sistema não deve ser "menu e formulário". A base deve ser: **O que você precisa resolver agora?**

O sistema precisa funcionar como um assistente operacional de gestão, direção e controle. Ele precisa: lembrar; orientar; cobrar; proteger; controlar; medir; mostrar; prever; avisar; documentar; gerar relatório; sugerir decisão; reduzir retrabalho; transformar conversa em ação; transformar foto em registro; transformar pendência em cobrança; transformar compra em estoque; transformar execução em medição; transformar projeto em obra; transformar serviço em entrega.

A experiência ideal é: "Fale o que aconteceu ou clique no que quer fazer. O sistema organiza o resto."

## 2. Regra-mãe: no máximo 3 cliques ou comando por voz
Tudo precisa ser resolvido em até 3 cliques. Ex.: Solicitação de compra (+Novo → Solicitação → item por voz; a IA completa produto/qtd/obra/etapa/estoque/fornecedor/urgência/impacto). Diário de obra (Hoje → Registrar Diário → falar/fotos; a IA estrutura atividades/equipe/materiais/pendências/interferências/próximos passos/fotos/relatório). Aprovar compra (Aprovações → abrir → Aprovar/Recusar/Pedir ajuste; a IA mostra valor/fornecedor/cotações/impacto orçamento+prazo/estoque/urgência). Criar serviço vidraçaria (+Novo → Serviço → voz "instalar vidro temperado no banheiro do cliente X"; a IA pergunta só o necessário e cria OS/checklist/orçamento/lista de produtos/agendamento/responsável).

## 3. Estrutura principal — 4 áreas operacionais conectadas
1. **Arquitetura**: briefing; levantamento; conceito; estudo preliminar; anteprojeto; executivo; compatibilização; entregáveis; revisões; aprovação do cliente; documentação p/ obra; projeto de marcenaria/interiores/condomínio; memorial; quantitativos.
2. **Engenharia**: obra; reforma; planejamento; cronograma; EAP; diário/RDO; equipe; compras; medições; qualidade/FVS; segurança; documentos técnicos; aditivos; financeiro da obra; entrega; garantia.
3. **Serviços**: ordem de serviço; reparos; manutenção; pintura; serralheria; vidraçaria; marcenaria; elétrica; hidráulica; instalação; montagem; comissionamento; vistoria; laudo; assistência técnica; garantia.
4. **Produtos**: catálogo; materiais; ferramentas; equipamentos; EPI/EPC; produtos acabados; peças; fornecedores; estoque; compra; cotação; pedido; recebimento; aplicação; movimentação; custo real.

## 4. Como tudo se conecta (caminhos)
- **1 — Arquitetura vira Engenharia**: projeto aprovado → sistema pergunta "vai virar obra/reforma?" → cria escopo executivo/etapas/cronograma/lista preliminar de compras/documentos/orçamento/checklists/responsáveis.
- **2 — Engenharia demanda Arquitetura**: obra acha incompatibilidade → registrada no diário → IA entende problema de projeto → abre pendência p/ arquitetura → arquiteto revisa → engenharia recebe revisão aprovada.
- **3 — Engenharia demanda Produtos**: cronograma mostra atividade em 3 dias → estoque não atende → IA alerta compras → cotação → aprovação → entrega → estoque atualizado → atividade liberada.
- **4 — Serviço demanda Produtos**: serviço criado → identifica produtos → verifica estoque → falta abre compra → executar registra produto aplicado → vira custo do serviço → vira entrega+garantia.
- **5 — Produto alimenta Engenharia/Serviços**: catálogo → orçamento → compra → estoque → aplicação → custo real → histórico de consumo → IA prevê compras futuras.

## 5. Tipos de usuários e o que cada um vê (cada um enxerga só o que precisa)
**5.1 Direção/dono/gestor** — visão, controle, decisão. Tela: obras/projetos/serviços em andamento, atraso geral, margem por obra/serviço, compras críticas, pagamentos pendentes, recebimentos previstos, documentos vencendo, clientes aguardando, fornecedores problemáticos, equipe sobrecarregada, alertas de risco. Botões: Ver riscos/financeiro/obras atrasadas/compras críticas/aprovações; Perguntar à IA; Gerar relatório executivo. Voz: "quais obras em risco?", "onde estou perdendo dinheiro?", "o que atrasou esta semana?", "resumo p/ diretoria". IA = controller operacional (traz o problema pronto; direção não entra em cada tela).
**5.2 Arquiteto titular/coordenador** — projetos ativos, entregáveis de hoje, revisões pendentes, aprovações do cliente, solicitações da engenharia, compatibilizações, arquivos a emitir, documentos p/ condomínio, projetos que podem virar obra, demandas novas. IA = assistente de projeto (organiza briefing, resume reunião, cobra revisão, compara versões, checklist de entregáveis, memorial, lista preliminar de materiais, aponta falta de info, avisa quando engenharia precisa de resposta).
**5.3 Equipe do escritório (assistentes/designers/estagiários/desenhistas/coordenadores/adm)** — minhas tarefas/entregáveis/prazos, arquivos a revisar, comentários do cliente, pendências da coordenação, solicitações da engenharia. IA: reunião→tarefas, confere prancha faltante, lembra prazo, lista pendências, gera descrição de entrega, separa arquivos por versão, prepara mensagem p/ cliente.
**5.4 Engenheiro responsável** — obras sob responsabilidade, atividades de hoje/atrasadas, interveniências, risco técnico, compras que travam obra, documentos pendentes, FVS pendentes, diários não preenchidos, medições pendentes, solicitações de campo. IA = coordenador técnico (entende diário, identifica risco, cruza cronograma×compras, cobra responsável, cria pendência, sugere replanejamento, verifica documentos, impede conclusão sem evidência, gera relatório técnico).
**5.5 Coordenador de obra/supervisor/mestre** — tela de CAMPO simples: o que fazer hoje, equipe, materiais liberados, ferramentas, pendências, fotos exigidas, checklists, atrasadas, botão grande de IA. Botões: Iniciar dia/Registrar presença/Registrar foto/Informar problema/Solicitar material/Concluir atividade/Pedir orientação/Encerrar dia. IA transforma fala em registro (diário/pendência/SC/alerta/evidência/status/checklist/relatório).
**5.6 Compras** — solicitações pendentes, urgentes, próximos 3 dias, cotações abertas, aguardando aprovação, comprados, entregas atrasadas, divergências de recebimento, estoque baixo, fornecedores com problema. IA: entende urgência, sugere fornecedor, compara cotação, cruza prazo×cronograma, evita duplicada, verifica estoque, alerta preço fora do histórico, avisa engenharia, prepara aprovação.
**5.7 Planejamento** — cronograma geral, caminho crítico, atrasadas, futuras, dependências, compras vinculadas, equipe necessária, restrições, avanço previsto×realizado, curva S. IA: simula impacto, sugere reprogramação, reorganiza frentes, mostra gargalos, prevê atraso, plano de recuperação.
**5.8 Financeiro/administrativo** — contas a pagar/receber, vencendo, atrasados, compras aprovadas aguardando pagamento, medições aprovadas, NF pendentes, comprovantes faltantes, saldo/margem/custo por obra. IA: cruza compras×pagamentos e medição×cobrança, avisa vencimento, cobra comprovante, detecta pagamento duplicado, aponta custo fora do orçamento, resumo financeiro.
**5.9 Prestador de serviço** — serviços atribuídos, endereço, horário, escopo, materiais, responsável, fotos obrigatórias, checklist, valor/pagamento se autorizado. Botões: Aceitar/Estou a caminho/Cheguei/Iniciar/Enviar foto/Informar problema/Concluir/Solicitar material.
**5.10 Mão de obra de campo** — ainda mais simples (celular): serviço de hoje, local, horário, responsável, tarefa, foto exemplo, checklist simples. Botões: Cheguei/Comecei/Foto/Problema/Terminei. IA aceita áudio simples ("a massa acabou" → problema: falta material; item: massa; atividade impactada; responsável: compras/campo; urgência: alta).
**5.11 Cliente** — Portal: status geral, próximas etapas, fotos aprovadas, documentos, aprovações pendentes, pagamentos, relatórios, mensagens, garantias. IA limitada (não mostra custo interno/problemas internos/margem).

## 6. Visões por segmento (fluxos próprios)
- **Arquitetura**: cards por fase (briefing→levantamento→estudo→desenvolvimento→revisão→cliente→aprovado→emitido); botões Novo briefing/levantamento, Criar entregável, Enviar p/ aprovação, Gerar memorial/quantitativo, Transformar em obra.
- **Engenharia/construção/reforma**: Obras (planejamento→mobilização→execução→aguardando material→atrasada→medição→entrega→garantia); botões Hoje/Cronograma/Diário/Compras/Pendências/Medições/Relatório/IA da obra.
- **Marcenaria**: lead→briefing→medição→projeto→orçamento→aprovação→compra insumos→produção→entrega→instalação→ajustes→garantia. IA: briefing→lista de móveis, lembra medição, lista de ferragens, sugere insumos, custo previsto×real, avisa atraso produção, ordem de instalação, controla ajustes.
- **Vidraçaria**: solicitação→vistoria/medição→especificação→orçamento→aprovação→pedido do vidro→recebimento→instalação→conferência→entrega→garantia. IA protege contra erro de medida/especificação (pergunta tipo/espessura/aplicação/ambiente/ferragem/acabamento/risco/acesso/prazo; bloqueia orçamento sem foto+espessura).
- **Serralheria**: vistoria→medição→desenho→orçamento→compra material→fabricação→pintura/acabamento→instalação→conferência→entrega.
- **Pintura**: vistoria→quantificação→especificação→orçamento→compra→proteção→preparação→pintura→retoque→limpeza→entrega. IA estima material, lembra proteção, foto antes/depois, aceite, retoques.
- **Empreiteira**: escopo→contratação→mobilização→execução→medição→aprovação→pagamento→encerramento. IA mede avanço, compara produção, alerta baixo desempenho, pagamento por etapa, evidência.

## 7-8. Tela "Início" (muda por perfil) e Tela universal "Hoje"
"Hoje" é a tela mais importante — existe para todos, personalizada, e responde "O que eu preciso fazer agora?".

## 9. Botão universal "+ Novo" (global, contextual)
Opções por perfil: Projeto/Obra/Serviço/Cliente/Local/Produto/Compra/Pessoa/Fornecedor/Documento/Pendência/Aditivo/Pagamento/Relatório/Diário/Medição/Garantia. A IA entende o contexto (dentro de uma obra, +Novo>Compra já nasce vinculada à obra; dentro de marcenaria, sugere ferragens+MDF).

## 10. Botão universal "Perguntar à IA"
Barra fixa: "Pergunte, peça ou mande fazer". A IA NÃO só responde texto — cria AÇÕES (ex.: "crie compra de 50 sacos de cimento p/ obra X"). Toda ação crítica tem confirmação.

## 11. A IA como coordenadora
- **11.1 Lembra** (prazos, decisões, aprovações, documentos, compras, histórico, fornecedores, problemas anteriores, preferências do cliente, padrões de orçamento, uso de produtos).
- **11.2 Cobra** (responsável atrasado, compra parada, diário não preenchido, cliente sem aprovação, fornecedor sem nota, equipe sem documento, etapa sem foto, pagamento sem comprovante).
- **11.3 Protege** (compra duplicada, material errado, etapa sem evidência, pagamento sem aprovação, fornecedor sem documento, pessoa sem liberação, serviço extra sem aditivo, projeto sem aprovação, prazo alterado sem justificativa, custo fora do orçamento, obra sem ART/RRT).
- **11.4 Mede** (avanço físico/financeiro, produtividade, atraso, consumo, custo real, margem, pendências, compras, retrabalho, tempo de resposta/aprovação).
- **11.5 Orienta** (campo, compras, arquitetura — o próximo passo certo).
- **11.6 Prevê** (risco de atraso, falta de material, sobrecarga de equipe, estouro de custo, fornecedor problemático, compra que não chega a tempo, documentação vencendo, retrabalho provável).

## 12. Controlar sem parecer burocrático — RIGIDEZ INVISÍVEL
O campo vê Foto/Problema/Concluir; por trás o sistema verifica atividade vinculada/responsável/horário/local/foto/checklist/materiais/impacto/qualidade/diário/relatório. O usuário não sente a burocracia; o sistema captura a governança automaticamente.

## 13-16. Fluxos em até 3 cliques
- **Arquitetura**: criar briefing; converter em projeto (fases/entregáveis/responsáveis/prazos/checklist); enviar p/ aprovação; transformar em obra (EAP/cronograma/compras/documentos/checklists).
- **Engenharia**: criar obra (template); registrar diário; solicitar compra (verifica estoque/fornecedor/prazo/impacto/aprovação); medir etapa (avanço/valor/pendências/cobrança).
- **Serviços**: criar (OS/checklist/materiais/agendamento/responsável); executar (início/execução/pendências/materiais usados); concluir (relatório/cobrança/garantia).
- **Produtos**: criar (categoria/unidade/fornecedores/aplicação/estoque mínimo); comprar (estoque/consumo/obra/fornecedor/preço histórico); usar (atualiza estoque/custo/obra/serviço/financeiro).

## 17. Permissões e visões
Direção: tudo. Coordenação: operação/compras/equipe/cronograma/documentos/relatórios. Arquitetura: projetos/revisões/compatibilização/solicitações técnicas. Engenharia: obra/campo/compras/documentos técnicos/medições/qualidade. Compras: solicitações/produtos/fornecedores/estoque/pedidos/entregas. Financeiro: pagamentos/recebimentos/notas/contratos/custos. Campo: tarefas/checklists/fotos/pendências. Prestador: só serviços atribuídos. Cliente: só visão aprovada.

## 18. O que cada tela deve ter
Toda tela: título claro; status; responsável; prazo; próximos passos; botão de ação principal; botão de IA; histórico; anexos; comentários; evidências; alertas. **Nenhuma tela deve ser só cadastro** — todo cadastro responde: para que serve; onde é usado; o que falta; próximo passo; qual risco. (Produto mostra onde foi comprado/usado, estoque, fornecedor, preço histórico, obras vinculadas, alerta de compra.)

## 19. Telas essenciais
Início · Hoje · Projetos · Obras · Serviços · Produtos · Compras · Estoque · Pessoas · Fornecedores · Financeiro · Documentos · Relatórios · IA (central conversacional).

## 20-23. Resumo
Plataforma de trabalho CONVERSACIONAL para arquitetura/engenharia/serviços/produtos. Não é só gestão de obra / CRM / compras / financeiro / projeto — é a conexão entre TUDO. Maior risco = sistema completo demais e difícil de usar → **complexidade escondida, ação simples, informação no momento certo, IA organiza, humano decide**. Cada usuário tem sua própria tela, sua própria IA, seus próprios botões e sua própria responsabilidade, mas tudo se conecta numa **base única, rastreável e inteligente** (= a fundação de rastreabilidade já no ar).
