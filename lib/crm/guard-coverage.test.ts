import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * REGRESSION GATE (Batch 5 → refatorado por-MÉTODO): `proxy.ts` é o middleware do Next 16
 * (renomeação middleware->proxy), VIVO — mas só faz auth GROSSA ("tem sessão?"); os guards
 * por-rota são a autz real. Cada rota `/api/**` só é isolada por sessão/role/tenant se o
 * PRÓPRIO handler chamar um guard.
 *
 * ANTES este teste checava o guard no ARQUIVO inteiro — um GET público "cobria" o PATCH
 * ao lado, escondendo métodos sem guard (falso negativo). Agora ele FATIA cada método
 * exportado (GET/POST/PUT/PATCH/DELETE) e exige um marcador de guard DENTRO do corpo
 * daquele método específico.
 *
 * Como manter:
 *  - Método novo com service-role → chame um dos guards de GUARD_RE no corpo dele.
 *  - Arquivo inteiro legitimamente público (formulário/webhook/cron) → PUBLIC_ALLOWLIST.
 *  - Um ÚNICO método público num arquivo que mistura handler privado e público →
 *    PUBLIC_METHOD_ALLOWLIST ("rel :: METHOD"), com justificativa da proteção própria
 *    (rate-limit / HMAC / tenant forçado).
 *  - NUNCA allowliste só para "fazer passar" sem confirmar a proteção própria.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const API_DIR = path.join(ROOT, "app", "api");

/**
 * Detecta uso do client Supabase privilegiado (service-role — bypassa RLS).
 * Inclui `crmHandoffDb(` (helper de atendimento que constrói o client service-role
 * internamente) — sem ele, uma rota nova que só usa crmHandoffDb escaparia do gate
 * (falso negativo apontado pela auditoria adversarial do Batch 5).
 */
