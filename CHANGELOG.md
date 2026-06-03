# Changelog

All notable changes to this project will be documented in this file.

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
