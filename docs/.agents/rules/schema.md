---
trigger: glob
globs: prisma/**
---

# schema.md

Job: say which models exist and the conventions every model follows. Field level detail is in the PRD's Prisma schema (Section 8.6). Any schema change needs the person's approval (AGENTS.md).

## Model inventory
- Private, one member each, read by member ID only: Member, Device, ActivationCode, ConsentRecord, Attendance, Charge, Payment, PaymentAttempt, ExpiryChange, QuestionLog, Handoff, WrongAnswerReport.
- Shared, the same for every member: Card, CardVersion, CardEmbedding.
- Staff and system, never shown to members: StaffAccount, Duty, Setting, DailyCode, and (PRD v0.2) DeskQuestionLog.

## Conventions
- Every private model has an indexed member ID column and a comment above it saying it is fetched by member ID only. Two exceptions: PaymentAttempt has no member column and is reached only through its Payment, and WrongAnswerReport's member ID is optional. Why: every private read filters on that column, and the isolation policy in access.md matches on it.
- Money is stored as whole kobo integers, never floats, and money columns carry a Kobo suffix, as the PRD's do. Convert to naira only for display. Why: float rounding makes balances drift, and the name shows the unit.
- Balance is not a column. Why: a stored total goes stale the moment a payment or charge lands.
- Attendance stores the Lagos calendar date, worked out from the current time in Lagos and not from the server's own clock. The unique key on member and date is what enforces one record a day (records.md). Why: a check in at 00:30 in Lagos falls on the previous day in UTC.
- Every day and month boundary uses Lagos time: check in day, expiry grace end and the month for days trained. Why: the gym's day is the Lagos day.
- Fees per tier, desk hours, gym name and owner WhatsApp number live in Setting, not in code. Staff WhatsApp numbers live on StaffAccount. Why: the owner changes these from a screen, so constants in code would go stale.
- Three things have no place in the PRD schema: the launch date and desk ledger date (decisions.md D7) and the counters for lockouts (D10). Do not invent fields for them. Why: a guessed field becomes a migration the person did not approve.
- The vector column uses Prisma's Unsupported type. The vector extension and any vector SQL go in a raw SQL migration. Reads and writes of that column use raw queries. Other columns use the normal client. Why: Prisma has no native vector type.