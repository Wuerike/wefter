import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");
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

function initTarget(name = "target") {
  const target = makeTarget(name);
  run(["init", "--target", target, "--yes", "--force"]);
  return target;
}

test("init installs config, OpenCode files, and doctor passes", () => {
  const target = initTarget("init");

  assert.equal(readJson(path.join(target, "wefter.config.json")).workflows["work-unit-implementation"].status, "available");
  assert.ok(fs.existsSync(path.join(target, ".opencode", "agent", "wefter-doc-audit-orchestrator.md")));
  assert.ok(fs.existsSync(path.join(target, ".opencode", "agent", "wefter-work-unit-orchestrator.md")));
  assert.ok(fs.existsSync(path.join(target, ".opencode", "skills", "work-unit-implementation", "SKILL.md")));

  const doctor = run(["doctor", "--target", target]);
  assert.match(doctor.stdout, /Wefter installation looks healthy/);
});

test("docs audit dry-run and real run generate expected artifacts", () => {
  const target = initTarget("docs-audit");

  const dry = run(["docs", "audit", "--target", target, "--run-name", "audit-dry", "--passes-per-lens", "1", "--max-audits", "2", "--dry-run"]);
  assert.match(dry.stdout, /Auditor prompts to generate: 2/);

  run(["docs", "audit", "--target", target, "--run-name", "audit-run", "--passes-per-lens", "1", "--max-audits", "2"]);
  const manifest = readJson(path.join(target, ".audit", "wefter", "documentation-audit", "audit-run", "manifest.json"));
  assert.equal(manifest.workflowId, "documentation-audit");
  assert.equal(manifest.prompts.length, 2);
  assert.ok(fs.existsSync(path.join(target, ".audit", "wefter", "documentation-audit", "audit-run", "prompts", "consolidate.md")));
});

test("work-unit run dry-run and real run generate expected artifacts", () => {
  const target = initTarget("work-unit-run");

  const dry = run(["work-unit", "run", "--target", target, "--work-unit-id", "0", "--run-name", "wu-dry", "--passes-per-lens", "1", "--max-audits", "2", "--dry-run"]);
  assert.match(dry.stdout, /Work unit: work-unit-00/);
  assert.match(dry.stdout, /Plan auditor prompts to generate: 2/);

  run(["work-unit", "run", "--target", target, "--work-unit-id", "0", "--run-name", "wu-run", "--passes-per-lens", "1", "--max-audits", "2"]);
  const manifest = readJson(path.join(target, ".audit", "wefter", "work-unit-implementation", "wu-run", "manifest.json"));
  assert.equal(manifest.workflowId, "work-unit-implementation");
  assert.equal(manifest.workUnitKey, "work-unit-00");
  assert.equal(manifest.prompts.planAudits.length, 2);
  assert.ok(fs.existsSync(path.join(target, ".audit", "wefter", "work-unit-implementation", "wu-run", "prompts", "plan.md")));
});

test("work-unit guard enforces task review loop", () => {
  const target = initTarget("guard");
  run(["work-unit", "run", "--target", target, "--work-unit-id", "0", "--run-name", "guard-run", "--passes-per-lens", "1", "--max-audits", "1"]);

  const specsRoot = path.join(target, "docs", "releases", "01_mvp", "execution", "work-unit-00", "task-specs");
  const logsRoot = path.join(target, ".audit", "wefter", "work-unit-implementation", "guard-run", "implementation", "task-logs");
  const reviewsRoot = path.join(target, ".audit", "wefter", "work-unit-implementation", "guard-run", "implementation", "task-reviews");
  writeText(path.join(specsRoot, "T00-001.md"), "# T00-001: First\n");
  writeText(path.join(specsRoot, "T00-002.md"), "# T00-002: Second\n");
  writeText(path.join(logsRoot, "T00-001.md"), "# T00-001 Implementation Log\n");

  assert.match(run(["work-unit", "guard", "--target", target, "--run-id", "guard-run", "--mode", "Status"]).stdout, /Action: ReviewTask/);
  assert.match(run(["work-unit", "guard", "--target", target, "--run-id", "guard-run", "--task-id", "T00-001", "--mode", "ReadyForReview"]).stdout, /Action: ReviewTask/);

  writeText(path.join(reviewsRoot, "T00-001.md"), `# T00-001 Review\n\n## Machine Result\n\n\`\`\`json\n{\n  "taskId": "T00-001",\n  "result": "Pass",\n  "reviewIteration": 1,\n  "blockingFindings": []\n}\n\`\`\`\n`);
  assert.match(run(["work-unit", "guard", "--target", target, "--run-id", "guard-run", "--task-id", "T00-001", "--mode", "ReadyForNextTask"]).stdout, /AdvanceToNextTaskOrFinalValidation/);
  assert.match(run(["work-unit", "guard", "--target", target, "--run-id", "guard-run", "--mode", "ReadyForFinalValidation"], { expectFailure: true }).stderr, /not ready for final validation/);

  writeText(path.join(logsRoot, "T00-002.md"), "# T00-002 Implementation Log\n");
  writeText(path.join(reviewsRoot, "T00-002.md"), `# T00-002 Review\n\n## Machine Result\n\n\`\`\`json\n{\n  "taskId": "T00-002",\n  "result": "Pass",\n  "reviewIteration": 1,\n  "blockingFindings": []\n}\n\`\`\`\n`);
  assert.match(run(["work-unit", "guard", "--target", target, "--run-id", "guard-run", "--mode", "ReadyForFinalValidation"]).stdout, /RunFinalWorkUnitValidation/);
});

test("path safety rejects traversal and path-like run names", () => {
  const target = initTarget("safety");
  const outside = makeTarget("outside");

  assert.match(run(["init", "--target", makeTarget("bad-init"), "--yes", "--profile-path", "../profile.json"], { expectFailure: true }).stderr, /must not be empty or contain '\.\.'/);
  assert.match(run(["docs", "audit", "--target", target, "--run-name", "..\\bad"], { expectFailure: true }).stderr, /plain directory name/);
  assert.match(run(["work-unit", "run", "--target", target, "--config-path", "../config.json"], { expectFailure: true }).stderr, /must not be empty or contain '\.\.'/);
  assert.match(run(["work-unit", "guard", "--target", target, "--run-root", outside], { expectFailure: true }).stderr, /resolves outside the target repository/);
});
