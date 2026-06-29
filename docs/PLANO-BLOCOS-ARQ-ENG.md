# Plano por BLOCOS — Arquitetura & Engenharia (nível do usuário/tenant)

> Roadmap detalhado para construir o produto que prende o usuário. Base: spec do dono (`docs/insumos-do-dono/especificacao-plataforma-gestao-obras.md`) + planilha real (`ANALISE-planilha-gestao-obra.md`). Régua inegociável: **Click-and-Go · IA-first/conversacional · Fácil · UI/UX utilidade · não-engessado · mobile · marca verde+dourado dark**. Ordem por DEPENDÊNCIA (espinha primeiro). Execução **bloco a bloco**, cada um: mesa redonda → implementar → verificar (tsc+vitest+build) → deploy → checkpoint com o dono.

## Princípios de tela (lei de toda UI daqui pra frente)
- **Tela = JOB, não tabela.** Tabela densa só em `/crm/relatorios`. Operação = cockpit + ficha-de-trabalho + fila de decisões.
- **Click-and-Go:** preencher é ESCOLHER (chips, dropdowns do Catálogo) + CONFIRMAR. Nada de digitação livre solta. (Padrão real da planilha: "Tipo→Descrição filtra a lista".)
- **IA-first / conversacional:** o copiloto (voz+texto) é o controle remoto de tudo — "como está a obra X", "o que está atrasado", "pediu cimento", "aprovar medição 3" → card dourado → Confirmar. O painel "Hoje" da planilha VIRA o copiloto: a IA traz o que decidir + recomenda.
- **Humano aprova o crítico** (dinheiro/prazo/medição/pagamento/liberação): a IA prepara, nunca aprova sozinha (gate dourado já existe).
- **Manter o GENIAL da planilha:** EAP disciplina×andar; Situação automática (prazo) × Andamento manual; bloqueios explícitos; cascatas (SC→Inventário, Orçamento Aprovado→Pagamento); Catálogo-dropdown; cockpit "Hoje".

## A COLUNA reusável (~90% já existe — NÃO reconstruir)
Funil editável por mercado (`hub_pipelines`/`hub_pipeline_estagios` + `PipelineConfigSideover`) · Kanban JOB (`app/crm/negocios`) · Copiloto voz+texto (`CopilotoVoz` + `/api/copiloto`, HMAC/gate) · Engine IA + ferramentas (`lib/ia/engine`, `executar-ferramenta-ia` + registry) · RBAC (`crm-permissoes`) · Multi-tenant real (`current_user_tenant_id()`) · `hub_obras` + sub-tabelas (cronograma/diario/operarios_checkin/fotos/ocorrencias/pedidos_material) · `hub_projetos`+`_fases` · `hub_aprovacoes` · agregação por tenant.

---

# ENGENHARIA › Construção / Reforma / Serviços
> Serviços = base executiva que as construções/reformas reusam.

## BLOCO E0 — Espinha: Obra + EAP (frentes disciplina×andar) + Catálogo
**Objetivo:** a árvore que amarra TUDO (a "EAP=espinha"). Sem ela, cada módulo vira ilha.
**Dados (aditivo):** `fronts_eap` (obra_id, parent_id, codigo, nome, disciplina, area_andar, peso_fisico, peso_financeiro, status); `hub_catalogo` (tenant_id, tipo, codigo, descricao, categoria, unidade) — alimenta dropdowns; estender `hub_pipelines.tipo` p/ `obra`; relaxar CHECK de status de `hub_obras` (migração aditiva, padrão de `hub_negocios`). Presets de EAP por tipo de obra (construção/reforma/serviço).
**Telas:** "Nova obra" Click-and-Go (cliente→tipo(chip Construção/Reforma/Serviço)→preset de frentes→pronto, ≤3 toques, código auto OBR/REF-AAAA-NNNN); editor da EAP (ativar/ocultar/renomear/peso) reusando o sideover de funil.
**IA/conversa:** "cria obra de reforma do Andar 8, preset padrão" → monta EAP → Confirmar.
**Pronto:** obra criada com EAP a partir de preset, sem digitar UUID; Catálogo dirige os dropdowns.

