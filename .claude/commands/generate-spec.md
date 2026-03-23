# Generate NLSpec from Interview Answers

You are generating a complete NLSpec from interview answers and codebase analysis.
The NLSpec must be detailed enough that a DIFFERENT agent could implement the feature
without asking any clarifying questions.

## Input
- Interview answers: `specs/INTERVIEW_$ARGUMENTS.md`
- If no interview file exists, check if $ARGUMENTS points to another spec/interview file
- If nothing found, tell the user: "No interview found for '$ARGUMENTS'. Run `/interview $ARGUMENTS` first."

## Process

### Step 1: Read Interview Answers
Read the interview file to understand all business/product decisions.

**Ambiguity gate:** Before proceeding, verify the interview has passed its ambiguity
check. Look for EITHER:
- An `## Ambiguity Resolutions` section at the end (issues were found and resolved), OR
- Crisp, specific answers throughout (no vague quantifiers, hedge words, or TBDs)

If you find unresolved ambiguities (vague language, "TBD", "not sure", "maybe",
incomplete lists ending in "etc."), STOP and tell the user:
"The interview contains unresolved ambiguities that will produce a flawed spec.
Run `/interview $ARGUMENTS` to complete the ambiguity check first, or resolve
these issues now: [list the specific ambiguities found]."

### Step 2: Read Architectural Rules
Read CLAUDE.md and ARCHITECTURE.md for patterns and conventions.

### Step 3: Scan Codebase for Patterns
Read existing source files to understand current patterns. Look for:
- The most similar existing module for structure reference
- Base classes or abstract classes that new code should extend
- How modules are registered and wired together
- Controller/route patterns (auth, validation, decorators)
- Service patterns (error handling, dependency injection)

Adapt the paths below to your project's actual structure:
- `src/modules/*/` — pick the most similar module for reference
- `src/modules/*/*.service.ts` — pick one service for pattern reference
- `src/modules/*/*.controller.ts` — controller/route pattern (auth, validation)
- Module registration files — how new modules get wired in

### Step 3.5: External API Documentation
If the interview mentions external service interactions, look up current
documentation BEFORE writing the spec. Do NOT rely on training data for
external API details.

For each external service referenced in the interview:
- Verify the API endpoints/mutations described actually exist
- Check correct parameters, payloads, and response shapes
- Note any rate limits, constraints, or deprecated patterns

If you cannot verify documentation for a referenced service, note in the spec
that the API details should be manually verified.

### Step 4: Generate NLSpec

Produce a complete NLSpec following this structure. Every section is mandatory
unless the interview explicitly excludes it (e.g., "no frontend" means skip Section 8).

---

# NLSpec: [Feature Name]
# Version: 1.0
# Date: [today]
# Source: specs/INTERVIEW_[name].md

## 1. Context
### 1.1 Problem Statement
[From interview Round 1]

### 1.2 Prior Art
[YOU find this by scanning the codebase — what existing code relates?]

### 1.3 Scope
**IN scope:** [From interview]
**OUT of scope — do NOT implement:** [From interview. Be exhaustive.]

## 2. Architecture
### 2.1 New Files
[Full paths — YOU determine from codebase conventions]
```
src/modules/[feature]/[feature].entity.ts
src/modules/[feature]/[feature].service.ts
src/modules/[feature]/[feature].controller.ts
src/modules/[feature]/[feature].dto.ts
src/modules/[feature]/[feature].module.ts
```

### 2.2 Modified Files
[Full paths + exact changes — typically just module registration]

### 2.3 Module Registration
[Show exact code with correct import paths — copy from existing modules]

### 2.4 Dependencies
**Uses:** [list with explanation]
**Does NOT use:** [explicit exclusions — prevents agent from importing wrong modules]

## 3. Data Model
### 3.1 Entity / Model
[Full model definition matching existing patterns EXACTLY.
 Every field: name, type, constraints, default, comment.]

### 3.2 DTOs / Request Schemas
[With validation rules matching existing patterns]

### 3.3 Enums / Constants
[Exhaustive values.]

## 4. API Endpoints
[For EACH endpoint:]
### 4.N [METHOD] [/path]
- **Purpose:** one sentence
- **Auth:** authentication/authorization pattern
- **Path/Query Parameters:** table with name, type, required, default, validation
- **Request Body:** full JSON example (or "None")
- **Success Response (status):** FULL JSON example
- **Error Responses:** table with status, condition, response body for EVERY error case
- **Side Effects:** what gets created/updated/deleted
- **Security Notes:** tenant isolation, enumeration prevention

