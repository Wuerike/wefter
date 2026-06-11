---
name: artifact-governance
description: Use to maintain docs/wefter artifact health, Mermaid dependency graphs, stale document propagation, and human review queues.
---

# Artifact Governance

Use this skill whenever product, architecture, module, task, or decision artifacts are created or changed.

Use `artifact_language` from `00-index.md`. Keep `00-index.md` current whenever the workflow state changes.

## Contract

Input:

- Changed artifact path or planned artifact update.
- Current `docs/wefter/` tree.

Output:

- Updated `docs/wefter/05-ops/artifact-map.md`.
- Updated `docs/wefter/05-ops/change-propagation.md`.
- Updated `docs/wefter/05-ops/human-review-queue.md` when review is needed.

Complexity:

- Low: only mark blocking stale artifacts.
- Medium: standard dependency and propagation tracking.
- High: fuller traceability and review queue detail.

## Artifact Boundaries

- Discovery explains problem, market, competitors, and possible features.
- Product docs explain positioning, selected features, modules, and roadmap.
- Architecture docs explain cross-module technical direction.
- Module docs explain one module in detail.
- Task docs explain implementation units for one module.
- Ops docs explain document dependencies, stale risk, and review state.

## Propagation Rules

- Upstream changes can make downstream docs stale.
- Downstream discoveries can propose updates upstream, but should not silently rewrite strategy.
- Mark stale docs explicitly when a full update is not safe in the current step.
- Avoid duplicated truth. If two docs overlap, clarify ownership in `artifact-map.md`.

## Artifact Map Requirements

`artifact-map.md` must include:

- Generated artifact tree.
- Mermaid graph of generation dependencies.
- Mermaid graph of propagation paths.
- Table of artifact ownership and boundaries.
- Table of stale/update rules.
- A reference to `00-index.md` as the workflow state source of truth.

## Artifact Map Template

````markdown
---
artifact: artifact-map
stage: ops
status: draft
owner_agent: artifact-cartographer
depends_on:
  - docs/wefter/**/*.md
feeds:
  - docs/wefter/05-ops/change-propagation.md
  - docs/wefter/05-ops/human-review-queue.md
human_review: optional
last_updated: YYYY-MM-DD
language: <artifact_language>
---

# Artifact Map

## Tree

```text
docs/wefter/
  00-index.md
  01-discovery/
    idea-brief.md
    research-plan.md
    competitors/<product-slug>.md
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
      task-reviews/<task-id>.md
  05-ops/
    artifact-map.md
    change-propagation.md
    human-review-queue.md
```

## Generation Graph

```mermaid
flowchart TD
  raw[Raw user idea] --> idea[01-discovery/idea-brief.md]
  idea --> plan[01-discovery/research-plan.md]
  plan --> competitors[01-discovery/competitors/*.md]
  competitors --> matrix[01-discovery/competitor-matrix.md]
  idea --> landscape[01-discovery/feature-landscape.md]
  matrix --> landscape
  landscape --> strategy[02-product/product-strategy.md]
  strategy --> catalog[02-product/feature-catalog.md]
  catalog --> modules[02-product/module-map.md]
  strategy --> roadmap[02-product/roadmap.md]
  modules --> brief[04-modules/module/module-brief.md]
  brief --> pspec[04-modules/module/product-spec.md]
  brief --> tspec[04-modules/module/technical-spec.md]
  pspec --> decisions[04-modules/module/decisions.md]
  tspec --> decisions
  decisions --> tasks[04-modules/module/tasks.md]
  tspec --> arch[03-architecture/*.md]
  tspec --> testing[03-architecture/testing-strategy.md]
  testing --> tasks
  tasks --> impl[04-modules/module/implementation-log.md]
  impl --> reviews[04-modules/module/task-reviews/*.md]
  testing --> reviews
  reviews --> impl
  idea --> amap[05-ops/artifact-map.md]
  strategy --> amap
  arch --> amap
  tasks --> amap
```

## Propagation Graph

```mermaid
flowchart LR
  idea[Idea brief changes] --> landscape[Recheck feature landscape]
  landscape --> strategy[Recheck product strategy]
  strategy --> modules[Recheck module map]
  modules --> active[Recheck active module docs]
  active --> tasks[Recheck tasks]
  tasks --> impl[Recheck implementation status]
  tspec[Technical spec changes] --> arch[Recheck architecture docs]
  arch --> tasks
  testing[Testing strategy changes] --> tasks
  testing --> reviews[Recheck task reviews]
  decisions[Decision log changes] --> tasks
  decisions --> reviews[Recheck task reviews]
```
````

## Change Propagation Template

```markdown
# Change Propagation

| Changed Artifact | Potentially Stale Artifacts | Required Action | Owner | Status |
| --- | --- | --- | --- | --- |
```

## Human Review Queue Template

```markdown
# Human Review Queue

| Artifact | Reason | Blocking? | Requested Decision | Status |
| --- | --- | --- | --- | --- |
```
