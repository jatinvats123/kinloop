# Kinloop

**The care circle where the elder stays in charge.** Kinloop helps an elderly person manage daily
medicines, health routines and doctor visits, while the family and caretakers who help them can see
what is done, what is missed and why.

> **Try it:** open the live app and press **Start the demo, no sign-up**. You get your own isolated
> circle for Kamla Devi (elder), her daughter Priya and caretaker Ramesh, with ten days of history.
> Use the dark demo bar to switch between them.

## What it does

| Problem statement asks for                        | Where it lives                                                                                                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secure, passcode-based access                     | Circle code (`XXXX-XXXX`) + personal 6-digit passcode, scrypt-hashed, lockout after 5 failures: `/sign-in`, `/start`, `src/server/services/circles.ts`                                       |
| Elder's healthcare profile                        | Conditions, allergies, blood group, doctor, emergency contact: `/circle`, `/circle/profile`                                                                                                  |
| Elders, family and caretakers in one shared space | Roles `elder` / `family` / `caretaker`, access `view` / `edit`, organisers, per-member alert choices: `/circle`, `src/domain/permissions.ts`                                                 |
| View, add, edit, manage medication schedules      | One model for medicines **and** routines (BP checks, walks), times, weekdays, start/end, pause: `/medicines`                                                                                 |
| Track adherence                                   | 7/30-day percentages overall and per item, streak, most-missed part of day: `/adherence`, `src/domain/adherence.ts`                                                                          |
| Monitor upcoming appointments                     | Visits with **Add to Google Calendar** links: `/appointments`                                                                                                                                |
| Elder at the centre                               | **Today** is elder-first: large type, one big action per time slot, skip with a reason, day bloom, read-aloud, text size: `/today`                                                           |
| Keep the circle informed                          | Overview with today's status, flagged skips ("felt unwell", "ran out"), the week and an activity feed: `/overview`, `/activity`                                                              |
| Proactive email reminders (doses, missed, visits) | Closed-loop ladder: the elder at T−10 and T+30, the circle at T+60, visits 24 h and 2 h before; one-tap confirm; reminders log + test email: `/reminders`, `src/domain/reminders.ts`         |
| Smarter: is this the right medicine?              | Photograph a strip; Gemini only reads the label, tested code gives the verdict (due now, not now, already taken, different strength, not on the list): `/check`, `src/domain/label-match.ts` |
| Elder stays in charge                             | **Ask me first**: other members' schedule changes become proposals the elder approves on Today: `/circle`, `src/server/services/proposals.ts`                                                |
| Collaborative                                     | "I'll check on her": the first member to answer an escalation email is shown to everyone as handling it: `/check-on`, `/overview`                                                            |
| Less typing                                       | Prescription import: paste text or a photo, Gemini drafts medicines, a person reviews and confirms each one: `/medicines/import`                                                             |

## How it is built

**Principle: the AI reads and drafts; tested code decides; a person confirms.** Every schedule, status,
percentage, reminder and label verdict comes from pure, unit-tested functions in `src/domain`. Gemini
never writes to the database and never gives medical advice.

```
src/app/          routes, pages and thin server actions
src/components/   UI: primitives (ui/), signature pieces (signature/), screens
src/server/       auth, services, repositories (Firestore + in-memory), security
src/domain/       pure functions: schedule, status, adherence, reminder ladder, label matching, permissions
```

- **Schedule engine** (`src/domain/schedule.ts`): doses are never stored ahead of time; slots are
  derived from items for any date range in the circle's IANA timezone. Logs use a deterministic ID
  (`item_slotInstant`), so logging twice never duplicates.
- **Reminder engine** (`src/domain/reminders.ts`, `src/server/reminders/tick.ts`): window-based, so a
  late or repeated cron tick sends each email at most once. Each email is claimed (create-if-absent in
  Firestore) before it is sent and released if sending fails; the elder is always told first.
- **AI client** (`src/server/ai/client.ts`): called only on a user action, 20 s timeout, one retry,
  per-circle daily quota, JSON forced by a schema and re-validated with Zod; user text and images are
  treated as data. Label reading returns only brand, ingredients, strengths and confidence.
- **Repository pattern** (`src/server/repositories`): one interface, a Firestore implementation and an
  in-memory twin. `DATA_BACKEND=memory` runs the app and every test with no cloud access.
- **Efficiency**: server components for reads, one bounded query per collection per page, batched
  writes, single-field indexes only, client JavaScript only for interactive controls.

## Google services

- **Gemini API** (`@google/genai`, model from `GEMINI_MODEL`): vision for the right-medicine check and
  prescription photos, text for pasted prescriptions: `src/server/ai/`
- **Gmail SMTP** (Nodemailer, app password) for every reminder email: `src/server/email/`
- **Firestore** (Firebase, Native mode) through `@google-cloud/firestore`, server-side only:
  `src/server/repositories/firestore-repository.ts`
- **Google Fonts** (Urbanist) through `next/font`: `src/app/layout.tsx`
- **Google Calendar** event links for every visit: `src/domain/calendar-link.ts`
- **Cloud Run-ready container**: multi-stage, non-root `Dockerfile` and `/api/health`; the command is in
  `docs/DEPLOY.md`. The live app is hosted on Vercel.

## Accessibility

WCAG 2.2 AA as the floor; elder screens aim higher. Skip link, landmarks, one `h1` per page, labelled
inputs with linked errors, visible focus, targets of 44 px (56 px for elder actions), status always as
icon + text, `aria-live` updates, reduced motion respected, works from 320 px. Every text colour pair is
checked by a contrast test (`src/components/ui/tokens.test.ts`, at least 7:1 on elder screens), and
component tests run **axe** with zero violations.

## Security

See [SECURITY.md](SECURITY.md): scrypt passcodes, lockout, signed httpOnly sessions, circle-scoped
queries, one permission function with a denial test for every mutation, Zod validation, nonce CSP and
security headers, origin checks, rate limits, constant-time cron secret.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill SESSION_SECRET, LINK_SECRET, CRON_SECRET (32+ random bytes)
npm run dev                  # in-memory data, no cloud needed
npm run check                # lint + typecheck + tests with coverage thresholds
```

Tests: Vitest + Testing Library + axe. Coverage thresholds are enforced in `vitest.config.mts`
(`src/domain` ≥ 95 % lines, overall ≥ 85 %).

## Deployment

Vercel (Hobby) + Firestore on the free Firebase Spark plan, with a GitHub Actions schedule calling
`POST /api/cron/tick` every five minutes using a shared secret. GitHub may run schedules late; the tick
is window-based and idempotent, so late or repeated runs are safe. Steps: [docs/DEPLOY.md](docs/DEPLOY.md).

## Licence

MIT
