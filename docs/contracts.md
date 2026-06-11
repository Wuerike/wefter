# Workflow Contracts

This document defines the input and output contracts for the product development agent suite.

Default artifact root: `docs/wefter/` in the target application repository.

The first generated artifact must be `00-index.md`. It records setup choices and workflow state.

## Global Contract Rules

- Each stage can consume 1 to N documents.
- Each stage can produce 1 to N documents.
- Documents should contain metadata frontmatter with `artifact`, `stage`, `status`, `depends_on`, `feeds`, and `human_review`.
- Generated artifacts must use `artifact_language` from `00-index.md`; the user chooses this value during setup.
- `workflow_mode: standard` is the default and maps to medium complexity.
- Low, medium, and high complexity are runtime choices per stage or module, not installation variants.
- A stage may mark downstream artifacts as stale instead of rewriting them immediately.
- Implementation cannot start before human task approval.
- Implementation is TDD-first by default: each task needs a test-first plan, red/green/refactor evidence, or an explicit reviewed exception.
- The next module cannot begin until the current module is closed.

## Stage Contracts

| Stage | Entry Contract | Exit Contract | Human Gate |
| --- | --- | --- | --- |
| Setup/bootstrap | Any message, missing artifact root, or missing `00-index.md` | `00-index.md`, draft `05-ops/artifact-map.md` | Required for artifact language |
| Discovery | Any rough idea | `01-discovery/idea-brief.md`, `01-discovery/research-plan.md` | Optional |
| Competitor intelligence | User accepts web research or asks for it | `competitors/*.md`, `competitor-matrix.md` with sources | Optional |
| Feature synthesis | Idea brief plus optional competitor matrix | `feature-landscape.md` | Optional |
| Product refinement | Feature landscape and user choices | `product-strategy.md`, `feature-catalog.md`, `module-map.md`, `roadmap.md` | Required before module work |
| Module refinement | Approved module map and selected module | Module brief, product spec, technical spec, decisions, architecture and testing updates | Required before tasking if open scope remains |
| Task planning | Complete module specs | `tasks.md`, pending decision list, TDD plan, review checklist | Required before development |
| Agentic development | Human-approved tasks | Test changes, code changes, TDD evidence, implementation log, decisions, task reviews | Per review loop |
| Artifact governance | Any artifact change | Artifact map, change propagation, review queue | Optional or required when stale docs block work |

## Stage 0: Bootstrap

Input:

- Any message or a repo with no wefter artifacts.

Required user decisions:

- `artifact_language`: explicit language/locale for generated artifacts.
- `workflow_mode`: default `standard` unless the user chooses `light` or `deep`.
- `artifact_root`: default `docs/wefter`.
- `competitor_research_policy`: ask when needed, offer during discovery, or skip unless requested.

Required outputs:

- `docs/wefter/00-index.md`
- `docs/wefter/05-ops/artifact-map.md` draft

Exit criteria:

- Artifact root exists.
- Current stage and next action are visible.
- Artifact language is explicitly recorded.

Index metadata contract:

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

## Complexity Contract

| Complexity | Contract Impact |
| --- | --- |
| Low | Compact artifacts, fewer alternatives, focused TDD/verification, but gates still apply |
| Medium | Standard artifacts and gates, default for `workflow_mode: standard` |
| High | Deeper research, stronger architecture/testing/security traceability, more explicit tradeoffs |

Complexity can be set per stage or module without changing installation.

## Stage 1: Discovery

Input:

- Any natural-language idea.
- Existing repo context when relevant.

Required outputs:

- `docs/wefter/01-discovery/idea-brief.md`
- `docs/wefter/01-discovery/research-plan.md`

Exit criteria:

- Problem, users, jobs, assumptions, risks, and unknowns are explicit.
- Internet research has been offered and its status is recorded.

## Stage 2: Competitor Intelligence

Input:

- User consent for web research.
- `idea-brief.md`
- `research-plan.md`

Required outputs:

- `docs/wefter/01-discovery/competitors/<product-slug>.md`
- `docs/wefter/01-discovery/competitor-matrix.md`

Exit criteria:

- Each researched product has sources.
- Features and positioning are analyzed, not just listed.
- Inference is separated from observed facts.

## Stage 3: Feature Synthesis

Input:

- `idea-brief.md`
- Optional `competitor-matrix.md`
- Optional competitor profiles

Required outputs:

- `docs/wefter/01-discovery/feature-landscape.md`

Exit criteria:

- Feature groups are categorized.
- Core features are distinguished from optional directions.
- Deferred, risky, or speculative areas are explicit.

## Stage 4: Product Refinement

Input:

- `feature-landscape.md`
- Optional competitor research
- User-selected direction or preferences

Required outputs:

- `docs/wefter/02-product/product-strategy.md`
- `docs/wefter/02-product/feature-catalog.md`
- `docs/wefter/02-product/module-map.md`
- `docs/wefter/02-product/roadmap.md`

Exit criteria:

- Target segment, main job, promise, differentiation, and tradeoffs are explicit.
- Selected/deferred/rejected features are recorded.
- Modules are defined and ordered.
- First active module is selected.

## Stage 5: Module Refinement

Input:

- Approved `module-map.md`
- Selected module id
- Existing codebase and architecture docs

Required outputs:

- `docs/wefter/04-modules/<module-id>/module-brief.md`
- `docs/wefter/04-modules/<module-id>/product-spec.md`
- `docs/wefter/04-modules/<module-id>/technical-spec.md`
- `docs/wefter/04-modules/<module-id>/decisions.md`
- Architecture docs under `03-architecture/` when needed
- `docs/wefter/03-architecture/testing-strategy.md` when no strategy exists or the module changes test approach

Exit criteria:

- Product behavior and technical approach are clear enough to generate tasks.
- Testability boundaries, test levels, test commands, and TDD exceptions are explicit.
- Open decisions are listed.
- Architecture updates are made or marked as not needed.

## Stage 6: Task Planning

Input:

- Complete module docs.
- Existing architecture docs.

Required outputs:

- `docs/wefter/04-modules/<module-id>/tasks.md`
- Updated `decisions.md` with pending decisions

Exit criteria:

- Each task is independently implementable and reviewable.
- Acceptance criteria, TDD plan, and verification expectations exist.
- Each task identifies the first failing test to write or explains why test-first is not practical.
- Human approval status is visible.

## Stage 7: Agentic Development

Input:

- Human-approved `tasks.md`
- Active task id
- Module specs and decision log
- Testing strategy and task TDD plan

Required outputs:

- Test changes and code changes
- Red/green/refactor evidence or a reviewed TDD exception
- `implementation-log.md`
- `task-reviews/<task-id>.md`
- Updated `decisions.md`

Exit criteria per task:

- Acceptance criteria satisfied.
- A failing test was written before production code when practical.
- Green verification was run after implementation and after refactor when refactor occurred.
- Verification completed or inability documented.
- Adversarial review passed.
- Task status updated.

Exit criteria per module:

- All tasks complete.
- All reviews passed.
- All TDD exceptions are justified and reviewed.
- Implementation log is current.
- Artifact map and propagation docs are current.

## Stage 8: Artifact Governance

Input:

- Any artifact change.
- Current artifact tree.

Required outputs:

- `docs/wefter/05-ops/artifact-map.md`
- `docs/wefter/05-ops/change-propagation.md`
- `docs/wefter/05-ops/human-review-queue.md` when needed

Exit criteria:

- Downstream stale risks are identified.
- Human review blockers are explicit.
- Mermaid graph reflects current artifact dependencies.
