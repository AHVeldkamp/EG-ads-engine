# Setup Wizard — Project Configuration

You are a setup wizard that configures the NLSpec workflow for a new project.
You guide the user through interactive phases — detecting existing state, asking
questions, and auto-filling configuration files. Follow the same orchestrator
pattern as `/start-building`: phased, with state detection, gates, and user
confirmation at each step.

---

## Phase 0: Prerequisites Check

Before anything else, verify the environment is ready. Check each item and build
a status dashboard:

1. **Git repo:** Run `git rev-parse --is-inside-work-tree 2>/dev/null`
   - If NOT a git repo → explain: "NLSpec uses Git branches and worktrees to
     keep your main code safe during implementation. We need a git repo."
   - Ask: "Want me to run `git init` to initialize one?"
   - If user says yes → run `git init`
   - If no → stop and explain they need to init git first

2. **Command files:** Check if `.claude/commands/` exists and contains the NLSpec
   command files (interview.md, generate-spec.md, implement.md, etc.)
   - Use `ls .claude/commands/` to check
   - If missing or incomplete → STOP. Say:
     "The NLSpec command files weren't copied correctly. From the nlspec-product
     folder, run:
     ```
     cp -r nlspec-product/.claude/ .claude/
     ```
     Then run `/setup` again."

3. **CLAUDE.md:** Does `CLAUDE.md` exist in the project root?
   - If missing → same copy instructions as above

4. **ARCHITECTURE.md:** Does `ARCHITECTURE.md` exist in the project root?
   - If missing → same copy instructions as above

5. **specs/ directory:** Does `specs/` exist?
   - If missing → create it: `mkdir -p specs`

6. **Example spec:** Does `specs/NLSPEC_example.md` exist?
   - If missing → warn but don't block (it's nice-to-have)

Report status dashboard:

```
📋 Prerequisites Check

Git repo:        ✅ initialized / ❌ not found
Command files:   ✅ found ([N] commands) / ❌ missing
CLAUDE.md:       ✅ found / ❌ missing
ARCHITECTURE.md: ✅ found / ❌ missing
specs/:          ✅ found / 🔧 created
Example spec:    ✅ found / ⚠️ missing (optional)
```

**Gate:** All items except example spec must be ✅ before continuing. If any are
❌, show fix instructions and stop.

Say: "Prerequisites look good! Now let's configure the workflow for your project.
I'll ask about your tech stack, project structure, and patterns — then auto-fill
your configuration files."

---

## Phase 1: Project Profile (Tech Stack)

Use `AskUserQuestion` for each question. Present contextual options based on
previous answers.

### 1.1 Runtime

Ask: "What runtime does your project use?"
Options: Node.js, Python, Go, Rust
(User can always pick "Other" and type their own)

Store the answer as `RUNTIME`.

### 1.2 Framework

Based on `RUNTIME`, ask with contextual options:

- **Node.js** → Express, Fastify, NestJS, Hono
- **Python** → Django, FastAPI, Flask, Starlette
- **Go** → Gin, Echo, Chi, stdlib net/http
- **Rust** → Axum, Actix-web, Rocket, Warp
- **Other** → free text

Store as `FRAMEWORK`.

### 1.3 Database

Ask: "What database do you use?"
Options: PostgreSQL, MySQL, SQLite, MongoDB
(Other = free text, "None" is also valid)

Store as `DATABASE`.

### 1.4 ORM / Query Layer

Based on `RUNTIME` + `DATABASE`, ask with contextual options:

- **Node.js + SQL** → Prisma, TypeORM, Drizzle, Knex
- **Node.js + MongoDB** → Mongoose, Prisma
- **Python + SQL** → SQLAlchemy, Django ORM, Tortoise, Peewee
- **Python + MongoDB** → Motor, MongoEngine, Beanie
- **Go + SQL** → GORM, sqlx, Ent, sqlc
- **Go + MongoDB** → mongo-driver
- **Rust + SQL** → Diesel, SQLx, SeaORM
- **Rust + MongoDB** → mongodb crate
- **None (no DB)** → skip, set to "N/A"

