# Jev-Live · JEV Studio

[简体中文](README.md) · [English](README.en.md)

**Creator: JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj)**
**Follow along and say hello — let's explore AI gaming and virtual streamers together!**

An open-source virtual streaming studio for your **Steam library**: add installed games, select one to stream, launch through Steam, choose manual or automatic play, and connect YouTube / Twitch through official OAuth for OBS streaming. The first test game is **Enter the Cube Playtest (Steam AppID 5272970)**, using its Steam installation. Built with Electron, Vue and TypeScript for Windows.

**Status: 0.1.0 developer preview.** The desktop app, Steam library scanning/selection, official OAuth, experimental screen observation/input control and independent OBS outputs are implemented. Real authorization and platform ingestion still need developer applications and streaming accounts. The goal is to progressively support any capturable game; being able to add and stream a game does not establish autonomous gameplay support. Arbitrary-game automation, 24-hour acceptance and a complete virtual host are not claimed.

## Current features

| Module | Phase 1 implementation |
| --- | --- |
| Desktop studio | Actual OBS previews, platform accounts, game modes, output metrics and activity |
| YouTube sign-in | Official Google browser authorization, PKCE, random-port loopback callback and offline refresh |
| Twitch sign-in | Public application's Device Code Grant, official activation page and automatic connection |
| Credential protection | Windows DPAPI / safeStorage; tokens and stream keys never reach the renderer |
| Game selection | Scan local Steam libraries; add, select and remove streamed games; launch through Steam |
| Game control | Experimental Playtest screen-text observation and bounded input, with JEV or a local baseline |
| Manual handover | Mode switching, stale-action rejection and Ctrl + Alt + M takeover |
| OBS outputs | Select YouTube only, Twitch only, or both; isolated OBS captures game video and process audio at 1080p60 |
| Stream orchestration | Checks only selected platforms and prepares them before starting; stop/recovery owns only those outputs |
| Leak prevention | Git exclusions, commit/push scans and GitHub Actions checks |
| Five languages | 简体中文, 繁體中文, 日本語, 한국어 and English across UI, notices, logs and tray |

Avatars, automatic commentary, chat replies, editable per-platform chat overlays and additional platforms come later. **Autoplay and manual play differ only in who controls the game; both will share automatic voice and text interaction.**

## Run locally

Source development requires Windows 10/11, Node.js 24, .NET 10 SDK, Steam and OBS Studio 32 (32.2.2 tested locally). The packaged directory includes the observer runtime, so streamers need neither the .NET SDK nor Unreal Engine. NVIDIA NVENC is the default encoder; select another encoder in both isolated OBS instances for other hardware.

```powershell
git clone https://github.com/JackZH26/Jev-Live.git
cd Jev-Live
git config core.hooksPath .githooks
npm ci
npm run build:native
npm run build
npm start
```

Use `npm run dev` for development. `npm run pack` produces a Windows application directory in `release/win-unpacked/`. OBS, ETC and Unreal Engine are not bundled.

## Official account connections

The everyday flow is “click sign in → select an account and authorize on the official website → return to the studio.” A self-built distribution requires a one-time developer application setup, separate from the streamer's channel account. See [OAuth setup](docs/OAUTH_SETUP.en.md).

- Google: create a Desktop OAuth client, enable YouTube Data API v3, and import the client JSON in Settings. Credentials enter local encrypted storage only.
- Twitch: create a Public application and enter its Client ID. No Client Secret is required.
- JEV: enter a TypeSafe API key locally, or begin with the local baseline policy without API costs. **The baseline is not JEV; validate their results separately.**

Google development projects require test users. Channels must have streaming access. Public OAuth distribution needs the platform's applicable branding, privacy policy and authorization review.

## Game and broadcast

1. Install the desired game in Steam. Scanning reads installed games on this computer, not passwords, cookies or the full cloud purchase history.
2. Under Streamed game, click “Add from Steam library,” add/select **Enter the Cube Playtest**, then “Launch through Steam.” Experimental autoplay becomes available when its window is detected; initial tests use BOT MATCH. Other installed games can be added for manual streaming; automation depends on adaptation status.
3. Select at least one platform using the channel checkboxes, then click “Prepare selected OBS outputs.” YouTube alone needs no Twitch account. Preparing both outputs initially uses approximately 1 GB of isolated files without overwriting your original OBS configuration.
4. Refresh the window list, select the game and click Apply. Check the selected previews and game-audio meters. Reapply capture after enabling an additional output.
5. Sign in to selected platforms, check title and visibility, and click “Start streaming.” **YouTube defaults to private; selecting Twitch broadcasts publicly.** First-time YouTube activation can take 24 hours. Browser sign-in is separate from granting the application OAuth access.
6. Stop this session’s selected outputs with “End streaming.” Closing the window sends the app to the tray; “End streams and quit” first stops automatic input and streaming.

Automation uses the selected installation's game window, Windows OCR and bounded inputs without modifying game files or launching an editor. Keep the game in the foreground; focus loss pauses input, unknown screens wait, and Ctrl + Alt + M takes over. OCR is not complete visual understanding: reliable enemy aiming, obstacle avoidance and arbitrary-game completion are not established. `integrations/etc` remains an optional developer integration example, unnecessary for ordinary streamers.

## Data and security

Default data lives in `%APPDATA%\JEV Studio`; integration tests use `%LOCALAPPDATA%\JEV Studio DevTest`, both outside the repository. OAuth and JEV credentials use system encryption. OBS's own files contain the plaintext WebSocket password and service configuration it requires: **never upload the OBS runtime directory**. Stream keys are cleared after a confirmed stop. See [Security](SECURITY.md).

Never put tokens, API keys, cookies, OAuth JSON, OBS configuration or stream keys in Git, issues, chat or screenshots. Git hooks do not replace review.

## Validation and roadmap

```powershell
npm run check
npm test
npm run build
# Actual local tests; no public YouTube/Twitch streaming
node scripts/smoke-electron.cjs --obs
node scripts/smoke-steam.cjs
node scripts/smoke-streams.cjs
node scripts/smoke-i18n.cjs
```

Tests cover OAuth callbacks, concurrent refresh, storage boundaries, manual handover, dual-output transactions, historical-secret scanning and localization. The [Phase 1 acceptance record](docs/PHASE1_STATUS.en.md) distinguishes local validation from platform validation. Functional milestones are committed and pushed to `main`; only source and public documentation are committed.

- [Full research and design](docs/DESIGN.en.md)
- [Early interactive prototype](prototype/index.html), a concept demo without real streaming
- [GitHub research snapshot](research/github-snapshot-2026-09-20.json)
- [Localization guide](docs/I18N.en.md): maintain Chinese and English documentation and all five UI languages with each feature
- Next: evaluate AIRI avatar/voice integration, automatic commentary/chat, independent overlays and 24-hour recovery testing

## License and copyright

Original code is licensed under the [MIT License](LICENSE). Copyright © 2026 JackZH26 and contributors. Third parties retain their licenses; see [Third-party notices](THIRD_PARTY_NOTICES.md). ETC, Unreal Engine, characters, artwork and platform branding receive no additional license through this repository.

JEV Studio is the working product name and Jev-Live the repository name. The project is not officially affiliated with TypeSafe, Google, Twitch, OBS or Apple.
