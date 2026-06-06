import fs from "node:fs";
import path from "node:path";
import { PRODUCT_SHAPING_PROMPT_FILES, PRODUCT_SHAPING_WORKFLOW_ID } from "../constants.js";
import { assertWorkflowEnabled, productShapingConfigPath, productShapingProfilePath, readConfig } from "../core/config.js";
import { readJson, readTextRequired, writeJson } from "../core/fs.js";
import { assertSafeRunName, ensureInside, normalizeRelativePath, resolveTarget, timestampRunName, toPosix } from "../core/paths.js";
import { productSpecPath, validateProductSpecs } from "../core/product-specs.js";
import { validateProductShapingConfig, validateProductShapingProfile } from "../core/profile.js";
import { assertNoPlaceholders, markdownList, renderTemplate } from "../core/templates.js";

export function commandProductValidate(flags) {
  const targetRoot = resolveTarget(flags);
  const wefterConfig = readConfig(targetRoot);
  assertWorkflowEnabled(wefterConfig, PRODUCT_SHAPING_WORKFLOW_ID);
  const configPath = productShapingConfigPath(wefterConfig, flags);
  const productConfig = readJson(path.join(targetRoot, configPath), "product-shaping config");
  validateProductShapingConfig(productConfig);

  const releaseId = flags["release-id"] || productConfig.releaseId;
  assertSafeRunName(releaseId);
  const result = validateProductSpecs(targetRoot, productConfig, releaseId, flags);
  const ok = result.errors.length === 0;

  if (flags.json) {
    console.log(JSON.stringify({ ok, releaseId, errors: result.errors, warnings: result.warnings }, null, 2));
  } else {
    console.log(`Product shaping validation: ${ok ? "pass" : "fail"}`);
    console.log(`Release: ${releaseId}`);
    for (const warning of result.warnings) {
      console.log(`WARNING ${warning}`);
    }
    for (const error of result.errors) {
      console.error(`ERROR ${error}`);
    }
  }

  if (!ok) {
    process.exitCode = 1;
  }
}

