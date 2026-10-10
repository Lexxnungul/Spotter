---
trigger: glob
globs: .env, .env.exmaple
---

# env.md

Job: name every environment variable, say who can read it, and say how secrets are handled.

## Rules
- Never commit a file with real values. Commit only `.env.example`, which holds names and no values. Why: a committed key must be treated as leaked.
- Never print, log or paste the value of a secret or a full database address. Why: logs and chat history outlive the session.
- No secret may be readable by browser code. In Next.js, any variable whose name starts with NEXT_PUBLIC_ is sent to every phone. Why: members' phones would carry the payment and model keys.
- Use only the names listed below. To add one, propose the name and its side (server or browser) and wait for approval. Why: agents invent names, and one value then gets two names.
- The person sets real values. Never invent, guess or generate a secret value. Why: a made up key fails silently or gets committed.
- Test and live gateway keys are separate variables. Code never swaps one for the other. Why: test mode moves no money. Live mode moves real money.
- A missing variable stops startup with an error that names it. No silent default. Why: an empty webhook secret would leave payment confirmation unchecked and nobody would notice.

## Approved names
| Name | Side | Used by |
|---|---|---|
| DATABASE_URL | Server only | Prisma datasource. The only name the PRD gives. |

## Secrets the PRD requires, names not yet approved
These are every secret the PRD's flows need. Propose a name for each when you reach it.
- Gateway secret key, and gateway webhook signature secret, each in a test and a live form where the gateway issues both.
- Gemini API key.
- Secret for sealing member and staff sessions.
- (PRD v0.2) Credential for the separate database role used by staff and owner routes. See access.md.