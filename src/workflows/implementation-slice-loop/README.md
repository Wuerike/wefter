# Implementation Slice Loop

Planned Wefter module for the existing implementation-slice-loop workflow.

The source workflow already exists in the reference project and includes slice planning, adversarial plan review, consolidation, validation, repair, human gates, task implementation, task review and final slice validation.

## Porting Target

Replace the existing PowerShell scripts with portable Node commands:

```bash
wefter slice run --slice-id 0
wefter guard implementation-slice-loop --run-id <run-id> --mode ReadyForReview --task-id T00-001
wefter guard implementation-slice-loop --run-id <run-id> --mode ReadyForNextTask --task-id T00-001
wefter guard implementation-slice-loop --run-id <run-id> --mode ReadyForFinalValidation
```

## Safety Rule

Agents must not implement code directly from a macro `IMPLEMENTATION_SLICES.md`. The safe path is slice plan, task specs, adversarial review, approval, task-level TDD, task review and final validation.
