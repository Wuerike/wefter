import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin", "wefter.js");

function makeTarget(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `wefter-${name}-`));
}

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    ...options
  });
  if (options.expectFailure) {
    assert.notEqual(result.status, 0, `Expected failure for ${args.join(" ")}`);
    return result;
  }
  assert.equal(result.status, 0, `Command failed: ${args.join(" ")}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return result;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function writeJsonFile(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function smallProfile(title = "One lens") {
  return {
    version: 1,
    corpus: {
      include: ["README.md"],
      exclude: [".audit/**"]
    },
    variants: [
      {
        id: "one-variant",
        title: "One variant",
        instruction: "Find one type of issue."
      }
    ],
    lenses: [
      {
        id: "one-lens",
        title,
        focus: "Inspect one focused area."
      }
    ]
  };
}

function smallDeliveryProfile(title = "One delivery lens") {
  return {
    version: 1,
    variants: [
      {
        id: "one-variant",
        title: "One variant",
        instruction: "Find one type of delivery issue."
      }
    ],
    lenses: [
      {
        id: "one-lens",
        title,
        focus: "Inspect one delivery planning area."
      }
    ]
  };
}

function assertNoTemplatePlaceholders(root) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      assertNoTemplatePlaceholders(fullPath);
      continue;
    }
    if (entry.isFile()) {
      assert.doesNotMatch(fs.readFileSync(fullPath, "utf8"), /\{\{[^}]+\}\}/, `${fullPath} contains an unresolved template placeholder`);
    }
  }
}

function assertNoLegacyWorkUnitVocabulary(root) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      assertNoLegacyWorkUnitVocabulary(fullPath);
      continue;
    }
    if (entry.isFile()) {
      const content = fs.readFileSync(fullPath, "utf8");
      assert.doesNotMatch(content, /work-unit|Work-Unit|work unit|Work Unit|wefter-work-unit|validate-work-unit/, `${fullPath} contains legacy work-unit vocabulary`);
    }
  }
}

function initTarget(name = "target") {
  const target = makeTarget(name);
  run(["init", "--target", target, "--yes", "--force"]);
  return target;
}

function setProductShapingEnabled(target, enabled) {
  const configPath = path.join(target, "wefter.config.json");
  const config = readJson(configPath);
  config.workflows["product-shaping"].enabled = enabled;
  writeJsonFile(configPath, config);
}

function writeMinimalProductSpecs(target, releaseId, deliverableStatus = "ready", specRootOverride = null) {
  const productConfig = readJson(path.join(target, ".wefter", "workflows", "product-shaping", "config.json"));
  const specRoot = specRootOverride || productConfig.specRoot;
  for (const file of productConfig.requiredFiles) {
    const relativePath = file.replaceAll("<release-id>", releaseId);
    let content = `# ${relativePath}\n`;
    if (relativePath === "discovery/OPEN_QUESTIONS.md") {
      content = "# Open Questions\n\nStatus: closed\nBlocks target release: no\n";
    }
    if (relativePath === "references/README.md") {
      content = "# References\n\nNo external references used.\n";
    }
    if (relativePath.endsWith("DELIVERABLES.md")) {
      content = `# Deliverables\n\n## Deliverable 00: Scoped outcome\n\nStatus: ${deliverableStatus}\nGoal: Deliver the scoped outcome.\nScope: Included release behavior.\nOut of scope: Deferred behavior.\nDependencies: None.\nSource docs: SCOPE.md, DOMAIN_SPEC.md, ACCEPTANCE_CRITERIA.md.\nAcceptance criteria: Release criteria are satisfied.\nRisk areas: None known.\nHuman gate triggers: Scope or domain ambiguity.\nExpected verification: Run release validation.\n`;
    }
    writeText(path.join(target, specRoot, relativePath), content);
  }
}

function writeProductGateEvidence(target, runName) {
  writeText(path.join(target, ".wefter", "runs", "product-shaping", runName, "review", "adversarial-review.md"), "# Review\n\nStatus: pass\nBlocking findings: none\n");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", runName, "final", "product-shaping-validation.md"), "# Final Validation\n\nStatus: pass\nReady for delivery implementation: yes\n");
}

function prepareValidProductHandoff(target, runName = "product-handoff-run", releaseId = "01_mvp") {
  run(["product", "shape", "--target", target, "--release-id", releaseId, "--run-name", runName]);
  writeMinimalProductSpecs(target, releaseId, "ready");
  writeProductGateEvidence(target, runName);
}

test("init installs config, OpenCode files, and doctor passes", () => {
  const target = initTarget("init");

  const installManifest = readJson(path.join(target, ".wefter", "install-manifest.json"));
  assert.equal(installManifest.version, 1);
  assert.ok(installManifest.files.some((file) => file.path === "wefter.config.json"));
  assert.ok(installManifest.files.some((file) => file.path === ".opencode/agent/wefter-product-orchestrator.md"));
  assert.equal(readJson(path.join(target, "wefter.config.json")).workflows["delivery-implementation"].status, "available");
  assert.equal(readJson(path.join(target, "wefter.config.json")).workflows["product-shaping"].status, "available");
  assert.equal(readJson(path.join(target, "wefter.config.json")).workflows["product-shaping"].enabled, true);
  assert.equal(readJson(path.join(target, "wefter.config.json")).workflows["product-shaping"].specRoot, ".wefter/specs");
  assert.equal(readJson(path.join(target, "wefter.config.json")).workflows["product-shaping"].runRoot, ".wefter/runs/product-shaping");
  assert.equal(readJson(path.join(target, "wefter.config.json")).workflows["delivery-implementation"].profilePath, ".wefter/workflows/delivery-implementation/profile.json");
  assert.equal(readJson(path.join(target, "wefter.config.json")).workflows["documentation-repair"].status, "available");
  assert.ok(fs.existsSync(path.join(target, ".opencode", "agent", "wefter-product-orchestrator.md")));
  assert.ok(fs.existsSync(path.join(target, ".opencode", "agent", "wefter-doc-audit-orchestrator.md")));
  assert.ok(fs.existsSync(path.join(target, ".opencode", "agent", "wefter-doc-repair-orchestrator.md")));
  assert.ok(fs.existsSync(path.join(target, ".opencode", "agent", "wefter-delivery-orchestrator.md")));
  assert.ok(fs.existsSync(path.join(target, ".opencode", "skills", "delivery-implementation", "SKILL.md")));
  assert.ok(fs.existsSync(path.join(target, ".opencode", "skills", "product-shaping", "SKILL.md")));
  assert.ok(fs.existsSync(path.join(target, ".opencode", "skills", "documentation-repair", "SKILL.md")));
  assert.ok(!fs.existsSync(path.join(target, ".opencode", "skills", "work-unit-implementation", "SKILL.md")));
  assert.match(fs.readFileSync(path.join(target, ".opencode", "skills", "documentation-audit", "SKILL.md"), "utf8"), /Do not run audit execution in plan mode/);
  assert.ok(fs.existsSync(path.join(target, ".wefter", "workflows", "product-shaping", "config.json")));
  assert.ok(fs.existsSync(path.join(target, ".wefter", "workflows", "product-shaping", "profile.json")));
  assert.match(fs.readFileSync(path.join(target, ".wefter", "workflows", "product-shaping", "templates", "documentation-audit", "workflow-self-audit-auditor-prompt.md"), "utf8"), /runtime prevents writing/);
  assert.ok(fs.existsSync(path.join(target, ".wefter", "workflows", "delivery-implementation", "profile.json")));
  assert.equal(readJson(path.join(target, ".wefter", "workflows", "delivery-implementation", "config.json")).deliverablesDocument, ".wefter/specs/releases/01_mvp/DELIVERABLES.md");
  assert.ok(readJson(path.join(target, ".wefter", "workflows", "delivery-implementation", "config.json")).sourceDocs.include.includes(".wefter/specs/**/*.md"));
  assert.ok(!fs.existsSync(path.join(target, ".wefter", "workflows", "delivery-implementation", "lenses.json")));
  assert.equal(readJson(path.join(target, "opencode.json")).command["wefter-run-delivery"].agent, "wefter-delivery-orchestrator");
  assert.equal(readJson(path.join(target, "opencode.json")).command["wefter-run-work-unit"], undefined);
  assert.equal(readJson(path.join(target, "opencode.json")).command["wefter-shape-product"].agent, "wefter-product-orchestrator");
  assert.match(fs.readFileSync(path.join(target, ".opencode", "agent", "wefter-product-orchestrator.md"), "utf8"), /product validate\*/);

  const doctor = run(["doctor", "--target", target]);
  assert.match(doctor.stdout, /Wefter installation looks healthy/);
});

