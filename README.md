# doc-auditor

Installable documentation audit workflow for opencode projects.

`doc-auditor` installs a reusable audit engine: opencode agents, a skill, generic prompt templates and a CLI that generates resumable audit runs. The only project-specific artifact is the audit profile selected during installation.

## Status

Early product extraction. The package is usable locally, but the public npm publishing flow is not finalized yet.

## Concepts

| Layer | Purpose | Project-specific |
| --- | --- | --- |
| Engine | CLI, agents, skill and prompt templates | No |
| Local config | Paths chosen during installation | Yes, but only installation settings |
| Audit profile | Corpus, variants and lenses for one repository | Yes |
| Audit artifacts | Generated prompts, raw findings, consolidation and final report | Runtime output |

Default local config:

```json
{
  "version": 1,
  "profilePath": ".doc-auditor/profile.json",
  "artifactRoot": ".doc-auditor/runs",
  "templateRoot": ".doc-auditor/templates",
  "processDocPath": ".doc-auditor/README.md",
  "runnerCommand": "node <path-to-doc-auditor>/bin/doc-auditor.js"
}
```

The user can choose all paths and the `runnerCommand` during installation. Workflow files under `.doc-auditor/` are intended to be versioned; add `.doc-auditor/runs/` to `.gitignore` only if you do not want to track generated runs.

## Local Development

From this repository:

```bash
npm run check
node bin/doc-auditor.js --help
```

Install into another project from this checkout:

```bash
node <path-to-doc-auditor>/bin/doc-auditor.js init --target <path-to-project> --yes
```

## Intended User Flow

```bash
npx doc-auditor init
```

Restart opencode, then use:

```text
/doc-audit-generate-profile
/doc-audit-full-run
```

CLI checks are also available:

```bash
doc-auditor doctor
doc-auditor new-run --passes-per-lens 1 --max-audits 12
```

## Safety Model

- Installed agents render permissions using the configured artifact root and profile path.
- `new-run` writes through a staging directory and only moves the final run after all files are generated.
- Paths in `doc-auditor.config.json` must be relative to the target repository and must not contain `..`.
- Run names are plain directory names and cannot contain path separators.
- Audit execution must not edit source documentation; correction is a separate workflow.

## Commands

### `doc-auditor init`

Installs local config, opencode agents, the opencode skill, prompt templates, process docs, starter profile and opencode commands.

Options:

- `--target <path>`: target project. Defaults to current directory.
- `--yes`: accept defaults without prompts.
- `--force`: replace previously installed doc-auditor files and commands when they differ.
- `--profile-path <path>`: where the audit profile should be saved.
- `--artifact-root <path>`: where generated audit runs should be saved.
- `--template-root <path>`: where prompt templates should be installed.
- `--process-doc-path <path>`: where workflow documentation should be installed.
- `--runner-command <command>`: command the orchestrator should use before `new-run`.

### `doc-auditor new-run`

Generates one audit run from the configured profile.

Options:

- `--run-name <name>`
- `--passes-per-lens <n>`
- `--max-audits <n>`
- `--dry-run`

### `doc-auditor profile scaffold`

Writes a generic starter profile to the configured profile path.

### `doc-auditor doctor`

Validates config, profile, templates, opencode agents, skill, commands, permissions and unresolved placeholders.

## Product Direction

Next steps before a stable release:

1. Add automated tests around `init`, `doctor` and `new-run`.
2. Add an uninstall or manifest-based cleanup flow.
3. Decide package name and publishing scope.
4. Add generated profile proposals that better use repository structure.
5. Harden release and package publishing automation.
