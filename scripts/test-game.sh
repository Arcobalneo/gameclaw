#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GAME_ID="${1:-}"

if [[ -z "$GAME_ID" ]]; then
  echo "usage: ./scripts/test-game.sh <game-id>" >&2
  exit 1
fi

GAME_DIR="$ROOT_DIR/games/$GAME_ID"
if [[ ! -d "$GAME_DIR" ]]; then
  echo "unknown game id: $GAME_ID" >&2
  exit 1
fi

cd "$GAME_DIR"
python3 -m unittest discover -s tests