## 5. Business Logic
### 5.1 Core Flow
[Numbered steps from interview, with specific numeric thresholds]

### 5.2 External Service Interactions
[From interview. If none, state "None — this module works entirely with local database."]

### 5.3 Multi-Tenancy / Tenant Isolation (if applicable)
[Every query filters by tenant ID. Show correct and wrong examples.]

## 6. Exemplars
### 6.1 Reference Module
[YOU pick the most similar existing module from the codebase]

### 6.2 What to Replicate
[List specific patterns with file:line references]

### 6.3 What NOT to Replicate
[Patterns from the exemplar that don't apply to this feature]

## 7. Constraints
### 7.1 Forbidden Approaches
[From CLAUDE.md + feature-specific from interview]

### 7.2 Error Handling
[Use the project's standard error handling pattern. List which errors for which conditions.]

### 7.3 Logging
[Use the project's standard logging. Specify log levels.]

### 7.4 Protected Files
[Do NOT modify — list from settings.json deny list that are relevant]

## 8. Frontend Impact (MANDATORY)

Every spec MUST include this section. Pick ONE of the three verdicts below:

### Verdict A — "Frontend changes required" (full section)
If the feature adds or changes anything a user interacts with, define:
#### 8.1 Components
[New or modified components with file paths]
#### 8.2 State Management
[State changes, new fields on existing types]
#### 8.3 API Client Methods
[New or modified API client functions]
#### 8.4 UI Behavior
[Step-by-step what the user sees and does]

### Verdict B — "Frontend deferred"
If frontend work is needed but will be done in a separate ticket:
- **Why deferred:** [reason]
- **Follow-up ticket:** [ticket ID or name]
- **User impact until frontend ships:** [what the user CAN and CANNOT do]
- **Feature is NOT user-facing until:** [ticket ID] ships

### Verdict C — "Frontend not required"
If no frontend changes are needed at all:
- **Why not needed:** [justification — e.g., "background job with no UI", "API-only change"]
- **End-to-end usability confirmed:** [explain how the feature is usable without frontend changes]

## 9. Acceptance Criteria
### 9.1 Functional
[Checkboxes — from interview verification questions]

### 9.2 Tenant Isolation (if applicable)
- [ ] Tenant A cannot see Tenant B's data via GET
- [ ] Tenant A cannot modify Tenant B's data (returns 404, not 403)
- [ ] All database queries include tenant ID in WHERE clause

### 9.3 Structural
- [ ] Files in correct directories
- [ ] Module registered
- [ ] All endpoints use authentication
- [ ] All endpoints have API documentation decorators
- [ ] No new dependencies added without approval
- [ ] No console.log / print statements (use project logger)
- [ ] No existing protected files modified

### 9.4 Build
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes

---

## Quality Rules (self-check before saving)

- Every model field has explicit types (NOT inferred)
- Every API response is a full JSON example (NOT a description)
- Every error response lists status code + condition + exact response body
- "Does NOT use" and "do NOT replicate" lists are present
- Tenant isolation note appears on EVERY endpoint that queries the DB (if applicable)
- The spec is 500-1000 lines for a typical feature module
- All file paths are real paths verified against the codebase (not guessed)
- **Section 8 (Frontend Impact) has an explicit verdict** (A, B, or C). If verdict is B (deferred), the follow-up ticket is named and the spec clearly states the feature is not user-facing yet.

### ⚠️ NEEDS VERIFICATION
Flag any section where you had to make assumptions due to:
- Missing or outdated external API documentation
- Ambiguous codebase patterns (multiple conflicting conventions)
- Interview answers that were technically resolved but still feel underspecified

Mark each flagged item with `⚠️ NEEDS VERIFICATION: [reason]` so the user can review.

### Step 5: Save and Report

Save output to: `specs/NLSPEC_$ARGUMENTS.md`

Report to user:
- Spec location and line count
- Number of endpoints defined
- Number of model fields
- Any gaps where interview answers were ambiguous (flag these for user review)
- Items flagged with ⚠️ NEEDS VERIFICATION
- Next step: "Review the spec, then run `/implement $ARGUMENTS`"

$ARGUMENTS
