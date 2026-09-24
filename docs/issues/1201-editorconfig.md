# #1201 — chore: add a .editorconfig for consistent indentation across editors

## Context
There's no `.editorconfig` in the repo, so contributors using editors that don't pick up the Prettier/ESLint config directly can end up with inconsistent indentation before formatting runs.

## Why it matters
This is routine maintenance rather than a functional bug — nothing is broken today, but leaving it as-is adds small amounts of drift/risk that compound over time (harder upgrades later, more surface area for lint noise, or reproducibility gaps in CI).

## Suggested approach
Add a `.editorconfig` at the repo root defining charset, line endings, indent style/size, and trailing-whitespace/final-newline rules consistent with the existing Prettier/ESLint config, so editors without those plugins still match the project's formatting conventions.

## Acceptance criteria
- [ ] `.editorconfig` added at the repo root
- [ ] Settings consistent with existing Prettier/ESLint config (indent size/style, line endings, charset)
- [ ] No unrelated changes bundled in
