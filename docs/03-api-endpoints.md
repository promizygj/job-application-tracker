# 03 — API Endpoints

Base URL: `/api/v1` · JSON in/out (except file upload: `multipart/form-data`).

## Conventions

**Auth.** Sessions are managed by **Auth.js** in the Next.js app. The browser calls `/api/v1/*` on the Next.js origin, which rewrites to Express, so the encrypted `authjs.session-token` cookie (`__Secure-` prefixed over HTTPS) reaches the API. Express decrypts it with `@auth/core/jwt` using the shared `AUTH_SECRET`, then loads the user and checks `sessionVersion`. 🔒 = requires a session, ✅ = requires verified email, 🔑 = internal (Next.js server only, `x-internal-secret` header).

Sign-in and sign-out themselves are Auth.js routes (`/api/auth/*`) on the Next.js app, called via `signIn("credentials")` / `signOut()` from `next-auth/react`.

**Ownership.** Every `:id` is looked up with `WHERE id = :id AND userId = currentUser`. Not found or not yours → `404`.

**Success responses**
```json
{ "data": { ... } }
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }
```

**Error responses**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": [ { "path": "company", "message": "Required" } ] } }
```

| HTTP | `code` |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS` |
| 403 | `EMAIL_NOT_VERIFIED` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` (e.g. email taken) |
| 413 | `FILE_TOO_LARGE` |
| 415 | `UNSUPPORTED_FILE_TYPE` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |

---

## 1. Auth — `/auth`

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password }` | `201 { user }` | Sends verification email. Client then calls `signIn("credentials")`. Rate-limited. |
| POST | `/auth/credentials` 🔑 | `{ email, password }` | `200 { user + sessionVersion }` / `401` / `429` | Called by Auth.js `authorize()`. 5 failed attempts per email per 15 min. |
| POST | `/auth/logout-all` 🔒 | — | `204` | Bumps `sessionVersion`: every session is rejected. |
| POST | `/auth/verify-email` | `{ token }` | `200 { user }` | |
| POST | `/auth/resend-verification` 🔒 | — | `204` | Rate-limited. |
| POST | `/auth/forgot-password` | `{ email }` | `204` always | Never reveals if email exists. |
| POST | `/auth/reset-password` | `{ token, password }` | `204` | Signs out all sessions. |

## 2. Profile — `/users/me` 🔒 ✅ Implemented (except avatar)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/users/me` | — | `{ user }` |
| PATCH | `/users/me` | `{ name?, headline?, location?, timezone? }` | `{ user }` |
| POST | `/users/me/avatar` | multipart `file` (image ≤ 2 MB) | `{ user }` — *not built yet* |
| PATCH | `/users/me/password` | `{ currentPassword, newPassword }` | `204` (signs out all sessions) |
| POST | `/users/me/email` | `{ newEmail, password }` | `204` — emails a 24 h link to the **new** address; nothing changes until it is used. `409` if the address is taken. |
| POST | `/auth/confirm-email-change` | `{ token }` | `{ user }` — switches the email and marks it verified; sessions stay valid. Only the newest link works. |
| DELETE | `/users/me` | `{ password }` | `204` — deletes the account, all its rows (cascade) and its stored files. |

