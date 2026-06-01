# Documentation Audit

This workflow is the first executable Wefter module. It generates a resumable audit run from a repository-specific profile, executes redundant auditor passes, consolidates raw findings and validates candidates adversarially.

## Inputs

- `wefter.config.json`
- Documentation audit profile at `.wefter/workflows/documentation-audit/profile.json` by default
- Prompt templates installed at `.wefter/workflows/documentation-audit/templates/`

## Outputs

```text
.audit/wefter/documentation-audit/<run-id>/
  manifest.json
  prompts/
  raw/
  consolidation/
  validation/
  final/
```

## Commands

```bash
wefter docs audit
wefter new-run documentation-audit
```

```text
/wefter-audit-docs
/wefter-generate-doc-audit-profile
```

## Safety

The audit is read-only with respect to source documentation. Correction belongs to `documentation-repair`.
