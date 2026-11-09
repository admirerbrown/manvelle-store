#!/usr/bin/env bash
# One-command Supabase cloud setup for the Manvelle store.
#
# Does: link project, push migrations and auth config, create admin users, and sync the catalog.
# Does NOT: deploy the frontend or set up your SMTP provider/DNS.
#
# Usage:   bash deploy-cloud.sh
# Needs:   supabase CLI (logged in), node, and a .env.cloud file (see .env.cloud.example)
set -euo pipefail

if [ -f .env.cloud ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.cloud
  set +a
fi

: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF in .env.cloud}"
: "${SUPABASE_DB_PASSWORD:?Set SUPABASE_DB_PASSWORD in .env.cloud}"
: "${ADMIN_EMAILS:?Set ADMIN_EMAILS in .env.cloud (comma separated)}"
: "${SMTP_PASS:?Set SMTP_PASS in .env.cloud (SMTP provider password or API key)}"

command -v node >/dev/null || { echo "node not found"; exit 1; }
[ -f supabase/config.toml ] || { echo "Run this from the project root (supabase/config.toml not found)"; exit 1; }

if command -v supabase >/dev/null 2>&1; then
  SUPABASE_BIN="$(command -v supabase)"
elif [ -x node_modules/.bin/supabase ]; then
  SUPABASE_BIN="node_modules/.bin/supabase"
else
  echo "Supabase CLI not found. Run npm install to install the project dependency, or install it globally."
  exit 1
fi

supabase() {
  "$SUPABASE_BIN" "$@"
}

# CLI v3 needs --remote for hosted commands. Older versions do not know that flag.
MAJOR="$(supabase --version | grep -oE '[0-9]+' | head -n1)"
if [ "${MAJOR:-0}" -ge 3 ]; then REMOTE_FLAG="--remote"; else REMOTE_FLAG=""; fi

echo
echo "This will change the HOSTED Supabase project: $SUPABASE_PROJECT_REF"
echo "  1. push database migrations"
echo "  2. sync catalog products and images"
echo "  3. push auth config from the [remotes.production] block in supabase/config.toml"
echo "  4. create admin users: $ADMIN_EMAILS"
echo
read -r -p "Type the project ref to continue: " CONFIRM
[ "$CONFIRM" = "$SUPABASE_PROJECT_REF" ] || { echo "Aborted."; exit 1; }

echo "==> Linking project"
supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "==> Pushing migrations"
supabase db push $REMOTE_FLAG --yes

echo "==> Syncing catalog to the hosted project"
node scripts/sync-catalog.mjs --sync --cloud

if [ "${MAJOR:-0}" -ge 3 ]; then
  echo "==> Config differences (review before they are applied)"
  supabase config diff $REMOTE_FLAG || true
  read -r -p "Apply this auth config to the hosted project? [y/N] " APPLY
  [ "$APPLY" = "y" ] || { echo "Skipped config push and admin creation."; exit 0; }
fi

echo "==> Pushing auth config"
supabase config push $REMOTE_FLAG --yes

echo "==> Fetching API keys"
KEYS_JSON="$(supabase projects api-keys --project-ref "$SUPABASE_PROJECT_REF" -o json)"
get_key() {
  node -e 'const k=JSON.parse(process.argv[1]);const f=k.find(x=>x.name===process.argv[2]);process.stdout.write(f?f.api_key:"")' "$KEYS_JSON" "$1"
}
SERVICE_KEY="$(get_key service_role)"
ANON_KEY="$(get_key anon)"
[ -n "$SERVICE_KEY" ] && [ -n "$ANON_KEY" ] || { echo "Could not read API keys. Copy them from the dashboard instead."; exit 1; }

echo "==> Creating admin users"
IFS=',' read -ra EMAILS <<< "$ADMIN_EMAILS"
for raw in "${EMAILS[@]}"; do
  email="$(echo "$raw" | xargs)"
  [ -n "$email" ] || continue
  SUPABASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" \
  node scripts/create-admin.mjs "$email"
done

echo
echo "Done. Put these in your frontend host's environment variables:"
echo "  VITE_SUPABASE_URL=https://${SUPABASE_PROJECT_REF}.supabase.co"
echo "  VITE_SUPABASE_ANON_KEY=${ANON_KEY}"
echo
echo "Still manual: deploy the frontend and verify your SMTP domain."
