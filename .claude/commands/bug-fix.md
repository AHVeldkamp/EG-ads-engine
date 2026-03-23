# Bug Fix — Implement the Fix

You are implementing a bug fix from a diagnosed bug report. The report contains
the root cause analysis and an exact fix plan — your job is to execute it
precisely with minimal changes.

## Input
- Bug report: `specs/BUGREPORT_$ARGUMENTS.md`
- If no bug report exists, tell the user:
  "No bug report found for '$ARGUMENTS'. Run `/bug-interview $ARGUMENTS` first."
- If the bug report has no Root Cause or Fix Plan sections, tell the user:
  "Bug report exists but hasn't been diagnosed. Run `/bug-diagnose $ARGUMENTS` first."

## Process

### Step 1: Read Bug Report
Read `specs/BUGREPORT_$ARGUMENTS.md` completely. Verify:
- Sections 4-7 exist (Root Cause, Fix Plan, Regression Risks, Verification Steps)
- Status says "Diagnosed — Awaiting Fix Approval"
- If status is not "Diagnosed", warn the user and ask whether to proceed

### Step 2: Read Context
1. Read CLAUDE.md and ARCHITECTURE.md for architectural rules
2. Read all files listed in the Fix Plan
3. Read any files referenced in the Root Cause analysis

### Step 3: Announce Changes
Before writing any code, state:
- Files to modify (list with full paths, from Fix Plan)
- What changes in each file (summary from Fix Plan)
- Confirm this matches the approved fix plan

### Step 4: Implement Fix
Follow the Fix Plan exactly:
- Make ONLY the changes specified in the plan
- No refactoring, no improvements, no cleanup
- No "while I'm here" changes
- If a test needs updating or adding, do that too (as specified in the plan)

### Step 5: Verify
1. Run build command — fix any compilation errors caused by the change
2. Run lint command — fix any lint violations caused by the change
3. Run test command — fix any test failures caused by the change

### Step 6: Report
Report results:

```
## Bug Fix Results: $ARGUMENTS

### Changes Made
| File | Change | Status |
|------|--------|--------|
| [path] | [what changed] | ✅ Done |

### Verification
- Build: ✅ PASS / ❌ FAIL
- Lint:  ✅ PASS / ❌ FAIL
- Tests: ✅ PASS / ❌ FAIL

### Fix Plan Compliance
- All planned changes implemented: ✅ / ❌
- No unplanned changes: ✅ / ❌
- Minimal change principle: ✅ / ❌

### Worktree Branch
Branch: [worktree branch name for merge-back]
```

If anything failed, explain what went wrong and whether it's related to the fix
or a pre-existing issue.

Include the **worktree branch name** in your report so the orchestrator can
merge it back.

---

## Rules
- Follow the Fix Plan EXACTLY — do not add, remove, or change anything beyond the plan
- Minimal changes only — if you see other issues in the code, note them but do NOT fix them
- If the fix plan is incomplete or wrong, STOP and tell the user instead of improvising
- If the fix requires changes not in the plan, STOP and ask the user
- All changes must pass build + lint + tests before reporting success
- Never modify files not listed in the fix plan without explicit approval

Bug to fix:

$ARGUMENTS
