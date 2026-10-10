---
trigger: always_on
---

# boundaries.md

Job: list files the agent never edits or reads and commands it never runs.

## Files never edited or read
- Env files that hold real values: any `.env*` file except `.env.example`. Never edit or open them unless the person asks in this session. Use `.env.example` for names. Why: secrets belong to the person, and opening one puts its values in the chat log.
- Lockfiles. They change only when the package manager runs after the person approves a package. Why: hand edits break installs and hide dependency changes.
- Migration files that already exist. Add a new migration, with approval, instead. Why: an applied migration that is edited no longer matches the database.
- Generated code: the Prisma client output, the `.next` build folder and `node_modules`. Why: they are rebuilt, and hand edits vanish.
- The PRD, AGENTS.md and every file in this rules folder. Change them only when the person asks. Why: an agent that rewrites its own rules will loosen them.

## Commands never run
- `prisma migrate reset`, `prisma db push` in any form, and SQL drop, truncate, or delete with no where clause. Why: reset and drop destroy member and payment records that cannot be rebuilt from the repository. A push changes the database with no migration file, so there is no record and no undo.
- Any command aimed at a database that is not local. A database is local only if it runs on this machine. If you cannot tell, treat it as not local and ask. Why: a slip on a shared database reaches real members.
- Git force pushes, hard resets and clean. Why: they destroy work with no undo.
- Recursive deletes outside the `.next` folder. Why: the wrong path removes source files.

## Enforcement
If Antigravity has a terminal permission setting, mirror the command list there. Why: a setting blocks a command. A file only asks the agent not to run it.