test("uninstall removes manifest-recorded files and opencode entries", () => {
  const target = initTarget("uninstall");

  const dry = run(["uninstall", "--target", target, "--dry-run"]);
  assert.match(dry.stdout, /Would remove Wefter-managed files/);
  assert.ok(fs.existsSync(path.join(target, "wefter.config.json")));

  run(["uninstall", "--target", target, "--yes"]);
  assert.ok(!fs.existsSync(path.join(target, "wefter.config.json")));
  assert.ok(!fs.existsSync(path.join(target, ".wefter", "install-manifest.json")));
  assert.ok(!fs.existsSync(path.join(target, ".opencode", "agent", "wefter-product-orchestrator.md")));

  const opencode = readJson(path.join(target, "opencode.json"));
  assert.equal(opencode.command?.["wefter-audit-docs"], undefined);
  assert.equal(opencode.command?.["wefter-run-delivery"], undefined);
  assert.equal(opencode.command?.["wefter-shape-product"], undefined);
  assert.ok(!opencode.skills?.paths?.includes(".opencode/skills"));
});

test("uninstall keeps manifest when modified files are skipped", () => {
  const target = initTarget("uninstall-modified");
  writeText(path.join(target, "wefter.config.json"), `${fs.readFileSync(path.join(target, "wefter.config.json"), "utf8")}\n`);

  const result = run(["uninstall", "--target", target, "--yes"]);
  assert.match(result.stdout, /modified; use --force to remove/);
  assert.match(result.stdout, /Kept \.wefter\/install-manifest\.json/);
  assert.ok(fs.existsSync(path.join(target, "wefter.config.json")));
  assert.ok(fs.existsSync(path.join(target, ".wefter", "install-manifest.json")));

  run(["uninstall", "--target", target, "--yes", "--force"]);
  assert.ok(!fs.existsSync(path.join(target, "wefter.config.json")));
  assert.ok(!fs.existsSync(path.join(target, ".wefter", "install-manifest.json")));
});

test("version flag reports package version", () => {
  assert.equal(run(["--version"]).stdout.trim(), "0.4.0");
});

test("unknown command flags are rejected", () => {
  const target = initTarget("unknown-flags");

  assert.match(run(["docs", "audit", "--target", target, "--passes", "1"], { expectFailure: true }).stderr, /Unsupported option --passes/);
  assert.match(run(["product", "shape", "--target", target, "--work-unit-id", "0"], { expectFailure: true }).stderr, /Unsupported option --work-unit-id/);
  assert.match(run(["work-unit", "run", "--target", target], { expectFailure: true }).stderr, /Unknown command/);
  assert.match(run(["work-unit", "guard", "--target", target], { expectFailure: true }).stderr, /Unknown command/);
  assert.match(run(["delivery", "run", "--target", target, "--work-units-document", "docs/releases/01_mvp/WORK_UNITS.md"], { expectFailure: true }).stderr, /Unsupported option --work-units-document/);
});

test("documented command flags remain accepted by the command allowlist", () => {
  const target = initTarget("known-flags");
  const auditProfile = ".wefter/workflows/documentation-audit/profile.json";
  const productConfig = ".wefter/workflows/product-shaping/config.json";
  const productProfile = ".wefter/workflows/product-shaping/profile.json";
  const deliveryConfig = ".wefter/workflows/delivery-implementation/config.json";
  const deliveryProfile = ".wefter/workflows/delivery-implementation/profile.json";
  const reportPath = path.join(".audit", "wefter", "documentation-audit", "flag-run", "final", "final-documentation-audit-report.md");
  const importProfilePath = path.join("docs", "audits", "import.json");
  writeText(path.join(target, reportPath), "# Final Documentation Audit Report\n");
  writeJsonFile(path.join(target, importProfilePath), smallProfile("Import flags"));
  prepareValidProductHandoff(target, "known-product-run");

  run(["docs", "audit", "--target", target, "--profile-path", auditProfile, "--run-name", "docs-flags", "--passes-per-lens", "1", "--max-audits", "1", "--dry-run"]);
  run(["new-run", "documentation-audit", "--target", target, "--profile-path", auditProfile, "--run-name", "new-run-flags", "--passes-per-lens", "1", "--max-audits", "1", "--dry-run"]);
  run(["docs", "repair", "--target", target, "--audit-report", reportPath, "--run-name", "repair-flags", "--dry-run"]);
  run(["product", "shape", "--target", target, "--release-id", "02_patch", "--run-name", "product-flags", "--spec-root", ".wefter/specs", "--run-root", ".wefter/runs/product-shaping", "--config-path", productConfig, "--profile-path", productProfile, "--dry-run"]);
  run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--release-id", "01_mvp", "--product-run-id", "known-product-run", "--run-name", "delivery-flags", "--passes-per-lens", "1", "--max-audits", "1", "--config-path", deliveryConfig, "--profile-path", deliveryProfile, "--dry-run"]);
  run(["profile", "import", "--target", target, "--source", importProfilePath, "--force"]);
  run(["profile", "scaffold", "--target", target, "--force"]);
  run(["doctor", "--target", target]);
  run(["uninstall", "--target", target, "--dry-run"]);

  const validate = run(["product", "validate", "--target", target, "--release-id", "01_mvp", "--run-id", "missing-run", "--config-path", productConfig, "--json"], { expectFailure: true });
  assert.doesNotMatch(validate.stderr, /Unsupported option/);
  const deliveryGuard = run(["delivery", "guard", "--target", target, "--run-id", "missing-run", "--mode", "Status", "--config-path", deliveryConfig, "--json"], { expectFailure: true });
  assert.doesNotMatch(deliveryGuard.stderr, /Unsupported option/);
});

