/**
 * Seed RBAC multi-tenant: owners Obra10, Lucas inativo, tenant_id backfill.
 * Idempotente — pode correr várias vezes.
 *
 *   node scripts/seed-users-rbac.mjs
 *
 * Requer .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const OBRA10_TENANT = "00000000-0000-4000-8000-000000000001";

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const OWNERS = [
  "ramonexercito@gmail.com",
  "nice.engemp@gmail.com",
  "ariane.ot@gmail.com",
];

async function main() {
  console.log("Aplicando seed RBAC…");

  const { error: tenantErr } = await supabase.from("hub_tenants").upsert(
    { id: OBRA10_TENANT, slug: "obra10", nome_exibicao: "Obra10+" },
    { onConflict: "id" }
  );
  if (tenantErr) console.warn("hub_tenants:", tenantErr.message);

  for (const email of OWNERS) {
    const base = { role: "owner", status: "Ativo" };
    let { data, error } = await supabase
      .from("users")
      .update({ ...base, tenant_id: OBRA10_TENANT })
      .eq("email", email)
      .select("email, role, status, tenant_id");
    if (error?.message?.includes("tenant_id")) {
      ({ data, error } = await supabase
        .from("users")
        .update(base)
        .eq("email", email)
        .select("email, role, status"));
    }
    if (error) console.error(`owner ${email}:`, error.message);
    else console.log("owner OK:", data?.[0] ?? email);
  }

async function rebaixarDeOwner(email, extra = {}) {
  let { data, error } = await supabase
    .from("users")
    .update({ ...extra, role: "gestor" })
    .eq("email", email)
    .select("email, status, role");
  if (error?.message?.includes("gestor")) {
    ({ data, error } = await supabase
      .from("users")
      .update({ ...extra, role: "admin" })
      .eq("email", email)
      .select("email, status, role"));
  }
  return { data, error };
}

  const { data: lucas, error: lucasErr } = await rebaixarDeOwner("lucasoffgod@hotmail.com", {
    status: "Inativo",
  });
  if (lucasErr) console.error("lucas inativo:", lucasErr.message);
  else console.log("lucas inativo:", lucas?.[0] ?? "não encontrado");

  const { data: ownersExtra } = await supabase.from("users").select("email, role").eq("role", "owner");
  for (const row of ownersExtra ?? []) {
    const em = String(row.email ?? "").trim().toLowerCase();
    if (em && !OWNERS.includes(em)) {
      const { error: dErr } = await rebaixarDeOwner(row.email);
      if (dErr) console.warn(`rebaixar ${em}:`, dErr.message);
      else console.log(`owner extra rebaixado: ${em}`);
    }
  }

  const { data: rest, error: backfillErr } = await supabase
    .from("users")
    .update({ tenant_id: OBRA10_TENANT })
    .is("tenant_id", null)
    .select("email");
  if (backfillErr) {
    if (backfillErr.message?.includes("tenant_id")) {
      console.warn("Coluna tenant_id ainda não existe — aplique a migração SQL primeiro.");
    } else {
      console.error("backfill tenant:", backfillErr.message);
    }
  } else {
    console.log(`Backfill tenant_id: ${rest?.length ?? 0} utilizadores`);
  }

  console.log("Concluído.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
