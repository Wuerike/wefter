# Product Shaping Intake

Run: {{RUN_ID}}
Release: {{RELEASE_ID}}

Read first:

- {{PROCESS_DOC_PATH}}
- {{CONTRACT_PATH}}
- {{CONFIG_PATH}}
- {{SPEC_ROOT}}/README.md when present

Write or repair only intake artifacts under {{SPEC_ROOT}}.

Required files:

{{REQUIRED_FILES}}

Responsibilities:

- Create or update `README.md`, `discovery/SOURCE_MATERIALS.md`, `discovery/IDEA_BRIEF.md` and `discovery/OPEN_QUESTIONS.md`.
- Do not edit artifacts outside those intake files.
- Preserve raw source material as source material; do not turn it into scope, roadmap, domain rules or deliverables.
- Record unresolved questions in {{OPEN_QUESTIONS_PATH}}.

Stop conditions:

- Problem, user or expected value is unclear.
- A decision-relevant idea lacks source material, market reference or recorded product decision.
- The work requires roadmap, release scope, deliverables or technical decisions.