test("product shaping can be explicitly disabled", () => {
  const target = initTarget("product-disabled");
  setProductShapingEnabled(target, false);

  assert.match(run(["product", "shape", "--target", target, "--run-name", "blocked"], { expectFailure: true }).stderr, /Workflow 'product-shaping' is disabled/);
  assert.match(run(["product", "validate", "--target", target], { expectFailure: true }).stderr, /Workflow 'product-shaping' is disabled/);
});

test("product shape dry-run, real run, and validate gate behave as expected", () => {
  const target = initTarget("product-shape");

  const dry = run(["product", "shape", "--target", target, "--run-name", "product-dry", "--dry-run"]);
  assert.match(dry.stdout, /Required product spec files: 17/);
  assert.match(dry.stdout, /Output root: \.wefter\/runs\/product-shaping\/product-dry/);

  run(["product", "shape", "--target", target, "--run-name", "product-run"]);
  const runRoot = path.join(target, ".wefter", "runs", "product-shaping", "product-run");
  const manifest = readJson(path.join(runRoot, "manifest.json"));
  assert.equal(manifest.workflowId, "product-shaping");
  assert.equal(manifest.paths.specRoot, ".wefter/specs");
  assert.equal(manifest.outputs.adversarialReview, ".wefter/runs/product-shaping/product-run/review/adversarial-review.md");
  assert.equal(manifest.outputs.finalValidation, ".wefter/runs/product-shaping/product-run/final/product-shaping-validation.md");
  assert.equal(manifest.handoff.deliverables, ".wefter/specs/releases/01_mvp/DELIVERABLES.md");
  assert.equal(manifest.gate.status, "pending");
  assert.equal(manifest.counts.requiredFiles, 17);
  assert.equal(manifest.prompts.length, 8);
  assert.ok(fs.existsSync(path.join(runRoot, "prompts", "product-validator-prompt.md")));
  assertNoTemplatePlaceholders(path.join(runRoot, "prompts"));

  const validate = run(["product", "validate", "--target", target, "--run-id", "product-run", "--json"], { expectFailure: true });
  assert.match(validate.stdout, /"ok": false/);
  assert.match(validate.stdout, /Missing required product spec/);
});

test("product validate enforces deliverable readiness and gate evidence", () => {
  const target = initTarget("product-gate");
  run(["product", "shape", "--target", target, "--run-name", "gate-run"]);
  writeMinimalProductSpecs(target, "01_mvp", "candidate");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "gate-run", "review", "adversarial-review.md"), "# Review\n\nStatus: pass\nBlocking findings: none\n");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "gate-run", "final", "product-shaping-validation.md"), "# Final Validation\n\nStatus: pass\nReady for delivery implementation: yes\n");

  const nonReady = run(["product", "validate", "--target", target, "--run-id", "gate-run", "--json"], { expectFailure: true });
  assert.match(nonReady.stdout, /contains non-ready status 'candidate'/);

  writeMinimalProductSpecs(target, "01_mvp", "ready");
  fs.unlinkSync(path.join(target, ".wefter", "runs", "product-shaping", "gate-run", "final", "product-shaping-validation.md"));
  const missingEvidence = run(["product", "validate", "--target", target, "--run-id", "gate-run", "--json"], { expectFailure: true });
  assert.match(missingEvidence.stdout, /Missing final validation evidence/);

  writeText(path.join(target, ".wefter", "runs", "product-shaping", "gate-run", "final", "product-shaping-validation.md"), "# Final Validation\n\nStatus: pass\nReady for delivery implementation: yes\n");
  const pass = run(["product", "validate", "--target", target, "--run-id", "gate-run", "--json"]);
  assert.match(pass.stdout, /"ok": true/);

  const productConfigPath = path.join(target, ".wefter", "workflows", "product-shaping", "config.json");
  const productConfig = readJson(productConfigPath);
  productConfig.completionGate.requireFinalValidation = false;
  writeJsonFile(productConfigPath, productConfig);
  const disabledGate = run(["product", "validate", "--target", target, "--run-id", "gate-run", "--json"], { expectFailure: true });
  assert.match(disabledGate.stderr, /requireFinalValidation must be true/);
  productConfig.completionGate.requireFinalValidation = true;
  writeJsonFile(productConfigPath, productConfig);

  const manifestPath = path.join(target, ".wefter", "runs", "product-shaping", "gate-run", "manifest.json");
  const manifest = readJson(manifestPath);
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "other-run", "final", "product-shaping-validation.md"), "# Final Validation\n\nStatus: pass\nReady for delivery implementation: yes\n");
  manifest.outputs.finalValidation = ".wefter/runs/product-shaping/other-run/final/product-shaping-validation.md";
  writeJsonFile(manifestPath, manifest);
  const outsideEvidence = run(["product", "validate", "--target", target, "--run-id", "gate-run", "--json"], { expectFailure: true });
  assert.match(outsideEvidence.stdout, /final validation evidence must stay inside the selected product-shaping run/);
});

