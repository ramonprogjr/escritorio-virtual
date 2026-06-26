# Créditos de IA — Fase 1 (medição + carteira/ledger) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir o consumo real de IA por escritório (tenant) e registrar custo (R$) + créditos num ledger, sem tocar no fluxo do usuário (modo de construção; o bloqueio pré-pago vem na Fase 3).

**Architecture:** Funções puras de precificação (testáveis) + 4 tabelas Supabase tenant-scoped + um "recorder" best-effort chamado no chokepoint de IA + uma rota de leitura (saldo/extrato). Provider-agnostic: a mesma tabela precifica Mistral e Claude.

**Tech Stack:** Next.js 16 (App Router) · Supabase (Postgres + RLS) · TypeScript strict · Vitest. Engine de IA em `lib/ia/`.

## Global Constraints

- Migrações **aditivas**; nunca alterar/dropar coluna existente. Aplicar via Supabase MCP `apply_migration` sob supervisão (schema multi-tenant).
- RLS tenant-scoped em toda tabela nova: `tenant_id = current_user_tenant_id() OR tenant_id IS NULL`, role `authenticated`. `crmDb()` usa SERVICE_ROLE (bypassa RLS) — o app filtra por `ctx.tenantId`.
- Metering é **best-effort**: falha de medição **nunca** quebra o fluxo de IA (try/catch → retorna null).
- Gate: `npx tsc --noEmit` + `npx vitest run` (183 testes atuais devem continuar verdes). tsconfig strict, **sem** noUnusedLocals.
- Decisões do dono: 1 crédito = **R$ 0,10**; markup **10×**; `fx_usd_brl` default **6,00**. Tudo configurável em `hub_ia_config`.
- Preços de referência (USD/1M, jun/2026): opus-4-8 5/25 · sonnet-4-6 3/15 · haiku-4-5 1/5 · fable-5 10/50 · mistral-large 2/6 · mistral-small 0,2/0,6. Modelo desconhecido → fallback conservador 10/50 (nunca sub-cobrar).
- Sem secrets no Git. Commits frequentes na branch `wendel/dev`.

---

### Task 1: Funções puras de precificação e custo

**Files:**
- Create: `lib/ia/metering-calc.ts`
- Test: `lib/ia/metering-calc.test.ts`

**Interfaces:**
- Consumes: nada (pure).
- Produces:
  - `type PrecoModelo = { inputUsdMilhao: number; outputUsdMilhao: number }`
  - `PRECOS_MODELOS: Record<string, PrecoModelo>`
  - `PRECO_DEFAULT: PrecoModelo`
  - `precoDoModelo(modelo: string, tabela?: Record<string, PrecoModelo>): PrecoModelo`
  - `custoUsdDeTokens(p: { modelo: string; tokensEntrada: number; tokensSaida: number; tabela?: Record<string, PrecoModelo> }): number`
  - `custoBrl(custoUsd: number, fxUsdBrl: number, markup: number): number`
  - `creditosDeCusto(custoBrl: number, valorCreditoBrl: number): number`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ia/metering-calc.test.ts
import { describe, it, expect } from "vitest";
import {
  precoDoModelo,
  custoUsdDeTokens,
  custoBrl,
  creditosDeCusto,
  PRECO_DEFAULT,
} from "./metering-calc";