## BLOCO E1 — Cockpit "Hoje" + Carteira de Obras (o JOB do gestor)
**Objetivo:** a FILA DE DECISÕES do dia (o coração da planilha) + a visão da carteira.
**Telas:** `/crm/obras` = carteira (cards por urgência: atrasadas/críticas no topo; barra de avanço; próximo marco; selo de saúde; chip tipo). `/crm/hoje` (ou aba) = cockpit: **atrasados · próximos 15 dias · bloqueios · pagamentos a vencer**, cada um acionável (1 toque).
**Dados:** reusa `dashboard-aggregate` (por tenant) + a EAP/cronograma do E0/E2.
**IA/conversa:** o "Hoje" é o copiloto — "o que preciso decidir hoje?" → a IA lista + recomenda ação.
**Pronto:** o gestor abre e enxerga, sem rolar, o que está travado e o que aprovar AGORA.

## BLOCO E2 — Item × Subitem (Gestao × Detalhamento) + avanço
**Objetivo:** o tracking real: itens de contrato + subitens (EAP), por disciplina×andar.
**Dados:** `hub_obra_itens` (obra_id, front_id, codigo, descricao, area_andar, situacao[AUTO por prazo], andamento[MANUAL: nao_iniciado/iniciado/paralisado/finalizado/cancelado], inicio, termino, pct_avanco). Situação calculada por evento; Andamento declarado pelo humano.
**Telas:** lista/kanban por disciplina ou andar (filtro chip); ficha do item (avanço por slider/voz, datas, evidência). **Situação automática (cor) × Andamento manual** visíveis e distintos.
**IA/conversa:** "marca 60% na alvenaria do Andar 8" → card → Confirmar.
**Pronto:** editar avanço/andamento Click-and-Go ou voz; Situação atualiza sozinha.

## BLOCO E3 — Restrições / Bloqueios (1ª classe)
**Objetivo:** falta **pessoa/documento/material/ferramenta/equipamento** como restrição visível, com alerta + impacto no cronograma (a planilha já conta isso).
**Dados:** `hub_obra_restricoes` (obra_id, item_id, tipo, descricao, impacto, responsavel, status). Evento ao bloquear.
**Telas:** chip de bloqueio no item/cockpit; "Bloqueios" no Hoje; resolver com 1 toque.
**IA/conversa:** "tá faltando cimento no Andar 9" → cria restrição + sugere SC. **Pronto:** bloquear/desbloquear + alerta no cockpit.

## BLOCO E4 — Cronograma + Curva S (com baseline)
**Objetivo:** previsibilidade real (a planilha tem % avanço solto; aqui ganha baseline+pesos).
**Dados:** `hub_obra_baseline` + reprogramações com motivo; pesos físico/financeiro na EAP (E0). Curva S prevista×realizada (física+financeira), desvio.
**Telas:** Curva S no cockpit da obra; cronograma por frente; reprogramar com motivo (chip).
**Pronto:** ver Curva S real (não gráfico subjetivo); reprogramação rastreada.

## BLOCO E5 — Compras → Estoque (SC → Inventário) + Movimentação
**Objetivo:** a cadeia de suprimentos (módulo forte), com as cascatas da planilha.
**Dados:** `hub_compras` (SC: obra_id, front_id, codigo CO-..., tipo, descricao[do Catálogo], qtd, status), `hub_compra_cotacoes` (fornecedor, valor, prazo), `hub_inventario` (auto: Entregue−Saídas+Devoluções), `hub_estoque_mov` (Saída/Devolução). Cascata SC "Entregue"→Inventário via evento.
**Telas:** pedir material Click-and-Go (Tipo→Descrição filtrada); comparativo de cotações (IA: melhor preço/custo-benefício/risco); estoque automático.
**IA/conversa:** "pede 50 sacos de cimento pro Andar 8" → SC rascunho → Confirmar. **Pronto:** SC→cotação→aprovação→entrega→estoque, sem planilha.

## BLOCO E6 — Orçamento → Pagamento + Compatibilização
**Objetivo:** o financeiro com gate humano + a cobertura orçamentária.
**Dados:** `hub_orcamentos` (item, valor, aprovado[gate]→libera pagamento), `hub_pagamentos` (a pagar/vencendo 7d/atrasado, medições+manuais), view de **Compatibilização** (item com/sem orçamento 🟢/🔴, % cobertura). Reusa `hub_aprovacoes`.
**Telas:** fila de aprovação (gate dourado); compatibilização no cockpit; pagamentos.
**Pronto:** "Aprovado" libera pagamento; cobertura visível; nada paga sem regra.

## BLOCO E7 — Medição + Financeiro por frente
**Objetivo:** medição estruturada (gate **medido≤contratado sem aditivo**) + margem por frente.
**Dados:** `hub_medicoes` + `hub_medicao_itens` (% por EAP, evidência obrigatória, retenção); custo previsto×realizado por frente; margem prevista×real.
**Telas:** boletim de medição (cockpit da obra); financeiro por frente. **Pronto:** boletim com evidência + aprovação; alerta de estouro por frente.

