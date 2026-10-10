---
trigger: model_decision
---

# ci.md

Job: control what runs automatically on every push and what blocks a merge. commands.md lists commands the agent runs itself and reports on. jobs.md covers scheduled work that runs on a timer, not on a push. This file is neither of those, it is the automatic check on every push.

## Rules
- Every push to a shared branch runs, automatically and without the agent's terminal: install, type check, lint, test and build, using the exact commands in commands.md. Why: a push the agent forgot to check locally still gets checked.
- The required-tests.md suite runs as part of the test step, the never-answer set included. Why: launch depends on that suite passing, not on someone remembering to run it by hand.
- A pull request cannot merge while any check is failing. Why: a red check must stop code from landing, not just warn about it.
- CI runs against a database made fresh for that run, using migrations, never `prisma db push`. It never touches a real database. Why: boundaries.md already forbids commands aimed at a database that is not local, and a shared CI database would let one broken run corrupt the next.
- CI reads secrets only from the host's own secret store, never from a file in the repository. Why: env.md forbids committing real values, and CI must follow the same rule.
- CI does not run the jobs listed in jobs.md. Why: a push and a schedule are different triggers, and mixing them hides which one caused a change.
- Which host runs CI is open (decisions.md D14). Until it is answered, keep this rule list current but do not write a provider specific configuration file. Why: the rules above hold on any host, but the file that wires them together does not.