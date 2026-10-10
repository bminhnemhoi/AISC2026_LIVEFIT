# TikTok Sandbox setup (human steps)

Goal: connect a TikTok account you own to a running LiveLift, see its profile, and disconnect, **without a LIVE-eligible account and without app review**.

Official references: [Create an app](https://developers.tiktok.com/doc/getting-started-create-an-app) · [Sandbox](https://developers.tiktok.com/doc/add-a-sandbox) · [Login Kit for Web](https://developers.tiktok.com/doc/login-kit-web) · [Scopes](https://developers.tiktok.com/doc/tiktok-api-scopes). Portal button labels change; where this page quotes them it follows TikTok's documentation of 2026-10-07 and flags what could not be confirmed.

## 0. What you need

- A TikTok account you can log into (it does **not** need LIVE access).
- A TikTok for Developers account (<https://developers.tiktok.com>), ideally inside an organization.
- A LiveLift instance in **production mode** reachable at a public **HTTPS** origin. TikTok requires an `https` redirect URI, and LiveLift's session cookie is `Secure`, so plain `http://localhost` will not work. Use your real host (see `docs/phase3/platform/runbook.md`) or an HTTPS tunnel to your machine.
- `openssl` (to make the encryption key).

## 1. Create the developer app

1. In the developer portal open **Manage apps** → **Connect an app**, choose your organization as owner.
2. Fill the basic information TikTok requires: app name, icon (1024×1024, JPEG/PNG, ≤5 MB), category, description, **Terms of Service URL**, **Privacy Policy URL**, and the **Web URL** platform entry (use your LiveLift origin).
3. You do not submit for review for sandbox use.

## 2. Create the Sandbox

1. On the app page toggle **Sandbox**, click **Create Sandbox**, name it (e.g. `livelift-sandbox`). Optionally clone production configuration.
2. Add products to the sandbox: **Login Kit**. If you later want more than the basic profile and the portal asks for another product (TikTok may list it as Display API), add that too.
3. **Apply changes**.
4. Open the sandbox's credentials and note the **Client key** and **Client secret**. (TikTok's sandbox page, as read, does not say whether these differ from production; use the ones shown inside the sandbox.) Treat the secret like a password.

## 3. Add yourself as a target user

1. **Sandbox settings** → **Target users** → **Add account**.
2. Log in to the TikTok account you will test with and accept the developer terms.
3. Wait: the account can take **up to an hour** to appear after refresh. Only target users should be expected to authorize a sandbox app (max 10).

## 4. Redirect URI and scopes

1. In the Login Kit configuration of the sandbox, add this redirect URI **exactly** (portal field label may differ; TikTok requires https, a static path, no query, no fragment, ≤512 characters):

   ```text
   https://<your-livelift-origin>/api/v3/integrations/tiktok/callback
   ```

   `<your-livelift-origin>` is the exact value of `LIVELIFT_APP_ORIGIN`, with no trailing slash.
2. Scopes: `user.info.basic` is the default and is enough to show display name, avatar and open ID. `user.info.profile` (username, verified) needs TikTok approval beyond sandbox; leave `LIVELIFT_TIKTOK_SCOPES` unset unless you have it.

## 5. Configure LiveLift

Generate the encryption key once and keep it: `openssl rand -base64 32`. Put these in the same protected environment file as the other LiveLift variables (never in git, never on a command line):

| Variable | Value |
|---|---|
| `LIVELIFT_TIKTOK_CLIENT_KEY` | Sandbox client key |
| `LIVELIFT_TIKTOK_CLIENT_SECRET` | Sandbox client secret |
| `LIVELIFT_TIKTOK_REDIRECT_URI` | `https://<origin>/api/v3/integrations/tiktok/callback` (**must equal** `LIVELIFT_APP_ORIGIN` + that path) |
| `LIVELIFT_PROVIDER_ENCRYPTION_KEY` | Output of `openssl rand -base64 32` |
| `LIVELIFT_TIKTOK_SCOPES` | *(optional)* default `user.info.basic` |
| `LIVELIFT_PROVIDER_DB_PATH` | *(optional)* default `provider-credentials.sqlite` beside the authority database |

`docker-compose.v3.yml` already passes these through. If any is missing or wrong, **Integrations → TikTok** says **Not configured** and lists the variable *names* at fault (never values).

## 6. Run LiveLift and connect

1. Start LiveLift as in the runbook (`ops init`, `ops user add … --role operator`, `up -d`). Restart after changing the environment.
2. Sign in as an **operator** (viewers can read but not connect).
3. Open **Integrations**. The TikTok panel should read **Ready to connect**.
4. Click **Connect TikTok**. The page shows **Connecting** and sends you to TikTok.
5. Log in with the **target user** account and approve. If you are not a target user TikTok may refuse or return an error; LiveLift then shows a notice ("cancelled or denied" or "did not accept the authorization code") and connects nothing. That is TikTok's decision, not a LiveLift fault.
6. You return to **Integrations** with a notice and the panel reads **Connected**.

## 7. Verify the profile

The panel must show: display name, avatar (or "Avatar not available"), **TikTok open ID**, granted scopes, "Provider observed via TikTok User Info, read <time>", and "Renews without you until <date>". Check:

- Press **Check connection**: *Last checked* advances, still **Connected**.
- The panel must **not** say LIVE, Shop, analytics or verification is connected; the box *What this connection does not establish* lists each as "not established".
- Sign in as a viewer: you see the same profile and cannot Connect/Disconnect.

## 8. Disconnect

1. **Disconnect → Yes, disconnect.**
2. The panel reads **Disconnected** and says whether TikTok **confirmed** the revocation. If it says it did not, remove LiveLift in TikTok → Settings and privacy → Security & permissions → Apps and services (path per TikTok's app; wording may differ).
3. LiveLift has erased its stored tokens, open ID and profile regardless of TikTok's answer.

## 9. Failure drills (optional, all safe)

| Do this | Expect |
|---|---|
| Unset `LIVELIFT_TIKTOK_CLIENT_SECRET`, restart | **Not configured**, names `LIVELIFT_TIKTOK_CLIENT_SECRET` |
| Press **Cancel** on TikTok's page | Notice "cancelled or denied. Nothing was connected" |
| Wrong client secret | Notice "TikTok rejected this deployment's app credentials" |
| Remove the app in TikTok settings, then **Check connection** | **Authorization expired**; tokens erased; Reconnect offered |
| Change `LIVELIFT_PROVIDER_ENCRYPTION_KEY`, **Check connection** | **Provider unavailable** — "stored credential unreadable"; Disconnect, then Connect again |

## 10. Beyond the sandbox: app review

To connect anyone who is not a sandbox target user you must submit the app for TikTok review: explain each product and scope in detail and upload at least one demo video (up to five, ≤50 MB each) of the complete flow. `user.info.profile` and anything beyond `user.info.basic` need pre-approval. Review is TikTok's decision and is outside LiveLift.

## 11. What cannot be tested without LIVE eligibility (and mostly even with it)

- Nothing about a LIVE: starting, reading chat, engagement, product pin/unpin, promotions, or analytics. TikTok publishes no API for these to this app type (`FEASIBILITY.md` §6). Do not expect them after connecting.
- Whether the account may go LIVE. LiveLift does not check and does not infer it.
- TikTok Shop data (catalog, orders, LIVE analytics): needs TikTok Shop Partner Center registration, seller authorization and credentials. Keep importing products with CSV/TSV.
- Content Posting to public profiles: unavailable in sandbox, and not part of LiveLift.
