# 0.1.2 development and acceptance

[简体中文](ITERATION_012.md) · [English](ITERATION_012.en.md)

Creator: JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj). Follow along and say hello.

This iteration advances items 1–6 in the [original priority list](REMAINING_WORK.en.md). Advanced avatars/layouts (7) and new platforms/five-output optimization (8) are deferred. Autoplay remains owned by the other session. Games still come from installed Steam libraries.

## Implemented and verified

- Separate overlay state/audio errors, bounded pre-playback retry, no duplicate playback after reload, and no replay of expired speech. Real Chromium fault injection passed.
- Calm/balanced/lively hosting, longer menu gaps, shorter gameplay responses and debounced phase changes. Identical questions are grouped within a platform; platforms alternate; repeat viewers have cooldowns and bounded conversation memory. Memory covers at most 200 viewers for 30 minutes and stays in RAM.
- Local keyword filtering hides matching overlay messages and skips their replies; generated text is filtered too. Platform messages are not modified or deleted.
- Local Qwen3-TTS integration, five-language voice selection, timeout and caption fallback. Windows speech remains the default; neural speech performance is not certified.
- Session-owned output recovery: ten-second observation, at most five backoff retries, no interference with native network reconnect, and cancellation on Stop. A real isolated OBS crash/restart/loopback-ingest test passed. This does not control games, adopt historical processes, or recreate completed platform events.
- Five-language setup checks explain game, account, OBS, capture, model and speech blockers. Checking never starts a stream.
- Per-user Windows installer configuration preserves application data; no default startup task or automatic updates. Code signing is absent.

## Private review

Stable entry: [X Live Studio](https://studio.x.com/live), signed in as the owning `@jackzhj` account.

The private event was created on 2026-09-20 at 20:00 UTC+8; its detail URL was delivered only to the account owner. The platform displayed Private, Steam Enter the Cube Playtest lobby video and the avatar; playback time, decoded frames and audio bytes increased. OBS source settings are 1080p60, but the player selected 480p automatically during inspection. This is not proof of a 1080p60 platform rendition. Recreating an event can change its detail URL; the dashboard entry stays reusable.

Unlisted is not substituted for private, and ingestion is not described as public publishing. Listening and visual acceptance on the user's phone remain pending.

## Neural speech measurements

On Core Ultra 7 265K / RTX 5070 Ti 16GB, Qwen3-TTS 0.6B CPU short-sentence synthesis took 93.2s zh-CN, 97.8s zh-TW, 30.3s Japanese, 27.4s Korean and 46.5s English. All five WAVs were produced, but latency is unsuitable for live interaction.

CUDA 12.8 / PyTorch 2.10.0 timed out on its first sentence while the older three-output soak and actual X output ran concurrently (about 41.8s at the client). The GPU test service was stopped. Cold/warm inference, game frame rate and VRAM must be retested after freeing the older test resources. Loading the model does not justify making it the default. Listening quality is also pending.

The service binds loopback only, rejects external Host/browser Origin headers, disables model networking during inference, and bounds text, concurrency, generation time, GPU allocation and audio size. Installation downloads a pinned public model outside the repository and requires network access.

## Outstanding acceptance and external prerequisites

- YouTube is waiting for initial streaming activation. The current UI implies around 2026-09-21 15:41 UTC+8; actual platform eligibility controls availability.
- Twitch reauthorization for new chat scopes is incomplete; the previous stream binding remains. Real viewer input/replies and platform isolation are unverified.
- The older two-hour run uses an older build, Steam lobby and synthetic chat. Its recorded overlay errors violate the pass criteria. The new build needs a rerun; local fixtures cannot substitute for full matches and actual platform chat.
- 8/24/72-hour stages require real elapsed runs and reports after each preceding stage passes.
- Independent process supervision, game crash handling, black/silent-output detection, event rollover, segmented recording and reboot recovery remain unfinished or unverified.
- Public OAuth review, code signing, trusted updates/rollback and clean-PC acceptance remain incomplete.

## Verification entry points

`npm run check`, `npm test`, `npm run build`; `node scripts/smoke-overlay-recovery.cjs`, `node scripts/smoke-hosting.cjs`, `node scripts/smoke-setup.cjs`, `node scripts/smoke-recovery.cjs`.

Speech: install isolated dependencies using `scripts/install-local-voice.ps1`; run `services/local_voice.py --model <model-directory> --device cpu` or `cuda:0`. Measure performance and listen before selecting Qwen3-TTS in Studio.

See the [later acceptance update](ACCEPTANCE_2026-09-20.en.md) for platform 1080p60 evidence and the completed older run.
