# Telegram Mini App Deployment

Tsion Baltina ships as a Telegram Mini App in addition to a normal web app. This
guide covers publishing the Mini App and validating Telegram authentication.

Background: the client loads `https://telegram.org/js/telegram-web-app.js`
(see `index.html`), detects `window.Telegram.WebApp`, adapts the theme, and can
send `initData` to the server for verification.

---

## 1. Requirements

- [ ] The site is served over **HTTPS** with a valid certificate. Telegram
      refuses `http://` Mini App URLs.
- [ ] A Telegram **bot** created via [@BotFather](https://t.me/BotFather).
- [ ] The bot's token available as `TELEGRAM_BOT_TOKEN` in the server
      environment.
- [ ] A publicly reachable production URL, e.g. `https://shop.example.com`.

---

## 2. Configure the server

Set the environment variable on the host (see
[deployment.md §3](./deployment.md#3-environment-variables) and the host-specific
guides):

```text
TELEGRAM_BOT_TOKEN=<token from BotFather>
CLIENT_URL=https://shop.example.com
```

Restart the Node process so the token is picked up.

When `TELEGRAM_BOT_TOKEN` is set, `POST /api/v1/auth/telegram` validates the
incoming `initData` using the HMAC-SHA256 scheme:

1. Parse `initData` as URL-encoded parameters.
2. Remove `hash`, sort the remaining `key=value` pairs, join with `\n`.
3. `secret = HMAC_SHA256(key="WebAppData", message=botToken)`.
4. `calculated = HMAC_SHA256(key=secret, message=dataCheckString)`.
5. Compare with the supplied `hash`; mismatch returns `401`.

If `TELEGRAM_BOT_TOKEN` is **not** set, the endpoint skips validation and
returns a demo user (development convenience). Always set the token in
production.

---

## 3. Create / configure the bot with BotFather

1. Open a chat with [@BotFather](https://t.me/BotFather).
2. `/newbot` → choose a name and a username (must end in `bot`).
3. Copy the **token** into `TELEGRAM_BOT_TOKEN` on the server.
4. Optionally set branding:
   - `/setname`, `/setdescription`, `/setabouttext`
   - `/setuserpic` (bot avatar)
   - `/setcommands`

---

## 4. Publish the Mini App

Choose a method:

### Option A — `/newapp` (standalone Mini App)

1. `/newapp`
2. Select the bot.
3. Provide a title, short description, and an icon (a square image).
4. Provide the **Web App URL**: `https://shop.example.com`.
5. Provide a short name (used in the `t.me/<bot>/<shortname>` link).

### Option B — Menu button (recommended for a store)

1. `/mybots` → select the bot.
2. **Bot Settings → Menu Button → Configure menu button**.
3. Set the button text (e.g. "Shop") and the URL
   `https://shop.example.com`.

With the menu button configured, every user of the bot gets a persistent button
that opens the store.

### Option C — Inline / direct link

Link users directly to the Mini App:

```
https://t.me/<bot_username>/<short_name>
```

---

## 5. Optional: payment / domain notes

- Telegram requires the Mini App to be reachable over HTTPS from Telegram's
  servers. Verify the domain resolves publicly (no localhost, no self-signed
  certs).
- If you later add Telegram Stars/payments, that is a separate BotFather
  configuration and additional server endpoints — not part of the current build.

---

## 6. Verify

1. Open the bot in Telegram and tap the menu button (or `/newapp` link).
2. The Mini App opens inside Telegram; the UI should adapt to the Telegram
   theme and be usable on a phone.
3. Confirm authentication:
   - In production (token set), a valid `initData` succeeds; a tampered value
     returns `401 Invalid Telegram signature`.
   - In the browser (no Telegram context), the app runs in normal web mode.
4. Place a test order from inside Telegram and confirm it appears in the admin
   dashboard.
5. Confirm `source: "TELEGRAM_MINI_APP"` is recorded on the order (the API
   accepts `source` and the schema stores it).

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Bot domain invalid" / Mini App won't open | URL is not HTTPS or not public | Serve over HTTPS with a valid cert. |
| `Invalid Telegram signature` | Wrong token, or `initData` tampered | Use the token of the bot that owns the Mini App; don't modify `initData` client-side. |
| App opens but always shows demo user | `TELEGRAM_BOT_TOKEN` not set | Set it and restart the server. |
| Blank page inside Telegram but fine in a browser | Browser cache / service worker serving stale shell | Bump `CACHE_NAME` in `public/sw.js`, redeploy, reopen. |
| Theme looks wrong | Telegram theme not detected | The app reads `Telegram.WebApp`; ensure the script in `index.html` loads (no CSP blocking `telegram.org`). |
| Live updates don't appear | SSE blocked inside the Telegram webview or by the host | The app still works via REST; see [deployment.md §8](./deployment.md#8-realtime-server-sent-events). |

---

## 8. Security notes

- **Always set `TELEGRAM_BOT_TOKEN` in production.** Without it, the auth
  endpoint accepts unverified data.
- Keep the token secret — it grants full control of the bot. Store it in the
  host's environment/secret store, never in the repository.
- Validate `auth_date` freshness if you extend the auth flow; Telegram's
  `initData` includes an `auth_date` timestamp you can reject if too old.
- See the broader checklist in
  [deployment.md §14](./deployment.md#14-security-hardening-checklist).
