# 01 — Application Requirements

## 1. Purpose

A web app where a job seeker manages their whole search from one dashboard: applications, status pipeline (Kanban), interviews, documents (CVs / cover letters) and analytics.

## 2. Users & Roles

| Role | Description |
|---|---|
| Guest | Can view landing page, register, log in, reset password. |
| User (verified) | Full access to their **own** data only. |
| User (unverified) | Can log in, but sees a "verify your email" banner; can't upload documents until verified. |

There is no admin role in v1. Every resource row is owned by exactly one user and every query is scoped by `userId`.

## 3. Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Repo layout | Monorepo: `client/` (Next.js) + `server/` (Express) | One GitHub repo, separate deploys (Vercel + Render/Railway). |
| Next.js router | App Router, JavaScript | Current standard; layouts make the sidebar shell simple. |
| Auth | **Auth.js v5** (`next-auth@5`) in Next.js, Credentials provider, JWT session in an encrypted `httpOnly` cookie. Next.js proxies `/api/v1/*` to Express (same origin), and Express decrypts the same cookie with `@auth/core/jwt` and the shared `AUTH_SECRET`. Express owns the database: Auth.js `authorize()` calls an internal `POST /auth/credentials` endpoint. A `sessionVersion` counter on `User` (copied into the JWT as `sv`) revokes sessions on logout-all and password change/reset. | Standard Next.js auth library, room to add Google/GitHub sign-in later, and still a single owner of the DB. |
| Password hashing | `bcrypt` (cost 12) | Standard and well supported. |
| Validation | `zod` on the server (shared schemas mirrored on the client forms) | One place defines what is valid. |
| File storage | Cloudinary (`raw` resource type for PDF/DOCX), signed URLs for download | Free tier, simple SDK. Behind a `storage` service so S3 can be swapped in. |
| Email | Nodemailer + SMTP (Mailtrap in dev, Resend/Brevo in prod) | Verification, reset, and later reminders. |
| Kanban ordering | `position` (float) per application within its status column | Moving a card only updates one row (midpoint between neighbours). |
| Status history | Every status change writes a `StatusChange` row | Needed for "view progress" timeline and conversion-rate analytics. |
| Dates | Stored UTC; user has a `timezone` field for display and reminders | Interviews across time zones. |

## 4. Functional Requirements

IDs are referenced by tests in Phase 4.

### A. Authentication (AUTH)
- **AUTH-1** Register with name, email, password (min 8 chars, ≥1 letter and ≥1 number). Email is unique, case-insensitive.
- **AUTH-2** After registration a verification email is sent with a single-use link valid 24 h. User can request a resend (rate-limited).
- **AUTH-3** Log in with email + password. Generic error message on failure ("Invalid email or password"). 5 failed attempts / 15 min per IP+email → temporary lock.
- **AUTH-4** Log out clears the Auth.js session cookie. "Log out of all devices" bumps `sessionVersion`, so the API rejects every existing session.
- **AUTH-5** Forgot password sends a single-use reset link valid 1 h. Response is identical whether or not the email exists.
- **AUTH-6** Reset password signs out every device (bumps `sessionVersion`) and marks the email verified.
- **AUTH-7** Profile: view/edit name, headline, location, timezone, avatar; change password (requires current password); change email (re-verification); delete account (cascades all data + files).

### B. Dashboard (DASH)
- **DASH-1** Total applications count.
- **DASH-2** Count per status (7 statuses).
- **DASH-3** Next 5 upcoming interviews.
- **DASH-4** 5 most recently added applications.
- **DASH-5** Success stats: response rate, interview rate, offer rate (definitions in §6).
- **DASH-6** Charts: applications per week (last 12 weeks, bar), status breakdown (donut), funnel Applied → Interview → Offer.

### C. Applications (APP)
- **APP-1** Create / edit / delete / view an application.
- **APP-2** Fields: company*, job title*, job description (rich text / markdown), job URL, location, salary min/max/currency/period, employment type* (Remote, Hybrid, On-site), job type (Full-time, Part-time, Contract, Internship), application date, source (LinkedIn, referral…), priority, notes, status* (default `SAVED`). `*` = required.
- **APP-3** Delete asks for confirmation; it removes linked interviews and status history but **not** the documents (documents are only unlinked).

### D. Status (STAT)
- **STAT-1** Statuses: `SAVED`, `APPLIED`, `ASSESSMENT`, `INTERVIEW`, `OFFER`, `REJECTED`, `WITHDRAWN`.
- **STAT-2** Any status can move to any other (real life is messy), but each change is logged with timestamp.
- **STAT-3** Moving from `SAVED` to `APPLIED` sets `appliedAt` to today if empty.
- **STAT-4** Details page shows a status timeline.

