# Deliverables

Release ID: `delivery-implementation-migration`

Status values: `candidate | ready | blocked | deferred | done`

## Deliverable 001: Vocabulary And Compatibility Map

Status: candidate
Goal: Define canonical delivery vocabulary and map every legacy work-unit artifact to its migration-era equivalent.
Scope: Workflow IDs, commands, configs, schemas, agents, skills, prompts and docs.
Out of scope: Removing legacy commands.
Dependencies: Current work-unit implementation docs and product-shaping handoff rules.
Source docs: README.md, SCOPE.md, ACCEPTANCE_CRITERIA.md.
Acceptance criteria: Compatibility map is explicit and testable.
Risk areas: Breaking installed OpenCode configs.
Human gate triggers: Any rename that invalidates existing user files.
Expected verification: Documentation audit plus CLI install/doctor tests.

## Deliverable 002: Handoff Default Decision

Status: candidate
Goal: Decide and implement the default implementation source path for new installs.
Scope: `DELIVERABLES.md` vs legacy `WORK_UNITS.md`, config defaults and docs.
Out of scope: Changing existing installed configs automatically.
Dependencies: Product-shaping validation gate.
Source docs: README.md, SCOPE.md, ACCEPTANCE_CRITERIA.md.
Acceptance criteria: New defaults are documented and existing overrides still work.
Risk areas: Silent handoff bypass.
Human gate triggers: Any compatibility behavior that weakens product validation.
Expected verification: CLI tests for default and override paths.
