# JEV + BOT combat fundamentals and camera motion

[中文](COMBAT_STRATEGY.md)

The September 21, 2026 requirements cover official placement, eliminations and game-reported damage, measured separately. JEV selects tactical objectives, desktop rules arbitrate urgent priorities, and the shared BOT executes movement, aim, weapon inputs and hazards. Preserve 19 Regular opponents, normal physics, manual takeover and player-visible information.

## Priorities

1. Release on manual takeover, foreground loss or expired observations. Preserve normal death and results.
2. Finish a physical airborne/traversal action; escape active danger. In a yellow room without enemies, move toward a connected white room before optional supplies, healing or ammunition maintenance.
3. On damage, use visible/recently observed threats and nearby verified cover. Reach cover before a bounded counterattack window, avoiding per-tick cover/attack oscillation.
4. Without enemies or recent incoming damage, use available recovery items, top up a partial magazine using its real capacity, then upgrade equipment. Threats interrupt maintenance.
5. Take favorable visible fights from effective range, without automatically rushing out of cover. Alternate short defense with local observation instead of indefinite hiding or unnecessary hazard-room hopping.

## Execution contract

| Capability | Execution and acceptance |
|---|---|
| Starting room | Use the actual visible pick screen, public supply markers, hotspots and exits. Lock through the normal selection method and retain the shared drop countdown |
| Reload | Report the weapon's `MagazineSize`. Reload below capacity; unknown capacity is not guessed and a full seven-shell shotgun is not repeatedly reloaded |
| Upgrade | Reach a visible higher-rank gun, revalidate inventory and threats, activate the normal player drop ability on a weaker primary, then use normal overlap pickup. Never discard the fixed sidearm |
| Recovery | Use owned consumables through the public player action; wait through the cast and permit danger/damage interruption |
| Crouch/walk | Crouch on the final cover approach; traversal, sprint and hazard posture take priority; release during takeover |
| Aim/scope | Reuse ADS ability input and the SR01 scope. Fire gating uses the actual camera-to-target angle |
| Jump/climb/sprint | Retain shared BOT hazard providers, ordinary GAS input, grounded checks, forward intent and ledge constraints |
| Incoming direction | Use actual sight and brief last-seen memory; search with bounded looks when the attacker is unseen, without hidden-position lock-on |
| Measurement | Record placement, kills, shots and the game's damage statistic separately. Missing damage remains unavailable, never estimated from shots |

Capability availability and observed execution are separate checks. A match without a sniper or climbable obstacle does not validate scoping or climbing. Operations such as grenades not added to this tactical interface must not be represented as fully covered.

## Camera

September 21 follow-up: engagement distance now follows the equipped weapon. The player motor prefers loaded automatics nearby, considers a sniper at longer sightlines, and suppresses point-blank rockets. Switching releases the previous weapon's ADS ability before normal reacquisition. SMG classification precedes the overlapping `MG01` substring; ordinary opponent BOT difficulty remains unchanged.

Reaching shelter grants a healthy, loaded fighter a 1.6-second counterattack window, including after another minor hit. An exposed shelter approach lasting more than three seconds is reconsidered. Low health, empty ammunition, lost visibility and room danger override the burst. Brief target persistence prevents small distance changes from continually resetting aim.

Camera tracking uses angular velocity estimated from consecutive visible bearings. Target changes, lost visibility, hitches and manual release clear the estimate. In an isolated 12-degree/s moving-target test, steady error at 30/60/120 Hz falls from approximately 2.75–2.90 degrees to 0.25/0.15/0.10 degrees while preserving speed and acceleration bounds. This is an algorithm result, not a measured improvement in match accuracy or win rate.

Previously, travel facing, 90-degree scouting, periodic full-circle awareness and aiming could each write the view. A single player-view controller now arbitrates traversal, combat, observation and travel targets in that order. Ordinary enemy BOT aim tuning stays unchanged.

A damped controller preserves angular velocity across target changes, limits speed and acceleration, and uses the shortest arc across ±180 degrees. Horizontal limits are 150 degrees/s normally and 240 degrees/s for combat/traversal; pitch is 110 degrees/s. Hitches advance at most 50 ms. Brief, spaced observation targets replace scheduled full-circle spins. Manual release clears momentum.

These are candidate parameters requiring visual review and recorded trajectories. Smooth control rotation does not establish acceptance of collision-camera translation, portal reveal or scope FOV transitions.

## Acceptance

Desktop rules and native changes are development candidates; final build receipts, frozen input hashes and actual matches establish what ran. Compilation does not establish higher win rate. The prior corrected Steam candidate completed sixth with zero kills; see the [version/stall audit](STRATEGY_AUDIT_20260921.en.md). New capabilities cannot inherit older results.

The first local Shipping candidate `20260921-07` completed 16th, with 0 kills and 9 game-reported damage (23 Jev responses; manual release confirmed). Selection, crouch-walking and held ADS were observed. Across 643 continuous gameplay rotation pairs, no unexplained angular jump exceeded the configured speed bound plus 3 degrees of sampling tolerance; measured maximum yaw rate was 161.3 degrees/s. This proves those observed execution paths, not a stronger combat outcome. The trace exposed distant shelter selection and loss of visual contact. The next revision limits shelter commitment, retains an actually seen bearing during retreat, and decelerates smoothly when switching to a lower camera speed cap.

Exercise room selection, partial reload, replacement, healing interruption, cover retaliation and each used posture before full matches. Reset statistics when the version changes. Camera checks cover 30/60/120 Hz, reversal, wrap, hitches and manual release. Private recordings and raw receipts stay local and outside Git.
