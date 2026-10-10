---
trigger: always_on
---

# commands.md

Job: list the exact commands to run this project and say when a change counts as done.

Status: empty until the project is scaffolded. Do not guess commands. Why: the package manager and script names are not in the PRD.

## Commands
Fill each row when it exists.

| Purpose | Command |
|---|---|
| Install | `npm.cmd install` |
| Run locally | `npm.cmd run dev` |
| Type check | `npx.cmd tsc --noEmit` |
| Lint | `npm.cmd run lint` |
| Test | `npm.cmd run test` |
| Build | `npm.cmd run build` |
| Generate Prisma client | `npx.cmd prisma generate` |
| Create a migration (needs approval) | `npx.cmd prisma migrate dev --name <migration_name>` |
| Apply migrations to the local database (needs approval) | `npx.cmd prisma migrate deploy` |

## Rules
- Use these commands for these jobs. If a row is empty, ask the person. Why: a guessed command may run the wrong script or the wrong package manager.
- Run the two migration rows only after the person approves. Why: AGENTS.md requires it, and a migration changes the database.
- If a row is empty because the project has no such tool yet, ask which one to use. Do not skip that step and do not call the change done. Why: a skipped check is a check that never ran.
- If there is no test runner, adding one needs approval as a package. Why: required-tests.md cannot be met without one.
- A change is done only when type check, lint, tests and build all pass after that change. Why: "it should work" is not evidence.
- State in the response which commands ran and what they returned. If one could not run, say so. Why: the person can only check what is reported.
- Commands that reset or drop data are forbidden, not just unlisted. See boundaries.md. Why: an agent may otherwise treat a missing entry as permission.