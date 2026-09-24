# #1202 — testing: add a unit test for the formatCurrency helper

## Context
`formatCurrency` doesn't currently have a dedicated unit test covering its edge cases (empty input, very large input, unexpected type). Adding one would catch regressions early since it's used in a few places across the UI.

## Why it matters
Missing coverage here means a regression in this specific path could ship without any test catching it. It's a small, self-contained addition that raises confidence without needing a broader test-strategy discussion.

## Suggested approach
Add a focused unit test covering the normal case plus at least one edge case (empty/invalid/boundary input), following the existing test conventions already used elsewhere in this codebase.

## Acceptance criteria
- [ ] New test added and passing
- [ ] Covers at least one edge case, not just the happy path
- [ ] Runs as part of the existing test suite/CI, no new tooling required
