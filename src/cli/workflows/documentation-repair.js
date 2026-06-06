import fs from "node:fs";
import path from "node:path";
import { DOCUMENTATION_REPAIR_WORKFLOW_ID } from "../constants.js";
import { readConfig } from "../core/config.js";
import { readJsonIfExists, writeJson } from "../core/fs.js";
import { assertSafeRunName, documentationRepairArtifactRoot, documentationRepairTemplateRoot, ensureInside, normalizeRelativePath, resolveTarget, timestampRunName, toPosix } from "../core/paths.js";
import { markdownList, renderTemplate } from "../core/templates.js";

export function commandDocsRepair(flags) {
  const targetRoot = resolveTarget(flags);
  const config = readConfig(targetRoot);
  if (!flags["audit-report"]) {
    throw new Error("--audit-report is required for docs repair.");
  }
  const auditReportPath = normalizeRelativePath(flags["audit-report"], "audit-report");
  const auditReportFullPath = path.join(targetRoot, auditReportPath);
  ensureInside(targetRoot, auditReportFullPath, "audit report");
  if (!fs.existsSync(auditReportFullPath)) {
    throw new Error(`Audit report not found: ${auditReportFullPath}`);
  }

  const runName = flags["run-name"] || timestampRunName();
  assertSafeRunName(runName);

  const artifactRootRelative = documentationRepairArtifactRoot();
  const artifactRoot = path.join(targetRoot, artifactRootRelative);
  const tempRoot = path.join(artifactRoot, ".tmp");
  const runRoot = path.join(artifactRoot, runName);
  const stagingRunRoot = path.join(tempRoot, runName);
  ensureInside(targetRoot, artifactRoot, "documentation repair artifact root");
  ensureInside(targetRoot, runRoot, "documentation repair run root");
  ensureInside(targetRoot, stagingRunRoot, "documentation repair staging run root");

  if (flags["dry-run"]) {
    console.log(`Run name: ${runName}`);
    console.log(`Audit report: ${auditReportPath}`);
    console.log(`Output root: ${runRoot}`);
    return;
  }

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory already exists: ${runRoot}. Use a different --run-name or resume the existing run.`);
  }
  if (fs.existsSync(stagingRunRoot)) {
    throw new Error(`Staging directory already exists: ${stagingRunRoot}. Remove it manually after verifying no repair run is in progress, or use a different --run-name.`);
  }

  const runRootRelative = toPosix(path.join(artifactRootRelative, runName));
  const promptsRoot = path.join(stagingRunRoot, "prompts");
  const planningRoot = path.join(stagingRunRoot, "planning");
  const repairRoot = path.join(stagingRunRoot, "repair");
  const reviewRoot = path.join(stagingRunRoot, "review");
  const finalRoot = path.join(stagingRunRoot, "final");
  for (const directory of [artifactRoot, tempRoot, stagingRunRoot, promptsRoot, planningRoot, repairRoot, reviewRoot, finalRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const templateRoot = path.join(documentationRepairTemplateRoot(), "prompts");
  const planTemplate = fs.readFileSync(path.join(templateRoot, "repair-plan-prompt.md"), "utf8");
  const applyTemplate = fs.readFileSync(path.join(templateRoot, "repair-apply-prompt.md"), "utf8");
  const reviewTemplate = fs.readFileSync(path.join(templateRoot, "repair-review-prompt.md"), "utf8");
  const repairPlan = toPosix(path.join(runRootRelative, "planning", "documentation-repair-plan.md"));
  const humanDecisions = toPosix(path.join(runRootRelative, "planning", "human-decisions.md"));
  const repairLog = toPosix(path.join(runRootRelative, "repair", "repair-log.md"));
  const reviewOutput = toPosix(path.join(runRootRelative, "review", "repair-review.md"));
  const finalSummary = toPosix(path.join(runRootRelative, "final", "documentation-repair-summary.md"));
  const profile = readJsonIfExists(path.join(targetRoot, config.profilePath), "audit profile");
  const baseValues = {
    RUN_ID: runName,
    RUN_ROOT: runRootRelative,
    AUDIT_REPORT: auditReportPath,
    REPAIR_PLAN_OUTPUT: repairPlan,
    HUMAN_DECISIONS_OUTPUT: humanDecisions,
    REPAIR_LOG_OUTPUT: repairLog,
    REVIEW_OUTPUT: reviewOutput,
    FINAL_SUMMARY_OUTPUT: finalSummary,
    CORPUS_INCLUDE: markdownList(profile?.corpus?.include || ["*.md", "docs/**/*.md"]),
    CORPUS_EXCLUDE: markdownList(profile?.corpus?.exclude || ["node_modules/**", ".git/**", ".audit/**", ".opencode/**"])
  };

  fs.writeFileSync(path.join(promptsRoot, "plan-repair.md"), renderTemplate(planTemplate, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "apply-repair.md"), renderTemplate(applyTemplate, baseValues), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "review-repair.md"), renderTemplate(reviewTemplate, baseValues), "utf8");

  writeJson(path.join(stagingRunRoot, "manifest.json"), {
    version: 1,
    workflowId: DOCUMENTATION_REPAIR_WORKFLOW_ID,
    runId: runName,
    generatedAt: new Date().toISOString(),
    auditReport: auditReportPath,
    paths: {
      runRoot: runRootRelative,
      prompts: toPosix(path.join(runRootRelative, "prompts")),
      repairPlan,
      humanDecisions,
      repairLog,
      reviewOutput,
      finalSummary
    },
    prompts: {
      planRepair: toPosix(path.join(runRootRelative, "prompts", "plan-repair.md")),
      applyRepair: toPosix(path.join(runRootRelative, "prompts", "apply-repair.md")),
      reviewRepair: toPosix(path.join(runRootRelative, "prompts", "review-repair.md"))
    }
  });

  fs.writeFileSync(path.join(stagingRunRoot, "README.md"), `# Documentation Repair Run\n\nRun: ${runName}\nAudit report: ${auditReportPath}\n\n## Execution Order\n\n1. Execute prompts/plan-repair.md.\n2. If planning records human decisions, pause until they are resolved.\n3. Execute prompts/apply-repair.md after approval.\n4. Execute prompts/review-repair.md after repair edits.\n5. Run a follow-up documentation audit.\n`, "utf8");

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory was created before finalizing the staging move: ${runRoot}`);
  }
  fs.renameSync(stagingRunRoot, runRoot);

  console.log(`Created documentation repair run: ${runRoot}`);
  console.log(`Audit report: ${auditReportPath}`);
  console.log(`Next prompt: ${path.join(runRoot, "prompts", "plan-repair.md")}`);
}
