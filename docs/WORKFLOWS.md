# Workflows

Wefter workflow IDs are stable nouns. CLI and OpenCode commands use verbs.

| Workflow ID | CLI | OpenCode | Status |
| --- | --- | --- | --- |
| `product-shaping` | `wefter product shape` | `/wefter-shape-product` | Planned |
| `documentation-audit` | `wefter docs audit` | `/wefter-audit-docs` | Available |
| `documentation-repair` | `wefter docs repair` | `/wefter-repair-docs` | Planned |
| `technical-shaping` | `wefter technical shape` | `/wefter-shape-technical` | Planned |
| `implementation-slice-loop` | `wefter slice run` | `/wefter-run-slice` | Planned |

The first implementation phase keeps `documentation-audit` executable and registers the full architecture. `implementation-slice-loop` is next, using the existing reference workflow as source material while replacing PowerShell scripts with Node commands.