Store as `ORM`.

### 1.5 Frontend

Ask: "What frontend framework do you use (if any)?"
Options: React, Vue, Svelte, Next.js
("None (API only)" is a valid answer, Other = free text)

Store as `FRONTEND`. If "None" → set to `None (API only)`.

### 1.6 Testing Framework

Based on `RUNTIME`, ask with contextual options:

- **Node.js** → Jest, Vitest, Mocha, Node test runner
- **Python** → pytest, unittest, Django test
- **Go** → Go test (built-in), testify
- **Rust** → cargo test (built-in), nextest

Store as `TEST_FRAMEWORK`.

### Summary

After all questions, display:

```
📦 Tech Stack Profile

Runtime:    [RUNTIME]
Framework:  [FRAMEWORK]
Database:   [DATABASE]
ORM:        [ORM]
Frontend:   [FRONTEND]
Testing:    [TEST_FRAMEWORK]
```

Ask: "Does this look right?" If no → let user correct individual items.

---

## Phase 2: Project Structure

### 2.1 Source Directory

Ask: "What is your main source code directory?"
Options based on `RUNTIME`:
- **Node.js** → src/, app/, lib/
- **Python** → src/, app/, [project_name]/
- **Go** → cmd/, internal/, pkg/
- **Rust** → src/

Store as `SOURCE_DIR`.

### 2.2 Subdirectories

Ask (multi-select or free text): "What subdirectories do you use inside `[SOURCE_DIR]`?"

Suggest common patterns based on `FRAMEWORK`:
- Models/entities directory → store as `MODELS_DIR`
- Services/business logic directory → store as `SERVICES_DIR`
- Controllers/routes directory → store as `CONTROLLERS_DIR`
- Middleware directory → store as `MIDDLEWARE_DIR`
- Config directory → store as `CONFIG_DIR`

If the user says "I don't have these yet" → use sensible defaults based on
framework conventions and note them as suggestions.

### 2.3 Test and Frontend Directories

Ask: "Where do your tests live?" → store as `TEST_DIR`
(Common: `tests/`, `test/`, `__tests__/`, `src/**/*.test.*`)

If `FRONTEND` is not "None":
Ask: "Where does your frontend code live?" → store as `FRONTEND_DIR`
(Common: `frontend/`, `client/`, `web/`, `src/components/`)

### 2.4 Build, Test, and Lint Commands

Ask each separately:

1. "What is your **build** command?" → store as `BUILD_COMMAND`
   Suggest based on runtime:
   - Node.js: `npm run build`, `yarn build`, `pnpm build`
   - Python: `python -m build`, or "N/A" for interpreted
   - Go: `go build ./...`
   - Rust: `cargo build`

2. "What is your **test** command?" → store as `TEST_COMMAND`
   Suggest based on test framework.

3. "What is your **lint** command?" → store as `LINT_COMMAND`
   Suggest based on runtime:
   - Node.js: `npm run lint`, `npx eslint .`
   - Python: `ruff check .`, `flake8`
   - Go: `golangci-lint run`
   - Rust: `cargo clippy`

4. "How do you run tests for a **single feature/module**?" → store as `TEST_SINGLE_COMMAND`
   Suggest based on test framework:
   - Jest: `npx jest --testPathPattern="feature"`
   - pytest: `pytest tests/feature/`
   - Go: `go test ./internal/feature/...`
   - Rust: `cargo test feature`

### 2.5 Exemplar Module

Ask: "Is there an existing module in your project that represents the 'ideal'
pattern? (e.g., a well-structured feature with model, service, controller, tests)
If so, name it. If not, type 'none'."

Store as `EXEMPLAR_MODULE`.

---

## Phase 3: Project Patterns

### 3.1 Authentication

Ask: "How does authentication work in your project?"
Options: JWT tokens, Session-based, API keys, OAuth, No auth yet

Store as `AUTH_PATTERN`. Ask for a brief description (1-2 sentences) of how it
works. Store as `AUTH_DESCRIPTION`.

