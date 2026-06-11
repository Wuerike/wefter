# Methodology

Wefter combines pragmatic parts of several software and product development methods. It is not a rigid framework; it is a gated workflow for agentic development where documents are contracts.

The workflow starts with setup. The user chooses artifact language, artifact root, and baseline workflow mode before generated product documents are created.

The default mode is `standard`, which maps to medium complexity. Complexity is adjusted per stage or module rather than through different installations.

## Product Discovery

Influences:

- Design Thinking and Double Diamond: separate problem exploration from solution refinement.
- Jobs To Be Done: describe what users are trying to accomplish, not just personas.
- Lean Startup: treat assumptions as risks to validate.
- Competitive analysis: understand market conventions and positioning before selecting scope.

How it appears in the suite:

- `idea-brief.md` captures problem, users, jobs, assumptions, and risks.
- `research-plan.md` prevents unbounded research.
- Competitor profiles separate evidence from inference.
- `feature-landscape.md` keeps possibilities broad before selection.

Depth is adaptive: low complexity keeps discovery compact, medium uses the standard flow, and high expands validation paths and competitive research.

## Product Definition

Influences:

- Product Requirements Document practices: explicit goals, non-goals, requirements, acceptance criteria.
- Strategy tradeoff thinking: good positioning says no to many things.
- Roadmapping: sequence by dependency, risk, and value.

How it appears in the suite:

- `product-strategy.md` records target segment, promise, differentiation, and tradeoffs.
- `feature-catalog.md` records selected, deferred, rejected, and unknown features.
- `module-map.md` turns scope into deliverable modules.

## Technical Architecture

Influences:

- Architecture Decision Records: decisions should have rationale and tradeoffs.
- C4-style thinking: start from system context before implementation detail.
- Domain-driven design: model domain concepts and boundaries where useful.
- Evolutionary architecture: preserve future movement without overbuilding now.

How it appears in the suite:

- `system-context.md` explains the technical environment.
- `architecture-decision-log.md` records cross-module decisions.
- `data-model.md`, `integration-map.md`, `security-privacy.md`, and `testing-strategy.md` split technical concerns.
- `technical-spec.md` stays module-specific.
- `testing-strategy.md` defines the TDD default, test levels, test commands, fixtures, and cases where test-first work is not practical.

## Delivery Planning

Influences:

- Agile slicing: deliver small valuable increments.
- Shape Up-like appetite control: keep work bounded.
- Acceptance-test thinking: tasks need observable completion criteria.

How it appears in the suite:

- `tasks.md` defines objective, scope, non-goals, acceptance criteria, verification, and review criteria.
- Every implementation task should include a TDD plan: the first failing test to write, expected red/green commands, and any justified exception.
- Human review happens before implementation starts.
- The next module is blocked until the active module is complete.

Task granularity follows complexity: low uses fewer larger tasks, medium uses standard reviewable tasks, and high uses stronger traceability.

## Agentic Development

Influences:

- Test-driven development: write a failing behavioral test before production code whenever a viable test harness exists.
- Risk-based verification: prove the risky parts, do not just produce code.
- Code review and adversarial review: review against intent, not only syntax.
- Decision logging: make agent decisions inspectable.

How it appears in the suite:

- `task-implementer` implements one approved task at a time.
- `pragmatic-decider` chooses the middle path for implementation blockers.
- Implementation follows red/green/refactor: record the failing test, make it pass with the smallest correct change, then refactor while preserving green verification.
- `adversarial-reviewer` loops until the task aligns with task, module, product spec, and technical spec.
- `implementation-log.md` and `task-reviews/*.md` keep TDD evidence, verification history, and residual risks.

## Artifact Governance

Influences:

- Traceability matrices: downstream artifacts depend on upstream decisions.
- Docs-as-code: documents are versioned operational assets.
- Change impact analysis: a change should identify what may be stale.

How it appears in the suite:

- `artifact-map.md` contains Mermaid graphs of generation and propagation dependencies.
- `change-propagation.md` lists stale risks and required action.
- `human-review-queue.md` keeps human blockers visible.

`00-index.md` is the runtime state source of truth. It records the chosen artifact language, current stage, active module, and default complexity.

## Why This Shape

The workflow is intentionally heavier before the first module because foundational product and technical choices have not been made yet. Later modules should reuse and evolve existing documents instead of restarting from scratch.

The system is designed to avoid two failure modes:

- Building too early from a vague idea.
- Over-designing a large future system before the first useful module exists.