const SERVICE_ROLE_RE =
  /SUPABASE_SERVICE_ROLE_KEY|crmDb\s*\(|crmHandoffDb\s*\(|crmSupabaseAdmin|supabaseAdmin|createClient\([^)]*SERVICE_ROLE/;

/**
 * Guards reconhecidos como suficientes. Inclui os guards de sessão/role do CRM
 * (lib/crm/crm-api-auth.ts), o guard de cron (lib/cron-auth.ts), o guard HMAC do copiloto
 * (lib/copiloto/copiloto-auth.ts) e o padrão inline de CRON_SECRET/INTERNAL_API_KEY usado
 * em rotas de cron/ML que ainda não migraram para `cronRequestAuthorized`/`requireInternalApiKey`.
 */
const GUARD_RE =
  /requireCrmSessao|requireCrmComercial|requireCrmGestor|requireCrmAprovador|requireCrmOwner|requireCrmFinanceiro|requireCrmAdmin|getCallerContext|requireInternalApiKey|cronRequestAuthorized|resolveCallerAuthId|autenticarCopiloto|CRON_SECRET|INTERNAL_API_KEY/;

/**
 * Allowlist de ARQUIVOS que usam service-role SEM os guards acima — cada um é público por
 * design ou tem proteção própria (assinatura/HMAC). TODOS os métodos do arquivo são
 * dispensados. Espelha `isPublicApiPath` de proxy.ts + confirmação manual (Batch 5, 01/jul).
 */
const PUBLIC_ALLOWLIST: string[] = [
  // --- espelha isPublicApiPath() do proxy.ts ---
  "app/api/whatsapp/webhook/route.ts", // HMAC SHA-256 próprio (WEBHOOK_SECRET) — verificado no handler
  "app/api/parceiros/portal/verify/route.ts", // link assinado (HMAC) verificado no handler
  "app/api/parceiro/cadastro-publico/route.ts", // cadastro público via link da rede; rate-limit no handler (H-SEC-2)
  "app/api/public/cadastro-empresa/route.ts", // formulário público de cadastro de empresa
  "app/api/public/especialista/route.ts", // formulário público de cadastro de especialista
  "app/api/public/lead-hub/route.ts", // formulário público de captação de lead

  // --- validação de documento, sem dado sensível de tenant ---
  "app/api/validar/cnpj/route.ts",
  "app/api/validar/cpf/route.ts",

  "app/api/auth/crm-session/route.ts", // login: emite a própria sessão, não pode exigir sessão prévia

  "app/api/crm/consultar-cnpj/route.ts", // consulta pública de CNPJ; rate-limit próprio no handler
  "app/api/health/route.ts", // guard owner-only próprio (não é um dos guards padrão do CRM)
];

/**
 * Allowlist por MÉTODO ("rel :: METHOD"): um handler específico legitimamente público dentro
 * de um arquivo que também tem handlers privados. Cada entrada precisa de proteção própria.
 */
const PUBLIC_METHOD_ALLOWLIST: string[] = [
  // Captação PÚBLICA (Hub-only): rate-limit anti-spam por IP (rateLimitExcedido) + tenant
  // SEMPRE defaultTenantId() (nunca do header, que é forjável). O GET irmão é gated por
  // requireCrmSessao; só o POST de captação é público por design.
  "app/api/crm/fornecedores/route.ts :: POST",
  "app/api/parceiros/route.ts :: POST",
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

/**
 * Extrai o corpo `{...}` de cada handler exportado como FUNÇÃO
 * (`export async function GET(...) {...}`). Scanner ciente de strings/template-literals e
 * comentários — chaves/parênteses dentro deles não confundem a contagem. Aliases do tipo
 * `export const GET = POST` não são handlers próprios: apontam para uma função já coberta.
 */
function extractHandlerBodies(content: string): Record<string, string> {
  const bodies: Record<string, string> = {};
  const declRe = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(content)) !== null) {
    const method = m[1];
    let i = declRe.lastIndex; // logo após o "(" da lista de parâmetros
    let str: string | null = null;
    let line = false;
    let block = false;

    // Fase 1 — fechar a lista de parâmetros (1 "(" já aberto). Necessário porque a
    // assinatura pode conter `{ params }` (chaves que NÃO são o corpo).
    let paren = 1;
    for (; i < content.length && paren > 0; i++) {
      const c = content[i];
      const prev = content[i - 1];
      if (line) { if (c === "\n") line = false; continue; }
      if (block) { if (c === "*" && content[i + 1] === "/") { block = false; i++; } continue; }
      if (str) { if (c === str && prev !== "\\") str = null; continue; }
      if (c === "/" && content[i + 1] === "/") { line = true; i++; continue; }
      if (c === "/" && content[i + 1] === "*") { block = true; i++; continue; }
      if (c === '"' || c === "'" || c === "`") { str = c; continue; }
      if (c === "(") paren++;
      else if (c === ")") paren--;
    }

    // Fase 2 — achar o "{" que abre o corpo (pula um eventual retorno de tipo).
    for (; i < content.length; i++) {
      const c = content[i];
      if (line) { if (c === "\n") line = false; continue; }
      if (block) { if (c === "*" && content[i + 1] === "/") { block = false; i++; } continue; }
      if (c === "/" && content[i + 1] === "/") { line = true; i++; continue; }
      if (c === "/" && content[i + 1] === "*") { block = true; i++; continue; }
      if (c === "{") break;
    }
    const open = i;

    // Fase 3 — casar chaves até fechar o corpo.
    let brace = 0;
    for (; i < content.length; i++) {
      const c = content[i];
      const prev = content[i - 1];
      if (line) { if (c === "\n") line = false; continue; }
      if (block) { if (c === "*" && content[i + 1] === "/") { block = false; i++; } continue; }
      if (str) { if (c === str && prev !== "\\") str = null; continue; }
      if (c === "/" && content[i + 1] === "/") { line = true; i++; continue; }
      if (c === "/" && content[i + 1] === "*") { block = true; i++; continue; }
      if (c === '"' || c === "'" || c === "`") { str = c; continue; }
      if (c === "{") brace++;
      else if (c === "}") { brace--; if (brace === 0) { i++; break; } }
    }
    bodies[method] = content.slice(open, i);
  }
  return bodies;
}

describe("guard-coverage — nenhum método /api com service-role fica sem guard", () => {
  const files = listRouteFiles(API_DIR, []);

  it("varreu pelo menos as rotas conhecidas de app/api/hub e app/api/crm", () => {
    const rels = files.map(toRel);
    expect(rels.some(r => r.startsWith("app/api/hub/"))).toBe(true);
    expect(rels.some(r => r.startsWith("app/api/crm/"))).toBe(true);
    expect(files.length).toBeGreaterThan(100);
  });

  it("CADA método handler de rota service-role tem guard no próprio corpo (ou está allowlisted)", () => {
    const offenders: string[] = [];
    let methodsChecked = 0;

    for (const abs of files) {
      const rel = toRel(abs);
      const content = readFileSync(abs, "utf8");

      if (!SERVICE_ROLE_RE.test(content)) continue; // arquivo não toca client privilegiado
      if (PUBLIC_ALLOWLIST.includes(rel)) continue; // arquivo inteiro público/proteção própria

      const bodies = extractHandlerBodies(content);
      const methodNames = Object.keys(bodies);

      // Rede de segurança: se nenhum handler-FUNÇÃO foi extraído (ex.: arquivo exótico só com
      // arrows), cai no check de ARQUIVO — nunca mais fraco que o gate original.
      if (methodNames.length === 0) {
        methodsChecked += 1;
        if (!GUARD_RE.test(content)) offenders.push(`${rel} :: (arquivo inteiro)`);
        continue;
      }

      for (const method of methodNames) {
        const key = `${rel} :: ${method}`;
        if (PUBLIC_METHOD_ALLOWLIST.includes(key)) continue;
        methodsChecked += 1;
        if (!GUARD_RE.test(bodies[method])) offenders.push(key);
      }
    }

    // Sanidade: se isto cair, o extrator ou o SERVICE_ROLE_RE provavelmente quebrou.
    expect(methodsChecked).toBeGreaterThan(100);

    if (offenders.length > 0) {
      throw new Error(
        `${offenders.length} método(s) usam client service-role SEM guard reconhecido no ` +
          `próprio corpo e NÃO estão allowlisted:\n  - ${offenders.join("\n  - ")}\n\n` +
          `Corrija chamando um guard (requireCrm*/getCallerContext/cronRequestAuthorized/...) ` +
          `DENTRO do método, OU — se o método é legitimamente público/tem proteção própria — ` +
          `adicione "rel :: METODO" a PUBLIC_METHOD_ALLOWLIST (ou o arquivo a PUBLIC_ALLOWLIST) ` +
          `em lib/crm/guard-coverage.test.ts, com um comentário justificando.`
      );
    }
  });

  it("PUBLIC_ALLOWLIST não contém entradas obsoletas (arquivo precisa existir e ainda usar service-role)", () => {
    const existing = new Set(files.map(toRel));
    const stale = PUBLIC_ALLOWLIST.filter(rel => !existing.has(rel));
    expect(stale).toEqual([]);
  });

  it("PUBLIC_METHOD_ALLOWLIST não contém entradas obsoletas (método existe e ainda dispensa guard)", () => {
    const stale: string[] = [];
    for (const entry of PUBLIC_METHOD_ALLOWLIST) {
      const [rel, method] = entry.split(" :: ");
      const abs = path.join(ROOT, rel);
      let content: string;
      try {
        content = readFileSync(abs, "utf8");
      } catch {
        stale.push(`${entry} (arquivo ausente)`);
        continue;
      }
      const bodies = extractHandlerBodies(content);
      if (!(method in bodies)) {
        stale.push(`${entry} (método ausente)`);
        continue;
      }
      // Se o método passou a ter guard próprio, a exceção virou desnecessária → remova.
      if (GUARD_RE.test(bodies[method])) stale.push(`${entry} (método já tem guard — remova a exceção)`);
    }
    expect(stale).toEqual([]);
  });
});
