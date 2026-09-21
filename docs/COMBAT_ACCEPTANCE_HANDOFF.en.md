# Combat and camera acceptance handoff

[中文](COMBAT_ACCEPTANCE_HANDOFF.md) · [Implementation](COMBAT_STRATEGY.en.md)

September 21, 2026: implementation is committed, but complete acceptance of the latest revision remains pending. Preserve manual takeover and foreground-loss release.

## Delivered

- JEV priorities, shared Bot execution and continuous view motion: public starting-room selection, partial reload, recovery, weaker-primary replacement, cover crouch-walking and ADS.
- 212 desktop tests passed. The actual C++ view controller passed 30/60/120 Hz, speed/acceleration, reversal, angle wrap, hitches, release and reduced-speed handover checks.
- Native Shipping candidate `20260921-08` compiled, cooked and passed packaged Steam configuration plus the 137-file artifact verification. EXE SHA-256: `ae7dce6349cc64d8b13f25b2c747c879d374737e8a148aec041dacf1e79beffc`.
- Desktop AI revision `f4889da1fafd`, built from `395b1b4` with physical clean dependencies. Seven packaged strategy hashes, dependencies and actual desktop launch verified. Two earlier builds using a dependency junction omitted dependencies and are not deliverables. The verified package is `release/combat-20260921-r3/win-unpacked`; use later build receipts for the capture repair.

## Trials

| Candidate | Outcome | Evidence and limits |
|---|---|---|
| 20260921-07 | 16th, 0 kills, 9 damage | Official result, 27 Jev calls/23 responses, confirmed manual release. Starting selection, crouch-walking and held ADS observed. No unexplained angular jump among 643 continuous gameplay pairs, using configured speed limits plus sampling tolerance |
| 20260921-08, attempt 1 | Interrupted | Foreground lost before gameplay, no Jev calls; not a scored match; inputs released |
| 20260921-08, attempt 2 | Interrupted | Foreground lost during entry, no Jev calls; not a scored match; inputs released |

Revision 08 addresses the distant-cover and lost-sight problems exposed by 07: constrain remote shelter advice, hold an ongoing shelter approach briefly, and look back toward an actually seen bearing during retreat. It has no completed match yet, so improved win rate, kill count or a winning streak are unproven.

## Capture incident and current state

After the game exited, the temporary demo script's OBS priority 0 allowed capture of another same-class window. Streaming was stopped; the game layer was hidden and audio muted. The temporary script now requires executable matching (2), fresh observations and game foreground. The desktop also restores priority 2 on existing inputs during reconnection. No crash report was submitted and the X event's private visibility was unchanged.

See [OBS's official matching implementation](https://github.com/obsproject/obs-studio/blob/master/libobs/util/windows/window-helpers.c): class matching permits another executable, whereas executable matching rejects it. A same-class window alone does not establish game-process identity.

## Resume

A continuous 5–10 minute game foreground window is needed. The capture skill calls for handoff after repeated acquisition failures instead of repeated isolated launches.

1. Resume frozen candidate 08 with the same desktop AI revision after foreground availability is established. Verify PID, EXE hash, foreground and capture target.
2. Check a real game probe before reconnecting the existing private X event. Hide capture on stale observations or foreground loss and exclude interrupted runs.
3. Exercise partial reload, recovery/cancellation, full-inventory replacement and cover retaliation. A run without a sniper or climbable obstacle does not validate scoping/climbing; grenades are not in the new tactical interface.
4. Complete official matches and record placement, kills, damage and motion separately. Streak acceptance requires matching native/policy/graphics/harness versions and confirmed release after every match.
5. The Steam live build remains unchanged; candidate acceptance precedes the game's release workflow.
