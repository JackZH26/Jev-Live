# A practical plan for a more natural game host

[简体中文](NATURAL_HOSTING.md) · [Mobile reading edition](NATURAL_HOSTING.html)

Date: 2026-09-21. Reviewed baseline: `61f60e1`. Author: JackZH26 · [𝕏 @jackzhj](https://x.com/jackzhj).

**This is a proposal, not an implemented or accepted feature.** Evidence comes from source code, selected non-sensitive saved settings, and earlier local measurements. The reported stream has not been timed frame by frame, so its exact delay remains unverified.

Additional delivery in this iteration: [chat replay and multilingual spoken replies](CHAT_REPLAY.en.md). That test entry point and language routing are implemented; the broader architecture remains proposed. Hosting defaults to English, supported comment languages receive matching replies, and other languages fall back to English.

## 1. Recommended experience

Build a host that continuously tracks the situation, chooses worthwhile moments, reacts briefly, expresses adopted intentions, and uses prepared topics during downtime. Reuse ETC/JEV, Ollama, MeloTTS and OBS. Improve information and scheduling before replacing speech models.

Continuity matters: wanting a primary weapon leads to investigating a chest, abandoning it when threatened, acknowledging a successful pickup, and possibly joking about an actual mistake later. Randomness changes expression, never facts or the character's identity.

Prioritize the installed Steam ETC game. In automatic mode, express adopted actions; in manual mode, describe observations or offer suggestions without pretending to control the player. Hosting remains independent of gameplay and broadcasting. Keep the disclosed AI identity.

## 2. Verified causes

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Sparse commentary | `shared/hosting.ts:18`: 40-second interval, 90 generations/hour; saved settings match | Only 1.5 generations/minute on average; replies and failed/discarded attempts consume the same allowance |
| Quiet downtime | `host-director.ts:14` multiplies non-playing intervals by three | Stable menus/loading normally get a 120-second interval |
| Missing game awareness | `main.ts:64` sends title, connection, phase and OCR | Health changes, objectives, JEV choices and execution feedback never reach the host |
| Serial latency | `host-model.ts:13` requests `stream:false`; `hosting.ts:36` waits for complete WAV | Full text and complete speech synthesis must finish before first audio |
| Poor interruption | `hosting.ts:37` waits for utterance expiry: at least 10 seconds or audio duration plus four | Completion does not directly release the floor; urgent events cannot preempt; phase stabilization also takes three seconds |
| Stale speech | Non-chat `stillRelevant` always returns true | A changed room, cancelled objective or death can leave old commentary eligible |
| Repetition | Temperature is already 0.7; short text history and exact-string checks | Rephrased “keep observing” comments survive without topic or story memory |

Saved settings use Qwen3.5-4B on CPU and MeloTTS. Earlier CPU warm full-text requests had a 5.45-second median; a Chinese Melo short sentence took 1.34 seconds. These are separate samples, not one end-to-end trace, but the serial implementation plausibly explains several seconds of delay. The 0.46-second GPU text median was not measured under identical load. See [text measurements](LOCAL_HOST.en.md) and [speech measurements](ITERATION_013.en.md).

Separate event-to-local-OBS speech delay from platform delivery delay. If both picture and speech arrive late together, transmission is involved; commentary describing an old picture indicates stale content or relative skew. Current `responseP95Ms` excludes actual playback and the viewer's player.

## 3. Connect reliable game knowledge

Introduce a read-only `HostWorldState` from ETC observations, adopted objectives and executor feedback, with source timestamps and session identity. Derive events from changes, not every control heartbeat.

Start with damage, critical health, visible enemies, empty magazine, loot discovery, objective changes, weapon changes, room entry, danger/evacuation thresholds, blocked actions, death and explicit results. Coalesce damage bursts and deduplicate objective lease renewals. Debounce menus, not immediate danger.

Prefer player-visible structured feedback, then valid adopted/executing objectives, timestamped OCR, optional image understanding, and external game material. Guides cannot establish this chest's contents. World coordinates alone cannot justify “enemy on the left” without a reliable camera/screen transform. Hidden information is not a player's observation.

ETC's existing structured interface avoids putting continuous vision inference on the urgent path. Image analysis can run on room changes or unfamiliar objects at low priority; retain capture timestamps and reject late results. Other games need separate OCR/vision acceptance.

Current JEV `systemOne` asks for `action` and `destination`, not a complete spoken rationale. Track `proposed → accepted → issued → running → succeeded/blocked/cancelled`, with `source=jev/local/manual`. A rejected cloud suggestion or contingency destination is not an executed plan.

Optional concise reason codes should be grounded in low health, missing equipment, danger or executor feedback. Derive these from evidence without adding a slow reasoning request to control or fabricating JEV's internal reasoning.

Concrete weapon names, counts, results and locations must use allowed fact slots linked to event/material evidence. Reject or rewrite additional unsupported specifics while generating varied speech around those slots. A prompt is not a fact validator: this iteration's replay still produced an unsupported AR-15 claim, making evidence validation an implementation gate.

## 4. Three content paths, one speaking scheduler

These are software responsibilities, not three resident large models.

| Path | Source | Initial behavior |
| --- | --- | --- |
| Immediate reaction | Confirmed event, same-voice pre-synthesized phrase | 0.4–2 seconds of speech; target event-to-local-first-audio P95 ≤1 second |
| Intent and situation | Adopted objective, current facts and short memory through a local model | One or two short clauses, usually 2–6 seconds of speech; dynamic first-audio P95 target ≤2.5 seconds, unproven on current CPU |
| Downtime and interaction | Match history, viewer questions and prefetched material | 6–15-second passages with pauses; interruptible when play resumes |

Start with 8–12 event categories and 6–10 complete phrase/prosody variants each. Match voice and loudness. Use context-aware weighted sampling, cooldowns and the option to remain silent. Do not cache arbitrary room numbers, enemy counts or results, and do not stitch individual words into robotic sentences. Rebuild caches when voice or language changes.

An immediate reaction can precede a generated explanation only while it remains relevant. Do not enforce a fixed reaction-plus-explanation pattern or fill every computation gap with “hmm.” Slow CPU output can be cancelled or turned into an explicitly retrospective comment when supported.

Prioritize survival/death/major changes, important current actions, time-sensitive viewer questions, exploration, then prepared topics. Within priorities use freshness, relevance, novelty and viewer waiting time; prevent chat starvation.

Initial opportunities: exploration after 5–12 seconds of silence; downtime after 3–8 seconds; combat uses selective short reactions and allows concentration. These are opportunities, not periodic mandatory announcements. Tune actual audio occupancy over 60 seconds: exploration roughly 25%–45%, downtime 40%–60%, subject to listening tests.

Replace the shared 90-generation hourly limit as the primary pace controller with separate audio-duration, event cooldown, viewer fairness and inference budgets. Retain resource caps and immediate mute; increasing frequency must not silently exhaust an hourly quota.

## 5. Start promptly and stop obsolete speech

Inputs carry `sourceAt/receivedAt/session/matchId/epoch/eventId`. Speech carries `intentId/evidenceIds/priority/validUntil/preconditions/interruptible`. Validate at admission, generation completion, synthesis completion and playback start. Session changes, manual takeover and cancelled objectives invalidate old jobs.

Initial freshness windows: around one second for immediate reactions; two to three seconds for intent plus a still-valid objective. Confirmed historical death/results may allow longer retrospective windows. New observations cannot silently refresh old generated numbers. Drop expired live commentary.

Allow one playing item and one next candidate. Coalesce or replace candidates; store a topic cursor instead of a speech backlog. Urgent events cancel lower-priority generation/TTS and fade playback quickly; ordinary topic changes wait for a short clause boundary. Avoid interruption churn.

Aborting HTTP does not stop Python inference. Add job identity/cancellation, suppress obsolete results and release the worker between clauses. Cached reactions bypass the synthesis worker. Do not restart the model process for every event.

First implement a clause pipeline: streamed text → complete short clause with factual/content checks → Melo synthesis → OBS playback, preparing the next clause while the first plays. Never feed fragments blindly or describe chunked download of a complete WAV as streaming synthesis. [Ollama supports streaming](https://docs.ollama.com/api/streaming); this application currently disables it.

Use short WAV segments initially; evaluate PCM/AudioWorklet streaming only after measuring benefit. Test seams, prosody, underruns and cancellation. Every first clause should make sense independently.

Separate subtitle lifetime from floor ownership. Playback acknowledgements need utterance, segment, provider and generation IDs, not just counters. Schedule from actual end events with timeouts. One offline output must not block others. Share game-commentary audio across outputs while preserving platform-scoped viewer replies; lagging outputs skip obsolete segments instead of replaying them.

## 6. Translate intentions into player language

Use facts, adopted intent, verifiable reasons, mood and recent topics. Do not read debugging fields or system terminology aloud. Intent follows adoption; outcome follows confirmation.

| Evidence | Natural example | Constraint |
| --- | --- | --- |
| Loot objective adopted | “Let's check this chest. Could use an upgrade.” | Chest exists; contents unknown |
| Enemy appears while looting | “Someone's here. Chest can wait.” | Enemy visible and looting actually interrupted |
| Evacuation adopted | “This room's getting risky. Time to move.” | Real danger and current movement plan, not merely a contingency |
| Low health and cover executing | “Need a breather. That health bar isn't looking great.” | Both facts confirmed |
| Primary weapon obtained | “Finally, something better. That search paid off.” | Pickup/equipment change confirmed and earlier search actually occurred |
| Blocked route | “Can't get through there. Another way.” | Executor reports blocked |
| Greedy looting followed by danger | A short self-deprecating callback | The match really contained those events; do not invent a cause of death |

Keep personality, names and risk attitude stable. Mood follows events and decays naturally. Maintain 30–60-second event memory, a current-match story, and about ten minutes of topic/catchphrase/material usage. Deduplicate semantically. Unplayed cancelled text is not “already said”; actually played partial clauses are.

Begin with calm, focused, tense, relieved and playful styles. Use occasional pauses and genuine corrections without padding every sentence with filler or random pitch shifts. Synchronize voice, mouth movement, expression and captions. Localize all five languages rather than translating jokes literally.

## 7. Gather material during downtime

Run retrieval as a separate cancellable low-priority task in menus, loading and stable low-load periods. Pause new summarization during combat. Search never blocks immediate speech.

Prioritize actual match moments, reviewed rules/developer updates, official Steam news and accessible community sources, then relevant X posts. Distinguish facts, opinions and jokes. One post does not establish community consensus. The shipped application needs its own source adapters; it cannot depend on this development assistant's search tools.

Each card stores source URL, author/publication time, retrieval time, game/version/language, a short summary, fact/joke label, suitable moments, expiry conditions and usage count. Keep around 20–40 usable cards. Check the low-water mark every 3–5 minutes, without necessarily making a request. An initial limit can be six searches/hour plus independent result-count and spending caps. Deduplicate and expire stale gameplay advice.

Use a prepared topic while waiting, or a small joke when an actual gameplay moment makes it relevant. Start with material-driven jokes at roughly 5%–10% of utterances, never a quota. Interrupt naturally when combat starts and resume only if still relevant.

An X broadcast key does not authorize search. Official recent search needs separate access and covers the past seven days; current API access is usage-priced. Fall back to available official sources and prepared cards if access is unavailable, without pretending a search succeeded. [X recent search](https://docs.x.com/x-api/posts/search-recent-posts), [X pricing](https://docs.x.com/x-api/getting-started/pricing).

Send only game/topic terms to search providers, not private chat or credentials. Treat retrieved pages as data. Prefer brief paraphrases and commentary, retain attribution, and review source-specific caching/quotation requirements during integration. Do not say “I just saw this on X” without a real retrieval; do not attribute original jokes to invented posts. No automatic posting or contacting others is needed.

## 8. Technology choice on this machine

Recommended baseline: ETC events, same-voice cached reactions, local short text generation, Melo clause synthesis and background material cards.

| Option | Role | Acceptance condition |
| --- | --- | --- |
| CPU text + Melo + cache | Conservative baseline | Drop expired dynamic speech; do not promise instant unrestricted generation |
| GPU short text + CPU Melo | First acceleration candidate | Pass real Steam gameplay, all selected OBS outputs, avatar, frame-time, VRAM and dropped-frame checks |
| Smaller local text model | Candidate when GPU headroom is limited | Compare identical factual, multilingual and naturalness samples |
| Expressive/streaming TTS | Later prosody and first-packet improvement | Beat current chain under load and human listening tests before replacing it |
| Cloud or second machine | Optional future resource expansion | Local-hosting constraint remains the default; separately decide cost, data scope and offline behavior |

Earlier local CPU/GPU Qwen3-TTS trials did not meet live-stream latency requirements. Its documented streaming capability is not proof that the current Windows adapter and OBS chain stream; advertised 97ms is not a local end-to-end guarantee. The official model table does not mark 0.6B-CustomVoice with the same instruction control as 1.7B-CustomVoice. [Official Qwen3-TTS documentation](https://github.com/QwenLM/Qwen3-TTS).

Melo documents CPU real-time inference and already has local short-sentence measurements, making it a practical first-stage base; naturalness still needs listening. [Official MeloTTS documentation](https://github.com/myshell-ai/MeloTTS).

Keep one foreground text task, let background summaries yield, and use sustained pressure plus hysteresis for device policy. Avoid switching devices every sentence. Under load, suspend optional vision/retrieval summaries and shorten dynamic speech before harming gameplay. Free VRAM alone is insufficient evidence.

## 9. Delivery stages

| Stage | Concrete changes | Reviewable result |
| --- | --- | --- |
| A: Ground speech | Structured state, event aggregation, freshness checks, trace timestamps, director/budget changes | Traceable damage/enemy/room/result reactions; no stale cross-match speech |
| B: React promptly | Phrase cache, bounded candidate queue, cancellable jobs, playback IDs/end scheduling, clause pipeline | Interruptible chatter; cached first-audio P95 target ≤1 second; no replay or platform leakage |
| C: Sound like a player | Intent translation, match/topic memory, mood, semantic repetition checks, prosody review | Grounded, continuous and less repetitive paired samples |
| D: Fill downtime | Optional source adapters, cached cards, source and budget controls | Search failures do not block hosting; combat preempts topics |
| E: Accept under load | Steam A/B sessions, five languages, three-output isolation, device pressure and viewer recordings | Audible before/after clips, latency distributions and error logs, followed by a two-hour combined run |

Maintain Chinese/English documents and five-language settings/messages at each stage. First complete the small A+B loop: detect a real event, speak promptly, cancel when it changes. Commit/push source by milestones; public broadcasting remains subject to existing authorization boundaries.

Proposed modules: `host-world.ts`, `host-events.ts`, `host-memory.ts`, `host-materials.ts`; extend existing director, hosting, model and audio code. Shared contracts live in `shared/hosting.ts`. Observation/expression code receives no gameplay input permission.

## 10. Acceptance

Trace source capture/game time, receipt, event, admission, first usable clause, first audio ready, actual OBS start, end/interruption. Use monotonic clocks for elapsed stages and validate cross-process offsets. OCR needs capture-start timing. Exclude leading audio silence; a playback-start acknowledgement only approximates first audible speech.

Report sampling, queueing, model first-clause/full time, synthesis/first packet, playback wait, event-to-first-audio, and viewer picture-to-corresponding-speech skew separately. Report platform absolute delivery latency independently.

| Measure | Initial target/method |
| --- | --- |
| Immediate reactions | Local event-to-first-non-silent audio P95 ≤1 second; report eligible events, reactions and drop reasons |
| Dynamic intent | Accelerated-mode first-audio P95 ≤2.5 seconds; report CPU separately and reject obsolete output |
| Grounding | Zero critical cross-match/cancelled-objective/dead-player-present-tense errors in controlled replay; manually sample vague claims too |
| Density | Actual audio occupancy and silence distribution; explain unintended silence over 20 seconds in safe, material-rich downtime, without filler gaming |
| Repetition/story | Aim for <10% unnecessary semantic/topic repeats over ten minutes and at least one accurate match callback |
| Playback | Prompt urgent interruption, no duplicated opening, reconnect replay or cancelled-job resurrection; no cross-platform replies |
| Naturalness | Randomized original/improved paired clips; score timeliness, naturalness, continuity, accuracy and watchability from 1–5; user first, then multiple listeners; aim for median naturalness ≥4 and no misleading factual claims |
| Resource impact | Same quality/scenes/output count; initial relative game frame-time/1% low regression threshold ≤5%; OBS rendering and encoding drops each <0.1%; tune load if neither condition is met |

Begin with a redacted 20–30-minute replay spanning exploration, combat, waiting, chat, cancellations, network loss, output loss, mode switches and match changes. Then validate the installed Steam Enter the Cube Playtest. Paired clips compare expression; live gameplay verifies resource contention and responsiveness. Finish with an authorized private or local two-hour combined run and independent five-language listening. Editor demos do not substitute for the shipped game.

The first stage can materially improve responsiveness, freshness, density and continuity. Human-level humor, nuanced emotion and sustained natural conversation require further material, voice and listening work. Judge the next step from real clips, not the architecture alone.
