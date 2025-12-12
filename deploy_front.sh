#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/var/www/boulangerie_codex"
APP_DIR="${REPO_DIR}/frontend"
TARGET_DIR="/var/www/html/boulangerie-frontend"
BRANCH="main"

echo "==> Pull du code (repo) sur $BRANCH"
cd "$REPO_DIR"
git fetch --all
git checkout "$BRANCH"
git pull

echo "==> Inject build version (git hash + time) pour Vite"
BUILD_VERSION="$(git rev-parse --short HEAD)"
BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat > "${APP_DIR}/.env.production.local" <<EOF
VITE_BUILD_VERSION=${BUILD_VERSION}
VITE_BUILD_TIME=${BUILD_TIME}
EOF

echo "==> Install deps (frontend)"
cd "$APP_DIR"
npm ci

echo "==> Build (frontend)"
npm run build

echo "==> Déploiement atomique"
TMP_DIR="${TARGET_DIR}_new"
sudo rm -rf "$TMP_DIR"
sudo mkdir -p "$TMP_DIR"
sudo cp -r dist/* "$TMP_DIR/"

echo "==> Switch instantané"
sudo rm -rf "${TARGET_DIR}_old" || true
sudo mv "$TARGET_DIR" "${TARGET_DIR}_old" 2>/dev/null || true
sudo mv "$TMP_DIR" "$TARGET_DIR"
sudo rm -rf "${TARGET_DIR}_old" || true

echo "==> OK (Build: ${BUILD_VERSION} @ ${BUILD_TIME})"
