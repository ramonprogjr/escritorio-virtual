/**
 * Smoke CRM go-live: módulos de cadastro, pipeline, distribuição e APIs.
 * Uso: node scripts/verify-crm-golive.mjs
 * Requer: .env.local + servidor em BASE_URL (default http://localhost:3001)
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const out = {};
  for (const name of [".env", ".env.local"]) {
    const path = resolve(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const base = (env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const headers = {};
if (env.INTERNAL_API_KEY || env.NEXT_PUBLIC_INTERNAL_API_KEY) {
  headers["x-api-key"] = env.INTERNAL_API_KEY || env.NEXT_PUBLIC_INTERNAL_API_KEY;
}

const checks = [];

async function run(id, fn) {
  try {
    const detail = await fn();
    checks.push({ id, ok: true, detail });
    console.log(`✓ ${id}: ${detail}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    checks.push({ id, ok: false, detail: msg });
    console.log(`✗ ${id}: ${msg}`);
  }
}

await run("modulos-crm-existem", async () => {
  const files = [
    "lib/crm/distribuir-lead.ts",
    "lib/crm/sugerir-encaminhamento-auto.ts",
    "lib/crm/notificar-parceiro-lead.ts",
    "lib/crm/resolve-pipeline.ts",
    "lib/crm/pessoa-empresa-vinculo.ts",
    "app/api/crm/encaminhamentos/pendentes/route.ts",
    "app/api/crm/encaminhamentos/[id]/aprovar/route.ts",
    "app/api/crm/distribuicao/sugerir/route.ts",
  ];
  for (const f of files) {
    if (!existsSync(resolve(root, f))) throw new Error(`Ficheiro em falta: ${f}`);
  }
  return `${files.length} módulos presentes`;
});

await run("api-pipelines-lead", async () => {
  const res = await fetch(`${base}/api/crm/pipelines?tipo=lead`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.status);
  const n = json.data?.[0]?.estagios?.length ?? 0;
  if (n < 1) throw new Error("Sem etapas de pipeline");
  return `${n} etapas no pipeline lead`;
});

await run("api-encaminhamentos-pendentes", async () => {
  const res = await fetch(`${base}/api/crm/encaminhamentos/pendentes`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.status);
  return `${(json.data ?? []).length} pendentes`;
});

await run("flag-distribuicao-auto", async () => {
  const v = env.CRM_DISTRIBUICAO_AUTO ?? "true";
  if (v === "0" || v === "false") throw new Error("CRM_DISTRIBUICAO_AUTO desligada");
  return "activa";
});

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} OK`);
process.exit(failed.length > 0 ? 1 : 0);
