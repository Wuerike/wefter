import fs from "node:fs";
import path from "node:path";
import { readConfig } from "../core/config.js";
import { readJson, writeJson } from "../core/fs.js";
import { ensureInside, normalizeRelativePath, resolveTarget } from "../core/paths.js";
import { defaultProfile, validateProfile } from "../core/profile.js";

export function commandProfileScaffold(flags) {
  const targetRoot = resolveTarget(flags);
  const config = readConfig(targetRoot);
  const profilePath = path.join(targetRoot, config.profilePath);
  if (fs.existsSync(profilePath) && !flags.force) {
    throw new Error(`Profile already exists: ${profilePath}. Use --force to overwrite.`);
  }
  writeJson(profilePath, defaultProfile(config));
  console.log(`Wrote starter audit profile: ${profilePath}`);
}

export function commandProfileImport(flags) {
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
