/**
 * Corrige mojibake (UTF-8 lido como Latin-1) em AgenteNovoWizard.tsx
 */
const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "..", "components", "crm", "AgenteNovoWizard.tsx");
let s = fs.readFileSync(target, "utf8").replace(/^\uFEFF/, "");

// Mojibake: UTF-8 interpretado como Latin-1
if (/Ã.|â€/.test(s)) {
  const converted = Buffer.from(s, "latin1").toString("utf8").replace(/^\uFEFF/, "");
  if (converted.includes("será instruído") && converted.includes("catálogo")) {
    s = converted;
  }
}

// Remove caracteres de controlo invisíveis deixados pela conversão
s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");

// Reparos pontuais pós-conversão
const fixes = [
  [/\uFFFD/g, "—"],
  [/passos 7—8/g, "passos 7–8"],
  [/Aplicar template padrao v1/g, "Aplicar template padrão v1"],
];

for (const [re, rep] of fixes) {
  s = s.replace(re, rep);
}

// Comentários de secção
s = s.replace(
  /^\/\/.*Constants.*$/m,
  "// ─── Constants ───────────────────────────────────────────────────────────────"
);
s = s.replace(
  /^\/\/.*Helpers.*$/m,
  "// ─── Helpers ─────────────────────────────────────────────────────────────────"
);

fs.writeFileSync(target, s, "utf8");
const bad = (s.match(/Ã|â€|\uFFFD/g) || []).length;
console.log("Mojibake restante:", bad);
console.log("Passo 1:", s.match(/Como este agente[^\n]+/)?.[0] ?? "N/A");
console.log("Início:", s.slice(0, 14));
