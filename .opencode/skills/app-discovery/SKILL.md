---
name: app-discovery
description: Use for application idea discovery from a short prompt, including idea expansion, assumptions, target users, problems, and initial research planning.
---

# App Discovery

Use this skill when a product idea is vague, new, or not yet represented by `docs/wefter/01-discovery/idea-brief.md`.

Before using this skill, ensure setup has created `00-index.md`. Use `artifact_language` from the index for all generated artifacts.

## Contract

Input:

- Any natural-language idea.
- Optional existing product docs.

Output:

- `docs/wefter/00-index.md` if missing.
- `docs/wefter/01-discovery/idea-brief.md`.
- `docs/wefter/01-discovery/research-plan.md`.
- A short question or option list for the next step.

Complexity:

- Low: compact idea brief and the next most important question.
- Medium: standard idea brief and research plan.
- High: deeper assumptions, validation paths, and broader research plan.

## Workflow

1. Read existing docs and repo context if present.
2. If `00-index.md` is missing, ask `wefter` to run setup before writing artifacts.
3. Expand the idea into problem, target users, use cases, alternatives, and assumptions.
4. Separate facts from assumptions.
5. Identify the riskiest unknowns.
6. Offer internet research for similar products and competitors according to the research policy.
7. If the user accepts, proceed to competitor intelligence.
8. If the user declines, continue with local assumptions clearly marked.

## Idea Brief Template

```markdown
---
artifact: idea-brief
stage: discovery
status: draft
owner_agent: discovery-strategist
depends_on: []
feeds:
  - docs/wefter/01-discovery/research-plan.md
  - docs/wefter/01-discovery/feature-landscape.md
human_review: optional
last_updated: YYYY-MM-DD
language: <artifact_language>
---

# Idea Brief

## Raw Input

Original user idea.

## Expanded Concept

Clear explanation of the product idea.

## Target Users

- Segment
- Context
- Current alternatives

## Jobs To Be Done

- When...
- I want to...
- So I can...

## Problems And Pains

- Pain
- Evidence or assumption
- Severity

## Value Proposition

Main promise and why it may matter.

## Assumptions

| Assumption | Why It Matters | Confidence | Validation Path |
| --- | --- | --- | --- |

## Risks

| Risk | Impact | Mitigation Or Research |
| --- | --- | --- |

## Open Questions

- Question
```

## Research Plan Template

```markdown
---
artifact: research-plan
stage: discovery
status: draft
owner_agent: discovery-strategist
depends_on:
  - docs/wefter/01-discovery/idea-brief.md
feeds:
  - docs/wefter/01-discovery/competitor-matrix.md
human_review: optional
last_updated: YYYY-MM-DD
---

# Research Plan

## Research Goals

- Find similar products.
- Understand feature conventions.
- Understand positioning and differentiation.
- Identify gaps and opportunities.

## Search Angles

- Direct competitors
- Adjacent substitutes
- Open-source alternatives
- Manual/offline alternatives
- Enterprise products
- SMB/self-serve products

## Candidate Queries

- query

## Products To Investigate

| Product | Why Relevant | Priority |
| --- | --- | --- |

## User Consent

Internet research: pending|accepted|declined
```
