# Auditoria E2E — DOMÍNIO D: Financeiro

> Régua-mãe: o melhor para o sistema — crítico, seguro (é DINHEIRO), cuidadoso, com CERTEZA.
> Read-only. Evidência por arquivo:linha. Data: 2026-06-30.

## Escopo auditado (arquivos reais)

Telas:
- `app/crm/financeiro/page.tsx` → monta `CrmFinanceDashboard` via hook `useFinanceDashboard`
- `app/crm/financeiro/receber/page.tsx` (contas a receber)
- `app/crm/financeiro/pagar/page.tsx` (contas a pagar)

Componentes:
- `components/crm/CrmFinanceDashboard.tsx`
- `components/crm/FinanceiroContasList.tsx`
- `components/crm/FinanceiroNovoLancamentoModal.tsx`

Endpoints / lib:
- `app/api/crm/financeiro/dashboard/route.ts`
- `app/api/crm/financeiro/contas/route.ts` (POST criar)
- `app/api/crm/financeiro/contas/receber/[id]/route.ts` (PATCH baixar)
- `app/api/crm/financeiro/contas/pagar/[id]/route.ts` (PATCH baixar)
- `app/api/crm/relatorios/export/route.ts` (CSV — usado pelas 3 telas)
- `lib/crm/finance-dashboard-aggregate.ts`, `lib/crm/finance-contas.ts`, `lib/crm/crm-api-auth.ts`, `lib/tenant-default.ts`, `hooks/useFinanceDashboard.ts`
- `supabase/migrations/20260529210000_ensure_hub_financeiro_tables.sql`, `docs/sql/bloco-e-rls-APPLIED.sql`

## Veredito geral

O caminho **server-side** do dinheiro está, no geral, bem blindado: as rotas usam `requireCrmFinanceiro` (role owner/gestor/financeiro), o tenant vem **sempre do contexto da sessão** (cookie httpOnly), os PATCH de baixa fazem `.eq("id") + .or(tenantScopeOrFilter)`, o POST não confia em tenant do body, e o export CSV está com guard por entidade + tenant da sessão + defesa-em-profundidade em `relatorios-data.ts`. O bug histórico de vazamento no export aparece como já corrigido.

Porém há **um leak client-side real e concreto na tela de Contas a Pagar** (espelho exato do bug que já foi corrigido em Receber, mas que ficou esquecido em Pagar), e a proteção RLS dessas duas tabelas no banco está **ambígua** (a migração versionada deixa a política aberta `USING(true)`; a versão segura existe só como SQL manual em `docs/`). Isso transforma o leak client-side em algo potencialmente material em produção.

---

## 🔴 BLOQUEADORES

### D-1 🔴 Contas a Pagar lê SEM filtro de tenant (vazamento de valores entre escritórios)
- **Arquivo:** `app/crm/financeiro/pagar/page.tsx:31-48`
- **Problema:** o `carregar()` faz `supabase.from("hub_contas_pagar").select("*").order(...)` com o **client anon do browser**, **sem** `useCrmTenant`, **sem** `.eq("tenant_id")` e **sem** `.or(tenantScopeOrFilter(...))`. A tela irmã `receber/page.tsx:34-48` foi corrigida exatamente para isso (usa `useCrmTenant` + `tenantScopeOrFilter` + guarda `if (!tenantId) return`), mas **Pagar ficou para trás**. Resultado: dependendo da RLS efetiva no banco (ver D-2), um financeiro de um tenant pode ver **todas as contas a pagar de todos os tenants** — descrição, valor e vencimento de fornecedores de outros escritórios.
- **Ajuste:** replicar 1:1 o padrão de `receber/page.tsx` em `pagar/page.tsx`: importar `useCrmTenant` e `tenantScopeOrFilter`, consumir `{ tenantId, loading: tenantLoading }`, retornar cedo quando `!tenantId` (setando `[]`), e trocar a query para `.or(tenantScopeOrFilter(tenantId))`. Acrescentar `tenantId, tenantLoading` às deps do `useCallback`.

