---
name: module-refinement
description: Use to fully refine exactly one selected module at product, technical, and TDD levels before task generation or implementation.
---

# Module Refinement

Use this skill when a module has been selected from `module-map.md` and must be fully specified before task planning.

Use `artifact_language` from `00-index.md`. Refine exactly one active module and use the requested module complexity.

## Contract

Input:

- Approved `docs/wefter/02-product/module-map.md`.
- Active module id.
- Existing code and architecture docs.
- Prior module decisions, if any.

Output:

- `docs/wefter/04-modules/<module-id>/module-brief.md`.
- `docs/wefter/04-modules/<module-id>/product-spec.md`.
- `docs/wefter/04-modules/<module-id>/technical-spec.md`.
- `docs/wefter/04-modules/<module-id>/decisions.md`.
- Updated architecture docs under `docs/wefter/03-architecture/` as needed.

Complexity:

- Low: compact product/technical module spec sufficient for safe tasking.
- Medium: standard module brief, product spec, technical spec, TDD approach, and decisions.
- High: deeper cross-module architecture updates, ADRs, security/privacy/testing detail, and traceability.

## Refinement Rules

- Refine one module only.
- The first module must establish foundational technical and product defaults when the repo has no prior direction.
- Later modules must reuse existing decisions unless there is a clear reason to change them.
- Do not create implementation tasks until product and technical specs are reviewable.
- Do not create implementation tasks until the module has a clear test strategy or an explicit reason no new strategy is needed.
- Capture unresolved questions explicitly.
- Use decision IDs `D001`, `D002`, `D003` in `decisions.md`.

## Product Spec Should Define

- User stories or scenarios.
- Functional requirements.
- Non-functional requirements visible at product level.
- Edge cases.
- Empty/loading/error states when UI exists.
- Permissions/roles when relevant.
- Analytics or success signals when relevant.
- Acceptance criteria.
- Non-goals.

## Technical Spec Should Define

- Existing architecture context.
- Proposed implementation approach.
- Data model changes.
- API/contracts/events.
- UI routes/components when relevant.
- Integrations.
- Security, privacy, and permissions.
- Testing strategy and TDD approach.
- Migration/deployment concerns.
- Technical risks.
- Decisions required before tasking.

## Testing Strategy Should Define

- Test levels to use for this module: unit, integration, contract, end-to-end, manual, or another repo-specific category.
- The default TDD path: first failing behavioral test, minimal implementation, refactor with green verification.
- Test commands and expected scope for red and green runs.
- Fixtures, factories, mocks, seed data, or environment setup needed for reliable tests.
- Acceptance criteria that must be covered by automated tests.
- Areas where test-first work is not practical, with the required focused verification instead.

## Module Brief Template

```markdown
---
artifact: module-brief
stage: module
status: human-review
owner_agent: module-architect
depends_on:
  - docs/wefter/02-product/module-map.md
feeds:
  - docs/wefter/04-modules/<module-id>/product-spec.md
  - docs/wefter/04-modules/<module-id>/technical-spec.md
human_review: required
last_updated: YYYY-MM-DD
language: <artifact_language>
---

# Module Brief: <Module Name>

## Purpose

Why this module exists.

## Included Features

- Feature

## Excluded For Now

- Non-goal

## Dependencies

- Product dependency
- Technical dependency

## Completion Definition

- Condition
```

## Decisions Template

```markdown
---
artifact: module-decisions
stage: module
status: human-review
owner_agent: module-architect
depends_on:
  - docs/wefter/04-modules/<module-id>/product-spec.md
  - docs/wefter/04-modules/<module-id>/technical-spec.md
feeds:
  - docs/wefter/04-modules/<module-id>/tasks.md
human_review: required
last_updated: YYYY-MM-DD
---

# Decisions: <Module Name>

## Pending Decisions

| ID | Question | Options | Recommended | Needed Before | Owner |
| --- | --- | --- | --- | --- | --- |

## Accepted Decisions

| ID | Decision | Rationale | Tradeoffs | Date | Made By |
| --- | --- | --- | --- | --- | --- |

## Development-Time Decisions

| ID | Task | Decision | Rationale | Human Review Note |
| --- | --- | --- | --- | --- |
```
