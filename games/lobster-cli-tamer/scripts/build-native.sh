#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="lobster-cli-tamer"
OUT_DIR="${OUT_DIR:-build/nuitka}"
DIST_DIR="${DIST_DIR:-dist}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

mkdir -p "$OUT_DIR" "$DIST_DIR"

"$PYTHON_BIN" -m nuitka \
  --onefile \
  --assume-yes-for-downloads \
  --output-dir="$OUT_DIR" \
  --output-filename="$APP_NAME" \
  --remove-output \
  main.py

BIN_PATH="$OUT_DIR/$APP_NAME"
if [[ ! -f "$BIN_PATH" ]]; then
  echo "expected binary not found: $BIN_PATH" >&2
  exit 1
fi

OS_NAME="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH_NAME="$(uname -m)"
ARCHIVE_BASENAME="${APP_NAME}-${OS_NAME}-${ARCH_NAME}"
STAGE_DIR="$DIST_DIR/$ARCHIVE_BASENAME"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
cp "$BIN_PATH" "$STAGE_DIR/$APP_NAME"
cp README.md LICENSE "$STAGE_DIR/"

tar -C "$DIST_DIR" -czf "$DIST_DIR/${ARCHIVE_BASENAME}.tar.gz" "$ARCHIVE_BASENAME"

echo "Built binary: $BIN_PATH"
echo "Built archive: $DIST_DIR/${ARCHIVE_BASENAME}.tar.gz"
