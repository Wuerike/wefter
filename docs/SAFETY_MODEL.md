# Safety Model

Wefter workflows are designed as gated loops, not free-form agent prompts.

Core rules:

- Detection and correction are separate workflows.
- Documentation audit agents must not edit source documentation.
- Documentation repair must plan before editing and pause on unresolved human decisions.
- Runtime artifacts are written under workflow-specific configured roots: audit, repair and delivery implementation workflows default to `.audit/wefter/`, while product-shaping defaults to `.wefter/runs/`.
- Versioned workflow configuration is written under `.wefter/` by default.
- Paths are target-repository relative and must not contain `..`.
- Run directories are staged before becoming visible as final runs.
- Installations write `.wefter/install-manifest.json`; uninstall removes manifest-recorded files only when unchanged unless `--force` is explicit.
- Documentation audit agents are read-only for source documentation; delivery implementation agents may edit repository code only after the delivery plan, gate policy and deterministic guards allow task execution.
- Implementation work must be task-level, reviewed and validated before moving to the next delivery unit.

OpenCode must be restarted after installing or changing agents, skills or commands.