export function commandProductShape(flags) {
  const targetRoot = resolveTarget(flags);
  const wefterConfig = readConfig(targetRoot);
  assertWorkflowEnabled(wefterConfig, PRODUCT_SHAPING_WORKFLOW_ID);
  const configPath = productShapingConfigPath(wefterConfig, flags);
  const profilePath = productShapingProfilePath(wefterConfig, flags);
  const productConfig = readJson(path.join(targetRoot, configPath), "product-shaping config");
  const productProfile = readJson(path.join(targetRoot, profilePath), "product-shaping profile");
  validateProductShapingConfig(productConfig);
  validateProductShapingProfile(productProfile);

  const releaseId = flags["release-id"] || productConfig.releaseId;
  assertSafeRunName(releaseId);
  const specRootRelative = normalizeRelativePath(flags["spec-root"] || productConfig.specRoot, "product-shaping spec root");
  const runArtifactsRootRelative = normalizeRelativePath(flags["run-root"] || productConfig.runRoot, "product-shaping run root");
  const runName = flags["run-name"] || `${timestampRunName()}__${releaseId}`;
  assertSafeRunName(runName);

  const specRoot = path.join(targetRoot, specRootRelative);
  const artifactRoot = path.join(targetRoot, runArtifactsRootRelative);
  const tempRoot = path.join(artifactRoot, ".tmp");
  const runRoot = path.join(artifactRoot, runName);
  const stagingRunRoot = path.join(tempRoot, runName);
  ensureInside(targetRoot, specRoot, "product-shaping spec root");
  ensureInside(targetRoot, artifactRoot, "product-shaping run root");
  ensureInside(targetRoot, runRoot, "product-shaping run");
  ensureInside(targetRoot, stagingRunRoot, "product-shaping staging run");

  const requiredFiles = productConfig.requiredFiles.map((file) => ({
    templatePath: file,
    path: file.replaceAll("<release-id>", releaseId),
    fullPath: productSpecPath(specRootRelative, releaseId, file)
  }));

  if (flags["dry-run"]) {
    console.log(`Run name: ${runName}`);
    console.log(`Release: ${releaseId}`);
    console.log(`Spec root: ${specRootRelative}`);
    console.log(`Output root: ${toPosix(path.join(runArtifactsRootRelative, runName))}`);
    console.log(`Required product spec files: ${requiredFiles.length}`);
    return;
  }

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory already exists: ${runRoot}. Use a different --run-name or resume the existing run.`);
  }
  if (fs.existsSync(stagingRunRoot)) {
    throw new Error(`Staging directory already exists: ${stagingRunRoot}. Remove it manually after verifying no product-shaping run is in progress, or use a different --run-name.`);
  }

  const runRootRelative = toPosix(path.join(runArtifactsRootRelative, runName));
  const adversarialReviewPath = toPosix(path.join(runRootRelative, "review", "adversarial-review.md"));
  const finalValidationPath = toPosix(path.join(runRootRelative, "final", "product-shaping-validation.md"));
  const handoffDeliverablesPath = productSpecPath(specRootRelative, releaseId, "releases/<release-id>/DELIVERABLES.md");
  const promptsRoot = path.join(stagingRunRoot, "prompts");
  const draftRoot = path.join(stagingRunRoot, "draft");
  const reviewRoot = path.join(stagingRunRoot, "review");
  const validationRoot = path.join(stagingRunRoot, "validation");
  const finalRoot = path.join(stagingRunRoot, "final");
  for (const directory of [artifactRoot, tempRoot, stagingRunRoot, promptsRoot, draftRoot, reviewRoot, validationRoot, finalRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const promptTemplateRoot = path.join(targetRoot, wefterConfig.workflowRoot, PRODUCT_SHAPING_WORKFLOW_ID, "templates", "prompts");
  const promptValues = {
    RUN_ID: runName,
    RELEASE_ID: releaseId,
    CONFIG_PATH: configPath,
    PROFILE_PATH: profilePath,
    CONTRACT_PATH: productConfig.contractPath,
    PROCESS_DOC_PATH: productConfig.processDocPath,
    SPEC_ROOT: specRootRelative,
    RUN_ROOT: runRootRelative,
    REQUIRED_FILES: markdownList(requiredFiles.map((file) => file.fullPath)),
    DELIVERABLES_PATH: handoffDeliverablesPath,
    ADVERSARIAL_REVIEW_PATH: adversarialReviewPath,
    FINAL_VALIDATION_PATH: finalValidationPath,
    SCOPE_PATH: productSpecPath(specRootRelative, releaseId, "releases/<release-id>/SCOPE.md"),
    DOMAIN_SPEC_PATH: productSpecPath(specRootRelative, releaseId, "releases/<release-id>/DOMAIN_SPEC.md"),
    ACCEPTANCE_CRITERIA_PATH: productSpecPath(specRootRelative, releaseId, "releases/<release-id>/ACCEPTANCE_CRITERIA.md"),
    OPEN_QUESTIONS_PATH: productSpecPath(specRootRelative, releaseId, "discovery/OPEN_QUESTIONS.md"),
    PRODUCT_DECISIONS_PATH: productSpecPath(specRootRelative, releaseId, "product/PRODUCT_DECISIONS.md")
  };

  const promptRecords = [];
  for (const file of PRODUCT_SHAPING_PROMPT_FILES) {
    const source = path.join(promptTemplateRoot, file);
    const template = readTextRequired(source);
    const rendered = renderTemplate(template, promptValues);
    const destination = path.join(promptsRoot, file);
    assertNoPlaceholders(destination, rendered);
    fs.writeFileSync(destination, rendered, "utf8");
    promptRecords.push(toPosix(path.join(runRootRelative, "prompts", file)));
  }

  writeJson(path.join(stagingRunRoot, "manifest.json"), {
    version: 1,
    workflowId: PRODUCT_SHAPING_WORKFLOW_ID,
    runId: runName,
    releaseId,
    generatedAt: new Date().toISOString(),
    configPath,
    profilePath,
    contractPath: productConfig.contractPath,
    processDocPath: productConfig.processDocPath,
    specRoot: specRootRelative,
    counts: {
      requiredFiles: requiredFiles.length,
      variants: productProfile.variants.length,
      lenses: productProfile.lenses.length
    },
    paths: {
      runRoot: runRootRelative,
      prompts: toPosix(path.join(runRootRelative, "prompts")),
      draft: toPosix(path.join(runRootRelative, "draft")),
      review: toPosix(path.join(runRootRelative, "review")),
      validation: toPosix(path.join(runRootRelative, "validation")),
      final: toPosix(path.join(runRootRelative, "final")),
      specRoot: specRootRelative,
      releaseRoot: toPosix(path.join(specRootRelative, "releases", releaseId))
    },
    outputs: {
      adversarialReview: adversarialReviewPath,
      finalValidation: finalValidationPath
    },
    handoff: {
      deliverables: handoffDeliverablesPath
    },
    gate: {
      status: "pending",
      requireNoReleaseBlockingQuestions: productConfig.completionGate.requireNoReleaseBlockingQuestions,
      requireAdversarialReview: productConfig.completionGate.requireAdversarialReview,
      requireFinalValidation: productConfig.completionGate.requireFinalValidation,
      readyDeliverableStatuses: productConfig.completionGate.readyDeliverableStatuses
    },
    prompts: promptRecords,
    requiredFiles
  });

  fs.writeFileSync(path.join(stagingRunRoot, "README.md"), `# Product Shaping Run\n\nRun: ${runName}\nRelease: ${releaseId}\n\n## Roots\n\n- Specs: ${specRootRelative}\n- Run: ${runRootRelative}\n- Config: ${configPath}\n- Profile: ${profilePath}\n- Contract: ${productConfig.contractPath}\n\n## Execution Order\n\n1. Read ${productConfig.processDocPath}.\n2. Read ${productConfig.contractPath}.\n3. Create or repair product specs under ${specRootRelative}.\n4. Keep runtime notes and draft artifacts in this run directory.\n5. Write adversarial review evidence to ${adversarialReviewPath}.\n6. Write final validation evidence to ${finalValidationPath}.\n7. Validate that release-blocking questions, scope, domain spec, acceptance criteria and deliverables satisfy the completion gate.\n8. Hand off only ${handoffDeliverablesPath} to delivery implementation.\n\n## Passing Evidence Format\n\n- Adversarial review must include \`Status: pass\` or \`Result: pass\` and \`Blocking findings: none\`.\n- Final validation must include \`Status: pass\` or \`Result: pass\` and \`Ready for delivery implementation: yes\`.\n\n## Required Product Spec Files\n\n${requiredFiles.map((file) => `- ${file.fullPath}`).join("\n")}\n`, "utf8");

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory was created before finalizing the staging move: ${runRoot}`);
  }
  fs.renameSync(stagingRunRoot, runRoot);

  console.log(`Created product-shaping run: ${runRoot}`);
  console.log(`Release: ${releaseId}`);
  console.log(`Spec root: ${specRootRelative}`);
  console.log(`Required product spec files: ${requiredFiles.length}`);
}
