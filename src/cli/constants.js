export const VERSION = "0.4.0";
export const CONFIG_FILE = "wefter.config.json";
export const INSTALL_MANIFEST_FILE = ".wefter/install-manifest.json";
export const PRODUCT_SHAPING_WORKFLOW_ID = "product-shaping";
export const DOCUMENTATION_REPAIR_WORKFLOW_ID = "documentation-repair";
export const DELIVERY_WORKFLOW_ID = "delivery-implementation";

export const DEFAULTS = Object.freeze({
  workflowRoot: ".wefter/workflows",
  profilePath: ".wefter/workflows/documentation-audit/profile.json",
  artifactRoot: ".audit/wefter/documentation-audit",
  templateRoot: ".wefter/workflows/documentation-audit/templates",
  processDocPath: ".wefter/workflows/documentation-audit/README.md"
});

export const PRODUCT_SHAPING_DEFAULTS = Object.freeze({
  specRoot: ".wefter/specs",
  runRoot: ".wefter/runs/product-shaping",
  configPath: ".wefter/workflows/product-shaping/config.json",
  profilePath: ".wefter/workflows/product-shaping/profile.json"
});

export const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const REQUIRED_TEMPLATE_FILES = Object.freeze([
  "auditor-prompt.md",
  "consolidator-prompt.md",
  "validator-prompt.md"
]);

export const PRODUCT_SHAPING_PROMPT_FILES = Object.freeze([
  "intake-prompt.md",
  "reference-research-prompt.md",
  "product-shaper-prompt.md",
  "domain-modeler-prompt.md",
  "release-planner-prompt.md",
  "product-auditor-prompt.md",
  "product-validator-prompt.md",
  "product-repairer-prompt.md"
]);

export const PRODUCT_SHAPING_REQUIRED_FILES = Object.freeze([
  "README.md",
  "discovery/SOURCE_MATERIALS.md",
  "discovery/IDEA_BRIEF.md",
  "discovery/OPEN_QUESTIONS.md",
  "references/README.md",
  "PRODUCT_VISION.md",
  "product/FEATURE_CATALOG.md",
  "product/MODULE_ROADMAP.md",
  "product/DOMAIN_MODEL.md",
  "product/OPERATIONAL_FLOW.md",
  "product/PRODUCT_DECISIONS.md",
  "releases/README.md",
  "releases/<release-id>/README.md",
  "releases/<release-id>/SCOPE.md",
  "releases/<release-id>/DOMAIN_SPEC.md",
  "releases/<release-id>/ACCEPTANCE_CRITERIA.md",
  "releases/<release-id>/DELIVERABLES.md"
]);
