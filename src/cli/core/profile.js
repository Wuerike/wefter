import path from "node:path";
import { DEFAULTS, DELIVERY_WORKFLOW_ID, PRODUCT_SHAPING_REQUIRED_FILES, PRODUCT_SHAPING_WORKFLOW_ID } from "../constants.js";
import { documentationRepairArtifactRoot, normalizeRelativeGlob, normalizeRelativePath, resolveInsideTarget, toPosix } from "./paths.js";
import { assertAllowedKeys, assertObject, assertUniqueIds, requireId, requireStrictInteger, requireString, requireStringArray, unique } from "./validation.js";

export function defaultProfile(config = DEFAULTS) {
  return {
    version: 1,
    corpus: {
      include: ["*.md", "docs/**/*.md"],
      exclude: unique([
        "node_modules/**",
        ".git/**",
        ".opencode/**",
        `${config.artifactRoot}/**`,
        `${documentationRepairArtifactRoot()}/**`,
        `${config.templateRoot}/**`,
        config.processDocPath
      ])
    },
    variants: [
      {
        id: "explicit-contradictions",
        title: "Explicit contradictions",
        instruction: "Find statements that cannot all be true at the same time. Prioritize direct conflicts in scope, state, permission, obligation, technology, workflow, data or acceptance criteria."
      },
      {
        id: "implicit-incompatibilities",
        title: "Implicit incompatibilities",
        instruction: "Find statements that look compatible in isolation but conflict when combined. Evaluate preconditions, consequences, dependencies and operational impact."
      },
      {
        id: "staleness-and-drift",
        title: "Staleness and drift",
        instruction: "Find signs that a document is outdated compared with newer decisions, terminology, status or implementation direction."
      },
      {
        id: "adversarial-edge-cases",
        title: "Adversarial edge cases",
        instruction: "Look for gaps in error states, validation, concurrency, permissions, traceability, security, incomplete data and documented limits."
      }
    ],
    lenses: [
      {
        id: "documentation-map-consistency",
        title: "Documentation map consistency",
        focus: "Compare index, overview, roadmap, technical and domain documents. Look for missing cross-references, duplicated responsibilities and contradictions between high-level and detailed documents."
      },
      {
        id: "requirements-vs-technical-guidance",
        title: "Requirements vs technical guidance",
        focus: "Compare product requirements, technical decisions, setup instructions, architecture notes and delivery guidance. Look for required behavior without technical support and technical guidance that contradicts requirements."
      },
      {
        id: "terminology-and-responsibility",
        title: "Terminology and responsibility",
        focus: "Compare glossary, naming, roles, permissions, ownership and document responsibility. Look for inconsistent terms or rules described in the wrong place."
      }
    ]
  };
}

export function validateProfile(profile) {
  assertObject(profile, "Profile");
  assertAllowedKeys(profile, "Profile", ["version", "auditorPromptPath", "corpus", "variants", "lenses"]);

  if (profile.version !== 1) {
    throw new Error("Profile must have version: 1.");
  }
  if (profile.auditorPromptPath !== undefined) {
    normalizeRelativePath(profile.auditorPromptPath, "Profile auditorPromptPath");
  }

  assertObject(profile.corpus, "Profile corpus");
  assertAllowedKeys(profile.corpus, "Profile corpus", ["include", "exclude"]);
  requireStringArray(profile.corpus.include, "Profile corpus.include");
  requireStringArray(profile.corpus.exclude, "Profile corpus.exclude");

  if (!Array.isArray(profile.variants) || profile.variants.length === 0) {
    throw new Error("Profile must define at least one variant.");
  }
  profile.variants.forEach((variant, index) => {
    assertObject(variant, `Profile variants[${index}]`);
    assertAllowedKeys(variant, `Profile variants[${index}]`, ["id", "title", "instruction"]);
    requireId(variant.id, `Profile variants[${index}].id`);
    requireString(variant.title, `Profile variants[${index}].title`);
    requireString(variant.instruction, `Profile variants[${index}].instruction`);
  });
  assertUniqueIds(profile.variants, "Profile variants");

  if (!Array.isArray(profile.lenses) || profile.lenses.length === 0) {
    throw new Error("Profile must define at least one lens.");
  }
  profile.lenses.forEach((lens, index) => {
    assertObject(lens, `Profile lenses[${index}]`);
    assertAllowedKeys(lens, `Profile lenses[${index}]`, ["id", "title", "focus"]);
    requireId(lens.id, `Profile lenses[${index}].id`);
    requireString(lens.title, `Profile lenses[${index}].title`);
    requireString(lens.focus, `Profile lenses[${index}].focus`);
  });
  assertUniqueIds(profile.lenses, "Profile lenses");
}

export function documentationAuditAuditorPrompt(targetRoot, config, profile) {
  const relativePath = profile.auditorPromptPath
    ? normalizeRelativePath(profile.auditorPromptPath, "Profile auditorPromptPath")
    : toPosix(path.join(config.templateRoot, "auditor-prompt.md"));
  const fullPath = resolveInsideTarget(targetRoot, relativePath, "auditor prompt");
  return { relativePath, fullPath };
}

