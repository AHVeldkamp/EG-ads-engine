# Agent Team — Parallel Implementation from NLSpecs

Spawn multiple agents working in parallel, each implementing one feature
from its own NLSpec. Each agent works in its own isolated Git worktree.

## Prerequisites

Each feature listed in $ARGUMENTS MUST have a complete NLSpec at `specs/NLSPEC_[feature_name].md`.

Check all referenced NLSpecs exist before spawning any agents. If ANY is missing, STOP:
"Missing NLSpec for [feature]. Run `/interview [feature]` then `/generate-spec [feature]` first."

## Branch Strategy

Before spawning agents, ensure a feature branch exists:
`git checkout -b feature/agent-team-[short-description]` from `main`.
If it already exists, check it out. Never implement directly on `main`.

## Worktree Isolation

Each agent MUST be spawned with `isolation: "worktree"` via the Task tool.
Additionally, pass the `mode` parameter to control each agent's permission level:
- `mode: "plan"` — Supervised: agent presents plan for approval before writing code
- `mode: "default"` — Guided: agent works normally, edits to existing files prompt for approval
- `mode: "bypassPermissions"` — Autonomous: agent works independently, user reviews at merge-back

The orchestrator (`/start-building`) sets the mode in Phase 3.5. If `/agent-team` is
invoked directly, default to `mode: "default"` (Guided).

Each agent gets its own worktree under `.claude/worktrees/` with its own branch.
Agents cannot interfere with each other or with the main working tree. Permissions
are enforced per-agent — no shared config files are modified.

**Spawn example:**
```
Task tool with:
  isolation: "worktree"
  mode: "default"  ← or "plan" / "bypassPermissions" per Phase 3.5
  subagent_type: "general-purpose"
  prompt: "Implement feature X from specs/NLSPEC_X.md. Read CLAUDE.md first..."
```

## Rules

0. Every agent works in its own worktree — never in the main working tree.
1. Every agent reads CLAUDE.md first.
2. Every agent reads its assigned NLSpec COMPLETELY before writing any code.
3. Every agent reads the exemplar files referenced in its NLSpec Section 6.
4. Agents work on SEPARATE features in SEPARATE directories — no shared file edits
   except module registration files.
5. Only module registration files may be touched by multiple agents — coordinate
   through the lead agent to avoid conflicts.
6. Each agent implements EXACTLY what its NLSpec specifies — no additions, no deviations.
7. Each agent commits its changes and runs build, lint, and test commands before reporting.
8. No modification of protected files (per .claude/settings.json).
9. If the NLSpec is ambiguous, the agent STOPS and asks — does not guess.
10. Each agent reports its **worktree branch name** so the lead can merge.

## Team Structure

One NLSpec = one agent = one worktree = one complete module.

Each agent owns:
- Data model (per NLSpec Section 3)
- Service + Controller/Routes + DTOs (per NLSpec Sections 4-5)
- Module registration (per NLSpec Section 2)
- Tests (per NLSpec Section 9)

## Merge-Back (Lead Agent)

After all agents report success:
1. From the main working tree (on the feature branch), merge each worktree branch
   one at a time: `git merge <worktree-branch>`
2. Resolve any conflicts (typically in module registration files)
3. After all merges, run the full verification suite:
   - `npm run build`
   - `npm run lint`
   - `npm run test`
4. Clean up all worktrees:
   - `git worktree remove .claude/worktrees/<name>` for each
   - `git branch -D <worktree-branch>` for each

## Completion

After merge-back and verification:
1. Report per-feature status: PASS/FAIL with acceptance criteria from NLSpec Section 9
2. Report any merge conflicts and how they were resolved
3. Confirm all worktrees are cleaned up

## NLSpecs to implement:

$ARGUMENTS
