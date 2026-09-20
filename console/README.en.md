# JEV private decision console

[简体中文](README.md) · Created by [JackZH26 / X @jackzhj](https://x.com/jackzhj). Follow and join the conversation.

A password-protected, read-only review interface at `/jev-console/` on the existing website. It follows ETC's charcoal, cream and orange-red palette and supports Simplified/Traditional Chinese, English, Japanese, Korean and mobile screens. Releases preserve the URL and password.

## Visible information

- Current candidate, health, weapon, ammunition, shots and kills.
- Cloud Jev choice → local safety arbitration → shared Bot execution; recent events and response latency.
- Observed room transitions and an OBS gameplay image refreshed every five seconds. Full video uses the authorized private X stream.
- Consecutive first-place counter for one version. Losses, interruptions and version changes reset it.

The console displays observable inputs, choices and execution feedback, not inferred hidden model reasoning. Observations older than ten seconds appear stale. Room numbers are bridge slots, not HUD labels. Local control can continue through cloud timeouts; a blank cloud choice is not a successful cloud response.

## Privacy and deployment

`server.py` uses Python's standard library and listens only on `127.0.0.1:8094`, behind the existing HTTPS Nginx server. Data requires login; anonymous visitors receive only the login form. Passwords use salted PBKDF2-SHA256 with 240,000 iterations. Signed twelve-hour cookies are Secure, HttpOnly and SameSite=Strict. Login rate limits, same-origin checks, no-store and noindex headers apply.

The ingestion token is separate from the viewing password. `telemetry.cjs` uploads an explicit gameplay field projection; the server also rejects credential fields. Only the latest observation is held in server memory. Viewer IPs, passwords and bodies are not logged. Raw session files, API keys, accounts, game commands and chat are not uploaded.

1. After building Studio, run `electron console/provision.cjs`. It provisions credentials in a separate Windows user-local DPAPI vault.
2. Send `{version, files, config}` to `deploy.py` over SSH stdin. Files must contain only server.py, index.html and login.html. Never put configuration in Git, logs or command-line arguments.
3. Deployment creates a dedicated systemd service and read-only release directory, with private configuration outside the repo and mode 0640. It adds only the HTTPS `/jev-console/` proxy. Nginx reloads after successful configuration validation; failed service deployment restores the previous release link.
4. Run `electron console/publisher.cjs` locally for telemetry every two seconds and gameplay previews every five seconds.
5. With authorization to use a private X stream, add `--bind-x-preview`. Only while the existing X OBS output is active and the current candidate is foreground with fresh observations, it rebinds ETC Game / ETC Audio to `JEV Hybrid Acceptance`. It never creates broadcasts, changes privacy or modifies stream keys.

`provision.cjs --show-password` retrieves the local viewing password. `--export-server` contains private configuration and is only for trusted deployment pipes; never print or commit it. Public source contains no deployed password. Default provisioning never overwrites existing credentials; rotation requires a deliberate maintenance operation.

## Verification

`python -m unittest discover -s console -p test_server.py` covers access protection, origin checks, cookies, tampering, throttling and credential rejection. `npm test -- tests/console-telemetry.test.ts` covers telemetry redaction. Deployment acceptance also requires real HTTPS login, anonymous data 401, mobile layout, all five languages and actual gameplay images. This preview is not evidence of 24-hour stability or autoplay victories.
