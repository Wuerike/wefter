import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const VERSION = "0.1.0";
const CONFIG_FILE = "wefter.config.json";
const DEFAULTS = Object.freeze({
  workflowRoot: ".wefter/workflows",
  profilePath: ".wefter/workflows/documentation-audit/profile.json",
  artifactRoot: ".audit/wefter/documentation-audit",
  templateRoot: ".wefter/workflows/documentation-audit/templates",
  processDocPath: ".wefter/workflows/documentation-audit/README.md"
});

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const REQUIRED_TEMPLATE_FILES = Object.freeze([
  "auditor-prompt.md",
  "consolidator-prompt.md",
  "validator-prompt.md"
]);

function printHelp() {
  console.log(`wefter ${VERSION}

Usage:
  wefter init [--yes] [--force] [--target <path>] [--profile-path <path>] [--artifact-root <path>] [--template-root <path>] [--process-doc-path <path>] [--runner-command <command>]
  wefter docs audit [--target <path>] [--run-name <name>] [--passes-per-lens <n>] [--max-audits <n>] [--dry-run]
  wefter new-run documentation-audit [--target <path>] [--run-name <name>] [--passes-per-lens <n>] [--max-audits <n>] [--dry-run]
  wefter profile scaffold [--target <path>] [--force]
  wefter doctor [--target <path>]

Commands:
  init              Install opencode agents, skill, commands, templates and local config.
  docs audit        Generate one documentation audit run from the configured profile.
  new-run           Generate one workflow run. Currently supports documentation-audit.
  profile scaffold  Create a heuristic starter audit profile for the current repository.
  doctor            Validate local installation and configuration.
`);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    if (["yes", "force", "dry-run", "help", "version"].includes(key)) {
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

function packageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

function resolveTarget(flags) {
  return path.resolve(flags.target || process.cwd());
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function quoteCommandArg(value) {
  const normalized = toPosix(path.resolve(value));
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(normalized)) {
    return normalized;
  }
  return `"${normalized.replaceAll('"', '\\"')}"`;
}

function defaultRunnerCommand() {
  return `node ${quoteCommandArg(path.join(packageRoot(), "bin/wefter.js"))}`;
}

function yamlSingleQuoted(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeRelativePath(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty relative path.`);
  }

  const trimmed = value.trim().replaceAll("\\", "/");
  if (trimmed.includes("\n") || trimmed.includes("\r")) {
    throw new Error(`${label} must not contain line breaks.`);
  }
  if (path.isAbsolute(trimmed)) {
    throw new Error(`${label} must be relative to the target repository.`);
  }

  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length === 0 || parts.includes("..")) {
    throw new Error(`${label} must not be empty or contain '..'.`);
  }

  return parts.join("/");
}

function normalizeRunnerCommand(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty command string.`);
  }
  if (value !== value.trim()) {
    throw new Error(`${label} must not contain leading or trailing whitespace.`);
  }
  if (value.includes("\n") || value.includes("\r")) {
    throw new Error(`${label} must not contain line breaks.`);
  }
  if (value.includes("{{")) {
    throw new Error(`${label} must not contain unresolved template placeholders.`);
  }
  return value;
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertAllowedKeys(value, label, allowedKeys) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} has unsupported property '${key}'.`);
    }
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
  if (value.includes("\n") || value.includes("\r")) {
    throw new Error(`${label} must not contain line breaks.`);
  }
  return value;
}

function requireId(value, label) {
  requireString(value, label);
  if (!ID_PATTERN.test(value)) {
    throw new Error(`${label} must match ${ID_PATTERN}.`);
  }
}

function requireStringArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  value.forEach((item, index) => requireString(item, `${label}[${index}]`));
}

function assertUniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`${label} contains duplicate id '${item.id}'.`);
    }
    seen.add(item.id);
  }
}

function windowsPermissionPath(relativePath) {
  return relativePath.replaceAll("/", "\\\\");
}

function windowsPermissionGlob(relativePath) {
  return `${windowsPermissionPath(relativePath)}\\\\**`;
}

function assertSafeRunName(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Run name must not be empty.");
  }
  if (value !== value.trim()) {
    throw new Error("Run name must not contain leading or trailing whitespace.");
  }
  if (path.isAbsolute(value) || value.includes("/") || value.includes("\\")) {
    throw new Error("Run name must be a plain directory name, not a path.");
  }
  if (value.includes("..")) {
    throw new Error("Run name must not contain '..'.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)) {
    throw new Error("Run name may contain only letters, numbers, dot, underscore and hyphen, and must start with a letter or number.");
  }
}

function ensureInside(targetRoot, candidate, label) {
  const relative = path.relative(targetRoot, candidate);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`${label} resolves outside the target repository.`);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read ${label} at ${filePath}: ${error.message}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeTextIfSafe(filePath, content, force) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, "utf8");
    if (current !== content && !force) {
      throw new Error(`Refusing to overwrite existing file: ${filePath}. Use --force to replace it.`);
    }
  }
  fs.writeFileSync(filePath, content, "utf8");
}

function writeJsonIfSafe(filePath, value, force) {
  writeTextIfSafe(filePath, `${JSON.stringify(value, null, 2)}\n`, force);
}

function readConfig(targetRoot) {
  const configPath = path.join(targetRoot, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing ${CONFIG_FILE}. Run wefter init first.`);
  }

  const config = readJson(configPath, CONFIG_FILE);
  return normalizeConfig(config);
}

