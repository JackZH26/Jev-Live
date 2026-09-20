# 0.1.3: local speech in five languages and runtime safeguards

[简体中文](ITERATION_013.md) · [English](ITERATION_013.en.md)

Author: JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj). Follow and share your feedback.

This iteration advances original priorities 1–6. Items 7–8 remain deferred; another session owns autoplay. Capture remains the installed Steam Enter the Cube Playtest.

## Delivered

- Optional local CPU MeloTTS voices; Windows speech remains the default and Qwen3-TTS experimental. Traditional Chinese uses the Chinese model, not a dedicated Taiwanese accent.
- Warm offline short-sentence synthesis on this machine: Simplified Chinese 1.34 s, Traditional Chinese 1.83 s, Japanese 1.66 s, Korean 2.05 s, English 0.94 s. Steam and the X output were running. These are synthesis measurements, not end-to-end interaction latency or human voice-quality approval.
- Isolated Japanese/Korean bindings to resolve Windows case-insensitive directory collisions. No runtime downloads or pip installations; pinned model revisions, SHA256-checked NLTK data and forced weights-only loading.
- Disposable inference process, a 25-second hard synthesis deadline and bounded reload. Recovery pauses after three failures. Loading has a 240-second deadline; health becomes ready only after all five languages warm successfully. Speech failures preserve captions.
- OBS requests disconnect the affected client after eight seconds without a response, allowing the existing output recovery flow to reconnect. Other outputs are not deliberately stopped.
- Warnings for black/static game pictures, stalled output frames and missing host overlays. An idle menu can trigger a static-picture warning; warnings never control gameplay.
- Fully silent generated WAV rejection. Endurance samples append to disk; only 120 recent samples remain in memory, with an explicit failure report.

## Local installation and validation

The tested Windows environment uses isolated Python 3.10, CPU PyTorch 2.5.1 and a fixed MeloTTS commit. Python 3.10 is approaching the end of its maintenance cycle; a newer runtime still needs migration and acceptance before formal distribution. Python, weights and credentials are not bundled.

```powershell
.\scripts\install-melo.ps1 -RuntimeDirectory E:\JevRuntime
E:\JevRuntime\melo-env\Scripts\python.exe services\local_voice.py --engine melo --port 11437 --model E:\JevRuntime\voice-models\melo
```

Wait for `ready:true` at `http://127.0.0.1:11437/health`, then select MeloTTS in host settings. Installation needs a network connection; inference is offline. External Host and browser Origin headers are rejected. Installation requires `uv` and Git; desktop-managed download and supervision are not implemented yet.

```powershell
node scripts/smoke-local-voice.cjs
E:\JevRuntime\melo-env\Scripts\python.exe services\test_voice_worker.py
```

Five WAV samples and the benchmark are in ignored `test-results/melo-service`. CPU and GPU Qwen3-TTS did not meet local live-interaction latency needs, so neither became the real-time default.

## Review entry and acceptance limits

[X Live Studio](https://studio.x.com/live) is the reusable account dashboard. The current private event URL is delivered only to its owner, not committed publicly. Platform playback measured 1920×1080 with 300 frames in five seconds while remaining Private. Updates can reuse the same event while it remains open; ending/recreating it can change its URL. The dashboard is not a permanent direct player URL.

Type checks, 99 TS tests, two real subprocess timeout/recovery tests, five-language desktop checks, five-language offline speech and HTTP boundaries, and actual OBS crash recovery passed. Release acceptance still depends on new-build endurance reports.

The previous local two-hour run failed on overlay errors; see the [acceptance record](ACCEPTANCE_2026-09-20.en.md). New runs must complete on the new build. Lobby capture and synthetic chat do not certify full matches or real viewer interaction. Eight-, 24- and 72-hour stages remain unpassed.

## Outstanding

- YouTube first-live waiting period, estimated by its UI around 2026-09-21 15:41 UTC+8; Twitch chat requires owner reauthorization. Existing bindings are preserved.
- A real two-hour match/chat/voice/text flow, human listening, network interruption and platform token renewal, followed by 8/24/72-hour acceptance.
- App/OS restart supervision, speech-helper lifecycle management, event rollover, segmented recording and game-crash policy. Picture warnings are not automatic repairs; WAV checks are not audience-side silence detection.
- Public OAuth applications, signing, trusted updates/rollback, one-click dependencies and clean-machine acceptance. Installers remain unsigned development previews.

Upstream: [MeloTTS](https://github.com/myshell-ai/MeloTTS), [Chinese model](https://huggingface.co/myshell-ai/MeloTTS-Chinese), [Windows Korean binding](https://github.com/jonghwanhyeon/python-mecab-ko). Performance conclusions use local measurements rather than upstream claims.
