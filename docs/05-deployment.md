# 05 — Deployment

Free-tier production setup:

```
Browser ──► Vercel (Next.js, client/) ──/api/v1/* rewrite──► Render (Express API, server/) ──► Neon (PostgreSQL)
                    │                                              ├──► Cloudinary (uploaded files, private)
                    └── Auth.js session cookie (on the Vercel domain)  └──► Brevo (SMTP: verification & reset emails)
```

The browser only ever talks to the Vercel domain. Vercel proxies `/api/v1/*` to Render and forwards the
session cookie, so there's no CORS or cross-site cookie setup.

## Free-tier limits worth knowing

| Service | Limit | Effect |
|---|---|---|
| Render web (free) | Sleeps after 15 min idle; ~1 min to wake. 750 instance-hours / month per workspace; when used up, all free services are suspended until next month. Disk is wiped on restart. | First request after a quiet period is slow. Files must live in Cloudinary. |
| Neon (free) | 0.5 GB storage. Doesn't expire. | Plenty for this app. (Render's free PostgreSQL expires after 30 days, hence Neon.) |
| Vercel (Hobby) | Request bodies through the proxy are capped at ~4.5 MB. | Uploads are limited to **4 MB**. |
| Brevo (free) | 300 emails / day. | Sending from a Gmail address works but may land in spam; a custom domain fixes that later. |
| Render web (free) | **Outbound SMTP ports 25, 465 and 587 are blocked.** | Email is sent through Brevo's **HTTP API** (`BREVO_API_KEY`), not SMTP. |

## 0. Generate production secrets (don't reuse the local ones)

```bash
openssl rand -base64 33   # → AUTH_SECRET
openssl rand -base64 33   # → INTERNAL_API_SECRET
```

Both values must be **identical** on Render and Vercel. Keep them in a password manager.

Also decide the Vercel project name now (e.g. `jobtrack-promizygj`): your site will be
`https://<project-name>.vercel.app`, and Render needs that URL as `CLIENT_URL`.

## 1. Neon: the database

1. Sign up at neon.tech → **New project**. Region: **AWS Europe Central 1 (Frankfurt)** (matches `render.yaml`), PostgreSQL 16+.
2. **Connect** → choose the **direct** connection (turn *Connection pooling* off) → copy the string. It looks like
   `postgresql://<user>:<password>@ep-…​.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
   (Migrations need the direct connection; the pooled `-pooler` host doesn't support them.)

The tables are created automatically on Render's first start (`prisma migrate deploy`).

## 2. Cloudinary: file storage

1. Sign up at cloudinary.com → **Settings → API Keys** → copy the **API environment variable**
   (`cloudinary://<api_key>:<api_secret>@<cloud_name>`).
2. Check it from your machine before deploying (uploads, downloads and deletes a tiny test file):
   ```bash
   cd server
   STORAGE_DRIVER=cloudinary CLOUDINARY_URL='cloudinary://…' npm run storage:check
   ```

Files are stored as **private raw** assets under the `jat/` folder. They're never publicly reachable; the
API streams them to signed-in users through 5-minute signed links.

## 3. Brevo: email

1. Sign up at brevo.com → **Senders, domains & dedicated IPs → Senders** → add and verify `promizygj@gmail.com`.
2. **SMTP & API → API Keys** → **Generate a new API key** (name it `jobtrack`). Copy it: it starts with `xkeysib-`.
   (Not the SMTP key: Render's free plan blocks SMTP ports, so the API sends email over HTTPS instead.)

## 4. Render: the API

1. render.com → **New → Blueprint** → connect GitHub → pick `promizygj/job-application-tracker`. Render reads `render.yaml`.
2. Fill in the values it asks for:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon direct connection string |
| `CLIENT_URL` | `https://<project-name>.vercel.app` |
| `AUTH_SECRET`, `INTERNAL_API_SECRET` | from step 0 |
| `CLOUDINARY_URL` | from step 2 |
| `BREVO_API_KEY` | Brevo API key (`xkeysib-…`) |
| `MAIL_FROM` | `JobTrack <promizygj@gmail.com>` |

3. **Apply**. When the deploy finishes, open `https://<service>.onrender.com/api/v1/health` → `{"status":"ok","db":"ok"}`.

Set in `render.yaml` (no action needed): `NODE_ENV=production`, `TRUST_PROXY=2`, `STORAGE_DRIVER=cloudinary`.

## 5. Vercel: the frontend

1. vercel.com → **Add New → Project** → import `promizygj/job-application-tracker`.
2. **Project name**: the one from step 0. **Root Directory**: `client`. Framework: Next.js (auto-detected).
3. **Environment Variables** (all environments):

| Variable | Value |
|---|---|
| `API_URL` | `https://<service>.onrender.com` (no trailing slash) |
| `AUTH_SECRET` | same as Render |
| `INTERNAL_API_SECRET` | same as Render |

4. **Deploy**. `API_URL` is read at build time for the `/api/v1` rewrite, so after changing it, **redeploy**.

## 6. Check it works

1. Open `https://<project-name>.vercel.app/api/v1/health` → `{"status":"ok","db":"ok"}` (this goes through the proxy).
2. Register → the verification email arrives (check spam) → click it → the banner disappears.
3. Add an application, drag it on the board, upload a PDF, preview and download it.

## Updating

Push to `main`: Vercel and Render both redeploy automatically. New Prisma migrations are applied on Render's next start.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Login fails right after a quiet period | Render was asleep; try again after ~1 minute. |
| Every API call is 401 after logging in | `AUTH_SECRET` differs between Vercel and Render. |
| Login says "Invalid email or password" for a correct password | `INTERNAL_API_SECRET` differs, or `API_URL` is wrong on Vercel. |
| `/api/v1/*` returns Vercel 404s | `API_URL` was missing at build time: set it and redeploy. |
| Render deploy fails with "Invalid environment variables" | The log lists which variable; e.g. `CLOUDINARY_URL` must start with `cloudinary://`. |
| No emails | Check Render logs for "Failed to send email". `Brevo API 401` = wrong key; `400` mentioning the sender = verify the `MAIL_FROM` address in Brevo. |
| Registering spins forever | `SMTP_HOST` is set on Render's free plan (SMTP is blocked there). Remove `SMTP_HOST`/`SMTP_*` and set `BREVO_API_KEY`. |
