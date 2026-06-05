# Workflows

Wefter workflow IDs are stable nouns. CLI and OpenCode commands use verbs.

| Workflow ID | CLI | OpenCode | Status |
| --- | --- | --- | --- |
| `product-shaping` | `wefter product shape`, `wefter product validate` | `/wefter-shape-product` | Available |
| `documentation-audit` | `wefter docs audit` | `/wefter-audit-docs` | Available |
| `documentation-repair` | `wefter docs repair` | `/wefter-repair-docs` | Available |
| `delivery-implementation` | `wefter delivery run`, `wefter delivery guard` | `/wefter-run-delivery` | Available |
| `technical-shaping` | Not installed while planned | Not installed while planned | Planned |

`product-shaping`, `documentation-audit`, `documentation-repair` and `delivery-implementation` are available workflows. `documentation-repair` can generate repair runs from final audit reports with planning, human-decision gates, repair application and review prompts. `delivery-implementation` can generate planning runs, orchestrate plan review, enforce deterministic task/review guards and validate completed delivery work.

Planned workflows may document future command names in their workflow manifest, but only commands under `commands` are executable/installed. `technical-shaping` is intentionally not installed until its contract and CLI are implemented.

For workflow dogfooding and release self-audit, see `docs/SELF_AUDIT.md`.
