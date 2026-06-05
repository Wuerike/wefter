import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const VERSION = "0.4.0";
const CONFIG_FILE = "wefter.config.json";
const INSTALL_MANIFEST_FILE = ".wefter/install-manifest.json";
const PRODUCT_SHAPING_WORKFLOW_ID = "product-shaping";
const DOCUMENTATION_REPAIR_WORKFLOW_ID = "documentation-repair";
const DELIVERY_WORKFLOW_ID = "delivery-implementation";
const DEFAULTS = Object.freeze({
  workflowRoot: ".wefter/workflows",
  profilePath: ".wefter/workflows/documentation-audit/profile.json",
  artifactRoot: ".audit/wefter/documentation-audit",
  templateRoot: ".wefter/workflows/documentation-audit/templates",
  processDocPath: ".wefter/workflows/documentation-audit/README.md"
});
const PRODUCT_SHAPING_DEFAULTS = Object.freeze({
  specRoot: ".wefter/specs",
  runRoot: ".wefter/runs/product-shaping",
  configPath: ".wefter/workflows/product-shaping/config.json",
  profilePath: ".wefter/workflows/product-shaping/profile.json"
});

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const REQUIRED_TEMPLATE_FILES = Object.freeze([
  "auditor-prompt.md",
  "consolidator-prompt.md",
  "validator-prompt.md"
]);

const PRODUCT_SHAPING_PROMPT_FILES = Object.freeze([
  "intake-prompt.md",
  "reference-research-prompt.md",
  "product-shaper-prompt.md",
  "domain-modeler-prompt.md",
  "release-planner-prompt.md",
  "product-auditor-prompt.md",
  "product-validator-prompt.md",
  "product-repairer-prompt.md"
]);
const PRODUCT_SHAPING_REQUIRED_FILES = Object.freeze([
  "README.md",
  "discovery/SOURCE_MATERIALS.md",
  "discovery/IDEA_BRIEF.md",
  "discovery/OPEN_QUESTIONS.md",
  "references/README.md",
  "PRODUCT_VISION.md",
  "product/FEATURE_CATALOG.md",
  "product/MODULE_ROADMAP.md",
  "product/DOMAIN_MODEL.md",
  "product/OPERATIONAL_FLOW.md",
  "product/PRODUCT_DECISIONS.md",
  "releases/README.md",
  "releases/<release-id>/README.md",
  "releases/<release-id>/SCOPE.md",
  "releases/<release-id>/DOMAIN_SPEC.md",
  "releases/<release-id>/ACCEPTANCE_CRITERIA.md",
  "releases/<release-id>/DELIVERABLES.md"
]);

function printHelp() {
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

function allowedFlagsForCommand(command, subcommand) {
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

function assertKnownFlags(flags, allowedFlags) {
  const allowed = new Set(["help", "version", ...allowedFlags]);
  for (const key of Object.keys(flags)) {
    if (!allowed.has(key)) {
      throw new Error(`Unsupported option --${key} for this command.`);
    }
  }
}

function packageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

function workflowPackageRoot(workflowId) {
  return path.join(packageRoot(), "src/workflows", workflowId);
}

function documentationAuditTemplateRoot() {
  return path.join(workflowPackageRoot("documentation-audit"), "templates");
}

function documentationRepairTemplateRoot() {
  return path.join(workflowPackageRoot(DOCUMENTATION_REPAIR_WORKFLOW_ID), "templates");
}

function productShapingWorkflowPackageRoot() {
  return workflowPackageRoot(PRODUCT_SHAPING_WORKFLOW_ID);
}

function deliveryWorkflowPackageRoot() {
  return workflowPackageRoot(DELIVERY_WORKFLOW_ID);
}

function documentationRepairArtifactRoot() {
  return ".audit/wefter/documentation-repair";
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
  if (/^[A-Za-z]:/.test(trimmed) || trimmed.startsWith("//")) {
    throw new Error(`${label} must be relative to the target repository.`);
  }
  if (path.isAbsolute(trimmed)) {
    throw new Error(`${label} must be relative to the target repository.`);
  }

  const parts = trimmed.split("/").filter((part) => part && part !== ".");
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

function requireStrictInteger(value, label, minimum) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

function parseStrictInteger(value, label, minimum) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}.`);
  }
  return requireStrictInteger(Number(value), label, minimum);
}

function normalizeRelativeGlob(value, label) {
  const normalized = normalizeRelativePath(value, label);
  if (normalized.startsWith("~")) {
    throw new Error(`${label} must be relative to the target repository.`);
  }
  return normalized;
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

function assertPlainRunId(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Run id must not be empty when --run-root is not provided.");
  }
  assertSafeRunName(value);
}

function getSafeDeliveryUnitKey(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Delivery unit id must not be empty.");
  }

  const trimmed = value.trim();
  if (/^delivery-unit-[A-Za-z0-9_.-]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^\d+$/.test(trimmed)) {
    return `delivery-unit-${String(Number.parseInt(trimmed, 10)).padStart(2, "0")}`;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(trimmed)) {
    throw new Error("Delivery unit id may contain only letters, numbers, dot, underscore and hyphen, and must start with a letter or number.");
  }
  return `delivery-unit-${trimmed.toLowerCase()}`;
}

function ensureInside(targetRoot, candidate, label) {
  const relative = path.relative(targetRoot, candidate);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`${label} resolves outside the target repository.`);
}

function resolveInsideTarget(targetRoot, candidatePath, label) {
  const resolved = path.isAbsolute(candidatePath) ? path.resolve(candidatePath) : path.resolve(targetRoot, candidatePath);
  ensureInside(targetRoot, resolved, label);
  return resolved;
}

function toDisplayPath(targetRoot, fullPath) {
  const relative = path.relative(targetRoot, fullPath);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return toPosix(relative || ".");
  }
  return toPosix(fullPath);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read ${label} at ${filePath}: ${error.message}`);
  }
}

function readJsonIfExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return readJson(filePath, label);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function listFilesRecursive(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function addFileIfExists(targetRoot, files, fullPath) {
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return;
  }
  ensureInside(targetRoot, fullPath, "installed file");
  files.add(toDisplayPath(targetRoot, fullPath));
}

function addDirectoryFilesIfExists(targetRoot, files, fullPath) {
  if (!fs.existsSync(fullPath)) {
    return;
  }
  ensureInside(targetRoot, fullPath, "installed directory");
  for (const file of listFilesRecursive(fullPath)) {
    addFileIfExists(targetRoot, files, file);
  }
}

function knownOpencodeCommandNames() {
  return [
    "wefter-audit-docs",
    "wefter-generate-doc-audit-profile",
    "wefter-repair-docs",
    "wefter-shape-product",
    "wefter-run-delivery"
  ];
}

function removeIfExistsInside(targetRoot, relativePath) {
  const fullPath = path.join(targetRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    return;
  }
  ensureInside(targetRoot, fullPath, "legacy Wefter file");
  fs.rmSync(fullPath, { recursive: true, force: true });
}

function removeDeliveryOpenCodeArtifacts(targetRoot) {
  removeIfExistsInside(targetRoot, ".opencode/skills/delivery-implementation");
  const agentRoot = path.join(targetRoot, ".opencode/agent");
  if (!fs.existsSync(agentRoot)) {
    return;
  }
  ensureInside(targetRoot, agentRoot, "delivery Wefter agent root");
  for (const file of fs.readdirSync(agentRoot)) {
    if (file.startsWith("wefter-delivery-") && file.endsWith(".md")) {
      removeIfExistsInside(targetRoot, path.join(".opencode/agent", file));
    }
  }
}

function configuredWatcherIgnores(targetRoot, config) {
  const deliverySettings = workflowSettings(config, DELIVERY_WORKFLOW_ID);
  const deliveryConfig = deliverySettings.enabled ? readJsonIfExists(path.join(targetRoot, deliveryConfigPath(config)), "delivery config") : null;
  const productSettings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  return [config.artifactRoot, config.templateRoot, documentationRepairArtifactRoot(), deliveryConfig?.runArtifactsRoot, productSettings.enabled ? productShapingRunRoot(config) : null]
    .filter(Boolean)
    .map((ignored) => `${ignored.replace(/\/$/, "")}/**`);
}

function collectInstallManifestFiles(targetRoot, config) {
  const files = new Set();
  addFileIfExists(targetRoot, files, path.join(targetRoot, CONFIG_FILE));
  addDirectoryFilesIfExists(targetRoot, files, path.join(targetRoot, config.workflowRoot));
  addDirectoryFilesIfExists(targetRoot, files, path.join(targetRoot, config.templateRoot));
  addFileIfExists(targetRoot, files, path.join(targetRoot, config.profilePath));
  addFileIfExists(targetRoot, files, path.join(targetRoot, config.processDocPath));
  addFileIfExists(targetRoot, files, path.join(targetRoot, productShapingConfigPath(config)));
  addFileIfExists(targetRoot, files, path.join(targetRoot, productShapingProfilePath(config)));
  addFileIfExists(targetRoot, files, path.join(targetRoot, deliveryConfigPath(config)));
  addFileIfExists(targetRoot, files, path.join(targetRoot, deliveryProfilePath(config)));

  const opencodeAgentRoot = path.join(targetRoot, ".opencode/agent");
  if (fs.existsSync(opencodeAgentRoot)) {
    for (const file of fs.readdirSync(opencodeAgentRoot)) {
      if (file.startsWith("wefter-") && file.endsWith(".md")) {
        addFileIfExists(targetRoot, files, path.join(opencodeAgentRoot, file));
      }
    }
  }
  for (const skill of ["documentation-audit", "documentation-repair", "delivery-implementation", "product-shaping"]) {
    addDirectoryFilesIfExists(targetRoot, files, path.join(targetRoot, ".opencode/skills", skill));
  }

  return [...files]
    .filter((relativePath) => relativePath !== INSTALL_MANIFEST_FILE && relativePath !== "opencode.json")
    .sort();
}

function writeInstallManifest(targetRoot, config) {
  const manifestPath = path.join(targetRoot, INSTALL_MANIFEST_FILE);
  const files = collectInstallManifestFiles(targetRoot, config).map((relativePath) => ({
    path: relativePath,
    sha256: sha256File(path.join(targetRoot, relativePath))
  }));
  writeJson(manifestPath, {
    version: 1,
    packageName: "@wefter/opencode",
    packageVersion: VERSION,
    generatedAt: new Date().toISOString(),
    files,
    managedOpencode: {
      commands: knownOpencodeCommandNames(),
      skillsPath: ".opencode/skills",
      watcherIgnores: configuredWatcherIgnores(targetRoot, config)
    }
  });
}

