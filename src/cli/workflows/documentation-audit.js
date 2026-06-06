import fs from "node:fs";
import path from "node:path";
import { readConfig } from "../core/config.js";
import { readJson, readTextRequired, writeJson } from "../core/fs.js";
import { assertSafeRunName, ensureInside, normalizeRelativePath, resolveTarget, timestampRunName, toPosix } from "../core/paths.js";
import { documentationAuditAuditorPrompt, validateProfile } from "../core/profile.js";
import { markdownList, renderTemplate } from "../core/templates.js";

function buildCombinations(profile, passesPerLens, maxAudits) {
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

export function commandNewRun(flags) {
  const targetRoot = resolveTarget(flags);
  const config = readConfig(targetRoot);
  const profilePathRelative = normalizeRelativePath(flags["profile-path"] || config.profilePath, "profilePath");
  const profilePath = path.join(targetRoot, profilePathRelative);
  ensureInside(targetRoot, profilePath, "profilePath");
  const profile = readJson(profilePath, "audit profile");
  validateProfile(profile);

  const passesPerLens = Number.parseInt(flags["passes-per-lens"] || "3", 10);
  const maxAudits = Number.parseInt(flags["max-audits"] || "0", 10);
  if (!Number.isInteger(passesPerLens) || passesPerLens < 1) {
    throw new Error("--passes-per-lens must be an integer greater than 0.");
  }
  if (!Number.isInteger(maxAudits) || maxAudits < 0) {
    throw new Error("--max-audits must be an integer greater than or equal to 0.");
  }

  const runName = flags["run-name"] || timestampRunName();
  assertSafeRunName(runName);
  const combinations = buildCombinations(profile, passesPerLens, maxAudits);
  const auditorPrompt = documentationAuditAuditorPrompt(targetRoot, config, profile);

  const artifactRoot = path.join(targetRoot, config.artifactRoot);
  const tempRoot = path.join(artifactRoot, ".tmp");
  const runRoot = path.join(artifactRoot, runName);
  const stagingRunRoot = path.join(tempRoot, runName);
  ensureInside(targetRoot, artifactRoot, "artifactRoot");
  ensureInside(targetRoot, runRoot, "runRoot");
  ensureInside(targetRoot, stagingRunRoot, "stagingRunRoot");

  if (flags["dry-run"]) {
    console.log(`Run name: ${runName}`);
    console.log(`Lenses: ${profile.lenses.length}`);
    console.log(`Variants: ${profile.variants.length}`);
    console.log(`Passes per lens/variant: ${passesPerLens}`);
    console.log(`Auditor prompts to generate: ${combinations.length}`);
    console.log(`Output root: ${runRoot}`);
    return;
  }

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory already exists: ${runRoot}. Use a different --run-name to avoid mixing stale prompts or outputs.`);
  }
  if (fs.existsSync(stagingRunRoot)) {
    throw new Error(`Staging directory already exists: ${stagingRunRoot}. Remove it manually after verifying no audit run is in progress, or use a different --run-name.`);
  }

  const promptsRoot = path.join(stagingRunRoot, "prompts");
  const auditorPromptsRoot = path.join(promptsRoot, "auditors");
  const rawRoot = path.join(stagingRunRoot, "raw");
  const consolidationRoot = path.join(stagingRunRoot, "consolidation");
  const validationRoot = path.join(stagingRunRoot, "validation");
  const finalRoot = path.join(stagingRunRoot, "final");
  for (const directory of [artifactRoot, tempRoot, stagingRunRoot, promptsRoot, auditorPromptsRoot, rawRoot, consolidationRoot, validationRoot, finalRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const templateRoot = path.join(targetRoot, config.templateRoot);
  const auditorTemplate = readTextRequired(auditorPrompt.fullPath);
  const consolidatorTemplate = fs.readFileSync(path.join(templateRoot, "consolidator-prompt.md"), "utf8");
  const validatorTemplate = fs.readFileSync(path.join(templateRoot, "validator-prompt.md"), "utf8");
  const promptRecords = [];

  for (const combo of combinations) {
    const outputRelative = toPosix(path.join(config.artifactRoot, runName, "raw", `${combo.auditId}.md`));
    const promptRelative = toPosix(path.join(config.artifactRoot, runName, "prompts", "auditors", `${combo.auditId}.md`));
    const prompt = renderTemplate(auditorTemplate, {
      RUN_ID: runName,
      AUDIT_ID: combo.auditId,
      LENS_ID: combo.lens.id,
      LENS_TITLE: combo.lens.title,
      LENS_FOCUS: combo.lens.focus,
      VARIANT_ID: combo.variant.id,
      VARIANT_TITLE: combo.variant.title,
      VARIANT_INSTRUCTION: combo.variant.instruction,
      PASS_NUMBER: combo.pass,
      OUTPUT_FILE: outputRelative,
      CORPUS_INCLUDE: markdownList(profile.corpus.include),
      CORPUS_EXCLUDE: markdownList(profile.corpus.exclude)
    });
    fs.writeFileSync(path.join(auditorPromptsRoot, `${combo.auditId}.md`), prompt, "utf8");
    promptRecords.push({
      auditId: combo.auditId,
      lensId: combo.lens.id,
      variantId: combo.variant.id,
      pass: combo.pass,
      prompt: promptRelative,
      output: outputRelative
    });
  }

  const consolidatedRelative = toPosix(path.join(config.artifactRoot, runName, "consolidation", "consolidated-candidates.md"));
  const discardedRelative = toPosix(path.join(config.artifactRoot, runName, "consolidation", "discarded-raw-findings.md"));
  const validationRelative = toPosix(path.join(config.artifactRoot, runName, "validation", "adversarial-validation-log.md"));
  const finalRelative = toPosix(path.join(config.artifactRoot, runName, "final", "final-documentation-audit-report.md"));
  const rawRelative = toPosix(path.join(config.artifactRoot, runName, "raw"));

  fs.writeFileSync(path.join(promptsRoot, "consolidate.md"), renderTemplate(consolidatorTemplate, {
    RUN_ID: runName,
    RAW_DIR: rawRelative,
    CONSOLIDATED_OUTPUT: consolidatedRelative,
    DISCARDED_OUTPUT: discardedRelative
  }), "utf8");
  fs.writeFileSync(path.join(promptsRoot, "validate.md"), renderTemplate(validatorTemplate, {
    RUN_ID: runName,
    CONSOLIDATED_OUTPUT: consolidatedRelative,
    VALIDATION_OUTPUT: validationRelative,
    FINAL_OUTPUT: finalRelative
  }), "utf8");

  writeJson(path.join(stagingRunRoot, "manifest.json"), {
    version: 1,
    workflowId: "documentation-audit",
    runId: runName,
    generatedAt: new Date().toISOString(),
    passesPerLens,
    maxAudits,
    profilePath: profilePathRelative,
    auditorPromptPath: auditorPrompt.relativePath,
    corpus: profile.corpus,
    counts: {
      lenses: profile.lenses.length,
      variants: profile.variants.length,
      auditorPrompts: combinations.length
    },
    paths: {
      runRoot: toPosix(path.join(config.artifactRoot, runName)),
      prompts: toPosix(path.join(config.artifactRoot, runName, "prompts")),
      raw: rawRelative,
      consolidation: toPosix(path.join(config.artifactRoot, runName, "consolidation")),
      validation: toPosix(path.join(config.artifactRoot, runName, "validation")),
      final: toPosix(path.join(config.artifactRoot, runName, "final"))
    },
    prompts: promptRecords
  });

  fs.writeFileSync(path.join(stagingRunRoot, "README.md"), `# Documentation Audit Run\n\nRun: ${runName}\n\n## Counts\n\n- Lenses: ${profile.lenses.length}\n- Variants: ${profile.variants.length}\n- Passes per lens/variant: ${passesPerLens}\n- Auditor prompts: ${combinations.length}\n\n## Execution Order\n\n1. Do not execute this run in plan mode or any read-only runtime. Audit execution must be able to write artifacts under this run directory.\n2. Read manifest.json and execute auditor prompts using the exact prompt and output paths listed there. Do not locate prompts with wildcard or glob patterns.\n3. Execute auditor prompts from prompts/auditors/ and write outputs to raw/.\n4. After each batch, compare manifest outputs against raw/ files and retry missing outputs once before continuing.\n5. Execute prompts/consolidate.md only after every expected raw output exists.\n6. Execute prompts/validate.md after consolidation exists.\n7. Review final/final-documentation-audit-report.md.\n\n## opencode Command\n\n- Use /wefter-audit-docs with this run path to execute or resume the end-to-end audit.\n`, "utf8");

  if (fs.existsSync(runRoot)) {
    throw new Error(`Run directory was created before finalizing the staging move: ${runRoot}`);
  }
  fs.renameSync(stagingRunRoot, runRoot);

  console.log(`Created documentation audit run: ${runRoot}`);
  console.log(`Auditor prompts generated: ${combinations.length}`);
  console.log(`Next prompt directory: ${path.join(runRoot, "prompts", "auditors")}`);
}
