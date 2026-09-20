# 0.1.4: correct acceptance when the game disconnects

[简体中文](ITERATION_014.md) · [English](ITERATION_014.en.md)

Author: JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj). Follow and share feedback.

Includes the [0.1.3 local five-language speech and recovery changes](ITERATION_013.en.md). Scope remains priorities 1–6; 7–8 stay deferred.

At 2026-09-20 21:19:35 UTC+8, the new local three-output run recorded a disconnected game observer. Process inspection also found no Steam Playtest process. OBS can continue encoding its last frame, so growing output frame counts and error-free audio do not prove that gameplay continues. The game's exit cause remains unconfirmed and is not attributed to the other development session.

The two-hour run was deliberately stopped at 21:25 and **did not pass**. Its original failure report preserves the cleanup trigger (stopping a test receiver); a supplemental assessment records the missing game process as the reason for interruption. All three test OBS instances closed; only the private review output remains. Coordinate game usage/investigate exit causes before restarting acceptance on an exact build.

Corrections:

- An endurance sample must retain a connected game observer; disconnection fails immediately.
- Disconnection covers the captured picture with a five-language “Waiting for the game” screen. It clears when observation returns, preventing a stale frame from appearing to be continued gameplay. Avatar, chat and hosting remain independent.
- No automatic gameplay, game restart or takeover, and no changes to the separately owned autoplay module.

Type checks, 99 TS tests, build and actual Chromium checks for the disconnect/reconnect screen, audio retry and reload deduplication passed.

Priorities 1–6 are not fully accepted: real YouTube/Twitch interaction is gated on eligibility/authorization; full matches, 2/8/24/72-hour runs, OS supervision, signing, public OAuth, trusted updates and clean-PC testing remain outstanding. The fixed private X dashboard is [Live Studio](https://studio.x.com/live). Updating does not require recreating the current event, but its player may need refreshing.