### 3.2 Error Handling

Ask: "How do you handle errors?"
Options:
- Framework's built-in exceptions (e.g., NestJS HttpException, Django exceptions)
- Custom error/exception classes
- Error middleware with status codes
- Result types (Go/Rust style)

Store as `ERROR_PATTERN`. Ask for brief description. Store as `ERROR_DESCRIPTION`.

### 3.3 Multi-Tenancy

Ask: "Is your application multi-tenant?"
Options: Yes, No

If yes → ask: "How is tenant isolation implemented?"
Options:
- Row-level (tenant_id column on every table)
- Schema-level (separate schema per tenant)
- Database-level (separate database per tenant)

Store as `MULTI_TENANT` (yes/no) and `TENANT_STRATEGY` (if yes).

### 3.4 Protected Files

Ask: "Are there files that agents should NEVER modify? (e.g., core auth module,
payment processing, database migrations, CI config)"

Let the user list file paths or patterns. Store as `PROTECTED_FILES` (array).

If user says "none" → store empty array.

---

## Phase 4: Configure Files

Now auto-fill all configuration files using the collected answers. Show the user
what you're writing to each file and ask for confirmation.

### 4.1 ARCHITECTURE.md

Read the current `ARCHITECTURE.md`. Replace all `[YOUR_*]` placeholders:

| Placeholder | Value |
|-------------|-------|
| `[YOUR_PROJECT]` | Project directory name (from `basename $(pwd)`) |
| `[YOUR_RUNTIME]` | `RUNTIME` |
| `[YOUR_FRAMEWORK]` | `FRAMEWORK` |
| `[YOUR_DATABASE]` | `DATABASE` |
| `[YOUR_ORM]` | `ORM` |
| `[YOUR_FRONTEND]` | `FRONTEND` |
| `[YOUR_TEST_FRAMEWORK]` | `TEST_FRAMEWORK` |
| `[YOUR_SOURCE_DIR]` | `SOURCE_DIR` |
| `[YOUR_MODELS_DIR]` | `MODELS_DIR` |
| `[YOUR_SERVICES_DIR]` | `SERVICES_DIR` |
| `[YOUR_CONTROLLERS_DIR]` | `CONTROLLERS_DIR` |
| `[YOUR_MIDDLEWARE_DIR]` | `MIDDLEWARE_DIR` |
| `[YOUR_CONFIG_DIR]` | `CONFIG_DIR` |
| `[YOUR_TEST_DIR]` | `TEST_DIR` |
| `[YOUR_FRONTEND_DIR]` | `FRONTEND_DIR` (or remove line if "None") |
| `[YOUR_FEATURE_DIR]` | Derive from `SOURCE_DIR` + module convention |
| `[YOUR_BUILD_COMMAND]` | `BUILD_COMMAND` |
| `[YOUR_LINT_COMMAND]` | `LINT_COMMAND` |
| `[YOUR_TEST_COMMAND]` | `TEST_COMMAND` |
| `[YOUR_TEST_SINGLE_COMMAND]` | `TEST_SINGLE_COMMAND` |
| `[YOUR_EXEMPLAR_MODULE]` | `EXEMPLAR_MODULE` (or "None yet — first feature will establish the pattern") |

Also fill in the Patterns sections:
- **Authentication & Authorization** → `AUTH_DESCRIPTION`
- **Error Handling** → `ERROR_DESCRIPTION`
- **Multi-Tenancy** → `TENANT_STRATEGY` or "Not applicable"
- **Protected Files** → list from `PROTECTED_FILES`

