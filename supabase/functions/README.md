# Telegram Bot Edge Functions

Two Supabase Edge Functions that power the Telegram bot companion for AccountantOS.

---

## Functions

### `telegram-morning-brief`
Sends your daily morning summary at 8 AM EAT (5 AM UTC).

### `telegram-webhook`
Handles incoming messages from Telegram. Parses commands and reads/writes `app_state`.

---

## One-Time Setup

### 1. Create a Telegram Bot
1. Open Telegram, message **@BotFather** → `/newbot`
2. Follow prompts, copy the **bot token**
3. Message your new bot once (this opens the chat)
4. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your **Chat ID** (look for `"id"` inside `"from"`)

### 2. Set Supabase Secrets
In **Supabase Dashboard → Edge Functions → Secrets**, add:

| Secret | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Your bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Your chat ID (numeric) |
| `APP_USER_ID` | Your Supabase auth user ID (find in Auth → Users) |
| `TELEGRAM_WEBHOOK_SECRET` | A long random string (e.g. run `openssl rand -hex 32`). Telegram sends it back on every webhook call; the function rejects requests without it, so nobody can forge bot commands by POSTing to the function URL directly. |

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 3. Deploy the Functions
```bash
supabase functions deploy telegram-morning-brief
supabase functions deploy telegram-webhook
```

### 4. Register the Webhook with Telegram
Replace `<TOKEN>`, `<PROJECT_REF>` and `<WEBHOOK_SECRET>` (the same value you saved as the `TELEGRAM_WEBHOOK_SECRET` secret in step 2), then visit this URL in your browser once:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook&secret_token=<WEBHOOK_SECRET>
```

You should get: `{"ok":true,"result":true,"description":"Webhook was set"}`

> **Why the secret matters:** the webhook is deployed with `--no-verify-jwt`, so its URL is publicly reachable. The `secret_token` makes Telegram send an `X-Telegram-Bot-Api-Secret-Token` header on every delivery; the function rejects any request without it. The function additionally ignores messages from any chat other than `TELEGRAM_CHAT_ID`.
>
> **Already deployed without the secret?** Set the `TELEGRAM_WEBHOOK_SECRET` secret, redeploy the function, then re-run the `setWebhook` URL above. The function only enforces the header once the secret is configured, so nothing breaks in between.

### 5. Schedule the Morning Brief (Cron)
Run this SQL in **Supabase SQL Editor**:

```sql
-- Enable pg_cron if not already enabled (do this in Dashboard → Database → Extensions)
-- Then:

select cron.schedule(
  'telegram-morning-brief',          -- job name
  '0 5 * * *',                       -- 5 AM UTC = 8 AM EAT
  $$
    select net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/telegram-morning-brief',
      headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
```

> Replace `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` (found in Supabase Dashboard → Settings → API).

---

## Bot Commands

| Command | Description |
|---|---|
| `tasks` | List pending tasks |
| `today` | Tax returns due today |
| `week` | Returns due in next 7 days |
| `overdue` | Overdue pending returns |
| `done [client] [tax]` | Mark a return as completed (e.g. `done Acme VAT`) |
| `help` | Show all commands |
