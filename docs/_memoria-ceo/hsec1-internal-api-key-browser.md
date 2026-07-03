---
name: hsec1-internal-api-key-browser
description: "H-SEC-1 (auditoria E2E Domínio H, 30/jun) CONFIRMADO no código: NEXT_PUBLIC_INTERNAL_API_KEY + NEXT_PUBLIC_TENANT_ID vão ao BROWSER (lib/internal-api-headers.ts:7-14) e as rotas /api/cotacoes/** usam service-role (bypassa RLS) gateadas só por essa chave pública → anônimo lê/escreve cotações (cross-tenant quando multi-tenant existir). É a #1 de segurança. DECISÃO ARQUITETURAL DO DONO: trocar por signed-link HMAC (como lib/parceiro-portal.ts já faz) OU sessão, tirando a chave do browser. NÃO corrigido às pressas (quebraria o portal do fornecedor)"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**H-SEC-1 — vuln CONFIRMADA (auditoria E2E Domínio H, 30/jun). #1 de segurança.** Doc: `docs/E2E-DOMINIO-H-ACHADOS.md` + `docs/SEGURANCA-H-SEC-1.md`.

**O furo:** `lib/internal-api-headers.ts:7-14` — no browser, manda `x-api-key = NEXT_PUBLIC_INTERNAL_API_KEY` e `x-tenant-id = NEXT_PUBLIC_TENANT_ID`. Como `NEXT_PUBLIC_*` está no bundle, a "chave interna" NÃO é segredo. As rotas `/api/cotacoes/pedidos/**` usam `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS) e não têm auth de handler — o gate é só o proxy via x-api-key (pública). → **qualquer anônimo extrai a chave do bundle e lê/escreve cotações**; com x-tenant-id forjável, cross-tenant quando o multi-tenant existir. Hoje single-tenant (defaultTenantId) limita o dano, mas a exposição da cotação do tenant default é real HOJE.

**DECISÃO DO DONO (arquitetural — não corrigir às pressas, quebraria o portal do fornecedor):**
- **Recomendação:** trocar o gate das telas/portais públicos por **signed-link HMAC** (o `lib/parceiro-portal.ts` JÁ faz isso certo — HMAC-SHA256 + timingSafeEqual + rate-limit) OU sessão; **tirar `NEXT_PUBLIC_INTERNAL_API_KEY`/`NEXT_PUBLIC_TENANT_ID` do browser**; nas rotas service-role, derivar o tenant do RECURSO (cotação→fornecedor→tenant), nunca do header.
- Liga [[tenant-null-leak-pattern]], [[multitenant-golive-plano]] (mesmo eixo: confiança no que vem do cliente). É HARD-GATE do multi-tenant + exposição já hoje.

**Fixes seguros AUTÔNOMOS feitos na mesma auditoria** (não tocam essa arquitetura): H-FUN-1 (rota pública do parceiro no isPublicApiPath + rate-limit), H-SEC-2 (rate-limit cadastro parceiro), H-SEC-3 (assinar `por`), H-UX-1 (PT-PT→PT-BR), H-A11Y-1 (labels). **WHY:** exposição de dado real + o pior achado da noite; mas o fix certo é decisão de arquitetura/produto do dono.
