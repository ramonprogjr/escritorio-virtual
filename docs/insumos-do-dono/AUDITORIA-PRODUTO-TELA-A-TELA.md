# 📋 LAUDO — Auditoria de Produto tela-a-tela (Obra10+) — RESUMO/P0 quick-reference

> ✅ **O DOCUMENTO COMPLETO (33 telas, 1503 linhas) está em [`LAUDO-DETALHADO-POR-TELA.md`](LAUDO-DETALHADO-POR-TELA.md)** (o dono colou o .md). Este arquivo é só o **resumo + tabela + lista de P0** para consulta rápida.
> Salvo pelo protocolo anti-perda (01/jul noite).
> Método do laudo: navegação real tela-a-tela, todos os botões clicados, fluxos até o fim, inspeção de rede (HTTP), árvore de acessibilidade. Régua 0–10, **funcionalidade-primeiro** (IA só pontua se executar de verdade; submit que falha = funcionalidade inexistente).

## Veredito global
**Média do produto ≈ 4,8–5,0.** Puxam pra baixo: telas críticas quebradas + **IA desconectada** (Integrações mostra Anthropic/Mistral/Groq/WhatsApp = "Falta" → toda "IA" observada é heurística/mock de demo).

## Tabela-resumo (33 telas) — verbatim
| # | Tela | Funciona? | Média |
|---|---|---|---|
| 01 | Dashboard | Parcial | 5,7 |
| 02 | Leads | Parcial | 6,1 |
| 03 | Distribuição | Parcial | 6,2 |
| 04 | Negócios | **Não cria (500)** | 5,0 |
| 05 | Cadastros | Sim | 6,6 |
| 06 | Atendimento | Parcial | 6,8 |
| 07 | Canais | Sim (raso) | 5,3 |
| 08 | Tarefas | Sim (vazio) | 5,8 |
| 09 | Aprovações | **Quebrada** | 0,5 |
| 10 | Arquitetura | Parcial | 6,3 |
| 11 | Engenharia (Obras) | Parcial | 5,8 |
| 12 | Imóveis | **Não cria** | 3,9 |
| 13 | Pedidos | Sim (raso) | 5,4 |
| 14 | Parceiros | Sim | 5,8 |
| 15 | Fornecedores | Sim (duplicada) | 5,3 |
| 16 | Especialistas | Sim | 6,5 |
| 17 | Contas a receber | Sim | 5,9 |
| 18 | Contas a pagar | Parcial | 5,5 |
| 19 | Visão financeira | Sim | 6,6 |
| 20 | Campanhas | Vazia (sem integração) | 4,7 |
| 21 | Canais de entrada | Sim | 5,8 |
| 22 | Agentes IA | Telas sim; IA não | 5,5 |
| 23 | Automações | **0 ativos** | 4,6 |
| 24 | Ferramentas IA | Catálogo sim; execução não | 5,6 |
| 25 | Carteira de Tijolos | Sim (medição) | 5,5 |
| 26 | Precificação & IA | Funciona p/ quem NÃO devia (RBAC) | 4,0 |
| 27 | Integrações | Sim (é o raio-X) | 7,6 |
| 28 | Copiloto (página) | Doc sim; voz não comprovada | 5,0 |
| 29 | Config. Geral | Sim | 6,0 |
| 30 | Contatos de notificação | **Quebrada** | 0,5 |
| 31 | Usuários & Permissões | Sim | 6,0 |
| 32 | Escritórios | Sim (perigosa — RBAC) | 4,5 |
| 33 | Analytics/Relatórios | Parcial | 5,0 |

## Achados CRÍTICOS / P0 (das partes recebidas)
- **L3 (causa-raiz sistêmica):** DUAS máquinas de estado concorrentes — funil comercial (Novos→Fechamento) × ciclo de vida da ficha (aguardando_resposta, encaminhado, convertido…) **sem mapeamento**. Estados do ciclo somem do Kanban e **zeram o funil do Dashboard**. Origem de D1, L2 e do board vazio da tela 10.
- **N1:** `POST /api/crm/negocios → 500` (reproduzido 2×), UI silencia → **impossível criar negócio pela tela**.
- **L1:** criar lead duplicado → `POST /api/crm/leads → 409` **sem feedback** (drawer aberto, nenhum toast) — usuário não sabe o que houve.
- **L2:** Kanban de Leads não renderiza cards existentes (coluna "Novos" badge 2, corpo vazio).
- **D1:** Dashboard incoerente — funil tudo 0 / "Receita R$0" convivendo com "Negócios abertos 5" / "Qualificação 100%".
- **D2 (honestidade):** "Modelos IA ativos: 2" com as chaves de IA ausentes → rótulo enganoso.
- **09 Aprovações** e **30 Contatos de notificação**: telas **quebradas** (nota 0,5).
- **12 Imóveis / 04 Negócios:** não criam.

## Padrões globais (G0)
- Tooltip fixo do copiloto sobrepõe conteúdo (P1); FAB "+" cobre o "Enviar" do chat (P1); contador de sino "9+" vs aria "15" (P2); **rótulo ≠ rota** em 4 itens de menu (Engenharia→/obras, Tijolos→/creditos, Campanhas→/trafego, Copiloto→/agentes-reais) (P2).

## Pontos que o laudo ELOGIA (manter — referência)
- Modo **Caixa** dos Leads (farol por urgência + microcopy humana); **Responder** = 1 clique → WhatsApp; **wizard de Negócio** (busca unificada de participantes + leitura em linguagem natural + IA opcional) — o melhor fluxo desenhado, **mas hoje o salvar falha (N1)**; **+Convidar** (link permanente da rede); **Direcionar → "Qualificar e direcionar"** em 1 passo; **aderência como moeda** (Distribuição).

## Próximo (processo)
1. Dono **reenvia o arquivo completo** (telas 06–33 detalhadas) → substituo este capture pelo inteiro.
2. Mesa-redonda de especialistas **verifica** os P0 contra o código/DB real (adversarial — ainda é verdade?) + decide **incorporar / cortar / depende-do-dono**.
3. Síntese de CEO → integra no cronograma + pendências (`00-LEIA-PRIMEIRO-ESTADO`).