test("product validate accepts heading deliverable fields and blocks task-level details", () => {
  const target = initTarget("product-deliverable-format");
  run(["product", "shape", "--target", target, "--run-name", "format-run"]);
  writeMinimalProductSpecs(target, "01_mvp", "ready");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "format-run", "review", "adversarial-review.md"), "# Review\n\nStatus: pass\nBlocking findings: none\n");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "format-run", "final", "product-shaping-validation.md"), "# Final Validation\n\nStatus: pass\nReady for delivery implementation: yes\n");

  const deliverablesPath = path.join(target, ".wefter", "specs", "releases", "01_mvp", "DELIVERABLES.md");
  writeText(deliverablesPath, `# Deliverables\n\n## Deliverable 00: Scoped outcome\n\nStatus: ready\nType: functional\n\n### Goal\nDeliver the scoped outcome.\n\n### Scope\nIncluded release behavior.\n\n### Out Of Scope\nDeferred behavior.\n\n### Dependencies\nNone.\n\n### Source Docs\nSCOPE.md, DOMAIN_SPEC.md, ACCEPTANCE_CRITERIA.md.\n\n### Acceptance Criteria\nRelease criteria are satisfied.\n\n### Risk Areas\nDatabase migration risk.\n\n### Human Gate Triggers\nScope or domain ambiguity.\n\n### Expected Verification\nRun release validation.\n`);
  assert.match(run(["product", "validate", "--target", target, "--run-id", "format-run", "--json"]).stdout, /"ok": true/);

  writeText(deliverablesPath, `# Deliverables\n\n## Deliverable 001: Scoped outcome\n\nStatus: ready\nGoal: Deliver the scoped outcome.\nScope: Included release behavior.\nOut of scope: Deferred behavior.\nDependencies: None.\nSource docs: SCOPE.md, DOMAIN_SPEC.md, ACCEPTANCE_CRITERIA.md.\nAcceptance criteria: Release criteria are satisfied.\nRisk areas: None known.\nHuman gate triggers: Scope or domain ambiguity.\nExpected verification: Run release validation.\n\n\`\`\`js\nconsole.log("implementation");\n\`\`\`\n`);
  const codeFence = run(["product", "validate", "--target", target, "--run-id", "format-run", "--json"], { expectFailure: true });
  assert.match(codeFence.stdout, /task-level implementation detail/);
});

test("product validate requires stable deliverable sections", () => {
  const target = initTarget("product-deliverable-stable-id");
  run(["product", "shape", "--target", target, "--run-name", "stable-id-run"]);
  writeMinimalProductSpecs(target, "01_mvp", "ready");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "stable-id-run", "review", "adversarial-review.md"), "# Review\n\nStatus: pass\nBlocking findings: none\n");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "stable-id-run", "final", "product-shaping-validation.md"), "# Final Validation\n\nStatus: pass\nReady for delivery implementation: yes\n");

  const deliverablesPath = path.join(target, ".wefter", "specs", "releases", "01_mvp", "DELIVERABLES.md");
  writeText(deliverablesPath, "# Deliverables\n\nStatus: ready\n");
  const topLevelStatus = run(["product", "validate", "--target", target, "--run-id", "stable-id-run", "--json"], { expectFailure: true });
  assert.match(topLevelStatus.stdout, /Status lines but no deliverable sections with stable ids/);

  writeText(deliverablesPath, `# Deliverables\n\n## D001\n\nStatus: ready\nGoal: Deliver the scoped outcome.\nScope: Included release behavior.\nOut of scope: Deferred behavior.\nDependencies: None.\nSource docs: SCOPE.md, DOMAIN_SPEC.md, ACCEPTANCE_CRITERIA.md.\nAcceptance criteria: Release criteria are satisfied.\nRisk areas: None known.\nHuman gate triggers: Scope or domain ambiguity.\nExpected verification: Run release validation.\n`);
  const missingStableId = run(["product", "validate", "--target", target, "--run-id", "stable-id-run", "--json"], { expectFailure: true });
  assert.match(missingStableId.stdout, /no deliverable sections with stable ids/);
});

test("product validate blocks deferred release-blocking questions", () => {
  const target = initTarget("product-deferred-question");
  run(["product", "shape", "--target", target, "--run-name", "question-run"]);
  writeMinimalProductSpecs(target, "01_mvp", "ready");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "question-run", "review", "adversarial-review.md"), "# Review\n\nStatus: pass\nBlocking findings: none\n");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "question-run", "final", "product-shaping-validation.md"), "# Final Validation\n\nStatus: pass\nReady for delivery implementation: yes\n");

  writeText(path.join(target, ".wefter", "specs", "discovery", "OPEN_QUESTIONS.md"), "# Open Questions\n\n## Q001\n\nBlocks target release: yes\nStatus: deferred\n");
  const deferredBlocker = run(["product", "validate", "--target", target, "--run-id", "question-run", "--json"], { expectFailure: true });
  assert.match(deferredBlocker.stdout, /unresolved release-blocking question/);
});

test("product validate requires explicit zero-reference statement", () => {
  const target = initTarget("product-references");
  run(["product", "shape", "--target", target, "--run-name", "references-run"]);
  writeMinimalProductSpecs(target, "01_mvp", "ready");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "references-run", "review", "adversarial-review.md"), "# Review\n\nStatus: pass\nBlocking findings: none\n");
  writeText(path.join(target, ".wefter", "runs", "product-shaping", "references-run", "final", "product-shaping-validation.md"), "# Final Validation\n\nStatus: pass\nReady for delivery implementation: yes\n");

  writeText(path.join(target, ".wefter", "specs", "references", "README.md"), "# References\n\nReference map is empty.\n");
  const missingStatement = run(["product", "validate", "--target", target, "--run-id", "references-run", "--json"], { expectFailure: true });
  assert.match(missingStatement.stdout, /must explicitly state when no individual reference files are used/);

  writeText(path.join(target, ".wefter", "specs", "references", "README.md"), "# References\n\n- references/example.md\n");
  const missingListedFile = run(["product", "validate", "--target", target, "--run-id", "references-run", "--json"], { expectFailure: true });
  assert.match(missingListedFile.stdout, /lists missing reference file 'references\/example\.md'/);

  writeText(path.join(target, ".wefter", "specs", "references", "example.md"), "# Example\n");
  assert.match(run(["product", "validate", "--target", target, "--run-id", "references-run", "--json"]).stdout, /"ok": true/);

  writeText(path.join(target, ".wefter", "specs", "references", "unlisted.md"), "# Unlisted\n");
  const unlistedFile = run(["product", "validate", "--target", target, "--run-id", "references-run", "--json"], { expectFailure: true });
  assert.match(unlistedFile.stdout, /must list individual reference file 'references\/unlisted\.md'/);
});

