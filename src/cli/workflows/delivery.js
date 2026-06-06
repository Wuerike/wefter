import fs from "node:fs";
import path from "node:path";
import { DELIVERY_WORKFLOW_ID } from "../constants.js";
import { assertWorkflowEnabled, deliveryConfigPath, deliveryProfilePath, productShapingConfigPath, readConfig } from "../core/config.js";
import { readJson, writeJson } from "../core/fs.js";
import { assertSafeRunName, ensureInside, getSafeDeliveryUnitKey, normalizeRelativePath, resolveTarget, timestampRunName, toPosix } from "../core/paths.js";
import {
  alignDeliverySourceDocsWithHandoff,
  assertDeliverableExists,
  parseProductDeliverablesHandoff,
  productSpecPath,
  productValidationFlagsFromDeliveryFlags,
  rebaseReleasePath,
  validateProductSpecs
} from "../core/product-specs.js";
import { buildCombinations, validateDeliveryConfig, validateDeliveryProfile, validateProductShapingConfig } from "../core/profile.js";
import { markdownList, renderTemplate } from "../core/templates.js";
import { parseStrictInteger, requireString } from "../core/validation.js";

function enforceProductHandoffGate(targetRoot, wefterConfig, deliveryConfig, flags) {
  const productConfigPath = productShapingConfigPath(wefterConfig);
  const productConfig = readJson(path.join(targetRoot, productConfigPath), "product-shaping config");
  validateProductShapingConfig(productConfig);
  const handoff = parseProductDeliverablesHandoff(deliveryConfig.deliverablesDocument);
  if (!handoff) {
    return;
  }
  if (handoff.releaseId !== deliveryConfig.releaseId) {
    const expectedHandoff = productSpecPath(normalizeRelativePath(productConfig.specRoot, "Product-shaping config.specRoot"), deliveryConfig.releaseId, "releases/<release-id>/DELIVERABLES.md");
    throw new Error(`Product-shaping handoff must use the configured DELIVERABLES.md path '${expectedHandoff}', but got '${handoff.deliverablesDocument}'.`);
  }

  if (!flags["product-run-id"] && !flags["product-run-root"]) {
    throw new Error(`Using product-shaping DELIVERABLES.md as a delivery handoff requires --product-run-id or --product-run-root so the product completion gate can be verified.`);
  }

  const result = validateProductSpecs(targetRoot, { ...productConfig, specRoot: handoff.specRoot }, deliveryConfig.releaseId, productValidationFlagsFromDeliveryFlags(flags));
  if (result.errors.length > 0) {
    throw new Error(`Product-shaping handoff is not valid for delivery implementation:\n- ${result.errors.join("\n- ")}`);
  }
}

