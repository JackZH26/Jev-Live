# Third-party notices

Jev-Live / JEV Studio is independent. Integration names identify compatibility, not endorsement.

| Component | Role | License / source |
| --- | --- | --- |
| Electron | Desktop shell and system encryption | MIT — https://github.com/electron/electron |
| Vue | Interface | MIT — https://github.com/vuejs/core |
| obs-websocket-js | OBS remote control | MIT — https://github.com/obs-websocket-community-projects/obs-websocket-js |
| TypeSafe AI SDK | JEV decisions | MIT — https://github.com/typesafe-ai/typesafe-sdk-js |
| Zod | Input validation | MIT — https://github.com/colinhacks/zod |
| OBS Studio | Separately installed capture / encoding / streaming | GPL-2.0-or-later — https://github.com/obsproject/obs-studio |

The exact versions and dependency graph are pinned in `package-lock.json`. Consult the installed packages' license files for full notices, including Electron's bundled components. Development tools (TypeScript, Vite, Vitest, Playwright and electron-builder) retain their own licenses.

OBS is controlled as a separately installed application; this repository and desktop package do not distribute OBS binaries. Distributors who choose to bundle OBS must separately meet its distribution and source obligations.

The original ETC bridge targets a separately licensed game. ETC assets, Unreal Engine, Lyra, models, audio and platform branding are not relicensed by this repository. No account credentials, OAuth exports, OBS profiles or stream keys are included.

The research document discusses AIRI and other candidate projects. Discussion is not incorporation: the initial implementation does not vendor their code or assets.
