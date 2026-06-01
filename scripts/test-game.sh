#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GAME_ID="${1:-}"
UV_BIN="${UV_BIN:-uv}"

if [[ -z "$GAME_ID" ]]; then
  echo "usage: ./scripts/test-game.sh <game-id>" >&2
  exit 1
fi

GAME_DIR="$ROOT_DIR/games/$GAME_ID"
if [[ ! -d "$GAME_DIR" ]]; then
  echo "unknown game id: $GAME_ID" >&2
  exit 1
fi

if ! "$UV_BIN" --version >/dev/null 2>&1; then
  echo "uv is required for maintainer test flows. Install uv or set UV_BIN to a uv executable." >&2
  exit 1
fi

cd "$GAME_DIR"
# v0.1.8 修复:装 test extra,因为 test_terminal_native_cli.py 用 pytest
"$UV_BIN" sync \
  --project "$ROOT_DIR" \
  --default-index https://pypi.org/simple \
  --locked \
  --package "$GAME_ID" \
  --extra test

# v0.1.8 修复:用 pytest 跑(原本用 unittest discover 但裸函数不被发现,
# test_terminal_native_cli.py 用了 pytest 装饰器/夹具)
"$UV_BIN" run \
  --project "$ROOT_DIR" \
  --locked \
  --no-sync \
  --package "$GAME_ID" \
  --extra test \
  python -m pytest "$GAME_DIR/tests" -v
