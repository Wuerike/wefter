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
- `workflows`: registry of available and planned workflow IDs.

Paths are repository-relative and validated before use.

## Workflow Modules

Workflow modules live under `src/workflows/<workflow-id>/` and expose `workflow.json` as their contract. The initial architecture registers:

- `product-shaping`
- `documentation-audit`
- `documentation-repair`
- `technical-shaping`
- `work-unit-implementation`

Only `documentation-audit` is currently executable through the CLI. `work-unit-implementation` is represented as a planned module while the existing reference workflow semantics are ported to Node.

## Documentation Audit Run

`wefter docs audit` reads config and profile, then writes a run under the configured artifact root.

Run generation uses staging:

```text
<artifactRoot>/.tmp/<run-id>/
  -> <artifactRoot>/<run-id>/
```

This avoids exposing partially generated final runs after an interrupted creation.

## OpenCode Integration

The installer writes:

- `.opencode/agent/wefter-doc-audit-orchestrator.md`
- `.opencode/agent/wefter-doc-auditor.md`
- `.opencode/agent/wefter-doc-audit-consolidator.md`
- `.opencode/agent/wefter-doc-audit-validator.md`
- `.opencode/agent/wefter-doc-audit-profile-builder.md`
- `.opencode/skills/documentation-audit/SKILL.md`
- `opencode.json` commands `/wefter-audit-docs` and `/wefter-generate-doc-audit-profile`

OpenCode must be restarted after installation because configuration is loaded once at startup.
