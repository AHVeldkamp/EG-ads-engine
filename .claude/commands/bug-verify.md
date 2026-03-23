# Bug Verify — Verify Fix and Check for Regressions

You are verifying a bug fix for correctness, minimality, and regressions.
This is a focused review — not a full feature review.

## Input
- Bug report: `specs/BUGREPORT_$ARGUMENTS.md`
- If no bug report exists, tell the user:
  "No bug report found for '$ARGUMENTS'."

## Review Checklist

### 1. Root Cause Addressed
- [ ] Read the Root Cause section (Section 4) of the bug report
- [ ] Read the actual code changes (staged or committed)
- [ ] The fix directly addresses the identified root cause
- [ ] The fix doesn't just mask the symptom — it corrects the underlying issue
- [ ] If the root cause has multiple symptoms, all are resolved

### 2. Minimal Changes
- [ ] Only files listed in the Fix Plan were modified
- [ ] No refactoring or cleanup beyond the fix
- [ ] No new features added
- [ ] No unrelated changes included
- [ ] Line count of changes is proportional to the bug (small bug = small fix)

### 3. Verification Steps
Run each verification step from Section 7 of the bug report:
- [ ] Original bug reproduction — does the fix resolve it?
- [ ] Each regression scenario listed — do they still work?
- [ ] Any additional edge cases identified during review

### 4. Build Verification
Run and report results:
```bash
npm run build
npm run lint
npm run test
```

### 5. Bug Report Consistency
- [ ] The changes match what the Fix Plan described
- [ ] No deviations from the approved diagnosis
- [ ] If deviations exist, they are justified and documented

## Output

Report each item as:
- ✅ PASS
- ❌ FAIL — [specific issue]
- ⚠️  MANUAL — [needs manual testing]

**Summary:** X passed, Y failed, Z need manual testing.

**Verdict:**
- ✅ FIX VERIFIED — changes are correct, minimal, and pass all checks
- 🔧 NEEDS ADJUSTMENTS — list specific changes needed
- 🚫 FIX INCORRECT — the root cause is not addressed, needs re-diagnosis

$ARGUMENTS
