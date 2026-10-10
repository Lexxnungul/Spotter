name: shared-answer-or-refusal
description: Wire one shared card type into retrieval and grounding, or one never-answer category into its fixed refusal, so every path is checked the same way.
---
Decide whether this is a shared card type or a never-answer category. Confirm it is on the list in refusals.md or named in ai-pipeline.md. If it is not, stop and ask before continuing.
If this is a shared card type: confirm the router sends a SHARED question to the retrieval step in ai-pipeline.md, filtering by tier before ranking, and taking the top 3 cards.
Apply the similarity bands from ai-pipeline.md in order: 0.70 or higher writes a sentence, 0.60 up to 0.70 shows the closest card with no sentence, below 0.60 goes to the records-silent answer.
Check the model's answer before showing it: the cited card ID must be one of the 3 sent, and every digit and time in the answer must appear in that card's text exactly as written. If either check fails, drop the sentence and show the card alone. Do not call the model a second time.
If this is a never-answer category: add its exact sentence from the table in refusals.md, then the handoff step from the same file. Do not write a new sentence for it.
If the category is REFUND, WAIVER, DISCOUNT, or CANCELLATION, confirm a plain question about the terms still reads the matching card, while a request to act (get, waive, discount, or cancel) is refused. Every other never-answer category is refused outright with no card path.
Write the never-answer test rows from required-tests.md for this category: at least five questions, including any trick question named in that file, and confirm every one is refused with no private data and no card answer.
If this is a shared card type, write the grounding test from required-tests.md: confirm an answer with numbers that do not match its card is replaced by the card alone, and an instruction hidden in the card is not obeyed.
Run commands.md's type check, lint, test and build commands. Do not report this step done until all four pass.