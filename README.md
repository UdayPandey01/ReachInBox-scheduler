# ReachInbox Scheduler

A full-stack email job scheduler and dashboard, built for the ReachInbox.ai / Outbox Labs Software Development Intern assignment.

You sign in with Google, upload a list of leads, write an email, and pick a start time. The backend stores every email in PostgreSQL, schedules each one as a BullMQ delayed job in Redis, and sends them through Ethereal SMTP. Sends respect a per-campaign delay and a Redis-backed hourly limit. When the limit is hit, the email moves to the next hour and a Slack alert is posted. Sent and scheduled emails can be searched with Elasticsearch.

No cron is used anywhere. Scheduling is done only with BullMQ delayed jobs.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Using the app](#using-the-app)
- [How scheduling works](#how-scheduling-works)
- [Delay between emails](#delay-between-emails)
- [Hourly rate limiting](#hourly-rate-limiting)
- [Worker concurrency](#worker-concurrency)
- [Restarts and persistence](#restarts-and-persistence)
- [Idempotency](#idempotency)
- [Retries and failures](#retries-and-failures)
- [Behaviour under load (1000+ emails)](#behaviour-under-load-1000-emails)
- [Slack notifications](#slack-notifications)
- [Search](#search)
- [Authentication and security](#authentication-and-security)
- [API reference](#api-reference)
- [Frontend](#frontend)
- [Project structure](#project-structure)
- [Testing and verification](#testing-and-verification)
- [Known limitations](#known-limitations)

---

## Features

**Backend**

- Schedule emails through an API and store them in PostgreSQL
- BullMQ delayed jobs in Redis, with no cron
- Sending through Ethereal SMTP, with a preview link for every sent email
- Multiple senders per user
- File attachments (up to 10 files, 10 MB total per campaign), sent with every email
- Configurable worker concurrency
- Configurable delay between emails
- Redis-backed hourly rate limit that reschedules to the next hour instead of dropping
- Slack alert when the hourly limit is reached (real Slack OAuth; connect, disconnect, reconnect)
- Survives restarts without duplicating or losing emails
- Idempotent sending with deterministic job IDs
- Retries with exponential backoff
- Elasticsearch indexing and search with status filter and pagination
- Live queue dashboard with Bull Board

**Frontend**

- Real Google OAuth login
- Dashboard following the supplied Figma: sidebar with profile, Compose, Scheduled and Sent
- Compose page with CSV/text lead upload and a count of detected emails
- File attachments with image previews, shown and downloadable in the email view
- Send Later picker with presets
- Scheduled and Sent lists with loading, empty and error states
- Search, status filter, pagination and an email detail view
- Slack connection card

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Backend | Node.js, TypeScript, Express 5, Zod |
| Database | PostgreSQL with Drizzle ORM |
| Queue | BullMQ on Redis (AOF persistence) |
| Email | Nodemailer with Ethereal SMTP |
| Search | Elasticsearch 9.4 |
| Auth | Google OAuth (`google-auth-library`), JWT session cookie |
| Notifications | Slack OAuth v2, `@slack/web-api` |
| Queue UI | Bull Board |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Infra | Docker Compose for Redis and Elasticsearch |

---

## Architecture

```text
                    Browser (React, :5173)
                            │  /api (proxied by Vite)
                            ▼
                 Express API + BullMQ worker (:4000)
     ┌──────────┬──────────┼───────────┬──────────┬──────────┐
     ▼          ▼          ▼           ▼          ▼          ▼
 PostgreSQL   Redis   Elasticsearch  Ethereal   Slack    Google OAuth
 (state)    (jobs +     (search)      (SMTP)   (alerts)   (login)
           counters)
```

- **PostgreSQL** is the source of truth for users, senders, campaigns, emails, events and Slack connections.
- **Redis** holds the BullMQ jobs and the hourly rate-limit counters.
- **Elasticsearch** is a search copy of the email data. It can always be rebuilt from PostgreSQL.
- The API and the worker run in the same Node process. They only share Redis and PostgreSQL, so the worker can be moved into its own process without code changes.

---

## Getting started

### Prerequisites

- Node.js 20 or newer
- Docker (for Redis and Elasticsearch)
- A PostgreSQL database (local, or hosted such as Neon)
- A Google OAuth client (type "Web application")
- A Slack app with the `chat:write` bot scope

### 1. Start Redis and Elasticsearch

```bash
docker compose up -d
```

This starts Redis on `6379`, with append-only persistence so jobs survive a Redis restart, and Elasticsearch on `9200`.

### 2. Configure OAuth apps

**Google Cloud Console → Credentials → OAuth client**

- Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
- If the consent screen is in testing mode, add your Google account as a test user.

**Slack API → Your app**

- OAuth & Permissions → Redirect URL: `http://localhost:4000/api/slack/oauth/callback`
- Bot token scope: `chat:write`

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in the values (see below)
npm run db:migrate
npm run dev               # http://localhost:4000
```

On startup the server recreates any BullMQ jobs that are missing from Redis. If the Elasticsearch index doesn't exist yet, it creates it and fills it from PostgreSQL.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Open http://localhost:5173 and click **Login with Google**.

The Vite dev server proxies `/api` to `http://localhost:4000`. The browser therefore talks to a single origin, and no CORS setup is needed.

### Useful URLs

| URL | What |
| --- | --- |
| http://localhost:5173 | Dashboard |
| http://localhost:4000/health | Health check |
| http://localhost:4000/admin/queues | Bull Board (live queue view) |

### Scripts

| Folder | Command | Purpose |
| --- | --- | --- |
| backend | `npm run dev` | API and worker with auto-reload |
| backend | `npm run typecheck` | Type-check only |
| backend | `npm run build` / `npm start` | Compile to `dist/` / run the compiled server |
| backend | `npm run db:generate` / `npm run db:migrate` | Create / apply Drizzle migrations |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run typecheck` | Type-check only |
| frontend | `npm run build` | Type-check and production build |

---

## Environment variables

`backend/.env`:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `production` makes cookies `Secure` |
| `PORT` | no | `4000` | API port |
| `FRONTEND_URL` | no | `http://localhost:5173` | Where OAuth callbacks redirect |
| `DATABASE_URL` | yes | | PostgreSQL connection string |
| `REDIS_URL` | yes | | e.g. `redis://localhost:6379` |
| `ELASTICSEARCH_URL` | no | `http://localhost:9200` | Elasticsearch node |
| `WORKER_CONCURRENCY` | no | `1` | Jobs processed in parallel by the worker |
| `GOOGLE_CLIENT_ID` | yes | | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | yes | | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | yes | | `http://localhost:4000/api/auth/google/callback` |
| `SLACK_CLIENT_ID` | yes | | Slack app client ID |
| `SLACK_CLIENT_SECRET` | yes | | Slack app client secret |
| `SLACK_REDIRECT_URI` | yes | | `http://localhost:4000/api/slack/oauth/callback` |
| `JWT_SECRET` | yes | | At least 32 characters; signs the session cookie |

`frontend/.env` (optional):

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | empty | API base URL; leave empty to use the Vite proxy |

---

## Using the app

1. **Log in** with Google. Your profile (name, email, avatar) appears in the sidebar, and the chevron on the profile card opens **Logout**. On first login, a default sender with your Google email is created.
2. **Compose**: click **Compose** in the sidebar.
   - **From**: pick a sender, or add another with "+ Add another sender".
   - **To**: type or paste emails, or click **Upload List** to import a `.csv` or `.txt` file. The page shows how many emails were detected and which invalid entries were skipped.
   - **Subject**, **Delay between 2 emails** (seconds), **Hourly Limit**, and the body.
   - **Attachments**: click the paperclip in the header to attach any files (up to 10, 10 MB in total). Images show a preview, and every file can be removed before scheduling.
   - **Send Later**: pick a date and time or a preset, then click **Done** to schedule.
3. **Scheduled** lists upcoming emails with their scheduled time. **Sent** lists sent and failed emails with the time sent.
4. **Search** by recipient, subject or body. The filter icon narrows by status, and the arrows page through results.
5. **Open an email** to see the full message and its attachments (click a card to open or download it). Sent emails have an **Open in Ethereal** link.
6. **Slack alerts**: click **Connect Slack**, authorize, then enter a channel name and click **Save**. The Slack app must be invited to that channel (`/invite @YourApp`).

### Sample leads file

`sample-leads.csv` in the repo root is a deliberately messy lead list. It contains quoted cells, two emails in one cell, `<angle brackets>`, `mailto:` links, plus-addressing, a trailing dot, uppercase addresses, duplicates and invalid rows. Uploading it shows **16 emails detected · 2 invalid skipped**.

The lead parser:

```text
file → text → find anything that looks like an email → lowercase
     → strip trailing dots → remove duplicates → validate → count
```

The server normalizes and de-duplicates recipients again before saving.

### Where do the emails go?

Ethereal is a **fake SMTP service**. It accepts every message but never delivers anything to a real inbox (Gmail, Outlook and so on). Every sent email gets an Ethereal preview URL. It is shown on the email's detail page as **Open in Ethereal** and printed in the backend log.

---

## How scheduling works

```text
POST /api/emails/schedule
  │
  ├─ validate input (Zod); check the sender belongs to the user
  │
  ├─ one PostgreSQL transaction:
  │     campaign row
  │     one email row per recipient
  │        id generated in the app
  │        bullJobId   = "email-<id>"
  │        scheduledAt = startTime + index × delay
  │     one "scheduled" event per email
  │     attachments, stored once for the campaign
  │
  ├─ emailQueue.addBulk(...)       one delayed job per email
  │     delay = scheduledAt − now
  │
  └─ Elasticsearch bulk index      (failure is logged, never blocks scheduling)
```

When a job's delay expires, the worker runs:

```text
load email ─── already sent? ──► stop (idempotent)
    │
load campaign, mark it "running"
    │
Redis hourly counter for the campaign
    │
    ├─ over the limit ──► record "rescheduled" event
    │                     Slack alert (if connected)
    │                     move email + job to the start of the next hour
    │                     DelayedError (job waits, not failed)
    │
    └─ allowed ────────► attempts + 1, status "processing"
                         send via Ethereal (with the campaign's attachments)
                         status "sent", sentAt, messageId, preview URL
                         update Elasticsearch
                         campaign sent counter + 1 (campaign "completed" when all done)
```

Email status goes `scheduled → processing → sent`, or `→ failed` after the last retry. Every transition is recorded in `email_events`.

---

## Delay between emails

**Chosen approach:** the delay is set per campaign in the Compose form ("Delay between 2 emails", in seconds). It is applied when the jobs are created:

```text
email #0 → startTime
email #1 → startTime + 1 × delay
email #2 → startTime + 2 × delay
...
```

For example, with a delay of 2 seconds, the emails of a campaign are scheduled at least 2 seconds apart. Because the spacing is baked into each job's delay, it survives restarts, and no in-memory timers or sleeps are needed in the worker.

---

## Hourly rate limiting

**Chosen approach:** a Redis counter per campaign per clock hour. The limit is set per campaign in the Compose form ("Hourly Limit").

```text
key   = email-rate:<campaignId>:<hourNumber>        hourNumber = floor(now / 1 hour)
count = INCR key                                     (EXPIRE 3700 s on the first increment)

count ≤ limit → send
count > limit → DECR key (give the slot back)
                "rescheduled" event
                Slack alert
                email.scheduledAt = start of next hour   (PostgreSQL + Elasticsearch)
                job.moveToDelayed(start of next hour)
                throw DelayedError
```

Why this design:

- **Safe across workers and instances.** `INCR` is atomic in Redis, so any number of worker processes share the same counter. Nothing is counted in memory.
- **Never drops or fails an email.** Over-limit jobs are delayed, not failed. `DelayedError` tells BullMQ the job was moved on purpose, so no retry attempt is used up.
- **Order is mostly preserved.** Every over-limit job moves to the same next-hour timestamp, and BullMQ processes delayed jobs in timestamp order.
- **Restart-safe.** The new time is written to PostgreSQL too, so recovery recreates the job at the rescheduled time rather than the original one.

Trade-offs:

- The limit is **per campaign**, not per sender or global.
- Windows are fixed clock hours, not a sliding 60 minutes.
- The limit comes from the form, not from an environment variable.

---

## Worker concurrency

The worker is created with `concurrency: WORKER_CONCURRENCY` (default `1`). Running jobs in parallel is safe because:

- the rate limit is a Redis counter, not process memory
- each email has exactly one job (`email-<id>`), so two workers never handle the same email at once
- the worker checks `status === "sent"` before sending

To scale further, run more processes with the same `REDIS_URL` and `DATABASE_URL`.

---

## Restarts and persistence

| What | Where it lives | After a restart |
| --- | --- | --- |
| Emails, status, events | PostgreSQL | Unchanged |
| Delayed / waiting jobs | Redis (AOF on disk) | Still there, fire at the original time |
| Rate-limit counters | Redis | Still there until the hour ends |
| Search index | Elasticsearch | Rebuilt from PostgreSQL if missing |

On startup, `recoverScheduledEmails()` loads every email whose status is `scheduled` or `processing`:

```text
job "email-<id>" exists in Redis? ── yes ──► leave it alone
            │
            no ──► re-add it with delay = scheduledAt − now
```

So:

- **Future emails still send at the right time.** Their jobs either survived in Redis or were recreated from `scheduledAt`.
- **Nothing restarts from scratch.** Sent emails are never picked up again, because recovery only looks at `scheduled` and `processing`.
- **A crash between the database commit and queueing is covered.** Those emails have no job yet, so recovery creates them.

---

## Idempotency

Two layers stop an email from being sent twice:

1. **Deterministic job ID** `email-<emailId>`. BullMQ ignores an `add` whose ID already exists, so scheduling, recovery and restarts can never create two jobs for one email.
2. **Status check in the worker.** The worker reloads the email and returns immediately if `status === "sent"`. A duplicate job, even one added by hand with a different ID, completes without sending.

---

## Retries and failures

- Each job has **3 attempts** with **exponential backoff** starting at 5 seconds.
- Every failed attempt writes a `failed` event with the error message.
- After the last attempt, the email is marked `failed` and its error is stored. Elasticsearch is updated, and the campaign's failed counter goes up.
- A campaign becomes `completed` when `sent + failed = total`.
- Rate-limit delays are **not** failures and do not use up attempts.

---

## Behaviour under load (1000+ emails)

Suppose 1000 emails are scheduled for the same time, with an hourly limit of 200:

```text
1 request
 → 1 INSERT for 1000 emails, 1 INSERT for 1000 events      (one transaction)
 → 1 addBulk call → 1000 delayed jobs in Redis             (no Node timers)
 → 1 Elasticsearch bulk request
```

When the start time arrives:

```text
hour 1: first 200 jobs send (WORKER_CONCURRENCY at a time)
        jobs 201–1000 hit the limit → moved to hour 2, one Slack alert per rescheduled job
hour 2: next 200 send, the rest move to hour 3
...
hour 5: last 200 send → campaign "completed"
```

- Nothing is dropped, and nothing is permanently failed because of the limit.
- A campaign can have at most 5000 recipients per request. The request body is limited to 15 MB, to allow for base64-encoded attachments.
- Attachments are stored once per campaign, not once per email, so 1000 recipients don't mean 1000 copies.
- Throughput is bounded by `WORKER_CONCURRENCY`, SMTP latency and the hourly limit, not by the number of scheduled jobs.

---

## Slack notifications

1. **Connect Slack** in the sidebar starts the real Slack OAuth flow. A random `state` value is stored in an httpOnly cookie and checked on the callback.
2. The callback stores the bot token for the logged-in user in `slack_connections`.
3. The user enters a channel name. The backend posts a confirmation message there and saves the channel.
4. When a campaign hits its hourly limit, the worker looks up the campaign owner's active connection and posts:

   ```text
   Email rate limit reached
   Campaign: <id>
   Hourly limit: 50
   Emails sent this hour: 50
   Next attempt: <time>
   ```

Disconnect and reconnect:

- **Not connected, or no channel set:** the alert is skipped and the email is still rescheduled. Nothing crashes.
- **Slack errors** are caught and logged. They never fail or drop an email.
- **Disconnect** marks the connection inactive, and alerts stop right away.
- **Reconnect** re-activates the same connection and keeps the channel. Alerts resume on the next limit hit, with no redeploy.

---

## Search

Every email is indexed in Elasticsearch when it is scheduled. The index is updated when the email is rescheduled, sent or failed.

```text
GET /api/search/emails?q=follow up&status=sent,failed&page=1&limit=20
```

- `q` searches recipient, subject and body, with prefix matching on the last word as you type.
- `status` takes one status or a comma-separated list.
- Results are always filtered to the logged-in user.
- Elasticsearch failures are logged and never block scheduling or sending.
- If the index is deleted, the next server start rebuilds it from PostgreSQL.

In the dashboard, an empty search box loads the list straight from PostgreSQL. Typing switches to Elasticsearch.

---

## Authentication and security

**Login flow**

```text
Login with Google
 → GET /api/auth/google            random state stored in an httpOnly cookie (10 min)
 → Google consent
 → GET /api/auth/google/callback   state checked, code exchanged, ID token verified
                                   unverified Google emails are rejected
                                   user found or created by email
                                   default sender created on first login
 → session cookie (JWT, 7 days)    httpOnly, SameSite=Lax, Secure in production
 → redirect to the dashboard
```

**Protection**

- Every `/api` route except the two Google login routes requires the session cookie. Missing or invalid sessions get `401`.
- The user ID always comes from the session, never from the request body.
- All queries are scoped to the logged-in user: emails through `campaigns.user_id`, search through `userId`, plus senders and Slack connections.
- A `senderId` must belong to the user before anything is scheduled.
- Slack tokens are never returned by the API.
- Errors are returned as `{ "message": "..." }` without stack traces.

---

## API reference

All responses are JSON. Errors use `{ "message": "..." }` with status `400` (validation), `401` (not logged in), `404` (not found or not yours) or `500`.

### Auth

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/auth/google` | Start Google login |
| GET | `/api/auth/google/callback` | Google redirect target; sets the session cookie |
| GET | `/api/auth/me` | `{ user: { id, name, email, avatarUrl } }` |
| POST | `/api/auth/logout` | Clears the session (`204`) |

### Senders

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/senders` | `{ senders: [{ id, email, displayName }] }` |
| POST | `/api/senders` | Body `{ email, displayName }` → `201 { sender }` |

### Emails

**`POST /api/emails/schedule`**

```json
{
  "senderId": "8c1d…",
  "subject": "Quick follow-up",
  "body": "Hi, just following up on our meeting.",
  "recipients": ["a@example.com", "b@example.com"],
  "scheduledAt": "2026-09-28T04:30:00.000Z",
  "delayMs": 2000,
  "hourlyLimit": 100,
  "attachments": [
    { "filename": "brochure.pdf", "contentType": "application/pdf", "contentBase64": "JVBERi0xLjcK…" }
  ]
}
```

`attachments` is optional: at most 10 files and 10 MB in total, sent as base64.

Response `201`:

```json
{
  "campaignId": "4f0a…",
  "totalEmails": 2,
  "emails": [
    {
      "id": "0ecd…",
      "recipient": "a@example.com",
      "status": "scheduled",
      "scheduledAt": "2026-09-28T04:30:00.000Z",
      "bullJobId": "email-0ecd…"
    }
  ]
}
```

**`GET /api/emails/scheduled`**: statuses `scheduled` and `processing`, oldest first.
**`GET /api/emails/sent`**: statuses `sent` and `failed`, newest first.

Query parameters: `page` (default 1), `limit` (default 20, max 100), and `status` (optional, one of the tab's statuses).

```json
{
  "items": [
    {
      "id": "0ecd…",
      "recipient": "a@example.com",
      "subject": "Quick follow-up",
      "bodyPreview": "Hi, just following up…",
      "status": "sent",
      "scheduledAt": "2026-09-28T04:30:00.000Z",
      "sentAt": "2026-09-28T04:30:03.120Z",
      "error": null
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

**`GET /api/emails/:id`** returns the full email, including `body`, `senderName`, `senderEmail`, `previewUrl` (the Ethereal link) and `attachments` (`[{ id, filename, contentType, size }]`).

**`GET /api/emails/:id/attachments/:attachmentId`** returns the file. PNG, JPEG, GIF, WebP and PDF files open in the browser. Every other type is served as a download (`application/octet-stream`, `Content-Disposition: attachment`), so an uploaded HTML or SVG file can never run on the app's domain.

### Search

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/search/emails?q=&status=&page=&limit=` | Same `items` / `total` / `page` shape as the lists |

### Slack

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/slack/oauth` | Start Slack OAuth |
| GET | `/api/slack/oauth/callback` | Slack redirect target; stores the connection |
| GET | `/api/slack/status` | `{ connected, connection: { teamName, channelId, channelName, … } }` |
| PUT | `/api/slack/channel` | Body `{ channel: "#alerts" }`; posts a test message and saves the channel |
| POST | `/api/slack/disconnect` | Disconnect (`204`) |

### Other

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | `{ status: "ok" }` |
| GET | `/admin/queues` | Bull Board |

---

## Frontend

| Screen | Content |
| --- | --- |
| Login | ONB logo, "Login" card, **Login with Google**, loading and error states |
| Dashboard | Sidebar (logo, profile card with Logout, Compose, Scheduled / Sent with counts, Slack card); search bar, status filter, refresh, pagination; email rows (`To:` · status chip · subject · preview · time) |
| Email view | Subject, sender, recipient, time, status, body, attachment cards, Ethereal link |
| Compose | From, To (chips and Upload List), Subject, Delay, Hourly Limit, Body, paperclip attachments with preview cards; **Send Later** popover with date/time and presets |

Code organisation:

- `lib/api.ts` holds the only `fetch` calls in the app. It defines the typed responses and turns `400` / `401` / `404` / `500` / network errors into readable messages. A `401` on a protected call sends the user back to login.
- `components/` holds the reusable UI: Button, Input, Modal, StatusBadge, Avatar, Logo, Pagination, Loading/Empty/Error states, Toast and icons.
- `features/` holds the screens: auth, dashboard, compose and slack.
- State is plain React state. There is no router or global store.

---

## Project structure

```text
reachinbox-scheduler/
├── docker-compose.yml              Redis + Elasticsearch
├── sample-leads.csv                example lead list for Upload List
├── backend/
│   ├── drizzle.config.ts
│   └── src/
│       ├── server.ts               startup: recovery, search index, listen
│       ├── app.ts                  Express app, routes, error handler
│       ├── config/                 env, db, redis, elasticsearch
│       ├── db/                     Drizzle schema + migrations
│       ├── middleware/             requireAuth, errorHandler
│       ├── modules/
│       │   ├── auth/               Google login, /me, logout
│       │   ├── emails/             schedule, lists, detail
│       │   ├── senders/            list / create senders
│       │   ├── search/             Elasticsearch index + search
│       │   └── slack/              OAuth, channel, alerts
│       ├── queue/                  queue, rate limiter, recovery, Bull Board
│       ├── smtp/                   Ethereal transporter
│       └── workers/                email worker
└── frontend/
    └── src/
        ├── App.tsx                 session check → Login or Dashboard
        ├── lib/                    api client, lead parser
        ├── components/             shared UI
        └── features/               auth, dashboard, compose, slack
```

### Database tables

| Table | Purpose |
| --- | --- |
| `users` | Google identity: googleId, name, email, avatar |
| `senders` | Sender addresses per user |
| `campaigns` | Subject, body, start time, delay, hourly limit, status, counters |
| `campaign_attachments` | Files attached to a campaign: filename, content type, size, bytes |
| `emails` | One row per recipient: status, scheduledAt, sentAt, bullJobId, attempts, error |
| `email_events` | History: scheduled, processing, sent, failed, rescheduled |
| `slack_connections` | Workspace, channel and token per user |

---

## Testing and verification

Build checks:

```bash
cd backend  && npm run typecheck && npm run build
cd frontend && npm run typecheck && npm run build
```

Scenarios verified against the running app:

| Scenario | Result |
| --- | --- |
| Protected routes without a session, or with a bad one | `401` |
| Google login redirect and callback with a wrong `state` | Redirects to login with an error |
| Schedule with duplicate and mixed-case recipients | De-duplicated; response contains real `bullJobId`s |
| Hourly limit 1, 3 recipients | 1 sent, 2 moved to the next hour, Slack alert posted |
| Same with Slack disconnected | Still sent and rescheduled, no errors |
| Extra job for an already-sent email | Completes without sending again |
| Restart with jobs in Redis | Nothing recreated |
| Restart after deleting a job | Job recreated at the rescheduled time |
| `sample-leads.csv` uploaded through the UI | 16 detected, 16 scheduled, 16 sent, each with an Ethereal link |
| Attach a PNG, a TXT and an HTML file, send to 2 recipients | All 3 files in the Ethereal message; image previewed; HTML served as a download; other users get 404 |
| Attachments over 10 MB, more than 10 files, or invalid base64 | `400` with a clear message |
| Browser run | Login, dashboard, pagination, filter, search, detail, compose, Send Later, logout, mobile layout |

---

## Known limitations

- **Ethereal only.** All senders deliver through one Ethereal test account created at startup. The SMTP fields stored per sender are placeholders.
- **Per-campaign limits.** The hourly limit and delay are set per campaign in the UI. They are not global or per-sender environment variables.
- **Fixed hour windows** instead of a sliding 60-minute window.
- **Recovery runs at startup only.** Missing jobs are not re-checked while the server runs.
- **Bull Board has no login.** It should be protected before deployment.
- **Attachments are stored in PostgreSQL** (`bytea`). This is fine for the 10 MB limit; object storage (S3 or similar) would suit larger files.
- **Stateless sessions.** Logout clears the cookie, but a copied token stays valid until it expires (7 days).
- **Figma differences.** The email/password login form is left out because only Google login is implemented. The rich-text toolbar is left out because bodies are plain text. Star, archive and delete icons are left out because they have no backend.
