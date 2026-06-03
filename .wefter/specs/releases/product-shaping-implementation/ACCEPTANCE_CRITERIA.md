# Acceptance Criteria

## Release Acceptance

- `product-shaping` has installable workflow artifacts derived from `src/workflows/product-shaping/README.md`.
- Default product-shaping paths are `.wefter/specs/`, `.wefter/workflows/` and `.wefter/runs/` unless overridden by config.
- Required product spec file contracts are represented in schemas, prompts, agents or validators.
- `wefter product shape` can create a product-shaping run plan or run artifact set using safe repository-relative paths.
- OpenCode agents and skill for product shaping are installed by `wefter init` when the workflow is enabled.
- Product-shaping prompts contain no unresolved template placeholders after installation.
- Product-shaping validation blocks missing required files, unresolved release blockers, scope/domain/acceptance drift and invalid deliverable statuses.
- Product-shaping repair respects raw-source immutability and conflict evidence rules.
- Documentation-audit can audit product-shaping doctrine against derived artifacts.
- Legacy `work-unit-implementation` remains available and is not renamed as part of this release.
- Tests cover CLI generation, path safety, template rendering, OpenCode installation and a smoke path for product shaping.
- General Wefter docs reflect product-shaping availability only after implementation, tests and autoaudit pass.

## Non-Acceptance

- Passing tests is not enough if generated artifacts contradict the approved README.
- Product shaping is not available if it creates task specs directly.
- Product shaping is not available if runtime artifacts default to `.audit/wefter/` for this workflow.
