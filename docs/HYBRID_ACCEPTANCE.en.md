# Shared executor: first acceptance round · 2026-09-20

[简体中文](HYBRID_ACCEPTANCE.md) · [Architecture](HYBRID_AUTOPLAY.en.md)

## Conclusion

Implementation, compilation and two packaged-candidate matches completed. Evidence covers sustained movement, room transitions, ammunition consumption, official results and manual release. **Both matches finished in 16th place; outperforming existing Bots has not been achieved.** Cloud Jev participated in the second match, but recorded no shots or kills. Supply selection, threat discovery and reactions to damage still need improvement.

These were pre-release checks of packaged candidate `20260920-02`, **not acceptance of a newly installed Steam build**. The Steam installation remains BuildID `25420188`; no candidate upload or branch change has occurred. Editor footage was not used as game-runtime evidence.

## Engineering checks

* Studio type checks passed; latest full suite 145/145, including tactical-progress and bounded lease-recovery regressions.
* Studio frontend and main-process builds passed.
* ETC Shipping, accompanying native modules and frozen-snapshot Shipping compiled.
* ETC release tooling and backend checks: 100/100 passed.
* Cook and Stage succeeded; 137 runtime files and actual packaged AppID/configuration verified.
* Complete upload archives verified with seven and 130 files respectively; not uploaded.
* Native automation entry points produced no valid test report. **They are not counted as passed.** Test discovery/execution still needs repair and verification.

## Runtime observations

| Metric | Local rules + shared executor | Cloud Jev + shared executor |
| --- | --- | --- |
| Raw directory suffix | `hybrid-smoke-1789915354075` | `hybrid-smoke-1789915590474` |
| Playing-position samples | 62 | 101 |
| Distinct positions, rounded to 0.1 cm | 60 | 88 |
| Sampled within-room path length | 127.62 m | 223.1 m |
| Room slots | 13 → 14 | 18 → 38 → 40 |
| Observation-to-command P95 | 50 ms | 49 ms |
| Confirmed ammunition consumption | 5 rounds | 0 |
| Kills | 0 | 0 |
| Official placement | 16th | 16th |
| Manual release | Passed | Passed |
| Cloud requests / admitted responses | None | 24 / 23 |
| Cloud latency median / P95 | N/A | 392 / 1167 ms |

Path length sums planar distances between adjacent samples in the same room, excluding room teleports; it is not exact odometry. Seeds and encounters differ, so these matches are not evidence that cloud tactics outperform local rules. The second run returned 17 exploration scans and six portal choices; one request timed out after approximately 1.2 seconds while local control continued. Raw receipts reside in local Git-ignored `test-results` and contain no keys.

Earlier setup failures involving foreground acquisition, loading-phase reauthorization in the test harness and an already-exited candidate process were recorded separately and excluded from these two valid matches. Lease and foreground protections were not relaxed.

## Remaining gates

The user's current milestone is two consecutive official first-place results on the same local candidate. It remains unmet; iteration continues against that criterion.

In diagnostic run `hybrid-smoke-1789916337173`, all 53 successful cloud replies chose scanning and the three-minute run timed out. Added scouting progress, room duration, recent damage and a twelve-second unproductive-scan limit. Run `hybrid-smoke-1789916611837` crossed a room before stalling; its screenshot and source inspection identified Room027 direct movement excluding PlayerController. That trial also remained incomplete.

Candidate `20260920-03` fixes this integration and gates room 010/011/024/027 per-frame movement on the player's control lease. Shipping, Cook, Stage and 137-file verification passed. Longer trials exposed lease interruptions; bounded recovery now requires the same identity/match, foreground and fresh observations. Interruptions remain recorded as non-wins. The background editor used about 78% of GPU; minimizing its windows reduced this to about 4.5% while preserving its process and development state. Full matches must establish the resulting improvement.

1. Install the new build from Steam, launch from its library and validate cloud Jev.
2. Obtain valid native automation results; complete 40 navigation routes and 20 full matches.
3. Improve early supplies and continuous threat discovery. The cloud run fired no shots; its cause needs investigation before claiming capable combat.
4. Run matched-seed, equipment and information tests across Bot tiers and nineteen-Pro battle royale trials. No superiority claim before statistical gates pass.
5. Complete the two-hour broadcast and subsequent 8/24/72-hour endurance trials.

Existing Steam default/candidate branches and online servers remain unchanged. The candidate displays `Playtest 2026.09.20.02`; UE's network compatibility check includes this field. Do not replace the online version without matching-server validation. Use a separate test branch for offline autoplay acceptance first.
