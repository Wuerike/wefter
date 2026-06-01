# Safety Model

Wefter workflows are designed as gated loops, not free-form agent prompts.

Core rules:

- Detection and correction are separate workflows.
- Documentation audit agents must not edit source documentation.
- Documentation repair must plan before editing and pause on unresolved human decisions.
- Runtime artifacts are written under `.audit/wefter/` by default.
- Versioned workflow configuration is written under `.wefter/` by default.
- Paths are target-repository relative and must not contain `..`.
- Run directories are staged before becoming visible as final runs.
- OpenCode agent permissions restrict write access to configured artifact paths.
- Implementation work must be task-level, reviewed and validated before moving to the next work unit.

OpenCode must be restarted after installing or changing agents, skills or commands.
