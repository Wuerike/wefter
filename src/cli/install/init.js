import fs from "node:fs";
import path from "node:path";
import process, { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { CONFIG_FILE, DEFAULTS, DELIVERY_WORKFLOW_ID, PRODUCT_SHAPING_WORKFLOW_ID } from "../constants.js";
import {
  defaultWorkflowRegistry,
  deliveryConfigPath,
  deliveryProfilePath,
  normalizeConfig,
  productShapingConfigPath,
  productShapingProfilePath,
  productShapingRunRoot,
  productShapingSpecRoot,
  workflowSettings
} from "../core/config.js";
import { readJson, readJsonIfExists, writeJson, writeJsonConfigIfSafe, writeJsonIfSafe } from "../core/fs.js";
import {
  defaultRunnerCommand,
  deliveryWorkflowPackageRoot,
  documentationAuditTemplateRoot,
  documentationRepairArtifactRoot,
  documentationRepairTemplateRoot,
  ensureInside,
  packageRoot,
  productShapingWorkflowPackageRoot,
  resolveTarget,
  windowsPermissionPath,
  yamlSingleQuoted
} from "../core/paths.js";
import { productSpecPath } from "../core/product-specs.js";
import { defaultProfile, validateDeliveryConfig, validateDeliveryProfile, validateProductShapingConfig, validateProductShapingProfile } from "../core/profile.js";
import { copyDirectory, copyRenderedTemplate } from "../core/templates.js";
import { unique } from "../core/validation.js";
import { writeInstallManifest } from "./manifest.js";
import { mergeOpencodeConfig, removeDeliveryOpenCodeArtifacts } from "./opencode.js";

async function promptForValue(rl, label, defaultValue) {
  const answer = await rl.question(`${label} (${defaultValue}): `);
  return answer.trim() === "" ? defaultValue : answer.trim();
}

export async function commandInit(flags) {
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
