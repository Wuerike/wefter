# Wefter for OpenCode

Wefter installs reusable OpenCode workflows that weave product intent into audited specs, executable tasks, and validated implementation.

## Status

Early product extraction. The package is usable locally for `documentation-audit`; `work-unit-implementation` is being migrated from the source project semantics; the other workflows are architecture scaffolds.

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
| `documentation-repair` | Planned | Repair docs from a validated audit report without mixing detection and correction. |
| `technical-shaping` | Planned | Convert product docs into explicit technical decisions and implementation constraints. |
| `work-unit-implementation` | Planned | Plan, review, implement and validate one release work unit at a time. |

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
```

CLI checks are also available:

```bash
wefter doctor
wefter docs audit --passes-per-lens 1 --max-audits 12
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
    "documentation-repair": { "status": "planned", "enabled": false },
    "technical-shaping": { "status": "planned", "enabled": false },
    "work-unit-implementation": { "status": "planned", "enabled": false }
  }
}
```

## Safety Model

- Installed audit agents render permissions using the configured artifact root and profile path.
- `docs audit` writes through a staging directory and only moves the final run after all files are generated.
- Paths in `wefter.config.json` must be relative to the target repository and must not contain `..`.
- Run names are plain directory names and cannot contain path separators.
- Audit execution must not edit source documentation; correction is a separate workflow.

## Product Direction

Next steps before a stable release:

1. Port work-unit implementation guards and run generation from PowerShell to Node.
2. Add automated tests around `init`, `doctor` and `docs audit`.
3. Add an uninstall or manifest-based cleanup flow.
4. Harden release and package publishing automation.
