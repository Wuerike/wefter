# Scope

## Included

- Make `product-shaping` available as a Wefter workflow using the approved doctrine.
- Keep product specs under `.wefter/specs/` by default.
- Keep installed workflow files under `.wefter/workflows/` by default.
- Keep runtime artifacts for product shaping under `.wefter/runs/` by default.
- Add schemas, configs, profiles, prompts, OpenCode agents, skill installation, CLI run generation, validation, repair hooks and tests needed for product shaping.
- Add a doctrine-vs-derived-artifacts autoaudit profile for product shaping.
- Integrate the product handoff with current legacy `work-unit-implementation` without renaming it.

## Excluded

- Refactoring `work-unit-implementation` to `delivery-implementation`.
- Renaming `WORK_UNITS.md`, work-unit schemas, work-unit commands or work-unit agents.
- Changing existing `documentation-audit` runtime defaults unless required for product-shaping integration.
- Creating task specs during product shaping.
- Making product decisions not recorded in the approved doctrine or this release spec.

## Constraints

- The approved README is the primary doctrine.
- `DELIVERABLES.md` must stay at deliverable granularity.
- Legacy vocabulary may appear only for compatibility or migration.
- Any default outside `.wefter/` requires an explicit integration reason.
