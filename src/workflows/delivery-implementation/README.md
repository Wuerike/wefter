# Delivery Implementation

Public workflow for Wefter delivery implementation.

`delivery-implementation` is the implementation workflow. It generates delivery plans, runs adversarial plan review, gates task execution, enforces task/review transitions and validates completed delivery work.

## Commands

```bash
wefter delivery run --deliverable-id 0 --product-run-id <product-run-id>
wefter delivery guard --run-id <run-id> --mode ReadyForReview --task-id T00-001
wefter delivery guard --run-id <run-id> --mode ReadyForNextTask --task-id T00-001
wefter delivery guard --run-id <run-id> --mode ReadyForFinalValidation
```

```text
/wefter-run-delivery
```

## Runtime Notes

- `delivery run` creates artifacts under the configured delivery artifact root.
- `--deliverable-id` selects the delivery unit.
- `--deliverables-document` selects the deliverables document.
- Product-shaped `DELIVERABLES.md` under the configured product spec root must pass product validation before delivery implementation consumes it.
