#!/usr/bin/env bash
# Mission init — idempotent environment setup.
set -euo pipefail

REPO="/Users/vriesd/projects/csv-align"
cd "$REPO"

echo "[init] Ensuring Rust toolchain is current..."
if command -v rustup >/dev/null 2>&1; then
  rustup update stable || true
  rustup component add rustfmt clippy >/dev/null 2>&1 || true
fi

echo "[init] Installing frontend dependencies..."
cd "$REPO/frontend"
if [ ! -d node_modules ] || [ package.json -nt node_modules ] || [ package-lock.json -nt node_modules ]; then
  npm ci --silent
else
  echo "[init] node_modules up to date — skipping npm ci"
fi

echo "[init] Building frontend (dist)..."
npm run build --silent

echo "[init] Baseline Rust compile (warm target/)..."
cd "$REPO"
cargo build --quiet --all-targets 2>/dev/null || true

echo "[init] Done."
