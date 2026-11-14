# @gameclaw/gamekit

Browser-safe runtime for GameClaw games.

A game implements `GameDefinition`: `create`, `status`, `actions`, `act`,
`recap`, and optional `abort`. `recap.score` is the leaderboard integer.
`MemorySession` runs one in-memory game for the portal. `Rng` is sfc32.
`normalizePlayerName` is the leaderboard name rule.

No `node:` imports. No CLI.
