# #1204 — enhancement: add a loading skeleton to the compare page

## Context
The compare page currently shows a blank area (or a bare spinner) while data loads. Swapping in a proper skeleton component (several already exist under `components/skeletons`) would make the loading state feel less jarring.

## Why it matters
This isn't fixing something broken, it's closing a small gap between what the product does today and what would feel more polished/complete. Low effort, but it's the kind of detail users notice.

## Suggested approach
Implement it as a small, self-contained addition using existing components/patterns already in the codebase (e.g. reuse an existing skeleton/toast/button component rather than introducing a new one) so it stays low-risk and easy to review.

## Acceptance criteria
- [ ] The addition works on the affected page/flow
- [ ] Reuses existing components/patterns rather than introducing new ones
- [ ] No regression to the existing behavior around it