function normalizeConfig(config) {
  assertObject(config, CONFIG_FILE);
  assertAllowedKeys(config, CONFIG_FILE, ["$schema", "version", "workflowRoot", "profilePath", "artifactRoot", "templateRoot", "processDocPath", "runnerCommand", "workflows"]);

  if (config.version !== 1) {
    throw new Error(`${CONFIG_FILE} must have version: 1.`);
  }

  const workflowRoot = normalizeRelativePath(config.workflowRoot || DEFAULTS.workflowRoot, "workflowRoot");
  const workflows = config.workflows || defaultWorkflowRegistry();
  normalizeWorkflowRegistry(workflows);

  return {
    version: 1,
    workflowRoot,
    profilePath: normalizeRelativePath(config.profilePath, "profilePath"),
    artifactRoot: normalizeRelativePath(config.artifactRoot, "artifactRoot"),
    templateRoot: normalizeRelativePath(config.templateRoot, "templateRoot"),
    processDocPath: normalizeRelativePath(config.processDocPath, "processDocPath"),
    runnerCommand: normalizeRunnerCommand(config.runnerCommand, "runnerCommand"),
    workflows
  };
}

function defaultWorkflowRegistry() {
  return {
    "product-shaping": { status: "planned", enabled: false },
    "documentation-audit": { status: "available", enabled: true },
    "documentation-repair": { status: "planned", enabled: false },
    "technical-shaping": { status: "planned", enabled: false },
    "implementation-slice-loop": { status: "planned", enabled: false }
  };
}

function normalizeWorkflowRegistry(workflows) {
  assertObject(workflows, "workflows");
  for (const [workflowId, workflow] of Object.entries(workflows)) {
    requireId(workflowId, `workflows.${workflowId}`);
    assertObject(workflow, `workflows.${workflowId}`);
    assertAllowedKeys(workflow, `workflows.${workflowId}`, ["status", "enabled", "profilePath", "configPath", "lensesPath"]);
    if (!["available", "planned"].includes(workflow.status)) {
      throw new Error(`workflows.${workflowId}.status must be available or planned.`);
    }
    if (typeof workflow.enabled !== "boolean") {
      throw new Error(`workflows.${workflowId}.enabled must be boolean.`);
    }
    for (const key of ["profilePath", "configPath", "lensesPath"]) {
      if (workflow[key] !== undefined) {
        normalizeRelativePath(workflow[key], `workflows.${workflowId}.${key}`);
      }
    }
  }
}

async function promptForValue(rl, label, defaultValue) {
  const answer = await rl.question(`${label} (${defaultValue}): `);
  return answer.trim() === "" ? defaultValue : answer.trim();
}

function renderTemplate(content, values) {
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, String(value));
  }
  return result;
}

function copyRenderedTemplate(source, destination, values, force) {
  const content = fs.readFileSync(source, "utf8");
  const rendered = renderTemplate(content, values);
  writeTextIfSafe(destination, rendered, force);
}

function copyDirectory(sourceRoot, destinationRoot, force) {
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    const source = path.join(sourceRoot, entry.name);
    const destination = path.join(destinationRoot, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(source, destination, force);
      continue;
    }
    const content = fs.readFileSync(source, "utf8");
    writeTextIfSafe(destination, content, force);
  }
}

