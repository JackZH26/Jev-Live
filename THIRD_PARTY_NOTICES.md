# Third-party notices

[简体中文](THIRD_PARTY_NOTICES.zh-CN.md) · [English](THIRD_PARTY_NOTICES.md)

Jev-Live / JEV Studio is independent. Integration names identify compatibility, not endorsement.

The built-in character now uses generated layered artwork and a standard Cubism model; the former SVG is replaced. The supplied reference image is not distributed. See [Live2D model and runtime notes](docs/LIVE2D.en.md).

PixiJS and pixi-live2d-display are MIT. The latter embeds Cubism Framework code subject to the Live2D Open Software License Agreement. Cubism Core is proprietary, downloaded separately to a Git-ignored directory, and is not covered by this project's MIT license. Local desktop test packages include Core; its publication/redistribution terms must be satisfied before release. License copies are in `licenses/live2d/` and are included in packaged resources.

| Component | Role | License / source |
| --- | --- | --- |
| Electron | Desktop shell and system encryption | MIT — https://github.com/electron/electron |
| Vue | Interface | MIT — https://github.com/vuejs/core |
| obs-websocket-js | OBS remote control | MIT — https://github.com/obs-websocket-community-projects/obs-websocket-js |
| TypeSafe AI SDK | JEV decisions | MIT — https://github.com/typesafe-ai/typesafe-sdk-js |
| Zod | Input validation | MIT — https://github.com/colinhacks/zod |
| .NET runtime | Self-contained Windows game observer | MIT — https://github.com/dotnet/runtime |
| OBS Studio | Separately installed capture / encoding / streaming | GPL-2.0-or-later — https://github.com/obsproject/obs-studio |
| Three.js / three-vrm | Optional local VRM rendering | MIT — https://github.com/mrdoob/three.js / https://github.com/pixiv/three-vrm |
| grpc-js / proto-loader | YouTube streaming chat | Apache-2.0 — https://github.com/grpc/grpc-node |
| YouTube streaming protocol fields | Wire-compatible subset of the documented sample | Apache-2.0 sample — https://developers.google.com/youtube/v3/live/streaming-live-chat |
| Ollama | Separately downloaded local inference runtime | MIT — https://github.com/ollama/ollama |
| Qwen3.5-4B / Qwen3-4B-Instruct-2507 | Separately downloaded local weights | Apache-2.0 — https://huggingface.co/Qwen |

The exact versions and dependency graph are pinned in `package-lock.json`. Consult the installed packages' license files for full notices, including Electron's bundled components. Development tools (TypeScript, Vite, Vitest, Playwright and electron-builder) retain their own licenses.

OBS is controlled as a separately installed application; this repository and desktop package do not distribute OBS binaries. Distributors who choose to bundle OBS must separately meet its distribution and source obligations.

The Windows helper uses Windows OCR and Win32 APIs provided by the operating system; it does not redistribute Windows. .NET runtime licenses and third-party notices accompany the helper output. Steam is separately installed and launched through its registered protocol. The optional original ETC bridge targets a separately licensed game. ETC assets, Unreal Engine, Lyra, models, audio and platform branding are not relicensed by this repository. No account credentials, OAuth exports, OBS profiles or stream keys are included.

The research document discusses AIRI and other candidate projects. Discussion is not incorporation: the initial implementation does not vendor their code or assets.

Imported portraits and VRM files retain their own asset licenses and are not included in Git or the desktop distribution. Windows SAPI voices are supplied by Windows and are not redistributed. Optional neural speech is not bundled; tested configurations are listed in the iteration reports.

Optional local speech: MeloTTS and its downloaded voice models retain their upstream licenses (MIT model cards); Qwen3-TTS retains its upstream license (Apache-2.0). Python, PyTorch, Transformers, tokenizers, MeCab bindings/dictionaries and all model files are installed separately outside Git and are not bundled. The Melo model/revision manifest is in services/melo-models.json; see docs/ITERATION_013.en.md for measured acceptance and limitations. python-mecab-ko is BSD-3-Clause; its dictionary and all transitive dependencies retain their own notices.
