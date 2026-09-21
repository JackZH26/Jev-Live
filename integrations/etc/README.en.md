# ETC autoplay API v3 / shared Bot executor

[简体中文](README.md) · [Architecture and acceptance gates](../../docs/HYBRID_AUTOPLAY.en.md)

ETC developers compile this native integration into the game. Players launch Enter the Cube Playtest from Steam without a project editor.

```powershell
./integrations/etc/install.ps1 -Project <ETC-project-root>
# In ETC, with the editor closed, follow project build rules
./Tools/Build.bat LyraGame Shipping
```

The installer checks `shared-controller.patch`, `room-control.patch`, `awareness.patch`, `pendulum-path.patch` and `combat-camera.patch`, reuses Bot Brain / Aim and room movement, then copies the bridge, controller adapter and tests into EtcCore. The patch chain is normalized and checked on a temporary copy before writing source; repeated installation is supported and source conflicts stop installation for review. Module Install/Uninstall hooks are retained. Legacy Steam v3 builds without `shared-bot-v1` retain the previous Studio policy; new executor deployment is never inferred from compilation.

The player retains PlayerController, camera and HUD while sharing UE path following and Bot weapon, hazard and stationary-recovery logic. Jev selects leased tactical objectives. Local renewals run at approximately 20 Hz; renewing a target does not restart its path. Existing Bot strategy remains separate.

Offline matches only. Sessions bind to the actual game PID. Manual takeover, focus loss and expired leases release automatic inputs. Never commit sessions or credentials. Feedback identifies the objective, status, reason, failure count and path state.

Native constraints test: `Project.ETC.Jev.PlayerMotor`. Packaging, upload and actual Steam installation follow ETC's release workflow. This installer neither modifies the Steam installation nor publishes a game update. Compilation is not full-match acceptance.

The combat/camera extension adds visible starting-room selection, capacity-aware reload, safe consumable selection, higher-rank primary replacement and player-only view arbitration. `Project.ETC.Jev.ViewMotion` exercises speed, acceleration, reversal, wrap and reset. Optional `diagnostics.view` and `diagnostics.motion` expose measured motion and held ADS for local acceptance, without changing opponent tuning. See the [combat execution contract](../../docs/COMBAT_STRATEGY.en.md).

After installing a Steam build with this executor, run `scripts/validate-jev-cloud.cjs --run --launch --require-hybrid --seconds 180` under Electron with a built Studio runtime. The capability requirement rejects legacy games and records real movement and native feedback. It cannot be combined with the legacy experimental override. See [cloud validation](../../docs/CLOUD_JEV_VALIDATION.en.md).

For a full local packaged match, recorded separately from Steam installation acceptance:

```powershell
npm run build
npx electron scripts/validate-hybrid-local.cjs --candidate <directory-with-artifact.json> --jev --seconds 1800 --requests 1200
```

The runner verifies the executable hash, launches its own game/bridge and reads the locally encrypted Jev key. It makes at most three startup focus attempts against its verified PID/path, then stops on focus loss; it does not configure OBS. Each trial is saved under ignored `test-results`. Only an official result counts as completion; time/request exhaustion returns a nonzero exit code. Maximum duration is one hour with 2400 requests. Omit `--jev` for the local-rule baseline.

Own damage retains a five-second threat window to prevent healing loops when the attacker leaves the view. Native camera search is bounded; remembered cover threats use last-seen snapshots only. Tests isolate Saved settings and use ordinary low lighting quality with unchanged view distance, without changing Steam preferences or Bot stats.

A selected room is a contingency evacuation plan, not an immediate portal order. Starter-pistol loadouts prioritize supplies, and taking fire cannot mean endlessly running toward a distant door without responding. Exit goals retain their actual elevation; airborne steering finishes before a tactical replacement or map inspection. The optional `grounded` observation preserves older-game parsing. Native execution defers target replacement while airborne and renews the existing action; manual takeover, focus loss and lease expiry still release immediately.

After a result the runner sends manual takeover and waits at most three seconds for the same authenticated process, the requested manual epoch, a fresh observation and zero inputs. Missing confirmation stops the batch; later disk snapshots never rewrite previous receipts.

`node scripts/hybrid-streak.cjs` rebuilds a chronological ledger from all local receipts at ignored `test-results/hybrid-streak.json`. Two official firsts must share native, policy, graphics and harness versions, with actual Jev participation and verified input release. Losses, interruptions and version changes reset the streak. `destinationRisk` comes from normal map state: 0 safe, 1 upcoming, 2 active danger, 4 closed. Closed exits cannot execute; tactics and evacuation rules evaluate the other risks.