test("docs repair dry-run and real run generate expected artifacts", () => {
  const target = initTarget("docs-repair");
  const reportPath = path.join(".audit", "wefter", "documentation-audit", "audit-run", "final", "final-documentation-audit-report.md");
  writeText(path.join(target, reportPath), "# Final Documentation Audit Report\n\n## Validated Findings\n\n- F-001\n");

  const dry = run(["docs", "repair", "--target", target, "--audit-report", reportPath, "--run-name", "repair-dry", "--dry-run"]);
  assert.match(dry.stdout, /Run name: repair-dry/);
  assert.match(dry.stdout, /Audit report:/);

  run(["docs", "repair", "--target", target, "--audit-report", reportPath, "--run-name", "repair-run"]);
  const manifest = readJson(path.join(target, ".audit", "wefter", "documentation-repair", "repair-run", "manifest.json"));
  assert.equal(manifest.workflowId, "documentation-repair");
  assert.equal(manifest.auditReport, reportPath.replaceAll("\\", "/"));
  assert.ok(fs.existsSync(path.join(target, ".audit", "wefter", "documentation-repair", "repair-run", "prompts", "plan-repair.md")));
  assert.ok(fs.existsSync(path.join(target, ".audit", "wefter", "documentation-repair", "repair-run", "prompts", "apply-repair.md")));
  assert.ok(fs.existsSync(path.join(target, ".audit", "wefter", "documentation-repair", "repair-run", "prompts", "review-repair.md")));
});

