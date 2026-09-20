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

## Twitch

1. Register a **Public** application in the [Twitch developer console](https://dev.twitch.tv/console/apps).
2. Enter its Client ID; no Client Secret is required.
3. Click official sign-in. The app opens the activation URL returned by Twitch, normally with the verification code included. Authorize on the official website; connection completes automatically.

Requested scopes are `channel:read:stream_key` and `channel:manage:broadcast`. Chat permissions are not requested before chat is implemented. Refreshes are serialized and rotated refresh tokens are saved immediately. Authorization is validated at startup and every 55 minutes.

If the console requires a Redirect URI, register `http://localhost`. This app's **Device Code Flow does not use a redirect callback**. Do not switch the application to Confidential while retaining these settings.

## Distribution to ordinary streamers

After registration and applicable review, maintainers can supply their application's Client IDs in a build so streamers do not need their own developer projects. The source build retains configuration fields and hardcodes no real accounts or credentials. This phase does not host account passwords or synchronize accounts across devices.

References: [Google native OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Twitch device authorization](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow), [Twitch validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [YouTube Live API](https://developers.google.com/youtube/v3/live/docs).
