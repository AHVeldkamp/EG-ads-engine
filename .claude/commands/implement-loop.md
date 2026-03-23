# Implement Feature with Self-Correcting Loop

You are implementing a feature from an NLSpec using an iterative, self-correcting
loop. Unlike `/implement` (single-shot), this command loops until the build passes,
tests pass, and the spec is fully covered — or reports a blocker.

## Input
- NLSpec: `specs/NLSPEC_$ARGUMENTS.md`
- If no NLSpec file found, tell the user:
  "No NLSpec found for '$ARGUMENTS'. Run `/interview $ARGUMENTS` first, then `/generate-spec $ARGUMENTS`."

## Process

### Phase A: Setup (runs once)

#### A1: Branch Setup
1. Ensure a feature branch exists and is checked out: `feature/$ARGUMENTS`
   - If it doesn't exist: `git checkout -b feature/$ARGUMENTS`
   - If it exists: `git checkout feature/$ARGUMENTS`
2. Never implement directly on `main`.

#### A2: Worktree Setup
All implementation MUST happen in an isolated Git worktree.

When spawning the implementation agent via the Agent tool, use `isolation: "worktree"`.
Pass the `mode` parameter to control the agent's permission level:
- `mode: "plan"` — Supervised: agent presents plan for approval before writing code
- `mode: "default"` — Guided: agent works normally, edits to existing files prompt for approval
- `mode: "bypassPermissions"` — Autonomous: agent works independently, user reviews at merge-back

If invoked directly (not via `/start-building`), default to `mode: "default"` (Guided).

If you are the implementation agent running inside a worktree, proceed directly
to Phase A3.

#### A3: Read Context
1. Read CLAUDE.md and ARCHITECTURE.md for architectural rules
2. Read the NLSpec completely — all sections — before writing any code
3. Read the exemplar files referenced in Section 6 of the NLSpec

#### A4: Announce Plan
Before writing any code, state:
- New files to create (list with full paths)
- Existing files to modify (list — should be minimal, typically just module registration)
- Which existing module you're using as your structural template
- Confirm you read the "does NOT use" and "do NOT replicate" lists

---

### Phase B: Iterative Implementation

This is the core self-correcting loop. You execute it yourself — no external
plugin needed. The loop is built into this command's protocol.

**Set iteration tracking state:**
- `iteration = 0`
- `max_iterations = 15` (adjust: 8-10 for small features, 20-25 for large)
- `status = "in_progress"`
- `stuck_counter = {}` (tracks repeated failures by error signature)

**On EVERY iteration, follow this exact sequence:**

#### Step 1: Assess Current State
Increment `iteration`. Then check:
- Which files from the plan already exist
- Run build command and capture output (last 30 lines)
- Run test command and capture output (last 50 lines)
- Classify your state:
  - A) Nothing built yet → go to Step 2
  - B) Build fails → go to Step 3
  - C) Build passes, tests fail → go to Step 4
  - D) Build + tests pass → go to Step 5

#### Step 2: Implement (state A only)
Follow NLSpec implementation order:
1. Data model (Section 3.1)
2. Repository / data access layer
3. Register model in module registration file
4. DTOs / request schemas (Section 3.2)
5. Service (Sections 4 + 5)
6. Controller / routes (Section 4)
7. Module registration (Section 2.3)
8. Tests

For frontend-only specs, follow the order in NLSpec Section 8.

Rules:
- Follow NLSpec EXACTLY — no extra endpoints, fields, or features
- Use the project's standard error handling and logging
- Use exemplar files for structural patterns

After implementing, continue to Step 3.

#### Step 3: Fix Build Errors (state B)
- Read the build error output carefully
- Fix ONLY the errors — do not refactor or improve surrounding code
- Re-run the build command
- If build still fails, fix the next error (max 3 fix attempts per step)
- Track the error signature in `stuck_counter` — if same error 3 times, go to Step 7
- If build passes, continue to Step 4

