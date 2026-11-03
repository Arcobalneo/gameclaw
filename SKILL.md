---
name: gameclaw
description: "Install, update, and launch GameClaw terminal games. Use when a user asks which GameClaw games exist, wants to download or update a GameClaw game binary, needs the correct macOS/Linux/Windows asset, or hits a GitHub network failure while fetching game bundles. Look up the live game list from the latest GitHub Release and catalog/games.json; this skill does not contain that list."
version: 2.3.0
---

# GameClaw

GameClaw ships **terminal games as single-file binaries** for macOS, Linux and
Windows. This skill is for the agent who owns the player's machine. Its job is:

1. look up which games exist **right now** (this file does not list them);
2. install a game bundle correctly;
3. update an installed game **without touching saves**;
4. fix GitHub download problems before concluding anything is missing.

Gameplay itself is deliberately out of scope here — every binary teaches its own
`new / actions / act / recap` loop via `help`.

## Consent boundary

This skill never changes the player's system silently. Before editing
`/etc/hosts`, a shell profile, `PATH`, or any global configuration: explain what
will change, get explicit approval, take a backup, and state how to revert it.
Prefer user-scope and reversible changes; never run `sudo` on your own initiative.

- Repo: `https://github.com/Arcobalneo/gameclaw`
- Releases: `https://github.com/Arcobalneo/gameclaw/releases/latest`

## 1. Discover the current games

This skill does **not** keep a game list, a count, or a table of ids. Those go
stale. This file is the only distribution entrypoint (ClawHub and other
registries should publish this copy, not a second list). Look the games up, in
this order, every time the player asks what exists:

1. **Latest release** — what can actually be downloaded, plus the release notes:
   `https://github.com/Arcobalneo/gameclaw/releases/latest`
2. **Catalog** — machine-readable ids, names and asset names. Releases do not
   attach a catalog file; read `main`:
   `https://raw.githubusercontent.com/Arcobalneo/gameclaw/main/catalog/games.json`
   Use `games[].id`, `name`, `englishName`, `tagline`, `platforms` and
   `release_assets`. If `main` lists an id the latest release does not ship,
   say it is not downloadable yet.
3. **READMEs, only as a supplement** if the two sources above fail:
   `https://github.com/Arcobalneo/gameclaw/blob/main/README.md`
   and `README.zh-CN.md` beside it. If they disagree with the release or the
   catalog, say so. Downloads follow the release. Ids follow the catalog.

```bash
gh release view --repo Arcobalneo/gameclaw --json tagName,name,body,assets
curl -fsSL https://raw.githubusercontent.com/Arcobalneo/gameclaw/main/catalog/games.json
```

Show the player a numbered list built from that response. Never invent an id,
and never answer "which games exist" from memory of this file.

Asset naming is always:

```
<game-id>-<platform>.tar.gz    # macOS, Linux
<game-id>-<platform>.zip       # Windows
```

Each archive extracts to `<game-id>-<platform>/` and contains the binary,
`README.md`, `LICENSE` and `SHA256SUMS`.

## 2. Detect the platform

```bash
uname -s   # Darwin -> darwin, Linux -> linux
uname -m   # arm64 / aarch64 -> arm64, x86_64 -> x64
```

```powershell
$env:OS                     # Windows_NT
$env:PROCESSOR_ARCHITECTURE # AMD64 -> x64, ARM64 -> arm64
```

Mapping:

| Host | Platform label |
|---|---|
| macOS Apple Silicon | `darwin-arm64` |
| macOS Intel | `darwin-x64` |
| Linux x64 | `linux-x64` |
| Linux arm64 | `linux-arm64` |
| Windows x64 | `windows-x64` |

If the host does not match one of these, say so plainly. Never invent an asset.

## 3. Install location

Keep all GameClaw binaries in one directory so updates are predictable:

```bash
# macOS / Linux
BIN="${XDG_DATA_HOME:-$HOME/.local/share}/gameclaw/bin"
mkdir -p "$BIN"
```

```powershell
# Windows
$Bin = Join-Path $env:LOCALAPPDATA 'GameClaw\bin'
New-Item -ItemType Directory -Force -Path $Bin | Out-Null
```

