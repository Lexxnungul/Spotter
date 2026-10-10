---
trigger: always_on
---

# decisions.md

Job: keep the answers to open questions and any choice that overrides the PRD.

## How to use this file
- Read it before asking the person a question. Why: the answer may already be here.
- If an entry conflicts with the PRD, the entry wins. Why: entries are later, deliberate choices. The PRD is a fixed draft.
- Record an answer only when the person states it to you. Why: a guess written here would become policy in every later session.
- When you find a conflict or gap, add an Open entry, then ask. Do not resolve it yourself. Why: AGENTS.md forbids guessing.
- Each Open entry says what to do until it is answered. Follow it, and list any proposal you follow as an assumption in your response. Why: work can continue while the assumption stays visible.
- Each entry has a number, question, answer, date raised and status (Decided or Open). Why: the date shows how long a question has waited.

## Entries
All entries were raised on 2026-09-28.

### D1. Payment gateway
- Answer: Flutterwave. Status: Decided (fixed stack).
- Effect: PRD text that names another gateway, its fee figures, its webhook route or its verify endpoint does not apply. Why: those details belong to a different gateway. See payments.md.

### D2. AI model layer
- Answer: Gemini free tier covers embeddings, router classification, and answer generation. Status: Decided.
- Effect: Gemini free tier handles routing, embedding generation, and answer synthesis. Follow ai-pipeline.md rules and fallbacks.

### D3. PRD version and location
- Answer: PRD v0.2 governs (with local copy spotter-prd-v0.1.md in docs/). Status: Decided.
- Effect: PRD v0.2 additions (database-level isolation, server-side idempotency keys, router injection guard, no vector index in v1, and desk question log) govern implementation.

### D4. Hosting
- Nothing is chosen. The PRD warns that its assumed free host may not allow commercial use, and that free plans limit scheduled jobs.
- Until answered: do not deploy, pick a host or build a scheduled job. Why: the 24 hour payment check (payments.md) and charge creation (records.md) both need a scheduler, and the host decides how it runs.
- Status: Open.

### D5. Questions only the gym owner can answer
- PRD Section 14 lists them: who absorbs the gateway fee, cash renewal timing, desk hours, renewal dates, plan types and pauses, Spotter's price, member language, data protection advice, member wifi, and Basic access to pause and cancellation terms.
- Record each answer here when given. Until then, use the default the PRD assumed and list it as an assumption.
- Status: Open.

### D6. PRD contradiction on empty answers
- The PRD says a private record with no rows gets the "records do not have that" sentence. It also gives attendance and balance their own empty answers.
- Proposed: the specific empty answers win for attendance and balance. See refusals.md.
- Status: Open.

### D7. Where launch date and desk ledger date are stored
- The fixed answers show both dates. The PRD schema has no place for them.
- Proposed: two keys in Setting.
- Until answered: do not add fields. Ask when you reach the fixed answers in refusals.md. Why: a guessed field becomes an unapproved migration. Status: Open.

### D8. Billing period and charge timing
- The PRD sets a monthly fee and says "one billing period" but never says how a period is counted (one calendar month or 30 days).
- It creates a Charge on the expiry date, and it also moves expiry when a payment lands. It does not say which charge an early renewal settles, or what creates Charge rows (a scheduled job or a check on read).
- Until answered: do not build charge creation or renewal expiry math. Why: a wrong rule here produces wrong balances. Status: Open.

### D9. Staff and owner accounts
- Who creates the owner account and the staff accounts? May the owner open staff screens?
- Proposed for the second question: yes, the owner may.
- Until answered: do not build account creation. Why: the first login path depends on who creates accounts. Status: Open.

### D10. Lockout counters
- The PRD locks a device after five wrong PINs, check in after five wrong codes in an hour, and a staff account after five wrong passwords. Its schema counts wrong tries only for activation codes.
- Until answered: do not add fields or tables for the others. Why: a guessed counter is an unapproved schema change. Status: Open.

### D11. Paused and left members
- May a member whose status is PAUSED or LEFT sign in, check in or pay? The PRD is silent.
- Until answered: ask when you build sign in. Why: the answer changes who can reach their records. Status: Open.

### D12. Display formats
- Proposed: dates with the month spelled out (2 August 2026). Amounts with a thousands comma and the word naira (15,000 naira, which is the PRD's own example).
- Status: Open.

### D13. Log write failure
- If a log write fails, does the member's action fail or carry on? The PRD is silent.
- Until answered: ask when you build the first log write. Why: the wrong choice either blocks members or loses data. Status: Open.

### D14. CI and repo host
- Which service runs the checks in ci.md is not chosen. Neither is where the repository lives.
- Until answered: write and keep the check list in ci.md. Do not add a provider specific configuration file. Why: the checks hold regardless of host, but the file that wires them together does not.
- Status: Open.

### D15. Job run frequency
- The PRD says the payment verify sweep runs after 24 hours, but not how often the job itself is triggered to look for payments that crossed that mark. It gives no schedule for charge creation.
- Until answered: write the logic in jobs.md. Do not deploy or schedule either job. Why: the schedule depends on the host (D4) and, for charges, on the billing period rule (D8).
- Status: Open.