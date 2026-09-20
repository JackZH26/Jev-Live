# One-time official OAuth setup

[简体中文](OAUTH_SETUP.md) · [English](OAUTH_SETUP.en.md)

The software developer configures the application; streamers sign in on official websites. Never send Client Secrets, tokens, cookies, stream keys or OAuth JSON through chat or Git.

## Google / YouTube

1. Create a [Google Cloud](https://console.cloud.google.com/) project and enable YouTube Data API v3.
2. Configure OAuth branding, audience and data access. During development, External / Testing is suitable; add the intended accounts as test users.
3. Create an OAuth Client ID of type **Desktop app** and download its JSON.
4. Import it under Connections & settings. Only the `installed` format is accepted; Web clients and service accounts are unsuitable.
5. Return to the studio and sign in with Google in the system browser.

The implementation uses Authorization Code + PKCE S256, random state and a new random-port `127.0.0.1` callback per attempt. It requests `youtube.force-ssl` and offline access for refresh. A Google desktop client secret cannot remain confidential in client distributions, but imported credentials are still stored encrypted locally.

The channel needs streaming access. Testing status, unverified applications and refresh-token lifetime follow Google's current rules. Public distribution requires the branding, privacy policy and verification requested by the console; test-user results cannot establish production readiness.

For a YouTube-only test, select only YouTube in the studio, keep visibility Private, prepare the selected OBS output and apply the Steam game window. No Twitch account is needed. On a channel's first activation, follow the wait countdown in YouTube Studio; successful OAuth binding does not bypass activation. End the test after verifying received video and audio.

If starting immediately returns to idle with `livePermissionBlocked` or `liveStreamingNotEnabled`, use the error's YouTube Studio link to check the activation countdown or channel restrictions. All selected destinations must be prepared before streaming begins, so a YouTube rejection does not automatically start Twitch alone. Before starting, you can deselect YouTube and select only Twitch; Twitch broadcasts are public. Platform checkboxes work independently of manual/automatic gameplay and can be unchecked again, including clearing all selections. Starting requires at least one selected platform. Selection stays locked during a broadcast and unlocks when it ends. Apply game capture again after adding an output.

## Twitch

Before registering an application, Twitch requires the developer account to have a verified email and two-factor authentication enabled. The account owner completes sign-in, CAPTCHAs and two-factor verification on the official website. See [Twitch application registration requirements](https://dev.twitch.tv/docs/authentication/register-app/).

1. Register a **Public** application in the [Twitch developer console](https://dev.twitch.tv/console/apps).
2. Enter its Client ID; no Client Secret is required.
3. Click official sign-in. The app opens the activation URL returned by Twitch, normally with the verification code included. Authorize on the official website; connection completes automatically.

Requested scopes are `channel:read:stream_key` and `channel:manage:broadcast`. Chat permissions are not requested before chat is implemented. Refreshes are serialized and rotated refresh tokens are saved immediately. Authorization is validated at startup and every 55 minutes.

If the console requires a Redirect URI, register `http://localhost`. This app's **Device Code Flow does not use a redirect callback**. Do not switch the application to Confidential while retaining these settings.

Broadcaster Suite is an appropriate application category; the application name must be unique. After binding, verify the channel name and streaming permissions. Connecting an account does not start a broadcast. The studio's platform checkboxes determine whether Twitch participates in the next broadcast.

## Distribution to ordinary streamers

After registration and applicable review, maintainers can supply their application's Client IDs in a build so streamers do not need their own developer projects. The source build retains configuration fields and hardcodes no real accounts or credentials. This phase does not host account passwords or synchronize accounts across devices.

References: [Google native OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Twitch device authorization](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow), [Twitch validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [YouTube Live API](https://developers.google.com/youtube/v3/live/docs).
