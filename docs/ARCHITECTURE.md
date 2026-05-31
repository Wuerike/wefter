# Architecture

`doc-auditor` separates reusable audit infrastructure from repository-specific audit intent.

## Reusable Engine

The reusable engine contains:

- CLI command runner.
- opencode agents.
- opencode skill.
- Generic prompt templates.
- Config and profile schemas.

These files should not encode any single product domain.

## Local Configuration

`doc-auditor.config.json` stores installation choices for one repository:

- `profilePath`: project-specific audit profile.
- `artifactRoot`: generated run output root.
- `templateRoot`: installed generic templates.
- `processDocPath`: installed workflow documentation.
- `runnerCommand`: command used by the orchestrator to invoke `doc-auditor new-run`.

Paths are repository-relative and validated before use.

## Audit Profile

The audit profile is the main project-specific artifact. It defines:

- Corpus include/exclude globs.
- Variants: ways to analyze the corpus.
- Lenses: repository-specific consistency checks.

The profile builder agent can create the profile from repository inspection.

## Audit Run

`doc-auditor new-run` reads config and profile, then writes a run under the configured artifact root.

Run generation uses staging:

```text
<artifactRoot>/.tmp/<run-id>/
  -> <artifactRoot>/<run-id>/
```

This avoids exposing partially generated final runs after an interrupted creation.

## opencode Integration

The installer writes:

- `.opencode/agent/doc-audit-orchestrator.md`
- `.opencode/agent/doc-auditor.md`
- `.opencode/agent/doc-audit-consolidator.md`
- `.opencode/agent/doc-audit-validator.md`
- `.opencode/agent/doc-audit-profile-builder.md`
- `.opencode/skills/documentation-audit-loop/SKILL.md`
- `opencode.json` commands

opencode must be restarted after installation because configuration is loaded once at startup.