## 3. Applications — `/applications` 🔒 ✅ Implemented

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/applications` | see query params below | paginated list |
| POST | `/applications` | application fields | `201 { application }` (+ initial `StatusChange`) |
| GET | `/applications/:id` | — | `{ application }` incl. interviews, documents, status history |
| PATCH | `/applications/:id` | any subset of fields | `{ application }` (logs `StatusChange` if status changed) |
| DELETE | `/applications/:id` | — | `204` |

**`GET /applications` query params**

| Param | Example | Notes |
|---|---|---|
| `q` | `q=stripe` | Matches company OR job title, case-insensitive. |
| `status` | `status=APPLIED,INTERVIEW` | Comma-separated, multi. |
| `employmentType` | `employmentType=REMOTE,HYBRID` | Multi. |
| `appliedFrom`, `appliedTo` | `2026-10-01` | Inclusive ISO dates. |
| `sort` | `sort=-appliedAt` | Fields: `appliedAt`, `createdAt`, `updatedAt`, `company`, `status`. `-` prefix = desc. Default `-createdAt`. |
| `page`, `limit` | `page=2&limit=20` | `limit` max 100. |

**Application body (create)**
```json
{
  "company": "Stripe",
  "jobTitle": "Frontend Engineer",
  "jobDescription": "…",
  "jobUrl": "https://…",
  "location": "Dublin",
  "employmentType": "HYBRID",
  "jobType": "FULL_TIME",
  "salaryMin": 70000, "salaryMax": 90000, "salaryCurrency": "EUR", "salaryPeriod": "YEARLY",
  "status": "APPLIED",
  "priority": "HIGH",
  "source": "LinkedIn",
  "appliedAt": "2026-11-03",
  "notes": "Referred by Sam"
}
```
Validation: `company`, `jobTitle`, `employmentType` required; `salaryMax >= salaryMin` (checked against stored values on PATCH); `jobUrl` must be http(s); `salaryCurrency` 3-letter code (upper-cased); `appliedAt` is `YYYY-MM-DD`; unknown fields are rejected; empty strings become `null`.

**Behaviour rules** (implemented in `server/src/modules/applications/applications.service.js`)
- Every create writes a `StatusChange` (`null → status`); every PATCH that changes `status` writes `from → to`. Both happen in the same transaction as the update.
- A new application, or one whose status changes, goes to the **end** of its Kanban column (`max(position) + 1000`).
- If `appliedAt` is empty and the status becomes anything other than `SAVED`/`WITHDRAWN`, `appliedAt` is set to today in the user's timezone.
- List rows leave out `jobDescription` and `notes` and include `_count: { interviews, documents }`. Ties in sort order are broken by `id` so pages are stable; `appliedAt` sorting puts undated applications last; `status` sorts in pipeline order (Saved → Withdrawn).

## 4. Status & Kanban 🔒 ✅ Implemented

| Method | Path | Body / Query | Response | Notes |
|---|---|---|---|---|
| GET | `/board` | `q?`, `employmentType?` | `{ columns: { SAVED: [card…], APPLIED: [...], … } }` | All 7 columns always present, in pipeline order; cards ordered by `position`. |
| PATCH | `/applications/:id/move` | `{ status, beforeId }` **or** `{ status, index }` | `{ application }` (card shape) | `beforeId` = the card it should sit directly above, `null` = end of column; unknown ids append. Use this from the board: it stays correct when the board is filtered. `index` = 0-based slot in the full column, counted without the moved card. |
| GET | `/applications/:id/history` | — | `[{ id, fromStatus, toStatus, changedAt }]` | Timeline. ✅ Implemented. |

**Move algorithm** (`server/src/modules/board/board.service.js`, one transaction): the server reads the **full** target column (ignoring any filters), finds the slot (`beforeId`'s position, or `index`), takes the neighbours either side of it, and sets the card's position to their midpoint (or ±1000 at the ends, 1000 in an empty column). Only the moved row changes. If the neighbours are less than 1e-6 apart, the column is renumbered 1000, 2000, … A status change records history and fills `appliedAt`, exactly like `PATCH /applications/:id`.

The client should update the board optimistically and roll back if the request fails.

Card shape:
```json
{ "id": "…", "company": "Stripe", "jobTitle": "Frontend Engineer", "employmentType": "HYBRID",
  "salaryMin": 70000, "salaryMax": 90000, "salaryCurrency": "EUR", "salaryPeriod": "YEARLY",
  "status": "APPLIED", "appliedAt": "2026-11-03", "priority": "HIGH", "updatedAt": "…", "nextInterviewAt": "2026-11-10T14:00:00Z", "position": 3000 }
```
`nextInterviewAt` = earliest future interview with outcome `PENDING`, else `null`.

## 5. Interviews 🔒 ✅ Implemented

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/interviews` | `when=upcoming\|past`, `from`, `to`, `outcome`, `page`, `limit` | paginated list, each with `application: { id, company, jobTitle, status }` |
| GET | `/applications/:id/interviews` | — | list for one application, soonest first |
| POST | `/applications/:id/interviews` | interview fields | `201 { interview, suggestedStatus }` |
| GET | `/interviews/:id` | — | `{ interview }` |
| PATCH | `/interviews/:id` | subset | `{ interview }` |
| DELETE | `/interviews/:id` | — | `204` |

**Body:** `{ title*, type*, startsAt* (ISO date-time with offset), durationMinutes (5–1440, default 60), timezone (IANA, default = user's profile timezone), location?, meetingUrl? (http/s), interviewerName?, interviewerRole?, interviewerEmail?, prepNotes?, feedbackNotes?, outcome (default PENDING) }`

**List rules**
- `when=upcoming` → `startsAt >= now`, soonest first. `when=past` → `startsAt < now`, most recent first. Omitted → all, soonest first.
- `from` / `to` accept `YYYY-MM-DD` or an ISO date-time (for the calendar view). A date-only `to` includes the whole day (UTC). URL-encode `+` offsets, or use `Z`.
- `outcome=PENDING,PASSED` filters by outcome (comma-separated).

**Status suggestion (INT-4):** when the application is `SAVED`, `APPLIED` or `ASSESSMENT`, the create response has `suggestedStatus: "INTERVIEW"`, otherwise `null`. The client asks *"Move Stripe to Interview?"* and on yes calls `PATCH /applications/:id` with `{ status: "INTERVIEW" }`. The API never changes status by itself.

