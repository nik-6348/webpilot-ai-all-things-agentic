import type {
  WorkflowPatch,
  WorkflowSpec,
  WorkflowStep,
} from "@webpilot/contracts";
import { WorkflowSpecSchema } from "@webpilot/contracts";

export function applyPatch(
  spec: WorkflowSpec,
  patch: WorkflowPatch,
): WorkflowSpec {
  const steps = spec.steps.map((step) =>
    step.id === patch.failedStepId
      ? { ...patch.replacement, id: step.id }
      : step,
  );
  if (!steps.some((s) => s.id === patch.failedStepId))
    throw new Error(`Step ${patch.failedStepId} not found`);
  return WorkflowSpecSchema.parse({ ...spec, steps });
}

export function classifyRisk(step: WorkflowStep): "LOW" | "MEDIUM" | "HIGH" {
  if (
    [
      "EXTRACT",
      "NAVIGATE",
      "SCROLL",
      "WAIT_FOR",
      "SCREENSHOT",
      "ASSERT",
      "DOWNLOAD",
    ].includes(step.type)
  )
    return "LOW";
  if (["TYPE", "SELECT", "CHECK", "UNCHECK", "UPLOAD"].includes(step.type))
    return step.risk === "HIGH" ? "HIGH" : "MEDIUM";
  if (step.type === "CLICK") return step.risk;
  return step.risk;
}

export function nextVersionLabel(
  current: string | null,
  kind: "DISCOVERY" | "RECOVERY" | "MAJOR",
  draft = false,
): string {
  if (!current) return draft ? "v1.0-draft" : "v1.0";
  const match = /^v(\d+)\.(\d+)(?:-draft)?$/.exec(current);
  if (!match) throw new Error(`Invalid version ${current}`);
  let major = Number(match[1]);
  let minor = Number(match[2]);
  if (kind === "MAJOR") {
    major += 1;
    minor = 0;
  } else if (kind === "RECOVERY") {
    minor += 1;
  }
  return `v${major}.${minor}${draft ? "-draft" : ""}`;
}

export function compileAuditArtifact(spec: WorkflowSpec): string {
  const lines = [
    "// Generated deterministic audit artifact. WorkflowSpec remains source of truth.",
    "import { chromium } from 'playwright';",
    "const browser = await chromium.launch({headless:true});",
    "const page = await browser.newPage();",
  ];
  for (const step of spec.steps) {
    if (step.type === "NAVIGATE" && step.url)
      lines.push(`await page.goto(${JSON.stringify(step.url)});`);
    else
      lines.push(
        `// ${step.id}: ${step.type} - ${step.description.replace(/\n/g, " ")}`,
      );
  }
  lines.push("await browser.close();");
  return lines.join("\n");
}
