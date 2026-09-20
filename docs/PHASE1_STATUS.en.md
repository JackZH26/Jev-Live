# Phase 1 acceptance record

[简体中文](PHASE1_STATUS.md) · [English](PHASE1_STATUS.en.md)

2026-09-20 · 0.1.0 developer preview.

The current flow is **add/select from Steam → installed Steam game → dual OBS outputs**. First target: Enter the Cube Playtest, AppID 5272970, installed candidate build 25364079. No development project or editor is required.

| Check | Result |
| --- | --- |
| TypeScript / Vue | `npm run check` passed |
| Production build | `npm run build` passed |
| Core/security tests | 22 passed: OAuth, refresh, handover, output recovery, historical secret scan, Steam manifests and five-language resources |
| Electron UI | Actual process launch, studio/settings usable, renderer without Node, no page errors |
| Isolated OBS | Both local OBS 32.2.2 WebSocket connections and window enumeration work |
| Steam library / selection | Four eligible installed games detected locally; Playtest launches through Steam and binds to the Shipping process; account-owner fields are excluded |
| Steam baseline play | One-minute BOT MATCH test recorded 35 bounded operations at the executor and successful manual takeover. Bots eliminated the baseline; competitive performance is not established |
| Steam JEV integration | Real SDK requests using an existing locally encrypted credential; return-to-lobby, BOT MATCH and in-game actions worked. Actual capture and input pausing checked separately; this is not substituted with development-build evidence |
| Input pause / actual video | Latest 25-second JEV run confirmed 17 operations; minimizing released input and stopped the action counter, followed by successful manual takeover after restore. Frame validation excluded a solid test overlay |
| Languages / author | Real Electron checks for all five UI/error languages, persistence, unchanged controls, 1080px settings and the X link |
| Windows package | Standalone application directory built; its exe adds/selects Playtest through the UI and connects the native observer; renderer remains isolated |
| Local dual RTMP | Simultaneous FFmpeg loopback receivers: H.264 1920×1080 60fps + AAC on both outputs, zero OBS drops, about 8.9 / 9.3 MB received. Different test colors establish separate canvases, not real-platform ingestion |
| Actual Google / Twitch authorization | Pending developer applications and official user authorization |
| Actual YouTube / Twitch ingestion | Not performed; local tests do not automatically publish streams |
| Automatic perception | OCR provides text/menu coordinates only; no complete enemy localization, reliable aiming, obstacle avoidance or multi-match success benchmark. Autoplay is explicitly experimental |
| 24-hour endurance | Not performed |
| Avatar, voice and chat | Subsequent phases; not enabled in this preview |

Screenshots and runtime JSON stay in ignored `test-results/`; account/session data is not uploaded. Public records contain credential-free summaries only.

The earlier development-bridge build and 90-second run were exploratory historical tests, not evidence of Steam compatibility. Current acceptance uses the actual Steam installation. `integrations/etc` remains an optional developer reference.
