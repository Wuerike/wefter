# Installation

From a published package:

```bash
npx @wefter/opencode init
```

From a local checkout:

```bash
node <path-to-opencode-wefter>/bin/wefter.js init --target <path-to-project> --yes
```

Then restart OpenCode and run:

```text
/wefter-generate-doc-audit-profile
/wefter-shape-product
/wefter-audit-docs
/wefter-repair-docs
/wefter-run-work-unit
```

Validate an installation with:

```bash
wefter doctor
```

Import an existing repository-specific documentation audit profile, such as a legacy `docs/audits/lenses.json`, with:

```bash
wefter profile import --source docs/audits/lenses.json --force
```

Run a one-off audit with a repository-specific profile without changing config:

```bash
wefter docs audit --profile-path docs/audits/lenses.json --passes-per-lens 1 --max-audits 12
```

Generate a documentation repair run from a validated audit report with:

```bash
wefter docs repair --audit-report .audit/wefter/documentation-audit/<run-id>/final/final-documentation-audit-report.md
```
