---
name: task-contracts
description: Use to generate TDD-ready implementation task contracts, pending decision lists, and human review checklists for an approved module spec.
---

# Task Contracts

Use this skill after a module has product and technical specs that are complete enough for human review.

Use `artifact_language` from `00-index.md`. Generate tasks only after module specs are complete enough to review.

## Contract

Input:

- `module-brief.md`.
- `product-spec.md`.
- `technical-spec.md`.
- `decisions.md`.
- Architecture docs.
- `testing-strategy.md` when present.

Output:

- `tasks.md` with N tasks and a TDD plan per task.
- Updated pending decisions.
- Human review checklist.

Complexity:

- Low: fewer, larger tasks that remain reviewable and test-first where practical.
- Medium: standard task contracts with acceptance, TDD, and review criteria.
- High: more granular tasks with explicit traceability to requirements, risks, and decisions.

## Task Generation Rules

- Generate the smallest task set that can deliver the module.
- Tasks should be ordered by dependency and verification value.
- Each task must be implementable by an agent without reinterpreting product strategy.
- Each task must include acceptance criteria, TDD plan, verification expectations, and review criteria.
- Each task should be narrow enough for adversarial review.
- Each task must identify the first failing test to write or justify why test-first work is not practical.
- TDD exceptions must be explicit and reviewable, not implied by silence.
- Do not include speculative future-module work.
- Use task IDs `T001`, `T002`, `T003`.
- Use decision IDs `D001`, `D002`, `D003`.

## Human Review Gate

Before implementation, a human should confirm:

- Module scope is correct.
- Tasks cover all acceptance criteria.
- Tasks do not include unrelated scope.
- TDD plans are realistic for the repo's test harness.
- Any test-first exceptions are acceptable and have focused verification.
- Pending decisions are resolved or explicitly delegated to agentic pragmatic decision-making.
- Verification expectations are realistic for the repo.

## Tasks Template

```markdown
---
artifact: module-tasks
stage: task
status: human-review
owner_agent: task-planner
depends_on:
  - docs/wefter/04-modules/<module-id>/module-brief.md
  - docs/wefter/04-modules/<module-id>/product-spec.md
  - docs/wefter/04-modules/<module-id>/technical-spec.md
  - docs/wefter/04-modules/<module-id>/decisions.md
feeds:
  - docs/wefter/04-modules/<module-id>/implementation-log.md
  - docs/wefter/04-modules/<module-id>/task-reviews/*.md
human_review: required
last_updated: YYYY-MM-DD
language: <artifact_language>
---

# Tasks: <Module Name>

## Review Status

- Human approved for implementation: no
- Approved by:
- Approved at:

## Task List

### T001 - <Task Name>

Status: pending

Objective:

- What this task must accomplish.

Scope:

- Included work.

Non-Goals:

- Explicitly excluded work.

Dependencies:

- Prior tasks or artifacts.

Expected Areas:

- Files, modules, routes, packages, or docs likely affected.

TDD Plan:

- First failing test to write:
- Expected red command/result:
- Minimal green implementation target:
- Expected green command/result:
- Refactor verification command:
- Test-first exception, if any:

Implementation Notes:

- Constraints and useful context.

Acceptance Criteria:

- Criterion

Verification:

- Red test command.
- Green test command.
- Broader regression/build/lint/manual check expected.

Adversarial Review Criteria:

- What the reviewer must check.
- TDD evidence the reviewer must check.

Decision Policy:

- Decisions allowed agentically:
- Decisions requiring human escalation:
```