### E. Kanban (KAN)
- **KAN-1** One column per status, cards sorted by `position`.
- **KAN-2** Drag & drop between and within columns (dnd-kit), with keyboard support.
- **KAN-3** Drop updates status + position optimistically; reverts with a toast if the API fails.
- **KAN-4** Card shows company, title, employment type, salary range, days since applied, next interview date.
- **KAN-5** `REJECTED` / `WITHDRAWN` columns are collapsible.

### F. Interviews (INT)
- **INT-1** Create / edit / delete interviews, always attached to an application.
- **INT-2** Fields: round title (e.g. "Technical round 1"), type (Phone, Video, On-site, Technical, Behavioural, Panel, Other), start date-time, duration, timezone, location or meeting link, interviewer name(s)/role/email, prep notes, outcome (Pending, Passed, Failed, Cancelled), post-interview feedback notes.
- **INT-3** Interviews page with "Upcoming" and "Past" tabs, plus a simple calendar/agenda view.
- **INT-4** Scheduling an interview on an application in `SAVED`/`APPLIED`/`ASSESSMENT` offers to move it to `INTERVIEW`.

### G. Documents (DOC)
- **DOC-1** Upload PDF, DOC, DOCX (max 5 MB). Type: CV, Cover letter, Other.
- **DOC-2** CV versions: documents share a `name` (e.g. "Frontend CV"); uploading a new version increments `version`. One version per name can be marked default.
- **DOC-3** Attach one or more documents to an application (many-to-many); show "used in N applications".
- **DOC-4** Preview (PDF inline) and download via short-lived signed URL.
- **DOC-5** Delete a document; blocked with a warning if attached, unless confirmed.

### H. Search & Filter (SRCH)
- **SRCH-1** Free-text search on company and job title (case-insensitive, partial).
- **SRCH-2** Filters: status (multi), employment type (multi), application date range.
- **SRCH-3** Sort by applied date, created date, updated date, company, status — asc/desc.
- **SRCH-4** Server-side pagination (default 20/page). Filters are reflected in the URL query string so views are shareable/bookmarkable.

## 5. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Security | Helmet, CORS allow-list (client origin only), rate limiting on auth routes, input validation on every endpoint, ownership checks on every resource (return 404, not 403, for other users' IDs), no secrets in client bundle, file type checked by magic bytes not just extension. |
| Performance | List endpoints < 300 ms p95 with 1 000 applications; DB indexes on `(userId, status)`, `(userId, appliedAt)`, `(userId, startsAt)`. |
| Accessibility | WCAG 2.1 AA: keyboard navigable (incl. Kanban), labelled form fields, visible focus, colour is never the only status indicator. |
| Responsive | Works from 360 px wide. On mobile the Kanban scrolls horizontally one column at a time; sidebar becomes a bottom/hamburger nav. |
| Reliability | Consistent JSON error format (see API doc); DB migrations via Prisma; soft-fail on email provider errors (log, allow resend). |
| Privacy | User can delete their account and all data. Documents are private (never public URLs). |

## 6. Analytics Definitions

Computed over applications that have left `SAVED` (i.e. actually applied):

- **Response rate** = applications that ever reached `ASSESSMENT`, `INTERVIEW`, `OFFER` or `REJECTED` ÷ applied.
- **Interview rate** = ever reached `INTERVIEW` ÷ applied.
- **Offer rate** = ever reached `OFFER` ÷ applied.
- **Rejection rate** = currently `REJECTED` ÷ applied.

"Ever reached" uses `StatusChange` history, so an application that went Interview → Rejected still counts toward interview rate.

## 7. Out of Scope for v1 (Advanced, later)

AI CV matching, AI cover letters, job URL extraction, email reminders, calendar sync, follow-up reminders, job search insights. The schema leaves room for them (`followUpAt` on applications, `Reminder` table added later).

## 8. Pages (Sitemap)

```
Public
  /                      Landing
  /login
  /register
  /forgot-password
  /reset-password?token=
  /verify-email?token=

App (authenticated, sidebar layout)
  /dashboard
  /applications          List + search/filter/sort
  /applications/new
  /applications/[id]     Details (tabs: Overview · Interviews · Documents · Timeline)
  /applications/[id]/edit
  /board                 Kanban
  /interviews            Upcoming / Past / Calendar
  /documents             Library (grouped by name, with versions)
  /settings/profile
  /settings/security     Password, sessions, delete account
```
