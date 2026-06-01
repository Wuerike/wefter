# Workflows

Wefter workflow IDs are stable nouns. CLI and OpenCode commands use verbs.

| Workflow ID | CLI | OpenCode | Status |
| --- | --- | --- | --- |
| `product-shaping` | `wefter product shape` | `/wefter-shape-product` | Planned |
| `documentation-audit` | `wefter docs audit` | `/wefter-audit-docs` | Available |
| `documentation-repair` | `wefter docs repair` | `/wefter-repair-docs` | Available |
| `technical-shaping` | `wefter technical shape` | `/wefter-shape-technical` | Planned |
| `work-unit-implementation` | `wefter work-unit run`, `wefter work-unit guard` | `/wefter-run-work-unit` | Available |

The first implementation release keeps `documentation-audit` executable and registers the full architecture. `documentation-repair` can generate repair runs from final audit reports with planning, human-decision gates, repair application and review prompts. `work-unit-implementation` can generate planning runs, orchestrate plan review, enforce deterministic task/review guards and validate a completed work unit.
