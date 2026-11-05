# 04 — Wireframes & UI Design

Low-fidelity wireframes. Desktop first (≥1024 px); mobile notes under each screen.

## Design System Basics

| Token | Value |
|---|---|
| Font | Inter (Next.js `next/font`) |
| Base spacing | 4 px scale (Tailwind default) |
| Radius | `rounded-lg` cards, `rounded-md` inputs/buttons |
| Primary | Indigo-600 |
| Layout | 240 px sidebar + fluid content, max-width 1280 px |
| Dark mode | Tailwind `class` strategy, toggle in user menu |

**Status colours** (always paired with a text label — never colour alone):

| Status | Colour | Status | Colour |
|---|---|---|---|
| Saved | Slate | Offer | Green |
| Applied | Blue | Rejected | Red |
| Assessment | Amber | Withdrawn | Gray |
| Interview | Violet | | |

**Shared components:** `AppShell`, `Sidebar`, `TopBar`, `StatusBadge`, `EmploymentTypeBadge`, `StatCard`, `DataTable`, `FilterBar`, `Modal`, `ConfirmDialog`, `Toast`, `EmptyState`, `FileDropzone`, `DateTimePicker`, `SalaryInput`, `KanbanColumn`, `KanbanCard`.

---

## 1. App Shell

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ ◆ JobTrack   │  🔍 Search applications…            [+ New application] (👤)▾ │
│              ├──────────────────────────────────────────────────────────────┤
│ ▣ Dashboard  │                                                              │
│ ☰ Applications│                    page content                             │
│ ▥ Board      │                                                              │
│ ◷ Interviews │                                                              │
│ ▤ Documents  │                                                              │
│              │                                                              │
│ ──────────── │                                                              │
│ ⚙ Settings   │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```
Mobile: sidebar collapses to a hamburger drawer; "+ New" becomes a floating action button.

## 2. Auth Pages

```
            ┌─────────────────────────────────┐
            │          ◆ JobTrack             │
            │      Welcome back               │
            │                                 │
            │  Email     [________________]   │
            │  Password  [____________] 👁    │
            │                 Forgot password?│
            │  [          Log in           ]  │
            │                                 │
            │  No account? Create one         │
            └─────────────────────────────────┘
```
Register adds *Name* and a password-strength hint. Forgot/Reset password and Verify email use the same centred card. Unverified users see a dismissible banner in the app shell: *"Verify your email to upload documents. [Resend]"*.

## 3. Dashboard  (`/dashboard`)

```
Good morning, Promise                                     Last 12 weeks ▾
┌────────────┐┌────────────┐┌────────────┐┌────────────┐
│ Total      ││ Interview  ││ Offer      ││ Response   │
│   48       ││ rate 21%   ││ rate 4%    ││ rate 38%   │
└────────────┘└────────────┘└────────────┘└────────────┘
┌────────────────────────────────────────┐┌──────────────────────────┐
│ Applications per week          (bar)   ││ By status       (donut)  │
│  ▁▃▅▂▇▆▃▅▄▆▇▅                          ││    ◯  Applied 20         │
│                                        ││       Interview 6 …      │
└────────────────────────────────────────┘└──────────────────────────┘
┌────────────────────────────────────────┐┌──────────────────────────┐
│ Upcoming interviews           View all ││ Pipeline funnel          │
│ Tue 10 Nov 14:00  Stripe · Tech round  ││ Applied    ██████████ 40 │
│ Thu 12 Nov 09:30  Monzo · HR screen    ││ Interview  ███        10 │
│ (empty: "No interviews scheduled")     ││ Offer      ▌           2 │
└────────────────────────────────────────┘└──────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ Recently added                                              View all │
│ Stripe      Frontend Engineer     [Applied]   Hybrid   3 Nov         │
│ Vercel      DX Engineer           [Saved]     Remote   2 Nov         │
└──────────────────────────────────────────────────────────────────────┘
```
Status count chips (7) sit under the stat cards and link to the filtered list. Mobile: everything stacks in one column, stat cards 2×2.
New user empty state: illustration + "Add your first application" CTA.

## 4. Applications List  (`/applications`)

```
Applications (48)                                    [+ New application]
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 Company or title…  Status ▾  Type ▾  Applied: from–to ▾  Sort ▾  ✕ │
└──────────────────────────────────────────────────────────────────────┘
┌──────────┬────────────────────┬────────────┬─────────┬──────────┬─────┐
│ Company ↕│ Job title          │ Status ↕   │ Type    │ Applied ↕│     │
├──────────┼────────────────────┼────────────┼─────────┼──────────┼─────┤
│ Stripe   │ Frontend Engineer  │ [Interview]│ Hybrid  │ 3 Nov 26 │  ⋯  │
│ Monzo    │ React Developer    │ [Applied]  │ Remote  │ 1 Nov 26 │  ⋯  │
└──────────┴────────────────────┴────────────┴─────────┴──────────┴─────┘
                                   ‹ 1 2 3 ›     20 per page ▾
