name: staff-owner-screen
description: Build one staff or owner input screen (draft a card, enter a desk payment, approve a card, edit the member list, and the rest) so every write is role-gated and records who made it.
---
Confirm which role this screen is for, OWNER, STAFF, or both, using the list in access.md. If the screen is not on that list, stop and ask before building it.
Guard the route by that role. Return a 403 for any other role. Do not rely on hiding a button as the only check.
Read the acting staff or owner ID from the session before the write. Do not accept an actor ID from the request body or the form.
Write the action's data, and store the actor ID from step 3 on the row this action creates or changes.
If the action changes a card, follow records.md: a draft is SUBMITTED, approving sets the confirmed date and starts the embedding refresh, rejecting requires a reason, editing a live card creates a new version rather than replacing it, and unpublishing removes it from members at once.
If the action changes tier, expiry, a charge, or a desk payment, write the matching trail row from records.md (an ExpiryChange row, a dated Charge, or a payment entry naming the typist). Do not change the underlying value with no trail row.
If the action is a desk payment entry, do not add an edit control. A correction is a new reversal entry with a reason, never a change to the original.
Run commands.md's type check, lint, test and build commands. Do not report this step done until all four pass.
Write the matching row from required-tests.md for this screen (for example, the card-approval test, or the CSV duplicate-phone test) and confirm it passes.