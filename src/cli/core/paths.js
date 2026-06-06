import path from "node:path";
import { fileURLToPath } from "node:url";
import { DELIVERY_WORKFLOW_ID, DOCUMENTATION_REPAIR_WORKFLOW_ID, PRODUCT_SHAPING_WORKFLOW_ID } from "../constants.js";

export function packageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function workflowPackageRoot(workflowId) {
  return path.join(packageRoot(), "src/workflows", workflowId);
}

export function documentationAuditTemplateRoot() {
  return path.join(workflowPackageRoot("documentation-audit"), "templates");
}

export function documentationRepairTemplateRoot() {
  return path.join(workflowPackageRoot(DOCUMENTATION_REPAIR_WORKFLOW_ID), "templates");
}

export function productShapingWorkflowPackageRoot() {
  return workflowPackageRoot(PRODUCT_SHAPING_WORKFLOW_ID);
}

export function deliveryWorkflowPackageRoot() {
  return workflowPackageRoot(DELIVERY_WORKFLOW_ID);
}

export function documentationRepairArtifactRoot() {
  return ".audit/wefter/documentation-repair";
}

export function resolveTarget(flags) {
  return path.resolve(flags.target || process.cwd());
}

export function toPosix(value) {
  return value.split(path.sep).join("/");
}

export function quoteCommandArg(value) {
  const normalized = toPosix(path.resolve(value));
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(normalized)) {
    return normalized;
  }
  return `"${normalized.replaceAll('"', '\\"')}"`;
}

export function defaultRunnerCommand() {
  return `node ${quoteCommandArg(path.join(packageRoot(), "bin/wefter.js"))}`;
}

export function yamlSingleQuoted(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function normalizeRelativePath(value, label) {
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

export function normalizeRunnerCommand(value, label) {
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

export function normalizeRelativeGlob(value, label) {
  const normalized = normalizeRelativePath(value, label);
  if (normalized.startsWith("~")) {
    throw new Error(`${label} must be relative to the target repository.`);
  }
  return normalized;
}

export function windowsPermissionPath(relativePath) {
  return relativePath.replaceAll("/", "\\\\");
}

export function windowsPermissionGlob(relativePath) {
  return `${windowsPermissionPath(relativePath)}\\\\**`;
}

export function assertSafeRunName(value) {
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

export function assertPlainRunId(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Run id must not be empty when --run-root is not provided.");
  }
  assertSafeRunName(value);
}

export function getSafeDeliveryUnitKey(value) {
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

export function ensureInside(targetRoot, candidate, label) {
  const relative = path.relative(targetRoot, candidate);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`${label} resolves outside the target repository.`);
}

export function resolveInsideTarget(targetRoot, candidatePath, label) {
  const resolved = path.isAbsolute(candidatePath) ? path.resolve(candidatePath) : path.resolve(targetRoot, candidatePath);
  ensureInside(targetRoot, resolved, label);
  return resolved;
}

export function toDisplayPath(targetRoot, fullPath) {
  const relative = path.relative(targetRoot, fullPath);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return toPosix(relative || ".");
  }
  return toPosix(fullPath);
}

export function isInsideDirectory(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function timestampRunName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
