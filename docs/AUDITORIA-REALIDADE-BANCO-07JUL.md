# 🔬 Auditoria de Realidade — Masterplan × Banco REAL (via MCP, 07/jul/2026)

> **Por que este doc existe.** O MASTERPLAN/CADERNO foi montado lendo os **arquivos de migração** — que **não reproduzem o banco de produção** (problema conhecido: schema não-reproduzível). Com acesso MCP direto de leitura ao Supabase (projeto `cdjlqsznerdhwqyunodl`), comparei o que o plano diz com o que **existe de verdade**. Resultado: o banco está **muito mais adiantado** que o plano. A maior parte do "backlog técnico" é **ligar tabela que já existe**, não construir do zero.

---

## 1. Já aplicado no banco (o plano dizia "não / represado / file-only")

| Item do plano | Plano dizia | Banco REAL (07/jul) |
|---|---|---|
| **RAS-01** linhagem | janela pendente | ✅ aplicado hoje — `0` negócios sem raiz, gatilho ativo |
| **RAS-02** código único | janela pendente | ✅ UNIQUE em `hub_negocios.codigo` **já existia** (0 dups) |
| **RAS-03** ator do evento | janela pendente | ✅ colunas `ator_id`/`ator_codigo` **já existiam** (falta só popular no app) |
| **OBR-01** camada AEC (E0–A1) | "file-only, dormente" | ✅ **14 tabelas AEC existem** (`hub_obra_frentes_eap`, `_itens`, `_medicoes`, `_orcamentos`, `_taxonomia`, `_curva_*`, `hub_eap_presets`…). **5 obras, 1 item.** |
| **Escrow** (FIN-02 schema) | "file-only" | ✅ `hub_obra_escrow_contas` + `_movimentos` existem |
| **FIN-01** motor comissões | "construído, represado" | ✅ 3 tabelas + 3 RPCs (`rpc_apurar_comissoes`, `rpc_registrar_recebimento_negocio`, `rpc_liberar_pagamento_comissao`) — **0 linhas (represado CONFIRMADO)** |
| **SEC-7** auditoria IA (órfã #1) | "não construído" | ✅ `hub_acoes_ia` existe — **4 linhas (a IA já está logando!)** |
| **Observabilidade** (órfã #2) | "não construído" | ✅ `hub_error_logs` existe |
| **Próxima-ação** (órfã #13) | "não construído" | ✅ `hub_proximas_acoes` existe (0 linhas — não-cabeada) |
| **Financeiro operacional** (órfã #14) | "não construído" | ✅ `hub_contas_pagar` (1) / `hub_contas_receber` (0) existem |
| **Catálogo materiais** (órfã #17) | "Compras abre vazia, sem dados" | ⚠️ `hub_catalogo` tem **47 itens** — o dado EXISTE; o app espera `hub_produtos` (que não existe) → **desalinhamento de wiring, não falta de dado** |
| **MDO** (RAS-05) | "não construído" | ✅ `hub_especialistas` existe (0 linhas) |
| **Arquitetura** (órfã #20) | "só schema" | ✅ `hub_projetos` (3) + `hub_projetos_fases` existem |

---

## 2. Furos REAIS que a auditoria achou (o backlog de verdade)

1. **MET-01 — CHECK do banco faltava** → ✅ **CORRIGIDO hoje** (constraint `hub_ia_config_markup_check` aplicada via MCP; migração `20260707210000`). O guard do app já existia; agora o banco também rejeita markup<1.
2. **🔴 FIN-02 — bug LIVE + dinheiro de verdade parado.** `rpc_liberar_escrow` **ainda usa `GREATEST`** (custódia fantasma — mascara saldo negativo). E há **1 conta de escrow com `saldo_liberado = R$ 15.000`** (obra `a52b2c9a…`, DEMO de 03/jul). É o **P0 + a constatação C2**. Mexer nisso é **código de dinheiro → precisa do OK do dono** (não toco sozinho).
3. **hub_produtos não existe** (única "não existe" do plano que se confirmou), mas `hub_catalogo` tem 47 itens → a tela de Produtos/Compras precisa **apontar pro `hub_catalogo`** (ou uma view), não criar dado.
4. **Motor de comissões represado** (0 linhas em `hub_comissoes`/`titulos`/`movimentos`) → tabelas e RPCs prontos; falta a **tela realmente apurar/receber** (o wiring). A ponte-API `financeiro-rede` já existe.
5. **Tabelas órfãs existem mas vazias/não-cabeadas** (`hub_proximas_acoes`, `hub_especialistas`, `hub_error_logs`, `hub_negocio_titulos`…) → trabalho = **LIGAR**, não criar.
6. **Higiene:** existem tabelas legadas em inglês (`deals`, `leads`, `products`, `projects`, `users`…) e backups (`*_bkp_20260625`) convivendo com o schema `hub_*` — cruft a limpar (não urgente).

---

## 3. O que isso muda no plano

- A **Fase 0 está essencialmente completa** (RAS-01/02/03 ✅ + MET-01 ✅ + IA-02/EST-03/FIN-03 ✅). Falta só **ligar a Mistral (IA-01)** — depende da chave do dono.
- A **"Fase 2 — janela de migração GRANDE"** do plano (aplicar AEC/escrow/comissões) é **muito menor do que parecia**: o schema **já está aplicado**. O que resta é **ligar** (wiring das telas) + **1 bug de dinheiro (FIN-02)** + **desfazer o DEMO R$15k**.
- Reordenação honesta: **menos "construir/migrar", mais "ligar o represado + corrigir FIN-02"**. O caminho pro MVP encurtou.

> **Método:** leitura direta do schema real por `mcp__supabase__execute_sql` (contagem de linhas, `pg_constraint`, `pg_proc`, `information_schema`). Nenhuma escrita além do MET-01 CHECK (aditivo). FIN-02 e limpeza de DEMO ficam para decisão do dono.
