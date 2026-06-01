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
/wefter-audit-docs
/wefter-repair-docs
/wefter-run-work-unit
```

Validate an installation with:

```bash
wefter doctor
```

Generate a documentation repair run from a validated audit report with:

```bash
wefter docs repair --audit-report .audit/wefter/documentation-audit/<run-id>/final/final-documentation-audit-report.md
```
