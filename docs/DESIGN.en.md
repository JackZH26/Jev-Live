# JEV Studio: research and complete product design

[简体中文](../JEV-虚拟主播软件-调研与完整设计方案.md) · [English](DESIGN.en.md)

**Creator: JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj) — follow along and join the discussion.**

Research date: 2026-09-20. Windows first. JEV Studio is a working product name; check naming and trademarks before release.

**Updated requirement: the product starts from the Steam library.** Add installed games, choose the game to stream and launch it through Steam. The first test target is **Enter the Cube Playtest, AppID 5272970**. Ordinary streamers need no development project, source code or Unreal editor. The ambition is broad game support, with capture/streaming and autonomous-control compatibility shown separately. Phase 1 now prioritizes Steam selection, Playtest automation and YouTube/Twitch/X outputs; avatars, speech and chat follow. The UI supports Simplified/Traditional Chinese, Japanese, Korean and English; documentation has Chinese/English editions. Original code uses MIT. This document includes future architecture; the [acceptance record](PHASE1_STATUS.en.md) identifies implemented and tested capabilities.

## Recommendation and the two-mode contract

The research did not identify a verified open-source product combining arbitrary Steam-game autonomy, natural virtual hosting, bidirectional chat on five platforms, independent layouts, 24-hour recovery and simple configuration. Build a streaming studio around reusable AIRI avatar/audio components, JEV structured decisions, game adapters, OBS composition, platform connectors and a separate supervisor.

| Capability | Autoplay | Manual play |
| --- | --- | --- |
| Movement, camera, attacks, interaction and game menus | AI decisions and execution | User keyboard/mouse/controller |
| Game observation and event understanding | Automatic | Automatic |
| Commentary and spoken viewer answers | Automatic | Automatic |
| Text replies on supported platforms | Automatic | Automatic |
| Expressions, lip sync and captions | Automatic | Automatic |
| Layouts, multistreaming and stream recovery | Shared implementation | Shared implementation |

Switching modes must preserve broadcasts, avatar state and chat connections. Manual play is a complete everyday mode: the user plays while the virtual host presents and interacts. Games without automatic control can still use manual play and the same interaction system. Commentary uses available state or visual observations and only claims confirmed events. Platform text permissions apply equally to both modes.

Owning ETC makes a future game-side state interface possible, but it is optional and cannot become a prerequisite for ordinary streamers. Initial Steam integration must operate against the installed game. A future explicitly enabled bridge can supplement observation if shipped with a compatible game build.

