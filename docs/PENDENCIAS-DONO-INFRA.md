# 🔧 Guia de infra — o que VOCÊ executa (Render + Supabase)

> Três coisas que só você pode fazer (acesso ao Render/Supabase + não guardo segredos). Eu cuido do código.

---

## 1) `CRON_SECRET` no Render  ⏱️ 2 min

Destrava o "Executar agora" dos ciclos de IA e o cron seguro.

1. Gere um segredo forte (NÃO reuse o literal antigo). No seu terminal: `openssl rand -hex 32` (ou um gerador de senha, 40+ caracteres aleatórios).
2. Render → seu serviço → **Environment** → **Add Environment Variable**:
   - Key: `CRON_SECRET`
   - Value: *(o segredo gerado)*
3. Salvar → o Render redeploya sozinho.

> ⚠️ Não me mande o valor — ele não pode entrar no chat, no Git nem na memória.

---

## 2) `GROQ_API_KEY` no Render — destrava a IA ao vivo  ⏱️ 3 min

O código já tem o Groq como 3º provedor de fallback (commit recente). Como o Mistral está *idle*, o Groq assume.

1. Crie uma conta grátis em **console.groq.com** → **API Keys** → **Create API Key**.
2. Render → **Environment** → **Add**:
   - Key: `GROQ_API_KEY`
   - Value: *(a chave gr_... )*
3. Salvar. Depois validamos JUNTO os 3 testes: (1) "Gerar fluxo com IA" no editor, (2) atendimento WhatsApp, (3) copiloto de voz.

---

## 3) Migrações "janela do dono" no Supabase  ⏱️ 10 min

São **19 migrações aditivas** (escopo unificado, RLS de segurança, obra/arquitetura) que deixei como arquivo, esperando você. Todas têm o cabeçalho "⚠️ NÃO aplicar — janela do dono".

### Jeito recomendado (seguro — só aplica o que falta)
No projeto, com a Supabase CLI logada no projeto certo:
```bash
supabase db push
```
O `db push` lê a tabela `supabase_migrations` e aplica **apenas as migrações ainda não aplicadas**, em ordem de nome. É o caminho seguro — não re-roda o que já existe.

### Se você aplica manual (dashboard → SQL Editor)
Aplique em **ordem de nome de arquivo** APENAS as que ainda não rodou:

| Ordem | Arquivo | O que faz |
|------|---------|-----------|
| 1 | `20260628120000_hub_agente_setor_ia.sql` | setor de IA nos agentes |
| 2 | `20260630120000_contatos_tenant_rls.sql` | RLS + tenant nos contatos de notificação |
| 3 | `20260631120000_seg_rls_financeiro_tenant.sql` | **RLS financeiro por tenant** (D-2) |
| 4 | `20260631130000_fin_auditoria_baixa.sql` | auditoria de baixa financeira |
| 5 | `20260701120000_hub_fornecedores_espelho_motor.sql` | espelho fornecedor↔motor |
| 6 | `20260705130000_e0_obra_eap_catalogo.sql` | EAP + catálogo da obra |
| 7 | `20260705140000_a0_arquitetura_projeto.sql` | funil de projeto (Arquitetura) |
| 8 | `20260705150000_a1_aprovacao_sla.sql` | aprovação + SLA |
| 9 | `20260710120000_e2_obra_itens.sql` | itens da obra |
| 10 | `20260711120000_e0b_taxonomia_ambiente_segmento.sql` | taxonomia ambiente/segmento |
| 11 | `20260712120000_e3_obra_restricoes.sql` | restrições da obra |
| 12 | `20260720120000_e5_compras_estoque.sql` | compras + estoque |
| 13 | `20260730120000_e6_financeiro_contrato_escrow.sql` | **contrato + escrow** |
| 14 | `20260815120000_e7_item_escopo_unificado.sql` | **estrutura unificada (item de escopo)** |
| 15 | `20260816120000_e7b_status_escopo_e_aprovar.sql` | status do escopo + snapshot de custo |
| 16 | `20260817120000_e7c_medicao.sql` | medição (append-only) |
| 17 | `20260818120000_sec_rls_e5_anon.sql` | fecha RLS anon no E5 |
| 18 | `20260819120000_aut7_drop_idx_taxonomia_tenant_redundante.sql` | limpa índice redundante |
| 19 | `20260820120000_e4_curva_s.sql` | curva-S do cronograma |

> Se alguma falhar por "já existe", é porque já estava aplicada — pule. Se falhar por "tabela X não existe", **pare e me avise** (ordem de dependência). Por isso o `db push` é melhor: ele não erra nisso.

---

## Depois disso

Com secrets + migrações no ar, eu termino os 4 itens de decisão (H-SEC-1, escrow, health, conteúdo) e **retomamos o master plan** (núcleo comercial → estrutura unificada / orçamentária → próximas fases).