function removeEmptyParents(targetRoot, startDir) {
  let current = startDir;
  while (current && current !== targetRoot && isInsideDirectory(targetRoot, current)) {
    if (!fs.existsSync(current)) {
      current = path.dirname(current);
      continue;
    }
    const entries = fs.readdirSync(current);
    if (entries.length > 0) {
      return;
    }
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
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

function writeJsonConfigIfSafe(filePath, value, force) {
  writeJsonIfSafe(filePath, value, force);
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
    [PRODUCT_SHAPING_WORKFLOW_ID]: {
      status: "available",
      enabled: true,
      specRoot: PRODUCT_SHAPING_DEFAULTS.specRoot,
      runRoot: PRODUCT_SHAPING_DEFAULTS.runRoot,
      configPath: PRODUCT_SHAPING_DEFAULTS.configPath,
      profilePath: PRODUCT_SHAPING_DEFAULTS.profilePath
    },
    "documentation-audit": { status: "available", enabled: true },
    "documentation-repair": { status: "available", enabled: true },
    [DELIVERY_WORKFLOW_ID]: {
      status: "available",
      enabled: true,
      configPath: ".wefter/workflows/delivery-implementation/config.json",
      profilePath: ".wefter/workflows/delivery-implementation/profile.json"
    },
    "technical-shaping": { status: "planned", enabled: false },
  };
}

function workflowSettings(config, workflowId) {
  const settings = config.workflows?.[workflowId];
  if (!settings) {
    throw new Error(`Missing workflow settings for ${workflowId}.`);
  }
  return settings;
}

function assertWorkflowEnabled(config, workflowId) {
  const settings = workflowSettings(config, workflowId);
  if (!settings.enabled) {
    throw new Error(`Workflow '${workflowId}' is disabled in ${CONFIG_FILE}.`);
  }
  return settings;
}

function deliveryRuntimeSettings(config) {
  return config.workflows?.[DELIVERY_WORKFLOW_ID];
}

function deliveryConfigPath(config, flags = {}) {
  const settings = deliveryRuntimeSettings(config);
  if (!settings) {
    throw new Error(`Missing workflow settings for ${DELIVERY_WORKFLOW_ID}.`);
  }
  return normalizeRelativePath(flags["config-path"] || settings.configPath || `${config.workflowRoot}/${DELIVERY_WORKFLOW_ID}/config.json`, "delivery config path");
}

function deliveryProfilePath(config, flags = {}) {
  const settings = deliveryRuntimeSettings(config);
  if (!settings) {
    throw new Error(`Missing workflow settings for ${DELIVERY_WORKFLOW_ID}.`);
  }
  return normalizeRelativePath(flags["profile-path"] || settings.profilePath || `${config.workflowRoot}/${DELIVERY_WORKFLOW_ID}/profile.json`, "delivery profile path");
}

function productShapingSpecRoot(config, flags = {}) {
  const settings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  return normalizeRelativePath(flags["spec-root"] || settings.specRoot || PRODUCT_SHAPING_DEFAULTS.specRoot, "product-shaping spec root");
}

function productShapingRunRoot(config, flags = {}) {
  const settings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  return normalizeRelativePath(flags["run-root"] || settings.runRoot || PRODUCT_SHAPING_DEFAULTS.runRoot, "product-shaping run root");
}

function productShapingConfigPath(config, flags = {}) {
  const settings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  return normalizeRelativePath(flags["config-path"] || settings.configPath || `${config.workflowRoot}/${PRODUCT_SHAPING_WORKFLOW_ID}/config.json`, "product-shaping config path");
}

function productShapingProfilePath(config, flags = {}) {
  const settings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  return normalizeRelativePath(flags["profile-path"] || settings.profilePath || `${config.workflowRoot}/${PRODUCT_SHAPING_WORKFLOW_ID}/profile.json`, "product-shaping profile path");
}

function normalizeWorkflowRegistry(workflows) {
  assertObject(workflows, "workflows");
  for (const [workflowId, workflow] of Object.entries(workflows)) {
    requireId(workflowId, `workflows.${workflowId}`);
    assertObject(workflow, `workflows.${workflowId}`);
    assertAllowedKeys(workflow, `workflows.${workflowId}`, ["status", "enabled", "profilePath", "configPath", "specRoot", "runRoot"]);
    if (!["available", "planned"].includes(workflow.status)) {
      throw new Error(`workflows.${workflowId}.status must be available or planned.`);
    }
    if (typeof workflow.enabled !== "boolean") {
      throw new Error(`workflows.${workflowId}.enabled must be boolean.`);
    }
    for (const key of ["profilePath", "configPath", "specRoot", "runRoot"]) {
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
  const productSettings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  const deliverySettings = workflowSettings(config, DELIVERY_WORKFLOW_ID);
  const deliveryConfig = deliverySettings.enabled ? readJsonIfExists(path.join(targetRoot, deliveryConfigPath(config)), "delivery config") : null;
  const deliveryArtifactRoot = deliveryConfig?.runArtifactsRoot || ".audit/wefter/delivery-implementation";

  existing["$schema"] = existing["$schema"] || "https://opencode.ai/config.json";
  existing.watcher = existing.watcher || {};
  existing.watcher.ignore = Array.isArray(existing.watcher.ignore) ? existing.watcher.ignore : [];
  for (const pattern of configuredWatcherIgnores(targetRoot, config)) {
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
  const deliveryCommand = {
    description: "Run the Wefter delivery implementation workflow.",
    agent: "wefter-delivery-orchestrator",
    template: `Run or resume the Wefter delivery implementation workflow. Read ${CONFIG_FILE} first. If the user provided an existing ${deliveryArtifactRoot}/<run-id> path, resume it. Otherwise create a run with ${config.runnerCommand} delivery run. Use the deliverable id supplied by the user, or ask if unclear. Prefer a validated product-shaped DELIVERABLES.md handoff when available. Generate the delivery plan, run adversarial plan reviews, consolidate, validate, repair candidate artifacts, apply the configured gate policy, and only execute code tasks after approval.`
  };
  const productShapeCommand = {
    description: "Run the Wefter product-shaping workflow from idea to validated product specs and DELIVERABLES.md handoff.",
    agent: "wefter-product-orchestrator",
    template: `Run or resume the Wefter product-shaping workflow. Read ${CONFIG_FILE} first. If the user provided an existing ${productShapingRunRoot(config)}/<run-id> path, resume it. Otherwise create a run with ${config.runnerCommand} product shape. Shape source materials into product specs under ${productShapingSpecRoot(config)}, stop for human product decisions when needed, validate the completion gate, and do not create task specs or implementation plans.`
  };
  const repairDocsCommand = {
    description: "Run the Wefter documentation repair workflow from a validated audit report.",
    agent: "wefter-doc-repair-orchestrator",
    template: `Run or resume the Wefter documentation repair workflow. Read ${CONFIG_FILE} first. If the user provided an existing .audit/wefter/documentation-repair/<run-id> path, resume it. Otherwise create a run with ${config.runnerCommand} docs repair using the final audit report path supplied by the user. If the report path is missing, ask for it. Plan repairs first, pause on human-decision items, apply approved documentation edits, review the result, and recommend a follow-up documentation audit.`
  };

  const commands = {
    "wefter-audit-docs": fullRunCommand,
    "wefter-generate-doc-audit-profile": generateProfileCommand,
    "wefter-repair-docs": repairDocsCommand
  };
  if (deliverySettings.enabled) {
    commands["wefter-run-delivery"] = deliveryCommand;
  } else {
    delete existing.command["wefter-run-delivery"];
  }
  if (productSettings.enabled) {
    commands["wefter-shape-product"] = productShapeCommand;
  } else {
    delete existing.command["wefter-shape-product"];
  }

  for (const [name, nextValue] of Object.entries(commands)) {
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
        `${documentationRepairArtifactRoot()}/**`,
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
  assertAllowedKeys(profile, "Profile", ["version", "auditorPromptPath", "corpus", "variants", "lenses"]);

  if (profile.version !== 1) {
    throw new Error("Profile must have version: 1.");
  }
  if (profile.auditorPromptPath !== undefined) {
    normalizeRelativePath(profile.auditorPromptPath, "Profile auditorPromptPath");
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

function documentationAuditAuditorPrompt(targetRoot, config, profile) {
  const relativePath = profile.auditorPromptPath
    ? normalizeRelativePath(profile.auditorPromptPath, "Profile auditorPromptPath")
    : toPosix(path.join(config.templateRoot, "auditor-prompt.md"));
  const fullPath = resolveInsideTarget(targetRoot, relativePath, "auditor prompt");
  return { relativePath, fullPath };
}

function validateDeliveryConfig(config) {
  assertObject(config, "Delivery config");
  assertAllowedKeys(config, "Delivery config", ["version", "workflowName", "releaseId", "deliverablesDocument", "sourceDocs", "runArtifactsRoot", "versionedArtifacts", "defaultDeliveryUnitId", "defaultPlanAuditPassesPerLens", "gatePolicy"]);

  if (config.version !== 1) {
    throw new Error("Delivery config must have version: 1.");
  }
  requireString(config.workflowName, "Delivery config.workflowName");
  if (config.workflowName !== DELIVERY_WORKFLOW_ID) {
    throw new Error(`Delivery config.workflowName must be ${DELIVERY_WORKFLOW_ID}.`);
  }
  requireString(config.releaseId, "Delivery config.releaseId");
  normalizeRelativePath(config.deliverablesDocument, "Delivery config.deliverablesDocument");
  normalizeRelativePath(config.runArtifactsRoot, "Delivery config.runArtifactsRoot");
  requireString(config.defaultDeliveryUnitId, "Delivery config.defaultDeliveryUnitId");

  requireStrictInteger(config.defaultPlanAuditPassesPerLens, "Delivery config.defaultPlanAuditPassesPerLens", 1);

  assertObject(config.sourceDocs, "Delivery config.sourceDocs");
  assertAllowedKeys(config.sourceDocs, "Delivery config.sourceDocs", ["include", "exclude"]);
  requireStringArray(config.sourceDocs.include, "Delivery config.sourceDocs.include");
  requireStringArray(config.sourceDocs.exclude, "Delivery config.sourceDocs.exclude");
  config.sourceDocs.include.forEach((item, index) => normalizeRelativeGlob(item, `Delivery config.sourceDocs.include[${index}]`));
  config.sourceDocs.exclude.forEach((item, index) => normalizeRelativeGlob(item, `Delivery config.sourceDocs.exclude[${index}]`));

  assertObject(config.versionedArtifacts, "Delivery config.versionedArtifacts");
  assertAllowedKeys(config.versionedArtifacts, "Delivery config.versionedArtifacts", ["executionRoot", "decisionLogRoot"]);
  normalizeRelativePath(config.versionedArtifacts.executionRoot, "Delivery config.versionedArtifacts.executionRoot");
  normalizeRelativePath(config.versionedArtifacts.decisionLogRoot, "Delivery config.versionedArtifacts.decisionLogRoot");

  assertObject(config.gatePolicy, "Delivery config.gatePolicy");
  assertAllowedKeys(config.gatePolicy, "Delivery config.gatePolicy", ["mode", "structuralDeliveryUnits", "alwaysPauseOn"]);
  requireString(config.gatePolicy.mode, "Delivery config.gatePolicy.mode");
  requireStringArray(config.gatePolicy.structuralDeliveryUnits, "Delivery config.gatePolicy.structuralDeliveryUnits");
  requireStringArray(config.gatePolicy.alwaysPauseOn, "Delivery config.gatePolicy.alwaysPauseOn");
}

function validateProductShapingConfig(config) {
  assertObject(config, "Product-shaping config");
  assertAllowedKeys(config, "Product-shaping config", ["version", "workflowName", "releaseId", "specRoot", "runRoot", "contractPath", "processDocPath", "requiredFiles", "completionGate"]);

  if (config.version !== 1) {
    throw new Error("Product-shaping config must have version: 1.");
  }
  if (config.workflowName !== PRODUCT_SHAPING_WORKFLOW_ID) {
    throw new Error(`Product-shaping config.workflowName must be ${PRODUCT_SHAPING_WORKFLOW_ID}.`);
  }
  requireString(config.releaseId, "Product-shaping config.releaseId");
  normalizeRelativePath(config.specRoot, "Product-shaping config.specRoot");
  normalizeRelativePath(config.runRoot, "Product-shaping config.runRoot");
  normalizeRelativePath(config.contractPath, "Product-shaping config.contractPath");
  normalizeRelativePath(config.processDocPath, "Product-shaping config.processDocPath");
  requireStringArray(config.requiredFiles, "Product-shaping config.requiredFiles");
  if (JSON.stringify(config.requiredFiles) !== JSON.stringify(PRODUCT_SHAPING_REQUIRED_FILES)) {
    throw new Error("Product-shaping config.requiredFiles must match the canonical product spec file set and order.");
  }

  assertObject(config.completionGate, "Product-shaping config.completionGate");
  assertAllowedKeys(config.completionGate, "Product-shaping config.completionGate", ["requireNoReleaseBlockingQuestions", "requireAdversarialReview", "requireFinalValidation", "readyDeliverableStatuses"]);
  for (const key of ["requireNoReleaseBlockingQuestions", "requireAdversarialReview", "requireFinalValidation"]) {
    if (typeof config.completionGate[key] !== "boolean") {
      throw new Error(`Product-shaping config.completionGate.${key} must be boolean.`);
    }
  }
  for (const key of ["requireAdversarialReview", "requireFinalValidation"]) {
    if (config.completionGate[key] !== true) {
      throw new Error(`Product-shaping config.completionGate.${key} must be true for product-shaping completion.`);
    }
  }
  requireStringArray(config.completionGate.readyDeliverableStatuses, "Product-shaping config.completionGate.readyDeliverableStatuses");
  if (JSON.stringify(config.completionGate.readyDeliverableStatuses) !== JSON.stringify(["ready"])) {
    throw new Error("Product-shaping config.completionGate.readyDeliverableStatuses must be exactly ['ready'].");
  }
}

function validateProductShapingProfile(profile) {
  assertObject(profile, "Product-shaping profile");
  assertAllowedKeys(profile, "Product-shaping profile", ["version", "workflowName", "variants", "lenses"]);

  if (profile.version !== 1) {
    throw new Error("Product-shaping profile must have version: 1.");
  }
  if (profile.workflowName !== PRODUCT_SHAPING_WORKFLOW_ID) {
    throw new Error(`Product-shaping profile.workflowName must be ${PRODUCT_SHAPING_WORKFLOW_ID}.`);
  }

  if (!Array.isArray(profile.variants) || profile.variants.length === 0) {
    throw new Error("Product-shaping profile must define at least one variant.");
  }
  profile.variants.forEach((variant, index) => {
    assertObject(variant, `Product-shaping profile variants[${index}]`);
    assertAllowedKeys(variant, `Product-shaping profile variants[${index}]`, ["id", "title", "instruction"]);
    requireId(variant.id, `Product-shaping profile variants[${index}].id`);
    requireString(variant.title, `Product-shaping profile variants[${index}].title`);
    requireString(variant.instruction, `Product-shaping profile variants[${index}].instruction`);
  });
  assertUniqueIds(profile.variants, "Product-shaping profile variants");

  if (!Array.isArray(profile.lenses) || profile.lenses.length === 0) {
    throw new Error("Product-shaping profile must define at least one lens.");
  }
  profile.lenses.forEach((lens, index) => {
    assertObject(lens, `Product-shaping profile lenses[${index}]`);
    assertAllowedKeys(lens, `Product-shaping profile lenses[${index}]`, ["id", "title", "focus"]);
    requireId(lens.id, `Product-shaping profile lenses[${index}].id`);
    requireString(lens.title, `Product-shaping profile lenses[${index}].title`);
    requireString(lens.focus, `Product-shaping profile lenses[${index}].focus`);
  });
  assertUniqueIds(profile.lenses, "Product-shaping profile lenses");
}

function validateDeliveryProfile(profile) {
  assertObject(profile, "Delivery profile");
  assertAllowedKeys(profile, "Delivery profile", ["version", "variants", "lenses"]);

  if (profile.version !== 1) {
    throw new Error("Delivery profile must have version: 1.");
  }

  if (!Array.isArray(profile.variants) || profile.variants.length === 0) {
    throw new Error("Delivery profile must define at least one variant.");
  }
  profile.variants.forEach((variant, index) => {
    assertObject(variant, `Delivery profile variants[${index}]`);
    assertAllowedKeys(variant, `Delivery profile variants[${index}]`, ["id", "title", "instruction"]);
    requireId(variant.id, `Delivery profile variants[${index}].id`);
    requireString(variant.title, `Delivery profile variants[${index}].title`);
    requireString(variant.instruction, `Delivery profile variants[${index}].instruction`);
  });
  assertUniqueIds(profile.variants, "Delivery profile variants");

  if (!Array.isArray(profile.lenses) || profile.lenses.length === 0) {
    throw new Error("Delivery profile must define at least one lens.");
  }
  profile.lenses.forEach((lens, index) => {
    assertObject(lens, `Delivery profile lenses[${index}]`);
    assertAllowedKeys(lens, `Delivery profile lenses[${index}]`, ["id", "title", "focus"]);
    requireId(lens.id, `Delivery profile lenses[${index}].id`);
    requireString(lens.title, `Delivery profile lenses[${index}].title`);
    requireString(lens.focus, `Delivery profile lenses[${index}].focus`);
  });
  assertUniqueIds(profile.lenses, "Delivery profile lenses");
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

  const existingConfigPath = path.join(targetRoot, CONFIG_FILE);
  const existingConfig = fs.existsSync(existingConfigPath) ? readJson(existingConfigPath, CONFIG_FILE) : null;
  let profilePath = flags["profile-path"] || existingConfig?.profilePath || DEFAULTS.profilePath;
  let artifactRoot = flags["artifact-root"] || existingConfig?.artifactRoot || DEFAULTS.artifactRoot;
  const workflowRoot = existingConfig?.workflowRoot || DEFAULTS.workflowRoot;
  const templateRoot = flags["template-root"] || existingConfig?.templateRoot || DEFAULTS.templateRoot;
  const processDocPath = flags["process-doc-path"] || existingConfig?.processDocPath || DEFAULTS.processDocPath;
  const runnerCommand = flags["runner-command"] || existingConfig?.runnerCommand || defaultRunnerCommand();

  if (!flags.yes && process.stdin.isTTY) {
    const rl = readline.createInterface({ input, output });
    profilePath = await promptForValue(rl, "Audit profile path", profilePath);
    artifactRoot = await promptForValue(rl, "Audit artifact root", artifactRoot);
    rl.close();
  }

  const workflows = {
    ...defaultWorkflowRegistry(),
    ...(existingConfig?.workflows || {})
  };

  const config = normalizeConfig({
    version: 1,
    workflowRoot,
    profilePath,
    artifactRoot,
    templateRoot,
    processDocPath,
    runnerCommand,
    workflows
  });

  const root = packageRoot();
  const auditTemplates = documentationAuditTemplateRoot();
  const productShapingPackageRoot = productShapingWorkflowPackageRoot();
  const deliveryPackageRoot = deliveryWorkflowPackageRoot();
  const defaultDeliveryConfig = readJson(path.join(deliveryPackageRoot, "templates/default-config.json"), "default delivery config");
  const configuredProductSpecRoot = productShapingSpecRoot(config);
  defaultDeliveryConfig.deliverablesDocument = productSpecPath(configuredProductSpecRoot, defaultDeliveryConfig.releaseId, "releases/<release-id>/DELIVERABLES.md");
  defaultDeliveryConfig.sourceDocs.include = unique([
    ...defaultDeliveryConfig.sourceDocs.include.filter((item) => item !== ".wefter/specs/**/*.md"),
    `${configuredProductSpecRoot}/**/*.md`
  ]);
  const deliveryEnabled = workflowSettings(config, DELIVERY_WORKFLOW_ID).enabled;
  const deliveryConfigForInstall = deliveryEnabled
    ? (flags.force ? defaultDeliveryConfig : (readJsonIfExists(path.join(targetRoot, deliveryConfigPath(config)), "delivery config") || defaultDeliveryConfig))
    : defaultDeliveryConfig;
  if (deliveryEnabled) {
    validateDeliveryConfig(deliveryConfigForInstall);
  }
  const deliveryProfileForInstall = deliveryEnabled
    ? readJson(path.join(deliveryPackageRoot, "templates/default-profile.json"), "default delivery profile")
    : null;
  if (deliveryEnabled) {
    validateDeliveryProfile(deliveryProfileForInstall);
  }

  const values = {
    PROFILE_PATH: config.profilePath,
    ARTIFACT_ROOT: config.artifactRoot,
    ARTIFACT_ROOT_WINDOWS: windowsPermissionPath(config.artifactRoot),
    TEMPLATE_ROOT: config.templateRoot,
    PROCESS_DOC_PATH: config.processDocPath,
    RUNNER_COMMAND: config.runnerCommand,
    CONFIG_FILE,
    RUNNER_COMMAND_NEW_RUN_PATTERN: yamlSingleQuoted(`${config.runnerCommand}*`),
    RUNNER_COMMAND_DOCS_REPAIR_PATTERN: yamlSingleQuoted(`${config.runnerCommand} docs repair*`),
    RUNNER_COMMAND_PRODUCT_SHAPE_PATTERN: yamlSingleQuoted(`${config.runnerCommand} product shape*`),
    RUNNER_COMMAND_PRODUCT_VALIDATE_PATTERN: yamlSingleQuoted(`${config.runnerCommand} product validate*`),
    DOCUMENTATION_REPAIR_ARTIFACT_ROOT: documentationRepairArtifactRoot(),
    DOCUMENTATION_REPAIR_ARTIFACT_ROOT_WINDOWS: windowsPermissionPath(documentationRepairArtifactRoot()),
    PRODUCT_SHAPING_SPEC_ROOT: productShapingSpecRoot(config),
    PRODUCT_SHAPING_SPEC_ROOT_WINDOWS: windowsPermissionPath(productShapingSpecRoot(config)),
    PRODUCT_SHAPING_RUN_ROOT: productShapingRunRoot(config),
    PRODUCT_SHAPING_RUN_ROOT_WINDOWS: windowsPermissionPath(productShapingRunRoot(config)),
    PRODUCT_SHAPING_CONFIG_PATH: productShapingConfigPath(config),
    PRODUCT_SHAPING_PROFILE_PATH: productShapingProfilePath(config),
    PRODUCT_SHAPING_PROCESS_DOC_PATH: `${config.workflowRoot}/${PRODUCT_SHAPING_WORKFLOW_ID}/README.md`,
    RUNNER_COMMAND_DELIVERY_PATTERN: yamlSingleQuoted(`${config.runnerCommand} delivery*`),
    DELIVERY_ARTIFACT_ROOT: deliveryConfigForInstall.runArtifactsRoot,
    DELIVERY_ARTIFACT_ROOT_WINDOWS: windowsPermissionPath(deliveryConfigForInstall.runArtifactsRoot),
    DELIVERY_CONFIG_PATH: deliveryConfigPath(config),
    DELIVERY_PROFILE_PATH: deliveryProfilePath(config)
  };

  writeJsonIfSafe(path.join(targetRoot, CONFIG_FILE), {
    "$schema": "./node_modules/@wefter/opencode/schemas/wefter.config.schema.json",
    ...config
  }, flags.force);

  copyRenderedTemplate(path.join(root, "src/workflows/documentation-audit/workflow.json"), path.join(targetRoot, config.workflowRoot, "documentation-audit/workflow.json"), values, flags.force);
  for (const workflowId of ["product-shaping", "documentation-repair", DELIVERY_WORKFLOW_ID, "technical-shaping"]) {
    copyDirectory(path.join(root, "src/workflows", workflowId), path.join(targetRoot, config.workflowRoot, workflowId), flags.force);
  }
  const productShapingConfig = readJson(path.join(productShapingPackageRoot, "templates/default-config.json"), "default product-shaping config");
  productShapingConfig.specRoot = productShapingSpecRoot(config);
  productShapingConfig.runRoot = productShapingRunRoot(config);
  productShapingConfig.contractPath = `${config.workflowRoot}/${PRODUCT_SHAPING_WORKFLOW_ID}/contracts/product-spec-contract.json`;
  productShapingConfig.processDocPath = `${config.workflowRoot}/${PRODUCT_SHAPING_WORKFLOW_ID}/README.md`;
  validateProductShapingConfig(productShapingConfig);
  writeJsonConfigIfSafe(path.join(targetRoot, productShapingConfigPath(config)), productShapingConfig, flags.force);
  const productShapingProfile = readJson(path.join(productShapingPackageRoot, "templates/default-profile.json"), "default product-shaping profile");
  validateProductShapingProfile(productShapingProfile);
  writeJsonConfigIfSafe(path.join(targetRoot, productShapingProfilePath(config)), productShapingProfile, flags.force);
  if (deliveryEnabled) {
    writeJsonConfigIfSafe(path.join(targetRoot, deliveryConfigPath(config)), deliveryConfigForInstall, flags.force);
    writeJsonConfigIfSafe(path.join(targetRoot, deliveryProfilePath(config)), deliveryProfileForInstall, flags.force);
  }
  copyRenderedTemplate(path.join(auditTemplates, "opencode/agent/wefter-doc-audit-orchestrator.md.tmpl"), path.join(targetRoot, ".opencode/agent/wefter-doc-audit-orchestrator.md"), values, flags.force);
  copyRenderedTemplate(path.join(auditTemplates, "opencode/agent/wefter-doc-auditor.md.tmpl"), path.join(targetRoot, ".opencode/agent/wefter-doc-auditor.md"), values, flags.force);
  copyRenderedTemplate(path.join(auditTemplates, "opencode/agent/wefter-doc-audit-consolidator.md.tmpl"), path.join(targetRoot, ".opencode/agent/wefter-doc-audit-consolidator.md"), values, flags.force);
  copyRenderedTemplate(path.join(auditTemplates, "opencode/agent/wefter-doc-audit-validator.md.tmpl"), path.join(targetRoot, ".opencode/agent/wefter-doc-audit-validator.md"), values, flags.force);
  copyRenderedTemplate(path.join(auditTemplates, "opencode/agent/wefter-doc-audit-profile-builder.md.tmpl"), path.join(targetRoot, ".opencode/agent/wefter-doc-audit-profile-builder.md"), values, flags.force);
  copyRenderedTemplate(path.join(auditTemplates, "opencode/skills/documentation-audit/SKILL.md.tmpl"), path.join(targetRoot, ".opencode/skills/documentation-audit/SKILL.md"), values, flags.force);
  const repairTemplates = documentationRepairTemplateRoot();
  for (const agentFile of ["wefter-doc-repair-orchestrator", "wefter-doc-repair-planner", "wefter-doc-repairer", "wefter-doc-repair-reviewer"]) {
    copyRenderedTemplate(path.join(repairTemplates, "opencode/agent", `${agentFile}.md.tmpl`), path.join(targetRoot, ".opencode/agent", `${agentFile}.md`), values, flags.force);
  }
  copyRenderedTemplate(path.join(repairTemplates, "opencode/skills/documentation-repair/SKILL.md.tmpl"), path.join(targetRoot, ".opencode/skills/documentation-repair/SKILL.md"), values, flags.force);
  for (const agent of ["orchestrator", "intake-analyst", "reference-researcher", "shaper", "domain-modeler", "release-planner", "auditor", "validator", "repairer"]) {
    copyRenderedTemplate(path.join(productShapingPackageRoot, "templates/opencode/agent", `wefter-product-${agent}.md.tmpl`), path.join(targetRoot, ".opencode/agent", `wefter-product-${agent}.md`), values, flags.force);
  }
  copyRenderedTemplate(path.join(productShapingPackageRoot, "templates/opencode/skills/product-shaping/SKILL.md.tmpl"), path.join(targetRoot, ".opencode/skills/product-shaping/SKILL.md"), values, flags.force);
  if (deliveryEnabled) {
    for (const agent of ["orchestrator", "planner", "plan-auditor", "plan-consolidator", "plan-validator", "plan-repairer", "task-implementer", "task-reviewer", "validator"]) {
      copyRenderedTemplate(path.join(deliveryPackageRoot, "templates/opencode/agent", `wefter-delivery-${agent}.md.tmpl`), path.join(targetRoot, ".opencode/agent", `wefter-delivery-${agent}.md`), values, flags.force);
    }
    copyRenderedTemplate(path.join(deliveryPackageRoot, "templates/opencode/skills/delivery-implementation/SKILL.md.tmpl"), path.join(targetRoot, ".opencode/skills/delivery-implementation/SKILL.md"), values, flags.force);
  } else {
    removeDeliveryOpenCodeArtifacts(targetRoot);
  }
  copyDirectory(path.join(auditTemplates, "prompts"), path.join(targetRoot, config.templateRoot), flags.force);
  copyRenderedTemplate(path.join(auditTemplates, "README.md.tmpl"), path.join(targetRoot, config.processDocPath), values, flags.force);
  mergeOpencodeConfig(targetRoot, config, flags.force);

  const profileFullPath = path.join(targetRoot, config.profilePath);
  if (!fs.existsSync(profileFullPath)) {
    writeJson(profileFullPath, defaultProfile(config));
  }
  writeInstallManifest(targetRoot, config);

  console.log(`Installed Wefter for OpenCode into ${targetRoot}`);
  console.log(`Profile: ${config.profilePath}`);
  console.log(`Artifacts: ${config.artifactRoot}`);
  console.log(`Runner command: ${config.runnerCommand}`);
  console.log(`Tip: add ${config.artifactRoot}/ to .gitignore if you do not want to track generated audit runs.`);
  const restartCommands = ["/wefter-shape-product", "/wefter-audit-docs", "/wefter-generate-doc-audit-profile", "/wefter-repair-docs"];
  if (deliveryEnabled) {
    restartCommands.push("/wefter-run-delivery");
  }
  console.log(`Restart opencode before using ${restartCommands.join(", ").replace(/, ([^,]*)$/, " or $1")}.`);
}

function readInstallManifest(targetRoot) {
  const manifestPath = path.join(targetRoot, INSTALL_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${INSTALL_MANIFEST_FILE}. Re-run wefter init with the current version before uninstalling, or remove Wefter files manually.`);
  }
  const manifest = readJson(manifestPath, "install manifest");
  assertObject(manifest, "Install manifest");
  if (manifest.version !== 1) {
    throw new Error("Install manifest must have version: 1.");
  }
  if (!Array.isArray(manifest.files)) {
    throw new Error("Install manifest files must be an array.");
  }
  return manifest;
}

function updateOpencodeForUninstall(targetRoot, manifest, dryRun) {
  const opencodePath = path.join(targetRoot, "opencode.json");
  if (!fs.existsSync(opencodePath)) {
    return false;
  }
  const opencode = readJson(opencodePath, "opencode.json");
  let changed = false;
  for (const commandName of manifest.managedOpencode?.commands || knownOpencodeCommandNames()) {
    if (opencode.command?.[commandName]) {
      delete opencode.command[commandName];
      changed = true;
    }
  }
  const watcherIgnore = opencode.watcher?.ignore;
  if (Array.isArray(watcherIgnore)) {
    const remove = new Set(manifest.managedOpencode?.watcherIgnores || []);
    const nextIgnore = watcherIgnore.filter((item) => !remove.has(item));
    if (nextIgnore.length !== watcherIgnore.length) {
      opencode.watcher.ignore = nextIgnore;
      changed = true;
    }
  }
  const skillsPath = manifest.managedOpencode?.skillsPath || ".opencode/skills";
  if (Array.isArray(opencode.skills?.paths) && opencode.skills.paths.includes(skillsPath)) {
    const skillsRoot = path.join(targetRoot, skillsPath);
    const hasRemainingSkills = fs.existsSync(skillsRoot) && listFilesRecursive(skillsRoot).length > 0;
    if (!hasRemainingSkills) {
      opencode.skills.paths = opencode.skills.paths.filter((item) => item !== skillsPath);
      changed = true;
    }
  }
  if (changed && !dryRun) {
    writeJson(opencodePath, opencode);
  }
  return changed;
}

async function confirmUninstall(flags, targetRoot, manifest) {
  if (flags.yes || flags["dry-run"] || !process.stdin.isTTY) {
    return;
  }
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`Remove ${manifest.files.length} Wefter-managed files from ${targetRoot}? Type 'yes' to continue: `);
  rl.close();
  if (answer.trim().toLowerCase() !== "yes") {
    throw new Error("Uninstall cancelled.");
  }
}

async function commandUninstall(flags) {
  const targetRoot = resolveTarget(flags);
  const manifest = readInstallManifest(targetRoot);
  await confirmUninstall(flags, targetRoot, manifest);

  const removed = [];
  const skipped = [];
  let skippedModified = false;
  for (const item of [...manifest.files].sort((a, b) => b.path.length - a.path.length)) {
    const relativePath = normalizeRelativePath(item.path, "install manifest file path");
    const fullPath = path.join(targetRoot, relativePath);
    ensureInside(targetRoot, fullPath, "install manifest file");
    if (!fs.existsSync(fullPath)) {
      skipped.push(`${relativePath} (missing)`);
      continue;
    }
    const currentHash = sha256File(fullPath);
    if (currentHash !== item.sha256 && !flags.force) {
      skipped.push(`${relativePath} (modified; use --force to remove)`);
      skippedModified = true;
      continue;
    }
    if (!flags["dry-run"]) {
      fs.unlinkSync(fullPath);
      removeEmptyParents(targetRoot, path.dirname(fullPath));
    }
    removed.push(relativePath);
  }

  const opencodeChanged = updateOpencodeForUninstall(targetRoot, manifest, flags["dry-run"]);
  const manifestPath = path.join(targetRoot, INSTALL_MANIFEST_FILE);
  if (fs.existsSync(manifestPath) && !flags["dry-run"] && !skippedModified) {
    fs.unlinkSync(manifestPath);
    removeEmptyParents(targetRoot, path.dirname(manifestPath));
  }

  console.log(`${flags["dry-run"] ? "Would remove" : "Removed"} Wefter-managed files: ${removed.length}`);
  if (skipped.length > 0) {
    console.log(`Skipped files: ${skipped.length}`);
    for (const item of skipped) {
      console.log(`- ${item}`);
    }
  }
  if (opencodeChanged) {
    console.log(`${flags["dry-run"] ? "Would update" : "Updated"} opencode.json Wefter entries.`);
  }
  if (skippedModified && !flags["dry-run"]) {
    console.log(`Kept ${INSTALL_MANIFEST_FILE} so skipped files can be reviewed or removed with --force.`);
  }
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
  const profilePathRelative = normalizeRelativePath(flags["profile-path"] || config.profilePath, "profilePath");
  const profilePath = path.join(targetRoot, profilePathRelative);
  ensureInside(targetRoot, profilePath, "profilePath");
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
  const auditorPrompt = documentationAuditAuditorPrompt(targetRoot, config, profile);

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
  const auditorTemplate = readTextRequired(auditorPrompt.fullPath);
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
    profilePath: profilePathRelative,
    auditorPromptPath: auditorPrompt.relativePath,
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

  fs.writeFileSync(path.join(stagingRunRoot, "README.md"), `# Documentation Audit Run\n\nRun: ${runName}\n\n## Counts\n\n- Lenses: ${profile.lenses.length}\n- Variants: ${profile.variants.length}\n- Passes per lens/variant: ${passesPerLens}\n- Auditor prompts: ${combinations.length}\n\n## Execution Order\n\n1. Do not execute this run in plan mode or any read-only runtime. Audit execution must be able to write artifacts under this run directory.\n2. Read manifest.json and execute auditor prompts using the exact prompt and output paths listed there. Do not locate prompts with wildcard or glob patterns.\n3. Execute auditor prompts from prompts/auditors/ and write outputs to raw/.\n4. After each batch, compare manifest outputs against raw/ files and retry missing outputs once before continuing.\n5. Execute prompts/consolidate.md only after every expected raw output exists.\n6. Execute prompts/validate.md after consolidation exists.\n7. Review final/final-documentation-audit-report.md.\n\n## opencode Command\n\n- Use /wefter-audit-docs with this run path to execute or resume the end-to-end audit.\n`, "utf8");

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory was created before finalizing the staging move: ${runRoot}`);
  }
  fs.renameSync(stagingRunRoot, runRoot);

  console.log(`Created documentation audit run: ${runRoot}`);
  console.log(`Auditor prompts generated: ${combinations.length}`);
  console.log(`Next prompt directory: ${path.join(runRoot, "prompts", "auditors")}`);
}

function commandDocsRepair(flags) {
  const targetRoot = resolveTarget(flags);
  const config = readConfig(targetRoot);
  if (!flags["audit-report"]) {
    throw new Error("--audit-report is required for docs repair.");
  }
  const auditReportPath = normalizeRelativePath(flags["audit-report"], "audit-report");
  const auditReportFullPath = path.join(targetRoot, auditReportPath);
  ensureInside(targetRoot, auditReportFullPath, "audit report");
  if (!fs.existsSync(auditReportFullPath)) {
    throw new Error(`Audit report not found: ${auditReportFullPath}`);
  }

  const runName = flags["run-name"] || timestampRunName();
  assertSafeRunName(runName);

  const artifactRootRelative = documentationRepairArtifactRoot();
  const artifactRoot = path.join(targetRoot, artifactRootRelative);
  const tempRoot = path.join(artifactRoot, ".tmp");
  const runRoot = path.join(artifactRoot, runName);
  const stagingRunRoot = path.join(tempRoot, runName);
  ensureInside(targetRoot, artifactRoot, "documentation repair artifact root");
  ensureInside(targetRoot, runRoot, "documentation repair run root");
  ensureInside(targetRoot, stagingRunRoot, "documentation repair staging run root");

  if (flags["dry-run"]) {
    console.log(`Run name: ${runName}`);
    console.log(`Audit report: ${auditReportPath}`);
    console.log(`Output root: ${runRoot}`);
    return;
  }

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory already exists: ${runRoot}. Use a different --run-name or resume the existing run.`);
  }
  if (fs.existsSync(stagingRunRoot)) {
    throw new Error(`Staging directory already exists: ${stagingRunRoot}. Remove it manually after verifying no repair run is in progress, or use a different --run-name.`);
  }

  const runRootRelative = toPosix(path.join(artifactRootRelative, runName));
  const promptsRoot = path.join(stagingRunRoot, "prompts");
  const planningRoot = path.join(stagingRunRoot, "planning");
  const repairRoot = path.join(stagingRunRoot, "repair");
  const reviewRoot = path.join(stagingRunRoot, "review");
  const finalRoot = path.join(stagingRunRoot, "final");
  for (const directory of [artifactRoot, tempRoot, stagingRunRoot, promptsRoot, planningRoot, repairRoot, reviewRoot, finalRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const templateRoot = path.join(documentationRepairTemplateRoot(), "prompts");
  const planTemplate = fs.readFileSync(path.join(templateRoot, "repair-plan-prompt.md"), "utf8");
  const applyTemplate = fs.readFileSync(path.join(templateRoot, "repair-apply-prompt.md"), "utf8");
  const reviewTemplate = fs.readFileSync(path.join(templateRoot, "repair-review-prompt.md"), "utf8");
  const repairPlan = toPosix(path.join(runRootRelative, "planning", "documentation-repair-plan.md"));
  const humanDecisions = toPosix(path.join(runRootRelative, "planning", "human-decisions.md"));
  const repairLog = toPosix(path.join(runRootRelative, "repair", "repair-log.md"));
  const reviewOutput = toPosix(path.join(runRootRelative, "review", "repair-review.md"));
  const finalSummary = toPosix(path.join(runRootRelative, "final", "documentation-repair-summary.md"));
  const profile = readJsonIfExists(path.join(targetRoot, config.profilePath), "audit profile");
  const baseValues = {
    RUN_ID: runName,
    RUN_ROOT: runRootRelative,
    AUDIT_REPORT: auditReportPath,
    REPAIR_PLAN_OUTPUT: repairPlan,
    HUMAN_DECISIONS_OUTPUT: humanDecisions,
    REPAIR_LOG_OUTPUT: repairLog,
    REVIEW_OUTPUT: reviewOutput,
    FINAL_SUMMARY_OUTPUT: finalSummary,
    CORPUS_INCLUDE: markdownList(profile?.corpus?.include || ["*.md", "docs/**/*.md"]),
    CORPUS_EXCLUDE: markdownList(profile?.corpus?.exclude || ["node_modules/**", ".git/**", ".audit/**", ".opencode/**"])
  };

  fs.writeFileSync(path.join(promptsRoot, "plan-repair.md"), renderTemplate(planTemplate, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "apply-repair.md"), renderTemplate(applyTemplate, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "review-repair.md"), renderTemplate(reviewTemplate, baseValues), "utf8");

  writeJson(path.join(stagingRunRoot, "manifest.json"), {
    version: 1,
    workflowId: DOCUMENTATION_REPAIR_WORKFLOW_ID,
    runId: runName,
    generatedAt: new Date().toISOString(),
    auditReport: auditReportPath,
    paths: {
      runRoot: runRootRelative,
      prompts: toPosix(path.join(runRootRelative, "prompts")),
      repairPlan,
      humanDecisions,
      repairLog,
      reviewOutput,
      finalSummary
    },
    prompts: {
      planRepair: toPosix(path.join(runRootRelative, "prompts", "plan-repair.md")),
      applyRepair: toPosix(path.join(runRootRelative, "prompts", "apply-repair.md")),
      reviewRepair: toPosix(path.join(runRootRelative, "prompts", "review-repair.md"))
    }
  });

  fs.writeFileSync(path.join(stagingRunRoot, "README.md"), `# Documentation Repair Run\n\nRun: ${runName}\nAudit report: ${auditReportPath}\n\n## Execution Order\n\n1. Execute prompts/plan-repair.md.\n2. If planning records human decisions, pause until they are resolved.\n3. Execute prompts/apply-repair.md after approval.\n4. Execute prompts/review-repair.md after repair edits.\n5. Run a follow-up documentation audit.\n`, "utf8");

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory was created before finalizing the staging move: ${runRoot}`);
  }
  fs.renameSync(stagingRunRoot, runRoot);

  console.log(`Created documentation repair run: ${runRoot}`);
  console.log(`Audit report: ${auditReportPath}`);
  console.log(`Next prompt: ${path.join(runRoot, "prompts", "plan-repair.md")}`);
}

function productSpecPath(specRoot, releaseId, relativePath) {
  return toPosix(path.join(specRoot, relativePath.replaceAll("<release-id>", releaseId)));
}

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

function productRunRootFromValidationFlags(targetRoot, productConfig, flags = {}) {
  if (flags["run-id"] && flags["run-root"]) {
    throw new Error("Use either --run-id or --run-root, not both.");
  }
  if (flags["run-id"]) {
    assertSafeRunName(flags["run-id"]);
    return resolveInsideTarget(targetRoot, path.join(productConfig.runRoot, flags["run-id"]), "product-shaping run root");
  }
  if (flags["run-root"]) {
    return resolveInsideTarget(targetRoot, flags["run-root"], "product-shaping run root");
  }
  return null;
}

function hasPassingAdversarialReview(content) {
  return /(?:status|result):\s*pass/i.test(content) && /blocking findings:\s*(?:none|0)/i.test(content);
}

function hasPassingFinalValidation(content) {
  return /(?:status|result):\s*pass/i.test(content) && /ready for delivery implementation:\s*yes/i.test(content);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isInsideDirectory(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function deliverableSections(deliverables) {
  const headingPattern = /^##\s+(Deliverable\s+([A-Za-z0-9][A-Za-z0-9_-]*):\s+\S.*)$/gm;
  const headings = [];
  let match;
  while ((match = headingPattern.exec(deliverables)) !== null) {
    headings.push({ title: match[1].trim(), id: match[2], index: match.index });
  }

  return headings.map((start, index) => {
    const next = headings[index + 1];
    const end = next ? next.index : deliverables.length;
    return {
      title: start.title,
      id: start.id,
      index: start.index,
      end,
      body: deliverables.slice(start.index, end)
    };
  });
}

function parseProductDeliverablesHandoff(value) {
  const normalized = normalizeRelativePath(value, "deliverables document");
  const match = normalized.match(/^(.*)\/releases\/([^/]+)\/DELIVERABLES\.md$/i);
  if (!match) {
    return null;
  }
  return {
    deliverablesDocument: normalized,
    specRoot: normalizeRelativePath(match[1], "product-shaping handoff spec root"),
    releaseId: match[2]
  };
}

function alignDeliverySourceDocsWithHandoff(deliveryConfig) {
  const handoff = parseProductDeliverablesHandoff(deliveryConfig.deliverablesDocument);
  if (!handoff) {
    return;
  }
  const handoffGlob = `${handoff.specRoot}/**/*.md`;
  deliveryConfig.sourceDocs.include = unique([
    ...deliveryConfig.sourceDocs.include.filter((item) => item !== ".wefter/specs/**/*.md" || handoff.specRoot === ".wefter/specs"),
    handoffGlob
  ]);
}

function numericId(value) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    return null;
  }
  return String(Number.parseInt(text, 10));
}

function deliveryUnitMatchesDeliverable(sectionId, deliveryUnitId, deliveryUnitKey) {
  const normalizedSectionId = sectionId.toLowerCase();
  const raw = String(deliveryUnitId).trim().toLowerCase();
  const keySuffix = deliveryUnitKey.replace(/^delivery-unit-/, "");
  const sectionNumber = numericId(normalizedSectionId);
  if (sectionNumber !== null && (sectionNumber === numericId(raw) || sectionNumber === numericId(keySuffix))) {
    return true;
  }
  return normalizedSectionId === raw || normalizedSectionId === deliveryUnitKey || normalizedSectionId === keySuffix;
}

function assertDeliverableExists(targetRoot, deliveryConfig, deliveryUnitId, deliveryUnitKey) {
  const deliverablesPath = resolveInsideTarget(targetRoot, deliveryConfig.deliverablesDocument, "deliverables document");
  if (!fs.existsSync(deliverablesPath)) {
    throw new Error(`Deliverables document not found: ${toDisplayPath(targetRoot, deliverablesPath)}.`);
  }
  const sections = deliverableSections(fs.readFileSync(deliverablesPath, "utf8"));
  if (!sections.some((section) => deliveryUnitMatchesDeliverable(section.id, deliveryUnitId, deliveryUnitKey))) {
    throw new Error(`Deliverable '${deliveryUnitId}' (${deliveryUnitKey}) is not present in ${deliveryConfig.deliverablesDocument}.`);
  }
}

function validateDeliverableFieldCoverage(deliverables, readyStatuses, errors) {
  const allowed = new Set(["candidate", "ready", "blocked", "deferred", "done"]);
  const requiredLabels = [
    "Goal",
    "Scope",
    "Out of scope",
    "Dependencies",
    "Source docs",
    "Acceptance criteria",
    "Risk areas",
    "Human gate triggers",
    "Expected verification"
  ];
  const sections = deliverableSections(deliverables);
  const allStatuses = [...deliverables.matchAll(/^Status:\s*([A-Za-z-]+)/gim)];
  if (sections.length === 0) {
    if (allStatuses.length > 0) {
      errors.push("DELIVERABLES.md contains Status lines but no deliverable sections with stable ids. Use headings like '## Deliverable 00: <title>'.");
    } else {
      errors.push("DELIVERABLES.md contains no deliverable sections with stable ids. Use headings like '## Deliverable 00: <title>'.");
    }
    return;
  }
  const seenIds = new Set();
  for (const section of sections) {
    const normalizedId = section.id.toLowerCase();
    if (seenIds.has(normalizedId)) {
      errors.push(`DELIVERABLES.md deliverable id '${section.id}' must be unique.`);
    }
    seenIds.add(normalizedId);
  }
  for (const status of allStatuses) {
    const inSection = sections.some((section) => status.index >= section.index && status.index < section.end);
    if (!inSection) {
      errors.push("DELIVERABLES.md contains a Status line outside a deliverable section with a stable id.");
    }
  }
  sections.forEach((section, index) => {
    const title = section.title || `deliverable ${index + 1}`;
    const statuses = [...section.body.matchAll(/^Status:\s*([A-Za-z-]+)/gim)];
    if (statuses.length !== 1) {
      errors.push(`DELIVERABLES.md deliverable '${title}' must contain exactly one Status line.`);
    } else {
      const status = statuses[0][1].toLowerCase();
      if (!allowed.has(status)) {
        errors.push(`DELIVERABLES.md deliverable '${title}' contains invalid status '${status}'.`);
      } else if (!readyStatuses.has(status)) {
        errors.push(`DELIVERABLES.md deliverable '${title}' contains non-ready status '${status}'. Ready statuses: ${[...readyStatuses].join(", ")}.`);
      }
    }
    for (const label of requiredLabels) {
      const labelPattern = new RegExp(`^${escapeRegExp(label)}:\\s*\\S`, "im");
      const headingPattern = new RegExp(`^#{2,6}\\s+${escapeRegExp(label)}\\s*$`, "im");
      if (!labelPattern.test(section.body) && !headingPattern.test(section.body)) {
        errors.push(`DELIVERABLES.md deliverable '${title}' is missing required field '${label}:'.`);
      }
    }
  });
}

function hasUnresolvedReleaseBlockingQuestion(openQuestions) {
  const blockStarts = [...openQuestions.matchAll(/^(?:##\s+.+|Question id:\s*.+)$/gim)].map((match) => match.index);
  const blocks = blockStarts.length > 0
    ? blockStarts.map((start, index) => openQuestions.slice(start, blockStarts[index + 1] || openQuestions.length))
    : [openQuestions];
  return blocks.some((block) => /blocks target release:\s*yes/i.test(block) && /status:\s*(?:open|deferred)/i.test(block));
}

function validateReferenceCollection(specRoot, errors) {
  const referencesRoot = path.join(specRoot, "references");
  const referencesIndexPath = path.join(referencesRoot, "README.md");
  const referencesIndex = readTextIfExists(referencesIndexPath);
  if (!referencesIndex) {
    return;
  }

  const referenceFiles = fs.existsSync(referencesRoot)
    ? fs.readdirSync(referencesRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md") && entry.name.toLowerCase() !== "readme.md")
      .map((entry) => entry.name)
    : [];
  const listedReferences = [...referencesIndex.matchAll(/\breferences\/(?!README\.md\b)[A-Za-z0-9_.-]+\.md\b/gi)]
    .map((match) => toPosix(match[0]).replace(/^\.\//, ""));
  const listedReferenceSet = new Set(listedReferences.map((reference) => reference.toLowerCase()));

  if (referenceFiles.length === 0 && !/no (?:external )?references (?:used|researched|required)|zero references/i.test(referencesIndex)) {
    errors.push("references/README.md must explicitly state when no individual reference files are used.");
  }
  for (const listedReference of listedReferences) {
    const fullPath = path.join(specRoot, listedReference);
    ensureInside(specRoot, fullPath, `listed reference ${listedReference}`);
    if (!fs.existsSync(fullPath)) {
      errors.push(`references/README.md lists missing reference file '${listedReference}'.`);
    }
  }
  for (const referenceFile of referenceFiles) {
    const relativePath = `references/${referenceFile}`;
    if (!listedReferenceSet.has(relativePath.toLowerCase())) {
      errors.push(`references/README.md must list individual reference file '${relativePath}'.`);
    }
  }
}

function validateNoTaskLevelImplementationDetail(deliverables, errors) {
  const blockedPatterns = [
    /task-specs\//i,
    /(?:^|\n)#{1,6}\s+Task\b/i,
    /(?:^|\n)#\s+T\d{2}(?:[-:]|\b)/i,
    /(?:^|\n)#{1,6}\s+T\d{2}[-:]\d+/i,
    /(?:^|\n)```(?:js|javascript|ts|typescript|tsx|jsx|python|py|sql|bash|sh)\b/i,
    /\b(?:implementation|task-logs|task-reviews)\//i,
    /\bRed-Green-Refactor\b/i,
    /\bwrite (?:a )?failing test\b/i,
    /\bmake the test pass\b/i
  ];
  if (blockedPatterns.some((pattern) => pattern.test(deliverables))) {
    errors.push("DELIVERABLES.md appears to contain task-level implementation detail.");
  }
}

function validateRunEvidencePath(targetRoot, runRoot, actualRelative, expectedRelative, label, errors) {
  if (!actualRelative) {
    errors.push(`Missing ${label} path in product-shaping run manifest.`);
    return null;
  }
  const actualPath = resolveInsideTarget(targetRoot, actualRelative, label);
  const expectedPath = path.join(runRoot, expectedRelative);
  if (!isInsideDirectory(runRoot, actualPath) || path.resolve(actualPath) !== path.resolve(expectedPath)) {
    errors.push(`${label} must stay inside the selected product-shaping run at ${toDisplayPath(targetRoot, expectedPath)}.`);
    return null;
  }
  return actualPath;
}

function validateProductSpecs(targetRoot, productConfig, releaseId, flags = {}) {
  const errors = [];
  const warnings = [];
  const specRootRelative = normalizeRelativePath(productConfig.specRoot, "Product-shaping config.specRoot");
  const specRoot = path.join(targetRoot, specRootRelative);
  ensureInside(targetRoot, specRoot, "product-shaping spec root");

  for (const file of productConfig.requiredFiles) {
    const relativePath = file.replaceAll("<release-id>", releaseId);
    const fullPath = path.join(specRoot, relativePath);
    ensureInside(targetRoot, fullPath, `product spec ${relativePath}`);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing required product spec: ${toPosix(path.join(specRootRelative, relativePath))}`);
    }
  }
  validateReferenceCollection(specRoot, errors);

  const openQuestionsPath = path.join(specRoot, "discovery/OPEN_QUESTIONS.md");
  const openQuestions = readTextIfExists(openQuestionsPath);
  if (openQuestions && hasUnresolvedReleaseBlockingQuestion(openQuestions)) {
    errors.push("OPEN_QUESTIONS.md contains an unresolved release-blocking question.");
  }

  const deliverablesPath = path.join(specRoot, "releases", releaseId, "DELIVERABLES.md");
  const deliverables = readTextIfExists(deliverablesPath);
  if (deliverables) {
    const readyStatuses = new Set(productConfig.completionGate.readyDeliverableStatuses.map((status) => status.toLowerCase()));
    validateDeliverableFieldCoverage(deliverables, readyStatuses, errors);
    validateNoTaskLevelImplementationDetail(deliverables, errors);
  }

  if (productConfig.completionGate.requireAdversarialReview || productConfig.completionGate.requireFinalValidation) {
    const runRoot = productRunRootFromValidationFlags(targetRoot, productConfig, flags);
    if (!runRoot) {
      errors.push("Product-shaping validation requires --run-id or --run-root to verify adversarial review and final validation evidence.");
    } else {
      const manifestPath = path.join(runRoot, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        errors.push(`Missing product-shaping run manifest: ${toDisplayPath(targetRoot, manifestPath)}.`);
      } else {
        const manifest = readJson(manifestPath, "product-shaping run manifest");
        if (manifest.workflowId !== PRODUCT_SHAPING_WORKFLOW_ID) {
          errors.push(`Run manifest workflowId must be ${PRODUCT_SHAPING_WORKFLOW_ID}.`);
        }
        if (manifest.releaseId !== releaseId) {
          errors.push(`Run manifest releaseId '${manifest.releaseId}' does not match requested release '${releaseId}'.`);
        }
        const manifestSpecRoot = manifest.paths?.specRoot || manifest.specRoot;
        if (manifestSpecRoot) {
          const normalizedManifestSpecRoot = normalizeRelativePath(manifestSpecRoot, "product-shaping manifest specRoot");
          if (normalizedManifestSpecRoot !== specRootRelative) {
            errors.push(`Run manifest specRoot '${normalizedManifestSpecRoot}' does not match requested spec root '${specRootRelative}'.`);
          }
        } else {
          errors.push("Run manifest is missing specRoot.");
        }
        if (manifest.paths?.runRoot) {
          const manifestRunRoot = resolveInsideTarget(targetRoot, manifest.paths.runRoot, "product-shaping manifest run root");
          if (path.resolve(manifestRunRoot) !== path.resolve(runRoot)) {
            errors.push("Run manifest paths.runRoot does not match the selected product-shaping run root.");
          }
        }
        const outputs = manifest.outputs || {};
        if (productConfig.completionGate.requireAdversarialReview) {
          const reviewPath = validateRunEvidencePath(targetRoot, runRoot, outputs.adversarialReview, path.join("review", "adversarial-review.md"), "adversarial review evidence", errors);
          if (!reviewPath || !fs.existsSync(reviewPath)) {
            errors.push("Missing adversarial review evidence for product-shaping completion gate.");
          } else if (!hasPassingAdversarialReview(fs.readFileSync(reviewPath, "utf8"))) {
            errors.push("Adversarial review evidence must include 'Status: pass' or 'Result: pass' and 'Blocking findings: none'.");
          }
        }
        if (productConfig.completionGate.requireFinalValidation) {
          const finalValidationPath = validateRunEvidencePath(targetRoot, runRoot, outputs.finalValidation, path.join("final", "product-shaping-validation.md"), "final validation evidence", errors);
          if (!finalValidationPath || !fs.existsSync(finalValidationPath)) {
            errors.push("Missing final validation evidence for product-shaping completion gate.");
          } else if (!hasPassingFinalValidation(fs.readFileSync(finalValidationPath, "utf8"))) {
            errors.push("Final validation evidence must include 'Status: pass' or 'Result: pass' and 'Ready for delivery implementation: yes'.");
          }
        }
      }
    }
  }

  return { errors, warnings };
}

function commandProductValidate(flags) {
  const targetRoot = resolveTarget(flags);
  const wefterConfig = readConfig(targetRoot);
  assertWorkflowEnabled(wefterConfig, PRODUCT_SHAPING_WORKFLOW_ID);
  const configPath = productShapingConfigPath(wefterConfig, flags);
  const productConfig = readJson(path.join(targetRoot, configPath), "product-shaping config");
  validateProductShapingConfig(productConfig);

  const releaseId = flags["release-id"] || productConfig.releaseId;
  assertSafeRunName(releaseId);
  const result = validateProductSpecs(targetRoot, productConfig, releaseId, flags);
  const ok = result.errors.length === 0;

  if (flags.json) {
    console.log(JSON.stringify({ ok, releaseId, errors: result.errors, warnings: result.warnings }, null, 2));
  } else {
    console.log(`Product shaping validation: ${ok ? "pass" : "fail"}`);
    console.log(`Release: ${releaseId}`);
    for (const warning of result.warnings) {
      console.log(`WARNING ${warning}`);
    }
    for (const error of result.errors) {
      console.error(`ERROR ${error}`);
    }
  }

  if (!ok) {
    process.exitCode = 1;
  }
}

function commandProductShape(flags) {
  const targetRoot = resolveTarget(flags);
  const wefterConfig = readConfig(targetRoot);
  assertWorkflowEnabled(wefterConfig, PRODUCT_SHAPING_WORKFLOW_ID);
  const configPath = productShapingConfigPath(wefterConfig, flags);
  const profilePath = productShapingProfilePath(wefterConfig, flags);
  const productConfig = readJson(path.join(targetRoot, configPath), "product-shaping config");
  const productProfile = readJson(path.join(targetRoot, profilePath), "product-shaping profile");
  validateProductShapingConfig(productConfig);
  validateProductShapingProfile(productProfile);

  const releaseId = flags["release-id"] || productConfig.releaseId;
  assertSafeRunName(releaseId);
  const specRootRelative = normalizeRelativePath(flags["spec-root"] || productConfig.specRoot, "product-shaping spec root");
  const runArtifactsRootRelative = normalizeRelativePath(flags["run-root"] || productConfig.runRoot, "product-shaping run root");
  const runName = flags["run-name"] || `${timestampRunName()}__${releaseId}`;
  assertSafeRunName(runName);

  const specRoot = path.join(targetRoot, specRootRelative);
  const artifactRoot = path.join(targetRoot, runArtifactsRootRelative);
  const tempRoot = path.join(artifactRoot, ".tmp");
  const runRoot = path.join(artifactRoot, runName);
  const stagingRunRoot = path.join(tempRoot, runName);
  ensureInside(targetRoot, specRoot, "product-shaping spec root");
  ensureInside(targetRoot, artifactRoot, "product-shaping run root");
  ensureInside(targetRoot, runRoot, "product-shaping run");
  ensureInside(targetRoot, stagingRunRoot, "product-shaping staging run");

  const requiredFiles = productConfig.requiredFiles.map((file) => ({
    templatePath: file,
    path: file.replaceAll("<release-id>", releaseId),
    fullPath: productSpecPath(specRootRelative, releaseId, file)
  }));

  if (flags["dry-run"]) {
    console.log(`Run name: ${runName}`);
    console.log(`Release: ${releaseId}`);
    console.log(`Spec root: ${specRootRelative}`);
    console.log(`Output root: ${toPosix(path.join(runArtifactsRootRelative, runName))}`);
    console.log(`Required product spec files: ${requiredFiles.length}`);
    return;
  }

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory already exists: ${runRoot}. Use a different --run-name or resume the existing run.`);
  }
  if (fs.existsSync(stagingRunRoot)) {
    throw new Error(`Staging directory already exists: ${stagingRunRoot}. Remove it manually after verifying no product-shaping run is in progress, or use a different --run-name.`);
  }

  const runRootRelative = toPosix(path.join(runArtifactsRootRelative, runName));
  const adversarialReviewPath = toPosix(path.join(runRootRelative, "review", "adversarial-review.md"));
  const finalValidationPath = toPosix(path.join(runRootRelative, "final", "product-shaping-validation.md"));
  const handoffDeliverablesPath = productSpecPath(specRootRelative, releaseId, "releases/<release-id>/DELIVERABLES.md");
  const promptsRoot = path.join(stagingRunRoot, "prompts");
  const draftRoot = path.join(stagingRunRoot, "draft");
  const reviewRoot = path.join(stagingRunRoot, "review");
  const validationRoot = path.join(stagingRunRoot, "validation");
  const finalRoot = path.join(stagingRunRoot, "final");
  for (const directory of [artifactRoot, tempRoot, stagingRunRoot, promptsRoot, draftRoot, reviewRoot, validationRoot, finalRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const promptTemplateRoot = path.join(targetRoot, wefterConfig.workflowRoot, PRODUCT_SHAPING_WORKFLOW_ID, "templates", "prompts");
  const promptValues = {
    RUN_ID: runName,
    RELEASE_ID: releaseId,
    CONFIG_PATH: configPath,
    PROFILE_PATH: profilePath,
    CONTRACT_PATH: productConfig.contractPath,
    PROCESS_DOC_PATH: productConfig.processDocPath,
    SPEC_ROOT: specRootRelative,
    RUN_ROOT: runRootRelative,
    REQUIRED_FILES: markdownList(requiredFiles.map((file) => file.fullPath)),
    DELIVERABLES_PATH: handoffDeliverablesPath,
    ADVERSARIAL_REVIEW_PATH: adversarialReviewPath,
    FINAL_VALIDATION_PATH: finalValidationPath,
    SCOPE_PATH: productSpecPath(specRootRelative, releaseId, "releases/<release-id>/SCOPE.md"),
    DOMAIN_SPEC_PATH: productSpecPath(specRootRelative, releaseId, "releases/<release-id>/DOMAIN_SPEC.md"),
    ACCEPTANCE_CRITERIA_PATH: productSpecPath(specRootRelative, releaseId, "releases/<release-id>/ACCEPTANCE_CRITERIA.md"),
    OPEN_QUESTIONS_PATH: productSpecPath(specRootRelative, releaseId, "discovery/OPEN_QUESTIONS.md"),
    PRODUCT_DECISIONS_PATH: productSpecPath(specRootRelative, releaseId, "product/PRODUCT_DECISIONS.md")
  };

  const promptRecords = [];
  for (const file of PRODUCT_SHAPING_PROMPT_FILES) {
    const source = path.join(promptTemplateRoot, file);
    const template = readTextRequired(source);
    const rendered = renderTemplate(template, promptValues);
    const destination = path.join(promptsRoot, file);
    assertNoPlaceholders(destination, rendered);
    fs.writeFileSync(destination, rendered, "utf8");
    promptRecords.push(toPosix(path.join(runRootRelative, "prompts", file)));
  }

  writeJson(path.join(stagingRunRoot, "manifest.json"), {
    version: 1,
    workflowId: PRODUCT_SHAPING_WORKFLOW_ID,
    runId: runName,
    releaseId,
    generatedAt: new Date().toISOString(),
    configPath,
    profilePath,
    contractPath: productConfig.contractPath,
    processDocPath: productConfig.processDocPath,
    specRoot: specRootRelative,
    counts: {
      requiredFiles: requiredFiles.length,
      variants: productProfile.variants.length,
      lenses: productProfile.lenses.length
    },
    paths: {
      runRoot: runRootRelative,
      prompts: toPosix(path.join(runRootRelative, "prompts")),
      draft: toPosix(path.join(runRootRelative, "draft")),
      review: toPosix(path.join(runRootRelative, "review")),
      validation: toPosix(path.join(runRootRelative, "validation")),
      final: toPosix(path.join(runRootRelative, "final")),
      specRoot: specRootRelative,
      releaseRoot: toPosix(path.join(specRootRelative, "releases", releaseId))
    },
    outputs: {
      adversarialReview: adversarialReviewPath,
      finalValidation: finalValidationPath
    },
    handoff: {
      deliverables: handoffDeliverablesPath
    },
    gate: {
      status: "pending",
      requireNoReleaseBlockingQuestions: productConfig.completionGate.requireNoReleaseBlockingQuestions,
      requireAdversarialReview: productConfig.completionGate.requireAdversarialReview,
      requireFinalValidation: productConfig.completionGate.requireFinalValidation,
      readyDeliverableStatuses: productConfig.completionGate.readyDeliverableStatuses
    },
    prompts: promptRecords,
    requiredFiles
  });

  fs.writeFileSync(path.join(stagingRunRoot, "README.md"), `# Product Shaping Run\n\nRun: ${runName}\nRelease: ${releaseId}\n\n## Roots\n\n- Specs: ${specRootRelative}\n- Run: ${runRootRelative}\n- Config: ${configPath}\n- Profile: ${profilePath}\n- Contract: ${productConfig.contractPath}\n\n## Execution Order\n\n1. Read ${productConfig.processDocPath}.\n2. Read ${productConfig.contractPath}.\n3. Create or repair product specs under ${specRootRelative}.\n4. Keep runtime notes and draft artifacts in this run directory.\n5. Write adversarial review evidence to ${adversarialReviewPath}.\n6. Write final validation evidence to ${finalValidationPath}.\n7. Validate that release-blocking questions, scope, domain spec, acceptance criteria and deliverables satisfy the completion gate.\n8. Hand off only ${handoffDeliverablesPath} to delivery implementation.\n\n## Passing Evidence Format\n\n- Adversarial review must include \`Status: pass\` or \`Result: pass\` and \`Blocking findings: none\`.\n- Final validation must include \`Status: pass\` or \`Result: pass\` and \`Ready for delivery implementation: yes\`.\n\n## Required Product Spec Files\n\n${requiredFiles.map((file) => `- ${file.fullPath}`).join("\n")}\n`, "utf8");

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory was created before finalizing the staging move: ${runRoot}`);
  }
  fs.renameSync(stagingRunRoot, runRoot);

  console.log(`Created product-shaping run: ${runRoot}`);
  console.log(`Release: ${releaseId}`);
  console.log(`Spec root: ${specRootRelative}`);
  console.log(`Required product spec files: ${requiredFiles.length}`);
}

function productValidationFlagsFromDeliveryFlags(flags) {
  const validationFlags = {};
  if (flags["product-run-id"] && flags["product-run-root"]) {
    throw new Error("Use either --product-run-id or --product-run-root, not both.");
  }
  if (flags["product-run-id"]) {
    validationFlags["run-id"] = flags["product-run-id"];
  }
  if (flags["product-run-root"]) {
    validationFlags["run-root"] = flags["product-run-root"];
  }
  return validationFlags;
}

function rebaseReleasePath(value, previousReleaseId, nextReleaseId) {
  const normalized = normalizeRelativePath(value, "release-scoped path");
  const marker = `/releases/${previousReleaseId}/`;
  if (normalized.includes(marker)) {
    return normalized.replace(marker, `/releases/${nextReleaseId}/`);
  }
  const prefix = `releases/${previousReleaseId}/`;
  if (normalized.startsWith(prefix)) {
    return `releases/${nextReleaseId}/${normalized.slice(prefix.length)}`;
  }
  return normalized;
}

function enforceProductHandoffGate(targetRoot, wefterConfig, deliveryConfig, flags) {
  const productConfigPath = productShapingConfigPath(wefterConfig);
  const productConfig = readJson(path.join(targetRoot, productConfigPath), "product-shaping config");
  validateProductShapingConfig(productConfig);
  const handoff = parseProductDeliverablesHandoff(deliveryConfig.deliverablesDocument);
  if (!handoff) {
    return;
  }
  if (handoff.releaseId !== deliveryConfig.releaseId) {
    const expectedHandoff = productSpecPath(normalizeRelativePath(productConfig.specRoot, "Product-shaping config.specRoot"), deliveryConfig.releaseId, "releases/<release-id>/DELIVERABLES.md");
    throw new Error(`Product-shaping handoff must use the configured DELIVERABLES.md path '${expectedHandoff}', but got '${handoff.deliverablesDocument}'.`);
  }

  if (!flags["product-run-id"] && !flags["product-run-root"]) {
    throw new Error(`Using product-shaping DELIVERABLES.md as a delivery handoff requires --product-run-id or --product-run-root so the product completion gate can be verified.`);
  }

  const result = validateProductSpecs(targetRoot, { ...productConfig, specRoot: handoff.specRoot }, deliveryConfig.releaseId, productValidationFlagsFromDeliveryFlags(flags));
  if (result.errors.length > 0) {
    throw new Error(`Product-shaping handoff is not valid for delivery implementation:\n- ${result.errors.join("\n- ")}`);
  }
}

function commandDeliveryRun(flags) {
  const targetRoot = resolveTarget(flags);
  const wefterConfig = readConfig(targetRoot);
  assertWorkflowEnabled(wefterConfig, DELIVERY_WORKFLOW_ID);
  const configPath = deliveryConfigPath(wefterConfig, flags);
  const profilePath = deliveryProfilePath(wefterConfig, flags);
  const deliveryConfig = readJson(path.join(targetRoot, configPath), "delivery config");
  if (flags["deliverables-document"]) {
    deliveryConfig.deliverablesDocument = normalizeRelativePath(flags["deliverables-document"], "deliverables document override");
  }
  if (flags["release-id"]) {
    const previousReleaseId = deliveryConfig.releaseId;
    const nextReleaseId = requireString(flags["release-id"], "release id override");
    assertSafeRunName(nextReleaseId);
    deliveryConfig.deliverablesDocument = rebaseReleasePath(deliveryConfig.deliverablesDocument, previousReleaseId, nextReleaseId);
    deliveryConfig.versionedArtifacts.executionRoot = rebaseReleasePath(deliveryConfig.versionedArtifacts.executionRoot, previousReleaseId, nextReleaseId);
    deliveryConfig.versionedArtifacts.decisionLogRoot = rebaseReleasePath(deliveryConfig.versionedArtifacts.decisionLogRoot, previousReleaseId, nextReleaseId);
    deliveryConfig.releaseId = nextReleaseId;
  }
  alignDeliverySourceDocsWithHandoff(deliveryConfig);
  const profile = readJson(path.join(targetRoot, profilePath), "delivery profile");
  validateDeliveryConfig(deliveryConfig);
  validateDeliveryProfile(profile);
  enforceProductHandoffGate(targetRoot, wefterConfig, deliveryConfig, flags);

  const deliveryUnitId = flags["deliverable-id"] || deliveryConfig.defaultDeliveryUnitId;
  const deliveryUnitKey = getSafeDeliveryUnitKey(deliveryUnitId);
  assertDeliverableExists(targetRoot, deliveryConfig, deliveryUnitId, deliveryUnitKey);
  const passesPerLens = flags["passes-per-lens"] ? parseStrictInteger(flags["passes-per-lens"], "--passes-per-lens", 1) : deliveryConfig.defaultPlanAuditPassesPerLens;
  const maxAudits = flags["max-audits"] ? parseStrictInteger(flags["max-audits"], "--max-audits", 0) : 0;

  const runName = flags["run-name"] || `${timestampRunName()}__${deliveryUnitKey}`;
  assertSafeRunName(runName);
  const combinations = buildCombinations(profile, passesPerLens, maxAudits).map((combo, index) => ({
    ...combo,
    auditId: `P${String(index + 1).padStart(4, "0")}__${combo.lens.id}__${combo.variant.id}__p${String(combo.pass).padStart(2, "0")}`
  }));

  const artifactRoot = path.join(targetRoot, deliveryConfig.runArtifactsRoot);
  const tempRoot = path.join(artifactRoot, ".tmp");
  const runRoot = path.join(artifactRoot, runName);
  const stagingRunRoot = path.join(tempRoot, runName);
  ensureInside(targetRoot, artifactRoot, "delivery runArtifactsRoot");
  ensureInside(targetRoot, runRoot, "delivery runRoot");
  ensureInside(targetRoot, stagingRunRoot, "delivery stagingRunRoot");

  const runRootRelative = toPosix(path.join(deliveryConfig.runArtifactsRoot, runName));
  const versionedDeliveryDir = toPosix(path.join(deliveryConfig.versionedArtifacts.executionRoot, deliveryUnitKey));
  const versionedTaskSpecsDir = toPosix(path.join(versionedDeliveryDir, "task-specs"));
  const versionedDecisionLog = toPosix(path.join(deliveryConfig.versionedArtifacts.decisionLogRoot, `${deliveryUnitKey}-decisions.md`));

  if (flags["dry-run"]) {
    console.log(`Run name: ${runName}`);
    console.log(`Delivery unit: ${deliveryUnitKey}`);
    console.log(`Lenses: ${profile.lenses.length}`);
    console.log(`Variants: ${profile.variants.length}`);
    console.log(`Passes per lens/variant: ${passesPerLens}`);
    console.log(`Plan auditor prompts to generate: ${combinations.length}`);
    console.log(`Output root: ${runRoot}`);
    console.log(`Versioned delivery dir: ${versionedDeliveryDir}`);
    return;
  }

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory already exists: ${runRoot}. Use a different --run-name or resume the existing run.`);
  }
  if (fs.existsSync(stagingRunRoot)) {
    throw new Error(`Staging directory already exists: ${stagingRunRoot}. Remove it manually after verifying no run is in progress, or use a different --run-name.`);
  }

  const promptsRoot = path.join(stagingRunRoot, "prompts");
  const planAuditorPromptsRoot = path.join(promptsRoot, "plan-auditors", deliveryUnitKey);
  const planningRoot = path.join(stagingRunRoot, "planning");
  const draftRoot = path.join(planningRoot, "draft");
  const draftTaskSpecsRoot = path.join(draftRoot, "task-specs");
  const finalRoot = path.join(stagingRunRoot, "final");
  const candidateRoot = path.join(finalRoot, "approved-artifacts");
  const candidateDeliveryRoot = path.join(candidateRoot, deliveryUnitKey);
  const candidateTaskSpecsRoot = path.join(candidateDeliveryRoot, "task-specs");
  const rawPlanAuditsRoot = path.join(stagingRunRoot, "raw", "plan-audits");
  const consolidationRoot = path.join(stagingRunRoot, "consolidation");
  const validationRoot = path.join(stagingRunRoot, "validation");
  const implementationRoot = path.join(stagingRunRoot, "implementation");
  const taskLogRoot = path.join(implementationRoot, "task-logs");
  const taskReviewRoot = path.join(implementationRoot, "task-reviews");
  for (const directory of [artifactRoot, tempRoot, stagingRunRoot, promptsRoot, planAuditorPromptsRoot, planningRoot, draftRoot, draftTaskSpecsRoot, finalRoot, candidateRoot, candidateDeliveryRoot, candidateTaskSpecsRoot, rawPlanAuditsRoot, consolidationRoot, validationRoot, implementationRoot, taskLogRoot, taskReviewRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const templateRoot = path.join(targetRoot, wefterConfig.workflowRoot, DELIVERY_WORKFLOW_ID, "templates", "prompts");
  const templates = {
    planner: fs.readFileSync(path.join(templateRoot, "planner-prompt.md"), "utf8"),
    planAuditor: fs.readFileSync(path.join(templateRoot, "plan-auditor-prompt.md"), "utf8"),
    consolidator: fs.readFileSync(path.join(templateRoot, "plan-consolidator-prompt.md"), "utf8"),
    validator: fs.readFileSync(path.join(templateRoot, "plan-validator-prompt.md"), "utf8"),
    repairer: fs.readFileSync(path.join(templateRoot, "plan-repairer-prompt.md"), "utf8"),
    taskImplementation: fs.readFileSync(path.join(templateRoot, "task-implementation-prompt.md"), "utf8"),
    taskReview: fs.readFileSync(path.join(templateRoot, "task-review-prompt.md"), "utf8"),
    deliveryValidator: fs.readFileSync(path.join(templateRoot, "delivery-validator-prompt.md"), "utf8")
  };

  const draftPlan = toPosix(path.join(runRootRelative, "planning", "draft", "delivery-plan.md"));
  const draftTraceability = toPosix(path.join(runRootRelative, "planning", "draft", "traceability-matrix.md"));
  const draftVerification = toPosix(path.join(runRootRelative, "planning", "draft", "verification-plan.md"));
  const draftGate = toPosix(path.join(runRootRelative, "planning", "draft", "gate-assessment.md"));
  const draftDecisions = toPosix(path.join(runRootRelative, "planning", "draft", "decisions-draft.md"));
  const draftTaskSpecs = toPosix(path.join(runRootRelative, "planning", "draft", "task-specs"));
  const candidatePlan = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, "delivery-plan.md"));
  const candidateTraceability = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, "traceability-matrix.md"));
  const candidateVerification = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, "verification-plan.md"));
  const candidateGate = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, "gate-assessment.md"));
  const candidateDecisions = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, `${deliveryUnitKey}-decisions.md`));
  const candidateTaskSpecs = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, "task-specs"));
  const repairSummary = toPosix(path.join(runRootRelative, "final", "plan-repair-summary.md"));
  const rawPlanAudits = toPosix(path.join(runRootRelative, "raw", "plan-audits"));
  const consolidatedOutput = toPosix(path.join(runRootRelative, "consolidation", "consolidated-plan-candidates.md"));
  const discardedOutput = toPosix(path.join(runRootRelative, "consolidation", "discarded-plan-findings.md"));
  const validationOutput = toPosix(path.join(runRootRelative, "validation", "plan-adversarial-validation-log.md"));
  const finalPlanReview = toPosix(path.join(runRootRelative, "final", "final-plan-review-report.md"));
  const deliveryValidation = toPosix(path.join(runRootRelative, "final", "delivery-validation.md"));
  const taskLogDir = toPosix(path.join(runRootRelative, "implementation", "task-logs"));
  const taskReviewDir = toPosix(path.join(runRootRelative, "implementation", "task-reviews"));
  const versionedDeliveryPlan = toPosix(path.join(versionedDeliveryDir, "delivery-plan.md"));
  const versionedTraceability = toPosix(path.join(versionedDeliveryDir, "traceability-matrix.md"));
  const versionedVerification = toPosix(path.join(versionedDeliveryDir, "verification-plan.md"));

  const baseValues = {
    RUN_ID: runName,
    RUNNER_COMMAND: wefterConfig.runnerCommand,
    DELIVERY_UNIT_ID: deliveryUnitId,
    DELIVERY_UNIT_KEY: deliveryUnitKey,
    RELEASE_ID: deliveryConfig.releaseId,
    CONFIG_PATH: configPath,
    PROFILE_PATH: profilePath,
    RUN_ROOT: runRootRelative,
    DELIVERABLES_DOCUMENT: deliveryConfig.deliverablesDocument,
    SOURCE_INCLUDE: markdownList(deliveryConfig.sourceDocs.include),
    SOURCE_EXCLUDE: markdownList(deliveryConfig.sourceDocs.exclude),
    DRAFT_PLAN_OUTPUT: draftPlan,
    DRAFT_TRACEABILITY_OUTPUT: draftTraceability,
    DRAFT_VERIFICATION_OUTPUT: draftVerification,
    DRAFT_GATE_OUTPUT: draftGate,
    DRAFT_DECISIONS_OUTPUT: draftDecisions,
    DRAFT_TASK_SPECS_DIR: draftTaskSpecs,
    CANDIDATE_PLAN_OUTPUT: candidatePlan,
    CANDIDATE_TRACEABILITY_OUTPUT: candidateTraceability,
    CANDIDATE_VERIFICATION_OUTPUT: candidateVerification,
    CANDIDATE_GATE_OUTPUT: candidateGate,
    CANDIDATE_DECISIONS_OUTPUT: candidateDecisions,
    CANDIDATE_TASK_SPECS_DIR: candidateTaskSpecs,
    REPAIR_SUMMARY_OUTPUT: repairSummary,
    RAW_PLAN_AUDITS_DIR: rawPlanAudits,
    CONSOLIDATED_OUTPUT: consolidatedOutput,
    DISCARDED_OUTPUT: discardedOutput,
    VALIDATION_OUTPUT: validationOutput,
    FINAL_PLAN_REVIEW_OUTPUT: finalPlanReview,
    VERSIONED_DELIVERY_DIR: versionedDeliveryDir,
    VERSIONED_TASK_SPECS_DIR: versionedTaskSpecsDir,
    VERSIONED_DELIVERY_PLAN: versionedDeliveryPlan,
    VERSIONED_TRACEABILITY_MATRIX: versionedTraceability,
    VERSIONED_VERIFICATION_PLAN: versionedVerification,
    VERSIONED_DECISION_LOG: versionedDecisionLog,
    TASK_LOG_DIR: taskLogDir,
    TASK_REVIEW_DIR: taskReviewDir,
    DELIVERY_VALIDATION_OUTPUT: deliveryValidation
  };

  fs.writeFileSync(path.join(promptsRoot, "plan.md"), renderTemplate(templates.planner, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "consolidate-plan.md"), renderTemplate(templates.consolidator, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "validate-plan.md"), renderTemplate(templates.validator, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "repair-plan.md"), renderTemplate(templates.repairer, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "implement-tasks.md"), renderTemplate(templates.taskImplementation, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "review-task.md"), renderTemplate(templates.taskReview, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "validate-delivery.md"), renderTemplate(templates.deliveryValidator, baseValues), "utf8");

  const promptRecords = [];
  for (const combo of combinations) {
    const outputRelative = toPosix(path.join(runRootRelative, "raw", "plan-audits", `${combo.auditId}.md`));
    const promptRelative = toPosix(path.join(runRootRelative, "prompts", "plan-auditors", deliveryUnitKey, `${combo.auditId}.md`));
    const prompt = renderTemplate(templates.planAuditor, {
      ...baseValues,
      AUDIT_ID: combo.auditId,
      LENS_ID: combo.lens.id,
      LENS_TITLE: combo.lens.title,
      LENS_FOCUS: combo.lens.focus,
      VARIANT_ID: combo.variant.id,
      VARIANT_TITLE: combo.variant.title,
      VARIANT_INSTRUCTION: combo.variant.instruction,
      PASS_NUMBER: combo.pass,
      OUTPUT_FILE: outputRelative
    });
    fs.writeFileSync(path.join(planAuditorPromptsRoot, `${combo.auditId}.md`), prompt, "utf8");
    promptRecords.push({
      auditId: combo.auditId,
      lensId: combo.lens.id,
      variantId: combo.variant.id,
      pass: combo.pass,
      prompt: promptRelative,
      output: outputRelative
    });
  }

  writeJson(path.join(stagingRunRoot, "manifest.json"), {
    version: 1,
    workflowId: DELIVERY_WORKFLOW_ID,
    runId: runName,
    deliveryUnitId,
    deliveryUnitKey,
    releaseId: deliveryConfig.releaseId,
    generatedAt: new Date().toISOString(),
    configPath,
    profilePath,
    deliverablesDocument: deliveryConfig.deliverablesDocument,
    passesPerLens,
    maxAudits,
    gatePolicy: deliveryConfig.gatePolicy,
    counts: {
      lenses: profile.lenses.length,
      variants: profile.variants.length,
      planAuditorPrompts: combinations.length
    },
    paths: {
      runRoot: runRootRelative,
      prompts: toPosix(path.join(runRootRelative, "prompts")),
      planPrompt: toPosix(path.join(runRootRelative, "prompts", "plan.md")),
      planAuditorPrompts: toPosix(path.join(runRootRelative, "prompts", "plan-auditors", deliveryUnitKey)),
      rawPlanAudits,
      consolidation: toPosix(path.join(runRootRelative, "consolidation")),
      validation: toPosix(path.join(runRootRelative, "validation")),
      final: toPosix(path.join(runRootRelative, "final")),
      candidateArtifacts: toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey)),
      versionedDeliveryDir,
      versionedDecisionLog
    },
    prompts: {
      plan: toPosix(path.join(runRootRelative, "prompts", "plan.md")),
      planAudits: promptRecords,
      consolidatePlan: toPosix(path.join(runRootRelative, "prompts", "consolidate-plan.md")),
      validatePlan: toPosix(path.join(runRootRelative, "prompts", "validate-plan.md")),
      repairPlan: toPosix(path.join(runRootRelative, "prompts", "repair-plan.md")),
      implementTasks: toPosix(path.join(runRootRelative, "prompts", "implement-tasks.md")),
      reviewTask: toPosix(path.join(runRootRelative, "prompts", "review-task.md")),
      validateDelivery: toPosix(path.join(runRootRelative, "prompts", "validate-delivery.md"))
    }
  });

  fs.writeFileSync(path.join(stagingRunRoot, "README.md"), `# Delivery Implementation Run\n\nRun: ${runName}\nDelivery unit: ${deliveryUnitKey}\nRelease: ${deliveryConfig.releaseId}\n\n## Source Handoff\n\n- Deliverables document: ${deliveryConfig.deliverablesDocument}\n\n## Counts\n\n- Lenses: ${profile.lenses.length}\n- Variants: ${profile.variants.length}\n- Passes per lens/variant: ${passesPerLens}\n- Plan auditor prompts: ${combinations.length}\n\n## Execution Order\n\n1. Execute prompts/plan.md with the delivery planner.\n2. Execute prompts/plan-auditors/${deliveryUnitKey}/*.md with plan auditors.\n3. Execute prompts/consolidate-plan.md.\n4. Execute prompts/validate-plan.md.\n5. Execute prompts/repair-plan.md.\n6. Review final/approved-artifacts/${deliveryUnitKey}/ and apply gate policy.\n7. Publish approved artifacts to ${versionedDeliveryDir} and ${versionedDecisionLog}.\n8. Execute prompts/implement-tasks.md task by task only after approval.\n9. After each implementation or correction, run \`${wefterConfig.runnerCommand} delivery guard --run-id ${runName} --task-id <task-id> --mode ReadyForReview\`.\n10. Review the task with prompts/review-task.md.\n11. After each task review, run \`${wefterConfig.runnerCommand} delivery guard --run-id ${runName} --task-id <task-id> --mode ReadyForNextTask\`.\n12. If the guard reports Needs Fix, correct the same task and repeat implementation guard -> review -> next-task guard.\n13. If the guard reports Blocked, pause the delivery unit for human decision or specification repair.\n14. Before final validation, run \`${wefterConfig.runnerCommand} delivery guard --run-id ${runName} --mode ReadyForFinalValidation\`.\n15. Execute prompts/validate-delivery.md only when all tasks pass review and the final-validation guard passes.\n`, "utf8");

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory was created before finalizing the staging move: ${runRoot}`);
  }
  fs.renameSync(stagingRunRoot, runRoot);

  console.log(`Created delivery implementation run: ${runRoot}`);
  console.log(`Delivery unit: ${deliveryUnitKey}`);
  console.log(`Plan auditor prompts generated: ${combinations.length}`);
  console.log(`Next prompt: ${path.join(runRoot, "prompts", "plan.md")}`);
}

function commandDeliveryGuard(flags) {
  commandDeliveryGuardInternal(flags);
}

function requireProperty(object, name, context) {
  if (!object || typeof object !== "object" || Array.isArray(object) || !(name in object)) {
    throw new Error(`${context} is missing required property '${name}'.`);
  }
  return object[name];
}

function getReviewMachineResult(reviewPath, expectedTaskId) {
  const content = fs.readFileSync(reviewPath, "utf8");
  const match = content.match(/##\s+Machine Result\s*```json\s*(\{[\s\S]*?\})\s*```/i);
  if (!match) {
    throw new Error(`Review '${reviewPath}' must contain a '## Machine Result' section with a fenced json object.`);
  }

  let machine;
  try {
    machine = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Review '${reviewPath}' contains invalid Machine Result JSON: ${error.message}`);
  }

  const taskId = String(requireProperty(machine, "taskId", `Machine Result in '${reviewPath}'`));
  const result = String(requireProperty(machine, "result", `Machine Result in '${reviewPath}'`));
  const reviewIteration = requireProperty(machine, "reviewIteration", `Machine Result in '${reviewPath}'`);
  const blockingFindings = requireProperty(machine, "blockingFindings", `Machine Result in '${reviewPath}'`);

  if (taskId !== expectedTaskId) {
    throw new Error(`Review '${reviewPath}' Machine Result taskId '${taskId}' does not match expected task '${expectedTaskId}'.`);
  }
  if (!["Pass", "Needs Fix", "Blocked"].includes(result)) {
    throw new Error(`Review '${reviewPath}' Machine Result result must be one of: Pass, Needs Fix, Blocked.`);
  }
  const iterationNumber = requireStrictInteger(reviewIteration, `Review '${reviewPath}' Machine Result reviewIteration`, 1);
  if (!Array.isArray(blockingFindings)) {
    throw new Error(`Review '${reviewPath}' Machine Result blockingFindings must be an array.`);
  }
  blockingFindings.forEach((finding, index) => requireString(finding, `Review '${reviewPath}' Machine Result blockingFindings[${index}]`));
  if ((result === "Needs Fix" || result === "Blocked") && blockingFindings.length === 0) {
    throw new Error(`Review '${reviewPath}' Machine Result must list blockingFindings when result is '${result}'.`);
  }

  return { taskId, result, reviewIteration: iterationNumber, blockingFindings };
}

