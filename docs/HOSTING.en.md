# Avatars, layouts and local hosting

[简体中文](HOSTING.md) · [English](HOSTING.en.md)

Creator: JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj). Follow along and say hello.

## Workflow

1. Select an installed Steam game, prepare selected OBS outputs and apply the actual game window. The test target is Enter the Cube Playtest, never a development editor.
2. Open Avatar & automatic host. Select YouTube, Twitch or X; drag game/avatar/chat/captions and resize from the lower-right corner. Coordinates, visibility and locking are editable. Save & apply layout; platform layouts remain independent, with an optional copy-to-all action. Layouts can be saved while hosting is running.
3. Use the original default avatar or import a licensed PNG / WebP / JPEG / self-contained VRM under 60 MB. Assets are copied to the local user-data directory and never uploaded or committed.
4. Start Ollama as described in [local deployment](LOCAL_HOST.en.md), select the model/device, persona, language and an installed voice. Test speech, save, then start hosting. OBS Browser Sources mix speech and captions; audio monitoring is off to prevent echo, while stream audio remains enabled.
5. Enable the desired chat platforms. Automatic text replies are off by default. Replies, speech and captions stay on the originating platform; generic game commentary may appear on all outputs.
6. Hosting and broadcasting have independent switches. Preview the host before broadcasting. Stopping hosting keeps the manual game and stream running.

Hosting runs locally. YouTube uses official gRPC `streamList` receiving and REST sending; Twitch uses EventSub WebSockets and Helix. Existing Twitch streaming tokens may lack chat scopes: authorize Twitch chat, then stop and restart hosting. Existing Google `youtube.force-ssl` scope covers the required API access, but live eligibility and an active chat are still needed.

X currently carries game, avatar and generic commentary without an X comment connector. It never displays YouTube/Twitch chat. Chat is text only; external images, URLs and HTML do not load automatically. Initial history can display without triggering replies. Self messages, duplicates and expired/deleted messages do not cause repeated responses.

## Acceptance boundary, 2026-09-20

| Item | Result |
| --- | --- |
| UI | Five languages tested; no horizontal overflow at minimum width |
| Layouts | Drag/save, platform isolation and editing during hosting verified; numeric dimensions supported |
| Models | CPU/GPU small-sample trials of two 4B models; separate report |
| Local speech | Chinese Windows synthesis, desktop playback, OBS audio-start acknowledgements and lip-sync wiring verified; human listening quality not accepted |
| Three 60 fps outputs | Loopback receivers confirm H.264 1920×1080 60 fps with AAC; X three-second keyframes pass |
| Combined Steam smoke | Real Steam Playtest lobby/menu, CPU model, three OBS, original avatar and synthetic chat; two minutes completed, no hosting failures, audio on all outputs |
| Smoothness | Initial original-quality 1440p trial had substantial skipped frames. Temporary 1080p60/high-quality trial had YouTube/Twitch 1/5430 sampled frames skipped each and X 0/5430. This does not establish 60 fps in every match |
| Two-hour run | Local combined endurance run in progress; not passed until completion. First attempt ended early because startup was checked before OBS confirmation; startup now waits |
| Real chat delivery | Connector implementation and simulated-event tests pass; YouTube activation, expanded Twitch authorization and actual delivery still need acceptance |
| 8 / 24 / 72 hours | Test entry points exist; not yet passed |

The initial smoke script checked pipeline health without rejecting encoder/render skips. `GetStats` checks now cover those. `GetStreamStatus.outputSkippedFrames` alone does not establish rendering/encoding health. Original measurements remain available; the early PASS is not treated as a smoothness pass.

## Commands

```powershell
npm run check
npm test
npm run build
npm run build:native
node scripts/smoke-hosting.cjs
node scripts/smoke-streams.cjs
node scripts/soak-hosting.cjs --seconds=120
node scripts/soak-hosting.cjs --hours=2
```

After each successful stage, progress to `--hours=8`, then `24`, then `72`. The Steam Playtest window and installed Ollama primary model must be available. CPU is the default; `--gpu` tests the optional mode. Run only one endurance instance at a time.

Tests use a separate user-data directory, OBS WebSocket ports 44751–44753 and loopback RTMP ports 19451–19453. Models, OBS and Steam capture are real. Chat is explicitly labelled **LOCAL TEST** and sending is a local receipt, never proof of platform API delivery. No platform credentials, public stream or game controls are used. The script does not change game graphics settings. It records status/process memory/GPU snapshots every 30 seconds and hourly screenshots; streamed media is discarded instead of accumulating large files.

Ignored results are under `test-results/host-soak-*/`. `progress.json`/`latest.json` represent incomplete runs; `smoothness.json` records dropped frames. A `report.json` is written only after duration and health checks pass. Platform acceptance remains separate.

## Current limits

- This PC has only Chinese/English SAPI voices. Japanese/Korean need installed voices or later neural TTS. Speech errors are surfaced, with no cloud fallback.
- Grounding uses game state/OCR text without continuous visual inference; it cannot reliably understand every fight.
- Neural voice quality, human listening review, pressure-based device switching, power-loss recovery and automatic startup are not delivered.
- Three OBS instances and browser avatars consume GPU resources. Other development applications change available capacity. CPU hosting does not remove game/encoder bottlenecks.
- Real-channel validation is still required for gRPC, overlays and authorization. Unit tests cannot replace it.

Official interfaces: [YouTube streamList](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList), [Twitch chat](https://dev.twitch.tv/docs/chat/send-receive-messages/), [X encoding](https://help.x.com/en/using-x/live-studio).
