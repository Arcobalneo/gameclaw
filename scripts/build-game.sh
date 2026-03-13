#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GAME_ID="${1:-}"
UV_BIN="${UV_BIN:-uv}"

if [[ -z "$GAME_ID" ]]; then
  echo "usage: ./scripts/build-game.sh <game-id>" >&2
  exit 1
fi

GAME_DIR="$ROOT_DIR/games/$GAME_ID"
if [[ ! -d "$GAME_DIR" ]]; then
  echo "unknown game id: $GAME_ID" >&2
  exit 1
fi

if ! "$UV_BIN" --version >/dev/null 2>&1; then
  echo "uv is required for maintainer build flows. Install uv or set UV_BIN to a uv executable." >&2
  exit 1
fi

cd "$GAME_DIR"
"$UV_BIN" sync \
  --project "$ROOT_DIR" \
  --default-index https://pypi.org/simple \
  --locked \
  --package "$GAME_ID" \
  --extra build

"$UV_BIN" run \
  --project "$ROOT_DIR" \
  --locked \
  --no-sync \
  --package "$GAME_ID" \
  --extra build \
  ./scripts/build-native.sh

echo "Built $GAME_ID under: $GAME_DIR/dist"
