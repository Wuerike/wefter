# Scope

## Included

- Define `delivery-implementation` vocabulary and map it to legacy `work-unit-implementation` artifacts.
- Decide whether `.wefter/specs/releases/<release-id>/DELIVERABLES.md` becomes the default implementation source.
- Add compatibility rules for existing work-unit configs, agents, skills, schemas and commands.
- Define migration docs and tests before introducing executable aliases.
- Preserve current task/review guards and task-level TDD flow.

## Excluded

- Removing `wefter work-unit run` or `wefter work-unit guard`.
- Renaming files in already installed user repositories without explicit migration.
- Creating product specs or technical shaping outputs.

## Constraints

- Product shaping remains responsible for deliverables only, not tasks.
- Delivery implementation may decompose deliverables into tasks only after handoff validation.
- Legacy names may remain as aliases but must not become canonical in new docs.
