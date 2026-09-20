# Third-party notices

[简体中文](THIRD_PARTY_NOTICES.zh-CN.md) · [English](THIRD_PARTY_NOTICES.md)

Jev-Live / JEV Studio is independent. Integration names identify compatibility, not endorsement.

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

The bundled default SVG avatar is original project artwork under the repository license. Imported portraits and VRM files retain their own asset licenses and are not included in Git or the desktop distribution. Windows SAPI voices are supplied by Windows and are not redistributed. Neural TTS candidates discussed in the design are not bundled or represented as tested.
