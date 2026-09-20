# Cloud Jev gameplay validation · 2026-09-20

[简体中文](CLOUD_JEV_VALIDATION.md) · [ETC autoplay](ETC_AUTOPLAY.en.md)

This validation distinguishes API success, policy adoption, the game's action acknowledgement, and actual movement/combat. Success at one stage does not prove the next. It uses the Steam-installed Enter the Cube Playtest, never the editor, and does not start or modify OBS.

## Measured outcome

**Cloud connectivity works; combat skill and win rate remain unmeasured.** Steam BuildID 25420188 returned model `jev-1.13.0`. Two sequential exploratory runs made 109 game requests and received 107 successful replies. The other two requests were cancelled at test/control shutdown, with no observed server failure or request timeout. Connectivity probes are counted separately.

| Metric | Existing advisory mode | Experimental tactical mode |
| --- | ---: | ---: |
| Duration | 181 seconds | 107 seconds |
| Game requests / successful replies | 66 / 65 | 43 / 42 |
| Successful request median / P95 latency | 358 / 432 ms | 361.5 / 435 ms |
| Model choices | 65 scans | 11 chests, 31 portals |
| Control frames differing from local rules | 0 | 431 |
| Frames also observing the corresponding native target | 0 | 414 |
| Complete matches / shots / eliminations | 0 / 0 / 0 | 0 / 0 / 0 |
| Input release after the run | Confirmed | Confirmed |

The first run reached its time limit, moved from runtime slot 34 to 1 and then stopped at a wall. Accepted cloud advice never changed local action selection. The second run began from the stuck position in the same match. Added context and cloud target adoption changed acknowledged targets, but all 106 gameplay position samples were identical. The picture showed authored room 005, runtime slot 1; the character did not recover. Native control then changed to manual; the controller detected `etc.lost` and stopped. Native telemetry does not identify the precise stop cause, so the triggering safeguard cannot be determined from this evidence.

Thus 107 successful replies do not mean 107 successful gameplay actions, and the second run is not a completed autonomous match. Navigation/recovery, stuck diagnostics and native stop reasons need fixing before controlled rule/cloud comparisons and multi-match win-rate tests. Repeated scanning with the original prompt changed to exploration choices after adding action semantics; context and adoption matter, but this does not establish comprehensive game understanding.

Local evidence: `test-results/cloud-jev-1789912278224/acceptance.json` and `test-results/cloud-jev-1789912474709/acceptance.json`. Successful game calls reported 189,383 input and 15,954 output tokens. These exclude connectivity probes and unknown server usage for cancelled calls; no billing total is inferred. Preparation failures involving an expired process and a subsequently corrected instrumentation recursion are excluded from these two valid runs.

## Reproduce

The script reuses existing Windows-encrypted Jev credentials. It never takes a plaintext key on the command line or copies the account vault. It first attempts the desktop encrypted store, then this Windows user's existing JevBrowserOperator DPAPI credential. Missing credentials stop the test. Decrypted data stays in a private subprocess pipe and process memory.

```powershell
npm run build
npm run build:native
# Cloud connectivity only; no game control
npx electron scripts/validate-jev-cloud.cjs
# Requires no running game; launches through Steam with an isolated control directory
npx electron scripts/validate-jev-cloud.cjs --run --launch --seconds 180
# Isolated experiment: contextualized cloud selection of non-emergency exploration targets
npx electron scripts/validate-jev-cloud.cjs --run --launch --seconds 180 --tactical-experiment
```

Run the two gameplay commands separately. Each `--launch` requires the Steam game to be closed; the script will not close it. Alternatively, use `--bridge <isolated-directory> --pid <verified-Steam-PID>` for an idle acceptance instance whose previous control lease expired at least five seconds ago. The directory must be under the current user's LocalAppData in `JevAutoplayAcceptance-*` or `JevCloudAcceptance-*`. Production's default control directory is excluded.

`--runtime <dist-main-directory>` selects a read-only compiled snapshot so another development session cannot change the code being measured. Reports include controller, bridge and policy SHA-256 hashes. Duration is bounded to 10–600 seconds and game requests to 120; each run first makes three separate connectivity requests. Cleanup requests manual control and checks native input release. Exit 0 means completed connectivity checks or an official match result; 1 means an error; 2 means the bounded gameplay test ended without a complete match.

## Policy limits

Default mode preserves product behavior: cloud advice receives only a small scoring bonus. The experimental variant adds action semantics, the last 12 player observations and a tactical target lifetime of up to three seconds. Availability, safety and failed-target exclusions are checked every frame. Existing foreground, identity, 250 ms observation freshness and native input leases remain enforced. Danger evacuation, low health, visible enemies, healing, equipment, reloading and cover retain local priority.

This tests **structured tactical selection**, not direct model control of keys, mouse or rendered frames. The experimental behavior exists only in the test script; production defaults and game binaries are unchanged. Both context and advice adoption differ, so these runs are not a model win-rate benchmark or a controlled A/B performance comparison.

`adviceSelected`, `changedFromRules` and `changedAndObserved` count sampling/control frames, not distinct cloud answers or completed actions. The last metric only confirms the target appeared in the game's `lastAction` acknowledgement. Position, ammunition, eliminations and official results establish further gameplay effects. Raw reports stay in Git-ignored `test-results/cloud-jev-*/acceptance.json`.

API usage follows the [official TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript). Model confidence is not a game win probability.
