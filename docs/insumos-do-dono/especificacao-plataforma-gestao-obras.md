# Especificação Única do Sistema — Plataforma IA-first multi-tenant para gestão de obras

> **INSUMO DO DONO** (documento enviado por ele, 24/06/2026). Persistido aqui pela diretriz "não perder dados". É a espec canônica da **gestão de obras (Engenharia)**. A "startup proprietária sem nome" = o nosso **Hub** (Obra10+); as "empresas clientes" = os **fornecedores/escritórios** (tenants). Parte 1 de N (dono vai enviar mais).

## 1. Premissas centrais
Plataforma IA-first, multi-tenant, para gestão técnica/operacional/financeira/documental de obras, reformas, serviços de engenharia. **A startup é a dona do produto** (infra, planos SaaS, templates globais); **empresas usuárias são tenants isolados** — nenhuma empresa usuária aparece como dona. Nasce com mentalidade de plataforma: isolamento por empresa, plano, permissões por papel, auditoria, config por tenant, templates globais adaptáveis, agentes IA com memória separada.
- **NÃO é clone de Asana/Trello/Notion/planilha.** É um **sistema operacional de obra com IA embutida no fluxo**.
- **A IA entra ANTES da tela:** usuário fala/fotografa/envia áudio/PDF/NF/orçamento/print → o sistema estrutura.
- **Tarefa é só UMA entidade.** Também: contrato, escopo, RDO, compra, cotação, medição, estoque, fornecedor, documento, evidência, RNC, SST, aditivo, financeiro.
- IA propõe/organiza/rascunha/alerta — mas **dinheiro, cliente, prazo, medição, liberação técnica e pagamento dependem de aprovação humana.**
- Campo simples: **voz-primeiro, foto em poucos toques, mobile, offline simples.** Gestão forte: Curva S, cronograma físico-financeiro, custo por frente, margem prevista×real, aprovações, auditoria.

## 2. Visão executiva
Problema: a informação nasce dispersa (WhatsApp, áudio, foto, papel, planilha, Asana, e-mail). Objetivo: transformar entradas soltas em controle técnico/financeiro/operacional, com rastreabilidade + inteligência.
**Frase guia:** *"Nenhuma informação relevante da obra deve morrer em conversa, foto, áudio, planilha ou memória. Tudo deve virar registro, decisão, evidência, pendência, medição, compra, relatório ou histórico."*
Dores a atacar: pedido por WhatsApp perdido; compra sem cotação/histórico; serviço concluído sem evidência; RDO inconsistente; medição "no sentimento" sem EAP; SST vencido com equipe entrando; cliente com relatório incompleto/indevido; fornecedor atrasando sem impacto visível; financeiro pagando sem conferência; dono sem visão de margem/estouro/risco.

## 3. Modelo multi-tenant (8 níveis)
`Startup proprietária → Tenants/empresas clientes → Filiais opcionais → Departamentos → Usuários → Obras → Frentes/EAP → Registros operacionais`
| Nível | Nome | Função |
|---|---|---|
| 1 | Startup proprietária | Produto, planos, tenants, módulos, templates globais, billing, segurança |
| 2 | Tenant/Empresa cliente | Dados isolados, usuários, obras, regras, templates, IA própria |
| 3 | Filial/unidade (opcional) | Unidade regional |
| 4 | Departamento/área | Engenharia, compras, financeiro, jurídico, arquitetura, SST, admin, campo, diretoria |
| 5 | Usuário | Pessoa com papel/permissões/acesso por obra |
| 6 | Obra | **Objeto central** — contrato, escopo, cronograma, RDO, compras, financeiro, docs, evidências |
| 7 | Frente/EAP | Árvore técnica que amarra orçamento, cronograma, compras, medição, qualidade, RDO, financeiro |
| 8 | Registro operacional | Tarefa, compra, cotação, RDO, medição, documento, RNC, checklist, ocorrência, evidência, pagamento |
**Regra de isolamento:** todo dado operacional tem `tenant_id`; nenhuma consulta/automação/IA cruza tenants sem regra explícita + autorização + anonimização. Contexto da IA limitado a tenant/usuário/papel/obra/módulo/permissões. Fornecedor pode existir em vários tenants, mas histórico/avaliação separados. Usuário pode participar de várias empresas com papéis independentes.

