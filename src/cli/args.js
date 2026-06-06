import { VERSION } from "./constants.js";

export function printHelp() {
  console.log(`wefter ${VERSION}

Usage:
  wefter init [--yes] [--force] [--target <path>] [--profile-path <path>] [--artifact-root <path>] [--template-root <path>] [--process-doc-path <path>] [--runner-command <command>]
  wefter uninstall [--target <path>] [--yes] [--force] [--dry-run]
  wefter product shape [--target <path>] [--release-id <id>] [--run-name <name>] [--spec-root <path>] [--run-root <path>] [--config-path <path>] [--profile-path <path>] [--dry-run]
  wefter product validate [--target <path>] [--release-id <id>] [--run-id <id> | --run-root <path>] [--config-path <path>] [--json]
  wefter docs audit [--target <path>] [--profile-path <path>] [--run-name <name>] [--passes-per-lens <n>] [--max-audits <n>] [--dry-run]
  wefter docs repair [--target <path>] --audit-report <path> [--run-name <name>] [--dry-run]
  wefter delivery run [--target <path>] [--deliverable-id <id>] [--deliverables-document <path>] [--release-id <id>] [--product-run-id <id> | --product-run-root <path>] [--run-name <name>] [--passes-per-lens <n>] [--max-audits <n>] [--config-path <path>] [--profile-path <path>] [--dry-run]
  wefter delivery guard [--target <path>] [--run-id <id> | --run-root <path>] [--task-id <id>] [--mode Status|ReadyForReview|ReadyForNextTask|ReadyForFinalValidation] [--config-path <path>] [--json]
  wefter new-run documentation-audit [--target <path>] [--profile-path <path>] [--run-name <name>] [--passes-per-lens <n>] [--max-audits <n>] [--dry-run]
  wefter profile scaffold [--target <path>] [--force]
  wefter profile import [--target <path>] --source <path> [--force]
  wefter doctor [--target <path>]

Commands:
  init              Install opencode agents, skill, commands, templates and local config.
  uninstall         Remove files recorded in the Wefter install manifest.
  product shape     Generate one product-shaping run skeleton.
  product validate  Validate product-shaping specs against the completion gate.
  docs audit        Generate one documentation audit run from the configured profile.
  docs repair       Generate one documentation repair run from a final audit report.
  delivery run      Generate one delivery implementation run.
  delivery guard    Validate task/review loop state for a delivery run.
  new-run           Generate one workflow run. Currently supports documentation-audit.
  profile scaffold  Create a heuristic starter audit profile for the current repository.
  profile import    Import a repository-relative documentation audit profile into the configured profile path.
  doctor            Validate local installation and configuration.
`);
}

export function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    if (["yes", "force", "dry-run", "help", "version", "json"].includes(key)) {
      flags[key] = true;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    flags[key] = next;
    i++;
  }

  return { positional, flags };
}

export function allowedFlagsForCommand(command, subcommand) {
  if (command === "init") {
    return ["yes", "force", "target", "profile-path", "artifact-root", "template-root", "process-doc-path", "runner-command"];
  }
  if (command === "uninstall") {
    return ["target", "yes", "force", "dry-run"];
  }
  if (command === "new-run") {
    return ["target", "profile-path", "run-name", "passes-per-lens", "max-audits", "dry-run"];
  }
  if (command === "docs" && subcommand === "audit") {
    return ["target", "profile-path", "run-name", "passes-per-lens", "max-audits", "dry-run"];
  }
  if (command === "docs" && subcommand === "repair") {
    return ["target", "audit-report", "run-name", "dry-run"];
  }
  if (command === "product" && subcommand === "shape") {
    return ["target", "release-id", "run-name", "spec-root", "run-root", "config-path", "profile-path", "dry-run"];
  }
  if (command === "product" && subcommand === "validate") {
    return ["target", "release-id", "run-id", "run-root", "config-path", "json"];
  }
  if (command === "delivery" && subcommand === "run") {
    return ["target", "deliverable-id", "deliverables-document", "release-id", "product-run-id", "product-run-root", "run-name", "passes-per-lens", "max-audits", "config-path", "profile-path", "dry-run"];
  }
  if (command === "delivery" && subcommand === "guard") {
    return ["target", "run-id", "run-root", "task-id", "mode", "config-path", "json"];
  }
  if (command === "profile" && subcommand === "scaffold") {
    return ["target", "force"];
  }
  if (command === "profile" && subcommand === "import") {
    return ["target", "source", "force"];
  }
  if (command === "doctor") {
    return ["target"];
  }
  return null;
}

export function assertKnownFlags(flags, allowedFlags) {
  const allowed = new Set(["help", "version", ...allowedFlags]);
  for (const key of Object.keys(flags)) {
    if (!allowed.has(key)) {
      throw new Error(`Unsupported option --${key} for this command.`);
    }
  }
}