describe("metering-calc", () => {
  it("precoDoModelo retorna preço do modelo conhecido", () => {
    expect(precoDoModelo("claude-opus-4-8")).toEqual({ inputUsdMilhao: 5, outputUsdMilhao: 25 });
  });

  it("precoDoModelo cai no fallback conservador p/ modelo desconhecido", () => {
    expect(precoDoModelo("modelo-inexistente")).toEqual(PRECO_DEFAULT);
  });

  it("custoUsdDeTokens calcula (in*preçoIn + out*preçoOut)/1e6", () => {
    // opus: 1000 in * 5 + 500 out * 25 = 5000 + 12500 = 17500 / 1e6 = 0.0175
    const usd = custoUsdDeTokens({ modelo: "claude-opus-4-8", tokensEntrada: 1000, tokensSaida: 500 });
    expect(usd).toBeCloseTo(0.0175, 6);
  });

  it("custoBrl aplica câmbio e markup", () => {
    expect(custoBrl(0.0175, 6, 10)).toBeCloseTo(1.05, 6); // 0.0175 * 6 * 10
  });

  it("creditosDeCusto arredonda PRA CIMA pelo valor do crédito", () => {
    expect(creditosDeCusto(1.05, 0.1)).toBe(11); // ceil(10.5)
  });

  it("creditosDeCusto é 0 quando custo é 0", () => {
    expect(creditosDeCusto(0, 0.1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ia/metering-calc.test.ts`
Expected: FAIL (módulo `./metering-calc` não existe).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ia/metering-calc.ts
export type PrecoModelo = { inputUsdMilhao: number; outputUsdMilhao: number };

/** Preços de referência (USD por 1M tokens, jun/2026). Provider-agnostic. */
export const PRECOS_MODELOS: Record<string, PrecoModelo> = {
  "claude-opus-4-8": { inputUsdMilhao: 5, outputUsdMilhao: 25 },
  "claude-sonnet-4-6": { inputUsdMilhao: 3, outputUsdMilhao: 15 },
  "claude-haiku-4-5": { inputUsdMilhao: 1, outputUsdMilhao: 5 },
  "claude-fable-5": { inputUsdMilhao: 10, outputUsdMilhao: 50 },
  "mistral-large-latest": { inputUsdMilhao: 2, outputUsdMilhao: 6 },
  "mistral-small-latest": { inputUsdMilhao: 0.2, outputUsdMilhao: 0.6 },
};

/** Fallback conservador: modelo desconhecido nunca é sub-cobrado. */
export const PRECO_DEFAULT: PrecoModelo = { inputUsdMilhao: 10, outputUsdMilhao: 50 };

export function precoDoModelo(
  modelo: string,
  tabela: Record<string, PrecoModelo> = PRECOS_MODELOS,
): PrecoModelo {
  return tabela[modelo] ?? PRECO_DEFAULT;
}

export function custoUsdDeTokens(p: {
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  tabela?: Record<string, PrecoModelo>;
}): number {
  const preco = precoDoModelo(p.modelo, p.tabela);
  return (p.tokensEntrada * preco.inputUsdMilhao + p.tokensSaida * preco.outputUsdMilhao) / 1_000_000;
}

export function custoBrl(custoUsd: number, fxUsdBrl: number, markup: number): number {
  return custoUsd * fxUsdBrl * markup;
}

/** Créditos cobrados = custo (R$) ÷ valor do crédito, arredondado pra cima. */
export function creditosDeCusto(custoBrl: number, valorCreditoBrl: number): number {
  if (valorCreditoBrl <= 0 || custoBrl <= 0) return 0;
  return Math.ceil(custoBrl / valorCreditoBrl);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ia/metering-calc.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/ia/metering-calc.ts lib/ia/metering-calc.test.ts
git commit -m "feat(ia): funções puras de precificação de consumo de IA (Fase 1)"
```

---

### Task 2: Migração — tabelas de metering (preços, config, consumo, movimentos)

**Files:**
- Create: `supabase/migrations/20260626210000_ia_metering.sql`

**Interfaces:**
- Produces (schema): tabelas `hub_ia_precos`, `hub_ia_config`, `hub_ia_consumo`, `hub_ia_creditos_mov` (colunas usadas nas Tasks 3 e 5).

- [ ] **Step 1: Escrever a migração**

```sql
-- supabase/migrations/20260626210000_ia_metering.sql
-- Fase 1 do metering de IA: preços, config, ledger de consumo e movimentos da carteira.
-- Aditivo. Tenant-scoped + RLS. Nada de bloqueio aqui (modo de construção).

create table if not exists public.hub_ia_precos (
  modelo text primary key,
  input_usd_milhao numeric not null,
  output_usd_milhao numeric not null,
  cache_read_fator numeric not null default 0.1,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.hub_ia_config (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('global','tenant')),
  tenant_id uuid,
  markup numeric not null default 10,
  fx_usd_brl numeric not null default 6,
  valor_credito_brl numeric not null default 0.10,
  nome_moeda text not null default 'Tijolos',
  modo text not null default 'prepago' check (modo in ('prepago','pospago')),
  alerta_saldo_baixo integer not null default 50,
  criado_em timestamptz not null default now()
);
create unique index if not exists hub_ia_config_escopo_tenant_uniq
  on public.hub_ia_config (escopo, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.hub_ia_consumo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  usuario_id uuid,
  origem text not null,
  modelo text not null,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  custo_usd numeric not null default 0,
  custo_brl numeric not null default 0,
  creditos integer not null default 0,
  ref_tipo text,
  ref_id text,
  criado_em timestamptz not null default now()
);
create index if not exists hub_ia_consumo_tenant_idx on public.hub_ia_consumo (tenant_id, criado_em desc);

create table if not exists public.hub_ia_creditos_mov (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tipo text not null check (tipo in ('compra','bonus','assinatura','debito','estorno')),
  creditos integer not null,
  descricao text,
  ref_id text,
  criado_em timestamptz not null default now()
);
create index if not exists hub_ia_creditos_mov_tenant_idx on public.hub_ia_creditos_mov (tenant_id, criado_em desc);

-- RLS tenant-scoped (mesmo padrão das ~36 tabelas existentes)
alter table public.hub_ia_precos enable row level security;
alter table public.hub_ia_config enable row level security;
alter table public.hub_ia_consumo enable row level security;
alter table public.hub_ia_creditos_mov enable row level security;

-- preços e config global: leitura p/ authenticated
create policy hub_ia_precos_sel on public.hub_ia_precos for select to authenticated using (true);
create policy hub_ia_config_sel on public.hub_ia_config for select to authenticated
  using (tenant_id is null or tenant_id = current_user_tenant_id());
create policy hub_ia_consumo_sel on public.hub_ia_consumo for select to authenticated
  using (tenant_id is null or tenant_id = current_user_tenant_id());
create policy hub_ia_mov_sel on public.hub_ia_creditos_mov for select to authenticated
  using (tenant_id is null or tenant_id = current_user_tenant_id());

-- seed de preços de referência
insert into public.hub_ia_precos (modelo, input_usd_milhao, output_usd_milhao) values
  ('claude-opus-4-8', 5, 25),
  ('claude-sonnet-4-6', 3, 15),
  ('claude-haiku-4-5', 1, 5),
  ('claude-fable-5', 10, 50),
  ('mistral-large-latest', 2, 6),
  ('mistral-small-latest', 0.2, 0.6)
on conflict (modelo) do nothing;

-- config global default (R$0,10/crédito, markup 10×, câmbio 6)
insert into public.hub_ia_config (escopo, tenant_id, markup, fx_usd_brl, valor_credito_brl, modo)
  values ('global', null, 10, 6, 0.10, 'prepago')
on conflict do nothing;
```

- [ ] **Step 2: Aplicar a migração (Supabase MCP, sob supervisão)**

Aplicar via `mcp__claude_ai_Supabase__apply_migration` (project `cdjlqsznerdhwqyunodl`, name `ia_metering`, query = conteúdo do arquivo).

- [ ] **Step 3: Verificar que as 4 tabelas existem e o seed entrou**

Run (Supabase MCP `execute_sql`):
```sql
select modelo, input_usd_milhao, output_usd_milhao from public.hub_ia_precos order by modelo;
select escopo, markup, fx_usd_brl, valor_credito_brl, modo from public.hub_ia_config;
```
Expected: 6 linhas de preços; 1 linha de config global (markup 10, fx 6, valor 0.10, prepago).

- [ ] **Step 4: Conferir advisors (sem novo furo de segurança)**

Run: `mcp__claude_ai_Supabase__get_advisors` (type `security`).
Expected: nenhuma policy `always_true` nova em tabela sensível; RLS habilitada nas 4 tabelas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260626210000_ia_metering.sql
git commit -m "feat(ia): migração de metering — preços, config, consumo, movimentos (Fase 1)"
```

---

### Task 3: Recorder de consumo + loader de config + saldo

**Files:**
- Create: `lib/ia/metering.ts`
- Test: `lib/ia/metering.test.ts`

**Interfaces:**
- Consumes: `custoUsdDeTokens`, `custoBrl`, `creditosDeCusto` (Task 1); tabelas (Task 2).
- Produces:
  - `type ConfigPreco = { markup: number; fxUsdBrl: number; valorCreditoBrl: number }`
  - `CONFIG_PADRAO: ConfigPreco`
  - `carregarConfigPreco(tenantId: string, db?: SupabaseLike): Promise<ConfigPreco>`
  - `registrarConsumoIA(p: ConsumoInput, db?: SupabaseLike): Promise<{ creditos: number; custoBrl: number } | null>`
  - `saldoCreditos(tenantId: string, db?: SupabaseLike): Promise<number>`
  - `type ConsumoInput = { tenantId: string; usuarioId?: string | null; origem: string; modelo: string; tokensEntrada: number; tokensSaida: number; refTipo?: string | null; refId?: string | null }`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ia/metering.test.ts
import { describe, it, expect } from "vitest";
import { registrarConsumoIA, saldoCreditos, CONFIG_PADRAO } from "./metering";

/** Stub mínimo de Supabase que registra inserts e devolve dados configuráveis. */
function makeDb(rows: Record<string, unknown[]>) {
  const inserts: Record<string, unknown[]> = {};
  const db = {
    from(table: string) {
      return {
        select() {
          return {
            or() {
              return Promise.resolve({ data: rows[table] ?? [], error: null });
            },
            // saldoCreditos usa eq(...).  devolve a lista da tabela.
            eq() {
              return Promise.resolve({ data: rows[table] ?? [], error: null });
            },
          };
        },
        insert(payload: unknown) {
          inserts[table] = inserts[table] ?? [];
          inserts[table].push(payload);
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };
  return { db, inserts };
}

describe("registrarConsumoIA", () => {
  it("grava consumo e movimento de débito usando a config global", async () => {
    // config global: markup 10, fx 6, valor 0.10  →  opus 1000/500 = US$0.0175 → R$1.05 → 11 créditos
    const { db, inserts } = makeDb({
      hub_ia_config: [{ escopo: "global", tenant_id: null, markup: 10, fx_usd_brl: 6, valor_credito_brl: 0.1 }],
    });
    const out = await registrarConsumoIA(
      { tenantId: "t1", origem: "cronograma", modelo: "claude-opus-4-8", tokensEntrada: 1000, tokensSaida: 500 },
      db as never,
    );
    expect(out).not.toBeNull();
    expect(out!.creditos).toBe(11);
    expect(inserts.hub_ia_consumo).toHaveLength(1);
    expect(inserts.hub_ia_creditos_mov).toHaveLength(1);
    expect((inserts.hub_ia_creditos_mov[0] as { creditos: number }).creditos).toBe(-11);
  });

  it("é best-effort: erro no banco retorna null sem lançar", async () => {
    const db = { from() { throw new Error("db down"); } };
    const out = await registrarConsumoIA(
      { tenantId: "t1", origem: "x", modelo: "mistral-small-latest", tokensEntrada: 10, tokensSaida: 10 },
      db as never,
    );
    expect(out).toBeNull();
  });
});

describe("saldoCreditos", () => {
  it("soma os movimentos da carteira", async () => {
    const { db } = makeDb({
      hub_ia_creditos_mov: [{ creditos: 100 }, { creditos: -11 }, { creditos: -5 }],
    });
    const saldo = await saldoCreditos("t1", db as never);
    expect(saldo).toBe(84);
  });
});

describe("CONFIG_PADRAO", () => {
  it("reflete as decisões do dono", () => {
    expect(CONFIG_PADRAO).toEqual({ markup: 10, fxUsdBrl: 6, valorCreditoBrl: 0.1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ia/metering.test.ts`
Expected: FAIL (módulo `./metering` não existe).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ia/metering.ts
import { crmDb } from "@/lib/crm/supabase-server";
import { custoUsdDeTokens, custoBrl, creditosDeCusto } from "./metering-calc";

type SupabaseLike = { from: (t: string) => any };

export type ConfigPreco = { markup: number; fxUsdBrl: number; valorCreditoBrl: number };
export const CONFIG_PADRAO: ConfigPreco = { markup: 10, fxUsdBrl: 6, valorCreditoBrl: 0.1 };

export type ConsumoInput = {
  tenantId: string;
  usuarioId?: string | null;
  origem: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  refTipo?: string | null;
  refId?: string | null;
};

export async function carregarConfigPreco(
  tenantId: string,
  db: SupabaseLike = crmDb(),
): Promise<ConfigPreco> {
  try {
    const { data } = await db
      .from("hub_ia_config")
      .select("escopo, tenant_id, markup, fx_usd_brl, valor_credito_brl")
      .or(`and(escopo.eq.tenant,tenant_id.eq.${tenantId}),escopo.eq.global`);
    const rows: any[] = Array.isArray(data) ? data : [];
    const cfg = rows.find((r) => r.escopo === "tenant") ?? rows.find((r) => r.escopo === "global");
    if (!cfg) return CONFIG_PADRAO;
    return {
      markup: Number(cfg.markup ?? CONFIG_PADRAO.markup),
      fxUsdBrl: Number(cfg.fx_usd_brl ?? CONFIG_PADRAO.fxUsdBrl),
      valorCreditoBrl: Number(cfg.valor_credito_brl ?? CONFIG_PADRAO.valorCreditoBrl),
    };
  } catch {
    return CONFIG_PADRAO;
  }
}

/** Best-effort: registra o consumo e o débito; nunca lança (não quebra o fluxo de IA). */
export async function registrarConsumoIA(
  p: ConsumoInput,
  db: SupabaseLike = crmDb(),
): Promise<{ creditos: number; custoBrl: number } | null> {
  try {
    const cfg = await carregarConfigPreco(p.tenantId, db);
    const usd = custoUsdDeTokens({
      modelo: p.modelo,
      tokensEntrada: p.tokensEntrada,
      tokensSaida: p.tokensSaida,
    });
    const brl = custoBrl(usd, cfg.fxUsdBrl, cfg.markup);
    const creditos = creditosDeCusto(brl, cfg.valorCreditoBrl);

    await db.from("hub_ia_consumo").insert({
      tenant_id: p.tenantId,
      usuario_id: p.usuarioId ?? null,
      origem: p.origem,
      modelo: p.modelo,
      tokens_entrada: p.tokensEntrada,
      tokens_saida: p.tokensSaida,
      custo_usd: usd,
      custo_brl: brl,
      creditos,
      ref_tipo: p.refTipo ?? null,
      ref_id: p.refId ?? null,
    });
    await db.from("hub_ia_creditos_mov").insert({
      tenant_id: p.tenantId,
      tipo: "debito",
      creditos: -creditos,
      descricao: `IA ${p.origem} (${p.modelo})`,
      ref_id: p.refId ?? null,
    });
    return { creditos, custoBrl: brl };
  } catch {
    return null;
  }
}

/** Saldo = soma de todos os movimentos da carteira do tenant. */
export async function saldoCreditos(tenantId: string, db: SupabaseLike = crmDb()): Promise<number> {
  try {
    const { data } = await db
      .from("hub_ia_creditos_mov")
      .select("creditos")
      .eq("tenant_id", tenantId);
    const rows: any[] = Array.isArray(data) ? data : [];
    return rows.reduce((s, r) => s + Number(r.creditos ?? 0), 0);
  } catch {
    return 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ia/metering.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/ia/metering.ts lib/ia/metering.test.ts
git commit -m "feat(ia): recorder de consumo + config + saldo (Fase 1, best-effort)"
```

---

### Task 4: Ligar a medição (sombra) no motor de IA

**Files:**
- Modify: `lib/ia/engine.ts` (após a chamada de completarChat que retorna tokens)

**Interfaces:**
- Consumes: `registrarConsumoIA` (Task 3); o resultado de `completarChatPreferindoMistral`/`completarChatComFerramentasMistral` (`{ ok, tokensEntrada, tokensSaida, modeloLog }`) e o `tenantId` do contexto.

- [ ] **Step 1: Localizar o ponto de medição**

Run: `rg -n "completarChatPreferindoMistral|completarChatComFerramentasMistral" lib/ia/engine.ts`
Ler o trecho onde a função retorna `ok: true` com `tokensEntrada`, `tokensSaida`, `modeloLog`, e onde o `tenantId` do contexto está disponível (`ctx.tenantId` / `contexto.tenantId`; usar `defaultTenantId()` como fallback — já importado no arquivo).

- [ ] **Step 2: Adicionar import**

No topo de `lib/ia/engine.ts`, junto aos imports de `./llm-completion`:
```ts
import { registrarConsumoIA } from "./metering";
```

- [ ] **Step 3: Inserir a medição best-effort logo após a resposta de IA**

Imediatamente após obter a resposta bem-sucedida do completarChat (onde `resp.ok === true`), adicionar (ajustar os nomes `resp`/`contexto` aos do arquivo):
```ts
// Metering (Fase 1, sombra): registra consumo sem bloquear o fluxo.
if (resp.ok) {
  void registrarConsumoIA({
    tenantId: contexto.tenantId ?? defaultTenantId(),
    usuarioId: contexto.pessoaId ?? null,
    origem: "chat_atendimento",
    modelo: resp.modeloLog,
    tokensEntrada: resp.tokensEntrada,
    tokensSaida: resp.tokensSaida,
    refTipo: "lead",
    refId: contexto.leadId ?? null,
  });
}
```
> `void` + função best-effort = não aguarda nem propaga erro. A IA responde igual.

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc limpo; 183 testes anteriores + os novos (Tasks 1 e 3) verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/ia/engine.ts
git commit -m "feat(ia): liga medição de consumo (sombra) no motor de IA (Fase 1)"
```

---

### Task 5: Rota de leitura — saldo + extrato de consumo

**Files:**
- Create: `app/api/crm/ia/creditos/route.ts`

**Interfaces:**
- Consumes: `saldoCreditos` (Task 3); guard `requireCrmGestor` + `crmDb` + `crmApiConfigError` (padrão das rotas CRM existentes — ver `app/api/crm/tenants/route.ts`).
- Produces: `GET /api/crm/ia/creditos` → `{ saldo: number, consumo: ConsumoRow[] }` (últimos 50, tenant-scoped).

- [ ] **Step 1: Escrever a rota**

```ts
// app/api/crm/ia/creditos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { crmApiConfigError, requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { saldoCreditos } from "@/lib/ia/metering";

export type ConsumoRow = {
  origem: string;
  modelo: string;
  creditos: number;
  custo_brl: number;
  criado_em: string;
};

export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;

  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const db = crmDb();
  const tenantId = g.ctx.tenantId;

  const saldo = await saldoCreditos(tenantId, db);

  const { data, error } = await db
    .from("hub_ia_consumo")
    .select("origem, modelo, creditos, custo_brl, criado_em")
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saldo, consumo: (data ?? []) as ConsumoRow[] });
}
```

- [ ] **Step 2: Gate**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc limpo; testes verdes.

- [ ] **Step 3: Verificar clicando (Playwright, logado como owner)**

1. Navegar até o app e disparar uma ação de IA (ex.: atendimento) para gerar 1 registro.
2. `fetch("/api/crm/ia/creditos", { headers: await crmApiHeaders() })` no console do navegador.
3. Expected: JSON com `saldo` (negativo no modo sombra, pois só há débitos) e `consumo` listando a ação com `origem`, `modelo`, `creditos`, `custo_brl`.

- [ ] **Step 4: Commit**

```bash
git add app/api/crm/ia/creditos/route.ts
git commit -m "feat(ia): rota GET /api/crm/ia/creditos (saldo + extrato) (Fase 1)"
```

---

## Self-Review

- **Spec coverage:** §4.2 (4 tabelas) → Task 2. §4.3 `metering.ts` (registrar/verificar/estimar) → Tasks 1+3 (estimar fica p/ Fase 2; registrar+saldo cobertos). §4.1 pedágio → Task 4 (recording; verificação de saldo/bloqueio = Fase 3). §3.1 fórmula créditos → Task 1. Rota saldo/extrato (§4.3) → Task 5. Fase 1 = medir + ledger + preços + config: coberto.
- **Placeholder scan:** sem TBD/TODO; todo passo tem código/comando concreto.
- **Type consistency:** `ConfigPreco`, `ConsumoInput`, `registrarConsumoIA`, `saldoCreditos`, `creditosDeCusto`, `custoUsdDeTokens`, `custoBrl` usados igual entre Tasks 1/3/4/5.
- **Fora da Fase 1 (próximas fases):** estimativa de custo na UI, carteira/widget, hard-cap/bloqueio, top-up via gateway, evento `hub_eventos`, painel de previsão — explicitamente diferidos.
