# Implement Feature from NLSpec

You are implementing a feature from a complete NLSpec. The spec contains every
decision — your job is to execute it exactly, not to make product choices.

## Input
- NLSpec: `specs/NLSPEC_$ARGUMENTS.md`
- If no NLSpec file found, tell the user:
  "No NLSpec found for '$ARGUMENTS'. Run `/interview $ARGUMENTS` first, then `/generate-spec $ARGUMENTS`."

## Process

### Step 0: Branch Setup
1. Ensure a feature branch exists and is checked out: `feature/$ARGUMENTS`
   - If it doesn't exist: `git checkout -b feature/$ARGUMENTS`
   - If it exists: `git checkout feature/$ARGUMENTS`
2. Never implement directly on `main`.

### Step 1: Worktree Setup
All implementation MUST happen in an isolated Git worktree.

When spawning the implementation agent via the Task tool, use `isolation: "worktree"`.
Additionally, pass the `mode` parameter to control the agent's permission level:
- `mode: "plan"` — Supervised: agent presents plan for approval before writing code
- `mode: "default"` — Guided: agent works normally, edits to existing files prompt for approval
- `mode: "bypassPermissions"` — Autonomous: agent works independently, user reviews at merge-back

The orchestrator (`/start-building`) sets the mode in Phase 3.5. If `/implement` is
invoked directly (not via the orchestrator), default to `mode: "default"` (Guided).

This creates a worktree under `.claude/worktrees/` with its own branch based on the
current feature branch. The agent works entirely inside the worktree — the main
working tree stays untouched.

If you are the implementation agent running inside a worktree, proceed directly to
Step 2.

### Step 2: Read Context
1. Read CLAUDE.md and ARCHITECTURE.md for architectural rules
2. Read the NLSpec completely — all sections — before writing any code
3. Read the exemplar files referenced in Section 6 of the NLSpec

### Step 3: Announce Plan
Before writing any code, state:
- New files to create (list with full paths)
- Existing files to modify (list — should be minimal, typically just module registration)
- Which existing module you're using as your structural template
- Confirm you read the "does NOT use" and "do NOT replicate" lists

### Step 4: Implement (in this exact order)
Follow the implementation order defined in the NLSpec Section 2. Typically:
1. **Data Model** — match NLSpec Section 3.1 exactly
2. **Repository / Data Access** — match existing patterns
3. **Register** model in the appropriate module registration file
4. **DTOs / Request Schemas** — match NLSpec Section 3.2
5. **Service** — match NLSpec Sections 4 + 5
6. **Controller / Routes** — match NLSpec Section 4
7. **Module Registration** — register per NLSpec Section 2.3
8. **Tests** — per NLSpec Section 9

For frontend-only specs, follow the order defined in the NLSpec Section 8 instead.

### Step 5: Commit in Worktree
After implementation is complete, commit all changes inside the worktree:
- Stage only the files you created or modified
- Use a descriptive commit message referencing the feature name
- Do NOT push — the orchestrator will merge the worktree branch back

### Step 6: Hard Rules
- Follow the NLSpec EXACTLY — do not add endpoints, fields, or features not in the spec
- Do not deviate from file paths in the spec
- When the spec says "do NOT", treat it as a hard constraint
- If the spec is ambiguous on any point, STOP and ask — do not guess
- Use the exemplar files for structural patterns (imports, decorators, DI style)
- Use the project's standard error handling (see ARCHITECTURE.md)
- Use the project's standard logging — never console.log / print

### Step 7: Verify
1. Run the project's build command — fix any compilation errors
2. Run the project's lint command — fix any new lint violations
3. Run the project's test command — fix any test failures
4. Walk through NLSpec Section 9 (Acceptance Criteria) checkbox by checkbox

### Step 8: Report
For each acceptance criterion from Section 9, report:
- ✅ PASS — with brief evidence
- ❌ FAIL — with what went wrong
- ⚠️  MANUAL — cannot verify automatically, needs manual testing

List any spec ambiguities you encountered and how you resolved them.

Include the **worktree branch name** in your report so the orchestrator can merge it.

$ARGUMENTS
