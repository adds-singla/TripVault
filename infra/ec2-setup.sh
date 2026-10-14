#!/usr/bin/env bash
# Run ONCE on a fresh Ubuntu 22.04/24.04 t3.micro:  bash ec2-setup.sh
set -euo pipefail

# 1 GB RAM is tight for OCR + OpenCV + sklearn: add 2 GB swap.
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 nginx git
sudo systemctl enable --now docker nginx
sudo usermod -aG docker "$USER"

sudo cp "$(dirname "$0")/nginx-tripvault.conf" /etc/nginx/conf.d/tripvault.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

mkdir -p ~/tripvault
echo "Done. Log out/in for docker group, then copy backend/ to ~/tripvault/backend, create ~/tripvault/backend/.env and run infra/deploy-backend.sh"
