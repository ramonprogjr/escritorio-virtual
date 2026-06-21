/**
 * Verificação automática do Progresso sistema — roda no deploy (npm run verify:progresso).
 * Gera lib/crm/progresso-verificacao.generated.json
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  deriveStatusFromChecks,
  getDeployChecksRegistry,
  getProgressoChecksRegistry,
} from "../lib/crm/progresso-checks-registry";
import { allProgressoItens, DEPLOY_CHECKLIST } from "../lib/crm/progresso-sistema-data";
import type {
  ProgressoCheckDef,
  ProgressoCheckResult,
  ProgressoItemVerificacao,
  ProgressoVerificacaoArtifact,
} from "../lib/crm/progresso-checks-types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const out: Record<string, string> = {};
  for (const name of [".env", ".env.local"]) {
    const path = resolve(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      let val = t.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[t.slice(0, i).trim()] = val;
    }
  }
  return { ...out, ...process.env } as Record<string, string>;
}

const env = loadEnv();
if (!env.STRICT_TLS) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const baseUrl = (
  env.PROGRESSO_VERIFY_BASE_URL ||
  env.BASE_URL ||
  env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3001"
).replace(/\/+$/, "");

const apiKey = env.INTERNAL_API_KEY?.trim() || env.NEXT_PUBLIC_INTERNAL_API_KEY?.trim();

let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && serviceKey) {
  supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function resolvePath(rel: string): string {
  const p = resolve(root, rel);
  if (existsSync(p)) return p;
  const asFile = `${p}.ts`;
  if (existsSync(asFile)) return asFile;
  const asTsx = `${p}.tsx`;
  if (existsSync(asTsx)) return asTsx;
  const asRoute = join(p, "route.ts");
  if (existsSync(asRoute)) return asRoute;
  return p;
}

function grepInPath(relPath: string, pattern: string, flags = "i"): boolean {
  const full = resolvePath(relPath);
  const re = new RegExp(pattern, flags);
  if (!existsSync(full)) {
    if (relPath.includes("migrations") && !relPath.endsWith(".sql")) {
      const dir = resolve(root, "supabase/migrations");
      if (!existsSync(dir)) return false;
      return readdirSync(dir).some((f) => re.test(f));
    }
    return false;
  }
  if (statSync(full).isDirectory()) {
    return readdirSync(full).some((f) => re.test(f));
  }
  const content = readFileSync(full, "utf8");
  return re.test(content);
}

async function runCheck(def: ProgressoCheckDef): Promise<ProgressoCheckResult> {
  const required = def.required ?? true;
  try {
    switch (def.type) {
      case "manual":
        return {
          id: def.id,
          ok: true,
          detail: `status manual: ${def.manualStatus ?? "legado"}`,
          required,
        };
      case "file_exists": {
        const paths = def.paths ?? (def.path ? [def.path] : []);
        const ok = paths.some((p) => existsSync(resolvePath(p)));
        return { id: def.id, ok, detail: ok ? paths.join(", ") : `ausente: ${paths.join(", ")}`, required };
      }
      case "grep": {
        const path = def.path ?? "";
        const ok = grepInPath(path, def.pattern ?? "", def.flags ?? "i");
        return {
          id: def.id,
          ok,
          detail: ok ? `encontrado em ${path}` : `padrão não encontrado em ${path}`,
          required,
        };
      }
      case "supabase_table": {
        if (!supabase) return { id: def.id, ok: false, detail: "Supabase não configurado", required };
        const { error } = await supabase.from(def.table!).select("id").limit(1);
        const ok = !error;
        return { id: def.id, ok, detail: ok ? `tabela ${def.table}` : error?.message ?? "erro", required };
      }
      case "supabase_column": {
        if (!supabase) return { id: def.id, ok: false, detail: "Supabase não configurado", required };
        const { error } = await supabase.from(def.table!).select(def.column!).limit(1);
        const ok = !error;
        return {
          id: def.id,
          ok,
          detail: ok ? `coluna ${def.table}.${def.column}` : error?.message ?? "erro",
          required,
        };
      }
      case "env": {
        const val = env[def.env!]?.trim() ?? "";
        const ok = def.equals ? val.toLowerCase() === def.equals.toLowerCase() : val.length > 0;
        return {
          id: def.id,
          ok,
          detail: ok ? `${def.env}=${val || "(set)"}` : `${def.env} não definido ou diferente`,
          required,
        };
      }
      case "http": {
        const url = `${baseUrl}${def.url}`;
        const headers: Record<string, string> = {};
        if (apiKey) headers["x-api-key"] = apiKey;
        try {
          const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
          let ok = res.ok;
          let detail = `HTTP ${res.status} ${url}`;
          if (ok && def.jsonMinLength != null) {
            const json = await res.json().catch(() => null);
            const len = Array.isArray(json?.data) ? json.data.length : Array.isArray(json) ? json.length : 0;
            ok = len >= def.jsonMinLength;
            detail = ok ? `${len} registos em ${def.url}` : `JSON vazio em ${def.url}`;
          }
          return { id: def.id, ok, detail, required };
        } catch (e) {
          return {
            id: def.id,
            ok: false,
            detail: `fetch falhou (${url}): ${e instanceof Error ? e.message : String(e)}`,
            required,
          };
        }
      }
      default:
        return { id: def.id, ok: false, detail: "tipo desconhecido", required };
    }
  } catch (e) {
    return {
      id: def.id,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      required,
    };
  }
}

function oQueFaltaFromChecks(checks: ProgressoCheckResult[], fallback: string): string {
  const failed = checks.filter((c) => !c.ok);
  if (failed.length === 0) return "—";
  if (fallback && fallback !== "—") return fallback;
  return failed.map((c) => c.detail).slice(0, 2).join("; ");
}

async function verifyItem(
  itemId: string,
  defs: ProgressoCheckDef[],
  fallbackFalta: string
): Promise<ProgressoItemVerificacao> {
  const manual = defs.find((d) => d.type === "manual");
  const results: ProgressoCheckResult[] = [];
  for (const def of defs) {
    results.push(await runCheck(def));
  }
  const status = deriveStatusFromChecks(results, manual?.manualStatus);
  return {
    status,
    checks: results,
    oQueFalta: status === "ok" ? "—" : oQueFaltaFromChecks(results, fallbackFalta),
  };
}

async function main() {
  const itemRegistry = getProgressoChecksRegistry();
  const deployRegistry = getDeployChecksRegistry();
  const metaById = Object.fromEntries(allProgressoItens().map((i) => [i.id, i]));

  const itens: Record<string, ProgressoItemVerificacao> = {};
  for (const [id, defs] of Object.entries(itemRegistry)) {
    itens[id] = await verifyItem(id, defs, metaById[id]?.oQueFalta ?? "—");
  }

  const deploy: ProgressoVerificacaoArtifact["deploy"] = {};
  for (const row of DEPLOY_CHECKLIST) {
    const defs = deployRegistry[row.id] ?? [];
    const results: ProgressoCheckResult[] = [];
    for (const def of defs) results.push(await runCheck(def));
    const ok = results.length > 0 && results.every((r) => r.ok);
    deploy[row.id] = {
      id: row.id,
      ok,
      detail: ok ? "OK" : results.filter((r) => !r.ok).map((r) => r.detail).join("; ") || "sem checks",
    };
  }

  const artifact: ProgressoVerificacaoArtifact = {
    geradoEm: new Date().toISOString(),
    ambiente: env.RENDER ? "render-build" : env.NODE_ENV === "production" ? "production" : "local",
    itens,
    deploy,
  };

  const outPath = resolve(root, "lib/crm/progresso-verificacao.generated.json");
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  const stats = Object.values(itens);
  const ok = stats.filter((s) => s.status === "ok").length;
  const parcial = stats.filter((s) => s.status === "parcial").length;
  const gap = stats.filter((s) => s.status === "gap").length;
  console.log(`\n[verify:progresso] ${artifact.geradoEm}`);
  console.log(`  Base URL HTTP: ${baseUrl}`);
  console.log(`  Itens: ok=${ok} parcial=${parcial} gap=${gap} total=${stats.length}`);
  console.log(`  Deploy checks: ${Object.values(deploy).filter((d) => d.ok).length}/${DEPLOY_CHECKLIST.length}`);
  console.log(`  Artefato: ${outPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
