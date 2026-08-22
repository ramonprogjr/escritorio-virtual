#!/usr/bin/env bash
# Idempotent install for Cursor Cloud Agents.
# - Installs pinned dependencies from the lockfile.
# - Seeds a NON-SECRET .env.local so `npm run dev`/`next build` start cleanly
#   before real Supabase secrets are provided. Real Cloud Agent Secrets are
#   injected as process.env and take precedence over .env.local per Next.js
#   env load order (process.env > .env.$(NODE_ENV).local > .env.local).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[cloud-agent-install] node $(node -v) / npm $(npm -v)"
npm ci

if [ ! -f .env.local ]; then
  cat > .env.local <<'EOF'
# Placeholders NÃO-secretos gerados pelo setup do Cloud Agent.
# Para funcionalidade real (login/CRM), adicione os segredos do Supabase como
# Cloud Agent Secrets: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY. Secrets injetados (process.env) têm precedência.
PORT=3001
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.invalid
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dev-placeholder
SUPABASE_SERVICE_ROLE_KEY=dev-placeholder-service-role
DEFAULT_TENANT_ID=00000000-0000-4000-8000-000000000001
NEXT_PUBLIC_TENANT_ID=00000000-0000-4000-8000-000000000001
NEXT_TELEMETRY_DISABLED=1
EOF
  echo "[cloud-agent-install] created placeholder .env.local"
else
  echo "[cloud-agent-install] .env.local already present; leaving as-is"
fi

echo "[cloud-agent-install] done"
