name: scheduled-job
description: Write the logic for one job on the jobs.md list (the payment verify sweep or charge creation) so it gives the same result if it runs twice and never sends a message.
---
Confirm the job is on the list in jobs.md. If it is not, stop and ask before writing it.
If the job is charge creation, confirm decisions.md D8 has been answered before writing the date logic. If it has not, stop here.
Write the job as one pure function that takes the current time and produces the same result each time it is given the same input. Do not read or write anything the function does not need.
Before the function changes any row, have it check whether that change was already made for this target. If it was, skip the write and end without error.
If the job is the payment verify sweep, call the gateway's verify endpoint at most once per payment per run, following payments.md's webhook and state rules for what the result can change.
Confirm the function sends no message, reminder, or notification of any kind. If a step would send one, stop and ask.
Wrap the function so that a failure is logged with the target it failed on, and the job does not retry on its own after that. Do not add a retry loop.
Write the required test from required-tests.md proving the job is safe to run twice for the same target.
Run commands.md's type check, lint, test and build commands. Do not report this step done until all four pass.
Do not deploy or schedule this job. Confirm decisions.md D4 and D15 are both answered before that step, and stop here until they are.