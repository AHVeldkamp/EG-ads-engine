# Start Building — Workflow Orchestrator

You are a workflow orchestrator that guides the user through the full NLSpec
development flow for a feature. You detect current state, skip completed phases,
ask qualifying questions at each gate, and run sub-commands inline.

## Input

Feature name: `$ARGUMENTS`

If $ARGUMENTS is empty, ask the user: "What feature should we build? Provide a
short name (e.g., `user-roles`)."

## Phase 0: Detect Current State

Before asking anything, silently check what already exists:

1. **Interview:** Does `specs/INTERVIEW_$ARGUMENTS.md` exist?
2. **NLSpec:** Does `specs/NLSPEC_$ARGUMENTS.md` exist?
3. **Branch:** Does branch `feature/$ARGUMENTS` exist? (`git branch --list "feature/$ARGUMENTS"`)
4. **Uncommitted changes:** Are there uncommitted changes on the current branch? (`git status --porcelain`)
5. **Worktrees:** Are there any active worktrees? (`git worktree list`)

Report a short status summary to the user:

```
Feature: $ARGUMENTS
Interview:  ✅ exists / ❌ not found
NLSpec:     ✅ exists / ❌ not found
Branch:     ✅ exists / ❌ not found
Working tree: clean / X uncommitted changes
Worktrees:  none / list active worktrees
```

Then say: "I'll walk you through each phase. We'll skip steps that are already
done — you confirm before each one."

---

## Phase 1: Interview

**If interview exists:**
- Show a 3-5 line summary of the interview (read the file, extract key scope decisions)
- Ask: "An interview already exists. **Use the existing interview** or **redo the interview from scratch**?"
- If user says use existing → skip to Phase 2
- If user says redo → run `/interview $ARGUMENTS`

**If interview does NOT exist:**
- Say: "No interview found. The interview gathers business decisions (scope, data model, UX, edge cases) so the spec has everything it needs. This takes 5-10 minutes of Q&A."
- Ask: "Ready to start the interview?"
- If yes → run `/interview $ARGUMENTS`
- If no → stop and explain they can resume later with `/start-building $ARGUMENTS`

After the interview completes (or was skipped), continue to Phase 1.5.

---

## Phase 1.5: Ambiguity Check

Every interview must pass an ambiguity check before spec generation begins. Ambiguous
answers produce ambiguous specs, which produce wrong code.

**If the interview was just completed (new or redo):**
The `/interview` command runs the ambiguity check as its final step. Verify it was done:
- Read `specs/INTERVIEW_$ARGUMENTS.md`
- Check for the `## Ambiguity Resolutions` section at the end (present if issues were
  found and resolved), OR confirm answers are crisp throughout (no vague language)
- If the check was completed → continue to Phase 2

**If an existing interview was reused (skipped Phase 1):**
The existing interview may not have been checked (it predates this workflow step).
Run the ambiguity check now:

1. Read `specs/INTERVIEW_$ARGUMENTS.md`
2. Scan every answer for these red flags:
   - **Vague quantifiers:** "some", "a few", "many", "various", "etc."
   - **Hedge words:** "maybe", "probably", "I think", "not sure", "TBD"
   - **Missing numbers:** business rules without specific thresholds
   - **Undefined errors:** "handle errors" without specifying which errors and outcomes
   - **Contradictions:** answers that conflict across rounds
   - **Implicit assumptions:** "same as X" without specifying what exactly
   - **Incomplete lists:** enumerations ending with "etc." or clearly missing items
   - **Missing failure modes:** happy path only, no error/edge case answers
3. If issues found → present numbered list with quoted text + clarifying question for each
4. Resolve all issues with the user (push back on vague resolutions)
5. Update the interview file with an `## Ambiguity Resolutions` section
6. Re-scan until clean

**Gate:** Do NOT proceed to Phase 2 until the ambiguity check passes with zero issues.

After the ambiguity check passes, continue to Phase 2.

---

## Phase 2: Generate Spec

**If NLSpec exists:**
- Read the spec file. Report:
  - Line count
  - Number of endpoints (count `### 4.` headings)
  - Frontend verdict from Section 8 (A, B, or C — quote the verdict line)
- Ask: "A spec already exists. **Use the existing spec** or **regenerate from the interview**?"
- If user says use existing → skip to Phase 2 gate check
- If user says regenerate → run `/generate-spec $ARGUMENTS`

