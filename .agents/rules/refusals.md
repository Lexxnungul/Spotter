---
trigger: model_decision
---

# refusals.md

Job: fix what the app says when it cannot or must not answer, who it hands the member to, and the exact words of its fixed answers. The model never writes these words.

## Never-answer categories
Refuse these even when a matching record exists. Why: a record existing does not make the answer safe or the gym's to give.

| Category | Example | Refusal sentence |
|---|---|---|
| OTHER_MEMBER | "Did Tunde come Monday?" | "I cannot share anything about other members." |
| MEDICAL | "My knee hurts, what should I do?" | "I cannot give medical advice." |
| DOOR_STATUS | "Will the door open now?" | "I cannot tell whether the door is open right now." |
| REFUND | "Give me my money back" | "Refunds are decided by the desk." |
| WAIVER | "Waive my late fee" | "Waivers are decided by the desk." |
| DISCOUNT | "Can I get a discount?" | "Discounts are decided by the desk." |
| CANCELLATION | "Cancel my membership" | "Cancellations are handled by the desk." |
| STAFF_CONDUCT | "The trainer was rude" | "Complaints about staff go to the owner through the desk." |

- Give the sentence of the category the router chose, then hand off. Why: a short refusal is clear, and the handoff is her next step.
- For REFUND, WAIVER, DISCOUNT and CANCELLATION only: a question about what the terms are is answered from the card if one exists. A request to get, waive or cancel is refused. The PRD gives one example, "What are the cancellation terms?". The other four categories are always refused. Why: terms are shared records. Decisions belong to staff.
- A model that is unsure returns UNKNOWN. UNKNOWN gets the records silent answer, which also hands off. Why: an unsure guess must never become an answer.

## Records silent
- Say: "The gym's records do not have that." Then hand off. Use it when no allowed card clears the threshold, the router returns UNKNOWN, or the model returns found false. Why: the app never fills a gap with general knowledge.
- A card her tier does not allow counts as no card. Why: the PRD gives her this same answer, so the app does not confirm the card exists.
- For attendance and balance with no rows, use the fixed answers below, not this sentence (decisions.md D6). Why: the specific answers say more than a generic refusal.

## Handoff
- The staff member on duty is the one who most recently tapped "I am on duty". Why: one person answers at a time.
- Offer a WhatsApp link (wa.me) to that person's number, pre-filled with the first word of her full name and her question. Why: one tap reaches a human.
- The link never holds a balance, attendance figure or other private record. Why: the message leaves the app and sits in a chat.
- Read desk hours from Setting, in Lagos time. When the desk is closed say: "The desk is closed. {Name} opens at {time}." {Name} is the person on duty and {time} is the next opening time (decisions.md D5). Why: she knows when to expect a reply.
- If no one is on duty, name the owner. The owner's WhatsApp number is a required setting. Why: she must always reach a person.
- If WhatsApp is not installed, show the number so she can copy it. Why: the link fails without the app.

## Answer shape
Every answer shows: the answer in two sentences at most, the record underneath, the date it was last confirmed, and a "Wrong? Tell the gym" button. The button takes an optional note of up to 200 characters. Why: the member can check the answer herself, and wrong answers reach the owner.

## Fixed private answers
```text
ATTENDANCE_FOUND:
Our records show {count} training days in {month_name}: {date_list}.
Confirmed by the desk up to {ledger_date}.

ATTENDANCE_NONE:
Our records show no check ins in {month_name}.
Our records start on {launch_date}.

BALANCE_OUTSTANDING:
Our records show {amount} naira outstanding as of {ledger_date}.
Payments on record: {date} {amount} {method}; ...

BALANCE_ZERO:
Our records show nothing outstanding as of {ledger_date}.

BALANCE_CREDIT:
Our records show a credit of {amount} naira as of {ledger_date}.

PROFILE:
Our records show {tier}, expiry {expiry_date}.
```
- Database values fill the templates. The model never writes a sentence that holds a naira amount, a date or a count from a private record. Why: it makes "reported, never ruled on" testable.
- Never write "you owe", "you must pay" or "you are late" in any answer. Why: the app reports what the gym's records show. It does not rule on what a person owes.
- Attendance answers list the actual dates. Balance answers list each payment with date, amount and method. Why: the member can check the numbers herself.
- Payments are applied to the oldest charge first for display only. The total never changes. The opening balance shows as "Balance brought forward". Why: months read more easily, and the total must stay true.
- Show dates with the month spelled out and amounts with a thousands comma, for example 2 August 2026 and 15,000 naira (decisions.md D12). Why: 02/08 can be read as 2 August or 8 February.
- Where the launch date and ledger date come from is open (decisions.md D7).