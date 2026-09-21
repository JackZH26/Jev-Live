# Girl host and English narration

[简体中文](LIVE2D.md) · [English](LIVE2D.en.md)

2026-09-21: Following the user's listening feedback, multilingual speech and English-reference voice cloning are paused. Commentary and viewer replies now use English, with the original local Melo EN-US voice as the default. Loading or saving an old Qwen/cloning configuration migrates it to Melo while retaining private reference audio. All five interface languages remain available. The English voice was not retrained or replaced.

## Model and use

The **Built-in girl · Live2D** choice uses an actual Cubism model. **Test voice and lip sync** plays the voice and animates the preview. The OBS overlay drives the mouth from the amplitude of the audio actually playing. Output layouts remain independently editable.

The user supplied a silver-haired, violet-eyed character with black rabbit ears and a purple flower. Newly generated front-facing artwork adds gaming headphones, a microphone and a black/white/violet outfit. The supplied reference image is not distributed. Artwork was created with the built-in image generator, assembled into layers, rigged in Cubism and exported.

| File | Purpose |
| --- | --- |
| [jev-girl.cmo3](../art/live2d/jev-girl/jev-girl.cmo3) | Editable Cubism 5.3.04 project |
| [jev-girl.psd](../art/live2d/jev-girl/jev-girl.psd) | 15-layer source artwork |
| [jev-girl.model3.json](../public/live2d/jev-girl/jev-girl.model3.json) | Standard entry point; copy the entire model folder |
| [jev-girl.moc3](../public/live2d/jev-girl/jev-girl.moc3) | Model exported for Cubism 4.2 |
| [generation-prompts.json](../art/live2d/jev-girl/generation-prompts.json) | Prompts used for this artwork |

The runtime folder includes a 2048×2048 texture and parameter display information. It uses the standard format for compatible Live2D applications. VTube Studio itself was not exercised during this acceptance; format compatibility is not a claim of an application test.

This first rig has 15 ArtMeshes, separate left/right blinking, mouth opening, ±2° overall sway and approximately 0.6% breathing scale. Eye and mouth artwork crossfade between layers. It does not yet have detailed phoneme shapes, three-axis head turns, gaze tracking, hair physics or hand animation.

## Development and runtime

```powershell
npm ci
npm run setup:live2d
npm run build
```

`setup:live2d` downloads pinned Cubism Core 5.2 from Live2D and verifies its SHA-256. Core lives in the Git-ignored `public/live2d/runtime/` directory. The build checks it before packaging, preventing a desktop bundle with a missing runtime. Read the [Live2D Core agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html) before setup. Core is outside this repository's MIT license. Local test packages contain Core; distributing such applications must follow Live2D's publication terms, including provisions for expandable avatar applications. Public distribution of these desktop packages has not been cleared by this work.

The adapter and PixiJS / pixi-live2d-display retain their open-source licenses. Runtime assets are local, with no CDN dependency or arbitrary model URL import. The overlay server exposes only the fixed bundled model paths. CSP permits `wasm-unsafe-eval` for Core but does not enable JavaScript `unsafe-eval`.

## Validation

- Seven real local model → Melo → Chromium audio samples passed. Inputs included archived English chat and test comments in Chinese, Japanese, Korean and Spanish; replies were English. No messages were posted to real platforms. This is pipeline acceptance, not human listening-quality approval.
- `node scripts/smoke-english-live2d.cjs` checks old configuration migration, five interface locales, exported eye/mouth opacity endpoints, sway/breath vertex changes and complete English playback in the production Chromium overlay.
- Set `JEV_TEST_EXE` to test a packaged executable and `JEV_ACCEPTANCE_DIR` for local receipts. Acceptance uses an isolated profile without existing platform credentials.

The update does not force an active broadcasting process to close. Switch to the new build at a suitable pause in broadcasting.
