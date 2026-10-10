---
trigger: model_decision
description: Read this only when on check-ins : the daily code, attendance records, opening.
---

# access.md

Job: control who can see and do what. This covers how private data is reached, every credential, staff and owner roles, and effective tier. AGENTS.md states the top rule about member ID. This file says how it is enforced.

## Reaching private data
- Read private models only through repository functions. Each takes a member ID as a required argument with no default. Why: code that leaves it out does not compile.
- No route, page or component queries a private model directly, with the client or with raw SQL. Why: one unguarded query breaks the guarantee.
- Every request checks the device token against the Device table and rejects a revoked device. Why: a replaced or stolen phone must lose access.
- (PRD v0.2) Every private table has row level security on. Its policy matches the row's member column to a member ID set for the request. Set that value inside the same transaction as the query. Why: a forgotten filter in code fails open. A database policy fails closed. Exact statements are in PRD Section 8.7.
- PaymentAttempt has no member column (schema.md). Its policy must check the member on its Payment row. Why: otherwise the policy has nothing to match.
- Every new private table gets its policy in the same migration. Why: a table without one is silently unprotected.
- Staff and owner routes read across members, so they use a separate database role that skips the policy. Only server code uses it. Its credential never reaches the browser. Why: members must never hold a role that can read everyone.

## Member credentials
- Activation code: six digits, issued by desk staff, single use, valid 24 hours, locked after five wrong tries, stored hashed. A new code voids older unused ones for that member. Why: the desk is the trusted place to hand out access. Text message codes cost money per message.
- Before linking a phone, show the data notice and store the consent time. Why: the PRD ties member data to the Nigeria Data Protection Act 2023, and the stored time is proof she agreed.
- PIN: four digits, typed twice, stored as a salted hash, never in plain text. Five wrong tries lock that device for 30 minutes. A forgotten PIN needs a fresh activation code from the desk. Why: the PIN guards a phone that may be lost or borrowed, and no text message reset exists.
- Ask for the PIN after ten minutes away. The linked device stays signed in for 30 days. Why: a stranger holding her phone must not see her balance, but she should not need a desk code every week.
- One device per member. Linking a new device revokes the old one, and re-linking needs a fresh code. Why: one login must not be shared.
- Daily check in code: four digits, set by staff each morning, valid for that Lagos day only, stored hashed. There is one code per date. Setting it again replaces it and records the actor. Why: the desk may mistype it. Five wrong codes in an hour lock check in for that member for one hour. The code is on the whiteboard, so only someone in the building can enter it. A member can still photograph and share it, and version one has no location check.
- Every lockout above needs a counter that survives a server restart. The PRD schema stores one only for activation codes. Do not add fields for the others until decisions.md D10 is answered. Why: a counter held in memory resets on restart, which lets a guesser keep going.
- Every lockout message tells the member when the desk is open. Why: the desk is her only way back in.
- Whether PAUSED or LEFT members may sign in is open (decisions.md D11).

## Staff and owner
- Email and password, hashed with bcrypt. Five wrong passwords lock the account for 15 minutes. Roles are OWNER and STAFF. Why: the lock slows password guessing, and these are the only two roles the PRD names.
- (PRD v0.2) Sessions use iron-session, a sealed cookie library. Why: hosted auth free plans cap monthly users, and the library the first draft named is discontinued.
- Owner only: approve, reject, unpublish and reconfirm cards, the member list and CSV import, fees and settings, the weekly review page, export of all data, and export or deletion of one member's data. Why: these decide what members see and what the gym owes.
- Staff screens: draft cards, daily code, activation codes, manual check in, on duty, desk question taps. Whether the owner may open them is open (decisions.md D9). Proposed: yes. Why: the owner is accountable for the desk.
- Desk payment entry is open to both roles. Why: the PRD lists it under both.
- A STAFF session calling an owner route gets a 403. Why: hiding a button is not access control.
- Every write by staff or owner records the actor. Why: desk entries are typed by hand and must be traceable.
- Who creates the owner and staff accounts is open (decisions.md D9).

## Effective tier
- Work it out on the server on every request. Never store it as a flag and never take it from the client. Why: it changes with time and with a pending payment.
- A Basic member is Basic. A Premium member is Premium until the end of the Lagos day that falls three days after her expiry date, or while she has a renewal payment in INITIATED or PENDING created less than 24 hours ago. Otherwise she is Basic. Why: a pending payment must never count as expiry.
- Basic sees timetable, prices, rules, access hours, guest policy, and pause and cancellation terms. Premium adds training plans and trainer guidance. Why: Basic seeing the terms is a PRD assumption (decisions.md D5).
- Losing Premium removes Premium cards only. She keeps her history, receipts, timetable, price list and the Pay button. Why: she must still see what she paid and be able to renew.
- Apply the tier before any card is fetched. Premium card text must never reach a Basic member's device. Why: hiding it in the screen is not gating.