name: member-screen
description: Build one member-facing screen (the home screen or one of the five member features) so it matches the tier, caching, offline, and answer-shape rules every time.
---
Confirm which private reads this screen needs, and build or reuse the matching function from the private-member-read skill. Do not query private data directly from this screen.
Read the member's effective tier from the session before fetching anything for this screen. Do not fetch a card or a private record before this step.
If the screen shows a card, filter it by the tier from step 2 before it reaches the member. Do not fetch a card the tier does not allow and hide it in the interface.
Set the response caching header for this screen's data. Use private, max-age=0 unless the data is card content, which uses private, max-age=86400 keyed by card ID and version.
Confirm the screen shows no image. If the design calls for one, stop and ask before adding it.
Write the offline state for this screen: with no network, show the cached status with its "as of" time, and show "You need data for this." for any action that needs network. Do not show a blank screen or a spinner with no message.
If this screen is the home screen, build it in this order top to bottom: cached status with its "as of" time, the three buttons (Check in, Pay, Ask the desk), the eight tappable questions, then the text box. Do not reorder these.
If this screen produces an answer, shape it as: the answer in two sentences at most, the record underneath, the date it was last confirmed, and a "Wrong? Tell the gym" button. Do not skip any of the four parts.
Measure the first load for this screen. Confirm it is under 200 KB compressed. If it is not, remove weight before continuing.
Write the device test from required-tests.md for this screen: in airplane mode, confirm the cached status still shows with its "as of" time.
Run commands.md's type check, lint, test and build commands. Do not report this step done until all four pass.