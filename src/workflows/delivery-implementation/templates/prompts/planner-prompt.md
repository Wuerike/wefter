# Executable Delivery Plan

Run: `{{RUN_ID}}`
Release: `{{RELEASE_ID}}`
Delivery unit: `{{DELIVERY_UNIT_KEY}}`
Config: `{{CONFIG_PATH}}`
Output root: `{{RUN_ROOT}}`

## Role

You are the delivery planner. Transform the macro delivery unit into executable, traceable and reviewable artifacts before any code implementation starts.

Do not implement code. Do not edit source documentation. Write only the outputs named in this prompt.

## Source Documents

- Deliverables document: `{{DELIVERABLES_DOCUMENT}}`
- Includes:
{{SOURCE_INCLUDE}}
- Excludes:
{{SOURCE_EXCLUDE}}

## Target Delivery Unit

Use `{{DELIVERY_UNIT_ID}}` / `{{DELIVERY_UNIT_KEY}}` as the target delivery unit. Extract objective, included scope, acceptance criteria and out-of-scope items from the deliverables document, then cross-check them against the other source documents.

## Required Outputs

Create these files:

- Delivery plan: `{{DRAFT_PLAN_OUTPUT}}`
- Traceability matrix: `{{DRAFT_TRACEABILITY_OUTPUT}}`
- Verification plan: `{{DRAFT_VERIFICATION_OUTPUT}}`
- Gate assessment: `{{DRAFT_GATE_OUTPUT}}`
- Decisions draft: `{{DRAFT_DECISIONS_OUTPUT}}`
- Task specs: directory `{{DRAFT_TASK_SPECS_DIR}}`

## Rules

- Each task must have a stable ID in the format `TXX-YYY`, where `XX` is the delivery-unit number when numeric.
- Each task must cite evidence from source documents with path and quote or line when possible.
- Each task must have objective acceptance criteria, approval scenarios mappable to tests, and required tests or checks.
- If a task involves schema, migration, auth, permission, tenant isolation, storage, token handling or security, mark it explicitly.
- If domain or scope ambiguity exists, record it in `gate-assessment.md` as requiring a human gate.
- Do not create tasks for items outside the delivery-unit scope unless explicitly justified as technical preparation.
- Prefer small, sequenced and verifiable tasks.

## Plan Format

`{{DRAFT_PLAN_OUTPUT}}` must contain:

```md
# {{DELIVERY_UNIT_KEY}} Plan

## Status

Draft

## Source Documents Consulted

## Delivery Unit Scope

## Out Of Scope

## Assumptions

## Tasks

| Task | Title | Type | Depends On | Human Gate | Tests |
| --- | --- | --- | --- | --- | --- |

## Sequencing Rationale

## Risks

## Documentation Updates Expected
```

## Task Spec Format

Create one file per task in `{{DRAFT_TASK_SPECS_DIR}}`, named `<task-id>.md`:

```md
# <task-id>: <title>

## Goal

## Source Evidence

## Scope

## Out Of Scope

## Dependencies

## Implementation Requirements

## Data And Migration Impact

## Security, Tenant And Permission Considerations

## Error States

## Approval Scenarios

## Tests Required

## Documentation Impact

## Acceptance Checklist

## Human Gate
```

## Traceability Matrix Format

`{{DRAFT_TRACEABILITY_OUTPUT}}` must map:

```md
# {{DELIVERY_UNIT_KEY}} Traceability Matrix

| Task | Domain Rule | Data Contract | Acceptance Criteria | Technical Decision | Test/Verification |
| --- | --- | --- | --- | --- | --- |
```

## Verification Plan Format

`{{DRAFT_VERIFICATION_OUTPUT}}` must list commands, expected automated tests, unavoidable manual checks and criteria for considering the delivery unit complete.

## Gate Assessment Format

`{{DRAFT_GATE_OUTPUT}}` must contain:

```md
# {{DELIVERY_UNIT_KEY}} Gate Assessment

## Gate Recommendation

Human Required | Auto-Approvable

## Reasons

## Hard Gate Triggers

## Questions For Human Review
```

## Decisions Format

`{{DRAFT_DECISIONS_OUTPUT}}` must start the delivery-unit decision log with expected decisions or state that no decision has been made yet.