## BLOCO E8 — RDO voz/foto + Campo (mobile)
**Objetivo:** o campo simples (voz-primeiro, foto-2-toques) que alimenta tudo.
**Dados:** reusa `hub_obras_diario`/`fotos`/`operarios_checkin`; estrutura do RDO (clima/efetivo/atividades/ocorrências).
**Telas:** mobile: botão grande "gravar RDO por voz"; foto+contexto; checkin.
**IA/conversa:** áudio do campo → IA transcreve+estrutura RDO → engenharia valida. **Pronto:** RDO em poucos toques; IA cruza planejado×executado.

## BLOCO E9 — Fornecedores+score · Pessoas · Documentos/SST
**Objetivo:** cadastros vivos + SST com poder de bloqueio.
**Dados:** `hub_fornecedores` (score: prazo/qualidade/preço/resposta/doc/retrabalho), `hub_pessoas` (obra), documentos com validade+visibilidade, SST (ASO/PGR/EPI, libera terceiro só com checklist 100%, bloqueio real).
**Pronto:** fornecedor com histórico/score; SST bloqueia acesso vencido.

## BLOCO E10 — Copiloto executivo + Agentes de IA por nível
**Objetivo:** a IA como gestor-assistente (a estrela).
**Dados/cód:** estender `CopilotoVoz` p/ ler obra/projeto da rota; tools `obra_*` (ler carteira, status, gargalos, aprovar medição, registrar avanço/ocorrência). Agentes (Gestor de Obra, Comprador, Financeiro, SST…) com autonomia por nível (1 sugere → 5 rotina segura auditada). Acende com a chave Mistral.
**Pronto:** "como está a obra Vila Mariana / o que está atrasado / aprovar medição 3" funciona.

---

# ARQUITETURA › Projetos (em paralelo — irmão mais leve, alimenta a obra)

## BLOCO A0 — Funil de Projeto editável + Ficha
**Objetivo:** o CRM do arquiteto: funil do PROJETO (Briefing→Estudo→Anteprojeto→Executivo→Aprovação→Entrega, editável), reusando 100% a coluna.
**Dados:** `hub_pipelines.tipo='projeto'`; estagio/pipeline_id em `hub_projetos` (aditivo). `hub_projetos_fases` = programa de necessidades.
**Telas:** `/crm/arquitetura` kanban de projetos; ficha (abas Conversar/Programa/Funil/Entregáveis/Engenharia).
**IA/conversa:** "cria projeto residencial pro Carlos 200m²" → Briefing → Confirmar; "monta o programa: 3 quartos, suíte…". **Pronto:** projeto criado+movido por conversa.

## BLOCO A1 — Programa de necessidades + Aprovações do cliente
**Objetivo:** o JOB do arquiteto (aprovações = gargalo nº1).
**Telas:** programa em chips; gate de aprovação do cliente (enviar/aprovar). **Pronto:** programa estruturado pela IA; aprovação rastreada.

## BLOCO A2 — Elo Projeto → Obra ("Gerar Obra")
**Objetivo:** o projeto pronto vira base da obra (Engenharia herda título/tipologia/m²/programa→escopo).
**Dados:** `hub_projetos.obra_id` (FK), reusa derivação. **Pronto:** 1 toque/voz → obra nasce com contexto; engenheiro não redigita.

---

# Camada HUB (DEPOIS — consequência)
Gestão-da-gestão/auditoria: agrega os tenants (mesmo aggregate sem `.eq(tenant_id)` via hub-admin) → Saúde da Rede, % no prazo por escritório, Curva S consolidada, medições/aprovações pendentes, alimenta o motor de distribuição. **Não tem telas de captura — DERIVA.**

---

## Ordem de execução (dependência)
E0 (espinha) → E1 (cockpit/Hoje) → E2 (item×subitem) → E3 (restrições) → A0/A1/A2 (projetos, em paralelo, leves) → E5 (compras→estoque) → E6 (orçamento→pagamento) → E4 (Curva S) → E7 (medição) → E8 (RDO) → E9 (cadastros/SST) → E10 (copiloto exec) → HUB.
**Cada bloco:** mesa redonda (telas/UX/IA) → implementar aditivo → tsc+vitest+build → deploy → checkpoint. Travas (migração/Mistral/janela) ficam para o dono.

## Dependências externas (do dono)
Mistral (acende o conversacional pleno) · janela p/ aplicar migrações aditivas · finalizar GitHub próprio.
