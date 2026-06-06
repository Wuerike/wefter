import fs from "node:fs";
import path from "node:path";
import { CONFIG_FILE, DELIVERY_WORKFLOW_ID, PRODUCT_SHAPING_WORKFLOW_ID } from "../constants.js";
import { deliveryConfigPath, productShapingRunRoot, productShapingSpecRoot, workflowSettings } from "../core/config.js";
import { listFilesRecursive, readJson, readJsonIfExists, removeIfExistsInside, writeJson } from "../core/fs.js";
import { documentationRepairArtifactRoot, ensureInside } from "../core/paths.js";
import { configuredWatcherIgnores, knownOpencodeCommandNames } from "./manifest.js";

export function removeDeliveryOpenCodeArtifacts(targetRoot) {
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

export function mergeOpencodeConfig(targetRoot, config, force) {
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

export function updateOpencodeForUninstall(targetRoot, manifest, dryRun) {
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
