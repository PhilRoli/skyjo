#!/usr/bin/env bash
set -euo pipefail

REMOTE="deploy@178.105.205.216"
REMOTE_DIR="/opt/apps/skyjo"

echo "→ Rsyncing files..."
rsync -az --delete \
  --exclude='.env' \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='client/dist/' \
  --exclude='docs/' \
  --exclude='.superpowers/' \
  --exclude='*.log' \
  . "$REMOTE:$REMOTE_DIR"

echo "→ Rebuilding and restarting..."
ssh "$REMOTE" "cd $REMOTE_DIR && docker compose up -d --build"

echo "✓ Done — https://skyjo.rolinek.at"