## 4. Governança
**Startup (Hub):** cria/suspende tenants; define planos/limites/módulos; templates globais (frentes/RDO/SST/qualidade/medição/relatório); agentes IA globais; suporte auditado; dados agregados/anonimizados. **NUNCA assume decisão operacional do cliente** (não aprova pagamento/medição/compra/liberação).
**Empresa cliente:** configura usuários/departamentos/papéis; cria obras/clientes/fornecedores/equipes; define fluxos de aprovação por módulo e por valor; visibilidade; limites financeiros por papel; modelos próprios.

## 5. Papéis/usuários/departamentos
Diretoria/Donos · Engenharia · Arquitetura/Projetos · Compras/Suprimentos · Financeiro · Jurídico/Contratos · SST · Campo · Administrativo · Cliente externo · Fornecedor externo.
**Identidade GLOBAL + vínculo por tenant** (`memberships`: [{tenant_id, role, department}]). Mesma pessoa em empresas diferentes com papéis distintos.

## 6. Permissões RBAC + ABAC
RBAC (por papel) + ABAC (por contexto: obra/valor/status/documento/responsável/frente/interno-cliente). **Validadas no BACKEND**, não só escondidas na UI. A IA respeita permissões (não sugere como ação o que o usuário não pode fazer).
**Regra de ouro:** tudo que envolve **dinheiro, prazo, cliente, contrato, medição, pagamento, liberação técnica ou liberação de terceiro exige aprovação humana de papel autorizado.** A IA prepara/sugere/classifica, não aprova sozinha.
Ações-chave e quem pode: Criar obra (admin/gestor) · Criar RDO (campo/eng, só obra vinculada) · Aprovar RDO (eng) · Solicitar compra (campo/eng/admin) · Aprovar compra técnica (eng) / financeira (financeiro/diretoria, por valor) · Liberar pagamento (financeiro, com NF+conferência) · Enviar relatório ao cliente (gestor/diretor, aprovado+sem conteúdo restrito) · Aprovar medição (eng interno → cliente no portal) · Liberar terceiro (SST/admin, checklist 100%) · Ver margem (diretoria/financeiro, nunca campo/cliente/fornecedor).

## 7. IA-first: arquitetura funcional
`Entrada bruta (texto/áudio/foto/vídeo/PDF/NF/orçamento/print/WhatsApp) → IA interpreta (classifica tipo/obra/frente/responsável/data/criticidade/próxima ação) → Sistema estrutura (rascunho/registro: RDO/tarefa/compra/pendência/evidência/documento/relatório) → Humano aprova (dinheiro/cliente/prazo/medição/pagamento/responsabilidade técnica)`. **Card "A IA entendeu assim"** (confirmar/corrigir/rejeitar).
Saídas IA: criar RDO rascunho/validado, tarefa/pendência, solicitação de compra/cotação, extrair itens/valores de orçamento/NF, alertas (atraso/risco/falta de material/doc vencido), relatórios em rascunho, sugerir reprogramação de cronograma, classificar fotos, comparar cotações, sugerir pleito de prazo.

## 8. Núcleos de dados (não tudo é tarefa)
Entidades próprias com vínculos: **Obra, Contrato, Frente/EAP, RDO, Tarefa, Pendência, Compra, Cotação, Estoque, Medição, Documento, Evidência, Fornecedor, RNC, Pagamento.**

## 9. Módulo Obras (centro)
Obra = container. Cadastro: nome, **código legível** (CON.2026.0001 / REF.2026.0004), tipo (construção/reforma/engenharia/manutenção/serviço/consultoria/projeto/assistência), cliente, endereço, tenant/filial, responsáveis (comercial/técnico/gerente), **status macro por COR** (Planejamento=cinza/azul · Ativa=verde · Atenção=amarelo · Crítica=vermelho · Pausada=roxo · Encerrada=cinza escuro), substatus, datas (contratual/mobilização/término/prazo), contrato/orçamento/EAP/cronograma/centro de custo, visibilidade cliente/fornecedor.
**Dashboard da obra (cockpit):** status, avanço físico+financeiro, Curva S simplificada, próximas atividades, pendências críticas, compras aguardando, documentos vencendo, RDOs pendentes, medições por status, ocorrências/horas paradas, fotos recentes, **fila de decisões pendentes do usuário**, recomendações da IA para hoje.

