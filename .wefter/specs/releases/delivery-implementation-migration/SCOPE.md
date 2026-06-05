# Scope

## Included

- Define `delivery-implementation` vocabulary and apply it to runtime artifacts.
- Keep delivery CLI and OpenCode commands as the only implementation entry points.
- Use `.wefter/specs/releases/<release-id>/DELIVERABLES.md` as the product-shaped implementation source.
- Remove public legacy CLI, OpenCode, skill, schema and runtime names.
- Define release docs and tests for the completed executable delivery commands.
- Preserve current task/review guards and task-level TDD flow.

## Excluded

- Creating product specs or technical shaping outputs.

## Constraints

- Product shaping remains responsible for deliverables only, not tasks.
- Delivery implementation may decompose deliverables into tasks only after handoff validation.
- Historical legacy names may remain only in older release specs or changelog entries that explicitly describe past behavior.
