# Architecture

Wefter separates reusable workflow infrastructure from repository-specific product, documentation and implementation intent.

## Reusable Engine

The reusable engine contains:

- CLI command runner.
- Workflow manifests.
- OpenCode agents and skills.
- Generic prompt templates.
- Config, profile and run schemas.

These files must not encode any single product domain.

## Local Configuration

`wefter.config.json` stores installation choices for one repository:

- `workflowRoot`: versioned Wefter workflow files installed in the target repository.
- `artifactRoot`: generated runtime output root for the currently available documentation audit workflow.
- `profilePath`: project-specific documentation audit profile.
- `templateRoot`: installed documentation audit prompt templates.
- `processDocPath`: installed workflow documentation.
- `runnerCommand`: command used by OpenCode orchestrators to invoke Wefter.
- `workflows`: registry of available and planned workflow IDs, with workflow-specific paths such as work-unit `configPath` and `profilePath`.

Paths are repository-relative and validated before use.

## Workflow Modules

Workflow modules live under `src/workflows/<workflow-id>/` and expose `workflow.json` as their contract. The initial architecture registers:

- `product-shaping`
- `documentation-audit`
- `documentation-repair`
- `technical-shaping`
- `work-unit-implementation`

`documentation-audit` is executable end-to-end through the CLI. `documentation-repair` generates gated repair runs from validated audit reports. `work-unit-implementation` can generate planning runs, install OpenCode agents, enforce deterministic task/review guards and validate completed work units.

## Documentation Audit Run

`wefter docs audit` reads config and profile, then writes a run under the configured artifact root.

Run generation uses staging:

```text
<artifactRoot>/.tmp/<run-id>/
  -> <artifactRoot>/<run-id>/
```

This avoids exposing partially generated final runs after an interrupted creation.

## Documentation Repair Run

`wefter docs repair --audit-report <path>` reads config and creates a run under `.audit/wefter/documentation-repair/`.

Repair runs contain prompts for planning, applying approved repairs and reviewing the repaired documentation. The generated flow separates safe documentation edits from human-decision items and recommends a follow-up audit after repair.

## OpenCode Integration

The installer writes:

- `.opencode/agent/wefter-doc-audit-orchestrator.md`
- `.opencode/agent/wefter-doc-auditor.md`
- `.opencode/agent/wefter-doc-audit-consolidator.md`
- `.opencode/agent/wefter-doc-audit-validator.md`
- `.opencode/agent/wefter-doc-audit-profile-builder.md`
- `.opencode/agent/wefter-doc-repair-orchestrator.md`
- `.opencode/agent/wefter-doc-repair-planner.md`
- `.opencode/agent/wefter-doc-repairer.md`
- `.opencode/agent/wefter-doc-repair-reviewer.md`
- `.opencode/skills/documentation-audit/SKILL.md`
- `.opencode/skills/documentation-repair/SKILL.md`
- `opencode.json` commands `/wefter-audit-docs`, `/wefter-generate-doc-audit-profile`, `/wefter-repair-docs` and `/wefter-run-work-unit`

OpenCode must be restarted after installation because configuration is loaded once at startup.
