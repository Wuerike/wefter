import fs from "node:fs";
import path from "node:path";
import process, { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { INSTALL_MANIFEST_FILE } from "../constants.js";
import { removeEmptyParents, sha256File } from "../core/fs.js";
import { ensureInside, normalizeRelativePath, resolveTarget } from "../core/paths.js";
import { readInstallManifest } from "./manifest.js";
import { updateOpencodeForUninstall } from "./opencode.js";

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

export async function commandUninstall(flags) {
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
