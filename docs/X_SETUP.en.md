# X streaming setup

[简体中文](X_SETUP.md) · [English](X_SETUP.en.md)

JEV Studio uses an **official X Live Studio RTMPS source** as a third independently selectable output alongside YouTube and Twitch. Games are still added and launched through Steam; the first test target is Enter the Cube Playtest (5272970). Automatic/manual mode changes only game input.

## One-time setup

1. Open [X Live Studio](https://x.com/i/live-studio) with your account. Access to Live Studio and external-encoder streaming is required; browser sign-in does not grant the app OAuth authorization.
2. In Manage Sources, select an existing source or create one in a nearby region. Its name is a connection label, not a development project.
3. Open Encoder setup. In JEV Studio, open Connections & settings → Set up X streaming, enter a name, RTMPS URL and Stream key, and save the source encrypted. Keep these values on this computer; never put them in Git, chat or screenshots.
4. Return to the studio and select X alone or with YouTube / Twitch. Prepare selected OBS outputs, select the Steam game window and apply it. Reapply capture after adding an output.

Upgrades preserve your output selection and do not enable X automatically. Removing local configuration does not delete the source on X. Re-enter both URL and key when changing sources.

## Each broadcast

1. Check the Steam game preview. Start streams sends video and game-process audio to selected destinations.
2. Create a livestream in X Live Studio, select the same source, enter a title and review Audience. Start with **Private**, visible only inside Live Studio. Confirm the preview and choose Go Live; scheduling/auto-start can also be configured on X.
3. The YouTube privacy option **does not control X**. This version does not create X livestreams, publish posts, synchronize X titles, or read/reply to X chat. A saved source or a sending OBS encoder does not prove the event is live on X.
4. Stop outputs in JEV Studio and confirm the livestream has ended on X. The app clears OBS's temporary stream key and retains the encrypted local source for reuse.

Selecting Twitch starts a public stream. All selected destinations must prepare successfully before any output starts. Deselect YouTube while its streaming permission is pending to use available destinations alone.

## Encoding and limits

X uses separate OBS with H.264 High, 1920×1080 at 30 fps, AAC 128 kbps and a three-second keyframe interval. Video bitrate follows app settings (6000 kbps by default). This is a conservative preset based on the tested account's encoder panel, not a claim that X only supports 30 fps. Current official help also recommends 1080p60; check the account panel and current documentation for deployment.

Ordinary X OAuth is not used as a substitute for streaming-source access. Automatic creation/termination of X livestream events and 24-hour rotation are not implemented. X events last at most 24 hours, and timed-out events must be recreated. Short tests do not establish unattended 24-hour reliability.

2026-09-20: three concurrent local encoders passed, including X's three-second keyframes. A real **Private** X event received Steam Playtest lobby video and the platform player's clock advanced; the event and output were ended. The player selected a 720p rendition during the check; the source was 1080p30. No public post was made. In-match gameplay, long-duration stability and human listening acceptance remain unverified. See the [acceptance record](PHASE1_STATUS.en.md).

Reference: [official X Live Studio help](https://help.x.com/en/using-x/live-studio).
