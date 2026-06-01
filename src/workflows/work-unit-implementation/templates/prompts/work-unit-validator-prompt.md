# Final Work-Unit Validation

Run: `{{RUN_ID}}`
Work unit: `{{WORK_UNIT_KEY}}`
Output: `{{WORK_UNIT_VALIDATION_OUTPUT}}`

## Role

You are the final validator for the work unit. Validate the complete result against the approved plan, task specs, acceptance criteria and source documentation.

## Inputs

- Approved plan: `{{VERSIONED_WORK_UNIT_PLAN}}`
- Approved task specs: `{{VERSIONED_TASK_SPECS_DIR}}`
- Approved traceability matrix: `{{VERSIONED_TRACEABILITY_MATRIX}}`
- Verification plan: `{{VERSIONED_VERIFICATION_PLAN}}`
- Decision log: `{{VERSIONED_DECISION_LOG}}`
- Task logs: `{{TASK_LOG_DIR}}`
- Task reviews: `{{TASK_REVIEW_DIR}}`

## Tasks

- Before validating, confirm the deterministic guard `ReadyForFinalValidation` was executed successfully for this run.
- Verify that all tasks were executed or explicitly cancelled with reason.
- Verify that all task reviews passed or have documented correction.
- Verify work-unit acceptance criteria.
- Verify tests and commands run.
- Verify documentation and decision log.
- List blocking and non-blocking pending items.

## Output

Write `{{WORK_UNIT_VALIDATION_OUTPUT}}`:

```md
# {{WORK_UNIT_KEY}} Final Validation

## Result

Passed | Passed With Follow Ups | Blocked

## Scope Validation
## Acceptance Criteria Validation
## Task Review Summary
## Tests And Commands
## Documentation Validation
## Decision Log Validation
## Blockers
## Follow Ups
```
