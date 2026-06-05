# Deliverables

Release ID: `technical-shaping-foundation`

Status values: `candidate | ready | blocked | deferred | done`

## Deliverable 001: Technical Artifact Contract

Status: candidate
Goal: Define the required technical-shaping artifact set and each file's responsibility.
Scope: Technical decisions, constraints, data contracts and verification strategy.
Out of scope: Task specs and implementation plans.
Dependencies: Product-shaped release specs and `DELIVERABLES.md`.
Source docs: README.md, SCOPE.md, ACCEPTANCE_CRITERIA.md.
Acceptance criteria: Artifact responsibilities are clear enough to drive schemas and prompts.
Risk areas: Overlap with product shaping or delivery implementation.
Human gate triggers: Architecture, security, persistence or migration tradeoffs.
Expected verification: Documentation audit against workflow manifest and README.

## Deliverable 002: Planned Command Activation Gate

Status: candidate
Goal: Define the exact conditions required before `wefter technical shape` and `/wefter-shape-technical` move from `plannedCommands` to `commands`.
Scope: CLI, OpenCode, schemas, prompts, agents, tests and docs.
Out of scope: Publishing commands before implementation.
Dependencies: Workflow manifest schema and technical artifact contract.
Source docs: README.md, SCOPE.md, ACCEPTANCE_CRITERIA.md.
Acceptance criteria: Activation checklist is executable and prevents premature install.
Risk areas: Consumers interpreting planned metadata as runnable behavior.
Human gate triggers: Any disagreement about workflow boundaries.
Expected verification: CLI tests and workflow manifest validation.
