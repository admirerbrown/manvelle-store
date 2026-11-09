#!/usr/bin/env bash
# Builds the storefront with .env.production values and checks the hosted catalog.
# Usage: ./check-build.sh            (build and check)
#        ./check-build.sh --preview  (also start npm run preview)
set -euo pipefail

cd "$(dirname "$0")"

ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; exit 1; }

if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != "--preview" ]; }; then
  fail "Usage: ./check-build.sh [--preview]"
fi

# Terminal-session values override .env files at build time, so drop them.
unset VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY

[ -f .env.production ] || fail ".env.production not found in $(pwd)"

# Read values without sourcing the file or printing the key.
read_var() {
  grep -E "^$1=" .env.production | tail -n1 | cut -d= -f2- | tr -d "\"'\r "
}
URL=$(read_var VITE_SUPABASE_URL)
KEY=$(read_var VITE_SUPABASE_ANON_KEY)

echo "1. Checking .env.production"
[ -n "$URL" ] || fail "VITE_SUPABASE_URL is missing or empty"
[ -n "$KEY" ] || fail "VITE_SUPABASE_ANON_KEY is missing or empty"
case "$URL" in
  https://*.supabase.co|https://*.supabase.in) ok "URL looks like a hosted project: $URL" ;;
  *) fail "URL is not a hosted Supabase address: $URL" ;;
esac

URL=${URL%/}
echo "2. Testing the hosted product catalog with those values"
PRODUCTS_FILE=$(mktemp)
trap 'rm -f "$PRODUCTS_FILE"' EXIT
STATUS=$(curl -sS -o "$PRODUCTS_FILE" -w "%{http_code}" --max-time 20 \
  "$URL/rest/v1/products?select=id&active=eq.true&limit=1" \
  -H "apikey: $KEY" -H "Accept: application/json") \
  || fail "could not reach the hosted products API"
[ "$STATUS" = "200" ] || fail "products request returned HTTP $STATUS (check URL, key, and database migrations)"
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const rows = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("No active products found. Sync the catalog to the hosted project first.");
    process.exit(1);
  }
' "$PRODUCTS_FILE" || fail "hosted catalog is empty or returned an invalid response"
ok "products request returned HTTP 200 with an active product"

echo "3. Validating the local catalog"
npm run catalog:validate --silent || fail "catalog source validation failed"
echo "4. Building"
npm run build --silent || fail "build failed"

echo "5. Inspecting dist/"
HOST=${URL#https://}
ASSETS=dist/assets
[ -d "$ASSETS" ] || fail "build did not create $ASSETS"
JS_FILES=$(find "$ASSETS" -maxdepth 1 -type f -name '*.js' -print -quit)
[ -n "$JS_FILES" ] || fail "build did not create JavaScript assets in $ASSETS"
grep -Fq -- "$HOST" "$ASSETS"/*.js \
  && ok "bundle contains $HOST" \
  || fail "bundle does not contain $HOST"
if grep -Eq 'https?://(127\.0\.0\.1|localhost):54421' "$ASSETS"/*.js; then
  fail "bundle still contains the local Supabase URL"
fi
ok "bundle has no local Supabase URL"

echo
echo "All checks passed. dist/ is ready to deploy."

if [ "${1:-}" = "--preview" ]; then
  npm run preview
fi
