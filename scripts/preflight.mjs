import fs from "node:fs";
import path from "node:path";

const required = [
  "README.md",
  "apps/web/src/app/page.tsx",
  "apps/api/src/main.ts",
  "apps/browser-worker/src/engine.ts",
  "apps/notifier/src/main.ts",
  "apps/demo-portal/src/main.ts",
  "packages/agents/src/index.ts",
  "packages/contracts/src/index.ts",
  "packages/database/prisma/schema.prisma",
  "packages/database/prisma/migrations/202608290001_init/migration.sql",
  "packages/gcp/src/index.ts",
  "infra/terraform/main.tf",
  "docker-compose.yml",
  "cloudbuild.yaml",
  "tests/demo-e2e.mjs",
  "docs/VALIDATION.md",
];
let bad = false;
for (const f of required) {
  if (!fs.existsSync(f)) {
    console.error("MISSING", f);
    bad = true;
  }
}

const forbidden = [
  [/new\s+Function\s*\(/, "UNSAFE_DYNAMIC_CODE"],
  [/\beval\s*\(/, "UNSAFE_EVAL"],
  [/metadata\.google\.internal/i, "METADATA_REFERENCE"],
];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if ([".git", "node_modules", "generated", "dist", ".next"].includes(e.name))
      continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs)$/.test(e.name)) continue;
    const s = fs.readFileSync(p, "utf8");
    for (const [pattern, label] of forbidden) {
      if (pattern.test(s)) {
        // The security policy intentionally names the blocked metadata host.
        if (
          label === "METADATA_REFERENCE" &&
          p.includes(`packages${path.sep}security`)
        )
          continue;
        console.error(label, p);
        bad = true;
      }
    }
  }
}
walk(".");
if (bad) process.exit(1);
console.log("preflight: OK");
