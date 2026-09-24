# Steam BOT gameplay-only streaming and evaluation

2026-09-24: run only the installed Steam Enter the Cube Playtest (5272970), never an editor or development package. The new Gameplay presentation retains game video and audio, stops hosting and hides the avatar, speech and captions, including after output recovery. The original Host presentation remains available.

Continuous play uses the official BOT MATCH rules. After a result, return to the actual lobby, wait a newly sampled 5–8 seconds, then start the next match. Loading time does not count as lobby time. Focus loss pauses the timer and control; manual takeover cancels automatic continuation. This replaces immediate rematching.

The local policy retains the existing Pro aiming executor and adds visible mechanical/player target priorities, conservation of scarce ammunition against distant machines, and nearby cover under multiple threats or rapid damage. Hidden machine health, subtype and target are unavailable and are not inferred. Opening selection uses public supplies, exits and hotspots, varying equal choices by match rather than always choosing the lowest room ID.

## Evaluation procedure

1. Start in a connected Steam lobby or official result with manual control. Record Steam BuildID, Studio strategy hash, process and session. Confirm real game capture, game audio and absent overlays before broadcasting.
2. Run `node scripts/evaluate-steam.cjs --label candidate --matches 5 --minutes 40 --build 25499909`. Replace the expected build only after verifying a Steam update. The harness controls the existing desktop API, reads actual Steam observations and releases inputs on completion.
3. Keep every official placement, win, kill, damage total, duration, room, damage event, mechanical sighting and interruption under `test-results/steam-evaluation/`. Never discard defeats as interruptions. Mark focus loss and missing telemetry separately. Random maps and small samples prevent strong performance conclusions.
4. Change one diagnosed failure at a time, pass regression tests and freeze the package/strategy identity. Follow five-match smoke tests with 20 complete matches, then a separate 100-match evaluation reporting win/top-ten rates, median placement, damage, kills, abnormal termination and uncertainty. These are planned sample sizes, not completed evidence.
5. Prioritize opening hazard deaths, failed evacuation and weapon/path loops before combat tuning. Preserve opponent count/difficulty, health and weapon damage. Use player-perceivable observations only.
6. Verify ingestion, advancing playback, actual gameplay and audio independently on X, YouTube and Twitch. OBS connection alone is insufficient; Twitch bandwidth tests do not verify viewer playback. Check encoding drops, game frame rate and decision latency with all outputs active.

## Initial baseline

Steam BuildID 25499909, old strategy 0bac7c87045f: both baseline matches ended 50th with zero kills and damage, approximately four seconds after landing. Both entered water-obstacle room 027 and fell into water after moving. This points to opening bias and traversal failure, not evidence of superior opponent shooting. Diversifying opening choices does not repair hazard traversal; further real matches are required and failures must be retained.