Three architectural constraints matter: JEV does not take images or generate free text; multistream transport and platform chat are separate capabilities; Twitch simulcasting rules constrain cross-platform chat burned into its output. These require separate observation, language and per-destination composition layers. [JEV capabilities](https://docs.typesafe.ai/concepts/system-one), [Twitch terms](https://www.twitch.tv/p/terms-of-service#11-simulcasting).

Parameters, schedules and acceptance targets below are proposals. Research checked repositories and selected source files, not every installation. The accompanying HTML prototype is a layout concept without account connections or streaming. Later implementation results belong in the acceptance record.

## 1. GitHub research and selection

Dates below are GitHub API `pushed_at` dates, not release dates, default-branch commit dates or evidence of stability. The [snapshot](../research/github-snapshot-2026-09-20.json) retains source metadata.

| Project | Reusable capability and intended role | Gaps / license / push date |
| --- | --- | --- |
| [AIRI](https://github.com/moeru-ai/airi) | Main avatar/audio foundation: Live2D, VRM, audio pipelines, model providers, character state and game experiments | Not generic Steam support or an unattended broadcast product. MIT; 2026-09-20 |
| [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | Alternative/reference for real-time speech, interruptions, vision, proactive speech and local models | Avoid running two overlapping primary hosts. LICENSE is MIT; sample Live2D assets have separate terms. 2026-05-15 |
| [AI-Vtuber](https://github.com/Ikaros-521/AI-Vtuber) | Chinese AI-streaming operations, chat events, TTS and avatar integrations | Re-test every connector; a README platform list is not compatibility certification. GPL-3.0; 2025-07-29 |
| [Social Stream Ninja](https://github.com/steveseguin/social_stream) | Optional browser-based message aggregation and overlays | Prefer official APIs for the main path; website changes create maintenance work. GPL-3.0; 2026-09-18 |
| [OBS WebSocket](https://github.com/obsproject/obs-websocket) | Required scene, source, audio and output control | Built into OBS since 28; does not itself provide five independent canvases. GPL-2.0; pin with OBS compatibility |
| [obs-multi-rtmp](https://github.com/sorayuki/obs-multi-rtmp) | Same-picture multistream experiments | Does not solve independent layouts, broadcast creation, authorization or chat. GPL-2.0; 2026-08-01 |
| [Aitum Vertical](https://github.com/Aitum/obs-vertical-canvas) / [Multistream](https://github.com/Aitum/obs-aitum-multistream) | Important future multi-canvas/output foundation; source exposes canvas objects and vendor WebSocket operations | Validate multiple landscape/portrait canvases, audio tracks and monitoring before adopting. GPL-2.0; 2026-08-24 / 2026-05-19 |
| [MediaMTX](https://github.com/bluenviron/mediamtx) | Optional self-hosted media relay, conversion and recording; native forwarding documented | No account, chat, avatar or game intelligence. MIT; 2026-09-19 |
| [blivechat](https://github.com/xfgryujk/blivechat) | Bilibili comments, gifts, styles and identity-code onboarding reference | Feed normalized events into the studio's own layout system. MIT; 2026-08-19 |
| [TikTok-Live-Connector](https://github.com/zerodytrash/TikTok-Live-Connector) / [TikTokLive](https://github.com/isaackogan/TikTokLive) | Experimental unofficial LIVE events | Reverse-engineered, not guaranteed production-ready; verify signing services, stability and sending separately. Current licenses include AGPL/additional terms; inspect pinned versions |
| [jev-browser](https://github.com/jkudish/jev-browser) | JEV selection from accessible browser controls, budgets, stopping and logs | Useful onboarding/browser reference, not native Steam control. MIT; 2026-09-19 |
| [Cradle](https://github.com/BAAI-Agents/Cradle) | Screenshot perception, keyboard/mouse execution and game skills | Future visual-adapter reference, not universal plug-and-play support. MIT; 2024-11-07 |
| [Voyager](https://github.com/MineDojo/Voyager) | Minecraft skill accumulation and evaluation | Research inspiration, not FPS control or a streaming foundation. MIT; 2024-04-03 |

AIRI is recommended because its character, speech, Web rendering and agent work aligns with several required layers. This is an architectural judgment, not a claim that it already supports continuous broadcasting. Pin tested commits and wrap reused internals in `AvatarEngine`, `SpeechEngine` and `PersonaEngine`. Review `stage-ui-live2d`, `stage-ui-three`, `pipelines-audio` and `core-character`; these are internal components, not assumed stable public SDKs. Keep upstream patches small and retain provenance.

The initial desktop implementation does not yet incorporate AIRI. It establishes the Steam, control and broadcast foundations first, following the updated priority.

## 2. JEV responsibilities and game compatibility

The locally configured `@jkudish/jev-browser` service operates accessible browser controls; it does not control native Steam games. At the original research stage this workspace had no application/game source or tested ETC control integration. Subsequent tests are recorded separately.

JEV provides Choice, Score and Noul outputs from text, JSON or text arrays. It does not accept image/audio/video input or write dialogue. Confidence is not a guarantee of a correct action and needs calibration against game replays. [Concepts](https://docs.typesafe.ai/concepts/system-one), [models and limits](https://docs.typesafe.ai/models), [confidence](https://docs.typesafe.ai/confidence).

| Layer | Responsibility | Proposed initial cadence |
| --- | --- | --- |
| Observation | Player-visible state, resources, events, menus; screenshots transformed into structured facts | Local and event-driven; richer future interfaces about 10–20 Hz |
| JEV | Choose allowed goals/actions: advance, retreat, supply, target, skill or menu | About 1–2 Hz or significant events, adjusted by measurements |
| Local controller | Movement, camera smoothing, aiming timing and release | About 30–60 Hz; independent of network latency |
| Host director | Choose commentary, viewer answers, brief reactions or silence | Event-driven rules, optionally JEV scoring |
| Language and voice | Short persona dialogue, speech and lip sync | Separate asynchronous LLM/TTS pipeline |

These are starting parameters, not measured performance. Vendor latency is not this machine's network P95 or proof of per-frame FPS control. Network failure must never prevent input release.

**Steam-first adaptation.** Read local installation manifests, let the user add/select games, launch through Steam and identify the actual game process. Store AppID, build range, installation identity, supported modes, window rules, menus, controls and regression fixtures in a versioned adapter. Do not guess AppIDs from screenshots. Phase 1 tests the installed Playtest with screen-text observation and bounded input; OCR alone cannot locate every enemy or infer the full world.

An optional future `ETC Game Bridge` can expose player-perceptible state and finite actions in a released compatible build. Do not expose hidden enemy positions by default. Validate first in bot matches or explicitly permitted environments. State can contain session/sequence IDs, game time, lobby/combat/death/results/loading phase, health/resources, visible targets, legal actions and recent events. Actions can select targets, navigate, attack, reload, interact, respawn or start the next local match. Verify effects through acknowledgements and fresh observations.

Every action carries an observation version, deadline, ID and `controlEpoch`. Check game instance, player state, action preconditions and current automatic ownership before execution. Reject stale/duplicate actions and release inputs on short lease expiry. A keyboard/mouse adapter pauses when its selected game loses focus and never targets another application.

Observation is read-only and shared by both modes. Manual play disables all automatic movement, menu operation, injection and bridge writes. The host director may continue using JEV for topic selection or comment scoring. Automatic-to-manual switching revokes ownership, increases the epoch, cancels queued/in-flight decisions and releases only AI-held inputs. The executor independently rejects old epochs. Manual-to-auto switching checks support, the window and fresh observations before acquiring ownership; failure leaves the user in manual mode.

Mode, stream start/stop, automatic-control pause and host mute have independent state. Preserve memory, reply queues, current speech, mute and platform broadcast IDs during switching. Provide a configurable takeover shortcut.

Example internal protocol, not the raw TypeSafe API format:

```json
{"sessionId":"example-session","controlMode":"auto","controlEpoch":7,"stateSeq":381,"phase":"combat","player":{"hp":28,"ammo":4},"facts":{"visibleThreats":2,"coverReachable":true},"allowedActions":["take_cover","reload","engage_visible_target"],"deadlineMs":500}
```

| Compatibility label | Basis | User promise |
| --- | --- | --- |
| Verified automatic control | Approved API/mod/bridge or thoroughly tested adapter | Both modes for specified game builds |
| Experimental automatic control | Visual/OCR state plus JEV and local actions | Autoplay may need display/control calibration; manual interaction remains shared |
| Automatic control unavailable | Capturable game with stated observation limits | Manual play/streaming available; automatic button explains the limitation |

Broad compatibility requires an adapter ecosystem, not one prompt. Re-run startup/replay checks after game updates and remove verified status if they fail. Game packages also include launch/popup handling, training scenarios, stuck detection, reconnect/next-match flows and HUD safe areas.

## 3. Architecture and technology

```text
User input ------------------------> Steam game (manual)
JEV decisions -> ownership gate ---> game input adapter (auto)
Steam game -> read-only observation -> game events -----+
Platform chat -> connectors -> normalized event queue --+-> host director -> LLM
                                                           |                |
                                                     reply routing      streaming TTS
                                                           |                |
Game capture ------------------------------------------- OBS <--- avatar / lip sync
                                                           |
                                                independent platform outputs
Desktop studio: accounts, Steam library, persona, mode, layout, start/stop
Supervisor: state machines, heartbeats, budgets, recovery, logs, stop
```

| Part | Proposed implementation and reason |
| --- | --- |
| Desktop | Electron + Vue + TypeScript, compatible with AIRI/Web stages |
| Scheduling/events | Typed TypeScript services; restart connectors independently |
| Layout editor | DOM/Canvas transforms and one layout model shared by preview/export/OBS |
| Durable data | Versioned local configuration; SQLite for later event/layout history and recovery |
| Supervisor | Independent process in a Windows login session; survives UI failure |
| Game adapters | Shared observation and ownership-gated actions, with Steam as the normal entry |
| OBS | WebSocket v5; initially isolated instances, later verified Aitum integration/extensions |
| Avatars | AIRI Live2D/VRM adapters and an authorized default model |
| Optional local speech | Packaged Python worker; ordinary users should not install Python or edit YAML |
| Relay | Optional MediaMTX plus independent output workers; no server required by default |

Windows is the first supported system; expose portable interfaces but verify game/capture support separately on other systems. Keep control and media independent: a chat fault must not stop gameplay, a JEV fault must not stop audio capture, and hiding the UI must not end a stream. Game and host speech have separate audio tracks.

## 4. Simple onboarding and daily operation

1. **Connect platforms:** open official authorization in the system browser; expose RTMP address/key fields only when required. Show streaming, chat receive/send and recovery capabilities independently.
2. **Add/select a Steam game and mode:** scan installed libraries, show build/support status and prioritize Playtest in the first test. Choose autoplay or manual play. Unsupported automatic control does not block manual hosting.
3. **Choose the host:** authorized default avatar, voice, language, personality and talkativeness; optional VRM/Live2D/persona imports.
4. **Arrange outputs:** full-game background, lower-left avatar, right-side chat; drag/resize with per-platform and portrait previews.
5. **Check a preview:** test voice, game-only capture, levels, permissions and budget. Only the explicit start action sends output to platforms.

Daily controls reduce to host, game, mode, destinations and start. Remember preferences, retain mode switching on the home page/floating controls, and put advanced configuration elsewhere. Orchestrate performance checks, refresh, avatar startup, requested Steam launch, OBS scenes and platform broadcasts. Manual play must not wait for an automatic-adapter check.

“One click” presumes streaming eligibility, valid authorization and working capture/interaction; autoplay additionally requires a supported adapter. Software cannot remove initial platform activation, CAPTCHAs, review or reauthorization. YouTube notes initial activation can take up to 24 hours. [Encoder streaming](https://support.google.com/youtube/answer/2907883).

Future multi-platform startup may report partial success and offer a saved preference for “any available destination” or “required primary destination.” Disabled platforms must not block authorized ones. Phase 1 uses a transaction across selected YouTube/Twitch/X outputs; it does not yet implement the future partial-start policy.

For ordinary distribution, maintainers register platform applications and complete applicable review/quotas. Use supported public-client flows; confidential server credentials belong in an optional authorization service, not a desktop installer. Source/self-hosted distributions can provide their own application IDs/services at the cost of one-time setup. A hosted authorization service should also be open-source and replaceable. [Google native OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Twitch authorization](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/).

## 5. Platform capability matrix

This describes interface feasibility, not verified permissions for a particular account. Probe and label each capability separately as official, experimental or unavailable.

| Platform | Video / broadcast creation | Chat receive | Text replies | Product priority |
| --- | --- | --- | --- | --- |
| YouTube | Eligible channels and authorized Live API resources | Official Live Chat API; evaluate `streamList`, otherwise honor polling intervals/quotas | Official `liveChatMessages.insert` with authorization/limits | First |
| Twitch | Official login, stream credentials and channel metadata | Official EventSub | Official Send Chat Message API | First; isolate its output chat |
| Bilibili | Verify room eligibility and credentials separately from broadcast APIs | Prefer official Open Live with application/identity-code/project eligibility | No general applicable official send path confirmed in this research | Receive comments and answer by voice first; text conditional |
| TikTok | Depends on account, region, LIVE and external-ingest access | Common libraries are unofficial reverse engineering; third parties optional | No stable universal official send interface confirmed | Conditional/experimental; no unattended promise without access |
| X | Official Live Studio RTMPS implemented and private ingestion verified; create events on X | No general ordinary-developer LIVE chat API confirmed | Post replies are not LIVE chat | Video first; unverified interaction slot |
| Other RTMP | Evaluate a valid official ingest supplied by the user | Separate connector needed | Separate connector needed | Custom RTMP does not mean full platform support |

Sources: [YouTube live chat](https://developers.google.com/youtube/v3/live/docs/liveChatMessages), [Twitch chat](https://dev.twitch.tv/docs/chat/send-receive-messages/), [Bilibili Open Live](https://open-live.bilibili.com/), [TikTok LIVE access](https://www.tiktok.com/live/studio/help/article/Before-you-go-LIVE/Apply-for-LIVE-access?lang=en), [unofficial TikTok connector](https://github.com/zerodytrash/TikTok-Live-Connector), [X Live Studio](https://help.x.com/en/using-x/live-studio).

Some TikTok help pages restrict retrieval, and some Bilibili documentation requires login/client rendering. This research did not test those user accounts or infer universal API access. Re-check policies and automation permissions before shipping each connector. A voice/subtitle answer is not a successfully sent chat message. If comments cannot be received, video may remain available without invented messages or interactions.

## 6. OBS, independent outputs and aspect ratios

The reference composition is game video, a lower-left half-body avatar and vertically arranged chat on the right. Reuse that structure, not another creator's character assets. Distinguish the private aggregated moderator panel, overlays burned into the video, and the platform app's native chat UI. The software can position the overlays, not resize viewers' native chat panels.

Each platform chat layer has independent selection, drag/scale, lock/hide, font, opacity, message count/lifetime, gifts, filters and destinations. A full-chat panel and “question currently being answered” can be separate components.

| Output | Default composition | Chat rule |
| --- | --- | --- |
| YouTube | 16:9, full game, avatar, captions | YouTube by default; additional layers only after policy checks |
| Twitch | 16:9, comparable quality and attention | Twitch messages/alerts only; no other-platform chat or follow/gift activity |
| Bilibili | 16:9 with Chinese captions | Bilibili comments, optional suitable scrolling |
| TikTok | 9:16, fitted/cropped game above avatar/chat | TikTok by default; reserve platform controls/caption safe areas |
| X | Verified landscape encoding preset | Hide chat until a connector is usable |
| Moderator preview | Local aggregation | Never confuse this with the public output |

Twitch distinguishes privately using aggregation tools from merging outside-platform activity into a broadcast. Separate overlay boxes do not eliminate that constraint; validate destination layouts automatically. [Simulcasting FAQ](https://help.twitch.tv/s/article/simulcasting-guidelines?language=en_US).

Prefer capturing/rendering shared game/avatar sources once and composing destination scenes with their own chat/captions. Aitum integration requires proof that IDs, multiple landscape/portrait canvases, layer CRUD, independent encoding/audio and recovery states are controllable. Source inspection found the `aitum-vertical-canvas` vendor and operations for scenes/status/stream control/addresses, but did not validate all five-output requirements. Missing operations need appropriately licensed plugin work; ordinary OBS `StartStream` cannot be assumed to start every output. [Vertical source](https://github.com/Aitum/obs-vertical-canvas/blob/main/vertical-canvas.cpp).

Managed OBS instances are an acceptable early validation/fallback path, with separate profiles, ports and explicit capture strategy, at additional resource cost. Phase 1 uses this path. Converge on one multi-canvas OBS only after stability and controls are demonstrated.

A relay can distribute an identical encoded picture once. Different chat pictures or codec settings require independent variants; forwarding does not replace overlays inside compressed video for free. MediaMTX forwards; transcoding/filtering requires media workers. Default to local direct outputs. “One upload, five different pictures” needs cloud composition, avatar/caption synchronization, rendering and encoding, with additional cost and operations. [MediaMTX forwarding](https://mediamtx.org/docs/features/forward).

## 7. Persona, voice and natural hosting

A persona package contains a model, expressions, motion, voice, personality, topics, game knowledge and asset rights. Ship an original or clearly redistributable default. Importers detect model versions and expression/lip-sync parameters. Use AIRI Live2D/VRM stages, optionally integrate external VTube Studio workflows; published API documentation does not make the application itself reusable open-source code. [VTube Studio API](https://github.com/DenchiSoft/VTubeStudio), [three-vrm](https://github.com/pixiv/three-vrm).

Both gameplay modes share persona, voice, timing, moderation, memory and reply policy. In manual mode the host still observes/commentates without requiring user speech or typing, and does not invent player intent. A human microphone is an optional independent source.

| Situation | Host behavior | Queue policy |
| --- | --- | --- |
| Intense combat | Brief reaction; let game audio lead | Defer long answers |
| Travel / exploration | Explain the next confirmed goal or answer a question | Use relevant recent messages |
| Lobby / loading | Greet viewers and discuss next-match plans | Consume valid questions, expire old ones |
| Results | Short factual review, acknowledge mistakes, set a goal | Do not invent actions or performance |
| Useful question | Address the viewer with game/context knowledge | Route back to its platform |
| Repeated questions | Summarize the shared question | Deduplicate and reserve attention across platforms |
| Quiet period | Brief thought or comfortable game audio | Cooldowns/topic rotation, no mechanical monologue timer |

Start testing around 15–30% speaking time with quiet/balanced/active settings and human review, not as a guaranteed ideal. Keep sentences short during action. Pipeline: dedup/filter → relevance/answerability → director → short dialogue → content check → TTS/playback/captions → authorized origin-platform reply. Track actual playback and successful sending separately from generation; reconnects must not duplicate replies.

Start with one speaking voice. Speech follows the host's primary language; text can follow viewers' languages. Independent platform dubbing later needs separate voice/lip-sync clocks and encoding. Memory separates persona, current match, short topic summaries and opt-in viewer memory. Namespace viewer IDs by platform; do not merge names into assumed identities. Provide retention/deletion and avoid sensitive-attribute inference. Chat cannot install plugins, change keys or execute desktop commands.

## 8. Visual language and layout editing

Use the requested iOS 27-inspired direction as an original desktop design, informed by Apple's Liquid Glass material, readable contrast and adjustable transparency. Glass belongs in navigation, floating controls and short cards; use stable backgrounds for logs/errors/long text. [Apple material introduction](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/).

The eventual main areas are Studio, Host, Games, Platforms and Activity. Combine the home view and editor: central canvas, output switcher above, layers left, properties right. Prominent automatic/manual selection states that voice/text interaction remains automatic. Floating controls contain mode, pause automatic actions, mute and end. Hide automatic-action pause during manual play and explain who controls the game.

Suggested styling: graphite and mist-white themes, restrained blue-violet light, 20–28px card radii, capsule primary controls, 160–240ms transitions. Support reduced motion/transparency; status uses text as well as color. The initial app uses five localized catalogs; technical identifiers remain unchanged. Display the author's X prominently in the sidebar and both README editions.

Save normalized coordinates and anchors, not only fixed pixels:

| Element | Example 1920×1080 template | Editable properties |
| --- | --- | --- |
| Game | Full canvas, preserved aspect ratio | Fit/fill/crop, HUD safe regions |
| Avatar | Lower-left, about 18% canvas width / 42% height | Position, proportional scale, crop, mirror, anchor, layer order |
| Chat | Right side, about 22% width / 52% height | Independent per-platform dimensions, font, opacity and destinations |
| Host captions | Bottom-center clear of HUD | Up to two lines, style, language, duration |
| Status | Top safe region | AI-host identification, program phase, recovery notice |

Enable only the current destination's chat by default; Twitch excludes external chat. Provide snap guides, margins, locking, undo/redo, keyboard nudges, numeric input, layout duplication and actual-destination previews. The concept HTML demonstrates these interactions with simulated game/chat/character data and never sends real input.

## 9. Continuous operation and recovery

Twenty-four-hour operation is a service goal, not an assumption that every platform session is unlimited. Separate the global show from platform broadcast/chat IDs. A platform can roll over while other outputs and gameplay continue. Manual progress remains user-driven; absence must not silently grant AI control. Recovery that moves, respawns, navigates menus or restarts a game obeys the chosen mode.

State flow: idle → preflight → prepare game/avatar/media → preview verification → start destinations → running → local degradation/recovery → stop external output, save state and release input. Distinguish intentional stop, platform end and disconnection; never automatically undo the user's End command.

| Failure | Recovery | After retry limit |
| --- | --- | --- |
| JEV timeout/rate limit | Discard stale actions; local fallback or pause; shared interaction scoring degrades independently | Keep media/available interaction; manual game input remains unaffected |
| Game freeze/crash | Recovery composition and explanation; auto may restart specified game, manual waits for user/requested restart | Stop restart loops, hide desktop dialogs, preserve mode |
| LLM failure | Approved brief recovery copy; expire old replies | Keep game running; avoid repeating one line |
| TTS failure | Captions and resting mouth, optionally backup provider | Explicit caption-only state |
| One platform disconnects | Independent reconnect/refresh/recreate, preserved dedup cursors | Disable that destination only |
| OBS exits / black or frozen video | Supervisor restarts dedicated setup and verifies all sources/audio | Explicit error; only a predeployed remote node can display fallback during host loss |
| Disk full | Stop optional recording; clean only this app's cache by retention rules | Never silently delete unrelated recordings/files |
| Network lost | Drop stale speech backlog; preserve context; revalidate platform sessions | Apply configured auto/output policy without injecting manual-game commands |
| Windows restart/power loss | Configured startup in an available interactive login session | A single machine cannot stream without power/login; high availability needs another node |

Windows games/capture need an interactive session; Session 0 alone cannot guarantee recovery. Detect sleep, lock, driver and audio-device changes without secretly changing automatic login/password policy. YouTube streams over 12 hours may not archive fully; offer continuous-room plus segmented local recordings, or roughly 8–10-hour broadcast sessions for archiving. Session rollover changes links/chat IDs and viewer continuity. [YouTube archiving](https://support.google.com/youtube/answer/6247592).

Suggested supervisor heartbeat: 2–5 seconds, measured against resources. “Live” requires platform state or playback evidence, not OBS bytes alone. Track playable time, frozen frames, silence, gameplay progress, response latency, queue sizes, memory/VRAM and cost. Record into a tested interruption-tolerant format in roughly 30–60-minute segments, optionally export MP4, and retain previous releases/configuration rollback for maintenance.

## 10. Permissions, secrets and content

Use Windows system encryption/Credential Manager or DPAPI. Exported personas/layouts contain no accounts or tokens. Authenticated OBS WebSocket access stays local. Models receive only necessary game/comment context, not stream keys. OBS's own service files require special protection because OBS does not encrypt them; keep all runtime data outside Git.

Connectors/game packages declare capabilities and provenance. Treat comments and OCR as untrusted data, sanitize HTML, never execute scripts or arbitrary URLs, and gate all model actions. Scope text sending by channel, length, rate and recipient; never bulk-replay a stale queue after restart.

Identify the AI host visibly and expose platform-required disclosure options. YouTube's realistic altered/synthetic-content rules should not be generalized to every cartoon avatar. [Disclosure guidance](https://support.google.com/youtube/answer/14328491). Natural hosting means timing, emotion and truthful game reactions, not impersonation. Ship authorized voices/models/music and retain their rights with asset packages. Do not bypass anti-cheat; use permitted automation environments. Platforms/accounts that disallow unattended operation need assisted operation.

## 11. Performance, network and ongoing cost

The original read-only hardware inventory found a Core Ultra 7 265K, RTX 5070 Ti with about 16 GB VRAM, and roughly 127 GiB usable RAM (typically marketed as 128 GB). This is a test candidate, not proof of five-output performance. RAM does not remove GPU/encoder limits.

Updated 2026-09-20: use local Ollama with Qwen3.5-4B Q4_K_M and local speech at the user’s request. Start with CPU inference on eight threads; reserve the GPU for game and OBS, with GPU hosting optional and no cloud fallback. See [deployment and measurements](LOCAL_HOST.en.md). Limit game frames and monitor VRAM/render/encoder drops. X now uses 1080p60, AAC 128 kbps and three-second keyframes, verified with three local encoders. The earlier actual private X test used 1080p30 and does not certify platform ingestion at 60 fps. [X encoding guidance](https://help.x.com/en/using-x/live-studio).

Illustrative bandwidth: five 6 Mbps video outputs total 30 Mbps; plan roughly 40–50 Mbps stable usable upstream including audio/overhead and test the target regions. One 6 Mbps output is about 64.8 GB/day or 1.94 TB/30 days; five relay outputs about 9.72 TB/month before overhead. This is planning math, not a measured connection.

The researched JEV price was $0.042 per million input tokens with free output; prices/rate limits must be refreshed rather than treated as permanent. Assuming 1,000 billed input tokens per request, constant operation and no extra scoring/retries:

| Rate | Requests/day | Input/day | JEV-only cost/day |
| --- | ---: | ---: | ---: |
| 1/second | 86,400 | 86.4M tokens | about $3.63 |
| 2/second | 172,800 | 172.8M tokens | about $7.26 |
| 5/second | 432,000 | 432M tokens | about $18.14 |

Use events, compressed state, reuse on unchanged situations and no decisions while loading; compute costs from actual provider usage and re-evaluate pinned model upgrades. [Model pricing](https://docs.typesafe.ai/models).

Total cost is JEV + language-model input/output + speech duration/characters + optional vision + relay compute/egress + storage + electricity. At 20% speaking time, approximately 288 speech minutes/day need pricing. Manual mode stops game-action decision calls while retaining observation, directing, language, voice and replies. Show hourly/daily budgets and estimated remaining time; reduce optional chatter/expensive vision first, then apply the user's fallback policy. State explicitly when autoplay cannot continue.

## 12. Open-source distribution and licenses

Original studio/orchestration code is MIT, credited to **JackZH26 and contributors**. Preserve copyright on reused AIRI code. OBS/Aitum modifications retain their applicable GPL with source, builds and notices. Do not casually link GPL-2.0/GPL-3.0 components or assume process separation removes every obligation; review exact pinned dependencies/distribution.

External Social Stream Ninja/AI-Vtuber integrations keep their licenses; copied GPL code cannot be relabeled MIT. TikTok connectors include additional terms requiring current review. Live2D SDK and sample/model assets have separate rights; prioritize original, clearly redistributable defaults. [Open-LLM-VTuber license](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/blob/main/LICENSE), [Live2D distribution terms](https://www.live2d.com/en/sdk/license/), [TikTok connector license](https://github.com/zerodytrash/TikTok-Live-Connector/blob/master/LICENSE).

Open-source software/protocols do not make JEV, TTS, platforms or model weights open-source. Keep providers replaceable; baseline rules are a fallback, not equivalent JEV intelligence. Organize desktop, supervisor, avatar/audio, game adapters, connectors, OBS extensions, notices and replay fixtures distinctly. Publish reproducible build instructions, interface versions, compatibility tables, changelogs and migrations. Stable releases pin dependencies; a test channel checks upstream changes. Never commit secrets or private runtime data.

## 13. Delivery stages

The original planning estimate assumed 2–3 experienced desktop/media/game developers plus part-time design/testing and optional ETC source access. It excluded platform review, asset production and access approvals, and needs re-estimation after risk validation. The updated first milestone is Steam selection + Playtest autoplay + YouTube/Twitch OAuth and X Live Studio RTMPS outputs. See [X setup](X_SETUP.en.md) for event and visibility management on X.

| Stage | Original planning range | Deliverables and gate |
| --- | --- | --- |
| 0: risky paths | 1–2 weeks | Steam installed-game selection, observation/actions, ownership switching, JEV replay evaluation, AIRI speech/lip-sync experiments, OBS independent-output proof. Gate: real game actions, zero AI input in manual mode, acceptable resources |
| 1: desktop alpha | 3–4 weeks | Simple onboarding, both modes, default host, game package, layout editing, YouTube/Twitch official chat, feasible Bilibili entry. Gate: 2–8-hour operation and correct interaction/recovery/stopping |
| 2: all-day beta | 3–4 weeks | Supervisor, refresh, budgets, session rollover, recording, three distinct outputs, conditional TikTok/X. Gate: 24/72-hour tests and truthful capabilities |
| 3: reusable release | 2–4 weeks | Second game adapter, SDK, packaging/update, licensing, bilingual docs and optional relay. Gate: new users configure it and new games do not require core changes |

The original overall 9–14-week range is conditional, not a fixed delivery promise; one developer should extend it/reduce launch scope. Complete interaction on every platform cannot be promised without confirmed interfaces. The intended reusable release offers specified-game autoplay/manual switching, shared automatic commentary/answers, one replaceable avatar, supported-destination launch, independent avatar/chat layouts and recoverable operation.

## 14. Acceptance and remaining validation

| Area | Acceptance approach |
| --- | --- |
| Simple setup | Unfamiliar user with eligible accounts targets local preview within 10 minutes; external reviews counted separately |
| Steam flow | Add/select installed game, launch through Steam, identify actual process/build; no development-project dependency |
| Autoplay | Fixed builds/maps/seeds/tasks, repeated full matches without user input; measure success/stuck/recovery versus baseline, not selected clips |
| Manual play | User devices work; no AI inputs/writes; the same automatic hosting/reply pipeline remains active |
| Mode switch | Both directions before/during stream; release AI inputs, reject late actions, retain IDs/chat/memory/audio/mute; failed takeover stays manual |
| Shared interaction | Inject equivalent game events/questions into both modes; same policy/permissions, dedup, captions/lip sync, no duplicate or discarded replies on switch |
| JEV quality | Replay actual observations; action-specific success, latency, uncertainty, disconnect/stale-state/rate-limit tests |
| Natural host | Human blind review of naturalness, relevance, repetition and interruption, not volume of speech |
| Reply latency | Initial local-queue-to-audio P95 target under five seconds; platform delivery latency measured separately |
| Platform isolation | Unique messages on each platform; inspect actual video and reply destinations, especially Twitch isolation |
| Audio/video | Borders, HUD obstruction, lip sync, captions, echo, duplicate audio, mute and true portrait dimensions |
| Endurance | 2h → 8h → 24h → 72h; report productive gameplay, playable output and recovery time separately |
| Recovery | Terminate game/connector/OBS; inject network/token/disk faults; initial recoverable-fault target under 120s, reauthorization separate |
| Security/stop | Chat cannot execute privileged commands; stop blocks new audio/output and releases input; intentional stop never auto-restarts |
| Reuse | Add a second adapter while reusing persona/platform configuration; prove the core is not an ETC-only wrapper |

Still validate richer Playtest visual perception and reliable aiming/navigation; multi-canvas APIs and five-output load; actual account eligibility and public OAuth review; Bilibili/TikTok/X sending; exact model/asset distribution rights. These determine release scope. Proceed through reproducible Steam + dual-output milestones, then avatars/automatic interaction, Bilibili and endurance, followed by eligible TikTok/X connections and a second game. Preserve actual viewer-side evidence at each stage.
