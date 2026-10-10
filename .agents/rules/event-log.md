---
trigger: model_decision
---

# event-log.md

Job: list what version one must record so version two is possible. Recording only. Nothing recorded here sends anything.

## Rules
- Record every event below, failures included. Why: version two and the success metrics read from this data. A field missed now cannot be added back for past events.
- Log rows that name a member are private records and follow access.md. Why: they need the same member filter as any other private data.
- What happens when a log write fails is open (decisions.md D13). Do not choose. Why: dropping the row and blocking the member are both wrong in some case.

## Events
| Event | What to record |
|---|---|
| Question | Time, member ID, tier at that moment, question text, router label, whether an answer was found, and the card version that answered |
| Check in | The attendance row is the record. No separate log. |
| Expiry date and every change | An ExpiryChange row: old date, new date, source (gateway, desk or owner correction) and actor |
| Payment attempt | A PaymentAttempt row for every attempt, failures included: state, detail and time |
| Handoff to staff | Member, reason (records silent, never-answer or member asked), staff name and time |
| Wrong answer report | The answer shown, the record shown, an optional note of up to 200 characters, and the source (member or owner sample). A report never changes any record. |
| Desk question (PRD v0.2) | Category (class time, guest, days trained, balance or other), staff member and time. No text and no member. |