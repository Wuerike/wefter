---
name: product-refinement
description: Use to select features, define positioning, group features into modules, and create product strategy, feature catalog, module map, and roadmap.
---

# Product Refinement

Use this skill after discovery and feature synthesis, when the user is ready to choose what the product should become.

Use `artifact_language` from `00-index.md`. Use `workflow_mode: standard` as the default baseline, and let the user override low/medium/high complexity for this stage.

## Contract

Input:

- `docs/wefter/01-discovery/feature-landscape.md`.
- `docs/wefter/01-discovery/competitor-matrix.md` when available.
- User choices or preferences.

Output:

- `docs/wefter/02-product/product-strategy.md`.
- `docs/wefter/02-product/feature-catalog.md`.
- `docs/wefter/02-product/module-map.md`.
- `docs/wefter/02-product/roadmap.md`.

Complexity:

- Low: choose a compact MVP positioning and small module map.
- Medium: standard strategy, catalog, module map, and roadmap.
- High: compare positioning options, score feature groups, and document stronger tradeoffs.

## Workflow

1. Present a small number of positioning options.
2. Help the user choose target segment, main job, promise, and tradeoffs.
3. Convert the feature landscape into selected, deferred, rejected, and unknown features.
4. Group selected features into modules.
5. Define module dependencies and recommended order.
6. Pick the first module, usually the smallest foundational slice that reduces product and technical risk.

## Product Strategy Template

```markdown
---
artifact: product-strategy
stage: product
status: human-review
owner_agent: product-refiner
depends_on:
  - docs/wefter/01-discovery/feature-landscape.md
  - docs/wefter/01-discovery/competitor-matrix.md
feeds:
  - docs/wefter/02-product/feature-catalog.md
  - docs/wefter/02-product/module-map.md
human_review: required
last_updated: YYYY-MM-DD
language: <artifact_language>
---

# Product Strategy

## Positioning

- Target segment:
- Main job:
- Product promise:
- Differentiation:
- Explicit tradeoffs:

## Non-Goals

- What this product will not optimize for now

## Success Criteria

| Criterion | Signal | Time Horizon |
| --- | --- | --- |

## Risks

| Risk | Mitigation |
| --- | --- |

## Open Product Decisions

- Decision
```

## Feature Catalog Template

```markdown
---
artifact: feature-catalog
stage: product
status: human-review
owner_agent: product-refiner
depends_on:
  - docs/wefter/01-discovery/feature-landscape.md
  - docs/wefter/02-product/product-strategy.md
feeds:
  - docs/wefter/02-product/module-map.md
human_review: required
last_updated: YYYY-MM-DD
---

# Feature Catalog

| Feature | Group | Status | Rationale | Module Candidate |
| --- | --- | --- | --- | --- |

Status values: selected, deferred, rejected, unknown.
```

## Module Map Template

```markdown
---
artifact: module-map
stage: product
status: human-review
owner_agent: product-refiner
depends_on:
  - docs/wefter/02-product/product-strategy.md
  - docs/wefter/02-product/feature-catalog.md
feeds:
  - docs/wefter/04-modules/*/module-brief.md
human_review: required
last_updated: YYYY-MM-DD
---

# Module Map

## Module Sequence

| Order | Module ID | Name | Purpose | Features | Dependencies | Status |
| --- | --- | --- | --- | --- | --- | --- |

## Active Module

- Module ID:
- Why first/next:
- Completion condition:

## Dependency Notes

- Note
```
