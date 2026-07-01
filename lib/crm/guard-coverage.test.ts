import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * REGRESSION GATE (Batch 5): o middleware de auth é MORTO — `proxy.ts` (matcher completo)
 * nunca roda no runtime do Next (só `middleware.ts` na raiz roda; não existe). Cada rota
 * `/api/**` só é protegida se o PRÓPRIO handler chamar um guard. Batches 1-4 fecharam as
 * rotas que nasceram sem guard; este teste existe para que NENHUMA rota nova repita o erro:
 * se um handler usa o client privilegiado (service-role — bypassa RLS) e NÃO chama nenhum
 * guard reconhecido, o teste falha, apontando o arquivo exato.
 *
 * Como manter:
 *  - Rota nova com service-role → chame um dos guards de GUARD_MARKERS (ou HMAC/CRON_SECRET
 *    equivalente reconhecido abaixo).
 *  - Rota nova legitimamente pública/cron (formulário público, webhook com assinatura própria,
 *    cron server-to-server) → adicione UMA entrada explícita e comentada em PUBLIC_ALLOWLIST,
 *    justificando por que dispensa guard de sessão.
 *  - NUNCA adicione uma rota à allowlist só para "fazer o teste passar" sem confirmar que ela
 *    tem proteção própria (rate-limit, HMAC, cron secret) ou é dado público por design.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const API_DIR = path.join(ROOT, "app", "api");

/** Detecta uso do client Supabase privilegiado (service-role — bypassa RLS). */
const SERVICE_ROLE_RE =
  /SUPABASE_SERVICE_ROLE_KEY|crmDb\s*\(|crmSupabaseAdmin|supabaseAdmin|createClient\([^)]*SERVICE_ROLE/;

/**
 * Guards reconhecidos como suficientes. Inclui os guards de sessão/role do CRM
 * (lib/crm/crm-api-auth.ts), o guard de cron (lib/cron-auth.ts), o guard HMAC do copiloto
 * (lib/copiloto/copiloto-auth.ts) e o padrão inline de CRON_SECRET/INTERNAL_API_KEY usado
 * em rotas de cron/ML que ainda não migraram para `cronRequestAuthorized`/`requireInternalApiKey`.
 */
const GUARD_RE =
  /requireCrmSessao|requireCrmComercial|requireCrmGestor|requireCrmOwner|requireCrmFinanceiro|requireCrmAdmin|getCallerContext|requireInternalApiKey|cronRequestAuthorized|resolveCallerAuthId|autenticarCopiloto|CRON_SECRET|INTERNAL_API_KEY/;

/**
 * Allowlist explícita de rotas que usam service-role SEM os guards acima — cada uma tem
 * proteção própria (assinatura/HMAC) ou é intencionalmente pública. Espelha `isPublicApiPath`
 * de proxy.ts (que nunca roda, mas documenta a intenção original) + confirmação manual de cada
 * handler nesta auditoria (Batch 5, 01/jul).
 */
const PUBLIC_ALLOWLIST: string[] = [
  // --- espelha isPublicApiPath() do proxy.ts (morto, mas documenta a intenção) ---
  "app/api/whatsapp/webhook/route.ts", // HMAC SHA-256 próprio (WEBHOOK_SECRET) — verificado no handler
  "app/api/parceiros/portal/verify/route.ts", // link assinado (HMAC) verificado no handler
  "app/api/parceiro/cadastro-publico/route.ts", // cadastro público via link da rede; rate-limit no handler (H-SEC-2)
  "app/api/public/cadastro-empresa/route.ts", // formulário público de cadastro de empresa
  "app/api/public/especialista/route.ts", // formulário público de cadastro de especialista
  "app/api/public/lead-hub/route.ts", // formulário público de captação de lead

  // --- validação de documento, sem dado sensível de tenant ---
  "app/api/validar/cnpj/route.ts",
  "app/api/validar/cpf/route.ts",

  // --- cron/ciclos: usam CRON_SECRET/x-vercel-cron (cronRequestAuthorized) — casado pelo GUARD_RE ---
  // (ciclos/*, cron/*, ml/ciclo já batem no GUARD_RE por usarem CRON_SECRET/INTERNAL_API_KEY
  //  ou cronRequestAuthorized diretamente; mantidos aqui só como documentação, não são necessários
  //  para o teste passar.)

  "app/api/auth/crm-session/route.ts", // login: emite a própria sessão, não pode exigir sessão prévia

  "app/api/crm/consultar-cnpj/route.ts", // consulta pública de CNPJ; rate-limit próprio no handler
  "app/api/health/route.ts", // guard owner-only próprio (não é um dos guards padrão do CRM)
];

function listRouteFiles(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      listRouteFiles(full, out);
    } else if (entry === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

function toRel(absPath: string): string {
  return path.relative(ROOT, absPath).replace(/\\/g, "/");
}

describe("guard-coverage — nenhuma rota /api com service-role nasce sem guard", () => {
  const files = listRouteFiles(API_DIR, []);

  it("varreu pelo menos as rotas conhecidas de app/api/hub e app/api/crm", () => {
    const rels = files.map(toRel);
    expect(rels.some(r => r.startsWith("app/api/hub/"))).toBe(true);
    expect(rels.some(r => r.startsWith("app/api/crm/"))).toBe(true);
    expect(files.length).toBeGreaterThan(100);
  });

  it("toda rota que usa client service-role tem guard OU está na allowlist explícita e justificada", () => {
    const offenders: string[] = [];
    let serviceRoleCount = 0;

    for (const abs of files) {
      const rel = toRel(abs);
      const content = readFileSync(abs, "utf8");

      const usesServiceRole = SERVICE_ROLE_RE.test(content);
      if (!usesServiceRole) continue;
      serviceRoleCount += 1;

      const hasGuard = GUARD_RE.test(content);
      const isAllowlisted = PUBLIC_ALLOWLIST.includes(rel);

      if (!hasGuard && !isAllowlisted) {
        offenders.push(rel);
      }
    }

    // Sanidade: se isto disparar, o regex de detecção de service-role provavelmente quebrou
    // (ex.: alguém renomeou crmDb ou mudou o padrão de import) — ajuste SERVICE_ROLE_RE.
    expect(serviceRoleCount).toBeGreaterThan(100);

    if (offenders.length > 0) {
      throw new Error(
        `${offenders.length} rota(s) usam client service-role SEM guard reconhecido e NÃO estão ` +
          `na allowlist:\n  - ${offenders.join("\n  - ")}\n\n` +
          `Corrija adicionando um guard (requireCrm*/getCallerContext/cronRequestAuthorized/...) ` +
          `ao handler, OU — se a rota é legitimamente pública/tem proteção própria — adicione-a a ` +
          `PUBLIC_ALLOWLIST em lib/crm/guard-coverage.test.ts com um comentário justificando.`
      );
    }
  });

  it("PUBLIC_ALLOWLIST não contém entradas obsoletas (arquivo precisa existir e ainda usar service-role)", () => {
    const existing = new Set(files.map(toRel));
    const stale = PUBLIC_ALLOWLIST.filter(rel => !existing.has(rel));
    expect(stale).toEqual([]);
  });
});
