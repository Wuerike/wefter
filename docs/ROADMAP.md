# Roadmap

Wefter development should move in small workflow releases. Compatibility matters only for shipped behavior with users or persisted project data; otherwise prefer the simpler current vocabulary.

## Current Foundation

- `product-shaping` is available and produces `DELIVERABLES.md` as the product handoff.
- `delivery-implementation` is available as the public implementation workflow.
- Delivery runtime paths, artifact roots, agents, prompts and schemas use `delivery-implementation` terminology.
- `technical-shaping` is registered as planned metadata only; it must not install commands until implemented.
- `init` records installed files in `.wefter/install-manifest.json`; `uninstall` removes manifest-recorded files safely.

## Next Release Order

1. `technical-shaping-foundation`
2. CLI modularization and schema validation hardening

## Delivery Implementation Migration

Status: complete. Runtime vocabulary and defaults now use canonical `delivery-implementation` names.

Required decisions:

- `DELIVERABLES.md` is the default implementation source document.
- Delivery schemas are named `delivery-*`.
- Installed OpenCode agents use `wefter-delivery-*` names.

Non-goals:

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