export function buildCombinations(profile, passesPerLens, maxAudits) {
  const combinations = [];
  let auditIndex = 1;

  for (const lens of profile.lenses) {
    for (const variant of profile.variants) {
      for (let pass = 1; pass <= passesPerLens; pass++) {
        if (maxAudits > 0 && combinations.length >= maxAudits) {
          return combinations;
        }
        const auditId = `A${String(auditIndex).padStart(4, "0")}__${lens.id}__${variant.id}__p${String(pass).padStart(2, "0")}`;
        combinations.push({ auditId, lens, variant, pass });
        auditIndex++;
      }
    }
  }

  return combinations;
}

export function validateDeliveryConfig(config) {
  assertObject(config, "Delivery config");
  assertAllowedKeys(config, "Delivery config", ["version", "workflowName", "releaseId", "deliverablesDocument", "sourceDocs", "runArtifactsRoot", "versionedArtifacts", "defaultDeliveryUnitId", "defaultPlanAuditPassesPerLens", "gatePolicy"]);

  if (config.version !== 1) {
    throw new Error("Delivery config must have version: 1.");
  }
  requireString(config.workflowName, "Delivery config.workflowName");
  if (config.workflowName !== DELIVERY_WORKFLOW_ID) {
    throw new Error(`Delivery config.workflowName must be ${DELIVERY_WORKFLOW_ID}.`);
  }
  requireString(config.releaseId, "Delivery config.releaseId");
  normalizeRelativePath(config.deliverablesDocument, "Delivery config.deliverablesDocument");
  normalizeRelativePath(config.runArtifactsRoot, "Delivery config.runArtifactsRoot");
  requireString(config.defaultDeliveryUnitId, "Delivery config.defaultDeliveryUnitId");

  requireStrictInteger(config.defaultPlanAuditPassesPerLens, "Delivery config.defaultPlanAuditPassesPerLens", 1);

  assertObject(config.sourceDocs, "Delivery config.sourceDocs");
  assertAllowedKeys(config.sourceDocs, "Delivery config.sourceDocs", ["include", "exclude"]);
  requireStringArray(config.sourceDocs.include, "Delivery config.sourceDocs.include");
  requireStringArray(config.sourceDocs.exclude, "Delivery config.sourceDocs.exclude");
  config.sourceDocs.include.forEach((item, index) => normalizeRelativeGlob(item, `Delivery config.sourceDocs.include[${index}]`));
  config.sourceDocs.exclude.forEach((item, index) => normalizeRelativeGlob(item, `Delivery config.sourceDocs.exclude[${index}]`));

  assertObject(config.versionedArtifacts, "Delivery config.versionedArtifacts");
  assertAllowedKeys(config.versionedArtifacts, "Delivery config.versionedArtifacts", ["executionRoot", "decisionLogRoot"]);
  normalizeRelativePath(config.versionedArtifacts.executionRoot, "Delivery config.versionedArtifacts.executionRoot");
  normalizeRelativePath(config.versionedArtifacts.decisionLogRoot, "Delivery config.versionedArtifacts.decisionLogRoot");

  assertObject(config.gatePolicy, "Delivery config.gatePolicy");
  assertAllowedKeys(config.gatePolicy, "Delivery config.gatePolicy", ["mode", "structuralDeliveryUnits", "alwaysPauseOn"]);
  requireString(config.gatePolicy.mode, "Delivery config.gatePolicy.mode");
  requireStringArray(config.gatePolicy.structuralDeliveryUnits, "Delivery config.gatePolicy.structuralDeliveryUnits");
  requireStringArray(config.gatePolicy.alwaysPauseOn, "Delivery config.gatePolicy.alwaysPauseOn");
}

