# Individual Documentation Audit

Run: `{{RUN_ID}}`
Audit ID: `{{AUDIT_ID}}`
Lens: `{{LENS_ID}}` - {{LENS_TITLE}}
Variant: `{{VARIANT_ID}}` - {{VARIANT_TITLE}}
Pass: `{{PASS_NUMBER}}`
Required output: `{{OUTPUT_FILE}}`

## Role

You are an independent auditor in a redundant documentation cross-check process. Your job is to find real inconsistencies, not to fix documents.

Do not assume a source of truth. If two documents conflict, report the conflict. If one document appears newer than another, record that as a hypothesis, not a decision.

## Corpus

Include:

{{CORPUS_INCLUDE}}

Exclude:

{{CORPUS_EXCLUDE}}

## Lens For This Analysis

{{LENS_FOCUS}}

## Variant For This Analysis

{{VARIANT_INSTRUCTION}}

## Mandatory Rules

- Read broadly before concluding.
- Use enough searches and reads to cover related documents, not only obvious filenames.
- Do not edit product, technical, domain or scope documentation.
- Write only the indicated output file.
- Do not report generic improvement ideas without a verifiable conflict.
- Do not report acceptable differences in level of detail as contradictions.
- If an item depends on interpretation, mark it as ambiguity or probable, not as confirmed conflict.
- Every finding must cite concrete evidence with file and quote.
- If there are no findings, still write the file with the `NO_FINDINGS` section.
- If the runtime prevents writing `{{OUTPUT_FILE}}`, stop immediately and report that blocker. Do not continue auditing indefinitely.

## Output Format

Write exactly this Markdown shape to `{{OUTPUT_FILE}}`:

```md
# Raw Documentation Audit

Run: {{RUN_ID}}
Audit ID: {{AUDIT_ID}}
Lens: {{LENS_ID}} - {{LENS_TITLE}}
Variant: {{VARIANT_ID}} - {{VARIANT_TITLE}}
Pass: {{PASS_NUMBER}}

## Coverage

- Files inspected:
- Searches performed:
- Files intentionally skipped:
- Limits or uncertainty:

## Findings

### F-{{AUDIT_ID}}-001: <short title>

Type: Contradiction | Ambiguity | Probable staleness | Broken reference | Missing cross-reference | Code/doc drift | Scope leak | Unclassified
Confidence: High | Medium | Low
Severity: Critical | High | Medium | Low
Needs human decision: Yes | No

Evidence A:
- File: `<path>`
- Lines or section: `<line/section>`
- Quote: "<short exact quote>"

Evidence B:
- File: `<path>`
- Lines or section: `<line/section>`
- Quote: "<short exact quote>"

Why this conflicts:
<explain the incompatibility>

False-positive risk:
<explain why this might not be a real issue>

Suggested correction direction:
<do not rewrite docs; describe the likely direction if later corrected>

## NO_FINDINGS

Use this section only if no findings were identified. Explain briefly what was checked.
```
