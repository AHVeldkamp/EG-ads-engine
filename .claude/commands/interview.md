# NLSpec Interview — Gather Requirements for a Feature

You are conducting a structured interview to gather all the business and product
decisions needed to write a complete NLSpec. The user provides product judgment.
You provide technical knowledge from the codebase.

## Your Role
- Ask only questions the user must answer (business rules, scope, UX, edge cases)
- Do NOT ask questions you can answer by reading the codebase (file paths, patterns,
  existing entity structures, module registration)
- After the interview, YOU fill in all technical details by reading the actual codebase

## Interview Process

### Before Starting
1. Read CLAUDE.md for architectural rules
2. Read the feature description provided in $ARGUMENTS
3. Scan the codebase for related existing modules to understand context

### Round 1 — Scope & Purpose
Ask these (adapt to the feature):
- What problem does this solve for users?
- What's IN scope for this version?
- What's explicitly OUT of scope?
- Is this backend-only, frontend-only, or both?

Wait for answers before continuing.

### Round 2 — Data & Rules
- What data does this feature create, read, update, or delete?
- What are the business rules? (ask for specific numbers, not vague language)
- What statuses/states can the data be in?
- How does this relate to existing data?

Wait for answers before continuing.

### Round 3 — User Experience
- What does the user see and do, step by step?
- What happens on success? What does the user see?
- What happens on each kind of failure?
- Are there permission restrictions?

Wait for answers before continuing.

### Round 4 — Integration & Edge Cases
- Does this interact with any external APIs? How exactly?
- What happens when an external service is down?
- Any rate limits, size limits, or performance concerns?

Wait for answers before continuing.

### Round 5 — Frontend Impact (MANDATORY)
- Does this feature require frontend/UI changes for a user to use it?
- If yes: which screens, pages, or components are affected?
- If frontend work is deferred: what is the follow-up ticket, and is the feature usable without it?
- If no frontend changes: confirm — a user can use this feature end-to-end without any UI changes?

Wait for answers before continuing.

### Round 6 — Verification
- How would you manually test this works?
- What's the one thing that would be worst if it broke?
- Any security considerations beyond standard auth?

## After Interview is Complete

1. Save the user's answers to `specs/INTERVIEW_$ARGUMENTS.md`
2. Proceed immediately to the **Ambiguity Check** below.

---

## Ambiguity Check (MANDATORY)

After all interview rounds are complete and answers are saved, perform a thorough
ambiguity analysis BEFORE telling the user the interview is done. This prevents
vague or contradictory answers from poisoning the spec.

### What to scan for

Re-read every answer in `specs/INTERVIEW_$ARGUMENTS.md` and flag ANY of these:

1. **Vague quantifiers** — words like "some", "a few", "many", "several", "various",
   "etc.", "and so on", "multiple". These MUST become exact numbers or exhaustive lists.
2. **Hedge words** — "maybe", "probably", "I think", "possibly", "might", "could",
   "not sure", "TBD", "we'll see". These MUST become firm decisions.
3. **Missing numeric thresholds** — business rules without specific numbers
   (e.g., "limit the number of X" without saying how many).
4. **Undefined behavior** — "it should handle errors" without specifying WHICH errors
   and WHAT happens for each. Every error path needs an explicit outcome.
5. **Contradictions** — answers in one round that conflict with answers in another
   (e.g., Round 1 says "backend only" but Round 3 describes UI interactions).
6. **Implicit assumptions** — answers that assume shared context not captured in the
   interview (e.g., "same as the other feature" without specifying which feature or
   what exactly is the same).
7. **Missing relationships** — references to existing data without specifying the exact
   relationship type (one-to-many, many-to-many, ownership, reference).
8. **Incomplete enumerations** — lists that end with "etc." or clearly have missing
   items (e.g., listing 2 statuses when the described workflow implies 4).
9. **Unclear ownership/lifecycle** — who creates it, who can modify it, when is it
   deleted, what happens to dependent data on deletion.
10. **Missing failure modes** — happy path described but no answer for what happens
    when things go wrong (API failures, invalid input, concurrent modifications).

### How to present findings

If ambiguities are found, present them as a numbered list:

```
## Ambiguity Check — [N] issues found

1. **[Category]** — Round [X], Question: "[original question]"
   > "[quoted ambiguous text from the answer]"
   → Clarification needed: [specific question to resolve this]

2. **[Category]** — Round [X], Question: "[original question]"
   > "[quoted ambiguous text from the answer]"
   → Clarification needed: [specific question to resolve this]

...
```

Then ask: "I found [N] ambiguities that need to be resolved before we can generate
a reliable spec. Let's go through them — you can answer all at once or one by one."

### Resolution process

1. Wait for the user to answer ALL flagged ambiguities
2. For each answer, apply the same quality check — if the resolution itself is vague,
   push back: "That's still ambiguous. Can you give me [a specific number / an exact
   list / a firm yes-or-no]?"
3. Once ALL ambiguities are resolved, update `specs/INTERVIEW_$ARGUMENTS.md`:
   - Add a new section at the end: `## Ambiguity Resolutions`
   - List each resolved item with the original question and the firm answer
4. Re-scan the updated file ONE more time. If new ambiguities surfaced from the
   resolutions, flag those too. Repeat until clean.

### If NO ambiguities found

Say: "Ambiguity check passed — all answers are specific and actionable. The
interview is ready for spec generation."

### Completion

Only after the ambiguity check passes (zero issues remaining), tell the user:
"Interview complete. Run `/generate-spec $ARGUMENTS` to generate the full NLSpec."

---

## Rules
- Group questions into rounds. Ask one round at a time.
- Skip questions that clearly don't apply to this feature.
- Add questions you think of that aren't listed above.
- When the user says "I'm not sure," push for a decision: "Pick one for now — we can change it later. The agent will guess wrong if we leave it ambiguous."
- Use numbers, not adjectives: "How many?" not "a lot?"

Feature to interview about:

$ARGUMENTS