### D-2 🔴 RLS efetiva das tabelas financeiras é ambígua — a migração versionada é "aberta a todos"
- **Arquivo:** `supabase/migrations/20260529210000_ensure_hub_financeiro_tables.sql:52-62` vs `docs/sql/bloco-e-rls-APPLIED.sql:53-70`
- **Problema:** a **migração versionada** (a que o histórico de migrações garante estar aplicada) cria, para `hub_contas_pagar` e `hub_contas_receber`, a política `FOR ALL USING (true) WITH CHECK (true)` e dá `GRANT ALL ... TO anon` (linhas 56-62). Isso é **default-allow para anon**. A versão correta, tenant-scoped (`tenant_id = current_user_tenant_id() or tenant_id is null`, com `drop policy ... _service`), existe apenas em `docs/sql/bloco-e-rls-APPLIED.sql` — um arquivo de SQL manual, **não** uma migração versionada. Não há certeza de que foi aplicada em produção. Como o browser usa a **anon key sem JWT de Supabase Auth** (a sessão CRM é por cookie/proxy, não por Supabase Auth), sob a política aberta o anon lê tudo; sob a política segura, `current_user_tenant_id()` seria nulo e o anon cairia em default-deny. Ou seja: a segurança real das telas financeiras no browser hoje depende de um estado de banco **incerto**.
- **Ajuste:** (a) promover o conteúdo tenant-scoped de `bloco-e-rls-APPLIED.sql` (para essas 2 tabelas) a uma **migração versionada** que dropa a política `_service USING(true)` e revoga `anon`; (b) confirmar no Supabase de produção qual política está ativa (`select polname, qual from pg_policies where tablename in ('hub_contas_pagar','hub_contas_receber')`); (c) até que (a)/(b) estejam fechados, tratar D-1 como a única barreira efetiva — portanto D-1 é obrigatório. **Decisão de banco/produção: requer aprovação do dono antes de aplicar (não aplicar migração sem OK).**

---

## 🟢 AJUSTES AUTÔNOMOS (ordenados por valor)

### D-3 🟢 Fallback client-side do dashboard agrega com tenant fixo via anon (risco latente)
- **Arquivo:** `hooks/useFinanceDashboard.ts:73-85` (e `42-45`)
- **Problema:** quando a rota `/api/crm/financeiro/dashboard` falha, o hook chama `aggregateFinanceDashboard(supabase, tenantIdCliente())` **direto do browser com o client anon**, e `tenantIdCliente()` usa `NEXT_PUBLIC_TENANT_ID || DEFAULT_OBRA10_TENANT_ID`. Em uma instância multi-tenant real, esse fallback (1) ignora o tenant do usuário logado e (2) depende da RLS para não vazar (mesmo problema do D-2). É um caminho de leitura de valores agregados que escapa do guard de role da rota.
- **Ajuste:** remover o fallback que consulta Supabase direto e, em caso de erro da rota, apenas exibir o estado de erro com "Tentar novamente" (a UI já tem esse caminho via `dash.erro`). Alternativa mínima: manter o fallback apenas em `NODE_ENV !== "production"`.

### D-4 🟢 Dashboard aggregate usa `.or()` literal em vez do helper, sem o tenant padrão
- **Arquivo:** `lib/crm/finance-dashboard-aggregate.ts:119` e `:124`
- **Problema:** as queries de `hub_contas_pagar`/`hub_contas_receber` usam `.or(\`tenant_id.eq.${tenantId},tenant_id.is.null\`)` em vez de `tenantScopeOrFilter(tenantId)`. Funcionalmente cobre tenant atual + null, mas **não inclui** o `DEFAULT_OBRA10_TENANT_ID` que o helper acrescenta para tenants não-default. Inconsistente com o resto do código (aprovações na linha 131 já usam o helper). Baixo risco de segurança (é restritivo, não permissivo), mas pode **esconder** lançamentos legados gravados sob o tenant default para um tenant não-default. Como roda em service-role, é seguro trocar.
- **Ajuste:** trocar os dois `.or(...)` literais por `.or(tenantScopeOrFilter(tenantId))` (já importado no arquivo).

### D-5 🟢 KPIs de cabeçalho abreviam moeda (k/M) e podem confundir no caixa
- **Arquivo:** `components/crm/CrmFinanceDashboard.tsx:160-188` (cards via `moedaFinanceiro`) e `lib/crm/finance-contas.ts:47-56`
- **Problema:** os cards "A pagar", "A receber", "Vencido", "Saldo projetado" usam `moedaFinanceiro` que abrevia (`R$ 12k`, `R$ 1.2M`). Para KPI de topo é defensável, mas em "Vencido" e "Saldo projetado" a perda de precisão pode levar o gestor a uma leitura errada de quanto realmente está em jogo (ex.: `R$ 1.2M` esconde até R$ 99.999). O item individual já usa `moedaFinanceiroExata` corretamente (`FinanceiroContasList.tsx:119`) — a separação existe e está documentada na própria lib.
- **Ajuste:** exibir valor exato (`moedaFinanceiroExata`) pelo menos nos cards "Vencido" e "Saldo projetado", ou adicionar `title={moedaFinanceiroExata(valor)}` nos cards para revelar o valor cheio no hover. Manter abreviação apenas onde o espaço exige.

