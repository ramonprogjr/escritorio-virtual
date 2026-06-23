/**
 * _chk23.js — health-check rápido do app (gate antes de fechar qualquer etapa da maratona).
 * Uso: node app/_chk23.js   (o servidor dev/prod deve estar no ar)
 * Critério: rotas-chave respondem sem 5xx; /api/health = 200. Exit 0 = OK, 1 = falha.
 * Não faz nada destrutivo. Não depende de login (usa redirect: manual).
 */
const PORT = process.env.PORT || "3001";
const BASE = process.env.CHK_BASE || `http://localhost:${PORT}`;

const ALVOS = [
  { path: "/api/health", ok: (s) => s === 200, critico: true },
  { path: "/login", ok: (s) => s >= 200 && s < 500, critico: true },
  { path: "/crm", ok: (s) => s >= 200 && s < 500, critico: true }, // 307 -> /login quando deslogado
  { path: "/cadastre-se", ok: (s) => s >= 200 && s < 500, critico: false },
];

async function checar(alvo) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(BASE + alvo.path, { redirect: "manual", signal: ctrl.signal });
    clearTimeout(t);
    return { path: alvo.path, status: r.status, passou: alvo.ok(r.status), critico: alvo.critico };
  } catch (e) {
    clearTimeout(t);
    return { path: alvo.path, status: "ERRO:" + (e.code || e.name || "fetch"), passou: false, critico: alvo.critico };
  }
}

(async () => {
  console.log(`[_chk23] base=${BASE}`);
  let falhouCritico = false;
  for (const a of ALVOS) {
    const r = await checar(a);
    if (!r.passou && r.critico) falhouCritico = true;
    const tag = r.passou ? "OK    " : r.critico ? "FALHOU" : "aviso ";
    console.log(`  ${tag}  ${r.path} -> ${r.status}`);
  }
  if (falhouCritico) {
    console.log("[_chk23] RESULTADO: FALHA");
    process.exit(1);
  }
  console.log("[_chk23] RESULTADO: OK");
  process.exit(0);
})();
