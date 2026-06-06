import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureInside, toDisplayPath } from "./paths.js";

export function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read ${label} at ${filePath}: ${error.message}`);
  }
}

export function readJsonIfExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return readJson(filePath, label);
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function listFilesRecursive(root) {
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

export function addFileIfExists(targetRoot, files, fullPath) {
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return;
  }
  ensureInside(targetRoot, fullPath, "installed file");
  files.add(toDisplayPath(targetRoot, fullPath));
}

export function addDirectoryFilesIfExists(targetRoot, files, fullPath) {
  if (!fs.existsSync(fullPath)) {
    return;
  }
  ensureInside(targetRoot, fullPath, "installed directory");
  for (const file of listFilesRecursive(fullPath)) {
    addFileIfExists(targetRoot, files, file);
  }
}

export function removeIfExistsInside(targetRoot, relativePath) {
  const fullPath = path.join(targetRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    return;
  }
  ensureInside(targetRoot, fullPath, "legacy Wefter file");
  fs.rmSync(fullPath, { recursive: true, force: true });
}

export function removeEmptyParents(targetRoot, startDir) {
  let current = startDir;
  while (current && current !== targetRoot && isInsideTarget(targetRoot, current)) {
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

function isInsideTarget(targetRoot, candidate) {
  const relative = path.relative(targetRoot, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function writeTextIfSafe(filePath, content, force) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, "utf8");
    if (current !== content && !force) {
      throw new Error(`Refusing to overwrite existing file: ${filePath}. Use --force to replace it.`);
    }
  }
  fs.writeFileSync(filePath, content, "utf8");
}

export function writeJsonIfSafe(filePath, value, force) {
  writeTextIfSafe(filePath, `${JSON.stringify(value, null, 2)}\n`, force);
}

export function writeJsonConfigIfSafe(filePath, value, force) {
  writeJsonIfSafe(filePath, value, force);
}

export function readTextRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

export function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

export function assertNonEmptyFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
  if (fs.readFileSync(filePath, "utf8").trim() === "") {
    throw new Error(`${label} must not be empty: ${filePath}`);
  }
}
