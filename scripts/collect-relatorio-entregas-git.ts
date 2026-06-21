/**
 * Gera lib/crm/relatorio-entregas.generated.json — commits Git dos últimos 7 dias.
 * Roda no build (verify:progresso) para PDF em produção sem .git em runtime.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { collectGitEntregasUltimosDias, type RelatorioEntregasArtifact } from "../lib/crm/relatorio-git-entregas";

const DIAS = 7;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outPath = resolve(root, "lib/crm/relatorio-entregas.generated.json");

const commits = collectGitEntregasUltimosDias(DIAS);
const artifact: RelatorioEntregasArtifact = {
  geradoEm: new Date().toISOString(),
  dias: DIAS,
  commits,
};

writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`[collect:entregas-git] ${commits.length} commits (${DIAS} dias) → ${outPath}`);
