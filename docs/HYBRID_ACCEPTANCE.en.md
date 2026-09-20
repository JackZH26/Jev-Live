# Shared executor: first acceptance round · 2026-09-20

[简体中文](HYBRID_ACCEPTANCE.md) · [Architecture](HYBRID_AUTOPLAY.en.md)

## Update · 2026-09-21

The current local candidate is `20260920-05`. Two consecutive first places remain unachieved. Official receipt `hybrid-smoke-1789920022258` recorded 3rd place, one kill, eight rounds consumed, 283 cloud requests / 251 admitted replies and successful manual release. The next match placed 19th, followed by another 3rd with no kills. All failures and interruptions remain in the record; intervening losses cannot be skipped.

This iteration fixes repeated healing under fire, repeated reloads of a full seven-shell shotgun, short-lived target oscillation, movement without net path progress, pendulum-room path corners and known destination-room risk ordering. Enemy count, difficulty, damage, health and result calculation were unchanged. Candidates use isolated real game settings: 720p, a 60 FPS cap, unchanged view distance and reduced shadow/reflection cost. Steam preferences remain untouched. Heavy native builds are kept outside full-match trials.

`scripts/validate-hybrid-series.cjs` runs complete matches serially, stopping on two consecutive official first places for one version. An interruption or unsuccessful input release stops the batch. `scripts/hybrid-streak.cjs` recomputes the streak from every chronological receipt. Version identity includes native package, runtime policies, test harness and graphics hashes. Official results, cloud participation and successful input release are all required.

Studio type checks and the full **155/155** suite passed. Private-console Python access-protection tests passed **4/4**. Candidate 05 passed Prepare → Cook → Build-snapshot → Stage and 137-file verification. The website console passed real HTTPS access protection, mobile layout and browser-script checks. The private X output was visually checked against the active game and avatar; game/audio rebinding now follows each new test process. See the [console guide](../console/README.en.md). These engineering checks do not replace victory or endurance acceptance.

The sections below retain the earlier rounds' history. New Steam installation acceptance and two consecutive first places remain outstanding.

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

2026-09-21 gameplay-context iteration: curated bilingual rules for the current 001–028 catalog, with a local source audit. Jev only knows the current and previously visited archetypes. Added actual M-map snapshots, countdown reviews, connected-room plans and private console visualization; see [gameplay knowledge](ROOM_KNOWLEDGE.en.md). All 166 TypeScript tests and four console security tests passed.

Candidate `20260921-02`, trial `hybrid-smoke-1789923875621`, actually opened M (three samples confirmed visibility), obtained a 42-room snapshot and traversed Gallery and Big TV. Fourteen cloud calls included corresponding room rules; twelve tactical replies were accepted, with recent successful responses around 397–512 ms. A portal hitch exposed an old travel-release reason masking subsequent lease expiry, so acceptance conservatively stopped. There was no official result and no win credit. Native repeated-release feedback has been corrected for the next candidate. The 250 ms input lease and manual takeover boundary are unchanged.

The user's current milestone is two consecutive official first-place results on the same local candidate. It remains unmet; iteration continues against that criterion.

In diagnostic run `hybrid-smoke-1789916337173`, all 53 successful cloud replies chose scanning and the three-minute run timed out. Added scouting progress, room duration, recent damage and a twelve-second unproductive-scan limit. Run `hybrid-smoke-1789916611837` crossed a room before stalling; its screenshot and source inspection identified Room027 direct movement excluding PlayerController. That trial also remained incomplete.

Candidate `20260920-03` fixes this integration and gates room 010/011/024/027 per-frame movement on the player's control lease. Shipping, Cook, Stage and 137-file verification passed. Longer trials exposed lease interruptions; bounded recovery now requires the same identity/match, foreground and fresh observations. Interruptions remain recorded as non-wins. The background editor used about 78% of GPU; minimizing its windows reduced this to about 4.5% while preserving its process and development state. Full matches must establish the resulting improvement.

1. Install the new build from Steam, launch from its library and validate cloud Jev.
2. Obtain valid native automation results; complete 40 navigation routes and 20 full matches.
3. Improve early supplies and continuous threat discovery. The cloud run fired no shots; its cause needs investigation before claiming capable combat.
4. Run matched-seed, equipment and information tests across Bot tiers and nineteen-Pro battle royale trials. No superiority claim before statistical gates pass.
5. Complete the two-hour broadcast and subsequent 8/24/72-hour endurance trials.

Existing Steam default/candidate branches and online servers remain unchanged. The candidate displays `Playtest 2026.09.20.02`; UE's network compatibility check includes this field. Do not replace the online version without matching-server validation. Use a separate test branch for offline autoplay acceptance first.
