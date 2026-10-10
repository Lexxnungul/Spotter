name: private-member-read
description: Add a repository function that reads one member's own private data (attendance, balance, tier, expiry, payment history), protected two ways and tested before it is used.
---
Confirm which model you are reading from is on the private list in schema.md. If it is not there, stop and ask before writing anything.
Write one repository function for this read. Give it a memberId parameter with no default value. Do not write the query anywhere else.
Inside the function, open a database transaction. Inside that same transaction, set the row-level security session value to memberId, then run the query. Do not query outside a transaction.
Do not add a where clause that repeats the member filter by hand. The row-level security policy is the second check. The memberId parameter is the first.
Call this function only from server code. Do not call it from a client component or an API route that skips it.
Run the build-time scan from required-tests.md. Confirm it passes for this new function.
Write the isolation test from required-tests.md: call the function with one member's session and another member's memberId, and confirm no row of the second member returns.
Write the row-level security test from required-tests.md: call the function with the row-level security session value set to one member, and confirm the query returns no rows for any other member even if the memberId parameter check is bypassed.
Run commands.md's type check, lint, test and build commands. Do not report this step done until all four pass.