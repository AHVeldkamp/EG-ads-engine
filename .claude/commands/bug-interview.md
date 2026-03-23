# Bug Interview — Gather Symptoms for a Bug

You are conducting a structured interview to gather all the information needed
to diagnose and fix a bug. The user provides symptoms and context. You ask
focused questions to ensure the bug is well-understood before diagnosis.

## Your Role
- Ask only questions the user must answer (symptoms, reproduction steps, context)
- Do NOT investigate the codebase yet — that happens in `/bug-diagnose`
- Focus on getting concrete, specific information

## Interview Process

### Before Starting
1. Read CLAUDE.md for project conventions
2. Parse the bug name from $ARGUMENTS

### Round 1 — Symptoms & Reproduction
Ask these (adapt to the bug):
- What's the **expected** behavior?
- What's the **actual** behavior?
- **Steps to reproduce** (exact steps, be specific)
- How often does this happen? (always / intermittent / specific conditions)
- Any error messages, stack traces, or screenshots?

Wait for answers before continuing.

### Round 2 — Context
- Which feature/module is affected? (link to ticket/spec if known)
- Is this frontend, backend, or a combination?
- When did it start? (after which change/commit, if known)
- Does it affect all users or specific ones?
- Any related bugs noticed?

Wait for answers before continuing.

### Round 3 — Impact
- What's the severity? (blocking / degraded / cosmetic)
- Is there a workaround?
- How urgent is the fix?

Wait for answers before continuing.

## After Interview is Complete

1. Proceed immediately to the **Completeness Check** below.

---

## Completeness Check (MANDATORY)

After all interview rounds are complete, verify the answers are actionable
BEFORE saving the bug report. Bugs need concrete information, not vague
descriptions.

### What to check

Re-read every answer and flag ANY of these:

1. **Vague reproduction steps** — "sometimes it breaks", "it doesn't work",
   "when I click around". Steps must be exact: step 1, step 2, step 3.
2. **Vague expected/actual** — "it doesn't work right", "it should be better".
   Both must describe specific observable behavior.
3. **Missing affected module** — the bug must be associated with at least one
   module, feature, or area of the codebase.
4. **Missing severity** — blocking vs degraded vs cosmetic must be decided.
5. **Contradictions** — answers that conflict across rounds (e.g., "backend only"
   in Round 2 but describes a UI problem in Round 1).
6. **Implicit assumptions** — references to behavior without specifying which
   feature, which page, which endpoint.

### How to present findings

If issues are found, present them as a numbered list:

```
## Completeness Check — [N] issues found

1. **[Category]** — Round [X]
   > "[quoted vague text from the answer]"
   → Clarification needed: [specific question to resolve this]

2. ...
```

Then ask: "I found [N] items that need clarification before we can diagnose
effectively. Please clarify these."

### Resolution process

1. Wait for the user to answer all flagged items
2. If a resolution is still vague, push back: "That's still vague. Can you give
   me [exact steps / specific behavior / a concrete example]?"
3. Once all items are resolved, proceed to saving

### If NO issues found

Say: "Completeness check passed — all answers are specific and actionable."

---

## Save Bug Report

After the completeness check passes, save the bug report:

**File:** `specs/BUGREPORT_$ARGUMENTS.md`

```markdown
# Bug Report: [bug_name]
# Date: [today]
# Status: Symptoms Gathered — Awaiting Diagnosis

## 1. Symptoms

### Expected Behavior
[From Round 1]

### Actual Behavior
[From Round 1]

### Steps to Reproduce
1. [step 1]
2. [step 2]
3. [step 3]

### Frequency
[always / intermittent / specific conditions]

### Error Messages / Stack Traces
[From Round 1, or "None observed"]

## 2. Context

### Affected Module
[From Round 2 — feature name, ticket reference]

### Layer
[frontend / backend / combination]

### When It Started
[From Round 2 — after which change, or "unknown"]

### Scope
[all users / specific conditions]

### Related Issues
[From Round 2, or "None known"]

## 3. Impact

### Severity
[blocking / degraded / cosmetic]

### Workaround
[From Round 3, or "None"]

### Urgency
[From Round 3]
```

After saving, tell the user:
"Bug report saved to `specs/BUGREPORT_$ARGUMENTS.md`. Run `/bug-diagnose $ARGUMENTS`
to investigate the root cause and generate a fix plan."

---

## Rules
- Group questions into rounds. Ask one round at a time.
- Skip questions that clearly don't apply to this bug.
- Add questions you think of that aren't listed above.
- When the user says "I'm not sure," push for specifics: "Can you describe
  exactly what you see on screen / in the logs / in the response?"
- No codebase investigation at this stage — save that for `/bug-diagnose`

Bug to interview about:

$ARGUMENTS
