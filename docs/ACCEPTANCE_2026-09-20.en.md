# Acceptance update — 2026-09-20

[简体中文](ACCEPTANCE_2026-09-20.md) · [English](ACCEPTANCE_2026-09-20.en.md)

Creator: JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj).

## Private review and version replacement

The X Private event started at 20:00 UTC+8; the desktop switched from 0.1.1 to 0.1.2 at 20:32. At 20:41 the platform still reported Private and live, with the same event URL. After selecting 1080p, a five-second sample added 300 decoded frames at 1920×1080: approximately 60.00 fps. Decoded audio bytes increased. This short platform measurement does not certify continuous all-day quality or replace listening acceptance.

The stable entry is [X Live Studio](https://studio.x.com/live), authenticated as the owning account. No public post was published. Steam Playtest lobby capture and the avatar were visible again after the desktop replacement; local hosting/system speech continued while game control remained manual.

## Older two-hour run: failed

18:37–20:37 UTC+8, older build, three local receivers, Steam Playtest lobby and synthetic chat. There were 219 generated/synthesized utterances and zero model/synthesis-layer failures. Each overlay recorded three older mixed errors, so overall acceptance failed.

| Output | Encoder skipped frames | Render skipped frames |
| --- | --- | --- |
| Local YouTube | 678 / 431680, about 0.157% | 486 / 431680, about 0.113% |
| Local Twitch | 637 / 431681, about 0.148% | 433 / 431681, about 0.100% |
| Local X | 417 / 431681, about 0.097% | 417 / 431681, about 0.097% |

At 20:37 the restoration helper confirmed that the exact old test ended and the game was in its menu. It closed the game gracefully, restored the temporary quality/resolution/frame-rate changes and relaunched through Steam. It did not force termination or overwrite later user changes; its receipt reports `restored`.

The new overlay classifies errors and fixes an established retry/deduplication defect. The precise cause of the old three mixed errors remains unconfirmed.

## Recording improvements

Endurance runs record source commit/version, append NDJSON samples and retain only 120 recent samples in RAM/progress snapshots. Final summaries retain total sample counts and whole-run frame deltas. Failures produce a separate result so a missing pass report is not mistaken for a running test.

New sustained-black, static-picture, stalled-frame and stale-overlay warnings do not close, restart or control games. A paused game or static menu may legitimately trigger a static-picture warning. Nearly silent PCM16 synthesis is rejected while captions remain available.

## Still outstanding

Real Twitch chat consent/viewer messages/replies, YouTube activation, listening, full matches and an actual-platform two-hour show, staged 8/24/72-hour runs, neural-speech performance and release preparation. Items 7–8 and autoplay implementation remain outside this iteration.