function mergeOpencodeConfig(targetRoot, config, force) {
  const opencodePath = path.join(targetRoot, "opencode.json");
  const existing = fs.existsSync(opencodePath) ? readJson(opencodePath, "opencode.json") : { "$schema": "https://opencode.ai/config.json" };

  existing["$schema"] = existing["$schema"] || "https://opencode.ai/config.json";
  existing.watcher = existing.watcher || {};
  existing.watcher.ignore = Array.isArray(existing.watcher.ignore) ? existing.watcher.ignore : [];
  for (const ignored of [config.artifactRoot, config.templateRoot]) {
    const pattern = `${ignored.replace(/\/$/, "")}/**`;
    if (!existing.watcher.ignore.includes(pattern)) {
      existing.watcher.ignore.push(pattern);
    }
  }

  existing.skills = existing.skills || {};
  existing.skills.paths = Array.isArray(existing.skills.paths) ? existing.skills.paths : [];
  if (!existing.skills.paths.includes(".opencode/skills")) {
    existing.skills.paths.push(".opencode/skills");
  }

  existing.command = existing.command || {};
  const fullRunCommand = {
    description: "Run the Wefter documentation audit workflow end-to-end.",
    agent: "wefter-doc-audit-orchestrator",
    template: `Run the complete Wefter documentation audit workflow end-to-end. Read ${CONFIG_FILE} first. If the user provided an existing run path, resume it. Otherwise create a new run with ${config.runnerCommand} docs audit. Unless the user provided different sizing, use --passes-per-lens 3. Execute all auditor prompts in parallel batches, consolidate, validate adversarially, and report the final output path. Do not edit source documentation.`
  };
  const generateProfileCommand = {
    description: "Inspect the repository and create or update the Wefter documentation audit profile.",
    agent: "wefter-doc-audit-profile-builder",
    template: `Inspect this repository and create or update the documentation audit profile defined by ${CONFIG_FILE}. If the profile already exists, write a proposal under the configured artifact root instead of overwriting it unless the user explicitly asked to replace it.`
  };

  for (const [name, nextValue] of Object.entries({
    "wefter-audit-docs": fullRunCommand,
    "wefter-generate-doc-audit-profile": generateProfileCommand
  })) {
    if (existing.command[name] && JSON.stringify(existing.command[name]) !== JSON.stringify(nextValue) && !force) {
      throw new Error(`Refusing to overwrite existing opencode command '${name}'. Use --force to replace it.`);
    }
    existing.command[name] = nextValue;
  }

  writeJson(opencodePath, existing);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function defaultProfile(config = DEFAULTS) {
  return {
    version: 1,
    corpus: {
      include: ["*.md", "docs/**/*.md"],
      exclude: unique([
        "node_modules/**",
        ".git/**",
        ".opencode/**",
        `${config.artifactRoot}/**`,
        `${config.templateRoot}/**`,
        config.processDocPath
      ])
    },
    variants: [
      {
        id: "explicit-contradictions",
        title: "Explicit contradictions",
        instruction: "Find statements that cannot all be true at the same time. Prioritize direct conflicts in scope, state, permission, obligation, technology, workflow, data or acceptance criteria."
      },
      {
        id: "implicit-incompatibilities",
        title: "Implicit incompatibilities",
        instruction: "Find statements that look compatible in isolation but conflict when combined. Evaluate preconditions, consequences, dependencies and operational impact."
      },
      {
        id: "staleness-and-drift",
        title: "Staleness and drift",
        instruction: "Find signs that a document is outdated compared with newer decisions, terminology, status or implementation direction."
      },
      {
        id: "adversarial-edge-cases",
        title: "Adversarial edge cases",
        instruction: "Look for gaps in error states, validation, concurrency, permissions, traceability, security, incomplete data and documented limits."
      }
    ],
    lenses: [
      {
        id: "documentation-map-consistency",
        title: "Documentation map consistency",
        focus: "Compare index, overview, roadmap, technical and domain documents. Look for missing cross-references, duplicated responsibilities and contradictions between high-level and detailed documents."
      },
      {
        id: "requirements-vs-technical-guidance",
        title: "Requirements vs technical guidance",
        focus: "Compare product requirements, technical decisions, setup instructions, architecture notes and delivery guidance. Look for required behavior without technical support and technical guidance that contradicts requirements."
      },
      {
        id: "terminology-and-responsibility",
        title: "Terminology and responsibility",
        focus: "Compare glossary, naming, roles, permissions, ownership and document responsibility. Look for inconsistent terms or rules described in the wrong place."
      }
    ]
  };
}

function validateProfile(profile) {
  assertObject(profile, "Profile");
  assertAllowedKeys(profile, "Profile", ["version", "corpus", "variants", "lenses"]);

  if (profile.version !== 1) {
    throw new Error("Profile must have version: 1.");
  }

  assertObject(profile.corpus, "Profile corpus");
  assertAllowedKeys(profile.corpus, "Profile corpus", ["include", "exclude"]);
  requireStringArray(profile.corpus.include, "Profile corpus.include");
  requireStringArray(profile.corpus.exclude, "Profile corpus.exclude");

  if (!Array.isArray(profile.variants) || profile.variants.length === 0) {
    throw new Error("Profile must define at least one variant.");
  }
  profile.variants.forEach((variant, index) => {
    assertObject(variant, `Profile variants[${index}]`);
    assertAllowedKeys(variant, `Profile variants[${index}]`, ["id", "title", "instruction"]);
    requireId(variant.id, `Profile variants[${index}].id`);
    requireString(variant.title, `Profile variants[${index}].title`);
    requireString(variant.instruction, `Profile variants[${index}].instruction`);
  });
  assertUniqueIds(profile.variants, "Profile variants");

  if (!Array.isArray(profile.lenses) || profile.lenses.length === 0) {
    throw new Error("Profile must define at least one lens.");
  }
  profile.lenses.forEach((lens, index) => {
    assertObject(lens, `Profile lenses[${index}]`);
    assertAllowedKeys(lens, `Profile lenses[${index}]`, ["id", "title", "focus"]);
    requireId(lens.id, `Profile lenses[${index}].id`);
    requireString(lens.title, `Profile lenses[${index}].title`);
    requireString(lens.focus, `Profile lenses[${index}].focus`);
  });
  assertUniqueIds(profile.lenses, "Profile lenses");
}

function markdownList(items) {
  if (!items || items.length === 0) {
    return "- <none>";
  }
  return items.map((item) => `- \`${item}\``).join("\n");
}

function timestampRunName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function buildCombinations(profile, passesPerLens, maxAudits) {
  const combinations = [];
  let auditIndex = 1;

  for (const lens of profile.lenses) {
    for (const variant of profile.variants) {
      for (let pass = 1; pass <= passesPerLens; pass++) {
        if (maxAudits > 0 && combinations.length >= maxAudits) {
          return combinations;
        }
        const auditId = `A${String(auditIndex).padStart(4, "0")}__${lens.id}__${variant.id}__p${String(pass).padStart(2, "0")}`;
        combinations.push({ auditId, lens, variant, pass });
        auditIndex++;
      }
    }
  }

  return combinations;
}

async function commandInit(flags) {
  const targetRoot = resolveTarget(flags);
  fs.mkdirSync(targetRoot, { recursive: true });
  ensureInside(path.dirname(targetRoot), targetRoot, "target");

  let profilePath = flags["profile-path"] || DEFAULTS.profilePath;
  let artifactRoot = flags["artifact-root"] || DEFAULTS.artifactRoot;
  const workflowRoot = DEFAULTS.workflowRoot;
  const templateRoot = flags["template-root"] || DEFAULTS.templateRoot;
  const processDocPath = flags["process-doc-path"] || DEFAULTS.processDocPath;
  const runnerCommand = flags["runner-command"] || defaultRunnerCommand();

  if (!flags.yes && process.stdin.isTTY) {
    const rl = readline.createInterface({ input, output });
    profilePath = await promptForValue(rl, "Audit profile path", profilePath);
    artifactRoot = await promptForValue(rl, "Audit artifact root", artifactRoot);
    rl.close();
  }

  const config = normalizeConfig({
    version: 1,
    workflowRoot,
    profilePath,
    artifactRoot,
    templateRoot,
    processDocPath,
    runnerCommand,
    workflows: defaultWorkflowRegistry()
  });

  const values = {
    PROFILE_PATH: config.profilePath,
    ARTIFACT_ROOT: config.artifactRoot,
    ARTIFACT_ROOT_WINDOWS: windowsPermissionPath(config.artifactRoot),
    TEMPLATE_ROOT: config.templateRoot,
    PROCESS_DOC_PATH: config.processDocPath,
    RUNNER_COMMAND: config.runnerCommand,
    CONFIG_FILE,
    RUNNER_COMMAND_NEW_RUN_PATTERN: yamlSingleQuoted(`${config.runnerCommand}*`)
  };

  writeJsonIfSafe(path.join(targetRoot, CONFIG_FILE), {
    "$schema": "./node_modules/@wefter/opencode/schemas/wefter.config.schema.json",
    ...config
  }, flags.force);

  const root = packageRoot();
  copyRenderedTemplate(path.join(root, "src/workflows/documentation-audit/workflow.json"), path.join(targetRoot, config.workflowRoot, "documentation-audit/workflow.json"), values, flags.force);
  for (const workflowId of ["product-shaping", "documentation-repair", "technical-shaping", "implementation-slice-loop"]) {
    copyDirectory(path.join(root, "src/workflows", workflowId), path.join(targetRoot, config.workflowRoot, workflowId), flags.force);
  }
  copyRenderedTemplate(path.join(root, "templates/opencode/agent/doc-audit-orchestrator.md.tmpl"), path.join(targetRoot, ".opencode/agent/wefter-doc-audit-orchestrator.md"), values, flags.force);
  copyRenderedTemplate(path.join(root, "templates/opencode/agent/doc-auditor.md.tmpl"), path.join(targetRoot, ".opencode/agent/wefter-doc-auditor.md"), values, flags.force);
  copyRenderedTemplate(path.join(root, "templates/opencode/agent/doc-audit-consolidator.md.tmpl"), path.join(targetRoot, ".opencode/agent/wefter-doc-audit-consolidator.md"), values, flags.force);
  copyRenderedTemplate(path.join(root, "templates/opencode/agent/doc-audit-validator.md.tmpl"), path.join(targetRoot, ".opencode/agent/wefter-doc-audit-validator.md"), values, flags.force);
  copyRenderedTemplate(path.join(root, "templates/opencode/agent/doc-audit-profile-builder.md.tmpl"), path.join(targetRoot, ".opencode/agent/wefter-doc-audit-profile-builder.md"), values, flags.force);
  copyRenderedTemplate(path.join(root, "templates/opencode/skills/documentation-audit/SKILL.md.tmpl"), path.join(targetRoot, ".opencode/skills/documentation-audit/SKILL.md"), values, flags.force);
  copyDirectory(path.join(root, "templates/audit/templates"), path.join(targetRoot, config.templateRoot), flags.force);
  copyRenderedTemplate(path.join(root, "templates/audit/README.md.tmpl"), path.join(targetRoot, config.processDocPath), values, flags.force);
  mergeOpencodeConfig(targetRoot, config, flags.force);

  const profileFullPath = path.join(targetRoot, config.profilePath);
  if (!fs.existsSync(profileFullPath)) {
    writeJson(profileFullPath, defaultProfile(config));
  }

  console.log(`Installed Wefter for OpenCode into ${targetRoot}`);
  console.log(`Profile: ${config.profilePath}`);
  console.log(`Artifacts: ${config.artifactRoot}`);
  console.log(`Runner command: ${config.runnerCommand}`);
  console.log(`Tip: add ${config.artifactRoot}/ to .gitignore if you do not want to track generated audit runs.`);
  console.log("Restart opencode before using /wefter-audit-docs or /wefter-generate-doc-audit-profile.");
}

function readTextRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function assertNoPlaceholders(filePath, content) {
  const match = content.match(/{{[^}]+}}/);
  if (match) {
    throw new Error(`${filePath} contains unresolved placeholder ${match[0]}.`);
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Missing ${label}: ${expected}`);
  }
}

function commandNewRun(flags) {
  const targetRoot = resolveTarget(flags);
  const config = readConfig(targetRoot);
  const profilePath = path.join(targetRoot, config.profilePath);
  const profile = readJson(profilePath, "audit profile");
  validateProfile(profile);

  const passesPerLens = Number.parseInt(flags["passes-per-lens"] || "3", 10);
  const maxAudits = Number.parseInt(flags["max-audits"] || "0", 10);
  if (!Number.isInteger(passesPerLens) || passesPerLens < 1) {
    throw new Error("--passes-per-lens must be an integer greater than 0.");
  }
  if (!Number.isInteger(maxAudits) || maxAudits < 0) {
    throw new Error("--max-audits must be an integer greater than or equal to 0.");
  }

  const runName = flags["run-name"] || timestampRunName();
  assertSafeRunName(runName);
  const combinations = buildCombinations(profile, passesPerLens, maxAudits);

  const artifactRoot = path.join(targetRoot, config.artifactRoot);
  const tempRoot = path.join(artifactRoot, ".tmp");
  const runRoot = path.join(artifactRoot, runName);
  const stagingRunRoot = path.join(tempRoot, runName);
  ensureInside(targetRoot, artifactRoot, "artifactRoot");
  ensureInside(targetRoot, runRoot, "runRoot");
  ensureInside(targetRoot, stagingRunRoot, "stagingRunRoot");

  if (flags["dry-run"]) {
    console.log(`Run name: ${runName}`);
    console.log(`Lenses: ${profile.lenses.length}`);
    console.log(`Variants: ${profile.variants.length}`);
    console.log(`Passes per lens/variant: ${passesPerLens}`);
    console.log(`Auditor prompts to generate: ${combinations.length}`);
    console.log(`Output root: ${runRoot}`);
    return;
  }

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory already exists: ${runRoot}. Use a different --run-name to avoid mixing stale prompts or outputs.`);
  }
  if (fs.existsSync(stagingRunRoot)) {
    throw new Error(`Staging directory already exists: ${stagingRunRoot}. Remove it manually after verifying no audit run is in progress, or use a different --run-name.`);
  }

  const promptsRoot = path.join(stagingRunRoot, "prompts");
  const auditorPromptsRoot = path.join(promptsRoot, "auditors");
  const rawRoot = path.join(stagingRunRoot, "raw");
  const consolidationRoot = path.join(stagingRunRoot, "consolidation");
  const validationRoot = path.join(stagingRunRoot, "validation");
  const finalRoot = path.join(stagingRunRoot, "final");
  for (const directory of [artifactRoot, tempRoot, stagingRunRoot, promptsRoot, auditorPromptsRoot, rawRoot, consolidationRoot, validationRoot, finalRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const templateRoot = path.join(targetRoot, config.templateRoot);
  const auditorTemplate = fs.readFileSync(path.join(templateRoot, "auditor-prompt.md"), "utf8");
  const consolidatorTemplate = fs.readFileSync(path.join(templateRoot, "consolidator-prompt.md"), "utf8");
  const validatorTemplate = fs.readFileSync(path.join(templateRoot, "validator-prompt.md"), "utf8");
  const promptRecords = [];

  for (const combo of combinations) {
    const outputRelative = toPosix(path.join(config.artifactRoot, runName, "raw", `${combo.auditId}.md`));
    const promptRelative = toPosix(path.join(config.artifactRoot, runName, "prompts", "auditors", `${combo.auditId}.md`));
    const prompt = renderTemplate(auditorTemplate, {
      RUN_ID: runName,
      AUDIT_ID: combo.auditId,
      LENS_ID: combo.lens.id,
      LENS_TITLE: combo.lens.title,
      LENS_FOCUS: combo.lens.focus,
      VARIANT_ID: combo.variant.id,
      VARIANT_TITLE: combo.variant.title,
      VARIANT_INSTRUCTION: combo.variant.instruction,
      PASS_NUMBER: combo.pass,
      OUTPUT_FILE: outputRelative,
      CORPUS_INCLUDE: markdownList(profile.corpus.include),
      CORPUS_EXCLUDE: markdownList(profile.corpus.exclude)
    });
    fs.writeFileSync(path.join(auditorPromptsRoot, `${combo.auditId}.md`), prompt, "utf8");
    promptRecords.push({
      auditId: combo.auditId,
      lensId: combo.lens.id,
      variantId: combo.variant.id,
      pass: combo.pass,
      prompt: promptRelative,
      output: outputRelative
    });
  }

  const consolidatedRelative = toPosix(path.join(config.artifactRoot, runName, "consolidation", "consolidated-candidates.md"));
  const discardedRelative = toPosix(path.join(config.artifactRoot, runName, "consolidation", "discarded-raw-findings.md"));
  const validationRelative = toPosix(path.join(config.artifactRoot, runName, "validation", "adversarial-validation-log.md"));
  const finalRelative = toPosix(path.join(config.artifactRoot, runName, "final", "final-documentation-audit-report.md"));
  const rawRelative = toPosix(path.join(config.artifactRoot, runName, "raw"));

  fs.writeFileSync(path.join(promptsRoot, "consolidate.md"), renderTemplate(consolidatorTemplate, {
    RUN_ID: runName,
    RAW_DIR: rawRelative,
    CONSOLIDATED_OUTPUT: consolidatedRelative,
    DISCARDED_OUTPUT: discardedRelative
  }), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "validate.md"), renderTemplate(validatorTemplate, {
    RUN_ID: runName,
    CONSOLIDATED_OUTPUT: consolidatedRelative,
    VALIDATION_OUTPUT: validationRelative,
    FINAL_OUTPUT: finalRelative
  }), "utf8");

  writeJson(path.join(stagingRunRoot, "manifest.json"), {
    version: 1,
    workflowId: "documentation-audit",
    runId: runName,
    generatedAt: new Date().toISOString(),
    passesPerLens,
    maxAudits,
    profilePath: config.profilePath,
    corpus: profile.corpus,
    counts: {
      lenses: profile.lenses.length,
      variants: profile.variants.length,
      auditorPrompts: combinations.length
    },
    paths: {
      runRoot: toPosix(path.join(config.artifactRoot, runName)),
      prompts: toPosix(path.join(config.artifactRoot, runName, "prompts")),
      raw: rawRelative,
      consolidation: toPosix(path.join(config.artifactRoot, runName, "consolidation")),
      validation: toPosix(path.join(config.artifactRoot, runName, "validation")),
      final: toPosix(path.join(config.artifactRoot, runName, "final"))
    },
    prompts: promptRecords
  });

  fs.writeFileSync(path.join(stagingRunRoot, "README.md"), `# Documentation Audit Run\n\nRun: ${runName}\n\n## Counts\n\n- Lenses: ${profile.lenses.length}\n- Variants: ${profile.variants.length}\n- Passes per lens/variant: ${passesPerLens}\n- Auditor prompts: ${combinations.length}\n\n## Execution Order\n\n1. Execute auditor prompts from prompts/auditors/ and write outputs to raw/.\n2. Execute prompts/consolidate.md after raw outputs exist.\n3. Execute prompts/validate.md after consolidation exists.\n4. Review final/final-documentation-audit-report.md.\n\n## opencode Command\n\n- Use /wefter-audit-docs with this run path to execute or resume the end-to-end audit.\n`, "utf8");

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory was created before finalizing the staging move: ${runRoot}`);
  }
  fs.renameSync(stagingRunRoot, runRoot);

  console.log(`Created documentation audit run: ${runRoot}`);
  console.log(`Auditor prompts generated: ${combinations.length}`);
  console.log(`Next prompt directory: ${path.join(runRoot, "prompts", "auditors")}`);
}

function commandProfileScaffold(flags) {
  const targetRoot = resolveTarget(flags);
  const config = readConfig(targetRoot);
  const profilePath = path.join(targetRoot, config.profilePath);
  if (fs.existsSync(profilePath) && !flags.force) {
    throw new Error(`Profile already exists: ${profilePath}. Use --force to overwrite.`);
  }
  writeJson(profilePath, defaultProfile(config));
  console.log(`Wrote starter audit profile: ${profilePath}`);
}

function commandDoctor(flags) {
  const targetRoot = resolveTarget(flags);
  const config = readConfig(targetRoot);
  const errors = [];
  const checks = [];

  function check(label, fn) {
    try {
      fn();
      checks.push(`OK ${label}`);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }

  check(CONFIG_FILE, () => normalizeConfig(config));
  check("profile", () => validateProfile(readJson(path.join(targetRoot, config.profilePath), "audit profile")));
  check("configured paths", () => {
    for (const [label, relativePath] of Object.entries({
      profilePath: config.profilePath,
      workflowRoot: config.workflowRoot,
      artifactRoot: config.artifactRoot,
      templateRoot: config.templateRoot,
      processDocPath: config.processDocPath
    })) {
      ensureInside(targetRoot, path.join(targetRoot, relativePath), label);
    }
  });
  check("templates", () => {
    for (const file of REQUIRED_TEMPLATE_FILES) {
      const fullPath = path.join(targetRoot, config.templateRoot, file);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing ${fullPath}`);
      }
    }
  });
  check("workflow manifests", () => {
    for (const workflowId of Object.keys(config.workflows)) {
      const fullPath = path.join(targetRoot, config.workflowRoot, workflowId, "workflow.json");
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing ${fullPath}`);
      }
    }
  });
  check("opencode agents", () => {
    const agentFiles = [
      "wefter-doc-audit-orchestrator.md",
      "wefter-doc-auditor.md",
      "wefter-doc-audit-consolidator.md",
      "wefter-doc-audit-validator.md",
      "wefter-doc-audit-profile-builder.md"
    ];
    const posixGlob = `${config.artifactRoot}/**`;
    const windowsGlob = windowsPermissionGlob(config.artifactRoot);

    for (const file of agentFiles) {
      const fullPath = path.join(targetRoot, ".opencode/agent", file);
      const content = readTextRequired(fullPath);
      assertNoPlaceholders(fullPath, content);
      assertIncludes(content, posixGlob, `${file} POSIX artifact permission`);
      assertIncludes(content, windowsGlob, `${file} Windows artifact permission`);
    }

    const orchestrator = readTextRequired(path.join(targetRoot, ".opencode/agent/wefter-doc-audit-orchestrator.md"));
    assertIncludes(orchestrator, CONFIG_FILE, "orchestrator config reference");
    assertIncludes(orchestrator, config.profilePath, "orchestrator profile path");
    assertIncludes(orchestrator, config.runnerCommand, "orchestrator runner command");
  });
  check("opencode skill", () => {
    const skillPath = path.join(targetRoot, ".opencode/skills/documentation-audit/SKILL.md");
    const content = readTextRequired(skillPath);
    assertNoPlaceholders(skillPath, content);
    assertIncludes(content, config.profilePath, "skill profile path");
    assertIncludes(content, config.templateRoot, "skill template root");
    assertIncludes(content, config.processDocPath, "skill process doc path");
  });
  check("opencode commands", () => {
    const opencode = readJson(path.join(targetRoot, "opencode.json"), "opencode.json");
    if (opencode.command?.["wefter-audit-docs"]?.agent !== "wefter-doc-audit-orchestrator" || opencode.command?.["wefter-generate-doc-audit-profile"]?.agent !== "wefter-doc-audit-profile-builder") {
      throw new Error("Missing Wefter documentation audit opencode commands.");
    }
    if (!Array.isArray(opencode.skills?.paths) || !opencode.skills.paths.includes(".opencode/skills")) {
      throw new Error("Missing .opencode/skills in opencode skills.paths.");
    }
    const watcherIgnore = Array.isArray(opencode.watcher?.ignore) ? opencode.watcher.ignore : [];
    for (const ignored of [config.artifactRoot, config.templateRoot]) {
      const pattern = `${ignored.replace(/\/$/, "")}/**`;
      if (!watcherIgnore.includes(pattern)) {
        throw new Error(`Missing opencode watcher ignore '${pattern}'.`);
      }
    }
  });

  for (const item of checks) {
    console.log(item);
  }
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR ${error}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("Wefter installation looks healthy.");
}

export async function main(argv = process.argv.slice(2)) {
  const { positional, flags } = parseArgs(argv);
  if (flags.help || positional.length === 0) {
    printHelp();
    return;
  }
  if (flags.version) {
    console.log(VERSION);
    return;
  }

  const [command, subcommand] = positional;
  if (command === "init") {
    await commandInit(flags);
    return;
  }
  if (command === "new-run") {
    if (subcommand && subcommand !== "documentation-audit") {
      throw new Error(`Unsupported workflow for new-run: ${subcommand}`);
    }
    commandNewRun(flags);
    return;
  }
  if (command === "docs" && subcommand === "audit") {
    commandNewRun(flags);
    return;
  }
  if (command === "profile" && subcommand === "scaffold") {
    commandProfileScaffold(flags);
    return;
  }
  if (command === "doctor") {
    commandDoctor(flags);
    return;
  }

  throw new Error(`Unknown command: ${positional.join(" ")}`);
}