function getTaskIds(taskSpecsDir) {
  if (!fs.existsSync(taskSpecsDir)) {
    throw new Error(`Task specs directory not found: ${taskSpecsDir}`);
  }
  const entries = fs.readdirSync(taskSpecsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
  if (entries.length === 0) {
    throw new Error(`No task spec files found in: ${taskSpecsDir}`);
  }
  return entries.map((name) => {
    const taskId = path.basename(name, ".md");
    if (!/^T\d{2}-[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(taskId)) {
      throw new Error(`Task spec file '${path.join(taskSpecsDir, name)}' does not use the required task id format TXX-YYY.`);
    }
    return taskId;
  });
}

function getTaskState(targetRoot, taskId, taskLogDir, taskReviewDir) {
  const logPath = path.join(taskLogDir, `${taskId}.md`);
  const reviewPath = path.join(taskReviewDir, `${taskId}.md`);
  const logExists = fs.existsSync(logPath);
  const reviewExists = fs.existsSync(reviewPath);
  let reviewResult = null;
  let reviewIteration = null;
  let blockingFindings = [];
  let state = "NotImplemented";
  let reason = "Task implementation log is missing.";

  if (logExists && !reviewExists) {
    state = "AwaitingReview";
    reason = "Task implementation log exists, but review is missing.";
  }

  if (logExists && reviewExists) {
    const logStat = fs.statSync(logPath);
    const reviewStat = fs.statSync(reviewPath);
    const machine = getReviewMachineResult(reviewPath, taskId);
    reviewResult = machine.result;
    reviewIteration = machine.reviewIteration;
    blockingFindings = machine.blockingFindings;

    if (reviewStat.mtimeMs < logStat.mtimeMs) {
      state = "AwaitingReview";
      reason = "Task implementation log is newer than the review; review is stale.";
    } else if (reviewResult === "Pass") {
      state = "Passed";
      reason = "Task review passed.";
    } else if (reviewResult === "Needs Fix") {
      state = "NeedsFix";
      reason = "Task review requires correction before another task can start.";
    } else if (reviewResult === "Blocked") {
      state = "Blocked";
      reason = "Task review is blocked.";
    }
  }

  return {
    taskId,
    state,
    reason,
    logExists,
    reviewExists,
    reviewResult,
    reviewIteration,
    blockingFindings,
    logPath: toDisplayPath(targetRoot, logPath),
    reviewPath: toDisplayPath(targetRoot, reviewPath)
  };
}

function assertKnownTask(taskIds, taskId, mode) {
  if (typeof taskId !== "string" || taskId.trim() === "") {
    throw new Error(`--task-id is required for mode '${mode}'.`);
  }
  if (!taskIds.includes(taskId)) {
    throw new Error(`Task id '${taskId}' is not present in the approved task specs.`);
  }
}

function assertPreviousTasksPassed(taskIds, states, taskId) {
  const targetIndex = taskIds.indexOf(taskId);
  if (targetIndex < 0) {
    throw new Error(`Task id '${taskId}' is not present in the approved task specs.`);
  }
  for (let index = 0; index < targetIndex; index++) {
    const previousTaskId = taskIds[index];
    const previousState = states.find((state) => state.taskId === previousTaskId);
    if (previousState?.state !== "Passed") {
      throw new Error(`Task '${taskId}' cannot proceed because previous task '${previousTaskId}' is '${previousState?.state}'. Reason: ${previousState?.reason}`);
    }
  }
}

function getLoopStatus(states) {
  for (const state of states) {
    if (state.state === "Blocked") {
      return { result: "Blocked", action: "StopForHumanOrSpecDecision", taskId: state.taskId, reason: state.reason };
    }
    if (state.state === "NeedsFix") {
      return { result: "NeedsAction", action: "FixTask", taskId: state.taskId, reason: state.reason };
    }
    if (state.state === "NotImplemented") {
      return { result: "NeedsAction", action: "ImplementTask", taskId: state.taskId, reason: state.reason };
    }
    if (state.state === "AwaitingReview") {
      return { result: "NeedsAction", action: "ReviewTask", taskId: state.taskId, reason: state.reason };
    }
  }
  return { result: "Ready", action: "RunFinalDeliveryValidation", taskId: null, reason: "All approved tasks have passing, non-stale reviews." };
}

function writeGuardResult(status, states, json) {
  if (json) {
    console.log(JSON.stringify({ status, tasks: states }, null, 2));
    return;
  }
  console.log(`Result: ${status.result}`);
  console.log(`Action: ${status.action}`);
  if (status.taskId) {
    console.log(`Task: ${status.taskId}`);
  }
  console.log(`Reason: ${status.reason}`);
}

function assertNonEmptyFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
  if (fs.readFileSync(filePath, "utf8").trim() === "") {
    throw new Error(`${label} must not be empty: ${filePath}`);
  }
}

function assertFinalValidationArtifacts(targetRoot, versionedDeliveryDir, versionedDecisionLog) {
  const deliveryDir = resolveInsideTarget(targetRoot, versionedDeliveryDir, "versioned delivery dir");
  const decisionLog = resolveInsideTarget(targetRoot, versionedDecisionLog, "versioned decision log");
  assertNonEmptyFile(path.join(deliveryDir, "delivery-plan.md"), "approved delivery plan");
  assertNonEmptyFile(path.join(deliveryDir, "traceability-matrix.md"), "approved traceability matrix");
  assertNonEmptyFile(path.join(deliveryDir, "verification-plan.md"), "approved verification plan");
  assertNonEmptyFile(decisionLog, "decision log");
}

function commandDeliveryGuardInternal(flags) {
  const targetRoot = resolveTarget(flags);
  const wefterConfig = readConfig(targetRoot);
  assertWorkflowEnabled(wefterConfig, DELIVERY_WORKFLOW_ID);
  const deliveryConfig = readJson(path.join(targetRoot, deliveryConfigPath(wefterConfig, flags)), "delivery config");
  validateDeliveryConfig(deliveryConfig);

  const mode = flags.mode || "Status";
  if (!["Status", "ReadyForReview", "ReadyForNextTask", "ReadyForFinalValidation"].includes(mode)) {
    throw new Error("--mode must be one of: Status, ReadyForReview, ReadyForNextTask, ReadyForFinalValidation.");
  }

  let runRoot;
  if (flags["run-id"] && flags["run-root"]) {
    throw new Error("Use either --run-id or --run-root, not both.");
  }
  if (flags["run-root"]) {
    runRoot = resolveInsideTarget(targetRoot, flags["run-root"], "run root");
  } else {
    assertPlainRunId(flags["run-id"]);
    runRoot = resolveInsideTarget(targetRoot, path.join(deliveryConfig.runArtifactsRoot, flags["run-id"]), "run root");
  }
  if (!fs.existsSync(runRoot)) {
    throw new Error(`Run root not found: ${runRoot}`);
  }

  const manifestPath = path.join(runRoot, "manifest.json");
  const manifest = readJson(manifestPath, "delivery run manifest");
  if (manifest.workflowId !== DELIVERY_WORKFLOW_ID) {
    throw new Error(`Run manifest workflowId must be ${DELIVERY_WORKFLOW_ID}.`);
  }
  const versionedDeliveryDir = requireProperty(requireProperty(manifest, "paths", "manifest"), "versionedDeliveryDir", "manifest.paths");
  const taskSpecsDir = resolveInsideTarget(targetRoot, path.join(versionedDeliveryDir, "task-specs"), "task specs directory");
  const taskLogDir = path.join(runRoot, "implementation", "task-logs");
  const taskReviewDir = path.join(runRoot, "implementation", "task-reviews");
  if (!fs.existsSync(taskLogDir)) {
    throw new Error(`Task log directory not found: ${taskLogDir}`);
  }
  if (!fs.existsSync(taskReviewDir)) {
    throw new Error(`Task review directory not found: ${taskReviewDir}`);
  }

  const taskIds = getTaskIds(taskSpecsDir);
  const states = taskIds.map((taskId) => getTaskState(targetRoot, taskId, taskLogDir, taskReviewDir));
  const status = getLoopStatus(states);

  if (mode === "Status") {
    writeGuardResult(status, states, flags.json);
    return;
  }

  const taskId = flags["task-id"];
  if (mode === "ReadyForReview") {
    assertKnownTask(taskIds, taskId, mode);
    assertPreviousTasksPassed(taskIds, states, taskId);
    const state = states.find((item) => item.taskId === taskId);
    if (!state.logExists) {
      throw new Error(`Task '${taskId}' is not ready for review because its implementation log is missing.`);
    }
    if (state.state === "NeedsFix") {
      throw new Error(`Task '${taskId}' still needs a correction. Update its implementation log after the correction before requesting another review.`);
    }
    if (state.state === "Blocked") {
      throw new Error(`Task '${taskId}' is blocked and cannot be reviewed as ready.`);
    }
    writeGuardResult({ result: "Ready", action: "ReviewTask", taskId, reason: `Task '${taskId}' has an implementation log and can be reviewed.` }, states, flags.json);
    return;
  }

  if (mode === "ReadyForNextTask") {
    assertKnownTask(taskIds, taskId, mode);
    assertPreviousTasksPassed(taskIds, states, taskId);
    const state = states.find((item) => item.taskId === taskId);
    if (state.state !== "Passed") {
      throw new Error(`Task '${taskId}' cannot release the next task. Current state: ${state.state}. Reason: ${state.reason}`);
    }
    writeGuardResult({ result: "Ready", action: "AdvanceToNextTaskOrFinalValidation", taskId, reason: `Task '${taskId}' has a passing, non-stale review.` }, states, flags.json);
    return;
  }

  if (mode === "ReadyForFinalValidation") {
    if (status.result !== "Ready") {
      throw new Error(`Delivery unit is not ready for final validation. Next required action: ${status.action} for task '${status.taskId}'. Reason: ${status.reason}`);
    }
    const versionedDecisionLog = requireProperty(requireProperty(manifest, "paths", "manifest"), "versionedDecisionLog", "manifest.paths");
    assertFinalValidationArtifacts(targetRoot, versionedDeliveryDir, versionedDecisionLog);
    writeGuardResult(status, states, flags.json);
  }
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

function commandProfileImport(flags) {
  const targetRoot = resolveTarget(flags);
  const config = readConfig(targetRoot);
  if (!flags.source) {
    throw new Error("--source is required for profile import.");
  }

  const sourceRelative = normalizeRelativePath(flags.source, "source");
  const sourcePath = path.join(targetRoot, sourceRelative);
  const destinationPath = path.join(targetRoot, config.profilePath);
  ensureInside(targetRoot, sourcePath, "source");
  ensureInside(targetRoot, destinationPath, "profilePath");

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source profile not found: ${sourcePath}`);
  }
  if (fs.existsSync(destinationPath) && !flags.force) {
    throw new Error(`Profile already exists: ${destinationPath}. Use --force to overwrite.`);
  }

  const profile = readJson(sourcePath, "source audit profile");
  validateProfile(profile);
  writeJson(destinationPath, profile);
  console.log(`Imported audit profile from ${sourceRelative} to ${config.profilePath}`);
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
  check("delivery workflow config", () => {
    if (!workflowSettings(config, DELIVERY_WORKFLOW_ID).enabled) {
      return;
    }
    const configPath = path.join(targetRoot, deliveryConfigPath(config));
    const profilePath = path.join(targetRoot, deliveryProfilePath(config));
    validateDeliveryConfig(readJson(configPath, "delivery config"));
    validateDeliveryProfile(readJson(profilePath, "delivery profile"));
  });
  check("product-shaping workflow config", () => {
    const configPath = path.join(targetRoot, productShapingConfigPath(config));
    const profilePath = path.join(targetRoot, productShapingProfilePath(config));
    validateProductShapingConfig(readJson(configPath, "product-shaping config"));
    validateProductShapingProfile(readJson(profilePath, "product-shaping profile"));
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
  check("delivery opencode agents", () => {
    const agentFiles = [
      "wefter-delivery-orchestrator.md",
      "wefter-delivery-planner.md",
      "wefter-delivery-plan-auditor.md",
      "wefter-delivery-plan-consolidator.md",
      "wefter-delivery-plan-validator.md",
      "wefter-delivery-plan-repairer.md",
      "wefter-delivery-task-implementer.md",
      "wefter-delivery-task-reviewer.md",
      "wefter-delivery-validator.md"
    ];
    const deliverySettings = workflowSettings(config, DELIVERY_WORKFLOW_ID);
    if (!deliverySettings.enabled) {
      for (const file of agentFiles) {
        const fullPath = path.join(targetRoot, ".opencode/agent", file);
        if (fs.existsSync(fullPath)) {
          throw new Error(`Disabled delivery-implementation workflow must not install ${file}.`);
        }
      }
      return;
    }
    const deliveryConfig = readJson(path.join(targetRoot, deliveryConfigPath(config)), "delivery config");
    const posixGlob = `${deliveryConfig.runArtifactsRoot}/**`;
    const windowsGlob = windowsPermissionGlob(deliveryConfig.runArtifactsRoot);

    for (const file of agentFiles) {
      const fullPath = path.join(targetRoot, ".opencode/agent", file);
      const content = readTextRequired(fullPath);
      assertNoPlaceholders(fullPath, content);
      if (!file.includes("task-implementer") && !file.includes("orchestrator")) {
        assertIncludes(content, posixGlob, `${file} POSIX artifact permission`);
        assertIncludes(content, windowsGlob, `${file} Windows artifact permission`);
      }
    }

    const orchestrator = readTextRequired(path.join(targetRoot, ".opencode/agent/wefter-delivery-orchestrator.md"));
    assertIncludes(orchestrator, CONFIG_FILE, "delivery orchestrator config reference");
    assertIncludes(orchestrator, deliveryConfigPath(config), "delivery orchestrator workflow config path");
    assertIncludes(orchestrator, deliveryProfilePath(config), "delivery orchestrator workflow profile path");
    assertIncludes(orchestrator, config.runnerCommand, "delivery orchestrator runner command");
  });
  check("product-shaping opencode agents", () => {
    const agentFiles = [
      "wefter-product-orchestrator.md",
      "wefter-product-intake-analyst.md",
      "wefter-product-reference-researcher.md",
      "wefter-product-shaper.md",
      "wefter-product-domain-modeler.md",
      "wefter-product-release-planner.md",
      "wefter-product-auditor.md",
      "wefter-product-validator.md",
      "wefter-product-repairer.md"
    ];
    const specGlob = `${productShapingSpecRoot(config)}/**`;
    const runGlob = `${productShapingRunRoot(config)}/**`;
    const specWindowsGlob = windowsPermissionGlob(productShapingSpecRoot(config));
    const runWindowsGlob = windowsPermissionGlob(productShapingRunRoot(config));

    for (const file of agentFiles) {
      const fullPath = path.join(targetRoot, ".opencode/agent", file);
      const content = readTextRequired(fullPath);
      assertNoPlaceholders(fullPath, content);
      if (!file.includes("auditor") && !file.includes("validator")) {
        assertIncludes(content, specGlob, `${file} POSIX spec permission`);
        assertIncludes(content, specWindowsGlob, `${file} Windows spec permission`);
      }
      assertIncludes(content, runGlob, `${file} POSIX run permission`);
      assertIncludes(content, runWindowsGlob, `${file} Windows run permission`);
    }

    const orchestrator = readTextRequired(path.join(targetRoot, ".opencode/agent/wefter-product-orchestrator.md"));
    assertIncludes(orchestrator, CONFIG_FILE, "product orchestrator config reference");
    assertIncludes(orchestrator, productShapingConfigPath(config), "product orchestrator workflow config path");
    assertIncludes(orchestrator, productShapingProfilePath(config), "product orchestrator workflow profile path");
    assertIncludes(orchestrator, config.runnerCommand, "product orchestrator runner command");
  });
  check("documentation repair opencode agents", () => {
    const agentFiles = [
      "wefter-doc-repair-orchestrator.md",
      "wefter-doc-repair-planner.md",
      "wefter-doc-repairer.md",
      "wefter-doc-repair-reviewer.md"
    ];
    const posixGlob = `${documentationRepairArtifactRoot()}/**`;
    const windowsGlob = windowsPermissionGlob(documentationRepairArtifactRoot());

    for (const file of agentFiles) {
      const fullPath = path.join(targetRoot, ".opencode/agent", file);
      const content = readTextRequired(fullPath);
      assertNoPlaceholders(fullPath, content);
      if (file.includes("planner") || file.includes("reviewer")) {
        assertIncludes(content, posixGlob, `${file} POSIX artifact permission`);
        assertIncludes(content, windowsGlob, `${file} Windows artifact permission`);
      }
    }

    const orchestrator = readTextRequired(path.join(targetRoot, ".opencode/agent/wefter-doc-repair-orchestrator.md"));
    assertIncludes(orchestrator, CONFIG_FILE, "documentation repair orchestrator config reference");
    assertIncludes(orchestrator, documentationRepairArtifactRoot(), "documentation repair orchestrator artifact root");
    assertIncludes(orchestrator, config.runnerCommand, "documentation repair orchestrator runner command");
  });
  check("opencode skill", () => {
    const skillPath = path.join(targetRoot, ".opencode/skills/documentation-audit/SKILL.md");
    const content = readTextRequired(skillPath);
    assertNoPlaceholders(skillPath, content);
    assertIncludes(content, config.profilePath, "skill profile path");
    assertIncludes(content, config.templateRoot, "skill template root");
    assertIncludes(content, config.processDocPath, "skill process doc path");
  });
  check("delivery opencode skill", () => {
    const skillPath = path.join(targetRoot, ".opencode/skills/delivery-implementation/SKILL.md");
    if (!workflowSettings(config, DELIVERY_WORKFLOW_ID).enabled) {
      if (fs.existsSync(skillPath)) {
        throw new Error("Disabled delivery-implementation workflow must not install its OpenCode skill.");
      }
      return;
    }
    const content = readTextRequired(skillPath);
    assertNoPlaceholders(skillPath, content);
    assertIncludes(content, "/wefter-run-delivery", "delivery skill command reference");
    assertIncludes(content, deliveryConfigPath(config), "delivery skill runtime config path");
    assertIncludes(content, deliveryProfilePath(config), "delivery skill runtime profile path");
  });
  check("product-shaping opencode skill", () => {
    const skillPath = path.join(targetRoot, ".opencode/skills/product-shaping/SKILL.md");
    const content = readTextRequired(skillPath);
    assertNoPlaceholders(skillPath, content);
    assertIncludes(content, productShapingConfigPath(config), "product skill config path");
    assertIncludes(content, productShapingProfilePath(config), "product skill profile path");
    assertIncludes(content, productShapingSpecRoot(config), "product skill spec root");
    assertIncludes(content, productShapingRunRoot(config), "product skill run root");
  });
  check("documentation repair opencode skill", () => {
    const skillPath = path.join(targetRoot, ".opencode/skills/documentation-repair/SKILL.md");
    const content = readTextRequired(skillPath);
    assertNoPlaceholders(skillPath, content);
    assertIncludes(content, "/wefter-repair-docs", "documentation repair skill command reference");
  });
  check("opencode commands", () => {
    const opencode = readJson(path.join(targetRoot, "opencode.json"), "opencode.json");
    if (opencode.command?.["wefter-audit-docs"]?.agent !== "wefter-doc-audit-orchestrator" || opencode.command?.["wefter-generate-doc-audit-profile"]?.agent !== "wefter-doc-audit-profile-builder" || opencode.command?.["wefter-repair-docs"]?.agent !== "wefter-doc-repair-orchestrator") {
      throw new Error("Missing Wefter opencode commands.");
    }
    const productSettings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
    const deliverySettings = workflowSettings(config, DELIVERY_WORKFLOW_ID);
    if (deliverySettings.enabled && opencode.command?.["wefter-run-delivery"]?.agent !== "wefter-delivery-orchestrator") {
      throw new Error("Missing enabled delivery-implementation opencode command.");
    }
    if (!deliverySettings.enabled && opencode.command?.["wefter-run-delivery"]) {
      throw new Error("Disabled delivery-implementation workflow must not install a runnable opencode command.");
    }
    if (productSettings.enabled && opencode.command?.["wefter-shape-product"]?.agent !== "wefter-product-orchestrator") {
      throw new Error("Missing enabled product-shaping opencode command.");
    }
    if (!productSettings.enabled && opencode.command?.["wefter-shape-product"]) {
      throw new Error("Disabled product-shaping workflow must not install a runnable opencode command.");
    }
    if (!Array.isArray(opencode.skills?.paths) || !opencode.skills.paths.includes(".opencode/skills")) {
      throw new Error("Missing .opencode/skills in opencode skills.paths.");
    }
    const watcherIgnore = Array.isArray(opencode.watcher?.ignore) ? opencode.watcher.ignore : [];
    for (const pattern of configuredWatcherIgnores(targetRoot, config)) {
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
  if (flags.version) {
    console.log(VERSION);
    return;
  }
  if (flags.help || positional.length === 0) {
    printHelp();
    return;
  }

  const [command, subcommand] = positional;
  const allowedFlags = allowedFlagsForCommand(command, subcommand);
  if (allowedFlags) {
    assertKnownFlags(flags, allowedFlags);
  }
  if (command === "init") {
    await commandInit(flags);
    return;
  }
  if (command === "uninstall") {
    await commandUninstall(flags);
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
  if (command === "docs" && subcommand === "repair") {
    commandDocsRepair(flags);
    return;
  }
  if (command === "product" && subcommand === "shape") {
    commandProductShape(flags);
    return;
  }
  if (command === "product" && subcommand === "validate") {
    commandProductValidate(flags);
    return;
  }
  if (command === "delivery" && subcommand === "run") {
    commandDeliveryRun(flags);
    return;
  }
  if (command === "delivery" && subcommand === "guard") {
    commandDeliveryGuard(flags);
    return;
  }
  if (command === "profile" && subcommand === "scaffold") {
    commandProfileScaffold(flags);
    return;
  }
  if (command === "profile" && subcommand === "import") {
    commandProfileImport(flags);
    return;
  }
  if (command === "doctor") {
    commandDoctor(flags);
    return;
  }

  throw new Error(`Unknown command: ${positional.join(" ")}`);
}