## 10. Contrato, Escopo, EAP, Aditivos
Contrato: valor, forma de medição (mensal/etapa/item/percentual/evento/entrega/demanda), BDI, retenção/caução/garantia, prazo contratual×execução, datas, reajuste, escopo/exclusões/premissas, multas/seguros, anexos.
**EAP (Estrutura Analítica) = a ESPINHA:** a mesma árvore de frentes organiza orçamento/cronograma/compras/RDO/medição/qualidade/financeiro. Catálogo global de frentes + adaptável por tenant + **presets por tipo de obra**. Frente tem peso físico e financeiro, itens de orçamento/compras/tarefas/evidências/qualidade/medição.
Aditivos: rastreáveis (motivo/solicitante/impacto valor+prazo/anexos); IA sugere mas não aprova; aprovado recalcula saldo/cronograma/Curva S/faturamento. Status: Identificado→Análise técnica→Análise financeira→Rascunho cliente→Enviado→Aprovado/Rejeitado→Executado.

## 11. Cronograma, Curva S, caminho crítico
Cronograma físico-financeiro: cada frente/EAP com data planejada + peso físico/financeiro; **baseline original + reprogramações com motivo**; dependências entre frentes/tarefas/compras; IA sugere reprogramação. Curva S: prevista/realizada física + financeira, desvio acumulado/por frente, tendência, impacto no prazo do cliente. **Cuidado: Curva S precisa de baseline + pesos + critérios de medição (senão vira gráfico subjetivo).**

## 12. RDO (Relatório Diário de Obra)
Documento técnico, preenchível por áudio/foto/texto, salvo estruturado. Campos: obra/data/responsável/clima/efetivo por função/fornecedores/equipamentos/atividades planejadas×executadas/não-executadas+motivo/materiais recebidos+faltantes/ocorrências/paralisações+horas+causa/visitas/fotos/pendências/**resumo IA**/status (rascunho/enviado/validado/revisado/bloqueado). RDO por áudio/foto: IA transcreve+identifica, cruza com planejamento, sugere compra/pendência se "falta material", registra horas paradas/pleito se "chuva/paralisação". Engenharia valida antes do cliente.

## 13. Tarefas/Pendências/Restrições
Diferenciar: **Tarefa** (executável: responsável/prazo/status/evidência/frente) · **Pendência** (decisão em aberto, responsável externo, impacto) · **Restrição** (impedimento: material não entregue → bloqueia + alerta) · **Ocorrência** (fato: chuva → horas paradas/pleito) · **Risco** (doc vence em 5d → alerta/bloqueio). Status de tarefa: A fazer/Planejada/Em execução/Aguardando material/fornecedor/cliente/projeto/Bloqueada/Executada-aguardando evidência/Em revisão técnica/Concluída/Cancelada/N.A.

## 14. Compras, Cotações, Estoque (módulo forte do MVP)
Fluxo: Solicitação→Triagem IA→Cotação→Cotações recebidas→Comparativo→Aprovação técnica→Aprovação financeira→Pedido emitido→Aguardando entrega→Entregue→Conferência→Estoque/uso→Nota→Pago→Arquivado. Código: CO.CON.2026.0001. Campos: obra/frente/centro de custo, solicitante/origem, tipo, descrição/qtd/especificação/urgência, data necessária, **impacto se atrasar** (bloqueia frente/cronograma), fornecedores, cotações, orçamento×aprovado, aprovação técnica+financeira+alçada, entrega/conferência/nota/pagamento.
**Tabela comparativa de cotações:** fornecedor(score), valor total comparável, prazo, condição, validade, itens divergentes (IA), **melhor preço** + **melhor custo-benefício** (IA: preço+prazo+score+histórico+impacto), risco. Estoque/almoxarifado: entrada na entrega, baixa por frente/tarefa/RDO, evita recompra, histórico de preço alimenta IA.