Saves are **not** stored next to the binary. They live in
`~/.gameclaw/<game-id>/` (or `%USERPROFILE%\.gameclaw\<game-id>\`), so replacing
a binary never deletes a run.

## 4. Install a game

Set three variables first:

```bash
GAME=<game-id>                 # id from catalog/games.json, present on the latest release
PLATFORM=darwin-arm64          # from step 2
ASSET="$GAME-$PLATFORM.tar.gz"
```

Download the latest release asset (always the newest tag):

```bash
TMP="$(mktemp -d)"

# Preferred: GitHub CLI
gh release download --repo Arcobalneo/gameclaw \
  --pattern "$ASSET" --dir "$TMP" --clobber

# Fallback: curl (works without gh)
curl -fL -o "$TMP/$ASSET" \
  "https://github.com/Arcobalneo/gameclaw/releases/latest/download/$ASSET"

tar -xzf "$TMP/$ASSET" -C "$TMP"
```

Verify the checksum **before** installing:

```bash
EXPECTED=$(awk '{print $1}' "$TMP/$GAME-$PLATFORM/SHA256SUMS")
ACTUAL=$(shasum -a 256 "$TMP/$GAME-$PLATFORM/$GAME" | awk '{print $1}')
[ "$EXPECTED" = "$ACTUAL" ] || { echo "CHECKSUM MISMATCH"; exit 1; }
```

Install atomically, keeping the previous binary for rollback:

```bash
install -m 755 "$TMP/$GAME-$PLATFORM/$GAME" "$BIN/$GAME.new"
[ -f "$BIN/$GAME" ] && mv "$BIN/$GAME" "$BIN/$GAME.previous"
mv "$BIN/$GAME.new" "$BIN/$GAME"
rm -rf "$TMP"
"$BIN/$GAME" --version
```

Windows equivalent:

```powershell
$Game = '<game-id>'            # from the catalog, not from memory
$Platform = 'windows-x64'; $Asset = "$Game-$Platform.zip"
$Tmp = Join-Path $env:TEMP ("gameclaw-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null

gh release download --repo Arcobalneo/gameclaw --pattern $Asset --dir $Tmp --clobber
Expand-Archive (Join-Path $Tmp $Asset) -DestinationPath $Tmp -Force

$Dir = Join-Path $Tmp "$Game-$Platform"
$Expected = (Get-Content (Join-Path $Dir 'SHA256SUMS')).Split(' ')[0]
$Actual = (Get-FileHash (Join-Path $Dir "$Game.exe") -Algorithm SHA256).Hash.ToLower()
if ($Expected -ne $Actual) { throw 'CHECKSUM MISMATCH' }

Copy-Item (Join-Path $Dir "$Game.exe") (Join-Path $Bin "$Game.exe") -Force
Remove-Item $Tmp -Recurse -Force
& (Join-Path $Bin "$Game.exe") --version
```

### PATH

If `$BIN` is not on `PATH`, use the absolute path. Only add it to `PATH` if the
player asks for it, and say which shell profile or user environment variable you
are changing.

## 5. Update a game

Updates are the same download, with a version check first.

```bash
current="$("$BIN/$GAME" --version | awk '{print $2}')"
latest="$(gh release view --repo Arcobalneo/gameclaw --json tagName -q .tagName | sed 's/^v//')"

if [ "$current" = "$latest" ]; then
  echo "$GAME is up to date ($current)"
else
  echo "updating $GAME: $current -> $latest"
  # repeat the install block for the same $GAME
fi
```

Without `gh`, resolve the latest tag from the redirect:

```bash
latest="$(curl -fsSIL -o /dev/null -w '%{url_effective}' \
  https://github.com/Arcobalneo/gameclaw/releases/latest | sed 's#.*/tag/v##')"
```

Windows:

```powershell
$current = (& (Join-Path $Bin "$Game.exe") --version).Split(' ')[1]
$latest  = (gh release view --repo Arcobalneo/gameclaw --json tagName -q .tagName).TrimStart('v')
if ($current -ne $latest) { Write-Host "update $Game $current -> $latest" }
```

Rules for updates:

- Re-download into a temp directory, verify the checksum, then replace.
- Keep `<game>.previous` until the new binary answers `--version`.
- Never delete `~/.gameclaw/` or the selected `--state-dir` during an update.
- On Windows, make sure the game is not running before replacing the `.exe`.
- To update every installed game, loop the ids you just fetched and repeat.
- To roll back: `mv "$BIN/$GAME.previous" "$BIN/$GAME"`.

### Update this skill itself

Ask the player to run `clawhub update @arcobalneo/gameclaw` in their harness. Do
not rewrite the installed skill files yourself. If ClawHub is unreachable, tell
the player that a newer `SKILL.md` exists in the repo and let them decide whether
to reinstall it.

## 6. Launch and play (minimal)

```bash
"$BIN/<game-id>" new --seed 7
"$BIN/<game-id>" actions
"$BIN/<game-id>" act <action-id>
"$BIN/<game-id>" recap
```

`<game-id>` is the catalog id. The command surface is the same for every game.
Which id is current comes from the catalog, not from this file.

- Use `--json` for one machine-readable object per call.
- `act` returns the full next state, so one call = one turn.
- `GAMECLAW_HOME` or `--state-dir <path>` isolates a run.
- `--no-observer --no-report` are the right flags for CI.
- Run `<game> help` for the game's own action ids and rules.

## 7. When GitHub downloads fail — fix this FIRST

Symptoms: `curl` / `gh release download` hangs or times out, TLS handshake
failures, `Connection reset`, downloads stuck near 0 B/s, or DNS resolving to a
dead IP.

Try these in order, retrying the download after each step. **Never** conclude
that an asset does not exist before finishing this list.

### 7.1 GitHub520 hosts refresh (preferred)

Follow [521xueweihan/GitHub520](https://github.com/521xueweihan/GitHub520). It
publishes a maintained hosts block at `https://raw.hellogithub.com/hosts`, which
is reachable **without** GitHub. Ask the player before editing a system file and
back it up first.

**macOS / Linux**

```bash
HOSTS=/etc/hosts
sudo cp "$HOSTS" "$HOSTS.gameclaw.bak.$(date +%s)"
curl -fsSL https://raw.hellogithub.com/hosts -o /tmp/github520.hosts

sudo sed -i.bak '/^# GitHub520 Host Start$/,/^# GitHub520 Host End$/d' "$HOSTS"
sudo tee -a "$HOSTS" < /tmp/github520.hosts > /dev/null

sudo dscacheutil -flushcache 2>/dev/null || true   # macOS
sudo killall -HUP mDNSResponder 2>/dev/null || true
sudo resolvectl flush-caches 2>/dev/null || true   # Linux
```

**Windows (PowerShell as Administrator)**

```powershell
$hosts = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
Copy-Item $hosts "$hosts.gameclaw.bak" -Force
$raw = (Invoke-WebRequest https://raw.hellogithub.com/hosts -UseBasicParsing).Content
$current = Get-Content $hosts -Raw
$current = [regex]::Replace($current, '(?s)# GitHub520 Host Start.*?# GitHub520 Host End\r?\n?', '')
Set-Content -Path $hosts -Value ($current.TrimEnd() + "`r`n" + $raw) -Encoding ASCII
ipconfig /flushdns
```

If `raw.hellogithub.com` is also unreachable, go to 7.2.

### 7.2 HTTPS proxy

Respect the player's existing proxy instead of inventing one:

```bash
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
gh release download ...
```

```powershell
$env:HTTPS_PROXY = 'http://127.0.0.1:7890'
```

### 7.3 Accelerated mirror (last resort)

```bash
curl -fL -o "$TMP/$ASSET" \
  "https://ghfast.top/https://github.com/Arcobalneo/gameclaw/releases/download/<tag>/$ASSET"
```

Only use a mirror with the player's explicit approval. Mirrors are untrusted:
verify `SHA256SUMS` and say that the download came from a mirror. If no checksum
is available, report that instead of pretending it is verified.

## 8. Troubleshooting

| Symptom | Action |
|---|---|
| `Permission denied` | `chmod +x "$BIN/<game>"` |
| macOS "cannot be opened because the developer cannot be verified" | `xattr -d com.apple.quarantine "$BIN/<game>"` |
| Windows SmartScreen warning | More info → Run anyway; releases are not Authenticode-signed |
| `UNSUPPORTED` platform | Say so plainly; do not substitute another platform's asset |
| Checksum mismatch | Delete the temp download, retry step 7, download again |
| `NO_SAVE` | Run `new` first |
| `SLOT_IN_USE` | Use `--slot 1`, or `--force` to overwrite |
| Observer port busy | Games scan 8000–8039; or pass `--port` |
| Update says "same version" but behaviour is old | Check `command -v <game>` — an older copy may shadow `$BIN/<game>` on `PATH` |

## 9. Accuracy and safety rules

- Prefer released binaries over source checkouts.
- Do not claim a platform or a game id is supported unless the live catalog
  lists it and the latest release has the asset.
- Do not claim binaries are impossible to reverse engineer. They reduce casual
  source visibility, nothing more.
- Never fake a successful download, never invent a checksum, and never silently
  switch to building from source.
- Tell the player exactly which URL, version and install path you used.
- Before a hosts or proxy change, say what it changes and how to revert it.
- GameClaw games do not store strategy for the player; they emit single-run
  observations and expect the agent to write durable lessons into its own memory.