### D-6 🟢 "Marcar pago/recebido" não tem confirmação nem trava de duplo-clique de rede
- **Arquivo:** `components/crm/FinanceiroContasList.tsx:56-77, 142-151`
- **Problema:** dar baixa em dinheiro é ação sensível e é **um clique direto**, sem confirmação. Há mitigação boa (botão desabilita via `processando`, e há "Desfazer" no toast via `toast.withAction`), então não é bloqueador. Mas em mobile, um toque acidental baixa a conta; o "Desfazer" depende do usuário ver e agir no toast.
- **Ajuste:** manter o fluxo otimista + Desfazer (é bom UX), mas considerar um micro-confirm inline ("Confirmar baixa?") só para valores acima de um limite, ou destacar mais o Desfazer. Opcional/baixa prioridade.

### D-7 🟢 `valor` do input não trata vírgula decimal (pt-BR) — UX de digitação
- **Arquivo:** `components/crm/FinanceiroNovoLancamentoModal.tsx:160-168` + `app/api/crm/financeiro/contas/route.ts:33-36`
- **Problema:** o input é `type="number"` e o backend faz `Number(body.valor)`. Em teclados/locales que enviam vírgula (`1234,50`), `Number("1234,50")` vira `NaN` → backend rejeita com "valor inválido". `type="number"` em geral protege no desktop, mas o comportamento varia em alguns Androids/teclados. Não é leak, é fricção de cadastro de valor.
- **Ajuste:** normalizar no backend antes do `Number`: `String(body.valor).replace(/\./g,'').replace(',', '.')` quando vier string com vírgula, ou aceitar e sanitizar no client. Baixo risco.

### D-8 🟢 Erro de criação de lançamento é exibido como `error.message` cru do Postgres
- **Arquivo:** `app/api/crm/financeiro/contas/route.ts:94-96` → exibido em `FinanceiroNovoLancamentoModal.tsx:72-74`
- **Problema:** em falha de insert, o endpoint retorna `error.message` do PostgREST/Postgres direto ao cliente, que é mostrado no modal. Pode vazar nome de coluna/constraint/detalhe de schema ao usuário final. Os PATCH (`pagar/[id]` e `receber/[id]`) têm o mesmo padrão (linha 47 de cada).
- **Ajuste:** logar o `error.message` no servidor (`console.error`) e devolver mensagem genérica ao cliente ("Não foi possível salvar o lançamento."), preservando o status. Padrão já usado no dashboard route (`dashboard/route.ts:22-25`).

---

## 🟡 DECISÕES PARA O DONO

### D-9 🟡 "Saldo projetado" não é saldo bancário — risco de interpretação
- **Arquivo:** `components/crm/CrmFinanceDashboard.tsx:182-188` (sub: "receber − pagar (não é saldo bancário)") e `lib/crm/finance-dashboard-aggregate.ts:189`
- **Ponto:** o sistema **não tem conta bancária / saldo real** — "Saldo projetado" = soma de pendentes a receber − a pagar. O texto auxiliar avisa, e o rodapé "Valores projetados; confirme no banco antes de pagar ou receber" (linha 304-307) reforça. É honesto, mas o dono precisa decidir se o produto deve ter saldo bancário real (conciliação) ou se essa projeção basta para o MVP. Como é dinheiro, vale a decisão explícita.

### D-10 🟡 Não há registro de QUEM deu baixa nem QUANDO (trilha de auditoria do dinheiro)
- **Arquivo:** `app/api/crm/financeiro/contas/pagar/[id]/route.ts:34-35` e `receber/[id]/route.ts:34-35`
- **Ponto:** o PATCH grava só `status` + `atualizado_em`. Não há `baixado_por` / `baixado_em` / log em `hub_eventos`. Para dinheiro, a ausência de trilha de "quem marcou pago/recebido" é um gap de governança (o `auth.ctx.userId` está disponível e é ignorado). Não é bloqueador funcional, mas é decisão do dono se a versão "perfeita" do financeiro exige trilha imutável de baixa (cf. memória "engenharia auditorial" / escrow). Recomendo SIM, alinhado à régua de auditoria do produto.

