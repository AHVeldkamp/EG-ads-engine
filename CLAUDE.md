## NLSpec Workflow

This project uses NLSpec (Natural Language Specification) documents as the
single source of truth for feature implementation. Code is derived from specs.

### Getting Started

```
/setup                   → Interactive wizard → configures ARCHITECTURE.md, settings.json, CLAUDE.md
/tutorial                → Guided first feature → runs /start-building with educational commentary
```

### Development Flow

```
/interview [feature]     → Answer business questions → INTERVIEW_[feature].md
                           ↳ Ambiguity check (auto) → resolve vague/contradictory answers
/generate-spec [feature] → Read interview + codebase → NLSPEC_[feature].md
                           ↳ Permissions (user picks autonomy level for agents)
/implement [feature]     → Read NLSpec → build exactly what it says
/review [feature]        → Verify implementation matches NLSpec
```

### Bugfix Flow

```
/bug-interview [bug]  → Gather symptoms         → BUGREPORT_[bug].md
/bug-diagnose [bug]   → Root cause + fix plan    → BUGREPORT_[bug].md (updated)
/bug-fix [bug]        → Implement fix            → Code changes
/bug-verify [bug]     → Verify fix + regressions
/start-bugfix [bug]   → Full orchestrated flow
```

### Rules

0. **Every feature gets its own branch.** Before writing any code, create and check out
   `feature/[feature_name]` branched from `main`. Never implement directly on `main`.
1. **Every new feature starts with an NLSpec.** No implementing from ad-hoc descriptions.
2. **Specs live in `specs/`.** Named `NLSPEC_[feature_name].md`.
3. **The spec is the contract.** Do not add endpoints, fields, or features not in the spec.
4. **When the spec is ambiguous, ask — do not guess.** Wrong guesses compound.
5. **Update the spec when requirements change.** Don't patch code without updating the spec first.
6. **Agent Teams require NLSpecs.** The `/agent-team` command will refuse to run without specs.
7. **Every spec must address frontend impact.** The spec must include either:
   - A full Frontend section (Section 8) detailing components, state, API client changes, and UI behavior, OR
   - An explicit "Frontend: Not required" verdict with justification confirming the feature is usable end-to-end without frontend changes.
   If frontend work is deferred to a follow-up ticket, the spec must name that ticket and mark the current feature as **not user-facing until the frontend ticket ships**.
8. **Every interview must pass an ambiguity check.** After the interview rounds, all
   answers are scanned for vague language, hedge words, missing numbers, contradictions,
   and incomplete enumerations. No spec is generated until every ambiguity is resolved.
9. **User sets agent autonomy before implementation.** Before any agent is spawned, the
   user chooses an autonomy level: Supervised (`plan`), Guided (`default`), or
   Autonomous (`bypassPermissions`). This is passed per-agent via the Task tool `mode`
   parameter — never via shared config files like `settings.local.json`.

### Spec Density Guideline

A good NLSpec is 1/3 to 1/2 the length of the code it produces. For a typical
feature module, expect 500-1000 lines of spec producing 1500-3000 lines of code.

### Worktree Isolation

All implementation work MUST happen in an isolated Git worktree. The main
working tree must stay clean at all times — no in-progress code changes.

**How it works:**
1. A feature branch is created/checked out in the main working tree (e.g. `feature/user-roles`)
2. Implementation happens in a worktree under `.claude/worktrees/`
3. The worktree gets its own branch based on the feature branch
4. When implementation is complete and verified, changes are merged back to the feature branch
5. The worktree and its branch are cleaned up

**Rules:**
- `/implement` — MUST use `isolation: "worktree"` when spawning the implementation agent
- `/agent-team` — each agent MUST get its own worktree via `isolation: "worktree"`
- Never write implementation code directly in the main working tree
- Specs, interviews, and CLAUDE.md edits CAN happen in the main tree (they are not implementation)

**Merge-back workflow:**
After the worktree agent finishes and reports success:
1. Squash-merge into the feature branch (stages changes, does NOT commit):
   `git merge --squash <worktree-branch>`
2. Resolve any conflicts if multiple agents worked in parallel
3. Remove the worktree: `git worktree remove .claude/worktrees/<name>`
4. Delete the orphan branch: `git branch -D <worktree-branch>`
5. User reviews staged changes: `git diff --cached --stat`
6. Only after user approval: commit with a meaningful message and optionally push

**Cleanup stale worktrees:**
If a session crashes or a worktree is abandoned:
```
git worktree list                                    # find stale worktrees
git worktree remove --force .claude/worktrees/<name> # remove it
git branch -D claude/<name>                          # delete orphan branch
```

### Legacy Code Guard

When generating specs (`/generate-spec`) or reading existing code as reference:

1. **Never inherit data schemas from existing code without validation.** Before
   specifying a data format (API payload, flag value, event shape), check: is
   the current format production-quality or a legacy leftover? Signs of legacy code:
   - Formatted display strings where numeric values belong (e.g., `"69.99 €"` instead of `6999`)
   - Missing fields that downstream consumers need
   - Inconsistent schemas between related endpoints
   - Hardcoded presentational concerns in data layers
2. **Cross-reference with the consumer.** If the backend produces a payload, read
   the code that consumes it (frontend, downstream service, SDK). If the consumer
   expects a different format than what the producer sends, the producer is wrong.
3. **Flag explicitly in the spec.** If existing code uses a legacy pattern that must
   be replaced, the spec must call it out: _"Current code uses [X], replace with [Y]
   because [reason]."_ Do not silently propagate legacy patterns by copying them.

### Sufficiency Test

Could a senior developer who has never seen this codebase implement the feature
from only this spec? If they'd need to ask clarifying questions, the spec is not
done yet.

### Project-Specific Rules

- **Protected files (never modify):** `test/` — all test files are off-limits to agents
- **Naming conventions:** kebab-case files, PascalCase classes, camelCase variables/functions
- **Module pattern:** One folder per feature under `src/modules/`, using NestJS module structure
- **External APIs:** Meta Marketing API for campaign management, Google Gemini API for ad creative generation
- **Config:** All API keys and secrets via environment variables (`.env`), never hardcoded
