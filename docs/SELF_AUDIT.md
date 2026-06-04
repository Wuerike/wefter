# Self Audit

Wefter can run `documentation-audit` against its own workflow source before publishing a workflow as available.

The CLI command generates the audit run and auditor prompts. It does not execute the prompts by itself; a documentation-audit orchestrator or agent must resume the generated run and complete the raw audit, consolidation and validation steps.

Use this pattern for any workflow-specific audit profile:

```bash
node bin/wefter.js docs audit --profile-path <workflow-audit-profile.json> --run-name <workflow-id>-self-audit --passes-per-lens 1 --max-audits 0
```

`--max-audits 0` means no audit prompt cap.

Product-shaping example:

```bash
node bin/wefter.js docs audit --profile-path src/workflows/product-shaping/templates/documentation-audit-profile.json --run-name product-shaping-self-audit --passes-per-lens 1 --max-audits 0
```

The Wefter repository dogfoods documentation-audit with `artifactRoot` set to `.wefter/runs/documentation-audit` in its local `wefter.config.json`. Installed projects use the public default `.audit/wefter/documentation-audit` unless their config overrides it.

Seed prompt:

```text
Audit the current workflow release against CHANGELOG.md and the workflow README.
Focus on doctrine drift, missing runtime enforcement, handoff or gate bypasses, OpenCode execution gaps, schema/contract mismatch, weak tests and release artifacts that should not be committed.
Treat prior review findings as hypotheses, not conclusions.
```

After the run is generated, resume it with:

```text
Resume the documentation audit run at .wefter/runs/documentation-audit/<run-id>.
Read manifest.json, execute every auditor prompt listed there, write each raw output to its assigned path, then run prompts/consolidate.md and prompts/validate.md.
Do not edit source files. Write only under the run directory.
```
