# Run Tests

Run the test suite and provide a structured report.

## Process

If a feature name is provided as $ARGUMENTS:
```bash
npx jest --testPathPattern="$ARGUMENTS"
```

Otherwise run the full suite:
```bash
npm run test
```

## Report Format

**Results:**
- Total tests: X
- Passed: X ✅
- Failed: X ❌

**For each failing test:**
- Test name
- Error message (first 5 lines)
- Classification: regression (was passing) or expected (new test, feature not yet implemented)

**NLSpec Cross-Reference (if `specs/NLSPEC_$ARGUMENTS.md` exists):**
Map each acceptance criterion from Section 9 to test results:
- ✅ Covered and passing
- ❌ Covered but failing
- ⚠️  Not covered by any test (flag for manual verification)

$ARGUMENTS
