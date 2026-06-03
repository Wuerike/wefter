# Product-Shaping Delivery Handoff Compatibility

The canonical product-shaping handoff is:

```text
.wefter/specs/releases/<release-id>/DELIVERABLES.md
```

The current executable implementation engine is still `work-unit-implementation`. Until it is migrated to `delivery-implementation`, use an explicit compatibility mapping instead of renaming the legacy workflow.

## Legacy CLI Mapping

Run the legacy implementation workflow against a product-shaping deliverables document by overriding the source document:

```bash
wefter work-unit run --release-id <release-id> --work-units-document .wefter/specs/releases/<release-id>/DELIVERABLES.md --work-unit-id <deliverable-id>
```

Mapping:

| Product-shaping term | Legacy implementation term |
| --- | --- |
| release | release |
| deliverable | work unit |
| `DELIVERABLES.md` | work units document |
| delivery implementation | `work-unit-implementation` |

Rules:

- This is compatibility language only.
- Product-shaping artifacts must continue to use `deliverable` and `DELIVERABLES.md`.
- The legacy workflow must not redefine product scope, domain behavior or acceptance criteria.
- Future migration to `delivery-implementation` is tracked separately and remains out of scope for the product-shaping implementation release.
