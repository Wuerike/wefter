import fs from "node:fs";
import path from "node:path";
import { CONFIG_FILE, DELIVERY_WORKFLOW_ID, PRODUCT_SHAPING_WORKFLOW_ID, REQUIRED_TEMPLATE_FILES } from "../constants.js";
import {
  deliveryConfigPath,
  deliveryProfilePath,
  normalizeConfig,
  productShapingConfigPath,
  productShapingProfilePath,
  productShapingRunRoot,
  productShapingSpecRoot,
  readConfig,
  workflowSettings
} from "../core/config.js";
import { readJson, readTextRequired } from "../core/fs.js";
import { documentationRepairArtifactRoot, ensureInside, resolveTarget, windowsPermissionGlob } from "../core/paths.js";
import { validateDeliveryConfig, validateDeliveryProfile, validateProductShapingConfig, validateProductShapingProfile, validateProfile } from "../core/profile.js";
import { assertIncludes, assertNoPlaceholders } from "../core/templates.js";
import { configuredWatcherIgnores } from "./manifest.js";

export function commandDoctor(flags) {
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
