# Jev tactics with a shared Bot executor

[简体中文](HYBRID_AUTOPLAY.md) · Author: [JackZH26 / X](https://x.com/jackzhj). Follow and discuss.

## Objective and evidence

On September 20, 2026, cloud Jev returned decisions with approximately 360 ms median and 435 ms P95 latency. In a separate run, all 106 position samples were identical despite accepted objectives. More frequent model calls cannot repair failed locomotion. See the [cloud validation](CLOUD_JEV_VALIDATION.en.md).

The Steam Playtest player should share navigation, weapons, hazard responses and recovery with existing Bots. Jev selects destinations, engagements, retreats and room transitions. Keep PlayerController possession to preserve camera, HUD, inventory, player state and manual takeover.

## Responsibilities

| Layer | Responsibility | Cadence |
| --- | --- | --- |
| Jev tactics | Select an offered engagement, cover, loot, exploration or room objective using recent routes, failures and own resources | Event driven; minimum 800 ms interval; one request in flight; 1.2 s timeout |
| Local director | Validate objectives, prioritize urgent survival, maintain stable targets, cool down failed targets and fall back during cloud outages | Each fresh observation, approximately 20 Hz |
| Shared executor | Bot Brain and Aim, UE path following, collision movement, weapons/abilities, interactions, hazards and stationary recovery | Brain at 20 Hz; path following and aim follow engine ticks |

Keep the existing Bot strategy entry point. Add an external-objective entry point to the same Brain for the player. PlayerController uses UE PathFollowingComponent; AIController retains its native MoveToLocation. Both use the same Brain execution code.

## Handoff contract

* Only currently offered action IDs are legal. No arbitrary coordinates, function names or console commands from the model.
* Session, match, epoch and frame bind ownership. Reject stale results across games and mode changes.
* Tactical objectives have a four-second soft TTL. Local control still renews a 250 ms lease. Cloud failure invokes local strategy; loss of the local controller releases inputs.
* Renewing the same objective does not clear paths, pulse held weapon inputs or reset the stationary watchdog. A materially different objective switches the task.
* Feedback reports running, succeeded, blocked, paused or released, with objective ID, reason, path state and failure count. Old feedback must not invalidate a new target.
* Priority: manual takeover/focus/lease > engine hazard response > immediate survival > Jev objective > ordinary local strategy.
* Completion, blockage, room, enemy and danger changes trigger reconsideration. Failed objectives enter a short cooldown. The executor continues its valid task while awaiting the cloud.
* Scanning reuses Bot cover scouting and short exploration instead of indefinite stationary camera rotation.

## Fairness and scope

No health, damage, ammunition, movement speed, collision or teleport overrides. Start from existing Pro aim parameters and calibrate player weapons against the actual camera ray. Expose only visible or publicly marked information, never hidden enemies or unrevealed collapse plans. Existing Bot strategy reads future safe-room plans; the external objective path must bypass that branch.

This native integration initially supports ETC offline Steam Playtest. Other Steam games need their own native or visual/input adapters; this does not make ETC's AIController universal.

## Delivery

1. Add capability negotiation, leased tactical objectives, event triggers and executor feedback to Studio, preserving legacy v3 behavior.
2. Reuse EtcCore Bot Brain, Aim and UE path following. The bridge observes, validates, delivers and reports.
3. Supply a reviewable native patch and installer without changing Lyra base modules.
4. Run type checks, policy tests, native compilation and automation before packaging and installing a Steam candidate.
5. Validate the actual Steam build with separate evidence for movement, ammunition consumption, portals and match results. Editor execution is insufficient.

## Acceptance gates

| Gate | Required evidence |
| --- | --- |
| Protocol | Stale epoch/match/frame rejection, stable lease renewal, correlated feedback, cloud fallback, takeover and input release |
| Motor | At least 40 routes including rooms 005/031, door approaches, chests and ledges; no unexplained stationary period over three seconds without recovery feedback |
| Match loop | At least 20 complete matches including entry, equipment, combat, travel, results and restart; interruptions are recorded separately |
| Bot tiers | Equal seed/equipment/public-information conditions against Easy through Pro; start with 100 trials and extend to 400 as needed; 95% win-rate lower confidence bound must exceed 50% against Pro |
| Battle royale | Nineteen Pro opponents; paired comparison with the same executor and Jev disabled; report wins, placement, survival, kills, room coverage, stalls and latency |
| Endurance | A complete two-hour broadcast, followed by 8/24/72-hour trials; streaming reliability and gameplay skill measured separately |

Outperforming all current ETC Bots is a target, not an established result. Claim superiority only within measured conditions after the corresponding gates pass, never over all games or all bots worldwide.

## Evidence boundary

This document specifies the adjustment. Code changes, native compilation, Steam installation and competitive results must be recorded separately; none substitutes for the others.

See the [first implementation and packaged-runtime acceptance](HYBRID_ACCEPTANCE.en.md): two official results, both 16th place. New Steam installation and tiered competitive acceptance remain pending.
