---
name: agentic-implementation
description: Use during TDD development of approved module tasks, including decision escalation, implementation logs, verification, and adversarial review loops.
---

# Agentic Implementation

Use this skill only after the active module's `tasks.md` has passed human review.

Use `artifact_language` from `00-index.md` for logs, decisions, and reviews. Code should still follow the repository's own language and conventions.

## Contract

Input:

- Human-approved `tasks.md`.
- Active task id.
- Module specs and decisions.
- Testing strategy and task TDD plan.
- Repository code.

Output:

- Test changes and code changes for the active task.
- Red/green/refactor evidence or a reviewed TDD exception.
- Updated `implementation-log.md`.
- Updated `decisions.md` for development-time decisions.
- `task-reviews/<task-id>.md` after adversarial review.

Complexity:

- Low: focused TDD/verification and review against core acceptance criteria.
- Medium: standard TDD implementation and adversarial review loop.
- High: stronger verification, traceability, and residual risk analysis.

## Implementation Loop

1. Select the next pending task only.
2. Read the task contract, TDD plan, module specs, decision log, testing strategy, and relevant code.
3. If a decision is needed before a meaningful test or implementation can be written, create 2 to 4 options and use the pragmatic decision policy.
4. Record the selected decision in `decisions.md` with the next `D###` ID.
5. Write the smallest useful failing test first.
6. Run the focused test command and record the red result.
7. Implement the smallest correct production change to make the test pass.
8. Run the focused test command and record the green result.
9. Refactor only when useful, then rerun the relevant green verification.
10. Run broader relevant verification.
11. Update `implementation-log.md` with TDD evidence.
12. Request adversarial review.
13. If review fails, correct the issues and repeat review.
14. Mark the task complete only after review passes.

If a viable test harness does not exist or test-first work is not practical, record the exception before production coding, explain the risk, and run the most focused verification available.

## Pragmatic Decision Policy

Choose the intermediate path:

- It should not block likely future development.
- It should not add present complexity for speculative future needs.
- It should follow existing conventions.
- It should be reversible when possible.
- It should be easy to test first.

Escalate to a human if the decision affects product scope, pricing, compliance, sensitive data, security posture, or public commitments.

## Implementation Log Template

```markdown
---
artifact: implementation-log
stage: task
status: draft
owner_agent: task-implementer
depends_on:
  - docs/wefter/04-modules/<module-id>/tasks.md
  - docs/wefter/04-modules/<module-id>/decisions.md
feeds:
  - docs/wefter/04-modules/<module-id>/task-reviews/*.md
human_review: optional
last_updated: YYYY-MM-DD
language: <artifact_language>
---

# Implementation Log: <Module Name>

## Task Entries

### T001 - <Task Name>

- Status: in-progress|review-failed|review-passed|complete
- Summary:
- Files changed:
- TDD plan followed:
- Red evidence:
- Green evidence:
- Refactor evidence:
- Verification run:
- Verification result:
- TDD exception, if any:
- Decisions made:
- Review file:
- Residual risk:
```

## Task Review Template

```markdown
---
artifact: task-review
stage: task
status: passed|failed
owner_agent: adversarial-reviewer
depends_on:
  - docs/wefter/04-modules/<module-id>/tasks.md
  - docs/wefter/04-modules/<module-id>/product-spec.md
  - docs/wefter/04-modules/<module-id>/technical-spec.md
  - docs/wefter/04-modules/<module-id>/decisions.md
feeds:
  - docs/wefter/04-modules/<module-id>/implementation-log.md
human_review: optional
last_updated: YYYY-MM-DD
---

# Review: <Task ID>

## Verdict

pass|fail

## Findings

| Severity | Finding | Evidence | Required Fix |
| --- | --- | --- | --- |

## Acceptance Criteria Check

| Criterion | Status | Notes |
| --- | --- | --- |

## Verification Review

- Commands reviewed:
- Missing verification:

## TDD Compliance

- First failing test evidence:
- Green verification evidence:
- Refactor verification evidence:
- Accepted exceptions:

## Residual Risks

- Risk
```
