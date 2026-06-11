# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- Replaced the legacy Wefter workflow implementation with the installable Wefter OpenCode agent and skill suite.
- Renamed the primary agent, workflow skill, CLI, manifest and default artifact root to the `wefter` vocabulary.

## 0.5.0 - 2026-06-05

- Refactored the CLI into modular core, install and workflow command modules so new workflows can be added without expanding the entrypoint.
- Kept `src/cli/main.js` as a small dispatcher while preserving existing public command behavior.

## 0.4.0 - 2026-06-05

- Completed the internal delivery runtime rename: configs, schemas, agents, prompts, manifests and artifacts now use `delivery-implementation` vocabulary with `wefter delivery run`, `wefter delivery guard` and `/wefter-run-delivery` as the only implementation entry points.

## 0.3.0 - 2026-06-05

- Added `.wefter/install-manifest.json` generation during `init` and a safe `wefter uninstall` command.
- Added install manifest schema and documentation for previewing/removing Wefter-managed files.
- Added roadmap and internal release specs for `delivery-implementation-migration` and `technical-shaping-foundation`.
- Opted GitHub Actions workflows into Node 24 for JavaScript actions while preserving package test coverage across supported Node versions.

## 0.2.1 - 2026-06-04

Stabilizes the `0.2.x` workflow contracts after the product-shaping release.

- Clarified that planned workflows do not install executable CLI or OpenCode commands until implemented.
- Moved future `technical-shaping` command names to planning metadata instead of executable command metadata.
- Hardened work-unit config and workflow manifest schemas to better match runtime validation.
- Added per-command CLI flag validation so unsupported options fail fast instead of being silently ignored.
- Added CI coverage across Node 18, 20, 22 and 24, and hardened manual npm publish inputs to require an existing tag.
- Updated local development, installation and self-audit documentation to distinguish package defaults from Wefter dogfooding config.

## 0.2.0 - 2026-06-02

Promotes `product-shaping` to an available workflow.

- Added available-by-default product-shaping workflow installation, CLI run generation, OpenCode command, agents, skill, prompts, contracts and schemas.
- Added product-shaping completion gate validation for required specs, ready deliverables, adversarial review evidence and final validation evidence.
- Added `DELIVERABLES.md` handoff validation before legacy work-unit implementation can consume product-shaping output.
- Added product-shaping doctrine autoaudit profile and repaired audit findings across schemas, prompts, agents, CLI behavior and docs.
- Hardened product-shaping schemas and runtime checks for canonical file order, vocabulary, relative paths, manifest outputs, handoff and gate evidence.
- Expanded CLI tests for product-shaping availability, path safety, handoff validation and OpenCode installation.

## 0.1.0 - 2026-06-02

Initial public release of Wefter for OpenCode.

- Added the `wefter` CLI for installing and validating OpenCode workflow packs.
- Added documentation audit workflow generation, profile import, profile scaffolding, and doctor validation.
- Added documentation repair workflow generation from validated audit reports.
- Added work-unit implementation workflow generation and task/review guard validation.
- Added reusable OpenCode agents, skills, commands, workflow manifests, prompt templates, and schemas.
- Added path-safety checks and automated CLI tests for core workflow operations.