test("docs audit dry-run and real run generate expected artifacts", () => {
  const target = initTarget("docs-audit");

  const dry = run(["docs", "audit", "--target", target, "--run-name", "audit-dry", "--passes-per-lens", "1", "--max-audits", "2", "--dry-run"]);
  assert.match(dry.stdout, /Auditor prompts to generate: 2/);

  run(["docs", "audit", "--target", target, "--run-name", "audit-run", "--passes-per-lens", "1", "--max-audits", "2"]);
  const manifest = readJson(path.join(target, ".audit", "wefter", "documentation-audit", "audit-run", "manifest.json"));
  assert.equal(manifest.workflowId, "documentation-audit");
  assert.equal(manifest.auditorPromptPath, ".wefter/workflows/documentation-audit/templates/auditor-prompt.md");
  assert.equal(manifest.prompts.length, 2);
  const prompt = fs.readFileSync(path.join(target, ".audit", "wefter", "documentation-audit", "audit-run", "prompts", "auditors", "A0001__documentation-map-consistency__explicit-contradictions__p01.md"), "utf8");
  assert.match(prompt, /# Individual Documentation Audit/);
  assert.match(prompt, /runtime prevents writing/);
  const readme = fs.readFileSync(path.join(target, ".audit", "wefter", "documentation-audit", "audit-run", "README.md"), "utf8");
  assert.match(readme, /Do not execute this run in plan mode/);
  assert.match(readme, /exact prompt and output paths/);
  assert.match(readme, /wildcard or glob patterns/);
  assert.ok(fs.existsSync(path.join(target, ".audit", "wefter", "documentation-audit", "audit-run", "prompts", "consolidate.md")));
});

test("profile import and docs audit profile override preserve custom audit profiles", () => {
  const target = initTarget("profile-import");
  const sourceProfilePath = path.join("docs", "audits", "lenses.json");
  const overrideProfilePath = path.join("docs", "audits", "override.json");
  const overridePromptPath = path.join("docs", "audits", "custom-auditor-prompt.md");
  writeJsonFile(path.join(target, sourceProfilePath), smallProfile("Imported lens"));
  const overrideProfile = smallProfile("Override lens");
  overrideProfile.auditorPromptPath = overridePromptPath.replaceAll("\\", "/");
  writeJsonFile(path.join(target, overrideProfilePath), overrideProfile);
  writeText(path.join(target, overridePromptPath), "# Custom Workflow Self Audit\n\nRun: {{RUN_ID}}\nOutput: {{OUTPUT_FILE}}\nLens: {{LENS_FOCUS}}\nVariant: {{VARIANT_INSTRUCTION}}\n");

  run(["profile", "import", "--target", target, "--source", sourceProfilePath, "--force"]);
  assert.equal(readJson(path.join(target, ".wefter", "workflows", "documentation-audit", "profile.json")).lenses[0].title, "Imported lens");

  const dry = run(["docs", "audit", "--target", target, "--profile-path", overrideProfilePath, "--run-name", "override-dry", "--passes-per-lens", "1", "--dry-run"]);
  assert.match(dry.stdout, /Auditor prompts to generate: 1/);

  run(["docs", "audit", "--target", target, "--profile-path", overrideProfilePath, "--run-name", "override-run", "--passes-per-lens", "1"]);
  const manifest = readJson(path.join(target, ".audit", "wefter", "documentation-audit", "override-run", "manifest.json"));
  assert.equal(manifest.profilePath, overrideProfilePath.replaceAll("\\", "/"));
  assert.equal(manifest.auditorPromptPath, overridePromptPath.replaceAll("\\", "/"));
  assert.equal(manifest.prompts.length, 1);
  assert.match(fs.readFileSync(path.join(target, ".audit", "wefter", "documentation-audit", "override-run", "prompts", "auditors", "A0001__one-lens__one-variant__p01.md"), "utf8"), /# Custom Workflow Self Audit/);
});

test("delivery run dry-run and real run generate expected artifacts", () => {
  const target = initTarget("delivery-run-artifacts");
  const profilePath = path.join("docs", "delivery-profile.json");
  writeJsonFile(path.join(target, profilePath), smallDeliveryProfile());
  prepareValidProductHandoff(target, "delivery-artifacts-product");

  const dry = run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--product-run-id", "delivery-artifacts-product", "--run-name", "delivery-dry", "--profile-path", profilePath, "--passes-per-lens", "1", "--max-audits", "2", "--dry-run"]);
  assert.match(dry.stdout, /Delivery unit: delivery-unit-00/);
  assert.match(dry.stdout, /Plan auditor prompts to generate: 1/);

  run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--product-run-id", "delivery-artifacts-product", "--run-name", "delivery-artifacts", "--profile-path", profilePath, "--passes-per-lens", "1", "--max-audits", "2"]);
  const manifest = readJson(path.join(target, ".audit", "wefter", "delivery-implementation", "delivery-artifacts", "manifest.json"));
  assert.equal(manifest.workflowId, "delivery-implementation");
  assert.equal(manifest.deliveryUnitKey, "delivery-unit-00");
  assert.equal(manifest.profilePath, profilePath.replaceAll("\\", "/"));
  assert.equal(manifest.prompts.planAudits.length, 1);
  assert.ok(fs.existsSync(path.join(target, ".audit", "wefter", "delivery-implementation", "delivery-artifacts", "prompts", "plan.md")));
  assertNoLegacyWorkUnitVocabulary(path.join(target, ".audit", "wefter", "delivery-implementation", "delivery-artifacts", "prompts"));
  assert.match(fs.readFileSync(path.join(target, ".audit", "wefter", "delivery-implementation", "delivery-artifacts", "prompts", "implement-tasks.md"), "utf8"), new RegExp(`${readJson(path.join(target, "wefter.config.json")).runnerCommand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} delivery guard`));
  const readme = fs.readFileSync(path.join(target, ".audit", "wefter", "delivery-implementation", "delivery-artifacts", "README.md"), "utf8");
  assert.match(readme, new RegExp(`${readJson(path.join(target, "wefter.config.json")).runnerCommand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} delivery guard`));
  assert.match(readme, /ReadyForReview/);
  assert.match(readme, /ReadyForNextTask/);
  assert.match(readme, /ReadyForFinalValidation/);
});

test("delivery run rejects public work-unit flag aliases", () => {
  const target = initTarget("delivery-run");
  const profilePath = path.join("docs", "delivery-profile.json");
  writeJsonFile(path.join(target, profilePath), smallDeliveryProfile("One delivery lens"));
  prepareValidProductHandoff(target, "delivery-run-product");

  const dry = run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--product-run-id", "delivery-run-product", "--run-name", "delivery-dry", "--profile-path", profilePath, "--passes-per-lens", "1", "--max-audits", "1", "--dry-run"]);
  assert.match(dry.stdout, /Delivery unit: delivery-unit-00/);

  run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--product-run-id", "delivery-run-product", "--run-name", "delivery-run", "--profile-path", profilePath, "--passes-per-lens", "1", "--max-audits", "1"]);
  const manifest = readJson(path.join(target, ".audit", "wefter", "delivery-implementation", "delivery-run", "manifest.json"));
  assert.equal(manifest.workflowId, "delivery-implementation");
  assert.equal(manifest.deliveryUnitKey, "delivery-unit-00");
  assert.match(fs.readFileSync(path.join(target, ".audit", "wefter", "delivery-implementation", "delivery-run", "prompts", "plan.md"), "utf8"), /delivery-unit-00/);

  const legacyFlag = run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--work-unit-id", "0", "--run-name", "legacy-flag", "--dry-run"], { expectFailure: true });
  assert.match(legacyFlag.stderr, /Unsupported option --work-unit-id/);
  const missingDeliverable = run(["delivery", "run", "--target", target, "--deliverable-id", "missing", "--product-run-id", "delivery-run-product", "--run-name", "missing-deliverable", "--profile-path", profilePath, "--passes-per-lens", "1", "--max-audits", "1", "--dry-run"], { expectFailure: true });
  assert.match(missingDeliverable.stderr, /is not present/);
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--product-run-id", "delivery-run-product", "--run-name", "bad-passes", "--profile-path", profilePath, "--passes-per-lens", "1.5", "--max-audits", "1", "--dry-run"], { expectFailure: true }).stderr, /--passes-per-lens must be an integer/);
});

test("delivery run matches zero-padded numeric deliverable ids", () => {
  const target = initTarget("delivery-padded-id");
  prepareValidProductHandoff(target, "padded-product-run");
  writeText(path.join(target, ".wefter", "specs", "releases", "01_mvp", "DELIVERABLES.md"), `# Deliverables

## Deliverable 001: Scoped outcome

Status: ready
Goal: Deliver the scoped outcome.
Scope: Included release behavior.
Out of scope: Deferred behavior.
Dependencies: None.
Source docs: SCOPE.md, DOMAIN_SPEC.md, ACCEPTANCE_CRITERIA.md.
Acceptance criteria: Release criteria are satisfied.
Risk areas: None known.
Human gate triggers: Scope or domain ambiguity.
Expected verification: Run release validation.
`);

  const dry = run(["delivery", "run", "--target", target, "--deliverable-id", "1", "--product-run-id", "padded-product-run", "--run-name", "padded-dry", "--passes-per-lens", "1", "--max-audits", "1", "--dry-run"]);
  assert.match(dry.stdout, /Delivery unit: delivery-unit-01/);
});

test("delivery run records product DELIVERABLES.md handoff override", () => {
  const target = initTarget("delivery-deliverables");
  const handoff = ".wefter/specs/releases/01_mvp/DELIVERABLES.md";
  prepareValidProductHandoff(target, "product-handoff-run");

  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--run-name", "blocked-default", "--passes-per-lens", "1", "--max-audits", "1"], { expectFailure: true }).stderr, /requires --product-run-id or --product-run-root/);
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--deliverables-document", handoff, "--run-name", "blocked-handoff", "--passes-per-lens", "1", "--max-audits", "1"], { expectFailure: true }).stderr, /requires --product-run-id or --product-run-root/);
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--deliverables-document", ".wefter/specs/releases/01_mvp/./DELIVERABLES.md", "--run-name", "blocked-dot-handoff", "--passes-per-lens", "1", "--max-audits", "1"], { expectFailure: true }).stderr, /requires --product-run-id or --product-run-root/);
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--deliverables-document", ".wefter/specs/releases/other/DELIVERABLES.md", "--run-name", "wrong-handoff", "--passes-per-lens", "1", "--max-audits", "1"], { expectFailure: true }).stderr, /must use the configured DELIVERABLES\.md path/);

  run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--deliverables-document", handoff, "--product-run-id", "product-handoff-run", "--run-name", "handoff-run", "--passes-per-lens", "1", "--max-audits", "1"]);
  const runRoot = path.join(target, ".audit", "wefter", "delivery-implementation", "handoff-run");
  const manifest = readJson(path.join(runRoot, "manifest.json"));
  assert.equal(manifest.deliverablesDocument, handoff);
  assert.match(fs.readFileSync(path.join(runRoot, "prompts", "plan.md"), "utf8"), /\.wefter\/specs\/releases\/01_mvp\/DELIVERABLES\.md/);
  assert.match(fs.readFileSync(path.join(runRoot, "README.md"), "utf8"), /\.wefter\/specs\/releases\/01_mvp\/DELIVERABLES\.md/);
});

test("delivery handoff gate normalizes configured product paths", () => {
  const target = initTarget("delivery-normalized-handoff");
  prepareValidProductHandoff(target, "normalized-product-run");
  const productConfigPath = path.join(target, ".wefter", "workflows", "product-shaping", "config.json");
  const productConfig = readJson(productConfigPath);
  productConfig.specRoot = ".wefter/./specs";
  writeJsonFile(productConfigPath, productConfig);
  const deliveryConfigPath = path.join(target, ".wefter", "workflows", "delivery-implementation", "config.json");
  const deliveryConfig = readJson(deliveryConfigPath);
  deliveryConfig.deliverablesDocument = ".wefter/specs/releases/01_mvp/./DELIVERABLES.md";
  writeJsonFile(deliveryConfigPath, deliveryConfig);

  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--run-name", "normalized-blocked", "--passes-per-lens", "1", "--max-audits", "1"], { expectFailure: true }).stderr, /requires --product-run-id or --product-run-root/);
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--product-run-id", "normalized-product-run", "--run-name", "normalized-pass", "--passes-per-lens", "1", "--max-audits", "1", "--dry-run"]).stdout, /Delivery unit: delivery-unit-00/);
});

test("delivery handoff gate respects custom product spec root", () => {
  const target = initTarget("delivery-custom-spec-root");
  const customSpecRoot = "custom/specs";

  run(["product", "shape", "--target", target, "--release-id", "01_mvp", "--run-name", "custom-product-run", "--spec-root", customSpecRoot]);
  writeMinimalProductSpecs(target, "01_mvp", "ready", customSpecRoot);
  writeProductGateEvidence(target, "custom-product-run");

  const customHandoff = "custom/specs/releases/01_mvp/DELIVERABLES.md";
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--deliverables-document", customHandoff, "--run-name", "custom-blocked", "--passes-per-lens", "1", "--max-audits", "1"], { expectFailure: true }).stderr, /requires --product-run-id or --product-run-root/);
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--deliverables-document", "custom/specs/releases/other/DELIVERABLES.md", "--run-name", "custom-wrong", "--passes-per-lens", "1", "--max-audits", "1"], { expectFailure: true }).stderr, /must use the configured DELIVERABLES\.md path/);
  run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--deliverables-document", customHandoff, "--product-run-id", "custom-product-run", "--run-name", "custom-pass", "--passes-per-lens", "1", "--max-audits", "1"]);
  const prompt = fs.readFileSync(path.join(target, ".audit", "wefter", "delivery-implementation", "custom-pass", "prompts", "plan.md"), "utf8");
  assert.match(prompt, /custom\/specs\/\*\*\/\*\.md/);
  assert.doesNotMatch(prompt, /\.wefter\/specs\/\*\*\/\*\.md/);
});

test("delivery handoff gate rejects product evidence from another spec root", () => {
  const target = initTarget("delivery-spec-root-mismatch");
  prepareValidProductHandoff(target, "default-product-run");
  const customHandoff = "custom/specs/releases/01_mvp/DELIVERABLES.md";
  writeMinimalProductSpecs(target, "01_mvp", "ready", "custom/specs");

  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--deliverables-document", customHandoff, "--product-run-id", "default-product-run", "--run-name", "mismatched-evidence", "--passes-per-lens", "1", "--max-audits", "1", "--dry-run"], { expectFailure: true }).stderr, /does not match requested spec root 'custom\/specs'/);
});

test("delivery run release override rebases release-scoped paths", () => {
  const target = initTarget("delivery-release-override");
  prepareValidProductHandoff(target, "release-override-product", "02_patch");

  run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--release-id", "02_patch", "--product-run-id", "release-override-product", "--run-name", "release-override", "--passes-per-lens", "1", "--max-audits", "1"]);
  const manifest = readJson(path.join(target, ".audit", "wefter", "delivery-implementation", "release-override", "manifest.json"));
  assert.equal(manifest.releaseId, "02_patch");
  assert.equal(manifest.deliverablesDocument, ".wefter/specs/releases/02_patch/DELIVERABLES.md");
  assert.equal(manifest.paths.versionedDeliveryDir, "docs/releases/02_patch/execution/delivery-unit-00");
  assert.equal(manifest.paths.versionedDecisionLog, "docs/releases/02_patch/decisions/delivery-unit-00-decisions.md");
  assert.match(fs.readFileSync(path.join(target, ".audit", "wefter", "delivery-implementation", "release-override", "prompts", "plan.md"), "utf8"), /\.wefter\/specs\/releases\/02_patch\/DELIVERABLES\.md/);
});

test("delivery commands respect disabled workflow setting", () => {
  const target = initTarget("delivery-disabled");
  const configPath = path.join(target, "wefter.config.json");
  const config = readJson(configPath);
  config.workflows["delivery-implementation"].enabled = false;
  writeJsonFile(configPath, config);
  writeText(path.join(target, ".wefter", "workflows", "delivery-implementation", "config.json"), "{ invalid json\n");
  writeText(path.join(target, ".wefter", "workflows", "delivery-implementation", "profile.json"), "{ invalid json\n");

  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--dry-run"], { expectFailure: true }).stderr, /Workflow 'delivery-implementation' is disabled/);
  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "missing-run", "--mode", "Status"], { expectFailure: true }).stderr, /Workflow 'delivery-implementation' is disabled/);
  const reinit = run(["init", "--target", target, "--yes", "--force"]);
  assert.equal(readJson(configPath).workflows["delivery-implementation"].enabled, false);
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--dry-run"], { expectFailure: true }).stderr, /Workflow 'delivery-implementation' is disabled/);
  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "missing-run", "--mode", "Status"], { expectFailure: true }).stderr, /Workflow 'delivery-implementation' is disabled/);
  assert.equal(readJson(path.join(target, "opencode.json")).command["wefter-run-delivery"], undefined);
  assert.ok(!fs.existsSync(path.join(target, ".opencode", "agent", "wefter-delivery-orchestrator.md")));
  assert.ok(!fs.existsSync(path.join(target, ".opencode", "skills", "delivery-implementation", "SKILL.md")));
  assert.doesNotMatch(reinit.stdout, /wefter-run-delivery/);
  fs.rmSync(path.join(target, ".wefter", "workflows", "delivery-implementation", "config.json"), { force: true });
  fs.rmSync(path.join(target, ".wefter", "workflows", "delivery-implementation", "profile.json"), { force: true });
  assert.match(run(["doctor", "--target", target]).stdout, /Wefter installation looks healthy/);
});

