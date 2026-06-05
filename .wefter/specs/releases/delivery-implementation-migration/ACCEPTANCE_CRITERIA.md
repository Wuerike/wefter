# Acceptance Criteria

## Release Acceptance

- Runtime names, schemas, agents, prompts, manifests and generated artifacts use `delivery-implementation` vocabulary.
- Public CLI and OpenCode tests exercise `delivery-implementation` commands.
- `wefter delivery run`, `wefter delivery guard` and `/wefter-run-delivery` are available as the implementation workflow surface.
- New docs and installed prompts use `DELIVERABLES.md` as the delivery handoff document.
- `wefter work-unit`, `/wefter-run-work-unit` and public `work-unit-implementation` skill files are not installed.
- `doctor` validates the delivery-era installation.
- Uninstall removes files from current delivery-era installations.

## Non-Acceptance

- The release is not accepted if public docs or installed OpenCode commands advertise `wefter work-unit`.
- The release is not accepted if delivery commands create artifacts under old implementation runtime roots.
- The release is not accepted if product shaping starts creating task specs.
- The release is not accepted if implementation can bypass product-shaping handoff validation when consuming `DELIVERABLES.md`.
