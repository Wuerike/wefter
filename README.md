# Wefter for OpenCode

Wefter installs reusable OpenCode workflows that weave product intent into audited specs, executable tasks, and validated implementation.

## Status

Early product extraction. The package is usable locally for `documentation-audit`, `documentation-repair`, and `work-unit-implementation`; the other workflows are architecture scaffolds.

## Package

```text
package: @wefter/opencode
repo: opencode-wefter
cli: wefter
config: wefter.config.json
local workflow files: .wefter/
runtime artifacts: .audit/wefter/
```

## Workflows

| Workflow ID | Status | Purpose |
| --- | --- | --- |
| `product-shaping` | Planned | Shape an initial idea into product docs, scope and explicit decisions. |
| `documentation-audit` | Available | Run redundant, adversarial documentation consistency audits. |
| `documentation-repair` | Available | Repair docs from a validated audit report without mixing detection and correction. |
| `technical-shaping` | Planned | Convert product docs into explicit technical decisions and implementation constraints. |
| `work-unit-implementation` | Available | Generate planning runs, orchestrate plan review, enforce task/review guards, and validate a work unit. |

## Local Development

```bash
npm run check
node bin/wefter.js --help
```

Install into another project from this checkout:

```bash
node <path-to-opencode-wefter>/bin/wefter.js init --target <path-to-project> --yes
```

## Intended User Flow

```bash
npx @wefter/opencode init
```

Restart OpenCode, then use:

```text
/wefter-generate-doc-audit-profile
/wefter-audit-docs
/wefter-repair-docs
/wefter-run-work-unit
```

CLI checks are also available:

```bash
wefter doctor
wefter docs audit --passes-per-lens 1 --max-audits 12
wefter docs audit --profile-path docs/audits/lenses.json --passes-per-lens 1 --max-audits 12
wefter profile import --source docs/audits/lenses.json --force
wefter docs repair --audit-report .audit/wefter/documentation-audit/<run-id>/final/final-documentation-audit-report.md
wefter new-run documentation-audit --passes-per-lens 1 --max-audits 12
```

## Default Config

```json
{
  "version": 1,
  "workflowRoot": ".wefter/workflows",
  "profilePath": ".wefter/workflows/documentation-audit/profile.json",
  "artifactRoot": ".audit/wefter/documentation-audit",
  "templateRoot": ".wefter/workflows/documentation-audit/templates",
  "processDocPath": ".wefter/workflows/documentation-audit/README.md",
  "runnerCommand": "node <path-to-wefter>/bin/wefter.js",
  "workflows": {
    "product-shaping": { "status": "planned", "enabled": false },
    "documentation-audit": { "status": "available", "enabled": true },
    "documentation-repair": { "status": "available", "enabled": true },
    "technical-shaping": { "status": "planned", "enabled": false },
    "work-unit-implementation": {
      "status": "available",
      "enabled": true,
      "configPath": ".wefter/workflows/work-unit-implementation/config.json",
      "lensesPath": ".wefter/workflows/work-unit-implementation/lenses.json"
    }
  }
}
```

## Safety Model

- Installed audit agents render permissions using the configured artifact root and profile path.
- `docs audit` writes through a staging directory and only moves the final run after all files are generated.
- `docs audit --profile-path` can use a repository-specific audit profile for one run without changing `wefter.config.json`.
- `profile import` validates and copies an existing repository-relative audit profile into the configured Wefter profile path.
- `docs repair` writes through a staging directory and requires an existing repository-relative audit report path.
- Paths in `wefter.config.json` must be relative to the target repository and must not contain `..`.
- Run names are plain directory names and cannot contain path separators.
- Audit execution must not edit source documentation; correction is a separate workflow.
- Repair execution must pause when validated findings require unresolved human decisions.

## Product Direction

Next steps before a stable release:

1. Add installation manifest/uninstall support.
2. Harden release and package publishing automation.