## 15. Fornecedores e terceiros
Cadastro VIVO (não texto na compra). Por tenant no MVP (futuro: marketplace global homologado por empresa). Docs (CNPJ/CND/CREA-CAU/seguros/bancários). **Score**: prazo, qualidade, preço, resposta, documentação, financeiro, retrabalho. Histórico de cotações/entregas/ocorrências. Usuário fornecedor externo com acesso limitado.

## 16. Medição e faturamento
Boletim por período, vinculado a contrato/EAP/evidências/retenção/aprovações. Fluxo: Execução→Evidências→Avanço por item/EAP→Boletim rascunho→Validação técnica interna→Aprovação gerencial→Envio cliente→Aprovação cliente→Faturamento→Recebimento→**Atualização Curva S+saldo contratual**. Percentual por item/frente; **cada item medido exige evidência**; retenção/caução/garantia automáticas; saldo recalculado a cada medição; **medido nunca passa do contratado sem aditivo aprovado**; cliente aprova no portal; rejeitada volta com motivo.

## 17. Financeiro por frente / centro de custo
Não é só contas a pagar: custo previsto×realizado por frente, margem prevista×real por obra, fluxo de caixa, caixinha com prestação de contas, **pagamento exige compra aprovada+recebimento conferido+NF**, **alerta de estouro por frente antes de comprometer a margem**. Indicadores: custo previsto/contratado/realizado, saldo da frente, margem prevista/real, a receber, a pagar.

## 18. Qualidade — FVS, FVM, RNC, retrabalho
Conclusão de serviço depende de **critérios de aceite + evidência + checklist + validação técnica**, não só marcar tarefa. **FVS** (ficha verificação serviço), **FVM** (material), **RNC** (não conformidade), **Retrabalho** (custo/causa/responsável). Critérios da biblioteca técnica do tenant/plataforma; IA sugere checklist, validação final humana.

## 19. SST — Segurança do trabalho (entidade com poder de BLOQUEIO)
ASO/PCMSO/PGR/APR/NR-18/NR-35; DDS; ficha de EPI; **liberação de terceiro condicionada a checklist 100%**; alertas 30/15/5 dias; mapa de risco; incidentes. **Bloqueio real de acesso/execução** se documento obrigatório vencido/ausente (até regularização ou exceção formal aprovada+auditada).

## 20. Documentos, projetos, evidências
Cofre documental por obra. **Visibilidade**: Interno · Cliente · Fornecedor · Restrito · Confidencial. Controle de versão de projeto (revisão atual + arquivadas + as-built). Foto/vídeo com data/usuário/obra/frente/antes-depois/vínculo. OCR + classificação IA. Validade → alerta+bloqueio. Exclusão sensível exige permissão+auditoria.

## 21. Cliente, portal e comunicação
Portal controlado: avanço, fotos aprovadas, relatórios, medição para aprovação, Curva S simplificada **sem margem/custo**. Aditivos para aprovação formal. Comunicados gerados por IA mas enviados só após aprovação interna. Histórico de aprovações. **Separação clara relatório interno × cliente.**

## 22. Campo, mobile, offline, WhatsApp
Voz-primeiro, foto-primeiro, contexto-primeiro. Botão grande grava RDO por áudio; foto em 2 toques; offline simples (captura local + pendência de sync); WhatsApp recebe entradas/envia alertas mas dado estruturado fica no sistema; IA transforma áudio/mensagem em registro (não só armazena).

## 23. Agentes de IA
Gestor de Obra · Engenheiro Assistente · Comprador Inteligente · Financeiro de Obra · SST · Relatórios/Cliente · Fiscal de Evidências · Jurídico/Contratos. Compartilham permissões; operam no tenant.
**Autonomia da IA por nível:** 1 sugere/explica · 2 cria rascunho · 3 executa ação interna baixo risco (classificar foto/criar pendência) · 4 pede aprovação para ação crítica · 5 automatiza rotina segura (lembrete/alerta/organização) sempre auditando.

## 24. Auditoria, logs, compliance
Registrar quem/tenant/obra/módulo/registro/data/IP/before/after, se humano-IA-automação-integração, prompt+interpretação da IA em eventos críticos, todas as aprovações. Relatório de auditoria. Acesso de suporte temporário/autorizado/auditado.

