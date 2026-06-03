# Domain Spec

## Domain Concepts

`product-shaping` workflow
: Wefter workflow that converts an idea into product specs, release scope, acceptance criteria and implementation deliverables.

`spec root`
: Configurable root for versioned product specs. Default: `.wefter/specs/`.

`workflow root`
: Configurable root for installed process docs, configs, profiles and templates. Default: `.wefter/workflows/`.

`run root`
: Configurable root for runtime artifacts. Default: `.wefter/runs/`.

`release`
: Canonical Wefter delivery scope for product shaping.

`deliverable`
: Verifiable implementation handoff item inside a release. It is not a task spec.

`task`
: Implementation-level unit produced only by delivery implementation.

## Required Behavior

- Product shaping installation exposes CLI and OpenCode entry points without making the workflow available before its required artifacts exist.
- Run generation creates or updates product spec files under the configured spec root.
- Run generation records runtime artifacts under the configured run root.
- Agents and prompts enforce file contracts, creation order, utilization order, precedence, drift prevention and completion gate from the approved README.
- Validators block completion when required files, traceability, scope, domain spec, acceptance criteria or deliverables are missing or contradictory.
- Repair behavior may adjust candidate or approved product artifacts, but must not alter raw source material or erase conflict evidence.
- Delivery handoff uses `DELIVERABLES.md` and cross-checks against `SCOPE.md`, `DOMAIN_SPEC.md`, `ACCEPTANCE_CRITERIA.md` and `PRODUCT_DECISIONS.md`.

## Compatibility Behavior

- Existing `work-unit-implementation` remains available as the current implementation engine.
- Product-shaping deliverables may be adapted into legacy work-unit inputs only through explicit compatibility mapping.
- `phase`, `slice` and `work unit` are not canonical product-shaping vocabulary.
