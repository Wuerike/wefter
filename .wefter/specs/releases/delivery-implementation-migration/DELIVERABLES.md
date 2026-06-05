# Deliverables

Release ID: `delivery-implementation-migration`

Status values: `candidate | ready | blocked | deferred | done`

## Deliverable 001: Vocabulary And Runtime Map

Status: done
Goal: Define canonical delivery vocabulary and rename remaining internal delivery implementation artifacts to their delivery-era roles.
Scope: Workflow IDs, commands, configs, schemas, agents, skills, prompts and docs.
Out of scope: Changing product-shaping spec responsibilities.
Dependencies: Current delivery implementation docs and product-shaping handoff rules.
Source docs: README.md, SCOPE.md, ACCEPTANCE_CRITERIA.md.
Acceptance criteria: Runtime map is explicit and testable.
Risk areas: Confusing public delivery vocabulary with internal runtime names.
Human gate triggers: Any rename that risks persisted runtime data.
Expected verification: Documentation audit plus CLI install/doctor tests.

Implementation notes:
- `delivery-implementation` is the runtime workflow id.
- `wefter delivery run` creates artifacts under `.audit/wefter/delivery-implementation`.
- `wefter delivery guard` validates manifests with `workflowId: "delivery-implementation"`.
- `/wefter-run-delivery` uses `wefter-delivery-orchestrator`.

## Deliverable 002: Handoff Default Decision

Status: done
Goal: Decide and implement the default implementation source path for new installs.
Scope: `DELIVERABLES.md`, config defaults and docs.
Out of scope: Changing existing installed configs automatically.
Dependencies: Product-shaping validation gate.
Source docs: README.md, SCOPE.md, ACCEPTANCE_CRITERIA.md.
Acceptance criteria: New defaults are documented and explicit `--deliverables-document` overrides still work.
Risk areas: Silent handoff bypass.
Human gate triggers: Any compatibility behavior that weakens product validation.
Expected verification: CLI tests for default and override paths.
