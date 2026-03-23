# Start Bugfix — Workflow Orchestrator

You are a workflow orchestrator that guides the user through the full bugfix
flow. You detect current state, skip completed phases, ask qualifying questions
at each gate, and run sub-commands inline.

## Input

Bug name: `$ARGUMENTS`

If $ARGUMENTS is empty, ask the user: "What bug should we fix? Provide a
short name (e.g., `duplicate-entry-race-condition`)."

## Phase 0: Detect Current State

Before asking anything, silently check what already exists:

1. **Bug Report:** Does `specs/BUGREPORT_$ARGUMENTS.md` exist?
2. **Diagnosis:** If report exists, does it have Section 4 (Root Cause)?
3. **Branch:** Which feature branch does this bug belong to? Check the report's
   affected module/ticket reference.
4. **Uncommitted changes:** Are there uncommitted changes? (`git status --porcelain`)
5. **Worktrees:** Are there any active worktrees? (`git worktree list`)

Report a short status summary to the user:

```
Bug: $ARGUMENTS
Bug Report:  ✅ exists / ❌ not found
Diagnosis:   ✅ exists / ❌ not found
Branch:      [branch name] / ❌ not determined
Working tree: clean / X uncommitted changes
Worktrees:   none / list active worktrees
```

Then say: "I'll walk you through each phase. We'll skip steps that are already
done — you confirm before each one."

---

## Phase 1: Bug Interview

**If bug report exists:**
- Show a 3-5 line summary (expected vs actual behavior, affected module, severity)
- Ask: "A bug report already exists. **Use the existing report** or **redo the
  interview from scratch**?"
- If use existing → skip to Phase 2
- If redo → run `/bug-interview $ARGUMENTS`

**If bug report does NOT exist:**
- Say: "No bug report found. The interview gathers symptoms, reproduction steps,
  and context so we can diagnose effectively. This takes a few minutes of Q&A."
- Ask: "Ready to start the interview?"
- If yes → run `/bug-interview $ARGUMENTS`
- If no → stop and explain they can resume later with `/start-bugfix $ARGUMENTS`

After the interview completes (or was skipped), continue to Phase 2.

---

## Phase 2: Diagnosis

**If diagnosis exists (Section 4 in bug report):**
- Read the bug report and show a summary:
  - Root cause (1-2 sentences)
  - Fix plan (which files, what changes)
  - Regression risks
- Ask: "A diagnosis already exists. **Use the existing diagnosis** or **re-diagnose**?"
- If use existing → skip to Phase 3
- If re-diagnose → run `/bug-diagnose $ARGUMENTS`

**If diagnosis does NOT exist:**
- Say: "No diagnosis found. I'll investigate the codebase, trace the code path,
  and identify the root cause."
- Ask: "Ready to start diagnosis?"
- If yes → run `/bug-diagnose $ARGUMENTS`
- If no → stop

**Gate:** After diagnosis exists, ask the user:
"Does the diagnosis look correct? **Approve** to proceed with the fix, or
**revise** if the root cause is wrong."

Do NOT proceed to Phase 3 until the user explicitly approves the diagnosis.

---

## Phase 3: Permissions

Before spawning the fix agent, the user chooses autonomy level.

For bugfixes, present a simplified choice:

```
## Choose Autonomy Level

┌─────────────────────────────────────────────────────────────────┐
│ 🔒 Supervised (mode: plan)                                     │
│   Agent shows the fix plan before writing code.                │
│   Best for: risky fixes, touching critical paths.              │
├─────────────────────────────────────────────────────────────────┤
│ 🔧 Guided (mode: default)                    ← RECOMMENDED    │
│   Agent follows the fix plan, asks before editing files.       │
│   Best for: most bugfixes.                                     │
├─────────────────────────────────────────────────────────────────┤
│ 🚀 Autonomous (mode: bypassPermissions)                       │
│   Agent works independently. You review at merge-back.         │
│   Best for: simple, isolated fixes.                            │
└─────────────────────────────────────────────────────────────────┘
```

Default recommendation: **Guided** for bugfixes (the fix plan is already
approved, so the agent just needs to execute it).

Set the `agent_mode` variable based on user choice.

---

## Phase 4: Fix

### Branch Check
Determine the correct branch for this bug:
- Read the bug report's affected module/ticket reference
- If a feature branch exists for this bug, switch to it
- If the feature branch doesn't exist, ask the user which branch to use
- If there are uncommitted changes, warn the user and ask how to proceed

### Run Fix
Spawn the fix agent with worktree isolation:
- Use `isolation: "worktree"` on the Agent tool
- Pass `mode: <agent_mode>` from Phase 3
- The agent runs `/bug-fix $ARGUMENTS`

After the fix agent reports, continue to Phase 5.

---

## Phase 5: Stage + Verify

### Stage Changes
1. Confirm the fix agent reported its **worktree branch name**
2. If the agent reported failures, do NOT merge. Ask the user how to proceed.
3. From the main working tree, squash-merge:
   ```
   git merge --squash <worktree-branch>
   ```
4. If there are merge conflicts, resolve them and report.
5. Clean up the worktree:
   ```
   git worktree remove .claude/worktrees/<name>
   git branch -D <worktree-branch>
   ```
6. Show staged changes:
   ```
   git diff --cached --stat
   ```

### Verify
Run `/bug-verify $ARGUMENTS` to verify the fix.

Run build + lint + tests:
```bash
npm run build
npm run lint
npm run test
```

After verification, continue to Phase 6.

---

## Phase 6: Commit & Push

### 6.1 Prepare commit

Analyze the staged changes and draft a commit message:

1. Read the bug report title and root cause for context
2. Look at which files were modified (`git diff --cached --stat`)
3. Draft a commit message following this format:
   ```
   fix([module]): <concise description of what was fixed>

   Root cause: <1-sentence root cause>
   Bug report: specs/BUGREPORT_$ARGUMENTS.md
   ```

Present the commit message to the user and ask:
"Here's the proposed commit message. **Approve**, **edit**, or **cancel**?"

- If approve → continue to 6.2
- If edit → user provides changes, update message, re-ask
- If cancel → leave changes staged, skip to Completion (note as uncommitted)

### 6.2 Commit

```
git commit -m "<approved message>"
```

Verify: `git log --oneline -1`

### 6.3 Push (optional)

Ask: "Push to remote?"
- **Yes** → `git push -u origin <current-branch>`
- **No** → skip, changes stay local

---

## Completion

After all phases, report:

```
Bugfix workflow complete: $ARGUMENTS

Completed phases:
- Bug Report:    ✅ (new / existing)
- Diagnosis:     ✅ (new / existing)
- Approval:      ✅ user approved diagnosis
- Permissions:   ✅ (supervised / guided / autonomous)
- Fix:           ✅ implemented in worktree
- Staged:        ✅ squash-merged
- Verification:  ✅ / ❌ [details]
- Commit:        ✅ <short hash> / skipped / cancelled
- Push:          ✅ pushed / skipped
```

If any phase was skipped or had issues, note it with recommended follow-up.

---

## Rules

- Always detect state first — never re-run a phase without asking
- Gate on diagnosis approval — no fix without user-approved root cause
- The user confirms every phase transition — never auto-advance silently
- If the user says "skip" at any phase, skip it but note it in the completion report
- If the user wants to jump to a specific phase, allow it but warn about missing prerequisites
- All fix implementation happens in worktrees — the main working tree stays clean
- Never merge a worktree that has failing builds or tests without user approval
- Bug fixes go on the existing feature branch, not a new branch
- Minimal changes only — no refactoring, no improvements beyond the fix

$ARGUMENTS