#### Step 4: Fix Test Failures (state C)
- Read the test output carefully
- Distinguish between:
  a) Test failures caused by YOUR code → fix the code (not the test)
  b) Test assertions that are wrong per the spec → fix the test
  c) Pre-existing failures unrelated to this feature → note them, do not fix
- Re-run the test command
- If tests still fail, fix the next failure (max 3 fix attempts per step)
- Track the error signature in `stuck_counter` — if same error 3 times, go to Step 7
- If all tests pass (or only pre-existing failures remain), continue to Step 5

#### Step 5: Self-Review Against Spec
Re-read `specs/NLSPEC_$ARGUMENTS.md` and check:
- [ ] All models from Section 3.1 exist with correct fields and types
- [ ] All endpoints from Section 4 exist with correct routes and methods
- [ ] All business logic from Section 5 is implemented
- [ ] All DTOs from Section 3.2 have correct validators
- [ ] All constraints from Section 7 are respected
- [ ] Tests cover happy path + error cases per Section 9

If ANY checkbox fails → fix it, then loop back to Step 1 (next iteration).
If ALL checkboxes pass → continue to Step 6.

#### Step 6: Final Verification
Run all verification commands in sequence:
- Build command
- Lint command
- Test command

If ALL pass:
  Walk through NLSpec Section 9 (Acceptance Criteria) checkbox by checkbox.
  For each criterion, report: PASS / FAIL / MANUAL.

  If all criteria pass (or are MANUAL only):
    Set `status = "COMPLETE"` → go to Phase C.

  If any criterion fails:
    Fix the issue and loop back to Step 1 (next iteration).

If `iteration >= max_iterations`:
  Set `status = "MAX_ITERATIONS"` → go to Phase C.

#### Step 7: Stuck Detection
If `stuck_counter` shows the SAME error 3 times:
- Document what is blocking you
- List what you tried
- Suggest alternative approaches
- Set `status = "BLOCKED"` → go to Phase C.

Do NOT spin on the same error endlessly.

---

### Phase C: Report Results

#### If COMPLETE:
```
## Implementation Complete — iteration [N] of [max]

### Acceptance Criteria
[For each Section 9 criterion: PASS / FAIL / MANUAL]

### Build Status
- Build: PASS
- Lint: PASS
- Tests: PASS (N pre-existing failures noted)

### Worktree Branch
Branch: [worktree branch name for merge-back]
```

#### If BLOCKED:
```
## Implementation Blocked — iteration [N] of [max]

### Blocker
[What is blocking with full context]

### Completed Successfully
[What WAS completed before getting stuck]

### Attempted Fixes
[What you tried, 3 times each]

### Suggested Next Steps
[Manual fix, spec amendment, or different approach]

### Worktree Branch
Branch: [worktree branch name — partial progress may be mergeable]
```

#### If MAX_ITERATIONS:
```
## Max Iterations Reached — [max] iterations used

### Progress
- Build: PASS / FAIL
- Tests: X passing, Y failing
- Spec coverage: ~N% (estimate based on completed sections)

### Remaining Work
[What still needs to be done]

### Worktree Branch
Branch: [worktree branch name]

### Recommendation
[Increase iterations / manual intervention needed / spec needs amendment]
```

---

## When to Use This vs. `/implement`

| Scenario | Use |
|----------|-----|
| Well-defined backend module (model → controller) | `/implement-loop` |
| Feature with comprehensive test suite | `/implement-loop` |
| Bug fix with reproducible test case | `/implement-loop` |
| Frontend-heavy work (visual/subjective) | `/implement` |
| Exploratory / unclear requirements | `/implement` |
| Part of `/agent-team` parallel work | `/implement` |

## Hard Rules
- Everything from `/implement` Step 6 (Hard Rules) applies
- The loop must be IDEMPOTENT — each iteration assesses state before acting
- Never delete and recreate files that are partially correct — fix them incrementally
- The NLSpec is the contract — if stuck because the spec is ambiguous, BLOCKED is correct
- Max iterations is a SAFETY NET, not a target — most features complete in 3-7 iterations
- Pre-existing test failures are noted but NOT counted against completion

$ARGUMENTS
