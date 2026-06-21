/**
 * Aplica seed RBAC após migração SQL manual.
 * A migração completa está em supabase/migrations/20260620190000_users_rbac_tenant.sql
 * (colar no SQL Editor do Supabase se tenant_id ainda não existir).
 *
 *   node scripts/apply-users-rbac-migration.mjs
 */

import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
console.log("1/2 Execute no Supabase SQL Editor (se ainda não aplicou):");
console.log("   supabase/migrations/20260620190000_users_rbac_tenant.sql\n");
console.log("2/2 A correr seed-users-rbac.mjs…\n");

const r = spawnSync(process.execPath, ["scripts/seed-users-rbac.mjs"], {
  cwd: root,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