export function commandDeliveryRun(flags) {
  const targetRoot = resolveTarget(flags);
  const wefterConfig = readConfig(targetRoot);
  assertWorkflowEnabled(wefterConfig, DELIVERY_WORKFLOW_ID);
  const configPath = deliveryConfigPath(wefterConfig, flags);
  const profilePath = deliveryProfilePath(wefterConfig, flags);
  const deliveryConfig = readJson(path.join(targetRoot, configPath), "delivery config");
  if (flags["deliverables-document"]) {
    deliveryConfig.deliverablesDocument = normalizeRelativePath(flags["deliverables-document"], "deliverables document override");
  }
  if (flags["release-id"]) {
    const previousReleaseId = deliveryConfig.releaseId;
    const nextReleaseId = requireString(flags["release-id"], "release id override");
    assertSafeRunName(nextReleaseId);
    deliveryConfig.deliverablesDocument = rebaseReleasePath(deliveryConfig.deliverablesDocument, previousReleaseId, nextReleaseId);
    deliveryConfig.versionedArtifacts.executionRoot = rebaseReleasePath(deliveryConfig.versionedArtifacts.executionRoot, previousReleaseId, nextReleaseId);
    deliveryConfig.versionedArtifacts.decisionLogRoot = rebaseReleasePath(deliveryConfig.versionedArtifacts.decisionLogRoot, previousReleaseId, nextReleaseId);
    deliveryConfig.releaseId = nextReleaseId;
  }
  alignDeliverySourceDocsWithHandoff(deliveryConfig);
  const profile = readJson(path.join(targetRoot, profilePath), "delivery profile");
  validateDeliveryConfig(deliveryConfig);
  validateDeliveryProfile(profile);
  enforceProductHandoffGate(targetRoot, wefterConfig, deliveryConfig, flags);

  const deliveryUnitId = flags["deliverable-id"] || deliveryConfig.defaultDeliveryUnitId;
  const deliveryUnitKey = getSafeDeliveryUnitKey(deliveryUnitId);
  assertDeliverableExists(targetRoot, deliveryConfig, deliveryUnitId, deliveryUnitKey);
  const passesPerLens = flags["passes-per-lens"] ? parseStrictInteger(flags["passes-per-lens"], "--passes-per-lens", 1) : deliveryConfig.defaultPlanAuditPassesPerLens;
  const maxAudits = flags["max-audits"] ? parseStrictInteger(flags["max-audits"], "--max-audits", 0) : 0;

  const runName = flags["run-name"] || `${timestampRunName()}__${deliveryUnitKey}`;
  assertSafeRunName(runName);
  const combinations = buildCombinations(profile, passesPerLens, maxAudits).map((combo, index) => ({
    ...combo,
    auditId: `P${String(index + 1).padStart(4, "0")}__${combo.lens.id}__${combo.variant.id}__p${String(combo.pass).padStart(2, "0")}`
  }));

  const artifactRoot = path.join(targetRoot, deliveryConfig.runArtifactsRoot);
  const tempRoot = path.join(artifactRoot, ".tmp");
  const runRoot = path.join(artifactRoot, runName);
  const stagingRunRoot = path.join(tempRoot, runName);
  ensureInside(targetRoot, artifactRoot, "delivery runArtifactsRoot");
  ensureInside(targetRoot, runRoot, "delivery runRoot");
  ensureInside(targetRoot, stagingRunRoot, "delivery stagingRunRoot");

  const runRootRelative = toPosix(path.join(deliveryConfig.runArtifactsRoot, runName));
  const versionedDeliveryDir = toPosix(path.join(deliveryConfig.versionedArtifacts.executionRoot, deliveryUnitKey));
  const versionedTaskSpecsDir = toPosix(path.join(versionedDeliveryDir, "task-specs"));
  const versionedDecisionLog = toPosix(path.join(deliveryConfig.versionedArtifacts.decisionLogRoot, `${deliveryUnitKey}-decisions.md`));

  if (flags["dry-run"]) {
    console.log(`Run name: ${runName}`);
    console.log(`Delivery unit: ${deliveryUnitKey}`);
    console.log(`Lenses: ${profile.lenses.length}`);
    console.log(`Variants: ${profile.variants.length}`);
    console.log(`Passes per lens/variant: ${passesPerLens}`);
    console.log(`Plan auditor prompts to generate: ${combinations.length}`);
    console.log(`Output root: ${runRoot}`);
    console.log(`Versioned delivery dir: ${versionedDeliveryDir}`);
    return;
  }

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory already exists: ${runRoot}. Use a different --run-name or resume the existing run.`);
  }
  if (fs.existsSync(stagingRunRoot)) {
    throw new Error(`Staging directory already exists: ${stagingRunRoot}. Remove it manually after verifying no run is in progress, or use a different --run-name.`);
  }

  const promptsRoot = path.join(stagingRunRoot, "prompts");
  const planAuditorPromptsRoot = path.join(promptsRoot, "plan-auditors", deliveryUnitKey);
  const planningRoot = path.join(stagingRunRoot, "planning");
  const draftRoot = path.join(planningRoot, "draft");
  const draftTaskSpecsRoot = path.join(draftRoot, "task-specs");
  const finalRoot = path.join(stagingRunRoot, "final");
  const candidateRoot = path.join(finalRoot, "approved-artifacts");
  const candidateDeliveryRoot = path.join(candidateRoot, deliveryUnitKey);
  const candidateTaskSpecsRoot = path.join(candidateDeliveryRoot, "task-specs");
  const rawPlanAuditsRoot = path.join(stagingRunRoot, "raw", "plan-audits");
  const consolidationRoot = path.join(stagingRunRoot, "consolidation");
  const validationRoot = path.join(stagingRunRoot, "validation");
  const implementationRoot = path.join(stagingRunRoot, "implementation");
  const taskLogRoot = path.join(implementationRoot, "task-logs");
  const taskReviewRoot = path.join(implementationRoot, "task-reviews");
  for (const directory of [artifactRoot, tempRoot, stagingRunRoot, promptsRoot, planAuditorPromptsRoot, planningRoot, draftRoot, draftTaskSpecsRoot, finalRoot, candidateRoot, candidateDeliveryRoot, candidateTaskSpecsRoot, rawPlanAuditsRoot, consolidationRoot, validationRoot, implementationRoot, taskLogRoot, taskReviewRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const templateRoot = path.join(targetRoot, wefterConfig.workflowRoot, DELIVERY_WORKFLOW_ID, "templates", "prompts");
  const templates = {
    planner: fs.readFileSync(path.join(templateRoot, "planner-prompt.md"), "utf8"),
    planAuditor: fs.readFileSync(path.join(templateRoot, "plan-auditor-prompt.md"), "utf8"),
    consolidator: fs.readFileSync(path.join(templateRoot, "plan-consolidator-prompt.md"), "utf8"),
    validator: fs.readFileSync(path.join(templateRoot, "plan-validator-prompt.md"), "utf8"),
    repairer: fs.readFileSync(path.join(templateRoot, "plan-repairer-prompt.md"), "utf8"),
    taskImplementation: fs.readFileSync(path.join(templateRoot, "task-implementation-prompt.md"), "utf8"),
    taskReview: fs.readFileSync(path.join(templateRoot, "task-review-prompt.md"), "utf8"),
    deliveryValidator: fs.readFileSync(path.join(templateRoot, "delivery-validator-prompt.md"), "utf8")
  };

  const draftPlan = toPosix(path.join(runRootRelative, "planning", "draft", "delivery-plan.md"));
  const draftTraceability = toPosix(path.join(runRootRelative, "planning", "draft", "traceability-matrix.md"));
  const draftVerification = toPosix(path.join(runRootRelative, "planning", "draft", "verification-plan.md"));
  const draftGate = toPosix(path.join(runRootRelative, "planning", "draft", "gate-assessment.md"));
  const draftDecisions = toPosix(path.join(runRootRelative, "planning", "draft", "decisions-draft.md"));
  const draftTaskSpecs = toPosix(path.join(runRootRelative, "planning", "draft", "task-specs"));
  const candidatePlan = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, "delivery-plan.md"));
  const candidateTraceability = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, "traceability-matrix.md"));
  const candidateVerification = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, "verification-plan.md"));
  const candidateGate = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, "gate-assessment.md"));
  const candidateDecisions = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, `${deliveryUnitKey}-decisions.md`));
  const candidateTaskSpecs = toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey, "task-specs"));
  const repairSummary = toPosix(path.join(runRootRelative, "final", "plan-repair-summary.md"));
  const rawPlanAudits = toPosix(path.join(runRootRelative, "raw", "plan-audits"));
  const consolidatedOutput = toPosix(path.join(runRootRelative, "consolidation", "consolidated-plan-candidates.md"));
  const discardedOutput = toPosix(path.join(runRootRelative, "consolidation", "discarded-plan-findings.md"));
  const validationOutput = toPosix(path.join(runRootRelative, "validation", "plan-adversarial-validation-log.md"));
  const finalPlanReview = toPosix(path.join(runRootRelative, "final", "final-plan-review-report.md"));
  const deliveryValidation = toPosix(path.join(runRootRelative, "final", "delivery-validation.md"));
  const taskLogDir = toPosix(path.join(runRootRelative, "implementation", "task-logs"));
  const taskReviewDir = toPosix(path.join(runRootRelative, "implementation", "task-reviews"));
  const versionedDeliveryPlan = toPosix(path.join(versionedDeliveryDir, "delivery-plan.md"));
  const versionedTraceability = toPosix(path.join(versionedDeliveryDir, "traceability-matrix.md"));
  const versionedVerification = toPosix(path.join(versionedDeliveryDir, "verification-plan.md"));

  const baseValues = {
    RUN_ID: runName,
    RUNNER_COMMAND: wefterConfig.runnerCommand,
    DELIVERY_UNIT_ID: deliveryUnitId,
    DELIVERY_UNIT_KEY: deliveryUnitKey,
    RELEASE_ID: deliveryConfig.releaseId,
    CONFIG_PATH: configPath,
    PROFILE_PATH: profilePath,
    RUN_ROOT: runRootRelative,
    DELIVERABLES_DOCUMENT: deliveryConfig.deliverablesDocument,
    SOURCE_INCLUDE: markdownList(deliveryConfig.sourceDocs.include),
    SOURCE_EXCLUDE: markdownList(deliveryConfig.sourceDocs.exclude),
    DRAFT_PLAN_OUTPUT: draftPlan,
    DRAFT_TRACEABILITY_OUTPUT: draftTraceability,
    DRAFT_VERIFICATION_OUTPUT: draftVerification,
    DRAFT_GATE_OUTPUT: draftGate,
    DRAFT_DECISIONS_OUTPUT: draftDecisions,
    DRAFT_TASK_SPECS_DIR: draftTaskSpecs,
    CANDIDATE_PLAN_OUTPUT: candidatePlan,
    CANDIDATE_TRACEABILITY_OUTPUT: candidateTraceability,
    CANDIDATE_VERIFICATION_OUTPUT: candidateVerification,
    CANDIDATE_GATE_OUTPUT: candidateGate,
    CANDIDATE_DECISIONS_OUTPUT: candidateDecisions,
    CANDIDATE_TASK_SPECS_DIR: candidateTaskSpecs,
    REPAIR_SUMMARY_OUTPUT: repairSummary,
    RAW_PLAN_AUDITS_DIR: rawPlanAudits,
    CONSOLIDATED_OUTPUT: consolidatedOutput,
    DISCARDED_OUTPUT: discardedOutput,
    VALIDATION_OUTPUT: validationOutput,
    FINAL_PLAN_REVIEW_OUTPUT: finalPlanReview,
    VERSIONED_DELIVERY_DIR: versionedDeliveryDir,
    VERSIONED_TASK_SPECS_DIR: versionedTaskSpecsDir,
    VERSIONED_DELIVERY_PLAN: versionedDeliveryPlan,
    VERSIONED_TRACEABILITY_MATRIX: versionedTraceability,
    VERSIONED_VERIFICATION_PLAN: versionedVerification,
    VERSIONED_DECISION_LOG: versionedDecisionLog,
    TASK_LOG_DIR: taskLogDir,
    TASK_REVIEW_DIR: taskReviewDir,
    DELIVERY_VALIDATION_OUTPUT: deliveryValidation
  };

  fs.writeFileSync(path.join(promptsRoot, "plan.md"), renderTemplate(templates.planner, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "consolidate-plan.md"), renderTemplate(templates.consolidator, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "validate-plan.md"), renderTemplate(templates.validator, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "repair-plan.md"), renderTemplate(templates.repairer, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "implement-tasks.md"), renderTemplate(templates.taskImplementation, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "review-task.md"), renderTemplate(templates.taskReview, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "validate-delivery.md"), renderTemplate(templates.deliveryValidator, baseValues), "utf8");

  const promptRecords = [];
  for (const combo of combinations) {
    const outputRelative = toPosix(path.join(runRootRelative, "raw", "plan-audits", `${combo.auditId}.md`));
    const promptRelative = toPosix(path.join(runRootRelative, "prompts", "plan-auditors", deliveryUnitKey, `${combo.auditId}.md`));
    const prompt = renderTemplate(templates.planAuditor, {
      ...baseValues,
      AUDIT_ID: combo.auditId,
      LENS_ID: combo.lens.id,
      LENS_TITLE: combo.lens.title,
      LENS_FOCUS: combo.lens.focus,
      VARIANT_ID: combo.variant.id,
      VARIANT_TITLE: combo.variant.title,
      VARIANT_INSTRUCTION: combo.variant.instruction,
      PASS_NUMBER: combo.pass,
      OUTPUT_FILE: outputRelative
    });
    fs.writeFileSync(path.join(planAuditorPromptsRoot, `${combo.auditId}.md`), prompt, "utf8");
    promptRecords.push({
      auditId: combo.auditId,
      lensId: combo.lens.id,
      variantId: combo.variant.id,
      pass: combo.pass,
      prompt: promptRelative,
      output: outputRelative
    });
  }

  writeJson(path.join(stagingRunRoot, "manifest.json"), {
    version: 1,
    workflowId: DELIVERY_WORKFLOW_ID,
    runId: runName,
    deliveryUnitId,
    deliveryUnitKey,
    releaseId: deliveryConfig.releaseId,
    generatedAt: new Date().toISOString(),
    configPath,
    profilePath,
    deliverablesDocument: deliveryConfig.deliverablesDocument,
    passesPerLens,
    maxAudits,
    gatePolicy: deliveryConfig.gatePolicy,
    counts: {
      lenses: profile.lenses.length,
      variants: profile.variants.length,
      planAuditorPrompts: combinations.length
    },
    paths: {
      runRoot: runRootRelative,
      prompts: toPosix(path.join(runRootRelative, "prompts")),
      planPrompt: toPosix(path.join(runRootRelative, "prompts", "plan.md")),
      planAuditorPrompts: toPosix(path.join(runRootRelative, "prompts", "plan-auditors", deliveryUnitKey)),
      rawPlanAudits,
      consolidation: toPosix(path.join(runRootRelative, "consolidation")),
      validation: toPosix(path.join(runRootRelative, "validation")),
      final: toPosix(path.join(runRootRelative, "final")),
      candidateArtifacts: toPosix(path.join(runRootRelative, "final", "approved-artifacts", deliveryUnitKey)),
      versionedDeliveryDir,
      versionedDecisionLog
    },
    prompts: {
      plan: toPosix(path.join(runRootRelative, "prompts", "plan.md")),
      planAudits: promptRecords,
      consolidatePlan: toPosix(path.join(runRootRelative, "prompts", "consolidate-plan.md")),
      validatePlan: toPosix(path.join(runRootRelative, "prompts", "validate-plan.md")),
      repairPlan: toPosix(path.join(runRootRelative, "prompts", "repair-plan.md")),
      implementTasks: toPosix(path.join(runRootRelative, "prompts", "implement-tasks.md")),
      reviewTask: toPosix(path.join(runRootRelative, "prompts", "review-task.md")),
      validateDelivery: toPosix(path.join(runRootRelative, "prompts", "validate-delivery.md"))
    }
  });

  fs.writeFileSync(path.join(stagingRunRoot, "README.md"), `# Delivery Implementation Run\n\nRun: ${runName}\nDelivery unit: ${deliveryUnitKey}\nRelease: ${deliveryConfig.releaseId}\n\n## Source Handoff\n\n- Deliverables document: ${deliveryConfig.deliverablesDocument}\n\n## Counts\n\n- Lenses: ${profile.lenses.length}\n- Variants: ${profile.variants.length}\n- Passes per lens/variant: ${passesPerLens}\n- Plan auditor prompts: ${combinations.length}\n\n## Execution Order\n\n1. Execute prompts/plan.md with the delivery planner.\n2. Execute prompts/plan-auditors/${deliveryUnitKey}/*.md with plan auditors.\n3. Execute prompts/consolidate-plan.md.\n4. Execute prompts/validate-plan.md.\n5. Execute prompts/repair-plan.md.\n6. Review final/approved-artifacts/${deliveryUnitKey}/ and apply gate policy.\n7. Publish approved artifacts to ${versionedDeliveryDir} and ${versionedDecisionLog}.\n8. Execute prompts/implement-tasks.md task by task only after approval.\n9. After each implementation or correction, run \`${wefterConfig.runnerCommand} delivery guard --run-id ${runName} --task-id <task-id> --mode ReadyForReview\`.\n10. Review the task with prompts/review-task.md.\n11. After each task review, run \`${wefterConfig.runnerCommand} delivery guard --run-id ${runName} --task-id <task-id> --mode ReadyForNextTask\`.\n12. If the guard reports Needs Fix, correct the same task and repeat implementation guard -> review -> next-task guard.\n13. If the guard reports Blocked, pause the delivery unit for human decision or specification repair.\n14. Before final validation, run \`${wefterConfig.runnerCommand} delivery guard --run-id ${runName} --mode ReadyForFinalValidation\`.\n15. Execute prompts/validate-delivery.md only when all tasks pass review and the final-validation guard passes.\n`, "utf8");

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory was created before finalizing the staging move: ${runRoot}`);
  }
  fs.renameSync(stagingRunRoot, runRoot);

  console.log(`Created delivery implementation run: ${runRoot}`);
  console.log(`Delivery unit: ${deliveryUnitKey}`);
  console.log(`Plan auditor prompts generated: ${combinations.length}`);
  console.log(`Next prompt: ${path.join(runRoot, "prompts", "plan.md")}`);
}
