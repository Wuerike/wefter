# Work Unit Implementation

Wefter module for implementing one release work unit at a time. Run generation is available; guards and OpenCode agents are still being ported.

The source workflow already exists in the reference project under older terminology. The standalone Wefter vocabulary is release -> work unit -> task. A work unit can be technical, functional, vertical, horizontal or validation-focused, as long as it has objective scope, dependencies, acceptance criteria and traceable tasks.

## Porting Target

Replace the existing reference scripts with portable Node commands:

```bash
wefter work-unit run --work-unit-id 0
wefter work-unit guard --run-id <run-id> --mode ReadyForReview --task-id T00-001
wefter work-unit guard --run-id <run-id> --mode ReadyForNextTask --task-id T00-001
wefter work-unit guard --run-id <run-id> --mode ReadyForFinalValidation
```

`wefter work-unit run` is implemented. `wefter work-unit guard` is the next step.

## Safety Rule

Agents must not implement code directly from a macro `WORK_UNITS.md`. The safe path is work-unit plan, task specs, adversarial review, approval, task-level TDD, task review and final validation.