test("delivery guard enforces task review loop", () => {
  const target = initTarget("guard");
  prepareValidProductHandoff(target, "guard-product-run");
  run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--product-run-id", "guard-product-run", "--run-name", "guard-run", "--passes-per-lens", "1", "--max-audits", "1"]);

  const specsRoot = path.join(target, "docs", "releases", "01_mvp", "execution", "delivery-unit-00", "task-specs");
  const logsRoot = path.join(target, ".audit", "wefter", "delivery-implementation", "guard-run", "implementation", "task-logs");
  const reviewsRoot = path.join(target, ".audit", "wefter", "delivery-implementation", "guard-run", "implementation", "task-reviews");
  const runRoot = path.join(target, ".audit", "wefter", "delivery-implementation", "guard-run");
  writeText(path.join(specsRoot, "T00-001.md"), "# T00-001: First\n");
  writeText(path.join(specsRoot, "T00-002.md"), "# T00-002: Second\n");
  writeText(path.join(logsRoot, "T00-001.md"), "# T00-001 Implementation Log\n");

  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "guard-run", "--run-root", path.join(".audit", "wefter", "delivery-implementation", "guard-run"), "--mode", "Status"], { expectFailure: true }).stderr, /Use either --run-id or --run-root/);
  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "guard-run", "--mode", "Status"]).stdout, /Action: ReviewTask/);
  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "guard-run", "--task-id", "T00-001", "--mode", "ReadyForReview"]).stdout, /Action: ReviewTask/);

  writeText(path.join(reviewsRoot, "T00-001.md"), `# T00-001 Review\n\n## Machine Result\n\n\`\`\`json\n{\n  "taskId": "T00-001",\n  "result": "Pass",\n  "reviewIteration": 1,\n  "blockingFindings": []\n}\n\`\`\`\n`);
  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "guard-run", "--task-id", "T00-001", "--mode", "ReadyForNextTask"]).stdout, /AdvanceToNextTaskOrFinalValidation/);
  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "guard-run", "--mode", "ReadyForFinalValidation"], { expectFailure: true }).stderr, /not ready for final validation/);

  writeText(path.join(logsRoot, "T00-002.md"), "# T00-002 Implementation Log\n");
  writeText(path.join(reviewsRoot, "T00-002.md"), `# T00-002 Review\n\n## Machine Result\n\n\`\`\`json\n{\n  "taskId": "T00-002",\n  "result": "Pass",\n  "reviewIteration": "1x",\n  "blockingFindings": []\n}\n\`\`\`\n`);
  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "guard-run", "--mode", "Status"], { expectFailure: true }).stderr, /reviewIteration.*integer/);
  writeText(path.join(reviewsRoot, "T00-002.md"), `# T00-002 Review\n\n## Machine Result\n\n\`\`\`json\n{\n  "taskId": "T00-002",\n  "result": "Needs Fix",\n  "reviewIteration": 1,\n  "blockingFindings": [1]\n}\n\`\`\`\n`);
  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "guard-run", "--mode", "Status"], { expectFailure: true }).stderr, /blockingFindings\[0\].*string/);
  writeText(path.join(reviewsRoot, "T00-002.md"), `# T00-002 Review\n\n## Machine Result\n\n\`\`\`json\n{\n  "taskId": "T00-002",\n  "result": "Pass",\n  "reviewIteration": 1,\n  "blockingFindings": []\n}\n\`\`\`\n`);
  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "guard-run", "--mode", "ReadyForFinalValidation"], { expectFailure: true }).stderr, /Missing approved delivery plan/);
  writeText(path.join(target, "docs", "releases", "01_mvp", "execution", "delivery-unit-00", "delivery-plan.md"), "# Plan\n");
  writeText(path.join(target, "docs", "releases", "01_mvp", "execution", "delivery-unit-00", "traceability-matrix.md"), "# Traceability\n");
  writeText(path.join(target, "docs", "releases", "01_mvp", "execution", "delivery-unit-00", "verification-plan.md"), "# Verification\n");
  writeText(path.join(target, "docs", "releases", "01_mvp", "decisions", "delivery-unit-00-decisions.md"), "# Decisions\n");
  assert.ok(fs.existsSync(path.join(runRoot, "manifest.json")));
  assert.match(run(["delivery", "guard", "--target", target, "--run-id", "guard-run", "--mode", "ReadyForFinalValidation"]).stdout, /RunFinalDeliveryValidation/);
});

