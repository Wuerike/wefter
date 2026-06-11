# Wefter for OpenCode

[![CI](https://github.com/Wuerike/wefter/actions/workflows/ci.yml/badge.svg)](https://github.com/Wuerike/wefter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40wefter%2Fopencode.svg)](https://www.npmjs.com/package/@wefter/opencode)

Wefter installs OpenCode agents and skills for an agentic application development workflow: discovery, competitor research, product refinement, technical refinement, module planning, task generation, TDD-first implementation, and adversarial review.

The package is designed to be installed into any repository that uses OpenCode. It does not require an active git repository and does not overwrite existing configuration unless explicitly forced.

## Package

```text
package: @wefter/opencode
cli: wefter
primary agent: wefter
default artifact root: docs/wefter/
install manifest: .opencode/wefter.manifest.json
```

## Included Files

- `.opencode/agents`: specialized agents for each workflow stage.
- `.opencode/skills`: OpenCode skills with workflow rules, contracts, and templates.
- `docs`: methodology, contracts, and generated artifact documentation.
- `scripts/wefter.mjs`: cross-platform install, uninstall, check, and list commands.
- `scripts/validate.mjs`: validation for agents, skills, frontmatter, Markdown fences, and installable files.
- `package.json`: exposes the `wefter` binary for npm and local links.

## Installation

With npm/npx:

```bash
npx @wefter/opencode install --target /path/to/repository
```

If `--target` is omitted, Wefter installs into the current directory.

From a local checkout:

```bash
node scripts/wefter.mjs install --target /path/to/repository
```

Windows example:

```bash
node scripts/wefter.mjs install --target "C:\path\to\repository"
```

Overwrite existing Wefter-managed files in the target:

```bash
node scripts/wefter.mjs install --target /path/to/repository --force
```

Preview the install without writing files:

```bash
node scripts/wefter.mjs install --target /path/to/repository --dry-run
```

After installing, restart OpenCode. Config, agents, and skills are loaded only when OpenCode starts.

## Uninstall

With npm/npx:

```bash
npx @wefter/opencode uninstall --target /path/to/repository
```

From a local checkout:

```bash
node scripts/wefter.mjs uninstall --target /path/to/repository
```

Windows example:

```bash
node scripts/wefter.mjs uninstall --target "C:\path\to\repository"
```

Uninstall removes only the agents, skills, and manifest installed by Wefter. Product artifacts generated in the target repository, under `docs/wefter/` by default, are not removed.

If an installed file was modified manually, uninstall aborts for safety. Use `--force` only when you intentionally want to remove modified Wefter files.

## Inspection And Validation

List installable files:

```bash
node scripts/wefter.mjs list
```

Check an installation in another repository:

```bash
node scripts/wefter.mjs check --target /path/to/repository
```

Validate Wefter before installing or committing changes:

```bash
npm run validate
```

## Basic Usage

1. Install Wefter into the repository where you want to work.
2. Restart OpenCode.
3. Select the `wefter` agent.
4. On first use, answer setup questions for artifact language, workflow mode, artifact root, and competitor research policy.
5. Send a rough idea, for example: `I want to build a platform for gyms to manage workouts and payments`.
6. Wefter starts at discovery and advances stage by stage, blocking the next module until the current module is refined, implemented, and reviewed.

## Initial Setup

The agent does not infer artifact language automatically. It asks before creating `docs/wefter/00-index.md`.

Recommended default configuration:

```yaml
workflow_mode: standard
artifact_language: en-US
artifact_root: docs/wefter
complexity_default: medium
competitor_research_policy: offer-during-discovery
```

`workflow_mode: standard` is the default. Installation does not change by mode; the agent uses complexity to calibrate depth at runtime.

## Stage Complexity

- Low: fast MVP path, compact documentation, and focused verification.
- Medium: recommended default with standard contracts and gates.
- High: deeper research, stronger product/technical traceability, and stricter review.
- Across all complexity levels, implementation is TDD-first by default: write a failing test, implement the smallest passing change, refactor, and record evidence.

Users can ask for stage-specific depth, for example: `make this module high complexity` or `continue discovery with low complexity`.

## Workflow Principles

- Start from minimal input; one sentence can be enough.
- Run setup before the first generated artifact to define language and root.
- Offer web research before studying competitors.
- Consolidate features into groups, core scope, and possible branches.
- Select positioning and features before splitting work into modules.
- Work on one module at a time until final implementation and review.
- Generate tasks only after product and technical refinement are complete.
- Plan tests with each task, including the first expected failing test and verification commands.
- Require human review before agentic development starts.
- Implement tasks with a red/green/refactor TDD loop whenever a viable test harness exists.
- Record all decisions made during development.
- Use adversarial review for each task, including TDD evidence and missing-test checks.
- Maintain an artifact tree with dependencies and change propagation.

## Generated Artifacts

By default, agents and skills create and maintain documents under:

```text
docs/wefter/
```

The most important navigation and artifact health file is:

```text
docs/wefter/05-ops/artifact-map.md
```

It contains Mermaid graphs with the file tree, generation dependencies, downstream dependencies, and documents that should be revisited when an artifact changes.

## Documentation

- `docs/contracts.md`: input and output contracts by stage.
- `docs/artifacts.md`: generated artifact specification for target repositories.
- `docs/methodology.md`: methods combined by the workflow and how they guide the flow.
- `docs/artifact-map-template.md`: Mermaid template for the artifact map.
