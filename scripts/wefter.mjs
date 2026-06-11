#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { suiteFiles } from "./suite-files.mjs"

const manifestName = "wefter.manifest.json"
const manifestVersion = 2

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const sourceRoot = path.resolve(scriptDir, "..")
const packageMetadata = JSON.parse(readFileSync(path.join(sourceRoot, "package.json"), "utf8"))
const packageName = packageMetadata.name
const packageVersion = packageMetadata.version
const sourceOpenCode = path.join(sourceRoot, ".opencode")

function usage() {
  console.log(`Usage:
  node scripts/wefter.mjs install [--target <path>] [--force] [--dry-run]
  node scripts/wefter.mjs uninstall [--target <path>] [--force] [--dry-run]
  node scripts/wefter.mjs check [--target <path>]
  node scripts/wefter.mjs list

Options:
  --target, -t  Repository directory. Defaults to the current directory.
  --force       Overwrite during install or remove modified suite files during uninstall.
  --dry-run     Show planned changes without writing or deleting files.
  --help, -h    Show this help message.`)
}

function parseArgs(argv) {
  const args = {
    command: argv[2],
    target: process.cwd(),
    force: false,
    dryRun: false,
  }

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--help" || arg === "-h") {
      args.help = true
      continue
    }

    if (arg === "--force") {
      args.force = true
      continue
    }

    if (arg === "--dry-run") {
      args.dryRun = true
      continue
    }

    if (arg === "--target" || arg === "-t") {
      index += 1
      if (!argv[index]) fail("Missing value for --target")
      args.target = argv[index]
      continue
    }

    if (arg.startsWith("--target=")) {
      args.target = arg.slice("--target=".length)
      continue
    }

    fail(`Unknown argument: ${arg}`)
  }

  return args
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function assertDirectory(directory, label) {
  if (!existsSync(directory)) fail(`${label} does not exist: ${directory}`)
  if (!statSync(directory).isDirectory()) fail(`${label} is not a directory: ${directory}`)
}

function toNative(relativePath) {
  return relativePath.split("/").join(path.sep)
}

function toSuitePath(filePath) {
  return filePath.split(path.sep).join("/")
}

function ensureParent(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true })
}

function isEmptyDirectory(directory) {
  return existsSync(directory) && statSync(directory).isDirectory() && readdirSync(directory).length === 0
}

function removeIfEmpty(directory) {
  if (isEmptyDirectory(directory)) rmdirSync(directory)
}

function sha256File(filePath) {
  const hash = createHash("sha256")
  hash.update(readFileSync(filePath))
  return hash.digest("hex")
}

function sourcePath(relative) {
  return path.join(sourceOpenCode, toNative(relative))
}

function targetPath(targetOpenCode, relative) {
  return path.join(targetOpenCode, toNative(relative))
}

function sourceEntry(relative) {
  const source = sourcePath(relative)
  const stat = statSync(source)
  return {
    path: relative,
    sha256: sha256File(source),
    bytes: stat.size,
  }
}

function sourceEntries() {
  return suiteFiles.map(sourceEntry)
}

function readManifest(manifestPath) {
  if (!existsSync(manifestPath)) return null
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  const rawFiles = Array.isArray(manifest.files) ? manifest.files : []
  const files = rawFiles.map((entry) => {
    if (typeof entry === "string") return { path: entry }
    return entry
  })
  return { ...manifest, files }
}

function expectedHash(entry) {
  if (entry.sha256) return entry.sha256
  const source = sourcePath(entry.path)
  return existsSync(source) ? sha256File(source) : null
}

function classifyFile(targetOpenCode, entry) {
  const filePath = targetPath(targetOpenCode, entry.path)
  if (!existsSync(filePath)) return { ...entry, status: "missing" }

  if (statSync(filePath).isDirectory()) {
    return { ...entry, status: "modified", reason: "expected file but found directory" }
  }

  const actual = sha256File(filePath)
  const expected = expectedHash(entry)

  if (!expected) return { ...entry, status: "present", actual }
  if (actual === expected) return { ...entry, status: "ok", actual }
  return { ...entry, status: "modified", actual, expected }
}

