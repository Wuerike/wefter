# Artifact Map Template

Copy this structure into `docs/wefter/05-ops/artifact-map.md` in a target repository, then keep it updated as artifacts are created or changed.

## Template

````markdown
---
artifact: artifact-map
stage: ops
status: draft
owner_agent: artifact-cartographer
language: <artifact_language>
depends_on:
  - docs/wefter/**/*.md
feeds:
  - docs/wefter/05-ops/change-propagation.md
  - docs/wefter/05-ops/human-review-queue.md
human_review: optional
last_updated: YYYY-MM-DD
---

# Artifact Map

## Generated Tree

```text
docs/wefter/
  00-index.md
  01-discovery/
    idea-brief.md
    research-plan.md
    competitors/
      <product-slug>.md
    competitor-matrix.md
    feature-landscape.md
  02-product/
    product-strategy.md
    feature-catalog.md
    module-map.md
    roadmap.md
  03-architecture/
    system-context.md
    architecture-decision-log.md
    data-model.md
    integration-map.md
    security-privacy.md
    testing-strategy.md
  04-modules/
    <module-id>/
      module-brief.md
      product-spec.md
      technical-spec.md
      decisions.md
      tasks.md
      implementation-log.md
      task-reviews/
        <task-id>.md
  05-ops/
    artifact-map.md
    change-propagation.md
    human-review-queue.md
```

## Generation Graph

```mermaid
flowchart TD
  setup[Initial setup] --> index[00-index.md]
  raw[Raw user idea] --> idea[01-discovery/idea-brief.md]
  index --> idea
  idea --> plan[01-discovery/research-plan.md]
  plan --> competitors[01-discovery/competitors/*.md]
  competitors --> matrix[01-discovery/competitor-matrix.md]
  idea --> landscape[01-discovery/feature-landscape.md]
  matrix --> landscape

  landscape --> strategy[02-product/product-strategy.md]
  strategy --> catalog[02-product/feature-catalog.md]
  catalog --> modules[02-product/module-map.md]
  strategy --> roadmap[02-product/roadmap.md]

  modules --> brief[04-modules/module-id/module-brief.md]
  brief --> pspec[04-modules/module-id/product-spec.md]
  brief --> tspec[04-modules/module-id/technical-spec.md]
  pspec --> decisions[04-modules/module-id/decisions.md]
  tspec --> decisions
  tspec --> arch[03-architecture/*.md]
  tspec --> testing[03-architecture/testing-strategy.md]
  testing --> tasks
  decisions --> tasks[04-modules/module-id/tasks.md]
  tasks --> impl[04-modules/module-id/implementation-log.md]
  impl --> reviews[04-modules/module-id/task-reviews/*.md]
  testing --> reviews
  reviews --> impl

  index --> amap[05-ops/artifact-map.md]
  idea --> amap
  strategy --> amap
  arch --> amap
  tasks --> amap
  reviews --> amap
```

## Propagation Graph

```mermaid
flowchart LR
  index[00-index.md changed] --> all[recheck artifact language, root, current stage]
  idea[idea-brief.md changed] --> landscape[recheck feature-landscape.md]
  landscape --> strategy[recheck product-strategy.md]
  strategy --> catalog[recheck feature-catalog.md]
  catalog --> modules[recheck module-map.md]
  modules --> moduleDocs[recheck active module docs]
  moduleDocs --> tasks[recheck tasks.md]
  tasks --> impl[recheck implementation-log.md]
  tspec[technical-spec.md changed] --> arch[recheck 03-architecture]
  arch --> tasks
  testing[testing-strategy.md changed] --> tasks
  testing --> reviews[recheck task-reviews]
  decisions[decisions.md changed] --> tasks
  decisions --> reviews[recheck task-reviews]
```

## Ownership Table

| Artifact | Source Of Truth For | Depends On | Feeds | Owner |
| --- | --- | --- | --- | --- |
| `idea-brief.md` | Problem, users, assumptions | Raw idea | Research, feature landscape | `discovery-strategist` |
| `product-strategy.md` | Positioning and tradeoffs | Feature landscape | Feature catalog, module map | `product-refiner` |
| `technical-spec.md` | Active module technical approach | Module brief, codebase | Decisions, testing strategy, tasks | `module-architect` |
| `testing-strategy.md` | TDD approach and verification boundaries | Technical spec | Tasks, implementation log, reviews | `module-architect` |
| `tasks.md` | TDD-ready implementation task contracts | Module specs, decisions, testing strategy | Implementation log, reviews | `task-planner` |

## Stale Propagation Table

| Changed Artifact | Downstream Risk | Required Action | Blocking? |
| --- | --- | --- | --- |
| `product-strategy.md` | Feature/module docs may conflict with positioning | Recheck catalog and module map | Yes if active module scope changes |
| `technical-spec.md` | Tasks may implement wrong approach | Recheck decisions and tasks | Yes before development continues |
| `testing-strategy.md` | Tasks or reviews may miss required TDD coverage | Recheck task TDD plans and review criteria | Yes before development continues |
| `decisions.md` | Code/reviews may not match accepted choice | Recheck active task and review notes | Maybe |
````