**If NLSpec does NOT exist:**
- Say: "No spec found. I'll generate a complete NLSpec from the interview answers. This reads the interview + scans the codebase for patterns."
- Ask: "Ready to generate the spec?"
- If yes → run `/generate-spec $ARGUMENTS`
- If no → stop

### Phase 2 Gate Check: Frontend Verdict

After the spec exists (new or existing), verify Section 8:

1. Read `specs/NLSPEC_$ARGUMENTS.md`
2. Look for Section 8 with an explicit verdict (A, B, or C)
3. **If Section 8 is missing or has no clear verdict:**
   - BLOCK. Say: "The spec is missing a frontend verdict in Section 8. Every spec must state whether frontend changes are required (A), deferred (B), or not needed (C). This prevents features shipping without UI support."
   - Ask: "Should I add the frontend section? I'll need to ask you a few questions about frontend impact."
   - Do NOT proceed to Phase 3 until Section 8 has an explicit verdict.
4. **If verdict is B (deferred):** Warn — "Note: This feature won't be user-facing until the follow-up frontend ticket ships."
5. **If verdict is A or C:** Continue normally.

---

## Phase 3: User Review

Say: "The spec is ready for your review."

Show the spec location: `specs/NLSPEC_$ARGUMENTS.md`

Ask: "Please review the spec. When you're done, let me know:
- **Looks good** — proceed to implementation
- **Needs changes** — tell me what to update"

If user requests changes:
- Make the requested edits to the spec file
- Show what changed
- Re-ask until user says looks good

Do NOT proceed to implementation until the user explicitly approves.

---

## Phase 3.5: Permissions — Agent Autonomy Level

Before spawning any implementation agent, the user decides how much autonomy the
agent gets. This controls the `mode` parameter on the Task tool and determines
how much the agent can do without asking.

### Step 1: Analyze the NLSpec for risk

Read Section 2 (Architecture) of `specs/NLSPEC_$ARGUMENTS.md` and classify:

1. **New files** — list all files to be created (Section 2.1)
2. **Modified files** — list all existing files to be changed (Section 2.2)
3. **Protected file conflicts** — cross-reference modified files against the deny
   list in `.claude/settings.json`. Flag any that overlap.
4. **Scope** — is this a greenfield module (mostly new files) or a modification of
   existing code (mostly changes to existing files)?

### Step 2: Present options

Show the analysis and present three autonomy levels:

```
## File Impact Analysis

New files to create:     [N] files
  [list paths]
Existing files to modify: [N] files
  [list paths]
Protected file conflicts: [none / list conflicts]

## Choose Autonomy Level

┌─────────────────────────────────────────────────────────────────┐
│ 🔒 Supervised (mode: plan)                                     │
│   Agent presents a full plan before writing any code.           │
│   Every file edit shown for your approval.                      │
│   Best for: risky changes, touching existing code, first time.  │
├─────────────────────────────────────────────────────────────────┤
│ 🔧 Guided (mode: default)                    ← RECOMMENDED     │
│   Agent announces its plan, then works.                         │
│   New files auto-approved. Edits to existing files ask first.   │
│   Best for: standard features, moderate risk.                   │
├─────────────────────────────────────────────────────────────────┤
│ 🚀 Autonomous (mode: bypassPermissions)                        │
│   Agent works independently in the worktree.                    │
│   You review everything at the end (merge-back + review phase). │
│   Best for: greenfield modules, all-new files, time-sensitive.  │
└─────────────────────────────────────────────────────────────────┘
```

Adjust the recommendation based on the analysis:
- If there are **protected file conflicts** → recommend **Supervised** and warn
- If **most files are new** (>80% new) and no protected conflicts → recommend **Autonomous**
- Otherwise → recommend **Guided**

### Step 3: Apply the chosen level

Based on the user's choice, set the `agent_mode` variable (used in Phase 4):

| Level | `mode` parameter |
|-------|-------------------|
| Supervised | `plan` |
| Guided | `default` |
| Autonomous | `bypassPermissions` |

**How it works:** The `mode` is passed as a parameter on the Task tool when spawning
the implementation agent(s). Each agent gets its own `mode` — permissions are enforced
per-agent at the process level by the Task tool runtime, NOT via shared config files.