function listFilesRecursive(directory, base = directory) {
  if (!existsSync(directory)) return []

  const result = []
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      result.push(...listFilesRecursive(fullPath, base))
    } else {
      result.push(toSuitePath(path.relative(base, fullPath)))
    }
  }
  return result
}

function unknownInstalledFiles(targetOpenCode, knownFiles) {
  const roots = ["agents", "skills"]
  const unknown = []

  for (const root of roots) {
    const directory = path.join(targetOpenCode, root)
    for (const relative of listFilesRecursive(directory, targetOpenCode)) {
      if (!knownFiles.has(relative)) unknown.push(relative)
    }
  }

  return unknown.sort()
}

function loadEntriesForTarget(targetOpenCode) {
  const manifestPath = path.join(targetOpenCode, manifestName)
  const manifest = readManifest(manifestPath)
  if (manifest) return { manifest, entries: manifest.files }
  return { manifest: null, entries: sourceEntries() }
}

function validateSourceFiles() {
  assertDirectory(sourceOpenCode, "Source .opencode directory")
  for (const relative of suiteFiles) {
    const source = sourcePath(relative)
    if (!existsSync(source)) fail(`Suite file is missing from source: ${source}`)
    if (statSync(source).isDirectory()) fail(`Suite path must be a file: ${source}`)
  }
}

function printOperations(title, operations, stream = "out") {
  const write = stream === "error" ? console.error : console.log
  write(title)
  if (operations.length === 0) {
    write("  No file changes.")
    return
  }

  for (const operation of operations) {
    const suffix = operation.reason ? ` (${operation.reason})` : ""
    write(`  ${operation.action}: ${operation.path}${suffix}`)
  }
}

function list() {
  for (const relative of suiteFiles) console.log(relative)
}

function install(target, options) {
  validateSourceFiles()
  assertDirectory(target, "Target directory")

  const targetOpenCode = path.join(target, ".opencode")
  const entries = sourceEntries()
  const operations = []
  const conflicts = []

  for (const entry of entries) {
    const destination = targetPath(targetOpenCode, entry.path)

    if (!existsSync(destination)) {
      operations.push({ action: "copy", path: entry.path })
      continue
    }

    if (statSync(destination).isDirectory()) {
      conflicts.push({ path: entry.path, reason: "destination is a directory" })
      continue
    }

    const currentHash = sha256File(destination)
    if (currentHash === entry.sha256) {
      operations.push({ action: "skip", path: entry.path, reason: "already current" })
      continue
    }

    if (options.force) {
      operations.push({ action: "overwrite", path: entry.path })
      continue
    }

    conflicts.push({ path: entry.path, reason: "destination exists and differs" })
  }

  if (conflicts.length > 0) {
    printOperations("Install conflicts:", conflicts.map((conflict) => ({ action: "conflict", ...conflict })), "error")
    fail("Install aborted. Re-run with --force to overwrite conflicting suite files.")
  }

  printOperations(options.dryRun ? "Install dry-run:" : "Install plan:", operations)
  console.log(`${options.dryRun ? "Would write" : "Writing"} manifest: .opencode/${manifestName}`)

  if (options.dryRun) return

  for (const operation of operations) {
    if (operation.action === "skip") continue
    const source = sourcePath(operation.path)
    const destination = targetPath(targetOpenCode, operation.path)
    ensureParent(destination)
    copyFileSync(source, destination)
  }

  const manifestPath = path.join(targetOpenCode, manifestName)
  const manifest = {
    name: packageName,
    version: packageVersion,
    manifestVersion,
    installedAt: new Date().toISOString(),
    files: entries,
  }

  ensureParent(manifestPath)
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

  console.log(`Installed Wefter into ${targetOpenCode}`)
  console.log("Restart opencode for the new agents and skills to load.")
}

