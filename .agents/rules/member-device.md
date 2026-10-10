---
trigger: always_on
---

# member-device.md

Job: control how the member app is built for the member's phone, data bundle and power, including its first screen.

## Delivery
- Ship a web app saved to the home screen, with a web app manifest so the phone can install it. No store app. Why: it costs nothing, needs no store and the home screen needs the manifest.
- First load under 200 KB compressed. First load means every file needed to show the home screen, as the server sends it. Why: members buy small data bundles. The number is a PRD assumption the person has not confirmed.
- No images on member screens. Why: images cost data.
- Serve the app shell (the page, styles and script needed to open the app) through a service worker that answers from cache first. Why: the app must open with no network.
- Send API responses with `Cache-Control: private, max-age=0`. Send card content with `private, max-age=86400`, keyed by card ID and version. Why: private data must not sit in a shared cache, and a new card version must replace the old one.

## First screen
- It is not an empty chat box. From the top: cached status (tier, expiry, days trained this month and balance) with an "as of {time}" line. Then three buttons: Check in, Pay, Ask the desk. Then eight tappable questions: one for each of timetable, prices, rules, access hours, guest policy, and pause and cancellation terms, plus days trained and balance. Then the text box. Why: most visits carry no question, and the status answers many at a glance.
- A tapped card question opens the latest approved card of that type with no embedding call and no model call. Why: it is a plain lookup, so a model call would spend data and quota for nothing.

## Offline and lost power
- With no network the shell and the cached status still load, with the "as of" time. The buttons and the text box say "You need data for this." Asking, checking in, paying and asking the desk each say they need data, in one line. Why: an honest line beats a spinner.
- Never queue a check in to send later. Why: a queued check in would misstate when she was in the gym.
- Keep the cached status in browser storage, encrypted with a key made from her PIN. Check the PIN on the phone when offline. Five wrong offline PINs lock the cache until she signs in online. This is separate from the 30 minute server lock in access.md. Why: the phone may be lost or borrowed, and the cache holds her balance.
- Treat that encryption as a lock against a casual reader only. A four digit PIN allows just 10,000 keys. Why: it must not be described to anyone as strong protection.
- This is a PRD assumption. If it proves too hard, show the cache only inside the ten minute PIN window (access.md). Why: the PRD names that fallback.