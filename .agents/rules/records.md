---
trigger: model_decision
---

# records.md

Job: control how records get into the app and stay true. Wording is in refusals.md. Search and embedding are in ai-pipeline.md. Who may do each action is in access.md.

## Shared cards
- Staff draft. The owner approves. Nothing reaches a member unapproved. Why: the gym answers for every word the app shows.
- A card holds: type, tier, title, a body of at most 600 characters, author, approver and last confirmed date. Staff choose the tier when drafting. An empty body, or one over 600 characters, is refused. Why: every answer shows the date, so it must exist, and short cards keep answers short.
- Approving makes the version live and sets its confirmed date to that moment. Rejecting needs a reason. Why: staff must know what to fix.
- Editing a live card makes a new version. The old version stays live until the new one is approved. Why: a draft must never replace a live card.
- Unpublish takes the card away from members at once. Why: a wrong card does harm every minute it stays. Approval starts the embedding refresh (ai-pipeline.md).
- Reconfirming moves a card's date to now with no text change. Why: the gym can say a card is still true without rewriting it.
- Timetable cards are due every 7 days. All other cards are due every 30 days. An overdue card stays visible with "Not confirmed since {date}. Check with the desk." Why: hiding it would look like a refusal, and showing it as fresh would be false.

## Attendance
- There are two sources: the member's check in with the daily code, and a manual entry by staff when a phone is dead. Each row records its source and, for manual entries, the typist. Why: the owner can see which entries staff typed.
- One record per member per Lagos day, for both sources. A manual entry for a date that already has a check in is refused. A second check in shows "Already checked in at {time}". Why: one record a day keeps days trained honest.
- An expired member's check in is still recorded. Why: it is a fact. Door access is handled outside the app.
- Attendance before the launch date is not in the app. Why: there is no trustworthy record before it.

## Tier, expiry and the member list
- Tier and expiry come from the owner's member list. It holds name, phone, tier, expiry, status (ACTIVE, PAUSED, LEFT), opening balance and an optional email. A CSV import loads all members. A duplicate phone refuses the file and names the row. Why: phone is how staff find a member.
- Every change to tier or expiry writes an ExpiryChange row with its source and actor. Why: the owner can trace any change.
- A paid renewal, by gateway or at the desk, extends expiry by one billing period counted from the later of today (Lagos) and the current expiry. Why: an early renewal keeps her remaining days, and a late one does not backdate. How a period is counted is open (decisions.md D8).

## Charges and balance
- The owner sets a monthly fee per tier. A Charge is created for each ACTIVE member at her tier's fee. PAUSED and LEFT members get none. A fee change affects only later charges. Why: a fee change must not rewrite history. When a Charge is created, and which one an early renewal settles, is open (decisions.md D8).
- The owner enters the opening balance once per member. Why: it carries what she owed before the app existed.
- Balance is never typed. It is the opening balance plus charges minus successful payments. A negative result is a credit. Why: a typed number can disagree with the payments behind it.

## Desk payments
- Each desk entry records member, amount, method (cash, transfer or POS), date and the typist. Why: hand typed entries must be traceable.
- Enter cash and transfers the same day. Why: an unrecorded transfer is the failure this app exists to prevent.
- Entries are never edited. A mistake is fixed with a reversal entry and a reason. Why: an edit hides what was first recorded.
- Gateway payments come from the gateway only. Nobody can edit them. Why: a hand edited online payment would no longer match the gateway's record.
- At closing, staff tap "Today's entries are complete". That sets the ledger date shown as "confirmed by the desk up to {date}". Why: the member sees how fresh her balance is. Where that date is stored is open (decisions.md D7).
- A desk entered renewal extends expiry by the rule above and writes an ExpiryChange row naming the typist. Why: it must leave the same trail as an online renewal.

## Removing a member's data
On request the owner can export or delete one member's data. Deleting removes personal fields and question text. It keeps payment amounts and dates, without her name. Why: the gym still needs its accounts. The PRD does not say what happens to attendance, expiry changes and handoffs, so ask before deciding. This is a starting rule, and a Nigerian lawyer must confirm it (decisions.md D5).