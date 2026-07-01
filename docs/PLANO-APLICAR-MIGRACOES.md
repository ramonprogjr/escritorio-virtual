# 🗄️ PLANO DE APLICAÇÃO DAS MIGRAÇÕES — janela do dono

> Preparado 01/jul. **NÃO aplicado** (Supabase MCP caiu + CLI `supabase` fora do PATH + você fora 2h). Este é o passo-a-passo SEGURO para aplicar JUNTOS (ou você colar no dashboard) quando voltar. ~10-15 min.

## Por que NÃO apliquei sozinho
1. **Supabase MCP desconectou** nesta sessão (perdi o `apply_migration` — a ferramenta segura por-migração).
2. **CLI `supabase` não está no PATH** (não dá `supabase db push`).
3. **Version mismatch:** os `version` aplicados na prod NÃO batem com os timestamps dos arquivos → `db push` cego poderia **duplicar/errar** e bagunçar o tracking.
4. Você fora 2h → se quebrar, fica no ar até você voltar.

## ✅ Método SEGURO recomendado: colar SQL no **Supabase Dashboard → SQL Editor**
Colar no dashboard **executa o SQL direto** — ignora o tracking do `db push`, então o version-mismatch **não importa**. As migrações são idempotentes (`IF NOT EXISTS`), então re-rodar uma já-aplicada é inofensivo.
**Regra:** cole UMA por vez, na ordem abaixo. Se der erro **"already exists"** → aquele objeto já existe (pule, continue). Se der **outro erro** → PARE e me chame (não force).

## Ordem de aplicação (17 migrações + 1 de dado)

| # | Arquivo | Classe | Risco | Nota |
|---|---------|--------|-------|------|
| 1 | `20260630120000_contatos_tenant_rls.sql` | RLS (tabela viva, DO-block guardado) | baixo | tenant + RLS em hub_contatos_notificacao |
| 2 | `20260631120000_seg_rls_financeiro_tenant.sql` | RLS (contas_pagar/receber, VAZIAS) | baixo | **✅ CORRIGIDO hoje** o `CREATE POLICY IF NOT EXISTS` (era SQL inválido → falharia) → agora `DROP+CREATE` |
| 3 | `20260631130000_fin_auditoria_baixa.sql` | tabela nova (auditoria) | baixo | aditivo |
| 4 | `20260705120000_merge_pessoas.sql` | **DADO (funde hub_pessoas)** | 🟡 **MÉDIO** | **REVISAR + BACKUP antes** — mexe nas 7 pessoas existentes. Aplicar SÓ depois de conferir a lógica de merge com você |
| 5 | `20260705130000_e0_obra_eap_catalogo.sql` | AEC (ALTER hub_obras + tabelas novas, IF NOT EXISTS) | baixo | aditivo/idempotente |
| 6 | `20260705140000_a0_arquitetura_projeto.sql` | AEC arquitetura | baixo | aditivo |
| 7 | `20260705150000_a1_aprovacao_sla.sql` | AEC (colunas SLA) | baixo | aditivo |
| 8 | `20260710120000_e2_obra_itens.sql` | AEC (itens) | baixo | tabela nova |
| 9 | `20260711120000_e0b_taxonomia_ambiente_segmento.sql` | AEC (taxonomia) | baixo | aditivo |
| 10 | `20260712120000_e3_obra_restricoes.sql` | AEC (restrições) | baixo | tabela nova |
| 11 | `20260720120000_e5_compras_estoque.sql` | AEC (compras/estoque, append-only) | baixo | tabelas novas |
| 12 | `20260730120000_e6_financeiro_contrato_escrow.sql` | AEC (contrato/escrow) | baixo p/ APLICAR | ⚠️ **a RPC tem o bug do `GREATEST` (custódia fantasma) + sem `FOR UPDATE`** — aplicar OK, mas **NÃO ativar escrow** até consertar a lógica (fix separado) |
| 13 | `20260815120000_e7_item_escopo_unificado.sql` | AEC (estrutura unificada) | baixo | aditivo |
| 14 | `20260816120000_e7b_status_escopo_e_aprovar.sql` | AEC (status + RPC snapshot) | baixo | aditivo |
| 15 | `20260817120000_e7c_medicao.sql` | AEC (medição) | baixo | tabela nova |
| 16 | `20260818120000_sec_rls_e5_anon.sql` | RLS nas tabelas E5 (novas) | baixo | fecha anon no E5 |
| 17 | `20260819120000_aut7_drop_idx_taxonomia_tenant_redundante.sql` | DROP índice redundante | baixo | idempotente |
| 18 | `20260820120000_e4_curva_s.sql` | AEC (curva-S) | baixo | aditivo |

## ⚠️ Antes/depois
- **Antes:** backup do banco (Supabase faz PITR, mas confirme). Para a #4 (merge_pessoas): rodar `SELECT count(*) FROM hub_pessoas;` e conferir se há duplicatas reais a fundir.
- **Depois:** conferir que as tabelas AEC apareceram (`hub_obra_itens`, `hub_obra_medicoes`, etc.); testar 1 leitura numa tela de Obra; rodar os advisors de segurança do Supabase.
- **NÃO ativar o escrow** (pagamentos de obra) até o fix do `GREATEST`/`FOR UPDATE` da RPC — está no backlog de segurança.

## Alternativa (quando o MCP/CLI voltar)
Se reconectar o Supabase MCP ou instalar o CLI, eu aplico uma a uma com verificação automática. Mas o método do dashboard acima é seguro e independe disso.
