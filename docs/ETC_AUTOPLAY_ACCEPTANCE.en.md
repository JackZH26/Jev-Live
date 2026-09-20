# ETC autoplay acceptance · 2026-09-20

[简体中文](ETC_AUTOPLAY_ACCEPTANCE.md) · [Design/source analysis](ETC_AUTOPLAY.en.md)

**The new Steam build includes and connects JEV API v3. Real autoplay testing is possible; full-match acceptance failed, with competitive skill and win rate unverified.**

| Check | Observed result |
| --- | --- |
| Steam installation | AppID **5272970**, BuildID **25420188**, installed **candidate** branch; actual Shipping game launched through Steam |
| Handshake | All five autoplay attempts connected v3; the final Windows repair package passed a separate probe |
| Executed behavior | Automatic menu start, drop-in and movement; attempt 2 crossed room slots 9 → 8 |
| Sustained run | Longest attempt sampled approximately **163 seconds**, **2,381 decisions**, command latency P95 **57 ms** |
| Manual takeover | All five ended with connected telemetry, JEV/native manual and heldInputs = 0 |
| Equipment/combat | Not accepted; recorded shots and kills were zero |
| Complete matches | **Zero**, with no complete official results; no win-rate calculation |
| Blocker | Wall stall in authored room **031**, runtime slot **2**; repeated chest/door selection did not escape, so acceptance was stopped |
| JEV checks | Type checks, **107 tests across 15 files**, production build and isolated Windows packaging passed |
| Five languages | Final package passed Simplified/Traditional Chinese, Japanese, Korean and English UI checks |
| Streaming independence | Test instances stayed broadcast idle with every output inactive; no OBS setup, login or stream start. Another pre-existing broadcasting instance was not operated |

Latency is **game observation timestamp to completed local command write**, not full action/hit latency. All attempts failed or were interrupted, not five successful matches. The longest run includes loading and was deliberately stopped after visual confirmation of the wall stall.

## Repairs and limits

JEV now retains new-match grace until actual drop-in: at most 120 seconds for a requested match, 15 seconds for positively observed portal travel, and 1 second for ordinary frame stalls. No stale commands are sent; native input retains its 250 ms lease. Windows replacement gaps may reuse only an authenticated observation within its original freshness limit.

Resuming requires matching match/control epoch and foreground state. Manual takeover cancels reauthorization; long disconnects and identity failures stop. Tests now isolate the game mailbox as well as app data, with frame-level connection diagnostics and explicit failure status.

**This run did not replace Steam game binaries or republish ETC.** The final package passed interface/UI/manual-state checks. Navigation remains blocked; packaging is not full-match acceptance.

| Attempt | Sampled seconds | Decisions | P95 | Outcome |
| --- | ---: | ---: | ---: | --- |
| 1 | 2 | 14 | 60 ms | Premature manual fallback during loading |
| 2 | 35 | 346 | 56 ms | Movement/portal crossing, then state interruption |
| 3 | 19 | 89 | 55 ms | Short stall caused early stop |
| 4 | 15 | 24 | 64 ms | Trace confirmed stale state; concurrent code checks mean this is not a performance benchmark |
| 5 | 163 | 2,381 | 57 ms | Sustained control, room 031 wall stall, deliberately stopped |

## Evidence and reproduction

Private evidence is excluded from Git. Attempt directories are `test-results/etc-autoplay-<id>`, with IDs `1789910859041`, `1789910958974`, `1789911104335`, `1789911244271`, `1789911380172`. Each contains `acceptance.json`; the last two include `bridge-health.jsonl`. The final attempt also has `game-60s.png` and `navigation-stop.json`. The packaged-probe directory ID is `1789911743352`.

Repair candidate: `.local/autoplay-acceptance/win-unpacked/JEV Studio.exe`, without replacing the existing studio. Mobile-friendly standalone report: `test-results/etc-autoplay-acceptance.html`. Close the Steam game before isolated launch; do not control the same process concurrently:

```powershell
# Launch the installed game and probe; no autoplay or streaming
node scripts/smoke-autoplay.cjs --launch --isolated --packaged ".local/autoplay-acceptance/win-unpacked/JEV Studio.exe"
# Actual single-match acceptance, retaining failures
node scripts/smoke-autoplay.cjs --run --isolated --matches 1
```

Next, diagnose native player path reachability and wall-corner escape. Existing bots monitor sustained lack of displacement and exclude unreachable loot for the current room; the JEV adapter mainly retries other targets after a short cooldown. Adapt suitable recovery to player controls while preserving normal movement, collision and damage. The exact navigation/collision cause in room 031 remains undiagnosed; a screenshot alone does not identify a faulty asset. Native repairs require a new game candidate and Steam retest.

Then accept equipment, combat, evacuation, official results and restart before 20 functional runs and 100 held-out matches. The new handshake supersedes the missing-v3 result for old build 25364079; previous native build/constraint receipts do not replace Steam testing.
