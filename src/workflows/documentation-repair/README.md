# Documentation Repair

Available workflow for applying validated documentation audit findings while keeping detection and correction separate.

`wefter docs repair --audit-report <path>` creates a repair run under `.audit/wefter/documentation-repair/<run-id>/` with prompts for:

- repair planning
- gated documentation edits
- repair review

The workflow plans repairs before editing, stops on unresolved human decisions, applies only approved documentation changes, reviews the result, and recommends a follow-up documentation audit scope.
