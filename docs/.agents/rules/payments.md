---
trigger: glob
globs: src/server/payment/**, src/server/api/payment/**
---

# payments.md

Job: control how a member pays through the gateway. Desk payments are in records.md.

## Ground rules
- The gateway is Flutterwave (decisions.md D1). Do not copy gateway details from the PRD. Its route names, signature check, verify call and fee figures were written for another gateway. Ask the person for the Flutterwave details and record them in decisions.md. Why: a detail copied from the wrong gateway fails silently or charges the wrong amount.
- The member pays on the gateway's own page. The app never sees or stores card details and never holds money. Money settles in the gym's own account. Why: the PRD has no wallet and no stored balance.
- The server sets the amount. The member cannot type one. She can renew at her tier's fee, read from Setting, or pay her balance when it is above zero. Why: a typed amount can be changed.
- Money is stored as kobo (schema.md). Convert to the gateway's unit in one function, and check that unit in the gateway's docs. Why: the PRD flow assumed a gateway that takes kobo. A wrong unit charges the wrong amount by a factor of 100.
- Do not use the PRD's fee figures. Confirm Flutterwave's live fee and record it. Test mode is free. Until the gym decides, the member sees the plain fee with no surcharge line (decisions.md D5). Why: the fee sits on top of every renewal, so a wrong figure is a wrong price.

## States
The states are INITIATED, PENDING, SUCCESS, FAILED and ABANDONED.
- Only the gateway's webhook moves a payment to SUCCESS. The page she returns to, and anything in its address, is never trusted. Why: the member controls her own browser.
- On a webhook, check the signature. Then check that the reference and amount match the Payment row. Reject any mismatch. Why: a forged or altered message must change nothing.
- If the payment is already SUCCESS, a repeated webhook changes nothing. Why: gateways resend.
- On SUCCESS for a renewal, mark the payment and extend expiry in one database transaction (rule in records.md). Why: a half finished step would take her money and leave her without access.

## Repeat taps
- (PRD v0.2) The server issues the idempotency key, not the browser. When the Pay screen loads, look for an open payment (INITIATED or PENDING) for the same member and purpose created in the last 30 minutes. If one exists, reuse its key and reference. Why: a key made in the browser is lost on reload and allows a second charge.
- While an open payment is under 30 minutes old, disable Pay and show "A payment is waiting. Do not pay again." After 30 minutes she may start again. Why: this stops double payment without trapping her.
- When she returns from the gateway, show "Checking your payment" and set PENDING. Why: she sees progress while the webhook is awaited.

## Slow or lost confirmation
- If the phone loses network mid payment, do nothing special. The webhook still lands. On reopen, show "Payment received" or "Waiting for the bank". Why: the state lives on the server, not on the phone.
- If no webhook arrives in 24 hours, make one verify call to the gateway. Then set SUCCESS, FAILED or ABANDONED. Why: a lost webhook must not leave a payment pending forever. This needs a scheduler, so do not build it until hosting is decided (decisions.md D4).

## Double payment and receipts
- A second SUCCESS for the same purpose within 24 hours is recorded as a credit and shown as a credit. Why: the money arrived and cannot be ignored.
- The receipt is a text page: gym name, member name, amount, date, method and reference. It appears in her payment history. Why: she needs proof she paid, which is what the PRD's failure scene lacked.
- If the gateway cannot be reached, show "We could not start the payment. You have not been charged. Try again or pay at the desk." If a payment fails, show "The payment did not go through. You have not been charged." Why: her first fear is a charge with no receipt.