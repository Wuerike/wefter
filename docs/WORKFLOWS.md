# Workflows

Wefter workflow IDs are stable nouns. CLI and OpenCode commands use verbs.

| Workflow ID | CLI | OpenCode | Status |
| --- | --- | --- | --- |
| `product-shaping` | `wefter product shape` | `/wefter-shape-product` | Planned |
| `documentation-audit` | `wefter docs audit` | `/wefter-audit-docs` | Available |
| `documentation-repair` | `wefter docs repair` | `/wefter-repair-docs` | Planned |
| `technical-shaping` | `wefter technical shape` | `/wefter-shape-technical` | Planned |
| `work-unit-implementation` | `wefter work-unit run` | `/wefter-run-work-unit` | Planned |

The first implementation release keeps `documentation-audit` executable and registers the full architecture. `work-unit-implementation` is next, using the existing reference workflow semantics as source material while replacing PowerShell scripts with Node commands.
