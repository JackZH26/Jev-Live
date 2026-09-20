# Phase 1 acceptance record

[简体中文](PHASE1_STATUS.md) · [English](PHASE1_STATUS.en.md)

2026-09-20 · 0.1.0 developer preview.

The current flow is **add/select from Steam → installed Steam game → select YouTube / Twitch / X outputs**. First target: Enter the Cube Playtest, AppID 5272970, installed candidate build 25364079. No development project or editor is required.

| Check | Result |
| --- | --- |
| TypeScript / Vue | `npm run check` passed |
| Production build | `npm run build` passed |
| Core/security tests | 39 passed: OAuth, refresh, handover, three-output recovery, encrypted X source/URL validation/migration, empty platform selection, YouTube activation errors, historical secret scan, Steam manifests and five-language resources |
| Platform selection | YouTube or Twitch alone needs no other account; checkboxes can be toggled during automatic gameplay and clearing all blocks startup. Isolated Electron checks cover real IPC, stale settings preserving selection, locking while streaming and capture reapplication for newly selected outputs; five-language UI and persistence passed |
| YouTube activation guidance | Isolated Electron injects official error codes and verifies five-language guidance and the Studio link; neither output starts after rejection and selection is preserved. The actual channel still shows its initial activation countdown, which the software cannot bypass |
| Local YouTube-only rehearsal | Packaged app loaded the bound account and captured actual Steam Playtest video; 13 accepted JEV decisions in 30 seconds, OBS game-audio peak approximately 0.562, followed by manual handover. Twitch OBS remained off; no output was sent to YouTube |
| Electron UI | Actual process launch, studio/settings usable, renderer without Node, no page errors |
| Isolated OBS | Three OBS 32.2.2 WebSocket connections and separate encoders passed; test ports are separate from production |
| Steam library / selection | Four eligible installed games detected locally; Playtest launches through Steam and binds to the Shipping process; account-owner fields are excluded |
| Steam baseline play | One-minute BOT MATCH test recorded 35 bounded operations at the executor and successful manual takeover. Bots eliminated the baseline; competitive performance is not established |
| Steam JEV integration | Real SDK requests using an existing locally encrypted credential; return-to-lobby, BOT MATCH and in-game actions worked. Actual capture and input pausing checked separately; this is not substituted with development-build evidence |
| Input pause / actual video | Latest 25-second JEV run confirmed 17 operations; minimizing released input and stopped the action counter, followed by successful manual takeover after restore. Frame validation excluded a solid test overlay |
| Languages / author | Real Electron checks for all five UI/error languages, persistence, unchanged controls, 1080px settings and the X link |
| Windows package | Standalone application directory built; its exe adds/selects Playtest through the UI and connects the native observer; renderer remains isolated |
| Local three-output RTMP | Three simultaneous FFmpeg receivers: H.264 High 1920×1080, YouTube / Twitch at 60fps, X at 30fps, all with AAC; zero OBS drops and about 8.8 / 9.2 / 9.6 MB received. Different colors establish separate canvases; X keyframes measured three seconds apart. This does not substitute for platform ingestion |
| X UI / IPC | Isolated Electron checks real IPC: X alone works without OAuth accounts, source encryption, snapshots omit URL/key, inputs clear on submission, invalid hosts rejected and removal blocked during output; no real platform requests |
| Actual private X ingestion | Official Live Studio Private event received Steam Playtest lobby video. The player decoded a 1280×720 rendition with advancing playback time; source was 1080p30 with zero OBS drops. The X event and encoder were ended and temporary keys cleared, preserving previous platform selection. No public post; in-match gameplay and human listening acceptance were outside this short test |
| Actual Google / Twitch authorization | Real Google Desktop OAuth and Twitch Public Device Code OAuth grants completed; Twitch token validation and stream-key read permission verified. Both account cards loaded after restarting the packaged app, preserving YouTube Private visibility, the existing output selection and the Steam game selection. Account binding did not start a broadcast |
| Actual YouTube / Twitch ingestion | Not completed. The YouTube test channel is in the initial approximately 24-hour streaming activation wait; local preparation and OAuth success are not platform-ingestion acceptance |
| Automatic perception | OCR provides text/menu coordinates only; no complete enemy localization, reliable aiming, obstacle avoidance or multi-match success benchmark. Autoplay is explicitly experimental |
| 24-hour endurance | Not performed |
| Avatar, voice and chat | Subsequent phases; not enabled in this preview |

Screenshots and runtime JSON stay in ignored `test-results/`; account/session data is not uploaded. Public records contain credential-free summaries only.

The earlier development-bridge build and 90-second run were exploratory historical tests, not evidence of Steam compatibility. Current acceptance uses the actual Steam installation. `integrations/etc` remains an optional developer reference.
