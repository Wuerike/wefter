---
name: wefter-workflow
description: Use when orchestrating an end-to-end TDD product development workflow from rough idea through discovery, modules, tasks, implementation, review, and artifact governance.
---

# Wefter Workflow

Use this skill when the user wants help developing an application from an initial idea, or when the active work belongs to the `docs/wefter/` workflow.

## Default Artifact Root

Use `docs/wefter/` unless the user chooses another root during setup.

## Initial Setup

Before creating product artifacts, check whether the configured artifact root has `00-index.md`. If it does not exist, run setup and ask the user to choose:

- Artifact language: explicit choice such as `pt-BR`, `en-US`, or another locale/name.
- Workflow mode: `standard` by default, with `light` and `deep` available.
- Artifact root: `docs/wefter/` by default.
- Competitor research policy: ask when needed, offer during discovery, or skip unless requested.

Create `00-index.md` after setup. Do not infer artifact language silently from the user's message.

## Complexity Levels

The installation is always the same. Complexity is a runtime choice controlled by the agent and artifacts.

| Level | When To Use | Effect |
| --- | --- | --- |
| Low | MVP, small repo, low risk | Compact docs, fewer alternatives, focused TDD/review |
| Medium | Default/recommended | Standard contracts and gates |
| High | Strategic uncertainty, high risk, complex domain | Deeper research, stronger architecture/testing/security traceability |

`workflow_mode: standard` maps to medium complexity by default. The user can override complexity per stage or module.

## Global Gate Rules

- Any idea can start discovery.
- Setup must run before the first generated product artifact.
- Internet competitor research must be offered before it is performed.
- Artifact language must come from `00-index.md` and must be chosen by the user.
- Product positioning and selected features must be explicit before modules are finalized.
- Exactly one module is active at a time.
- Do not refine the next module until the current module is implemented and closed.
- Do not implement a module until tasks and open decisions have passed human review.
- Development is TDD-first by default: every implementation task needs a test-first plan, red/green/refactor evidence, or an explicit reviewed exception.
- During implementation, decisions can be made agentically only if they do not change product scope, legal/compliance posture, pricing, or user-visible commitments outside the active module.
- Every implementation task must pass adversarial review, including TDD evidence and missing-test checks, before it is marked complete.
- All artifact changes must update or validate the artifact dependency map.

## Stages

### 0. Bootstrap

Input: any user message, missing artifact root, or missing `00-index.md`.

Output:

- `docs/wefter/00-index.md`
- `docs/wefter/05-ops/artifact-map.md` draft

Setup output must include `workflow_mode`, `artifact_language`, `artifact_root`, `current_stage`, `active_module`, `complexity_default`, and `competitor_research_policy`.

### 1. Discovery

Input: any rough idea.

Output:

- `01-discovery/idea-brief.md`
- `01-discovery/research-plan.md`

### 2. Competitor Intelligence

Input: accepted web research or explicit competitor request.

Output:

- `01-discovery/competitors/<product-slug>.md`
- `01-discovery/competitor-matrix.md`

### 3. Feature Synthesis

Input: discovery brief plus optional competitor matrix.

Output:

- `01-discovery/feature-landscape.md`

### 4. Product Refinement

Input: selected positioning and selected feature groups.

Output:

- `02-product/product-strategy.md`
- `02-product/feature-catalog.md`
- `02-product/module-map.md`
- `02-product/roadmap.md`

### 5. Module Refinement

Input: approved module from `module-map.md`.

Output:

- `04-modules/<module-id>/module-brief.md`
- `04-modules/<module-id>/product-spec.md`
- `04-modules/<module-id>/technical-spec.md`
- `04-modules/<module-id>/decisions.md`
- Architecture docs under `03-architecture/` when needed
- `03-architecture/testing-strategy.md` when no testing strategy exists or the module changes test approach

### 6. Task Planning

Input: complete module product and technical specs.

Output:

- `04-modules/<module-id>/tasks.md`
- Updated `decisions.md` with pending decisions
- TDD plan per task
- Human review checklist

### 7. Agentic Development

Input: human-approved tasks and resolved blocking decisions.

Output:

- Code changes
- Test changes and red/green/refactor evidence
- `implementation-log.md`
- `task-reviews/<task-id>.md`
- Updated decision log

### 8. Artifact Governance

Input: any artifact change.

Output:

- Updated `05-ops/artifact-map.md`
- Updated `05-ops/change-propagation.md`
- Updated `05-ops/human-review-queue.md` when review is needed

## Artifact Metadata

Every generated markdown artifact should start with metadata like:

```yaml
---
artifact: artifact-name
stage: discovery|product|architecture|module|task|ops
status: draft|human-review|approved|implemented|stale
owner_agent: agent-name
depends_on:
  - docs/wefter/path/upstream.md
feeds:
  - docs/wefter/path/downstream.md
human_review: required|optional|complete
last_updated: YYYY-MM-DD
---
```

`00-index.md` should use:

```yaml
---
artifact: wefter-index
stage: ops
status: active
workflow_mode: standard
artifact_language: pt-BR
artifact_root: docs/wefter
current_stage: discovery
active_module: null
complexity_default: medium
competitor_research_policy: offer-during-discovery
human_review: optional
last_updated: YYYY-MM-DD
---
```

## Closing A Module

A module is closed only when:

- All tasks are complete.
- All task reviews pass.
- All TDD exceptions are justified and reviewed.
- The implementation log is current.
- Development decisions are recorded.
- Artifact map and change propagation docs are current.
- Remaining human-review notes are explicit.

## State Resume

When resuming, read `00-index.md` first. Continue from `current_stage` and `active_module`; do not restart discovery unless the user explicitly asks or upstream artifacts are stale.
