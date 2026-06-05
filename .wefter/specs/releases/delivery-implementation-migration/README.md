# Delivery Implementation Migration Release

Release ID: `delivery-implementation-migration`

Purpose: migrate Wefter's executable implementation workflow to canonical `delivery-implementation` vocabulary.

Migration status: complete. Public CLI, OpenCode entry points, runtime paths, agents, prompts, schemas, manifests and generated artifacts now use `delivery-implementation` vocabulary. Because there are no users yet, no public compatibility aliases are retained.

Canonical upstream input: product-shaped `DELIVERABLES.md`.

Source of truth:

- `src/workflows/product-shaping/README.md`
- `src/workflows/delivery-implementation/README.md`
- `docs/ROADMAP.md`

Still out of scope:

- Implementing `technical-shaping`.
- Changing product-shaping spec responsibilities.