```
`⋯` menu: View, Edit, Change status ▸, Delete. Filters sync to the URL. Mobile: table becomes a card list; filters open in a bottom sheet.

## 5. Add / Edit Application Form  (`/applications/new`)

```
New application
┌─ Job ────────────────────────────────────────────────────────────────┐
│ Company *        [______________]   Job title *   [______________]   │
│ Job URL          [https://______________________________________]    │
│ Location         [______________]   Source        [LinkedIn     ▾]   │
│ Employment type * (•) Remote  ( ) Hybrid  ( ) On-site                │
│ Job type         [Full-time ▾]                                       │
├─ Salary ─────────────────────────────────────────────────────────────┤
│ [EUR▾] Min [ 70,000 ]  –  Max [ 90,000 ]   per [Year ▾]              │
├─ Status ─────────────────────────────────────────────────────────────┤
│ Status [Applied ▾]   Applied on [📅 03/11/2026]   Priority [High ▾]  │
├─ Description ────────────────────────────────────────────────────────┤
│ [ paste job description …                                       ]    │
├─ Documents ──────────────────────────────────────────────────────────┤
│ CV [Frontend CV v3 ▾]   Cover letter [None ▾]   or [Upload new]      │
├─ Notes ──────────────────────────────────────────────────────────────┤
│ [ personal notes …                                               ]   │
└──────────────────────────────────────────────────────────────────────┘
                                          [Cancel]  [Save application]
```
Inline validation on blur; errors under fields; unsaved-changes guard on navigation. Edit uses the same form pre-filled. Mobile: single column.

## 6. Application Details  (`/applications/[id]`)

```
← Applications
Stripe · Frontend Engineer                    [Interview ▾]  [Edit]  [⋯]
Hybrid · Dublin · €70k–90k / yr · Applied 3 Nov 2026 · via LinkedIn  ↗ job post
┌ Overview │ Interviews (2) │ Documents (2) │ Timeline ┐
├──────────────────────────────────────────────────────────────────────┤
│ Overview:   Job description (collapsible) · Notes (inline edit)      │
│ Interviews: list + [+ Schedule interview]                            │
│ Documents:  attached files [Preview] [Download] [Detach] + [Attach]  │
│ Timeline:   ● Saved      28 Oct                                      │
│             ● Applied     3 Nov                                      │
│             ● Interview   6 Nov                                      │
└──────────────────────────────────────────────────────────────────────┘
```
Status dropdown in the header changes status directly (logs history).

## 7. Kanban Board  (`/board`)

```
Board                                   🔍 Filter cards…   Type ▾
┌ Saved 4 ─┐┌ Applied 20┐┌ Assess. 3 ┐┌ Interview 6┐┌ Offer 2 ─┐┌ Rejected 12 ▸┐┌ Withdrawn 1 ▸┐
│┌────────┐││┌─────────┐││┌─────────┐││┌──────────┐││┌────────┐│
││Vercel  ││││Stripe   ││││Monzo    ││││Revolut   ││││Wise    ││   collapsed
││DX Eng. ││││FE Eng.  ││││React Dev││││Sr. FE    ││││FE Lead ││   columns show
││Remote  ││││Hybrid   ││││Remote   ││││On-site   ││││Remote  ││   only header
││        ││││€70–90k  ││││         ││││📅 10 Nov ││││        ││   + count
││        ││││5d ago   ││││         ││││          ││││        ││
│└────────┘││└─────────┘││└─────────┘││└──────────┘││└────────┘│
│ + Add    ││ + Add     ││           ││            ││          │
└──────────┘└───────────┘└───────────┘└────────────┘└──────────┘
```
- Drag a card → column highlights, placeholder shows drop slot. Drop = optimistic update; failure = card snaps back + toast.
- Keyboard: focus card, `Space` to pick up, arrows to move, `Space` to drop, `Esc` to cancel (dnd-kit sensors + live-region announcements).
- Click the company name on a card → opens the details page. (Side drawer is a possible later enhancement.)
- Priority shown as a small left border colour + text in drawer.
- Mobile: columns snap-scroll horizontally, one per screen; long-press to drag, plus a "Move to…" menu on each card as a non-drag alternative.

## 8. Interviews  (`/interviews`)

```
Interviews                    [Upcoming] [Past] [Calendar]   [+ Schedule]
┌──────────────────────────────────────────────────────────────────────┐
│ TUE 10 NOV                                                           │
│ 14:00–15:00  Stripe · Frontend Engineer — Technical round 1  [Video] │
│              👤 Jane Doe, Eng Manager   🔗 Join meeting   Prep notes ▸│
│ THU 12 NOV                                                           │
│ 09:30–10:00  Monzo · React Developer — HR screen            [Phone]  │
└──────────────────────────────────────────────────────────────────────┘
```
Past tab adds an Outcome badge and "Add feedback". Calendar tab = month grid with dots per day.

**Schedule interview modal:** Application [search ▾] (pre-filled from details page) · Title · Type · Date · Start time · Duration · Timezone · Location *or* Meeting link · Interviewer name / role / email · Prep notes. After save, if the application is before `INTERVIEW`: *"Move Stripe to Interview?" [Yes] [No]*.

## 9. Documents  (`/documents`)

```
Documents                         [All] [CVs] [Cover letters]    [Upload]
┌──────────────────────────────────────────────────────────────────────┐
│ 📄 Frontend CV                     CV · ★ default v3 · used in 14    │
│    v3  frontend-cv-nov.pdf   120 KB   3 Nov   [Preview][⬇][⋯]        │
│    v2  frontend-cv-oct.pdf   118 KB  12 Oct   [Preview][⬇][⋯]        │
│ 📄 Fullstack CV                    CV · v1 · used in 2                │
│ 📝 Stripe cover letter             Cover letter · v1 · used in 1      │
└──────────────────────────────────────────────────────────────────────┘
```
**Upload modal:** drag-and-drop zone (PDF/DOC/DOCX, ≤ 5 MB) · Type · Name (combobox: pick existing name → new version, or type a new one) · Notes. Progress bar during upload.
Preview: PDFs open in a modal viewer; DOC/DOCX download.

## 10. Settings

- **Profile:** avatar, name, headline, location, timezone, email (change → re-verify).
- **Security:** change password, "Sign out everywhere", danger zone "Delete account" (type email to confirm).

## Frontend Structure (Phase 3 preview)

```
client/src/
  app/
    (public)/login  register  forgot-password  reset-password  verify-email
    (app)/layout.js  dashboard  applications/[id]  applications/new  board  interviews  documents  settings/*
  components/ui/      Button Input Select Modal Badge …
  components/<feature>/
  store/              store.js  authSlice.js  uiSlice.js
  auth.js  proxy.js   Auth.js config + route protection (Next 16 `proxy` replaces middleware)
  lib/api.js          axios instance (baseURL /api/v1; 401 → signOut)
  lib/  constants/statuses.js
```
State: Redux Toolkit for auth/session + UI; **RTK Query** for server data (caching, invalidation and optimistic Kanban updates come built in — it ships with Redux Toolkit, so it doesn't add a dependency, and it can replace hand-written Axios thunks; Axios stays as its base query).
