---
trigger: glob
globs: src/server/jobs/**, src/app/api/jobs/**
---

# jobs.md

Job: list every job that runs on a timer instead of inside a member's request, its trigger, and the rule every job must follow. Work that happens while a member is using the app is covered in payments.md, ai-pipeline.md and records.md, not here.

## Rules
- A job must give the same result whether it runs once or twice for the same target. Why: a retry after a crash, or a host that runs a job late and then again on schedule, must never double a charge or double an expiry change.
- No job sends a message, reminder or notification. Why: AGENTS.md rules out automated messages in version one, and a job is exactly the kind of code that could add one by accident.
- A job's failure is logged and the job does not keep retrying forever on its own. Why: a stuck job that fails silently and forever hides a real problem.
- Where jobs run, and how often each one fires, is open (decisions.md D4 and D15). Until both are answered, write the logic below but do not deploy or schedule it. Why: the host decides whether a job is a queue, a scheduled function or a script.

## Jobs
| Job | What it does | Rule it follows |
|---|---|---|
| Payment verify sweep | Finds every Payment still INITIATED or PENDING more than 24 hours after it started, and makes one verify call to the gateway for each, setting SUCCESS, FAILED or ABANDONED | payments.md |
| Charge creation | Creates a Charge for each ACTIVE member at her tier's fee for her next billing period | records.md, decisions.md D8 |

- The PRD allows exactly one verify call per payment. The sweep must not call verify more than once for the same payment. Why: a repeated call can exceed the gateway's rate limit and the PRD itself only asks for one check.
- Charge creation must not run until decisions.md D8 is answered, since it depends on how a billing period is counted. Why: creating a Charge on the wrong date would create a wrong balance that a member then sees.