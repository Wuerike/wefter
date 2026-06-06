import fs from "node:fs";
import path from "node:path";
import { writeTextIfSafe } from "./fs.js";

export function renderTemplate(content, values) {
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, String(value));
  }
  return result;
}

export function copyRenderedTemplate(source, destination, values, force) {
  const content = fs.readFileSync(source, "utf8");
  const rendered = renderTemplate(content, values);
  writeTextIfSafe(destination, rendered, force);
}

export function copyDirectory(sourceRoot, destinationRoot, force) {
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    const source = path.join(sourceRoot, entry.name);
    const destination = path.join(destinationRoot, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(source, destination, force);
      continue;
    }
    const content = fs.readFileSync(source, "utf8");
    writeTextIfSafe(destination, content, force);
  }
}

export function assertNoPlaceholders(filePath, content) {
  const match = content.match(/{{[^}]+}}/);
  if (match) {
    throw new Error(`${filePath} contains unresolved placeholder ${match[0]}.`);
  }
}

export function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Missing ${label}: ${expected}`);
  }
}

export function markdownList(items) {
  if (!items || items.length === 0) {
    return "- <none>";
  }
  return items.map((item) => `- \`${item}\``).join("\n");
}
