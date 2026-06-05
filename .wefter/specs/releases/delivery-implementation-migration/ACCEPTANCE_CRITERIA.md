# Acceptance Criteria

## Release Acceptance

- A compatibility map documents old and new workflow names, commands, config paths, schema names, agent names and skill names.
- Existing `work-unit-implementation` tests continue to pass without fixture rewrites unrelated to vocabulary.
- New docs explain when users should use `DELIVERABLES.md` instead of `WORK_UNITS.md`.
- Any new `delivery` command is an alias or wrapper until a full workflow rename is complete.
- `doctor` can validate both legacy and migration-era installations.
- Uninstall remains able to remove installed Wefter files created before and after the migration.

## Non-Acceptance

- The release is not accepted if existing `wefter work-unit` commands break.
- The release is not accepted if product shaping starts creating task specs.
- The release is not accepted if implementation can bypass product-shaping handoff validation when consuming `DELIVERABLES.md`.
