#!/usr/bin/env bash
set -euo pipefail

REMOTE="deploy@178.105.205.216"
REMOTE_DIR="/opt/apps/skyjo"
VERSION="${APP_VERSION:-dev}"
[[ "$VERSION" =~ ^[A-Za-z0-9._-]+$ ]] || VERSION="dev"

echo "→ Rsyncing files..."
rsync -az --delete \
  --exclude='.env' \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='client/dist/' \
  --exclude='docs/' \
  --exclude='data/' \
  --exclude='.superpowers/' \
  --exclude='*.log' \
  . "$REMOTE:$REMOTE_DIR"

echo "→ Rebuilding and restarting..."
ssh "$REMOTE" "cd $REMOTE_DIR && APP_VERSION=$VERSION docker compose up -d --build"

echo "✓ Deployed $VERSION — https://skyjo.rolinek.at"
