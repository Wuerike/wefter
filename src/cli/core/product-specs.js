import fs from "node:fs";
import path from "node:path";
import { PRODUCT_SHAPING_WORKFLOW_ID } from "../constants.js";
import { readJson, readTextIfExists } from "./fs.js";
import { assertSafeRunName, ensureInside, isInsideDirectory, normalizeRelativePath, resolveInsideTarget, toDisplayPath, toPosix } from "./paths.js";
import { unique } from "./validation.js";

export function productSpecPath(specRoot, releaseId, relativePath) {
  return toPosix(path.join(specRoot, relativePath.replaceAll("<release-id>", releaseId)));
}

export function productRunRootFromValidationFlags(targetRoot, productConfig, flags = {}) {
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

export function parseProductDeliverablesHandoff(value) {
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

export function alignDeliverySourceDocsWithHandoff(deliveryConfig) {
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

export function assertDeliverableExists(targetRoot, deliveryConfig, deliveryUnitId, deliveryUnitKey) {
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

export function validateProductSpecs(targetRoot, productConfig, releaseId, flags = {}) {
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

export function productValidationFlagsFromDeliveryFlags(flags) {
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

export function rebaseReleasePath(value, previousReleaseId, nextReleaseId) {
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
