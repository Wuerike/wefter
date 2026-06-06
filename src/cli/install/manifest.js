import fs from "node:fs";
import path from "node:path";
import { CONFIG_FILE, DELIVERY_WORKFLOW_ID, INSTALL_MANIFEST_FILE, PRODUCT_SHAPING_WORKFLOW_ID, VERSION } from "../constants.js";
import { deliveryConfigPath, deliveryProfilePath, productShapingConfigPath, productShapingProfilePath, productShapingRunRoot, productShapingSpecRoot, workflowSettings } from "../core/config.js";
import { addDirectoryFilesIfExists, addFileIfExists, readJson, readJsonIfExists, sha256File, writeJson } from "../core/fs.js";
import { documentationRepairArtifactRoot, normalizeRelativePath } from "../core/paths.js";
import { assertObject } from "../core/validation.js";

export function knownOpencodeCommandNames() {
  return [
    "wefter-audit-docs",
    "wefter-generate-doc-audit-profile",
    "wefter-repair-docs",
    "wefter-shape-product",
    "wefter-run-delivery"
  ];
}

export function configuredWatcherIgnores(targetRoot, config) {
  const deliverySettings = workflowSettings(config, DELIVERY_WORKFLOW_ID);
  const deliveryConfig = deliverySettings.enabled ? readJsonIfExists(path.join(targetRoot, deliveryConfigPath(config)), "delivery config") : null;
  const productSettings = workflowSettings(config, PRODUCT_SHAPING_WORKFLOW_ID);
  return [config.artifactRoot, config.templateRoot, documentationRepairArtifactRoot(), deliveryConfig?.runArtifactsRoot, productSettings.enabled ? productShapingRunRoot(config) : null]
    .filter(Boolean)
    .map((ignored) => `${ignored.replace(/\/$/, "")}/**`);
}

export function collectInstallManifestFiles(targetRoot, config) {
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

export function writeInstallManifest(targetRoot, config) {
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

export function readInstallManifest(targetRoot) {
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
