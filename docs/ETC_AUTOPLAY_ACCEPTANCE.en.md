# ETC autoplay acceptance · 2026-09-20

[简体中文](ETC_AUTOPLAY_ACCEPTANCE.md) · [Design/source analysis](ETC_AUTOPLAY.en.md)

**Result: the dedicated JEV controller and native integration source are implemented. Full Steam match acceptance is incomplete; esports-level skill and win rate are unverified. No stream was started.**

| Check | Observed result |
| --- | --- |
| Type checks | `npm run check` passed |
| Automated tests | 67 tests across 6 files passed, covering transport, tactical priorities, stale/repeated state, takeover races, result counting, five languages and existing features |
| JEV build | TypeScript and Vite production build passed |
| Windows package | Built in an isolated candidate directory without replacing the existing installation |
| Packaged five-language UI | Simplified/Traditional Chinese, Japanese, Korean and English rendered the autoplay panel without raw translation keys |
| Native compilation | Previous integration revision passed `LyraEditor Development` and `LyraGame Shipping` |
| Native constraints | Previous `Project.ETC.Jev.PlayerMotor` passed 17 assertions; the final added missing-frame check awaits rerun |
| Final native changes | Camera-based aiming, posture-input ownership and missing-frame validation are synchronized to ETC source. A Room028 editor currently holds the module; permission to save/close was requested. **Final native revision has not been rebuilt/retested** |
| Steam installation | AppID 5272970, BuildID **25364079**, actual installed Shipping process detected |
| Steam API handshake | **v3 not connected**. JEV explains the compatible-game requirement and disables automatic mode; no old OCR sequence fallback |
| Complete autonomous matches | **Zero**; no measured match win rate or guaranteed-win claim |
| Actual in-game input release | Unverified without the native API. A successful manual-mode request is not counted as native release evidence |
| Streaming | No OBS setup, account login or stream start in this acceptance; isolated studio stayed idle with every output inactive |

Private local evidence, excluded from Git: `test-results/etc-autoplay/acceptance.json`, `studio.png`, `test-results/etc-native/index.json`, `etc-native.log`. Native build logs are in ETC's `Tools/build_LyraEditor_Development.log` and `Tools/build_LyraGame_Shipping.log`.

The JEV candidate is `.local/autoplay-package/win-unpacked/JEV Studio.exe`. It contains the new studio and integration sources, but does not update the Steam game.

Continue with final native compilation/constraints tests, prepare a compatible Steam candidate through ETC's release workflow, install/launch through Steam, run `node scripts/smoke-autoplay.cjs --run --matches 20`, then perform 100 held-out evaluation matches. The ETC tree also contains ongoing Room028/other work; its whole workspace must not be treated as an accepted release candidate.

Implementation, compilation, native unit testing, Steam handshake and match outcomes are separate acceptance stages.
