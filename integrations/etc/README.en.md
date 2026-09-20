# ETC autoplay API v3 / shared Bot executor

[简体中文](README.md) · [Architecture and acceptance gates](../../docs/HYBRID_AUTOPLAY.en.md)

ETC developers compile this native integration into the game. Players launch Enter the Cube Playtest from Steam without a project editor.

```powershell
./integrations/etc/install.ps1 -Project <ETC-project-root>
# In ETC, with the editor closed, follow project build rules
./Tools/Build.bat LyraGame Shipping
```

The installer checks `shared-controller.patch` and `room-control.patch`, reuses Bot Brain / Aim and room movement, then copies the bridge, controller adapter and tests into EtcCore. Repeated installation detects applied patches; source conflicts stop installation for review. Module Install/Uninstall hooks are retained. Legacy Steam v3 builds without `shared-bot-v1` retain the previous Studio policy; new executor deployment is never inferred from compilation.

The player retains PlayerController, camera and HUD while sharing UE path following and Bot weapon, hazard and stationary-recovery logic. Jev selects leased tactical objectives. Local renewals run at approximately 20 Hz; renewing a target does not restart its path. Existing Bot strategy remains separate.

Offline matches only. Sessions bind to the actual game PID. Manual takeover, focus loss and expired leases release automatic inputs. Never commit sessions or credentials. Feedback identifies the objective, status, reason, failure count and path state.

Native constraints test: `Project.ETC.Jev.PlayerMotor`. Packaging, upload and actual Steam installation follow ETC's release workflow. This installer neither modifies the Steam installation nor publishes a game update. Compilation is not full-match acceptance.

After installing a Steam build with this executor, run `scripts/validate-jev-cloud.cjs --run --launch --require-hybrid --seconds 180` under Electron with a built Studio runtime. The capability requirement rejects legacy games and records real movement and native feedback. It cannot be combined with the legacy experimental override. See [cloud validation](../../docs/CLOUD_JEV_VALIDATION.en.md).

For a full local packaged match, recorded separately from Steam installation acceptance:

```powershell
npm run build
npx electron scripts/validate-hybrid-local.cjs --candidate <directory-with-artifact.json> --jev --seconds 1800 --requests 1200
```

The runner verifies the executable hash, launches its own game/bridge and reads the locally encrypted Jev key. It focuses its own window once, then stops on focus loss; it does not configure OBS. Each trial is saved under ignored `test-results`. Only an official result counts as completion; time/request exhaustion exits with code 2. Maximum duration is one hour with 2400 requests. Omit `--jev` for the local-rule baseline.
