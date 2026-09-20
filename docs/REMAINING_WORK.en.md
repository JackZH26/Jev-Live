# Overall progress and remaining work

[简体中文](REMAINING_WORK.md) · [English](REMAINING_WORK.en.md)

Reviewed: 2026-09-20 19:29 (UTC+8). Feature source baseline: `509075e`. This is a dated snapshot; subsequent reports supersede test status.

Creator: JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj). Follow along and say hello.

## Current position

The product is a working Windows developer preview. It has not reached the release goal of simple account/game configuration followed by unattended multistreaming.

Implemented: installed Steam library selection, manual mode, official YouTube/Twitch authorization, X source management, three OBS outputs, built-in/image/VRM avatars, destination layouts, local inference and Windows TTS, YouTube/Twitch chat connectors, five UI languages, credential protection and the open-source repository. Implementation, simulated tests, local encoding and actual viewer acceptance are separate milestones.

## Prioritized work

| Order | Work | Remaining work and acceptance |
| --- | --- | --- |
| 1 | Resolve endurance findings | The two-hour local run is unfinished. At approximately 52 minutes, all three overlays had recorded three errors each. The counter mixes state-fetch and audio errors. Separate causes, verify retries cannot duplicate speech, then rerun the current build. Root cause is unconfirmed |
| 2 | Actual YouTube/Twitch/X integration | Verify YouTube eligibility, Twitch's new chat authorization, real viewer messages/replies, destination isolation, listening, stopping and reconnect. Actual private X ingestion was previously verified at 30 fps; the new 60 fps path still needs platform evidence |
| 3 | Complete two-hour show | Verify actual Steam matches, avatar, chat, automated voice/text and real platform output together. The current local run uses the lobby/menu and synthetic chat; it cannot substitute for this milestone. Progress to 8/24/72 hours afterward |
| 4 | Natural hosting and five-language speech | Only zh-CN/en-US SAPI voices are currently installed. Evaluate local neural TTS and Traditional Chinese/Japanese/Korean voices and quality. Add event-driven timing, emotion, repeated-question grouping, topic memory, viewer priorities and configurable content handling. Current hosting uses bounded text summaries and basic timing; continuous visual understanding is absent |
| 5 | All-day recovery | Independent supervisor, game/OBS restart, frozen/black/silent output detection, destination failure isolation, network/token recovery, session rollover, resource/cache limits, segmented recording and reboot recovery. Existing refresh/reconnect/stop mechanisms are only part of the design. Recovery must preserve manual control |
| 6 | Simple setup and distribution | Unified onboarding, OBS/model dependency checks and installation progress, readiness explanations, public OAuth application preparation for ordinary users, installer/signing/update/rollback and clean-PC acceptance. Self-built setups still need developer application configuration. X still uses Live Studio; the launcher is not reboot recovery |
| 7 | Complete avatar/layout editing | Live2D or external avatar integration, richer expressions/motions, mirror/crop/layer order/snapping/undo, fonts/opacity/themes, persona/layout import/export, portrait 9:16 and multiple resolutions. Current base canvas is fixed at 1920×1080 |
| 8 | Platforms and performance | Bilibili/TikTok are not implemented; X comments are absent. Establish account eligibility and available interfaces for each platform, verifying read/write/ingest independently. Test five-output bandwidth/GPU load before shared capture, multiple canvases or optional relaying. Three OBS instances currently add resource overhead |
| 9 | Game reuse | Adding installed Steam games for manual capture does not provide arbitrary-game autonomy. A second game, adapter SDK/compatibility matrix and independent regressions follow stable ETC acceptance |

## Autoplay belongs to the other session

ETC native API, local tactics and optional JEV advice are committed. The latest repository acceptance record says Steam build 25364079 did not connect to API v3 and completed zero autonomous matches. The responsible session must ship the compatible game, update Steam and validate complete matches, followed by hazardous rooms, stuck recovery, path/weapon tactics and longer win-rate testing. This review does not modify that implementation or count old OCR-input tests as acceptance of the new controller.

## Current endurance finding

The first sampled increases occurred at approximately 19:10:45: three errors for each overlay. All outputs were still active at review time, with no recorded model/synthesis failures. This does not establish uninterrupted playback. The current `audioErrors` counter also includes state-request failures, so it is not evidence of three corrupt audio files. No two-hour completion report existed; merely reaching the duration would not pass the current criteria with those errors.

The running test started an earlier build than the later merged/packaged candidate. After fixing the findings, record the exact commit, game build and scope and rerun one release candidate. The temporary game-preference restoration monitor is waiting for this test process to exit.

## Recommended next milestone

Resolve overlay errors, switch to the new desktop build and verify actual platform chat, delivering two hours of stable automatic hosting during manual gameplay. Then improve natural speech and recovery and run 8/24/72-hour stages. Keep autoplay development in its separate session; combine the two only after independent acceptance. Add Bilibili/TikTok and advanced layouts once the core flow is stable.

References: [hosting acceptance](HOSTING.en.md), [local models](LOCAL_HOST.en.md), [ETC autoplay](ETC_AUTOPLAY.en.md), [complete design](DESIGN.en.md).
