---
name: gameclaw
description: "Launch and play GameClaw terminal games: detect the player's platform, download the right single-file binary from GitHub Releases, fix GitHub network failures with GitHub520 first, then run the agent step loop (new → actions → act → recap). Use when a user asks what games GameClaw has, wants to install or run one, needs a Linux/macOS/Windows binary, or hits a download/network problem."
version: 2.0.0
---

# GameClaw

GameClaw ships **terminal games as single-file binaries** for macOS, Linux and Windows.
Every game speaks the same agent-first CLI, so one skill covers all of them.

This skill is **self-contained**: it is prompt-only and does not need the GameClaw
monorepo to be present. Never assume local source files exist.

- Repo: `https://github.com/Arcobalneo/gameclaw`
- Releases: `https://github.com/Arcobalneo/gameclaw/releases/latest`

## Fast path

1. Detect the platform automatically (`uname -s`, `uname -m`, `$OS`, `$PROCESSOR_ARCHITECTURE`).
2. Show the game menu as a numbered list and ask the player to reply with a number.
3. Download the matching release asset.
4. Unpack, verify, and launch.

Do not stay in explanation mode. The player wants to play.

## Games

All assets follow `<game-id>-<platform>.<tar.gz|zip>`. Every platform column below
means a real binary is published for it.

| # | Game ID | Name | Genre | Platforms |
|---|---------|------|-------|-----------|
| 1 | `lobster-cli-roguelike` | 横着活 | Infinite tide-cycle roguelike | darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64 |
| 2 | `lobster-cli-tower-defense` | 横着守 | Pulse-based lane tower defense | darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64 |
| 3 | `lobster-cli-heist` | 横着潜 | Grid stealth heist | darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64 |
| 4 | `lobster-cli-tamer` | 横着抓 | Creature taming + abyss runs | darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64 |
| 5 | `lobster-cli-sideways-look` | 横着看 | Single-step visual horror | darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64 |

Platform labels: `darwin-arm64` (Apple Silicon), `darwin-x64` (Intel Mac),
`linux-x64`, `linux-arm64`, `windows-x64`.

Asset extension: `.tar.gz` on macOS/Linux, `.zip` on Windows.

## When GitHub is slow or blocked — fix this FIRST

Symptoms: `curl` / `gh release download` hangs or times out, TLS handshake
failures, `Connection reset`, downloads stuck near 0 B/s, or DNS resolving to a
dead IP.

**Priority order.** Try 1, retry the download, then 2, then 3. Never skip
straight to "the asset does not exist", and never silently fall back to building
from source.

### 1. GitHub520 hosts refresh (preferred)

