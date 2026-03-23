# Bug Diagnose — Root Cause Analysis

You are investigating a bug to find its root cause and produce an exact fix plan.
You read the bug report, trace the relevant code paths, and diagnose the issue.

## Input
- Bug report: `specs/BUGREPORT_$ARGUMENTS.md`
- If no bug report exists, tell the user:
  "No bug report found for '$ARGUMENTS'. Run `/bug-interview $ARGUMENTS` first."

## Process

### Step 1: Read Bug Report
Read `specs/BUGREPORT_$ARGUMENTS.md` completely. Understand:
- Expected vs actual behavior
- Exact reproduction steps
- Affected module/layer
- When it started (if known)

### Step 2: Identify Relevant Files
From the bug report context, identify all files that could be involved:
- The module mentioned in the report
- Related models, services, controllers, components
- Any files mentioned in error messages or stack traces
- Configuration files that might affect behavior

List all files you plan to read before reading them.

### Step 3: Read All Relevant Source Files
Read every file identified in Step 2. Do not skip files — incomplete context
leads to wrong diagnoses.

### Step 4: Trace the Code Path
Follow the exact path described in the reproduction steps:
1. Start at the entry point (API endpoint, UI action, SDK call)
2. Trace through each layer (controller → service → data access → model)
3. Identify where expected behavior diverges from actual behavior
4. Look for:
   - Logic errors (wrong condition, missing check, incorrect calculation)
   - Data flow issues (wrong field, missing transformation, type mismatch)
   - Race conditions (async operations, missing awaits, concurrent access)
   - Missing error handling (unhandled edge cases, swallowed errors)
   - Configuration issues (wrong env var, missing registration, bad import)

### Step 5: Identify Root Cause
State the root cause clearly:
- **What** is wrong (the specific code/logic issue)
- **Where** it is (exact file + line or function)
- **Why** it causes the observed behavior (connect the dots)
- **When** it was introduced (if identifiable from git history)

### Step 6: Design Fix Plan
Propose an exact fix plan:
- Which files to change (full paths)
- What to change in each file (specific, line-level description)
- Why this fixes the root cause (not just the symptom)
- Whether any tests need to be added or updated

The fix must be **minimal** — no refactoring, no improvements, no "while I'm
here" changes. Just fix the bug.

### Step 7: Identify Regression Risks
What could this fix break?
- Other code paths that touch the same logic
- Edge cases that might be affected
- External integrations that depend on current (buggy) behavior

### Step 8: Define Verification Steps
How to confirm the fix works:
1. Steps to reproduce the original bug (should now pass)
2. Related scenarios that should still work (regression check)
3. Build/lint/test expectations

### Step 9: Update Bug Report
Add the following sections to `specs/BUGREPORT_$ARGUMENTS.md`:

```markdown

## 4. Root Cause

### What
[The specific code/logic issue]

### Where
[Exact file path + function/line]

### Why
[How this causes the observed behavior]

### When Introduced
[Commit/change that introduced it, or "unknown"]

## 5. Fix Plan

### Changes
| File | Change | Reason |
|------|--------|--------|
| [full path] | [specific change] | [why this fixes it] |
| ... | ... | ... |

### Tests
[New tests to add, or existing tests to update, or "existing tests cover this"]

## 6. Regression Risks
- [Risk 1]
- [Risk 2]
- [or "Low — change is isolated to [module]"]

## 7. Verification Steps
1. [Reproduce original bug — should now work correctly]
2. [Related scenario 1 — should still work]
3. [Related scenario 2 — should still work]
4. Build passes
5. Lint passes
6. Tests pass
```

Update the status line at the top of the file:
```
# Status: Diagnosed — Awaiting Fix Approval
```

### Step 10: Present Diagnosis to User
Present a summary:
- **Root cause** (1-2 sentences)
- **Fix plan** (which files, what changes)
- **Regression risk** (low / medium / high)
- **Verification steps** (how to confirm)

Then ask: "Does this diagnosis look correct? **Approve** to proceed with the fix,
or **revise** if the root cause is wrong."

**Gate:** Do NOT proceed to implementation until the user approves the diagnosis.

After user approval, tell them:
"Diagnosis approved. Run `/bug-fix $ARGUMENTS` to implement the fix."

---

## Rules
- Read ALL relevant code before diagnosing — don't guess from file names
- The root cause must explain ALL symptoms, not just some
- The fix must be minimal — address only the root cause
- If you find multiple issues, list them all but prioritize the one causing the
  reported symptoms
- If you cannot determine the root cause with confidence, say so and list what
  you've ruled out. Ask the user for more information rather than guessing.
- Never propose a fix that changes behavior beyond what's needed to resolve the bug

Bug to diagnose:

$ARGUMENTS
