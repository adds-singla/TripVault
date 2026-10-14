#!/usr/bin/env bash
# Usage:  WEB_BUCKET=my-web-bucket CF_DISTRIBUTION_ID=E123ABC ./infra/deploy-frontend.sh
# Builds the static export and syncs it to the private web bucket, then invalidates CloudFront.
set -euo pipefail
: "${WEB_BUCKET:?set WEB_BUCKET}"
: "${CF_DISTRIBUTION_ID:?set CF_DISTRIBUTION_ID}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT/frontend"
export NEXT_PUBLIC_AUTH_MODE=cognito
: "${NEXT_PUBLIC_COGNITO_USER_POOL_ID:?set NEXT_PUBLIC_COGNITO_USER_POOL_ID}"
: "${NEXT_PUBLIC_COGNITO_APP_CLIENT_ID:?set NEXT_PUBLIC_COGNITO_APP_CLIENT_ID}"
npm ci && npm run build            # -> frontend/out

# Hashed assets: cache for a year. HTML: always revalidate.
aws s3 sync out "s3://$WEB_BUCKET" --delete --exclude "*.html" --cache-control "public,max-age=31536000,immutable"
aws s3 sync out "s3://$WEB_BUCKET" --exclude "*" --include "*.html" --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id "$CF_DISTRIBUTION_ID" --paths "/*" >/dev/null
echo "Deployed."