Follow [521xueweihan/GitHub520](https://github.com/521xueweihan/GitHub520).
It publishes a maintained hosts block at `https://raw.hellogithub.com/hosts`
and `https://raw.hellogithub.com/hosts.json` — both are reachable **without**
GitHub, so they still work when GitHub itself is blocked.

This writes a system file, so ask the player for permission first. Back up the
hosts file before editing it.

**macOS / Linux**

```bash
HOSTS=/etc/hosts
sudo cp "$HOSTS" "$HOSTS.gameclaw.bak.$(date +%s)"
curl -fsSL https://raw.hellogithub.com/hosts -o /tmp/github520.hosts

# Remove an older GitHub520 block, then append the fresh one.
sudo sed -i.bak '/^# GitHub520 Host Start$/,/^# GitHub520 Host End$/d' "$HOSTS"
sudo tee -a "$HOSTS" < /tmp/github520.hosts > /dev/null

# Flush DNS (macOS)
sudo dscacheutil -flushcache 2>/dev/null || true
sudo killall -HUP mDNSResponder 2>/dev/null || true
# Linux
sudo resolvectl flush-caches 2>/dev/null || sudo systemd-resolve --flush-caches 2>/dev/null || true
```

**Windows (PowerShell, run as Administrator)**

```powershell
$hosts = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
Copy-Item $hosts "$hosts.gameclaw.bak" -Force
$raw = (Invoke-WebRequest https://raw.hellogithub.com/hosts -UseBasicParsing).Content
$current = Get-Content $hosts -Raw
$current = [regex]::Replace($current, '(?s)# GitHub520 Host Start.*?# GitHub520 Host End\r?\n?', '')
Set-Content -Path $hosts -Value ($current.TrimEnd() + "`r`n" + $raw) -Encoding ASCII
ipconfig /flushdns
```

Then retry the download. If `raw.hellogithub.com` itself is unreachable, go to
the proxy fallback.

### 2. HTTPS proxy

Respect the player's proxy instead of inventing one:

```bash
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
gh release download ...    # or curl -fL ...
```

```powershell
$env:HTTPS_PROXY = 'http://127.0.0.1:7890'
```

If the player already has a proxy launcher (e.g. Clash), use it rather than
guessing ports.

### 3. Accelerated mirror (last resort)

Only when 1 and 2 both fail:

```bash
curl -fL -o game.tar.gz "https://ghfast.top/https://github.com/Arcobalneo/gameclaw/releases/download/<tag>/<asset>"
```

Mirrors are untrusted. After downloading from a mirror, verify the asset against
the release's `SHA256SUMS` before running it. If no checksum is available, say so
plainly instead of pretending the download is verified.

### Download commands

```bash
# Preferred: GitHub CLI
gh release download --repo Arcobalneo/gameclaw --pattern 'lobster-cli-heist-linux-x64.tar.gz' --dir .

# Fallback: curl
curl -fL -o lobster-cli-heist-linux-x64.tar.gz \
  https://github.com/Arcobalneo/gameclaw/releases/latest/download/lobster-cli-heist-linux-x64.tar.gz
```

Windows PowerShell:

```powershell
gh release download --repo Arcobalneo/gameclaw --pattern 'lobster-cli-heist-windows-x64.zip' --dir .
```

### Verify

```bash
sha256sum -c SHA256SUMS 2>/dev/null || shasum -a 256 -c SHA256SUMS
```

Every archive contains its own `SHA256SUMS`; each release also carries one
aggregate `SHA256SUMS`.

### Unpack and run

macOS / Linux:

```bash
tar -xzf <game>-<platform>.tar.gz
cd <game>-<platform>
./<game> --version
./<game> help
```

Windows:

```powershell
Expand-Archive <game>-windows-x64.zip
cd <game>-windows-x64
.\<game>.exe --version
.\<game>.exe help
```

## Play as an agent

GameClaw games are **step machines**, not full-screen TUIs. One tool call = one
turn.

```bash
<game> new --seed 7              # start a run; returns state + legal actions
<game> actions --json            # list legal action ids
<game> act <action-id> --json    # resolve one action; returns log + next state + next actions
<game> recap --json              # settlement: cause, timeline, honest memory lessons
```

Rules:

- Prefer `--json`. It returns one object with `status`, `actions`, `log`, `events`,
  `next`, `report` and `observer`.
- `act` already returns the full next state. Do not call `status` after every
  `act`; only call it when resuming a run in a new session.
- Every run is deterministic for a given `--seed` plus action sequence.
- `abort` is always legal and settles honestly.
- Use `--state-dir <path>` (or `GAMECLAW_HOME`) to isolate a run in a sandbox.
- `--no-observer --no-report` are the right flags for CI or headless batches.

Example loop:

```bash
lobster-cli-roguelike new --seed 7 --json
lobster-cli-roguelike act lineage:oracle --json
lobster-cli-roguelike act enc:2 --json
lobster-cli-roguelike recap --json
```

### Observer and reports

- A local observer page starts on `http://127.0.0.1:8000+` and stops when the run ends.
  `--no-observer` disables it.
- A self-contained HTML settlement report is written to
  `~/.gameclaw/<game-id>/reports/latest.html`, with a Markdown twin.
  `--no-report` disables it.
- The CLI prints `OBSERVER`, `REPORT` and `RECAP` lines with exact paths.

## Troubleshooting

| Symptom | Action |
|---|---|
| `Permission denied` | `chmod +x ./<game>` |
| macOS "cannot be opened because the developer cannot be verified" | `xattr -d com.apple.quarantine ./<game>` |
| Windows SmartScreen warning | More info → Run anyway; binaries are not code-signed |
| `UNSUPPORTED` platform | Say so plainly; do not invent an asset |
| Checksum mismatch | Delete the download, retry step 1, then re-download |
| `SLOT_IN_USE` | Pick another `--slot 1`, or pass `--force` to overwrite |
| `NO_SAVE` | Run `new` first |
| Observer port busy | Games scan 8000-8039 automatically; or pass `--port` |

## Safety and accuracy

- Prefer released binaries over source checkouts.
- Do not claim a platform is supported unless it appears in the table above.
- Do not claim binaries are impossible to reverse engineer. They reduce casual
  source visibility, nothing more.
- Never fake a successful download. Report the failing step and the exact URL.
- Never push a hosts/proxy change without telling the player what it changes and
  how to revert it (the backup path).
- The games do not store strategy for the player. They emit honest, single-run
  observations and expect the agent to write durable lessons into its own memory.
