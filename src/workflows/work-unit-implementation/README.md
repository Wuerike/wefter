# Work Unit Implementation

Wefter module for implementing one release work unit at a time. Run generation, deterministic guards and OpenCode agents are available.

The source workflow already exists in the reference project under older terminology. The standalone Wefter vocabulary is release -> work unit -> task. A work unit can be technical, functional, vertical, horizontal or validation-focused, as long as it has objective scope, dependencies, acceptance criteria and traceable tasks.

## Commands

Replace the existing reference scripts with portable Node commands:

```bash
wefter work-unit run --work-unit-id 0
wefter work-unit guard --run-id <run-id> --mode ReadyForReview --task-id T00-001
wefter work-unit guard --run-id <run-id> --mode ReadyForNextTask --task-id T00-001
wefter work-unit guard --run-id <run-id> --mode ReadyForFinalValidation
```

`wefter work-unit run`, `wefter work-unit guard` and `/wefter-run-work-unit` are implemented.

## Recommended Flow

1. Create or resume a work-unit run.
2. Generate the executable work-unit plan.
3. Run independent adversarial plan reviews using lenses and variants.
4. Consolidate raw plan findings.
5. Validate consolidated findings adversarially.
6. Repair the plan and generate candidate approved artifacts.
7. Apply the configured gate policy before publishing artifacts.
8. Publish approved artifacts to the configured execution and decision-log paths.
9. Execute one task at a time with TDD.
10. Run the `ReadyForReview` guard after each implementation or correction.
11. Review the implemented task independently.
12. Run the `ReadyForNextTask` guard after each review.
13. If review result is `Needs Fix`, correct the same task and repeat guard -> review -> guard.
14. If review result is `Blocked`, pause for human decision or specification repair.
15. Run the `ReadyForFinalValidation` guard before final validation.
16. Validate the completed work unit.

## Safety Rule

Agents must not implement code directly from a macro `WORK_UNITS.md`. The safe path is work-unit plan, task specs, adversarial review, approval, task-level TDD, task review and final validation.

## Task Review Contract

Every task review must contain exactly one `## Machine Result` block with valid JSON:

```json
{
  "taskId": "T00-001",
  "result": "Pass",
  "reviewIteration": 1,
  "blockingFindings": []
}
```

Accepted `result` values are `Pass`, `Needs Fix` and `Blocked`. `blockingFindings` must be an array, and it must be non-empty for `Needs Fix` or `Blocked`.

## Deterministic Guard Rules

- Missing task logs block review.
- Missing reviews block advancement.
- Tasks must pass in approved task-spec order.
- Malformed or inconsistent `Machine Result` blocks block advancement.
- Reviews older than task logs are stale and block advancement.
- `Needs Fix` blocks the next task until the same task receives a correction log and a fresh review.
- `Blocked` pauses the work unit.
- Final validation is allowed only when every approved task has a non-stale `Pass` review.

## Human Gates

Gate policy may require a pause before code when a plan or task involves schema/migration changes, auth/session/permission changes, tenant isolation, private storage or token handling, domain ambiguity, release scope changes, security tradeoffs or validated human decisions.