## 6. Documents 🔒 ✅ Implemented (local disk storage)

| Method | Path | Body / Query | Response | Notes |
|---|---|---|---|---|
| GET | `/documents` | `type?`, `name?` | `[document]` | Sorted by type, name, newest version first. Each has `usedInCount`. |
| POST | `/documents` ✅ | multipart: `file`, `type`, `name`, `notes?` | `201 { document }` | PDF/DOC/DOCX ≤ 4 MB (Vercel proxies requests and caps bodies at ~4.5 MB), type detected from the file's bytes. Becomes version `max + 1` of `(type, name)` **and the new default**. |
| GET | `/documents/:id` | — | `{ document }` | |
| PATCH | `/documents/:id` | `{ name?, notes?, isDefault?: true }` | `{ document }` | Renaming moves it to the other name group as its newest version. |
| GET | `/documents/:id/download` | `inline=true?` | `{ url, expiresAt }` | Signed URL, valid 5 min. `inline=true` opens PDFs in the browser. |
| DELETE | `/documents/:id` | `?force=true` if attached | `204` / `409 DOCUMENT_IN_USE` | Also deletes the stored file. |
| GET | `/applications/:id/documents` | — | `[document + attachedAt]` | |
| POST | `/applications/:id/documents` | `{ documentId }` | `201 { document }` | Attaching twice is a no-op. |
| DELETE | `/applications/:id/documents/:documentId` | — | `204` | Detach only; the document stays in the library. |
| GET | `/files/:userId/:file` | `exp`, `name`, `sig`, `inline?` | file bytes | **No session needed**: the HMAC signature from `/download` is the authorization. `403 LINK_EXPIRED` if invalid/expired. |

**Rules**
- **Default version:** every `(type, name)` group always has exactly one default. Uploading makes the new version the default; `PATCH { isDefault: true }` picks another; deleting or renaming the default promotes the newest remaining version.
- **File safety:** the type comes from magic bytes (`%PDF-`, ZIP with `word/` for DOCX, OLE header for DOC), not the filename or browser `Content-Type`. Stored names are random (`<userId>/<32 hex>.<ext>`); the original filename is kept only for display and downloads. The file route accepts only keys matching that pattern, so paths can't escape the upload folder.
- **Storage driver:** `server/src/lib/storage.js` exposes `save`, `remove` and `signedUrl`. The local driver writes to `server/uploads/` (git-ignored). A Cloudinary/S3 driver implements the same three functions and returns the provider's own signed URL, so clients don't change.

## 7. Dashboard & Analytics 🔒 ✅ Implemented

| Method | Path | Response |
|---|---|---|
| GET | `/dashboard/summary` | `{ total, byStatus: { SAVED: n, … all 7 }, counts: { applied, responded, interviewed, offered, rejected }, rates: { response, interview, offer, rejection }, upcomingInterviews: [≤5], recentApplications: [≤5] }` |
| GET | `/dashboard/activity` | `?weeks=12` (1–52) → `[{ weekStart: "YYYY-MM-DD", applied, interviews }]`, oldest first, empty weeks included |
| GET | `/dashboard/funnel` | `[{ stage: "APPLIED", count }, { stage: "INTERVIEW", count }, { stage: "OFFER", count }]` |

**Rules** (`server/src/modules/dashboard/dashboard.service.js`)
- Counts come from the status history (see requirements §6). **Applied** = ever reached Applied, Assessment, Interview, Offer or Rejected, so Saved → Withdrawn doesn't count. **Responded / interviewed / offered** = ever reached that stage, counted once per application. **Rejected** = currently Rejected (and applied).
- Rates are fractions rounded to 4 decimals (`0.2143` = 21.43%), or `null` when nothing has been applied for yet, so the UI can show "—" instead of 0%.
- `upcomingInterviews` = next 5 future interviews with outcome Pending. `recentApplications` = 5 most recently added.
- Activity weeks start on **Monday in the user's timezone**. `applied` is bucketed by `appliedAt`, `interviews` by start time converted to the user's timezone (cancelled excluded). The last bucket is the current week.

## 8. Misc

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ status: "ok", db: "ok" }` — for Render/Railway health checks |

## Express Folder Layout

```
server/
  prisma/schema.prisma
  src/
    app.js                 express app, middleware
    server.js              listen
    config/env.js          zod-validated env
    lib/prisma.js  lib/mailer.js  lib/storage.js  lib/tokens.js
    middleware/            auth.js (requireAuth, requireVerified, requireInternal)  validate.js  errorHandler.js  rateLimit.js
    modules/
      auth/                auth.routes.js  auth.service.js  auth.schemas.js
      users/  applications/  board/  interviews/  documents/  dashboard/
    utils/AppError.js      (Express 5 forwards async errors, so no asyncHandler)
  tests/
```