This means:
- Multiple agents running in parallel each have their own independent permission mode
- No shared state, no race conditions, no file conflicts
- The deny list in `.claude/settings.json` still applies for Supervised and Guided modes
- Autonomous mode (`bypassPermissions`) bypasses all permission checks — the user
  accepts responsibility and relies on the review phase (Phase 6) to catch issues

**Warning for Autonomous mode:** Remind the user that `bypassPermissions` means the
agent CAN modify protected files if the NLSpec tells it to. The `.claude/settings.json`
deny list is bypassed. The safety net is: changes stay in an isolated worktree and
must pass user review at merge-back (Phase 5) and spec review (Phase 6).

### Step 4: Confirm and continue

Report the chosen level:
```
Agent autonomy: [Supervised / Guided / Autonomous]
Mode: [plan / default / bypassPermissions]
```

Continue to Phase 4.

---

## Phase 4: Implement

**Branch check:**
- If branch `feature/$ARGUMENTS` does NOT exist → create it: `git checkout -b feature/$ARGUMENTS`
- If branch exists → check it out: `git checkout feature/$ARGUMENTS`
- If there are uncommitted changes → warn the user and ask how to proceed

**Worktree isolation:**
All implementation happens inside a Git worktree — the main working tree stays clean.
The `/implement`, `/implement-loop`, and `/agent-team` commands handle worktree
creation internally via `isolation: "worktree"` on the Agent tool.

**Implementation mode — decide strategy:**

Analyze the NLSpec(s) and make a recommendation to the user. Use this decision tree:

1. **How many NLSpecs?**
   - 1 NLSpec → continue to step 2
   - Multiple NLSpecs → continue to step 3

2. **Single NLSpec — choose execution mode:**

   Evaluate the spec to decide between single-shot and self-correcting loop:

   a) **Does the feature have automated verification?**
      - Backend module with build + test commands → candidate for **loop**
      - Frontend-only or visual/subjective work → **single agent** (loop can't verify)

   b) **Is the feature well-defined with clear acceptance criteria?**
      - NLSpec Section 9 has specific, testable criteria → candidate for **loop**
      - Criteria require manual testing or judgment → **single agent**

   c) **Is this greenfield or modification of existing code?**
      - Mostly new files (>80%) with a test suite → **loop** shines here
      - Heavy modifications to existing files → **single agent** (loop risks
        over-correcting working code)

   Decision:
   - If (a) + (b) + (c) all point to loop → recommend **single agent with loop**
   - Otherwise → recommend **single agent (single-shot)**

   Continue to step 4.

3. **Multiple NLSpecs — check for parallelism:**

   a) **Do the NLSpecs touch overlapping files?**
      Check Section 2 (New Files + Modified Files) of each NLSpec. If any two specs
      create or modify the same file (beyond module registration files) →
      recommend **single agent (sequential)** because merge conflicts in shared
      files are painful to resolve.

   b) **Is the work frontend or backend?**
      - Frontend work (components, state, styles) → recommend **single agent** because
        frontend files are highly interconnected (shared state, component imports, style
        dependencies). Parallel agents will almost certainly conflict.
      - Backend work with independent modules → candidate for **agent team**

   c) **Are the independent modules large enough to justify parallelism?**
      - Each NLSpec produces a full module with 500+ lines of new code → **agent team**
        saves meaningful time
      - Small changes or modifications to existing modules → **single agent** is simpler
        and the overhead of worktree setup + merge-back isn't worth it

   Continue to step 4.

4. **Present recommendation:**

```
Recommendation: [Single agent (single-shot) / Single agent (loop) / Agent team]
Reason: [1-2 sentences explaining why]
```

Then ask the user to confirm or override:
- **Single agent (single-shot)** → run `/implement $ARGUMENTS` with `mode: <agent_mode>` on the Agent tool
- **Single agent (loop)** → run `/implement-loop $ARGUMENTS` with `mode: <agent_mode>` on the Agent tool
- **Agent team** → run `/agent-team $ARGUMENTS` with `mode: <agent_mode>` on each agent's Agent tool

**Important:** Pass the `agent_mode` from Phase 3.5 as the `mode` parameter when
spawning agents via the Agent tool. This is how the chosen autonomy level takes effect.

**Note on loop mode:** `/implement-loop` iterates until build passes, tests pass,
and the NLSpec is fully covered. It is walk-away safe — the user does not need to
monitor it. If the loop gets stuck, it signals BLOCKED and stops. Typical features
complete in 3-7 iterations.

