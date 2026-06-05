# Roadmap

Wefter development should move in small workflow releases. Each release must preserve installed-project compatibility unless a migration path is explicit.

## Current Foundation

- `product-shaping` is available and produces `DELIVERABLES.md` as the product handoff.
- `work-unit-implementation` remains the executable implementation engine under legacy vocabulary.
- `technical-shaping` is registered as planned metadata only; it must not install commands until implemented.
- `init` records installed files in `.wefter/install-manifest.json`; `uninstall` removes manifest-recorded files safely.

## Next Release Order

1. `delivery-implementation-migration`
2. `technical-shaping-foundation`
3. CLI modularization and schema validation hardening

## Delivery Implementation Migration

Goal: migrate vocabulary and defaults from `work-unit-implementation` toward `delivery-implementation` without breaking existing installations.

Required decisions:

- Whether `DELIVERABLES.md` becomes the default implementation source document.
- Which legacy command aliases remain and for how long.
- Whether schemas are renamed, aliased or versioned in place.
- How OpenCode agent names transition without invalidating existing configs.

Non-goals:

- Do not remove `work-unit` commands in the first migration release.
- Do not change product-shaping responsibilities.
- Do not create technical design artifacts in delivery implementation.

## Technical Shaping Foundation

Goal: define a workflow between product-shaped deliverables and delivery implementation.

Required outputs:

- Technical decisions and constraints.
- Data contracts and interface expectations.
- Verification strategy for delivery implementation.
- Explicit human gates for architecture, security, persistence and migration decisions.

Activation rule:

`technical-shaping` commands stay in `plannedCommands` until the workflow has process docs, config/profile defaults, prompt templates, agents, schemas, CLI run generation and validation tests.
