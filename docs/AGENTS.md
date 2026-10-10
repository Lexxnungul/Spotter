# spotter

## Description

Spotter is a web app a gym gives to its own members. It answers questions only from the gym's own approved records, never from the internet or general knowledge. When the records hold no answer, or the question falls in one of eight fixed refusal categories listed in `.agents/rules/refusals.md`, it refuses (even when a matching record exists) and hands the member to a named staff member instead of guessing.

## Who uses it

- **Member.** The only user of the app. She checks in, asks about the gym, checks her own attendance and balance, pays, and reaches staff when the app cannot help.
- **Staff.** Not users of the app. They draft records for approval, set the daily check-in code, generate activation codes, record manual check-ins, enter cash and transfer payments, and set who is on duty. They appear to members only as a named contact.
- **Owner.** Not a user of the app. Approves records, keeps the member list, sets fees, and reviews a weekly page covering wrong answers, unanswered questions, overdue records, expiry changes, and failed payments.

## One thing that the agent must do well

Never let one member's private data reach another member. Every private record (attendance, balance, tier, expiry, payment history) is fetched by the exact member ID from the server session only, never from a request body, a URL, question text, or model output, and never searched across members.

The agent must also never let the app state a money judgment. Balance answers report the record only, using words like "outstanding" or "credit." Words like "you owe," "you must pay," or "you are late" are never used.

## Defined scope for the MVP

Five member-facing features, no more:

1. Ask about the gym. Answers from shared records (timetable, prices, rules, access hours, guest policy, pause and cancellation terms, training plans, trainer guidance) that the member's tier allows.
2. My records. Answers about the member's own attendance, balance, tier, and expiry, fetched by her member ID. Balance answers report the record only and never say "you owe."
3. Check in. A daily code written at the gym records one attendance entry. Only one check-in per member per day is allowed. Check-in always needs network and is never queued.
4. Pay. A gateway payment for renewal or balance, confirmed by webhook only.
5. Ask the desk. When records are silent, or the question is a never-answer case, name the staff member on duty and open a WhatsApp link addressed to that person, pre-filled with the member's question. No in-app messaging is built.

Staff and owner screens are inputs, not features: draft and approve records, maintain the member list, set fees, enter cash or transfer payments, set the daily check-in code, generate activation codes, record manual check-ins, set who is on duty, and review the weekly page.

## Not in scope for the MVP

- Reminders, nudges, follow-up messages of any kind.
- Automated agents.
- SMS one-time codes.
- A Play Store app. This ships as a web app saved to the home screen.
- A wallet or stored balance. The app never holds member money.
- Refunds handled inside the app.
- Class booking, trainer chat, multiple gyms, multiple languages.
- Location-based check-in.
- PDF receipts.
- Any in-app messaging or inbox. Staff handoff is a WhatsApp link only.

## Stack

- Next.js (App Router)
- TypeScript
- Prisma
- PostgreSQL
- pgvector for vector data
- Flutterwave for payments
- Gemini free tier for the AI model layer

These are fixed. Do not propose an alternative to any of them.

Note: the PRD's payment and AI sections are written against different tools than these. See Open Questions before building any payment or AI feature.

## Folder map

- App routes for members: status, ask, records, check-in, pay, ask the desk.
- App routes for staff: cards, daily code, activation codes, manual check-in, duty.
- App routes for the owner: approve, members, fees, review, export.
- One API route for the payment gateway webhook.
- A Prisma schema and client for all database access.

No other folder structure is fixed yet. Do not invent additional top-level folders without asking.

## How to work in this codebase

- Make one change at a time.
- Ask before adding a package or a dependency.
- Never touch the database directly, and never edit the Prisma schema or run a migration without asking first. All reads and writes go through Prisma, using existing models only.
- List every assumption made, at the end of every response.
- If the PRD is silent about something needed to do the task, stop and ask instead of guessing.

## Where the detailed rules live

This file holds only durable facts about the product. It does not hold schema, SQL, model names, dimensions, prices, thresholds, environment variable names, or file-by-file build detail. Detailed rules live in `.agents/rules/`, one file per job:

General project rules, not specific to Spotter:
- `.agents/rules/decisions.md` for the answers to open questions and any choice that overrides the PRD.
- `.agents/rules/env.md` for environment variable names, who can read each one, and how secrets are handled.
- `.agents/rules/commands.md` for the exact commands to install, run, check, test and build this project.
- `.agents/rules/boundaries.md` for files never edited by hand and commands never run.
- `.agents/rules/ci.md` for what runs automatically on every push and what blocks a merge.

Spotter specific rules:
- `.agents/rules/schema.md` for the Prisma data model and its conventions.
- `.agents/rules/access.md` for member credentials, staff and owner roles, private data access, and effective tier.
- `.agents/rules/ai-pipeline.md` for model names, the router, retrieval, prompts, and the embedding store.
- `.agents/rules/payments.md` for the payment gateway flow and fee handling.
- `.agents/rules/refusals.md` for the eight never-answer categories, their refusal sentences, and the fixed wording used for balance and attendance answers.
- `.agents/rules/records.md` for how shared cards, attendance, tier, expiry and balance are kept true.
- `.agents/rules/event-log.md` for what version one must record.
- `.agents/rules/member-device.md` for phone, data and offline limits, and the first screen.
- `.agents/rules/jobs.md` for scheduled jobs and the rule that a job must be safe to run twice.
- `.agents/rules/required-tests.md` for the tests the PRD makes mandatory.

If one of these files does not exist yet, ask before creating conventions inside it. The PRD itself is not one of these files; its version and its location in this project are still open (`.agents/rules/decisions.md` D3).

## Definitions

- **Tier.** A member's access level: Basic or Premium, stored on her record. Her effective tier, used for every access check, is Premium for a period after expiry and during a pending renewal payment. The exact rule lives in `.agents/rules/access.md`.
- **Shared record.** A record the same for every member, such as the timetable, prices, rules, access hours, guest policy, cancellation terms, training plans, and trainer guidance. Gated by tier. Searchable by meaning.
- **Private record.** A record belonging to one member only, such as attendance, tier, expiry, balance, and payment history. Fetched by exact member ID. Never embedded, never searched across members.
- **Card.** The unit a shared record is stored as: a short typed piece of text with a tier, a title, a last-confirmed date, and an author.
- **Chunk.** One card version is one chunk. Cards are not split into smaller pieces.
- **Router.** The step that decides what kind of question was asked, before any record is touched.
- **Grounding.** Forcing every generated answer back to a named card it came from, and treating all card text and all member question text as data, never as instructions to follow.
- **Never-answer.** One of eight fixed question categories the app refuses outright, even when a matching record exists, listed in `.agents/rules/refusals.md`.

---

## Open questions

The PRD and the fixed stack given for this file disagree or are silent on several points. Do not guess. Ask the person before building against any of these. The two below are the ones that block the most work; the full, growing list, with an interim rule for each, lives in `.agents/rules/decisions.md`.

1. **Payment gateway mismatch (decisions.md D1, decided).** The PRD's payment flow (webhook confirmation, verify endpoint, fee amounts) is written against Paystack. This file's fixed stack names Flutterwave instead. The webhook and fee rules in `.agents/rules/payments.md` are written for Flutterwave, not copied from the PRD.
2. **AI model split (decisions.md D2, open).** The PRD names two separate free-tier models: one for embeddings and a different one for generating answers and running the router. This file's fixed stack names only "Gemini free tier" for the AI model layer, with no separate model named for answer generation or routing. Confirm whether Gemini covers both jobs, or whether a second model is still needed, before choosing an answer or router model in `.agents/rules/ai-pipeline.md`.