# Product-Shaping Delivery Handoff

The canonical product-shaping handoff is:

```text
.wefter/specs/releases/<release-id>/DELIVERABLES.md
```

The public executable implementation workflow is `delivery-implementation`, and product-shaping handoff uses delivery vocabulary.

## CLI Handoff

Run delivery implementation against a product-shaping deliverables document after product validation has passed:

```bash
wefter delivery run --release-id <release-id> --deliverables-document .wefter/specs/releases/<release-id>/DELIVERABLES.md --product-run-id <product-run-id> --deliverable-id <deliverable-id>
```

Mapping:

| Product-shaping term | Delivery implementation term |
| --- | --- |
| release | release |
| deliverable | delivery unit |
| `DELIVERABLES.md` | deliverables document |
| delivery implementation | `delivery-implementation` |

Rules:

- Product-shaping artifacts must continue to use `deliverable` and `DELIVERABLES.md`.
- Delivery implementation must not redefine product scope, domain behavior or acceptance criteria.
- Delivery implementation runtime paths and artifacts use delivery vocabulary.
