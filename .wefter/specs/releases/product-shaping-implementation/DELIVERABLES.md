# Deliverables

Release ID: `product-shaping-implementation`

Source of truth: `src/workflows/product-shaping/README.md`

Status values: `candidate | ready | blocked | deferred | done`

## D001: Product-Shaping Defaults And Path Model

Status: done

Outcome:
Product shaping has configurable `specRoot`, `workflowRoot` and `runRoot` defaults aligned with `.wefter/specs/`, `.wefter/workflows/` and `.wefter/runs/`.

Acceptance Links:
- Default product-shaping paths are `.wefter/specs/`, `.wefter/workflows/` and `.wefter/runs/` unless overridden by config.
- `wefter product shape` can create a product-shaping run plan or run artifact set using safe repository-relative paths.

Boundaries:
- Do not change existing documentation-audit runtime defaults unless product-shaping integration needs a separate configurable override.
- Do not rename legacy work-unit defaults.

## D002: Product Spec Schemas And Contracts

Status: done

Outcome:
Required product-shaping file contracts are represented by schemas or equivalent validators for the spec tree, file responsibilities, statuses, traceability and completion gate.

Acceptance Links:
- Required product spec file contracts are represented in schemas, prompts, agents or validators.
- Product-shaping validation blocks missing required files, unresolved release blockers, scope/domain/acceptance drift and invalid deliverable statuses.

Boundaries:
- Schemas must validate product specs and workflow artifacts, not task specs.
- `proposed` is not a valid status for closed product decisions.

## D003: Workflow Manifest, Config And Profile

Status: done

Outcome:
`product-shaping` has a workflow manifest, default config and default profile that expose the workflow without making it available before required artifacts exist.

Acceptance Links:
- `product-shaping` has installable workflow artifacts derived from `src/workflows/product-shaping/README.md`.
- Default product-shaping paths are `.wefter/specs/`, `.wefter/workflows/` and `.wefter/runs/` unless overridden by config.

Boundaries:
- Keep planned/available status truthful.
- Do not mark product shaping available until release acceptance passes.

## D004: CLI Run Generation For `wefter product shape`

Status: done

Outcome:
The CLI can generate a product-shaping run using safe paths, configured roots and doctrine-derived artifact layout.

Acceptance Links:
- `wefter product shape` can create a product-shaping run plan or run artifact set using safe repository-relative paths.
- Default product-shaping paths are `.wefter/specs/`, `.wefter/workflows/` and `.wefter/runs/` unless overridden by config.

Boundaries:
- Do not create implementation task specs.
- Do not write product-shaping run artifacts to `.audit/wefter/` by default.

## D005: Product-Shaping Prompt Templates

Status: done

Outcome:
Prompt templates exist for intake, reference research, product shaping, domain modeling, release planning, audit, validation and repair.

Acceptance Links:
- Required product spec file contracts are represented in schemas, prompts, agents or validators.
- Product-shaping prompts contain no unresolved template placeholders after installation.

Boundaries:
- Prompts must inherit doctrine without duplicating the full README unnecessarily.
- Prompts must preserve agent role boundaries.

## D006: Product-Shaping OpenCode Agents

Status: done

Outcome:
OpenCode agent templates exist for the product-shaping orchestrator, intake analyst, reference researcher, shaper, domain modeler, release planner, auditor, validator and repairer.

Acceptance Links:
- OpenCode agents and skill for product shaping are installed by `wefter init` when the workflow is enabled.
- Product-shaping validation blocks missing required files, unresolved release blockers, scope/domain/acceptance drift and invalid deliverable statuses.

Boundaries:
- Agents must not invent product decisions to keep runs moving.
- Agents must not create task specs during product shaping.

## D007: Product-Shaping OpenCode Skill

Status: done

Outcome:
The OpenCode skill exposes the product-shaping workflow and points agents to the installed process doc, commands and required handoff rules.

Acceptance Links:
- OpenCode agents and skill for product shaping are installed by `wefter init` when the workflow is enabled.
- Product-shaping prompts contain no unresolved template placeholders after installation.

Boundaries:
- The skill is an integration adapter, not the source of truth.
- The skill must not redefine the approved doctrine.

## D008: `wefter init` Installation Integration

Status: done

Outcome:
`wefter init` installs product-shaping configs, process docs, templates, OpenCode agents and skill when enabled.

Acceptance Links:
- OpenCode agents and skill for product shaping are installed by `wefter init` when the workflow is enabled.
- `product-shaping` has installable workflow artifacts derived from `src/workflows/product-shaping/README.md`.

Boundaries:
- OpenCode files may be installed outside `.wefter/` only at required OpenCode discovery paths.
- Specs and runtime artifacts remain under configured Wefter roots.

## D009: Validation, Repair And Publication Gate

Status: done

Outcome:
Product-shaping validation, repair and availability gates enforce completion criteria before the workflow is considered available.

Acceptance Links:
- Product-shaping validation blocks missing required files, unresolved release blockers, scope/domain/acceptance drift and invalid deliverable statuses.
- Product-shaping repair respects raw-source immutability and conflict evidence rules.
- General Wefter docs reflect product-shaping availability only after implementation, tests and autoaudit pass.

Boundaries:
- Repair must not change raw source materials or erase conflict evidence.
- Availability must not be declared from implementation alone.

## D010: Documentation-Audit Autoaudit Profile

Status: done

Outcome:
A documentation-audit profile can compare product-shaping doctrine against derived schemas, configs, prompts, agents, skill, CLI defaults, manifests, docs and tests.

Acceptance Links:
- Documentation-audit can audit product-shaping doctrine against derived artifacts.
- Passing tests is not enough if generated artifacts contradict the approved README.

Boundaries:
- The autoaudit detects drift; repair remains a separate workflow or explicit follow-up.

## D011: Delivery Handoff Compatibility

Status: done

Outcome:
Product-shaping `DELIVERABLES.md` can be consumed by the current legacy implementation path through explicit compatibility mapping, while preserving the future `delivery-implementation` direction.

Acceptance Links:
- Legacy `work-unit-implementation` remains available and is not renamed as part of this release.
- Product shaping is not available if it creates task specs directly.

Boundaries:
- Do not rename legacy commands, schemas, agents or skill in this release.
- Compatibility mapping must not make `work unit` canonical product-shaping vocabulary.

## D012: Product-Shaping Test Coverage

Status: done

Outcome:
Tests cover CLI generation, path safety, template rendering, OpenCode installation and smoke execution for product shaping.

Acceptance Links:
- Tests cover CLI generation, path safety, template rendering, OpenCode installation and a smoke path for product shaping.
- Product-shaping prompts contain no unresolved template placeholders after installation.

Boundaries:
- Tests must check product-shaping defaults independently from documentation-audit legacy defaults.

## D013: General Documentation And Availability Update

Status: done

Outcome:
General Wefter docs describe product-shaping accurately after implementation, tests, validation and autoaudit pass.

Acceptance Links:
- General Wefter docs reflect product-shaping availability only after implementation, tests and autoaudit pass.

Boundaries:
- Do not mark product shaping available until publication gate conditions pass.
