import fs from "node:fs";
import path from "node:path";
import { DELIVERY_WORKFLOW_ID } from "../constants.js";
import { assertWorkflowEnabled, deliveryConfigPath, readConfig } from "../core/config.js";
import { assertNonEmptyFile, readJson } from "../core/fs.js";
import { assertPlainRunId, resolveInsideTarget, resolveTarget, toDisplayPath } from "../core/paths.js";
import { validateDeliveryConfig } from "../core/profile.js";
import { requireProperty, requireStrictInteger, requireString } from "../core/validation.js";

export function commandDeliveryGuard(flags) {
  commandDeliveryGuardInternal(flags);
}

function getReviewMachineResult(reviewPath, expectedTaskId) {
  const content = fs.readFileSync(reviewPath, "utf8");
  const match = content.match(/##\s+Machine Result\s*```json\s*(\{[\s\S]*?\})\s*```/i);
  if (!match) {
    throw new Error(`Review '${reviewPath}' must contain a '## Machine Result' section with a fenced json object.`);
  }

  let machine;
  try {
    machine = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Review '${reviewPath}' contains invalid Machine Result JSON: ${error.message}`);
  }

  const taskId = String(requireProperty(machine, "taskId", `Machine Result in '${reviewPath}'`));
  const result = String(requireProperty(machine, "result", `Machine Result in '${reviewPath}'`));
  const reviewIteration = requireProperty(machine, "reviewIteration", `Machine Result in '${reviewPath}'`);
  const blockingFindings = requireProperty(machine, "blockingFindings", `Machine Result in '${reviewPath}'`);

  if (taskId !== expectedTaskId) {
    throw new Error(`Review '${reviewPath}' Machine Result taskId '${taskId}' does not match expected task '${expectedTaskId}'.`);
  }
  if (!["Pass", "Needs Fix", "Blocked"].includes(result)) {
    throw new Error(`Review '${reviewPath}' Machine Result result must be one of: Pass, Needs Fix, Blocked.`);
  }
  const iterationNumber = requireStrictInteger(reviewIteration, `Review '${reviewPath}' Machine Result reviewIteration`, 1);
  if (!Array.isArray(blockingFindings)) {
    throw new Error(`Review '${reviewPath}' Machine Result blockingFindings must be an array.`);
  }
  blockingFindings.forEach((finding, index) => requireString(finding, `Review '${reviewPath}' Machine Result blockingFindings[${index}]`));
  if ((result === "Needs Fix" || result === "Blocked") && blockingFindings.length === 0) {
    throw new Error(`Review '${reviewPath}' Machine Result must list blockingFindings when result is '${result}'.`);
  }

  return { taskId, result, reviewIteration: iterationNumber, blockingFindings };
}

function getTaskIds(taskSpecsDir) {
  if (!fs.existsSync(taskSpecsDir)) {
    throw new Error(`Task specs directory not found: ${taskSpecsDir}`);
  }
  const entries = fs.readdirSync(taskSpecsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
  if (entries.length === 0) {
    throw new Error(`No task spec files found in: ${taskSpecsDir}`);
  }
  return entries.map((name) => {
    const taskId = path.basename(name, ".md");
    if (!/^T\d{2}-[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(taskId)) {
      throw new Error(`Task spec file '${path.join(taskSpecsDir, name)}' does not use the required task id format TXX-YYY.`);
    }
    return taskId;
  });
}

function getTaskState(targetRoot, taskId, taskLogDir, taskReviewDir) {
  const logPath = path.join(taskLogDir, `${taskId}.md`);
  const reviewPath = path.join(taskReviewDir, `${taskId}.md`);
  const logExists = fs.existsSync(logPath);
  const reviewExists = fs.existsSync(reviewPath);
  let reviewResult = null;
  let reviewIteration = null;
  let blockingFindings = [];
  let state = "NotImplemented";
  let reason = "Task implementation log is missing.";

  if (logExists && !reviewExists) {
    state = "AwaitingReview";
    reason = "Task implementation log exists, but review is missing.";
  }

  if (logExists && reviewExists) {
    const logStat = fs.statSync(logPath);
    const reviewStat = fs.statSync(reviewPath);
    const machine = getReviewMachineResult(reviewPath, taskId);
    reviewResult = machine.result;
    reviewIteration = machine.reviewIteration;
    blockingFindings = machine.blockingFindings;

    if (reviewStat.mtimeMs < logStat.mtimeMs) {
      state = "AwaitingReview";
      reason = "Task implementation log is newer than the review; review is stale.";
    } else if (reviewResult === "Pass") {
      state = "Passed";
      reason = "Task review passed.";
    } else if (reviewResult === "Needs Fix") {
      state = "NeedsFix";
      reason = "Task review requires correction before another task can start.";
    } else if (reviewResult === "Blocked") {
      state = "Blocked";
      reason = "Task review is blocked.";
    }
  }

  return {
    taskId,
    state,
    reason,
    logExists,
    reviewExists,
    reviewResult,
    reviewIteration,
    blockingFindings,
    logPath: toDisplayPath(targetRoot, logPath),
    reviewPath: toDisplayPath(targetRoot, reviewPath)
  };
}

function assertKnownTask(taskIds, taskId, mode) {
  if (typeof taskId !== "string" || taskId.trim() === "") {
    throw new Error(`--task-id is required for mode '${mode}'.`);
  }
  if (!taskIds.includes(taskId)) {
    throw new Error(`Task id '${taskId}' is not present in the approved task specs.`);
  }
}

function assertPreviousTasksPassed(taskIds, states, taskId) {
  const targetIndex = taskIds.indexOf(taskId);
  if (targetIndex < 0) {
    throw new Error(`Task id '${taskId}' is not present in the approved task specs.`);
  }
  for (let index = 0; index < targetIndex; index++) {
    const previousTaskId = taskIds[index];
    const previousState = states.find((state) => state.taskId === previousTaskId);
    if (previousState?.state !== "Passed") {
      throw new Error(`Task '${taskId}' cannot proceed because previous task '${previousTaskId}' is '${previousState?.state}'. Reason: ${previousState?.reason}`);
    }
  }
}

function getLoopStatus(states) {
  for (const state of states) {
    if (state.state === "Blocked") {
      return { result: "Blocked", action: "StopForHumanOrSpecDecision", taskId: state.taskId, reason: state.reason };
    }
    if (state.state === "NeedsFix") {
      return { result: "NeedsAction", action: "FixTask", taskId: state.taskId, reason: state.reason };
    }
    if (state.state === "NotImplemented") {
      return { result: "NeedsAction", action: "ImplementTask", taskId: state.taskId, reason: state.reason };
    }
    if (state.state === "AwaitingReview") {
      return { result: "NeedsAction", action: "ReviewTask", taskId: state.taskId, reason: state.reason };
    }
  }
  return { result: "Ready", action: "RunFinalDeliveryValidation", taskId: null, reason: "All approved tasks have passing, non-stale reviews." };
}

function writeGuardResult(status, states, json) {
  if (json) {
    console.log(JSON.stringify({ status, tasks: states }, null, 2));
    return;
  }
  console.log(`Result: ${status.result}`);
  console.log(`Action: ${status.action}`);
  if (status.taskId) {
    console.log(`Task: ${status.taskId}`);
  }
  console.log(`Reason: ${status.reason}`);
}

function assertFinalValidationArtifacts(targetRoot, versionedDeliveryDir, versionedDecisionLog) {
  const deliveryDir = resolveInsideTarget(targetRoot, versionedDeliveryDir, "versioned delivery dir");
  const decisionLog = resolveInsideTarget(targetRoot, versionedDecisionLog, "versioned decision log");
  assertNonEmptyFile(path.join(deliveryDir, "delivery-plan.md"), "approved delivery plan");
  assertNonEmptyFile(path.join(deliveryDir, "traceability-matrix.md"), "approved traceability matrix");
  assertNonEmptyFile(path.join(deliveryDir, "verification-plan.md"), "approved verification plan");
  assertNonEmptyFile(decisionLog, "decision log");
}

function commandDeliveryGuardInternal(flags) {
  const targetRoot = resolveTarget(flags);
  const wefterConfig = readConfig(targetRoot);
  assertWorkflowEnabled(wefterConfig, DELIVERY_WORKFLOW_ID);
  const deliveryConfig = readJson(path.join(targetRoot, deliveryConfigPath(wefterConfig, flags)), "delivery config");
  validateDeliveryConfig(deliveryConfig);

  const mode = flags.mode || "Status";
  if (!["Status", "ReadyForReview", "ReadyForNextTask", "ReadyForFinalValidation"].includes(mode)) {
    throw new Error("--mode must be one of: Status, ReadyForReview, ReadyForNextTask, ReadyForFinalValidation.");
  }

  let runRoot;
  if (flags["run-id"] && flags["run-root"]) {
    throw new Error("Use either --run-id or --run-root, not both.");
  }
  if (flags["run-root"]) {
    runRoot = resolveInsideTarget(targetRoot, flags["run-root"], "run root");
  } else {
    assertPlainRunId(flags["run-id"]);
    runRoot = resolveInsideTarget(targetRoot, path.join(deliveryConfig.runArtifactsRoot, flags["run-id"]), "run root");
  }
  if (!fs.existsSync(runRoot)) {
    throw new Error(`Run root not found: ${runRoot}`);
  }

  const manifestPath = path.join(runRoot, "manifest.json");
  const manifest = readJson(manifestPath, "delivery run manifest");
  if (manifest.workflowId !== DELIVERY_WORKFLOW_ID) {
    throw new Error(`Run manifest workflowId must be ${DELIVERY_WORKFLOW_ID}.`);
  }
  const versionedDeliveryDir = requireProperty(requireProperty(manifest, "paths", "manifest"), "versionedDeliveryDir", "manifest.paths");
  const taskSpecsDir = resolveInsideTarget(targetRoot, path.join(versionedDeliveryDir, "task-specs"), "task specs directory");
  const taskLogDir = path.join(runRoot, "implementation", "task-logs");
  const taskReviewDir = path.join(runRoot, "implementation", "task-reviews");
  if (!fs.existsSync(taskLogDir)) {
    throw new Error(`Task log directory not found: ${taskLogDir}`);
  }
  if (!fs.existsSync(taskReviewDir)) {
    throw new Error(`Task review directory not found: ${taskReviewDir}`);
  }

  const taskIds = getTaskIds(taskSpecsDir);
  const states = taskIds.map((taskId) => getTaskState(targetRoot, taskId, taskLogDir, taskReviewDir));
  const status = getLoopStatus(states);

  if (mode === "Status") {
    writeGuardResult(status, states, flags.json);
    return;
  }

  const taskId = flags["task-id"];
  if (mode === "ReadyForReview") {
    assertKnownTask(taskIds, taskId, mode);
    assertPreviousTasksPassed(taskIds, states, taskId);
    const state = states.find((item) => item.taskId === taskId);
    if (!state.logExists) {
      throw new Error(`Task '${taskId}' is not ready for review because its implementation log is missing.`);
    }
    if (state.state === "NeedsFix") {
      throw new Error(`Task '${taskId}' still needs a correction. Update its implementation log after the correction before requesting another review.`);
    }
    if (state.state === "Blocked") {
      throw new Error(`Task '${taskId}' is blocked and cannot be reviewed as ready.`);
    }
    writeGuardResult({ result: "Ready", action: "ReviewTask", taskId, reason: `Task '${taskId}' has an implementation log and can be reviewed.` }, states, flags.json);
    return;
  }

  if (mode === "ReadyForNextTask") {
    assertKnownTask(taskIds, taskId, mode);
    assertPreviousTasksPassed(taskIds, states, taskId);
    const state = states.find((item) => item.taskId === taskId);
    if (state.state !== "Passed") {
      throw new Error(`Task '${taskId}' cannot release the next task. Current state: ${state.state}. Reason: ${state.reason}`);
    }
    writeGuardResult({ result: "Ready", action: "AdvanceToNextTaskOrFinalValidation", taskId, reason: `Task '${taskId}' has a passing, non-stale review.` }, states, flags.json);
    return;
  }

  if (mode === "ReadyForFinalValidation") {
    if (status.result !== "Ready") {
      throw new Error(`Delivery unit is not ready for final validation. Next required action: ${status.action} for task '${status.taskId}'. Reason: ${status.reason}`);
    }
    const versionedDecisionLog = requireProperty(requireProperty(manifest, "paths", "manifest"), "versionedDecisionLog", "manifest.paths");
    assertFinalValidationArtifacts(targetRoot, versionedDeliveryDir, versionedDecisionLog);
    writeGuardResult(status, states, flags.json);
  }
}
