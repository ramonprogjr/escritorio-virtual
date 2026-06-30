# SEGURANÇA — H-SEC-1: NEXT_PUBLIC_INTERNAL_API_KEY exposta no browser

Data: 2026-06-30 · Severidade: BLOQUEADOR (multi-tenant) · Modo: READ-ONLY (nenhum código alterado)

Decisão do dono necessária antes de qualquer fix. Este documento registra a vulnerabilidade com
evidência arquivo:linha e descreve duas opções de correção validadas contra a arquitetura atual.

---

## Resumo executivo

A chave que protege TODAS as rotas `/api/**` não-públicas está embarcada no bundle JavaScript
do browser. Qualquer visitante anônimo extrai essa chave e chama qualquer endpoint interno com
poderes de service-role, sem sessão, sem log de usuário, sem filtro de tenant.

---

## Evidência — arquivo:linha

### 1. A chave é publicada no bundle do browser

`lib/internal-api-headers.ts` — linhas 7-10:
```ts
export function internalApiHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.NEXT_PUBLIC_INTERNAL_API_KEY ?? "",
  };
}
```

`NEXT_PUBLIC_*` é uma convenção Next.js que injeta o valor no bundle estático durante o build.
O browser recebe a chave em texto claro em `/_next/static/chunks/**.js`.

### 2. O gate do proxy aceita essa chave de qualquer origem

`proxy.ts` — linhas 98-103:
```ts
const validKey = process.env.INTERNAL_API_KEY;
const apiKey = request.headers.get("x-api-key");

if (validKey && apiKey === validKey) {
  return NextResponse.next();   // ← qualquer um que saiba a chave passa aqui
}
```

`README.md:40` e `.env.example:13` confirmam que `NEXT_PUBLIC_INTERNAL_API_KEY` e
`INTERNAL_API_KEY` DEVEM ter o mesmo valor. Logo, a chave do gate é a mesma que vai ao browser.

### 3. Endpoints de cotação chamam com a chave pública

`app/fornecedor/cotacao/page.tsx` — linhas 36, 51, 62, 85, 103, 115:
```ts
const res = await fetch("/api/cotacoes/pedidos", {
  headers: internalApiHeaders(),   // ← embarca NEXT_PUBLIC_INTERNAL_API_KEY
});
```

### 4. Os handlers não fazem auth própria

`app/api/cotacoes/pedidos/route.ts` — linhas 12-22 (GET) e 24-52 (POST):
```ts
export async function GET() {
  // Zero verificação de sessão, tenant ou chave no handler.
  const { data } = await supabase
    .from("hub_cotacoes_pedidos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json(data ?? []);
}
```

`app/api/cotacoes/pedidos/[id]/route.ts` — linhas 11-35:
```ts
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  // Sem verificação de a quem pertence o pedido. Service-role → bypassa RLS.
  const { data } = await supabase
    .from("hub_cotacoes_pedidos")
    .select("*, hub_cotacoes_respostas(*)")
    .eq("id", params.id)
    .single();
  return NextResponse.json(data);
}
```

