# Review Implementation Against NLSpec

You are reviewing a feature implementation for compliance with its NLSpec
and the project's architectural standards.

## Input
- Feature name: $ARGUMENTS
- NLSpec: `specs/NLSPEC_$ARGUMENTS.md` (if exists)
- If no NLSpec exists, review against CLAUDE.md rules only and note the gap

## Review Checklist

### 1. NLSpec Compliance (if NLSpec exists)

**Data Model (Section 3):**
- [ ] Model field names match spec exactly
- [ ] Model field types match spec exactly (no inferred types)
- [ ] Model constraints match spec (nullable, defaults, indexes)
- [ ] No extra fields added beyond spec
- [ ] No fields missing from spec
- [ ] Enum/constant values match spec exhaustively
- [ ] DTOs / request schemas have correct validation rules

**API Endpoints (Section 4):**
- [ ] All endpoints from spec exist (no missing)
- [ ] No extra endpoints added beyond spec
- [ ] Routes match spec exactly (method + path)
- [ ] Request/response shapes match spec JSON examples
- [ ] Error status codes match spec error tables
- [ ] API documentation decorators present on all endpoints

**Business Logic (Section 5):**
- [ ] Core flow matches spec numbered steps
- [ ] Numeric thresholds match spec values
- [ ] External service interactions match spec (or "none" if spec says none)

**Constraints (Section 7):**
- [ ] No forbidden approaches used
- [ ] No new dependencies added
- [ ] Error handling uses only the project's standard patterns
- [ ] No console.log / print (project logger only)
- [ ] No imports from forbidden modules (check "does NOT use" list)

### 2. Architectural Compliance (always check, regardless of NLSpec)

**Structure:**
- [ ] Files in correct directories per CLAUDE.md / ARCHITECTURE.md
- [ ] Module registered in parent module
- [ ] Model registered in the appropriate registration file

**Pattern Conformance:**
- [ ] Controller/routes follow the project's standard patterns
- [ ] All protected endpoints use authentication
- [ ] Service follows the project's error handling patterns
- [ ] Model follows the project's data model patterns
- [ ] DTOs / request schemas follow validation patterns

**Tenant Isolation (if applicable — CRITICAL — review every query):**
- [ ] Every DB query filters by tenant ID
- [ ] Every service method receives tenant ID parameter
- [ ] Every controller extracts tenant from auth context
- [ ] No unscoped queries exist anywhere
- [ ] Wrong-tenant access returns 404 (not 403) to prevent enumeration

**Tests:**
- [ ] Test file exists at expected path
- [ ] Test setup follows project conventions
- [ ] Dependencies properly mocked
- [ ] Tenant isolation tested (if applicable)
- [ ] Happy path tested for each endpoint
- [ ] Error cases tested

### 3. Frontend Coverage (MANDATORY)
- [ ] Spec Section 8 exists with an explicit verdict (A, B, or C)
- [ ] If Verdict A: frontend components, state, API client, and UI behavior are all defined
- [ ] If Verdict A: implementation includes the frontend changes described in Section 8
- [ ] If Verdict B: follow-up ticket is named, and the spec states feature is not user-facing yet
- [ ] If Verdict C: justification is valid — feature genuinely needs no frontend changes
- [ ] End-to-end usability: a user can actually USE this feature through the UI (or the spec explicitly says they can't yet)

### 4. No Side Effects
- [ ] No existing files modified (except module registration)
- [ ] No protected files touched (check .claude/settings.json deny list)
- [ ] No new dependencies in package manifest

### 5. Build Verification
Run and report results:
```bash
npm run build
npm run lint
npm run test
```

## Output

Report each item as:
- ✅ PASS
- ❌ FAIL — [specific issue]
- ⚠️  SKIPPED — [reason]

**Summary:** X passed, Y failed, Z skipped.

If NLSpec exists: "Spec compliance: X/Y items match spec exactly."

**Verdict:**
- ✅ READY — implementation matches spec and passes all checks
- 🔧 NEEDS FIXES — list the specific changes needed
- 🚫 BLOCKED — fundamental issues require reimplementation

$ARGUMENTS
