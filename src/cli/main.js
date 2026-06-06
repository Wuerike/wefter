import process from "node:process";
import { allowedFlagsForCommand, assertKnownFlags, parseArgs, printHelp } from "./args.js";
import { VERSION } from "./constants.js";
import { commandInit } from "./install/init.js";
import { commandDoctor } from "./install/doctor.js";
import { commandUninstall } from "./install/uninstall.js";
import { commandDeliveryRun } from "./workflows/delivery.js";
import { commandDeliveryGuard } from "./workflows/delivery-guard.js";
import { commandNewRun } from "./workflows/documentation-audit.js";
import { commandDocsRepair } from "./workflows/documentation-repair.js";
import { commandProfileImport, commandProfileScaffold } from "./workflows/profile.js";
import { commandProductShape, commandProductValidate } from "./workflows/product-shaping.js";

export async function main(argv = process.argv.slice(2)) {
  const { positional, flags } = parseArgs(argv);
  if (flags.version) {
    console.log(VERSION);
    return;
  }
  if (flags.help || positional.length === 0) {
    printHelp();
    return;
  }

  const [command, subcommand] = positional;
  const allowedFlags = allowedFlagsForCommand(command, subcommand);
  if (allowedFlags) {
    assertKnownFlags(flags, allowedFlags);
  }
  if (command === "init") {
    await commandInit(flags);
    return;
  }
  if (command === "uninstall") {
    await commandUninstall(flags);
    return;
  }
  if (command === "new-run") {
    if (subcommand && subcommand !== "documentation-audit") {
      throw new Error(`Unsupported workflow for new-run: ${subcommand}`);
    }
    commandNewRun(flags);
    return;
  }
  if (command === "docs" && subcommand === "audit") {
    commandNewRun(flags);
    return;
  }
  if (command === "docs" && subcommand === "repair") {
    commandDocsRepair(flags);
    return;
  }
  if (command === "product" && subcommand === "shape") {
    commandProductShape(flags);
    return;
  }
  if (command === "product" && subcommand === "validate") {
    commandProductValidate(flags);
    return;
  }
  if (command === "delivery" && subcommand === "run") {
    commandDeliveryRun(flags);
    return;
  }
  if (command === "delivery" && subcommand === "guard") {
    commandDeliveryGuard(flags);
    return;
  }
  if (command === "profile" && subcommand === "scaffold") {
    commandProfileScaffold(flags);
    return;
  }
  if (command === "profile" && subcommand === "import") {
    commandProfileImport(flags);
    return;
  }
  if (command === "doctor") {
    commandDoctor(flags);
    return;
  }

  throw new Error(`Unknown command: ${positional.join(" ")}`);
}