O `supabase` nesses handlers usa `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS por definição).

### 5. Risco registrado previamente na base de conhecimento

`docs/_rumo-memoria/multitenant-golive-plano.md:14` já apontava:
> "furo do x-tenant-id forjável (latente hoje)"

A blindagem aplicada em 28/jun (`lib/tenant-default.ts:70-87`) protege `x-tenant-id` forjado
via header, mas NÃO protege contra o uso direto da `INTERNAL_API_KEY` exposta no browser —
que bypassa `tenantIdFromRequest` por completo ao chamar o handler sem passar pelo guard.

---

## Impacto concreto

| Cenário | Consequência |
|---|---|
| Usuário anônimo extrai a chave do bundle JS | Chama GET /api/cotacoes/pedidos → recebe as 50 cotações mais recentes de TODOS os tenants |
| Fornece ID válido em GET /api/cotacoes/pedidos/[id] | Recebe cotação completa + todas as respostas de fornecedores, incluindo valores e prazos |
| POST /api/cotacoes/pedidos sem sessão | Cria pedidos falsos com tenant_id default; polui dados operacionais |
| Em multi-tenant: dois tenants ativos | Vazamento cross-tenant direto — violação de isolamento contratual |
| Sem rate-limit nos endpoints de cotação | Enumeração e scraping automático sem custo |

---

## Opções de correção (para decisão do dono)

### Opção A — Correção de raiz: telas internas autenticam por sessão (RECOMENDADA)

**Princípio:** o proxy já aceita cookie de sessão CRM (`proxy.ts:105`). Telas internas
(cotação, etc.) devem usar a sessão por cookie em vez de `NEXT_PUBLIC_INTERNAL_API_KEY`.

**Mudanças necessárias:**

1. Remover `internalApiHeaders()` das chamadas fetch nas telas internas (`/fornecedor/cotacao/page.tsx`
   e similares). Basta remover o cabeçalho `x-api-key` — o cookie de sessão já é enviado
   automaticamente pelo browser para o mesmo domínio.

2. Adicionar guard de sessão em cada handler `/api/cotacoes/**`:
   ```ts
   // Exemplo de guard aditivo no handler
   import { fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";
   import { CRM_ACCESS_COOKIE } from "@/lib/auth/crm-session";
   import { cookies } from "next/headers";

   export async function GET() {
     const jar = await cookies();
     const token = jar.get(CRM_ACCESS_COOKIE)?.value;
     if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
     const user = await fetchAuthUserFromAccessToken(token);
     if (!user) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
     // derivar tenantId do usuário autenticado, não de defaultTenantId()
     // ...resto do handler com .eq("tenant_id", tenantId)
   }
   ```

3. Reservar `INTERNAL_API_KEY` / `NEXT_PUBLIC_INTERNAL_API_KEY` SOMENTE para cron e workers
   server-to-server (que nunca vão ao browser). A variável `NEXT_PUBLIC_*` pode ser removida
   do ambiente de produção.

**Esforço estimado:** médio (1 sessão). Aditivo, sem quebrar cron/workers existentes.
**Risco de regressão:** baixo se feito endpoint por endpoint com tsc passando a cada passo.

---

### Opção B — Mitigação parcial: guard de tenant no handler (sem mudar a arquitetura de chave)

Se a decisão for manter `NEXT_PUBLIC_INTERNAL_API_KEY` por ora, adicionar guard mínimo nos handlers:

```ts
// Em cada handler de cotação:
const tenantId = defaultTenantId();           // continua como hoje
// Adicionar filtro obrigatório em TODO select:
.eq("tenant_id", tenantId)
// Adicionar rate-limit:
const rl = checkPortalVerifyRateLimit(`cotacao:${ip}`, 20, 60_000);
if (!rl.ok) return NextResponse.json({ error: "Rate limit" }, { status: 429 });
```

**Limitação:** não elimina o risco — qualquer um com a chave ainda acessa. Só limita abuso
casual e isola por tenant (com valor padrão fixo em single-tenant, funciona; em multi-tenant
precisa derivar o tenant da chave/sessão de outra forma).

**Recomendação:** usar Opção B como patch imediato enquanto Opção A é planejada, mas NÃO como
solução definitiva antes do go-live multi-tenant.

---

## Arquitetura de referência (já correta no projeto)

O portal do parceiro (`lib/parceiro-portal.ts:12-19`) usa HMAC-SHA256 com `crypto.timingSafeEqual`
e o secret NUNCA vai ao browser — é o padrão correto para tokens públicos verificáveis.
Telas internas autenticadas devem usar sessão (cookie httpOnly), não uma chave pública.

---

## O que NÃO foi alterado

Nenhum arquivo de código foi modificado por este documento. As vulnerabilidades permanecem
até decisão e implementação pelo dono/time. Os handlers `/api/cotacoes/**` e
`lib/internal-api-headers.ts` estão intactos.

---

## Próximo passo

1. Dono decide: Opção A (raiz) ou Opção B (mitigação)?
2. Se Opção A: iniciar por `/api/cotacoes/pedidos/route.ts` + remover `internalApiHeaders()`
   de `app/fornecedor/cotacao/page.tsx`. Gate: tsc 0 + vitest verde + teste manual em incógnito.
3. Registrar decisão em `docs/DECISIONS.md` e claude-mem.
