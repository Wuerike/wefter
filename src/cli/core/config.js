import fs from "node:fs";
import path from "node:path";
import { CONFIG_FILE, DEFAULTS, DELIVERY_WORKFLOW_ID, PRODUCT_SHAPING_DEFAULTS, PRODUCT_SHAPING_WORKFLOW_ID } from "../constants.js";
import { readJson } from "./fs.js";
import { normalizeRelativePath, normalizeRunnerCommand } from "./paths.js";
import { assertAllowedKeys, assertObject, requireId } from "./validation.js";

export function readConfig(targetRoot) {
  const configPath = path.join(targetRoot, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing ${CONFIG_FILE}. Run wefter init first.`);
  }

  const config = readJson(configPath, CONFIG_FILE);
  return normalizeConfig(config);
}

export function normalizeConfig(config) {
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

export function defaultWorkflowRegistry() {
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

export function workflowSettings(config, workflowId) {
  const settings = config.workflows?.[workflowId];
  if (!settings) {
    throw new Error(`Missing workflow settings for ${workflowId}.`);
  }
  return settings;
}

export function assertWorkflowEnabled(config, workflowId) {
  const settings = workflowSettings(config, workflowId);
  if (!settings.enabled) {
    throw new Error(`Workflow '${workflowId}' is disabled in ${CONFIG_FILE}.`);
  }
  return settings;
}

export function deliveryRuntimeSettings(config) {
  return config.workflows?.[DELIVERY_WORKFLOW_ID];
}

export function deliveryConfigPath(config, flags = {}) {
  const settings = deliveryRuntimeSettings(config);
  if (!settings) {
    throw new Error(`Missing workflow settings for ${DELIVERY_WORKFLOW_ID}.`);
  }
  return normalizeRelativePath(flags["config-path"] || settings.configPath || `${config.workflowRoot}/${DELIVERY_WORKFLOW_ID}/config.json`, "delivery config path");
}

export function deliveryProfilePath(config, flags = {}) {
  const settings = deliveryRuntimeSettings(config);
  if (!settings) {
    throw new Error(`Missing workflow settings for ${DELIVERY_WORKFLOW_ID}.`);
  }
  return normalizeRelativePath(flags["profile-path"] || settings.profilePath || `${config.workflowRoot}/${DELIVERY_WORKFLOW_ID}/profile.json`, "delivery profile path");
}

export function productShapingSpecRoot(config, flags = {}) {
  const settings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  return normalizeRelativePath(flags["spec-root"] || settings.specRoot || PRODUCT_SHAPING_DEFAULTS.specRoot, "product-shaping spec root");
}

export function productShapingRunRoot(config, flags = {}) {
  const settings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  return normalizeRelativePath(flags["run-root"] || settings.runRoot || PRODUCT_SHAPING_DEFAULTS.runRoot, "product-shaping run root");
}

export function productShapingConfigPath(config, flags = {}) {
  const settings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  return normalizeRelativePath(flags["config-path"] || settings.configPath || `${config.workflowRoot}/${PRODUCT_SHAPING_WORKFLOW_ID}/config.json`, "product-shaping config path");
}

export function productShapingProfilePath(config, flags = {}) {
  const settings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  return normalizeRelativePath(flags["profile-path"] || settings.profilePath || `${config.workflowRoot}/${PRODUCT_SHAPING_WORKFLOW_ID}/profile.json`, "product-shaping profile path");
}

export function normalizeWorkflowRegistry(workflows) {
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