function check(target) {
  assertDirectory(target, "Target directory")

  const targetOpenCode = path.join(target, ".opencode")
  if (!existsSync(targetOpenCode)) {
    console.log(`No .opencode directory found in ${target}`)
    process.exitCode = 1
    return
  }

  const { manifest, entries } = loadEntriesForTarget(targetOpenCode)
  const classified = entries.map((entry) => classifyFile(targetOpenCode, entry))
  const knownFiles = new Set(entries.map((entry) => entry.path))
  const unknown = unknownInstalledFiles(targetOpenCode, knownFiles)
  const counts = classified.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] ?? 0) + 1
    return acc
  }, {})
  const ok = (counts.modified ?? 0) === 0 && (counts.missing ?? 0) === 0 && (counts.present ?? 0) === 0

  console.log(`Manifest: ${manifest ? "present" : "missing; using source file list"}`)
  for (const entry of classified) {
    const reason = entry.reason ? ` (${entry.reason})` : ""
    console.log(`${entry.status.padEnd(8)} ${entry.path}${reason}`)
  }

  if (unknown.length > 0) {
    console.log("Unknown .opencode agent/skill files not managed by this suite:")
    for (const file of unknown) console.log(`unknown  ${file}`)
  }

  console.log(`Summary: ok=${counts.ok ?? 0} missing=${counts.missing ?? 0} modified=${counts.modified ?? 0} present=${counts.present ?? 0} unknown=${unknown.length}`)
  process.exitCode = ok ? 0 : 1
}

function uninstall(target, options) {
  assertDirectory(target, "Target directory")

  const targetOpenCode = path.join(target, ".opencode")
  if (!existsSync(targetOpenCode)) {
    console.log(`No .opencode directory found in ${target}`)
    return
  }

  const manifestPath = path.join(targetOpenCode, manifestName)
  const { manifest, entries } = loadEntriesForTarget(targetOpenCode)
  const classified = entries.map((entry) => classifyFile(targetOpenCode, entry))
  const unsafe = classified.filter((entry) => entry.status === "modified" || entry.status === "present")

  if (unsafe.length > 0 && !options.force) {
    printOperations("Modified suite files detected:", unsafe.map((entry) => ({ action: entry.status, path: entry.path, reason: entry.reason })), "error")
    fail("Uninstall aborted. Re-run with --force to remove modified suite files.")
  }

  const operations = classified
    .filter((entry) => entry.status !== "missing")
    .map((entry) => ({ action: "remove", path: entry.path, reason: entry.status === "modified" ? "modified; --force accepted" : undefined }))

  if (manifest) operations.push({ action: "remove", path: `.opencode/${manifestName}` })

  printOperations(options.dryRun ? "Uninstall dry-run:" : "Uninstall plan:", operations)

  if (options.dryRun) return

  for (const operation of operations) {
    if (operation.path === `.opencode/${manifestName}`) continue
    const filePath = targetPath(targetOpenCode, operation.path)
    if (existsSync(filePath)) rmSync(filePath, { force: true })
  }

  if (existsSync(manifestPath)) rmSync(manifestPath, { force: true })

  const candidateDirs = [
    "skills/wefter-workflow",
    "skills/app-discovery",
    "skills/competitor-intelligence",
    "skills/product-refinement",
    "skills/module-refinement",
    "skills/task-contracts",
    "skills/agentic-implementation",
    "skills/artifact-governance",
    "agents",
    "skills",
    ".",
  ]

  for (const relativeDir of candidateDirs) {
    removeIfEmpty(path.join(targetOpenCode, toNative(relativeDir)))
  }

  console.log(`Removed Wefter from ${targetOpenCode}`)
  console.log("Restart opencode for removal to take effect.")
}

const args = parseArgs(process.argv)

if (args.help || !args.command) {
  usage()
  process.exit(args.help ? 0 : 1)
}

const target = path.resolve(args.target)

if (args.command === "install") {
  install(target, args)
} else if (args.command === "uninstall") {
  uninstall(target, args)
} else if (args.command === "check") {
  check(target)
} else if (args.command === "list") {
  list()
} else {
  fail(`Unknown command: ${args.command}`)
}
