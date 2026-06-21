/**
 * next dev sem TLS relaxado — força NODE_ENV=development (evita erro PostCSS/Tailwind em globals.css).
 */
const port = process.env.PORT || "3001";
process.env.NODE_ENV = "development";
const { spawn } = require("child_process");
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev", "-p", port],
  { stdio: "inherit", env: process.env, cwd: require("path").join(__dirname, "..") }
);
child.on("exit", (code) => process.exit(code ?? 0));
