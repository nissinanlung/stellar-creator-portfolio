# #1203 — UX: improve the empty-state copy on the leaderboard page

## Context
When there's no data yet, the leaderboard page shows generic/placeholder-ish copy instead of a friendly, actionable empty state. A short message plus a clear next action (e.g. a CTA button) would read better.

## Why it matters
Copy and empty states are easy to overlook during feature work because the happy path is what gets tested, but the empty/edge state is often what a new or returning user actually sees first.

## Suggested approach
Rewrite the copy to be specific and actionable (what happened, what to do next), and pair it with a clear next-step affordance (a button/link) where one doesn't already exist.

## Acceptance criteria
- [ ] Copy reviewed for tone/clarity consistent with the rest of the app
- [ ] A clear next action is visible when relevant
- [ ] Verified in the actual empty-state condition, not just visually mocked
