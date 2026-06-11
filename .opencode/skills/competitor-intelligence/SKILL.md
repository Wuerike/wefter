---
name: competitor-intelligence
description: Use after web research is accepted to study competitors, similar products, feature sets, pricing signals, and positioning with sources.
---

# Competitor Intelligence

Use this skill when the user accepts internet research or asks for competitor/product research.

Use `artifact_language` from `00-index.md` for generated artifacts. Do not perform web research unless the user accepted it or explicitly requested it.

## Contract

Input:

- `docs/wefter/01-discovery/idea-brief.md`.
- `docs/wefter/01-discovery/research-plan.md`.
- Optional user-provided company/product names.

Output:

- `docs/wefter/01-discovery/competitors/<product-slug>.md` for each researched product.
- `docs/wefter/01-discovery/competitor-matrix.md`.
- Updated `research-plan.md` with accepted/declined status if needed.

Complexity:

- Low: short scan of obvious direct comparables.
- Medium: standard profiles and matrix.
- High: deeper research across direct competitors, adjacent substitutes, open-source alternatives, and manual/offline substitutes.

## Research Depth

For each product, capture:

- Category and positioning.
- Target users and buyer type.
- Core workflows.
- Feature set.
- Onboarding and activation cues.
- Pricing signal or packaging if public.
- Integrations and ecosystem.
- AI/automation/collaboration/analytics depth if relevant.
- Strengths.
- Weaknesses or gaps.
- Strategic tradeoffs.
- Sources.

## Source Rules

- Prefer official pages, docs, changelogs, pricing pages, support centers, app stores, GitHub repos, and public case studies.
- Cite URL and access date.
- Mark inference separately from observed fact.
- Do not invent details when sources are weak.

## Competitor File Template

```markdown
---
artifact: competitor-profile
stage: discovery
status: draft
owner_agent: competitor-researcher
depends_on:
  - docs/wefter/01-discovery/idea-brief.md
  - docs/wefter/01-discovery/research-plan.md
feeds:
  - docs/wefter/01-discovery/competitor-matrix.md
human_review: optional
last_updated: YYYY-MM-DD
language: <artifact_language>
---

# <Product Name>

## Snapshot

- Website:
- Category:
- Target customer:
- Positioning:
- Pricing signal:

## Observed Features

| Feature | Evidence | Notes |
| --- | --- | --- |

## Core Workflows

- Workflow

## Positioning Analysis

How the product appears to compete.

## Strengths

- Strength

## Weaknesses Or Gaps

- Weakness

## Strategic Tradeoffs

- Tradeoff

## Sources

| Source | URL | Accessed | Claim Supported |
| --- | --- | --- | --- |

## Inferences

- Inference and confidence
```

## Matrix Template

```markdown
---
artifact: competitor-matrix
stage: discovery
status: draft
owner_agent: competitor-researcher
depends_on:
  - docs/wefter/01-discovery/competitors/*.md
feeds:
  - docs/wefter/01-discovery/feature-landscape.md
  - docs/wefter/02-product/product-strategy.md
human_review: optional
last_updated: YYYY-MM-DD
---

# Competitor Matrix

## Compared Products

| Product | Segment | Positioning | Core Workflow | Pricing Signal | Notes |
| --- | --- | --- | --- | --- | --- |

## Feature Comparison

| Feature Group | Product A | Product B | Product C | Notes |
| --- | --- | --- | --- | --- |

## Positioning Map

Axes and observations.

## Patterns

- Common feature or strategic pattern

## Opportunities

- Possible gap or underserved angle

## Risks

- Competitive risk
```
