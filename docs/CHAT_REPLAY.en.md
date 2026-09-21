# Chat replay and multilingual spoken replies

[简体中文](CHAT_REPLAY.md) · [Natural hosting proposal](NATURAL_HOSTING.en.md)

2026-09-21 · Author: JackZH26 · [𝕏 @jackzhj](https://x.com/jackzhj).

## Delivered scope

An isolated local rehearsal page reuses production `Chat → Hosting → Ollama → MeloTTS → OverlayAudio`. Simulation never connects or sends messages to real platforms. Existing YouTube/Twitch connectors remain available; local success does not certify real account reception, reply delivery or viewer playback. X chat is still unsupported.

Default hosting is now English. Each comment independently selects Simplified Chinese, Traditional Chinese, Japanese or Korean when its supported writing system is detected; English and unsupported languages use English. Both model output and TTS follow the choice without changing subsequent ordinary commentary. Mixed scripts, Japanese containing only shared Han characters and very short comments remain ambiguous: this is lightweight rule-based detection, not a universal language classifier.

The schema default does not overwrite every existing user's saved language preference. This user's English preference should also be applied to their saved profile. Cross-language replies use an automatic matching voice instead of retaining an unsuitable fixed voice. Traditional Chinese uses Chinese speech and does not certify a Taiwanese accent.

This machine's saved profile has been changed to English for its next configuration load. Viewer replies use a separate concise prompt without unrelated answers to other viewers; relevant same-viewer conversation can remain. A writing-system check rejects mismatched output before speech and reports an error. Early listening also exposed invented weapon terminology, leading to stricter constraints on specific game claims. These measures do not replace human assessment of factual accuracy and naturalness.

## Corpus

The public **TwitchChat** research archive supplied 2,000 messages from three historical PUBG streams, with 1,734 distinct message texts. Metadata game ID `493057` matches [PUBG: BATTLEGROUNDS in Twitch's official reference](https://dev.twitch.tv/docs/api/reference#get-top-games).

These are historical English chats from 2019, published through Charles Ringer, Mihalis A. Nicolaou and James Alfred Walker's [TwitchChat project](https://osf.io/39ev7/), whose [paper](https://cdn.aaai.org/ojs/7439/7439-52-10766-1-2-20200923.pdf) links the dataset. They are not newly captured live comments and do not describe the current ETC match. Direct YouTube replay retrieval encountered a login challenge, so this public source was used instead.

The importer reads only the ZIP directory, metadata and selected members, verifies size/CRC, and avoids downloading video or the entire 324 MB archive. It filters to PUBG, replaces research-hashed viewer identities with local labels, and excludes messages containing links, mentions, emails or likely phone numbers. Existing duplicates remain useful for spam/deduplication tests. Audience text is untrusted, not game telemetry.

Local files: `E:\JevRuntime\chat-fixtures\pubg-captured.json` and `provenance.json`, including source member hashes. Corpus files stay outside Git; the code's MIT license does not imply redistribution rights for comments. Additional multilingual acceptance inputs are labelled synthetic, never counted as captured comments.

## Running

```powershell
npm run build
node scripts/fetch-pubg-chat.mjs E:\JevRuntime\chat-fixtures
node scripts/chat-lab.cjs --dataset=E:\JevRuntime\chat-fixtures\pubg-captured.json --output=test-results\chat-lab-demo
```

Open the emitted random loopback URL and click Start. Quiet, normal, burst and recorded timing modes are available. Seeded randomized schedules are reproducible. Replay assigns fresh receipt timestamps while historical offsets determine timing; source sessions are concatenated while preserving timing within each session.

The lab requires the local `qwen3.5:4b` Ollama model and ready Melo service on port 11437. CPU is the default. No production credentials are read. SIM labels identify replay traffic. Pause suspends new messages; Stop cancels hosting and speech. A manual comment field enables targeted tests.

The page supports five UI languages. Embedded players use production overlays. Only the isolated lab opts into embedding by its exact loopback origin; production defaults still disallow framing. Simulated Twitch and YouTube replies remain scoped to their originating output.

```powershell
node scripts/smoke-chat-lab.cjs test-results\chat-lab-demo
```

The acceptance script uses real model inference, real Melo audio and Chromium playback. It covers captured chat plus English, Simplified/Traditional Chinese, Japanese, Korean and unsupported-language fallback samples. Outputs include `acceptance.json`, WAV files, `events.ndjson` and a mobile screenshot. Failed runs retain separate failure receipts.

## Acceptance limits

Final local regression: 187 unit tests, type checks and build passed. Seven samples completed real generation, matching-language synthesis and Chromium playback start/end, with no cross-platform playback or model/audio errors. Text generation plus synthesis ranged from 5.57 to 12.18 seconds, median 8.08 seconds. These seven functional samples do not establish a latency distribution and exclude full queueing/platform transport.

**The pipeline passed; content quality has not passed.** Transcript review still found an unsupported AR-15 claim in the first sample and awkward Chinese phrasing. Prompt constraints alone did not establish factual accuracy for the 4B model. Specific weapon/result claims need game-fact allowlists or evidence validation, appropriate knowledge and listening review. Problematic samples are retained rather than presented as human-level hosting.

The local standalone listening file is `E:\Jev\test-results\chat-lab-release\chat-listening.html`. Its audio is genuinely generated; the random comment area replays inputs without pretending to synthesize a new reply for every historical message.

Measure receipt, generated reply, non-silent synthesis, playback start, playback end and real platform delivery separately. This lab validates the first five, not the last. Naturalness still requires listening.

Existing whole-text generation and utterance lifetime still contribute latency. This change delivers a reproducible working chat-to-voice test and language routing; it does not implicitly deliver the proposal's event preemption, clause streaming, material retrieval or full pacing redesign.

When real comments become available, retain the same downstream pipeline and switch to existing real connectors. Validate authorization, reception, deletion, reconnect, platform isolation and viewer-side speech separately. Simulation ingress requires an isolated Chat instance; a simulation-marked message is explicitly rejected by live sending.
