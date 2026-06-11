#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { suiteFiles } from "./suite-files.mjs"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, "..")
const openCodeRoot = path.join(root, ".opencode")
const agentsRoot = path.join(openCodeRoot, "agents")
const skillsRoot = path.join(openCodeRoot, "skills")

const errors = []
const warnings = []

const allowedAgentFields = new Set([
  "name",
  "model",
  "variant",
  "description",
  "mode",
  "hidden",
  "steps",
  "options",
  "permission",
  "disable",
  "temperature",
  "top_p",
])

const validAgentModes = new Set(["primary", "subagent", "all"])
const skillNamePattern = /^[a-z0-9][a-z0-9-]{0,63}$/

function addError(file, message) {
  errors.push(`${file}: ${message}`)
}

function addWarning(file, message) {
  warnings.push(`${file}: ${message}`)
}

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/")
}

function readText(filePath) {
  return readFileSync(filePath, "utf8")
}

function parseFrontmatter(filePath) {
  const text = readText(filePath)
  const lines = text.split(/\n/)
  const file = relative(filePath)

  if (lines[0] !== "---") {
    addError(file, "missing frontmatter opening delimiter")
    return { text, fields: {}, frontmatter: "" }
  }

  const end = lines.findIndex((line, index) => index > 0 && line === "---")
  if (end === -1) {
    addError(file, "missing frontmatter closing delimiter")
    return { text, fields: {}, frontmatter: "" }
  }

  const frontmatter = lines.slice(1, end).join("\n")
  const fields = {}

  for (const line of frontmatter.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/)
    if (!match) continue
    fields[match[1]] = match[2] ?? ""
  }

  return { text, fields, frontmatter }
}

function listFiles(directory, predicate = () => true) {
  if (!existsSync(directory)) return []
  const result = []

  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      result.push(...listFiles(fullPath, predicate))
    } else if (predicate(fullPath)) {
      result.push(fullPath)
    }
  }

  return result
}

function validateLineEndings(filePath, text) {
  if (text.includes("\r\n")) addError(relative(filePath), "CRLF line endings detected; use LF")
}

function validateMarkdownFences(filePath, text) {
  let open = null
  const lines = text.split("\n")

  lines.forEach((line, index) => {
    const match = line.match(/^([`~]{3,})/)
    if (!match) return

    const marker = match[1]
    const char = marker[0]
    const length = marker.length

    if (!open) {
      open = { char, length, line: index + 1 }
      return
    }

    if (open.char === char && length >= open.length) open = null
  })

  if (open) addError(relative(filePath), `unclosed markdown fence opened at line ${open.line}`)
}

function validateMermaidLabels(filePath, text) {
  const file = relative(filePath)
  const lines = text.split("\n")
  let inMermaid = false

  lines.forEach((line, index) => {
    if (line.startsWith("```mermaid")) {
      inMermaid = true
      return
    }

    if (inMermaid && line.startsWith("```")) {
      inMermaid = false
      return
    }

    if (inMermaid && /\[[^\]]*<[^>]+>[^\]]*\]/.test(line)) {
      addWarning(file, `line ${index + 1}: Mermaid label contains angle brackets that may render as HTML`)
    }
  })
}

function validateSuiteFiles() {
  const unique = new Set()

  for (const file of suiteFiles) {
    if (unique.has(file)) addError("scripts/suite-files.mjs", `duplicate suite file: ${file}`)
    unique.add(file)

    if (!/^(agents\/[^/]+\.md|skills\/[^/]+\/SKILL\.md)$/.test(file)) {
      addError("scripts/suite-files.mjs", `invalid installable path: ${file}`)
    }

    const fullPath = path.join(openCodeRoot, ...file.split("/"))
    if (!existsSync(fullPath)) addError("scripts/suite-files.mjs", `listed file does not exist: ${file}`)
  }
}

function validateAgents() {
  const agentFiles = listFiles(agentsRoot, (filePath) => filePath.endsWith(".md"))
  const listed = new Set(suiteFiles.filter((file) => file.startsWith("agents/")))
  const primaryAgents = []

  for (const filePath of agentFiles) {
    const file = relative(filePath)
    const suitePath = file.replace(".opencode/", "")
    const { text, fields } = parseFrontmatter(filePath)
    validateLineEndings(filePath, text)
    validateMarkdownFences(filePath, text)

    if (!listed.has(suitePath)) addWarning(file, "agent file is not listed in suite-files.mjs")
    if (!fields.description?.trim()) addError(file, "agent description is required")
    if (!fields.mode?.trim()) addError(file, "agent mode is required")
    if (fields.mode && !validAgentModes.has(fields.mode)) addError(file, `invalid agent mode: ${fields.mode}`)
    if (fields.mode === "primary") primaryAgents.push(path.basename(filePath, ".md"))

    for (const key of Object.keys(fields)) {
      if (key === "color") addError(file, "do not use color in this suite; it has broken opencode startup in supported versions")
      if (!allowedAgentFields.has(key) && key !== "color") addWarning(file, `unknown agent frontmatter field: ${key}`)
    }
  }

  if (primaryAgents.length !== 1 || primaryAgents[0] !== "wefter") {
    addError(".opencode/agents", `expected exactly one primary agent named wefter; found: ${primaryAgents.join(", ") || "none"}`)
  }
}

function validateSkills() {
  const skillFiles = listFiles(skillsRoot, (filePath) => path.basename(filePath) === "SKILL.md")
  const listed = new Set(suiteFiles.filter((file) => file.startsWith("skills/")))

  for (const filePath of skillFiles) {
    const file = relative(filePath)
    const suitePath = file.replace(".opencode/", "")
    const folderName = path.basename(path.dirname(filePath))
    const { text, fields } = parseFrontmatter(filePath)
    validateLineEndings(filePath, text)
    validateMarkdownFences(filePath, text)
    validateMermaidLabels(filePath, text)

    if (!listed.has(suitePath)) addWarning(file, "skill file is not listed in suite-files.mjs")
    if (!fields.name?.trim()) addError(file, "skill name is required")
    if (!fields.description?.trim()) addError(file, "skill description is required")
    if (fields.name && fields.name !== folderName) addError(file, `skill name must match folder name: ${folderName}`)
    if (fields.name && !skillNamePattern.test(fields.name)) addError(file, `invalid skill name: ${fields.name}`)
  }
}

function validateDocsAndScripts() {
  const files = [
    ...listFiles(path.join(root, "docs"), (filePath) => filePath.endsWith(".md")),
    ...listFiles(path.join(root, "scripts"), (filePath) => filePath.endsWith(".mjs")),
    path.join(root, "README.md"),
    path.join(root, "package.json"),
  ]

  for (const filePath of files) {
    if (!existsSync(filePath)) continue
    const text = readText(filePath)
    validateLineEndings(filePath, text)
    if (filePath.endsWith(".md")) {
      validateMarkdownFences(filePath, text)
      validateMermaidLabels(filePath, text)
    }
  }
}

validateSuiteFiles()
validateAgents()
validateSkills()
validateDocsAndScripts()

for (const warning of warnings) console.warn(`warning: ${warning}`)

if (errors.length > 0) {
  for (const error of errors) console.error(`error: ${error}`)
  console.error(`Validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`)
  process.exit(1)
}

console.log(`Validation passed with ${warnings.length} warning(s).`)
