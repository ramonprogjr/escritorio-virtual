# Análise da planilha REAL de gestão de obra do dono (Consulado Geral da Itália)

> Minha leitura completa da planilha `planilha-gestao-obra-2906.xlsx` (Google Sheets, 20 abas, formula-driven). Dump em `planilha-DUMP.md`. É o **insumo mais valioso**: mostra como o dono gerencia DE VERDADE. Base para o design do módulo Engenharia (gestão de obras).

## O que é
Sistema real (planilha Google) para gerir UMA obra (reforma do Consulado Itália): **164 itens de contrato + aditivos**, subitens por disciplina e andar, status, bloqueios, compras→estoque→orçamento→pagamento, compatibilização orçamentária, e painéis automáticos. Tudo amarrado por fórmulas + QUERY.

## A LÓGICA (o modelo de dados real do dono) — por aba
- **📚 Catalogo** — lista MESTRA; base de TODOS os dropdowns (não edita). → é o **catálogo global** (itens, materiais, categorias). Click-and-Go: escolher, não digitar.
- **📋 Gestao** — os **164 itens de contrato + aditivos**, por **Andar/Área** (Andar 8, 9, Roof Top, Elevadores, Halls…). Dois status: **"Situação" = AUTOMÁTICA (pelo prazo)** vs **"Andamento" = MANUAL** (Não iniciado/Iniciado/Paralisado/Finalizado/Cancelado, com cores). KPI "Finalizados" conta o Andamento. → **separação genial: o que a máquina calcula × o que o humano declara.**
- **🔧 Detalhamento** — os **SUBITENS (a EAP de verdade)**, por **disciplina** (Civil, Demolições, Revestimento, Pintura, Elétrica, Hidráulica, Instalações, Esquadrias, Serralheria, Forro, Climatização, Impermeabilização, Elevadores, Limpeza, Preliminares…) × andar. Tem **Início/Término** (a FONTE das datas — o painel Hoje puxa daqui), **% avanço** (col O), status (col H), e os **BLOQUEIOS**: falta **pessoa/documento/material/ferramenta/equipamento** (cols J–N = "Não"). Linha laranja = item principal; agrupamento +/- automático.
- **🏠 Hoje** — **cockpit diário 100% automático** ("não digite nele"): nº de Atrasados/Em andamento/A iniciar/Concluídos, **subitens atrasados** (QUERY ordenado por término), **próximos 15 dias**, pagamentos a vencer. → **é a FILA DE DECISÕES do dia (o JOB do gestor).**
- **📊 Dashboard / Executiva** — avanço **por disciplina** (COUNTIF/AVERAGEIF em Detalhamento) + barras, **próximos vencimentos**, **estoque atual**, **bloqueios** (falta pessoa/doc/material…), **material/compras** (SUMPRODUCT SC qtd×valor), **compatibilização** (% cobertura), **financeiro consolidado** (Previsto/Real/Pago/Saldo/A pagar/Vencendo/Atrasado). Por **andar/área** também.
- **👥 Pessoas** — cadastro de todos (visitantes, profissionais, fornecedor PJ).
- **🏢 Fornecedores** — empresas (cadastro rápido, sem valores).
- **🛒 SC (Solicitação de Compra)** — pedidos; **Tipo → Descrição filtra por categoria**; KPIs no topo; **Status "Entregue" alimenta o Inventário SOZINHO** (cascata).
- **📦 Movimentacao** — Saída/Devolução de estoque (Descrição do Catálogo → Categoria automática).
- **📊 Inventario** — **automático: Entregue (SC) − Saídas + Devoluções = Em Estoque.**
- **💰 Orcamentos** — valores por item; coluna **"Aprovado" libera para Pagamentos** (cascata/gate).
- **💳 Pagamentos** — histórico financeiro (medições + lançamentos manuais); a pagar/vencendo 7d/atrasado.
- **🔗 Compatibilizacao** — itens de contrato × **cobertura de orçamento (🟢 com / 🔴 sem)** + % cobertura. → mostra o gap de planejamento financeiro.
- AUX_*/OLD/BACKUP — listas auxiliares, versões antigas, backup manual no Drive.

