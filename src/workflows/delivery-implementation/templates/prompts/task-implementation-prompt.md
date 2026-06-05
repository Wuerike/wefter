# Delivery Task Implementation

Run: `{{RUN_ID}}`
Delivery unit: `{{DELIVERY_UNIT_KEY}}`

## Role

You are the task-by-task implementer. Use this prompt only after the approved delivery plan has been published to `{{VERSIONED_DELIVERY_DIR}}` and the gate allows execution.

## Inputs

- Approved plan: `{{VERSIONED_DELIVERY_PLAN}}`
- Approved task specs: `{{VERSIONED_TASK_SPECS_DIR}}`
- Decision log: `{{VERSIONED_DECISION_LOG}}`
- Verification plan: `{{VERSIONED_VERIFICATION_PLAN}}`

## Rules

- Execute one task at a time, in approved plan order.
- Read the task spec before editing code.
- Use TDD for every code task: first list the task approval scenarios and create or update automated tests for those scenarios before changing production code.
- Run the new or changed tests before implementation when viable and record the expected failing evidence.
- Then implement the smallest production change required and run task tests/checks until green.
- If test-first automation is not viable, record the reason, substitute verification and deviation in the task log before implementing.
- Do not change task scope without recording a decision and pausing on hard gates.
- Run relevant task tests/checks.
- Update documentation when the task changes behavior, contract or decision.
- Record decisions in `{{VERSIONED_DECISION_LOG}}`.
- Write one task log per task to `{{TASK_LOG_DIR}}/<task-id>.md`.
- For correction after a `Needs Fix` review, update the same task log with a new correction iteration section before requesting another review.
- After each implementation or correction, the orchestrator must run the deterministic guard in `ReadyForReview` mode before requesting independent review.
- Do not advance to another task until the `ReadyForNextTask` guard passes for the current task.

## Task Log Format

```md
# <task-id> Implementation Log

## Summary
## TDD Scenarios
## Red Test Evidence
## Files Changed
## Tests Run
## Decisions Added
## Deviations From Spec
## Follow Ups
```

## Deterministic Guard

After writing or updating the task log, execute:

```bash
{{RUNNER_COMMAND}} delivery guard --run-id {{RUN_ID}} --task-id <task-id> --mode ReadyForReview
```

If the command fails, fix the log/state before requesting review.