### D-11 🟡 Quem pode dar baixa = todo perfil financeiro (sem segregação valor/limite)
- **Arquivo:** `lib/crm/crm-api-auth.ts:182-194` (`requireCrmFinanceiro` = owner/gestor/financeiro)
- **Ponto:** qualquer usuário com role `financeiro` pode criar lançamento e baixar conta de qualquer valor. Não há alçada (limite por valor exige aprovação superior), embora exista uma seção "Aprovações financeiras" no dashboard (lendo `hub_aprovacoes`) que sugere a intenção. Decisão do dono: o financeiro deve ter alçada por valor (acima de X exige owner/gestor)? Conecta com a Central de Aprovações já mapeada na memória.

---

## Pontos verificados que estão OK (para não retrabalhar)

- **Tenant nas rotas server:** `dashboard`, `contas POST`, ambos PATCH e `export` derivam tenant de `auth.ctx.tenantId` / contexto, nunca do body. `tenantIdFromRequest` só honra `x-tenant-id` com `INTERNAL_API_KEY` válida (`tenant-default.ts:70-87`).
- **PATCH de baixa com escopo de tenant:** `.eq("id") + .or(tenantScopeOrFilter(tenantId))`, com fallback gracioso se a coluna não existir (`pagar/[id]/route.ts:32-44`, `receber/[id]/route.ts:32-44`).
- **POST não duplica recebível por negócio** (`contas/route.ts:69-84`) e **não confia em valor/tenant do body** (`valor` validado `> 0` e finito; `tenant_id` ignorado do body).
- **Export CSV** com guard por entidade (financeiro→`requireCrmFinanceiro`), tenant da sessão e defesa-em-profundidade `.eq("tenant_id")` em `relatorios-data.ts:71` (corrige o leak histórico).
- **Receber/page.tsx** já blindado (`useCrmTenant` + `tenantScopeOrFilter`, guard `!tenantId`).
- **Moeda exata no item** que será pago/recebido (`FinanceiroContasList.tsx:119` via `moedaFinanceiroExata`).
- **Design/marca:** tokens Obra10+ dark verde+dourado consistentes (`#0a140f`/`#0f1d16`/`#c9a24a`/`#3fb950`); **nenhum azul/roxo Shadcn** nas telas financeiras. Cores semânticas (vermelho vencido `#f85149`, amarelo pagar `#e3b341`, verde receber `#3fb950`).
- **Mobile:** `useNarrowViewport` ajusta padding; alvos `min-h-10/11`; FAB de novo lançamento no mobile (`CrmFinanceDashboard.tsx:310-317`); modal bottom-sheet com `safe-area-inset`. Nenhum texto sobreposto detectado; KPIs em grid 2-col no mobile. Nenhuma "tabela-como-tela" (usa cards/lista).
- **A11y:** modal com `role="dialog"`, `aria-modal`, `aria-labelledby`; ícones `aria-hidden`; botões com `aria-label`; erro do dashboard com `role="alert"`. Lacuna menor: o `<span>` de status colorido (`FinanceiroContasList.tsx:122-130`) usa cor de fundo derivada com baixa opacidade — verificar contraste do texto sobre `${cor}22` (não bloqueia).

---

## Resumo de prioridade

| ID | Sev | Tela/arquivo | Essência |
|----|-----|--------------|----------|
| D-1 | 🔴 | `pagar/page.tsx:31-48` | Pagar lê sem tenant (espelho do fix de Receber) |
| D-2 | 🔴 | migração `...210000.sql:52-62` | RLS financeira versionada = `USING(true)`; versão segura só em docs/ |
| D-3 | 🟢 | `useFinanceDashboard.ts:73-85` | Fallback agrega via anon com tenant fixo |
| D-4 | 🟢 | `finance-dashboard-aggregate.ts:119,124` | `.or()` literal sem tenant default |
| D-5 | 🟢 | `CrmFinanceDashboard.tsx:174-188` | KPIs abreviam Vencido/Saldo |
| D-6 | 🟢 | `FinanceiroContasList.tsx:56-77` | Baixa sem confirmação (tem Desfazer) |
| D-7 | 🟢 | modal + `contas/route.ts:33` | Vírgula decimal vira NaN |
| D-8 | 🟢 | `contas/route.ts:94`, PATCHs | Erro Postgres cru ao cliente |
| D-9 | 🟡 | `CrmFinanceDashboard.tsx:182` | Saldo projetado ≠ saldo bancário |
| D-10 | 🟡 | PATCHs `[id]/route.ts` | Sem trilha de quem/quando deu baixa |
| D-11 | 🟡 | `crm-api-auth.ts:182` | Sem alçada por valor |