## Os PADRÕES de ouro (a lógica real, que VAMOS replicar)
1. **EAP = item × subitem, por DISCIPLINA × ANDAR/ÁREA** (a árvore real que amarra tudo) — confirma o "EAP=espinha" da spec.
2. **Situação automática (pelo prazo) × Andamento manual** — IA calcula o status de prazo; humano declara o avanço real.
3. **Bloqueios explícitos** (falta pessoa/documento/material/ferramenta/equipamento) = as **restrições** da spec, tornadas visíveis e contáveis.
4. **Cascatas automáticas**: SC "Entregue" → Inventário; Orçamento "Aprovado" → Pagamentos; Inventário = Entregue−Saídas+Devoluções.
5. **Catalogo como master de dropdowns** = Click-and-Go puro (escolher da lista, não digitar livre).
6. **Painel "Hoje"** = a fila de decisões do dia (atrasados, 15 dias, pagamentos) — o cockpit.
7. **Compatibilização** = cobertura orçamentária (o que tem item mas não tem orçamento ainda).

## Mapa: planilha → spec → nosso sistema
| Planilha | Spec (gestão de obras) | Nosso sistema (hoje/alvo) |
|---|---|---|
| Gestao + Detalhamento | Obra + Frente/EAP + Tarefa/Subitem | hub_obras + (FALTA `fronts_eap` real) |
| Disciplina × Andar | EAP/frentes | adicionar árvore EAP |
| Início/Término, % avanço | Cronograma/Curva S | hub_obras_cronograma (parcial) |
| Bloqueios (falta X) | Restrições | adicionar restrições + alertas |
| SC → Inventario | Compras → Estoque | hub_pedidos_material (parcial) + cascata |
| Orcamentos → Pagamentos | Medição/Financeiro + gate "Aprovado" | hub_aprovacoes + financeiro (parcial) |
| Compatibilizacao | cobertura orçamentária | view nova |
| Catalogo | catálogo global de frentes/materiais | seed + tabela |
| Hoje/Dashboard/Executiva | Dashboard da obra / fila de decisões | cockpit (a construir) |

## As FALHAS do modelo (que o dono pediu p/ eu corrigir) — e como nosso sistema resolve
- **É planilha:** frágil ("não digite no Hoje"), fórmulas quebram, single-obra, multiusuário ruim, sem permissão real, backup manual no Drive, QUERY do Google com limites. → **nosso: banco robusto multi-tenant, RBAC+ABAC, audit, multi-obra.**
- **Sem IA / sem campo:** dados entram digitando; nada de voz/foto/RDO/OCR; sem alertas inteligentes. → **nosso: IA-first (voz/foto→estrutura), copiloto, RDO áudio/foto, alertas.**
- **Cascatas por fórmula** (frágeis) → **nosso: eventos/triggers no banco (robustos, auditados).**
- **Sem medição/Curva S com baseline** (tem % avanço solto) → **nosso: medição com gate (medido≤contratado) + Curva S com baseline+pesos.**
- **Compatibilização manual** → **nosso: cobertura orçamentária automática + alerta.**

## Melhorias que VOU implementar (com meu conhecimento + boas práticas AEC)
Manter o GENIAL (Situação×Andamento, bloqueios explícitos, cascatas SC→Inventário/Orçamento→Pagamento, Catalogo-dropdown, cockpit "Hoje", EAP disciplina×andar) — e ELEVAR: EAP como árvore real (peso físico+financeiro), restrições de 1ª classe com alerta+impacto no cronograma, medição com gate + Curva S baseline, RDO voz/foto, fornecedor com score, financeiro por frente (margem prevista×real), tudo IA-first, multi-tenant, auditado, mobile/Click-and-Go. **A "fila de decisões" do Hoje vira o copiloto: a IA traz o que decidir + recomenda.**
