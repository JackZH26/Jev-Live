# Hosting reliability iteration

[简体中文](RELIABILITY.md) · [English](RELIABILITY.en.md)

Scope: remaining-work items 1–6: reliability, platform integration, full-show acceptance, natural hosting and speech, recovery, setup and distribution. Advanced avatar/layout work and new platforms (7–8) are deferred. Autoplay remains owned by the other session.

## Fixed and verified

The previous overlay counted state-fetch, audio-download and decoding failures as `audioErrors`, and marked speech played before downloading it. State/audio errors are now separate with bounded diagnostic codes, never credentials, URLs or viewer content. Speech is acknowledged after actual playback starts. Pre-play failures retry at most three times with backoff; stale lines are discarded. Counters cover start/end/recovery/expiry/interruption. Session storage prevents a browser refresh from replaying an already-started line.

`node scripts/smoke-overlay-recovery.cjs` uses actual Chromium/Web Audio: an injected audio 503 recovers, a state 503 does not increase audio errors, reload does not replay speech, and the next line plays. It uses local test audio without game or platform accounts.

This fixes a confirmed retry defect and improves diagnosis. It does not establish the root cause of the earlier three errors. The new build still needs full-duration testing and actual platform listening acceptance.

## Local natural speech

`services/local_voice.py` serves Qwen3-TTS-0.6B on loopback, loading weights outside the repository with Hugging Face networking disabled during inference. It rejects browser Origins and nonlocal Host headers and bounds text/concurrency. CPU/GPU performance and five-language audio remain under evaluation; system speech is not replaced by default.

## Review address

Prefer the configured X Live Studio private event. The stable dashboard entry is `https://studio.x.com/live`; sign in to the X account owning the stream. It differs from an individual event URL. Duration/time-out limits can require another event and change its details URL; one everlasting event URL is not promised. YouTube still has its first-activation wait, so real acceptance must follow eligibility.