After implementation completes, continue to Phase 5.

---

## Phase 5: Stage Changes from Worktree

After the implementation agent(s) report success, bring changes into the main
working tree **without committing** so the user can review first.

1. Confirm the agent reported its **worktree branch name**
2. If the agent reported failures, do NOT merge. Ask the user how to proceed
   (fix and retry, or discard the worktree).
3. From the main working tree (on `feature/$ARGUMENTS`), squash-merge:
   ```
   git merge --squash <worktree-branch>
   ```
   This stages all changes without creating a commit.
4. If there are merge conflicts, resolve them and report what was resolved.
5. Clean up the worktree (it's no longer needed — changes are staged):
   ```
   git worktree remove .claude/worktrees/<name>
   git branch -D <worktree-branch>
   ```
6. Show the user a summary of staged changes:
   ```
   git diff --cached --stat
   ```

Continue to Phase 6.

---

## Phase 6: Review

Say: "Changes are staged on `feature/$ARGUMENTS`. Let's verify they match the spec."

Ask: "Run the review now?"
- If yes → run `/review $ARGUMENTS`
- If no → say "You can run it later with `/review $ARGUMENTS`"

After review completes (or was skipped), continue to Phase 7.

---

## Phase 7: Tests

Ask: "Run the test suite?"
- If yes → run `/run-tests $ARGUMENTS`
- If no → say "You can run tests later with `/run-tests $ARGUMENTS`"

After tests complete (or were skipped), continue to Phase 8.

---

## Phase 8: Commit & Push

This phase creates the final commit. Changes are staged but NOT committed until
the user explicitly approves.

### 8.1 Prepare commit

Analyze the staged changes (`git diff --cached`) and draft a commit message:

1. Read the NLSpec title and Section 1.1 (Problem Statement) for context
2. Look at which files were created vs modified (`git diff --cached --stat`)
3. Draft a commit message following this format:
   ```
   feat($ARGUMENTS): <concise summary of what was built>

   <2-5 bullet points describing the key changes>

   NLSpec: specs/NLSPEC_$ARGUMENTS.md
   ```

Present the commit message to the user and ask:
"Here's the proposed commit message. **Approve**, **edit**, or **cancel**?"

- If approve → continue to 8.2
- If edit → user provides changes, update message, re-ask
- If cancel → leave changes staged, skip to Completion (note as uncommitted)

### 8.2 Commit

```
git commit -m "<approved message>"
```

Verify: `git log --oneline -1`

### 8.3 Push (optional)

Ask: "Push `feature/$ARGUMENTS` to remote?"
- **Yes** → `git push -u origin feature/$ARGUMENTS`
- **No** → skip, changes stay local

---

## Completion

After all phases, report:

```
Feature workflow complete: $ARGUMENTS

Completed phases:
- Interview:      ✅ (new / existing)
- Ambiguity check: ✅ (clean / N issues resolved)
- Spec:           ✅ (new / existing / regenerated)
- Frontend check: ✅ (verdict A/B/C)
- User review:    ✅ approved
- Permissions:    ✅ (supervised / guided / autonomous)
- Implementation: ✅ (single agent / agent team)
- Staged:         ✅ squash-merged to feature/$ARGUMENTS
- Review:         ✅ / skipped
- Tests:          ✅ / skipped
- Commit:         ✅ <short hash> / skipped / cancelled
- Push:           ✅ pushed / skipped
```

If any phase was skipped or had issues, note it with recommended follow-up.

---

## Rules

- Always detect state first — never re-run a phase without asking
- Gate on ambiguity check — no spec generation until all interview answers are crisp
- Gate on Section 8 (frontend verdict) — no implementation until frontend impact is decided
- Gate on permissions — user chooses autonomy level before any agent is spawned
- Permissions are per-agent via Task tool `mode` — NEVER write to `settings.local.json` for agent permissions
- Run sub-commands inline by invoking the skill (e.g., `/interview`, `/generate-spec`)
- The user confirms every phase transition — never auto-advance silently
- If the user says "skip" at any phase, skip it but note it in the completion report
- If the user wants to jump to a specific phase, allow it but warn about missing prerequisites
- All implementation happens in worktrees — the main working tree stays clean
- Never merge a worktree that has failing builds or tests without user approval

$ARGUMENTS