test("path safety rejects traversal and path-like run names", () => {
  const target = initTarget("safety");
  const outside = makeTarget("outside");
  const unsafeAuditProfile = smallProfile("Unsafe auditor prompt path");
  unsafeAuditProfile.auditorPromptPath = "../auditor-prompt.md";
  writeJsonFile(path.join(target, "unsafe-audit-profile.json"), unsafeAuditProfile);

  assert.match(run(["init", "--target", makeTarget("bad-init"), "--yes", "--profile-path", "../profile.json"], { expectFailure: true }).stderr, /must not be empty or contain '\.\.'/);
  assert.match(run(["docs", "audit", "--target", target, "--run-name", "..\\bad"], { expectFailure: true }).stderr, /plain directory name/);
  assert.match(run(["docs", "audit", "--target", target, "--profile-path", "unsafe-audit-profile.json"], { expectFailure: true }).stderr, /must not be empty or contain '\.\.'/);
  assert.match(run(["profile", "import", "--target", target, "--source", "../lenses.json"], { expectFailure: true }).stderr, /must not be empty or contain '\.\.'/);
  assert.match(run(["docs", "repair", "--target", target, "--audit-report", "../audit-report.md"], { expectFailure: true }).stderr, /must not be empty or contain '\.\.'/);
  assert.match(run(["delivery", "run", "--target", target, "--config-path", "../config.json"], { expectFailure: true }).stderr, /must not be empty or contain '\.\.'/);
  assert.match(run(["delivery", "run", "--target", target, "--profile-path", "../profile.json"], { expectFailure: true }).stderr, /must not be empty or contain '\.\.'/);
  assert.match(run(["product", "shape", "--target", target, "--run-name", "..\\bad"], { expectFailure: true }).stderr, /plain directory name/);
  assert.match(run(["product", "shape", "--target", target, "--spec-root", "../specs"], { expectFailure: true }).stderr, /must not be empty or contain '\.\.'/);
  assert.match(run(["product", "validate", "--target", target, "--config-path", "../config.json"], { expectFailure: true }).stderr, /must not be empty or contain '\.\.'/);
  assert.match(run(["delivery", "guard", "--target", target, "--run-root", outside], { expectFailure: true }).stderr, /resolves outside the target repository/);
  const deliveryConfigPath = path.join(target, ".wefter", "workflows", "delivery-implementation", "config.json");
  const deliveryConfig = readJson(deliveryConfigPath);
  deliveryConfig.sourceDocs.include = ["../secret.md"];
  writeJsonFile(deliveryConfigPath, deliveryConfig);
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--dry-run"], { expectFailure: true }).stderr, /sourceDocs\.include\[0\].*contain '\.\.'/);
  deliveryConfig.sourceDocs.include = ["C:/secret.md"];
  writeJsonFile(deliveryConfigPath, deliveryConfig);
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--dry-run"], { expectFailure: true }).stderr, /sourceDocs\.include\[0\].*relative/);
  deliveryConfig.sourceDocs.include = [".wefter/specs/**/*.md"];
  deliveryConfig.defaultPlanAuditPassesPerLens = "2x";
  writeJsonFile(deliveryConfigPath, deliveryConfig);
  assert.match(run(["delivery", "run", "--target", target, "--deliverable-id", "0", "--dry-run"], { expectFailure: true }).stderr, /defaultPlanAuditPassesPerLens must be an integer/);
});
