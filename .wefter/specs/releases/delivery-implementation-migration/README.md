# Delivery Implementation Migration Release

Release ID: `delivery-implementation-migration`

Purpose: migrate Wefter's executable implementation workflow from legacy `work-unit-implementation` vocabulary toward canonical `delivery-implementation` vocabulary while preserving compatibility for installed projects.

Canonical upstream input: product-shaped `DELIVERABLES.md`.

Source of truth:

- `src/workflows/product-shaping/README.md`
- `src/workflows/work-unit-implementation/README.md`
- `docs/ROADMAP.md`

Out of scope:

- Removing existing `wefter work-unit` commands in the first migration release.
- Implementing `technical-shaping`.
- Changing product-shaping spec responsibilities.