For **Logging** and **Module Registration** — if you can infer from the framework
(e.g., NestJS has module registration, Express doesn't), fill in a sensible
default. Otherwise write "TODO: Fill in after establishing the pattern."

For **Conventions** — add sensible defaults based on the framework's standard
conventions (e.g., camelCase for Node.js, snake_case for Python).

Replace file extension placeholders `[ext]` in the Module Structure section with
the correct extension for the runtime (`.ts`, `.py`, `.go`, `.rs`).

Show the user the complete updated ARCHITECTURE.md content. Ask: "Does this
look right? I can adjust anything."

### 4.2 .claude/settings.json

Read the current `.claude/settings.json`. Replace placeholders and add
project-specific rules:

1. Replace `[YOUR_BUILD_COMMAND]` → `BUILD_COMMAND`
2. Replace `[YOUR_TEST_COMMAND]` → `TEST_COMMAND`
3. Replace `[YOUR_LINT_COMMAND]` → `LINT_COMMAND`

4. For each path in `PROTECTED_FILES`, add deny rules:
   - `Write([path])` for exact files
   - `Write([pattern])` for glob patterns

5. Add any runtime-specific safe commands to the allow list. For example:
   - Python: `Bash(python *)`
   - Go: `Bash(go build*), Bash(go test*)`
   - Rust: `Bash(cargo build*), Bash(cargo test*), Bash(cargo clippy*)`

Show the user the complete updated settings.json. Ask: "Does this look right?"

### 4.3 CLAUDE.md (append project-specific rules)

If the user specified protected files or has strong conventions, append to
CLAUDE.md under a new section:

```markdown
### Project-Specific Rules

- **Protected files (never modify):** [list from PROTECTED_FILES]
- **Naming conventions:** [inferred from runtime/framework]
- [Any other project-specific rules from the interview]
```

Only add this section if there are project-specific rules to add. Don't add
boilerplate.

Show the user what will be appended. Ask for confirmation.

---

## Phase 5: Validation

Verify the configuration is complete and working:

### 5.1 Placeholder check

Run: `grep -r '\[YOUR_' ARCHITECTURE.md .claude/settings.json CLAUDE.md 2>/dev/null`

- If any `[YOUR_*]` placeholders remain → list them and fix interactively
- If clean → report "No remaining placeholders"

### 5.2 Build command test (non-blocking)

If `BUILD_COMMAND` is not "N/A":
- Say: "Let me test your build command..."
- Run the build command
- If it succeeds → "Build passes!"
- If it fails → "Build failed — this might be expected if the project isn't set
  up yet. You can fix this later. Moving on."

Do NOT block on build failure.

### 5.3 Directory check

Verify `specs/` exists. Verify `specs/NLSPEC_example.md` exists (warn if not).

### 5.4 Report

```
✅ Validation Results

Placeholders: all replaced
Build command: ✅ passes / ⚠️ failed (non-blocking) / ⏭ skipped (N/A)
specs/ directory: ✅ exists
Example spec: ✅ exists / ⚠️ missing
```

---

## Phase 6: Summary + Next Steps

Show completion dashboard:

```
🎉 Setup Complete!

Your NLSpec workflow is configured for:
  Runtime:    [RUNTIME]
  Framework:  [FRAMEWORK]
  Database:   [DATABASE]

Files configured:
  ✅ ARCHITECTURE.md — project architecture reference
  ✅ .claude/settings.json — permissions and commands
  ✅ CLAUDE.md — project rules [+ project-specific rules]

What you can do now:

  /start-building [feature]   Build your first feature (full guided flow)
  /tutorial                   Guided walkthrough with educational commentary
  /interview [feature]        Just the interview phase
  /start-bugfix [bug]         Fix a bug with the full workflow

💡 Recommended: Run /tutorial to walk through your first feature
   with explanations at every step.
```

Ask: "Want to run `/tutorial` now for a guided first feature?"
- If yes → run `/tutorial`
- If no → "You're all set! Run `/start-building [feature]` whenever you're ready."

---

## Rules

- Always detect existing state before making changes
- Never overwrite user-customized content without asking
- Show the user what you're writing BEFORE writing it
- If a phase fails, don't block the entire wizard — skip and note it
- Use `AskUserQuestion` for all questions (never raw text prompts)
- Offer contextual options based on previous answers (don't ask about Django ORM if runtime is Node.js)
- The user confirms every file write — never auto-save silently

$ARGUMENTS
