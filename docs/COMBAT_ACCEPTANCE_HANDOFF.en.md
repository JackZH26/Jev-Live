# Combat and camera acceptance handoff

[中文](COMBAT_ACCEPTANCE_HANDOFF.md) · [Implementation](COMBAT_STRATEGY.en.md)

September 21 update: current strategy `7db03bed26ce`, implementation `0c80ed6`, consecutive rehearsal runner `7e22018`. The latest desktop package is `release/combat-20260921-r5/win-unpacked`; actual startup, dependencies and seven embedded strategy modules are verified. Paired local native candidate `20260921-10` has executable SHA-256 `8d284b8ffe40448ae7139df80eb6a558e555c195f48b9c919d24ff6c140d2fe3`. Shipping, cook, actual pak configuration and 137 runtime files passed. The Steam installation remains unchanged.

All 214 desktop tests and type checking passed. The actual C++ controller tracks a 12-degree/s target with steady errors of 0.25/0.15/0.10 degrees at 30/60/120 Hz while preserving speed/acceleration limits. Changes include equipped-weapon distance, close automatics/distant sniper selection, loaded fallback, rocket stand-off, releasing old ADS on weapon changes, and shelter counterfire windows.

Candidate 10 completed two single-match runs: 11th/0 kills/0 damage and 10th/0 kills/12 damage, both with confirmed input release. The first exposed a prolonged ice-room routing stall; the second fired 24 shots. A subsequent consecutive rehearsal completed five matches, placing 14th, 1st, 12th, 10th and 5th. Its second official result was first place, two kills and 238 damage. This demonstrates one victory, but does not establish consistent performance or two consecutive wins with per-match release confirmation.

The former private X event had ended. A new event was explicitly set to Private and started. At 12:50 UTC+8 on September 21, screenshots from the actual X player confirmed gameplay, character, HUD and host overlays again; advancing video time alone does not establish correct capture. Private links and detailed receipts stay local. The older open desktop window operates OBS only; the new runner controls gameplay. The rehearsal is capped at 30 minutes, 1200 JEV requests or 20 matches. Speech still has latency and has not passed humanlike-hosting acceptance.

The missing game picture had two causes: strict acceptance exited and closed the game on focus loss, while stopping OBS directly left Studio in sending state and allowed its recovery loop to restart an empty encoder. Optional `--live` demonstration mode now pauses with released input on focus loss. It resumes only after the same process, session, match and control epoch retain identity, released input is confirmed and foreground remains stable for one second. Manual takeover cannot auto-resume. It does not steal focus. At completion it retains the game window only after confirmed release. Default strict acceptance is unchanged; demonstration receipts are excluded from streak acceptance. Seven related tests passed.

The local stream guard hides game capture, mutes audio and stops hosting during pause or unavailable telemetry, with corresponding English status pages. This status source is a browser page, so its page file must change rather than an ineffective text property. On rehearsal completion or more than 30 seconds without fresh telemetry, the watcher calls Studio stopStream to stop recovery as well. Recovery verification compares the current game source, composed program and actual X player images.

The following is historical candidate 07/08 handoff material. Resume from candidate 10 and the strategy above, prioritizing routing and stalled supply acquisition before completed matching-version performance acceptance.

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
