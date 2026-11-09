#!/usr/bin/env bash
# Run from any agent terminal with GitHub, Turso and Cloudflare HTTPS access.
set -euo pipefail
cd "$(dirname "$0")/.."

branch='arena/710a3fbd-stock-ridge'
remote='https://github.com/Mohammed-Hayatudeen/Stock-Ridge.git'
email='111691245+Mohammed-Hayatudeen@users.noreply.github.com'
test "$(git branch --show-current)" = "$branch"
test "$(git remote get-url origin)" = "$remote"
test -f .env.deploy
printf 'Push: %s -> %s; HTTPS token auth (no SSH key); email %s\n' "$branch" "$remote" "$email"

set -a
# shellcheck disable=SC1091
. ./.env.deploy
set +a
: "${CLOUDFLARE_API_TOKEN:?missing in .env.deploy}"
: "${CLOUDFLARE_ACCOUNT_ID:?missing in .env.deploy}"
: "${TURSO_DATABASE_URL:?missing in .env.deploy}"
: "${TURSO_AUTH_TOKEN:?missing in .env.deploy}"
: "${JWT_SECRET:?missing in .env.deploy}"
test "${#JWT_SECRET}" -ge 32

npm ci --ignore-scripts --no-audit --no-fund
git diff --check
npm test
npm run check
git push origin "$branch"
npm run turso:check
npm run turso:migrate
printf '%s' "$TURSO_AUTH_TOKEN" | npx wrangler secret put TURSO_AUTH_TOKEN --env "" --config worker/wrangler.toml
printf '%s' "$JWT_SECRET" | npx wrangler secret put JWT_SECRET --env "" --config worker/wrangler.toml
npx wrangler deploy --dry-run --env "" --config worker/wrangler.toml --outdir .cache/worker-dry-run
npm run worker:deploy
curl --fail --silent --show-error https://beta.stockride0.workers.dev/api/diagnose
