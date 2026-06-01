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
```

Validate an installation with:

```bash
wefter doctor
```