export function validateProductShapingConfig(config) {
  assertObject(config, "Product-shaping config");
  assertAllowedKeys(config, "Product-shaping config", ["version", "workflowName", "releaseId", "specRoot", "runRoot", "contractPath", "processDocPath", "requiredFiles", "completionGate"]);

  if (config.version !== 1) {
    throw new Error("Product-shaping config must have version: 1.");
  }
  if (config.workflowName !== PRODUCT_SHAPING_WORKFLOW_ID) {
    throw new Error(`Product-shaping config.workflowName must be ${PRODUCT_SHAPING_WORKFLOW_ID}.`);
  }
  requireString(config.releaseId, "Product-shaping config.releaseId");
  normalizeRelativePath(config.specRoot, "Product-shaping config.specRoot");
  normalizeRelativePath(config.runRoot, "Product-shaping config.runRoot");
  normalizeRelativePath(config.contractPath, "Product-shaping config.contractPath");
  normalizeRelativePath(config.processDocPath, "Product-shaping config.processDocPath");
  requireStringArray(config.requiredFiles, "Product-shaping config.requiredFiles");
  if (JSON.stringify(config.requiredFiles) !== JSON.stringify(PRODUCT_SHAPING_REQUIRED_FILES)) {
    throw new Error("Product-shaping config.requiredFiles must match the canonical product spec file set and order.");
  }

  assertObject(config.completionGate, "Product-shaping config.completionGate");
  assertAllowedKeys(config.completionGate, "Product-shaping config.completionGate", ["requireNoReleaseBlockingQuestions", "requireAdversarialReview", "requireFinalValidation", "readyDeliverableStatuses"]);
  for (const key of ["requireNoReleaseBlockingQuestions", "requireAdversarialReview", "requireFinalValidation"]) {
    if (typeof config.completionGate[key] !== "boolean") {
      throw new Error(`Product-shaping config.completionGate.${key} must be boolean.`);
    }
  }
  for (const key of ["requireAdversarialReview", "requireFinalValidation"]) {
    if (config.completionGate[key] !== true) {
      throw new Error(`Product-shaping config.completionGate.${key} must be true for product-shaping completion.`);
    }
  }
  requireStringArray(config.completionGate.readyDeliverableStatuses, "Product-shaping config.completionGate.readyDeliverableStatuses");
  if (JSON.stringify(config.completionGate.readyDeliverableStatuses) !== JSON.stringify(["ready"])) {
    throw new Error("Product-shaping config.completionGate.readyDeliverableStatuses must be exactly ['ready'].");
  }
}

export function validateProductShapingProfile(profile) {
  assertObject(profile, "Product-shaping profile");
  assertAllowedKeys(profile, "Product-shaping profile", ["version", "workflowName", "variants", "lenses"]);

  if (profile.version !== 1) {
    throw new Error("Product-shaping profile must have version: 1.");
  }
  if (profile.workflowName !== PRODUCT_SHAPING_WORKFLOW_ID) {
    throw new Error(`Product-shaping profile.workflowName must be ${PRODUCT_SHAPING_WORKFLOW_ID}.`);
  }

  if (!Array.isArray(profile.variants) || profile.variants.length === 0) {
    throw new Error("Product-shaping profile must define at least one variant.");
  }
  profile.variants.forEach((variant, index) => {
    assertObject(variant, `Product-shaping profile variants[${index}]`);
    assertAllowedKeys(variant, `Product-shaping profile variants[${index}]`, ["id", "title", "instruction"]);
    requireId(variant.id, `Product-shaping profile variants[${index}].id`);
    requireString(variant.title, `Product-shaping profile variants[${index}].title`);
    requireString(variant.instruction, `Product-shaping profile variants[${index}].instruction`);
  });
  assertUniqueIds(profile.variants, "Product-shaping profile variants");

  if (!Array.isArray(profile.lenses) || profile.lenses.length === 0) {
    throw new Error("Product-shaping profile must define at least one lens.");
  }
  profile.lenses.forEach((lens, index) => {
    assertObject(lens, `Product-shaping profile lenses[${index}]`);
    assertAllowedKeys(lens, `Product-shaping profile lenses[${index}]`, ["id", "title", "focus"]);
    requireId(lens.id, `Product-shaping profile lenses[${index}].id`);
    requireString(lens.title, `Product-shaping profile lenses[${index}].title`);
    requireString(lens.focus, `Product-shaping profile lenses[${index}].focus`);
  });
  assertUniqueIds(profile.lenses, "Product-shaping profile lenses");
}

export function validateDeliveryProfile(profile) {
  assertObject(profile, "Delivery profile");
  assertAllowedKeys(profile, "Delivery profile", ["version", "variants", "lenses"]);

  if (profile.version !== 1) {
    throw new Error("Delivery profile must have version: 1.");
  }

  if (!Array.isArray(profile.variants) || profile.variants.length === 0) {
    throw new Error("Delivery profile must define at least one variant.");
  }
  profile.variants.forEach((variant, index) => {
    assertObject(variant, `Delivery profile variants[${index}]`);
    assertAllowedKeys(variant, `Delivery profile variants[${index}]`, ["id", "title", "instruction"]);
    requireId(variant.id, `Delivery profile variants[${index}].id`);
    requireString(variant.title, `Delivery profile variants[${index}].title`);
    requireString(variant.instruction, `Delivery profile variants[${index}].instruction`);
  });
  assertUniqueIds(profile.variants, "Delivery profile variants");

  if (!Array.isArray(profile.lenses) || profile.lenses.length === 0) {
    throw new Error("Delivery profile must define at least one lens.");
  }
  profile.lenses.forEach((lens, index) => {
    assertObject(lens, `Delivery profile lenses[${index}]`);
    assertAllowedKeys(lens, `Delivery profile lenses[${index}]`, ["id", "title", "focus"]);
    requireId(lens.id, `Delivery profile lenses[${index}].id`);
    requireString(lens.title, `Delivery profile lenses[${index}].title`);
    requireString(lens.focus, `Delivery profile lenses[${index}].focus`);
  });
  assertUniqueIds(profile.lenses, "Delivery profile lenses");
}