## 25. Planos SaaS, limites, billing
Essencial (pequenas equipes) · Profissional (reforma/engenharia: Central IA, compras com cotação, medição, financeiro por frente, Curva S) · Enterprise (multi-filial, SST avançado, portal cliente, APIs, banco isolado, white-label). Limites: usuários/obras/storage/créditos IA/módulos.

## 26. Modelo de dados sugerido (todas com tenant_id + obra_id quando aplicável)
tenants · users · tenant_memberships · roles · permissions · branches · departments · clients · obras · obra_members · contracts · additives · **fronts_eap** (obra_id, parent_id, nome, peso_fisico, peso_financeiro) · tasks · constraints · rdo · purchases · purchase_items · purchase_quotes · suppliers · inventory_items · stock_movements · measurements · measurement_items · payments · documents · evidences · quality_checks · rnc · sst_records · **ai_events** · **audit_logs**.

## 27. APIs, eventos, automações (event-driven)
Eventos: obra criada · negócio ganho gerou obra · RDO criado/validado/atrasado · compra (solicitada/cotada/aprovada/atraso/pago) · documento vence 30/15/5 · terceiro bloqueado/liberado · medição enviada/aprovada/rejeitada · aditivo · tarefa bloqueada · custo estourou · IA gerou rascunho. **Automação segura:** cria rascunho/alerta/tarefa, NÃO aprova dinheiro/contrato/prazo/medição/pagamento/liberação sem humano.

## 28. Roadmap priorizado
- **Fase 0 — Fundação:** multi-tenant + objeto Obra (tenant, usuários, papéis, permissões, obra, cliente, equipe, frentes/EAP, contrato básico, status macro, templates, auditoria).
- **Fase 1 — MVP operacional IA-first** ("fazer equipe largar Asana/WhatsApp"): Central IA, RDO áudio/foto, tarefas/pendências, compras com cotação comparável, aprovações, documentos com validade, relatórios IA.
- **Fase 2 — Engenharia e dinheiro** (diferenciar de kanban+IA): Medição, Curva S, cronograma físico-financeiro, financeiro por frente, estoque, OCR de NF, fornecedores com score, qualidade, SST avançado.
- **Fase 3 — Plataforma inteligente:** portal cliente, cotação automática, preditivo de atraso, análise de foto, **importador Asana**, marketplace, API, multi-filial.
**Sequência:** Fundação multi-tenant → Central de Comando IA ("A IA entendeu assim") → RDO áudio/foto → Compras com cotação → Central de Aprovações por papel → Documentos → Medição+Curva S.

## 29. Backlog inicial (P0/P1/P2)
P0: Tenant, Usuários, Permissões, Obra, EAP, Central IA, RDO, Compras, Cotações, Aprovações. P1: Documentos, Financeiro, Medição, Curva S, SST. P2: Cliente (portal), IA preditiva.

## 30. Critérios de aceite ("pronto")
tenant_id + isolamento; obra_id quando aplicável; **permissão validada no backend**; IA respeita papel/tenant/obra/módulo; ações críticas exigem aprovação humana; toda ação crítica gera audit_log; visibilidade definida; campo registra RDO/fotos com poucos toques; compra não vai a pagamento sem regra de aprovação+conferência; relatório ao cliente sem info interna; sistema mostra o que aguarda o usuário; automação tem fallback manual + histórico.

## 31. Instrução final
"Construa uma plataforma SaaS IA-first e multi-tenant para gestão de obras/reformas/engenharia/serviços. A proprietária é uma startup sem nome (= o Hub). Empresas serão tenants. Hierarquia obrigatória: Startup → Tenant → Filial → Departamento → Usuário → Obra → Frente/EAP → Registros. Todo dado operacional tem tenant_id (+obra_id). RBAC+ABAC. IA-first com card 'A IA entendeu assim'. Ações de baixo risco automatizáveis; ações críticas exigem aprovação humana. Objeto central = Obra. A mesma EAP/frentes amarra orçamento/cronograma/RDO/compras/medição/financeiro/qualidade. **Simples no campo, forte na gestão, seguro na arquitetura.**"
