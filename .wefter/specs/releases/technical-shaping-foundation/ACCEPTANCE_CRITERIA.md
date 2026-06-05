# Acceptance Criteria

## Release Acceptance

- Required technical artifact names and responsibilities are documented.
- A schema exists for technical-shaping config and run manifest before commands are installed.
- CLI help does not list `technical shape` as executable until command implementation exists.
- Workflow manifest keeps executable `commands` empty and future names under `plannedCommands` until activation.
- Prompt and agent designs include human gates for architecture, security, persistence and migration decisions.
- Tests prove planned workflow metadata does not install OpenCode commands prematurely.

## Non-Acceptance

- The release is not accepted if technical shaping creates task specs.
- The release is not accepted if future command names appear as executable commands before CLI implementation.
- The release is not accepted if technical decisions are invented to bypass unresolved product questions.
