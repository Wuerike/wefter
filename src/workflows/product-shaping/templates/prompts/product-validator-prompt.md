# Product Shaping Validator

Run: {{RUN_ID}}
Release: {{RELEASE_ID}}

Read operating instructions first:

- {{PROCESS_DOC_PATH}}
- {{CONTRACT_PATH}}

Read product specs in hard utilization order:

- {{SPEC_ROOT}}/README.md
- {{SPEC_ROOT}}/releases/{{RELEASE_ID}}/README.md
- {{SPEC_ROOT}}/PRODUCT_VISION.md
- {{PRODUCT_DECISIONS_PATH}}
- {{SCOPE_PATH}}
- {{DOMAIN_SPEC_PATH}}
- {{ACCEPTANCE_CRITERIA_PATH}}
- {{DELIVERABLES_PATH}}
- {{SPEC_ROOT}}/product/DOMAIN_MODEL.md
- {{SPEC_ROOT}}/product/OPERATIONAL_FLOW.md
- {{SPEC_ROOT}}/product/FEATURE_CATALOG.md
- {{SPEC_ROOT}}/product/MODULE_ROADMAP.md
- {{OPEN_QUESTIONS_PATH}}
- {{SPEC_ROOT}}/discovery/IDEA_BRIEF.md
- {{SPEC_ROOT}}/references/README.md
- {{SPEC_ROOT}}/references/<reference>.md files when present

Then inspect supporting source material:

- {{SPEC_ROOT}}/discovery/SOURCE_MATERIALS.md
- {{SPEC_ROOT}}/releases/README.md

Validate:

- Every required file exists or is explicitly blocked.
- Every required file respects its responsibility and limits.
- {{OPEN_QUESTIONS_PATH}} has no unresolved blocker for {{RELEASE_ID}}.
- {{SCOPE_PATH}}, {{DOMAIN_SPEC_PATH}}, {{ACCEPTANCE_CRITERIA_PATH}} and {{DELIVERABLES_PATH}} are consistent.
- Every implementation-intended deliverable is `ready`.
- {{DELIVERABLES_PATH}} is the only handoff to delivery implementation.
- Applicable documentation-audit drift findings have been reviewed and resolved, marked not applicable, or recorded as blockers/human decisions.
- Adversarial review evidence exists at {{ADVERSARIAL_REVIEW_PATH}}.
- Final validation evidence is written at {{FINAL_VALIDATION_PATH}}.

Write final validation under {{RUN_ROOT}}/final, specifically {{FINAL_VALIDATION_PATH}}.

Passing evidence format:

- Include `Status: pass` only if all completion gate checks pass.
- Include `Ready for delivery implementation: yes` only when {{DELIVERABLES_PATH}} is valid as the delivery handoff.
- Include `Documentation drift findings reviewed: yes` only after applicable documentation-audit drift findings were checked.

Do not pass validation with unresolved conflicts, missing required files or blocking questions.
