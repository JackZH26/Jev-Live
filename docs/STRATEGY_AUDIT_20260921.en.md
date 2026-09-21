# Live strategy version and stall audit

[中文](STRATEGY_AUDIT_20260921.md)

On September 21, 2026, the user reported stationary, weak play in the private X stream and requested the latest optimized strategy. The initial desktop executable was an old package, while the installed Steam game was current. Switching the desktop exposed two additional execution loops in actual play.

## Version evidence

Steam AppID 5272970 runs BuildID 25425783. The running Shipping executable hashes to `45ce304b64cc6102e215c67406d2db607ea239318d385b01f05637e68eb5faf2`, matching both the first winning receipt and the current release acceptance.

The old desktop schema lacked `inspect_map`. Once gameplay offered that action, the desktop rejected the observation and released automatic control. Its UI also hardcoded version 0.1.2. Neither connectivity nor that label established current strategy identity.

After switching, all seven strategy module hashes matched the latest `20260921-05` candidate receipt. The first winner used knowledge version 02; version 03 added countdown-bounded supplies and cancellation of old relocation during defense. Later versions cannot inherit an earlier win. One recorded first place does not establish a stable win rate.

## Findings and changes

| Finding | Evidence | Change |
|---|---|---|
| Repeated completed pickup | A helmet remained offered after `headgear_equipped`; sampled position stayed within roughly one meter for 52 seconds | Both local selection and cloud options retire acknowledged pickups/chests. Reappearing targets and bounded expiry permit reconsideration; a new match resets memory |
| Competing weapon selection | Grenade launcher and rifle alternated repeatedly with `equip_2`, scan and wait | Leave loaded-primary selection to the shared motor; preserve starter upgrades and empty-weapon emergency switches |
| Stale package preference | Launcher preferred `release/hosting` by path | Build manifests fingerprint strategy sources; launcher rejects mismatches. UI displays actual application version and AI fingerprint |
| Waiting after death | `autoRestart=false` deliberately waited at the official result | Distinguish post-match waiting from an active gameplay stall; continuous demonstrations require automatic next matches |
| Foreground loss | `foreground=false / focus_lost` preceded manual release | Preserve input safety and record interruption; do not count the resulting placement as fully automatic |
| Recovery failure after a hitch | A focused trial reported `lease_expired`, then released control; a regression reproduced use of the pre-read clock after asynchronous I/O | Refresh the recovery clock after reading; account for mailbox I/O time while retaining 250 ms freshness and unchanged input leases |

The 52-second duration measures sampled displacement, not exact zero velocity. Completed-target memory requires execution acknowledgement and does not treat sending a command as success.

## Acceptance limits

Before these fixes, the current strategy completed a Steam-installed match in 12th place. The following diagnostic match acquired weapons, traversed rooms and recorded one kill, then lost foreground. Its eventual second-place screen is excluded from full automatic results.

The fixes preserve the native game, 19 Regular opponents, damage, random maps and official results. Final strategy fingerprint: `b9c1a7518614`. Build, type checks and 193 tests passed, including lingering completed targets, genuine reappearance, loaded-primary ownership, emergency switching and post-I/O clock checks. Launcher checks cover an older hosting package and source changes invalidating the package. Automatic next matches are enabled for the private demonstration.

The first full corrected Steam match finished officially sixth, with zero kills and zero shots, 153 JEV requests / 140 accepted responses, and 58 ms local observation-to-command P95. It traversed four rooms, acquired a primary, defended a safe room and evacuated on warning. Its final movement in archetype 002 showed descending positions followed by death, without a visible enemy or preceding health loss. A roughly 20-second no-progress segment remains. This does not establish improved combat skill. Automatic next-match entry worked. This continuous demonstration did not perform an end-of-match manual-release check and does not replace strict streak acceptance.

Private media, chat and raw observations remain in local `test-results`, outside Git. Passing software checks and one sixth-place result do not establish improved win rate.
