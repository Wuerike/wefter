import { ID_PATTERN } from "../constants.js";

export function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

export function assertAllowedKeys(value, label, allowedKeys) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} has unsupported property '${key}'.`);
    }
  }
}

export function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
  if (value.includes("\n") || value.includes("\r")) {
    throw new Error(`${label} must not contain line breaks.`);
  }
  return value;
}

export function requireId(value, label) {
  requireString(value, label);
  if (!ID_PATTERN.test(value)) {
    throw new Error(`${label} must match ${ID_PATTERN}.`);
  }
}

export function requireStringArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  value.forEach((item, index) => requireString(item, `${label}[${index}]`));
}

export function requireStrictInteger(value, label, minimum) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

export function parseStrictInteger(value, label, minimum) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}.`);
  }
  return requireStrictInteger(Number(value), label, minimum);
}

export function assertUniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`${label} contains duplicate id '${item.id}'.`);
    }
    seen.add(item.id);
  }
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function requireProperty(object, name, context) {
  if (!object || typeof object !== "object" || Array.isArray(object) || !(name in object)) {
    throw new Error(`${context} is missing required property '${name}'.`);
  }
  return object[name];
}
