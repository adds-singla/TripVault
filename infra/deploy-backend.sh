#!/usr/bin/env bash
# Usage (from your laptop):  EC2_HOST=ubuntu@1.2.3.4 SSH_KEY=~/.ssh/key.pem ./infra/deploy-backend.sh
# Copies ./backend to the EC2 box, rebuilds the image and restarts the container (runs Alembic migrations on start).
set -euo pipefail
: "${EC2_HOST:?set EC2_HOST, e.g. ubuntu@1.2.3.4}"
KEY=${SSH_KEY:+-i $SSH_KEY}
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

rsync -az --delete -e "ssh $KEY" --exclude '.env' --exclude '__pycache__' --exclude '*.db' --exclude '.pytest_cache' \
  "$ROOT/backend/" "$EC2_HOST:~/tripvault/backend/"

ssh $KEY "$EC2_HOST" bash -s <<'REMOTE'
set -euo pipefail
cd ~/tripvault/backend
test -f .env || { echo "Missing ~/tripvault/backend/.env (see backend/.env.example)"; exit 1; }
docker build -t tripvault-api .
docker rm -f tripvault-api 2>/dev/null || true
# --env-file keeps secrets out of the image; no AWS keys: the EC2 IAM role provides S3 access.
docker run -d --name tripvault-api --restart unless-stopped --env-file .env -p 127.0.0.1:8000:8000 tripvault-api
sleep 5 && curl -fsS http://127.0.0.1:8000/api/health && echo " <- API healthy"
REMOTE
