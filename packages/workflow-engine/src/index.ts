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
  } else {
    minor += 1;
  }
  return `v${major}.${minor}${draft ? "-draft" : ""}`;
}

function renderPlaywrightLocator(l?: any): string {
  if (!l) return 'page.locator("body")';
  switch (l.strategy) {
    case "role":
      return `page.getByRole(${JSON.stringify(l.role || "button")}, { name: ${JSON.stringify(l.name || l.value || "")} })`;
    case "label":
      return `page.getByLabel(${JSON.stringify(l.value || l.name || "")})`;
    case "placeholder":
      return `page.getByPlaceholder(${JSON.stringify(l.value || "")})`;
    case "testId":
      return `page.getByTestId(${JSON.stringify(l.value || "")})`;
    case "text":
      return `page.getByText(${JSON.stringify(l.value || l.name || "")}, { exact: false })`;
    case "css":
      return `page.locator(${JSON.stringify(l.value || "body")})`;
    default:
      return 'page.locator("body")';
  }
}

export function compileAuditArtifact(spec: WorkflowSpec): string {
  const lines = [
    "/**",
    ` * Compiled Playwright Automation Script: ${spec.goal}`,
    ` * Target Start URL: ${spec.startUrl}`,
    " */",
    "const { chromium } = require('playwright');",
    "",
    "(async () => {",
    "  const browser = await chromium.launch({ headless: true });",
    "  const context = await browser.newContext();",
    "  const page = await context.newPage();",
    "",
    `  console.log("Navigating to start URL: ${spec.startUrl}...");`,
    `  await page.goto(${JSON.stringify(spec.startUrl)}, { waitUntil: "domcontentloaded" });`,
    "",
  ];

  for (let i = 0; i < spec.steps.length; i++) {
    const step = spec.steps[i]!;
    const loc = renderPlaywrightLocator(step.locator);
    lines.push(`  // Step ${i + 1}: ${step.description}`);

    switch (step.type) {
      case "NAVIGATE":
        if (step.url) {
          lines.push(`  await page.goto(${JSON.stringify(step.url)}, { waitUntil: "domcontentloaded" });`);
        }
        break;
      case "CLICK":
        lines.push(`  await ${loc}.first().click({ timeout: 10000 });`);
        break;
      case "TYPE":
        lines.push(`  await ${loc}.first().fill(${JSON.stringify(step.value || "")});`);
        break;
      case "SELECT":
        lines.push(`  await ${loc}.first().selectOption(${JSON.stringify(step.value || "")});`);
        break;
      case "CHECK":
        lines.push(`  await ${loc}.first().check();`);
        break;
      case "UNCHECK":
        lines.push(`  await ${loc}.first().uncheck();`);
        break;
      case "SCROLL":
        lines.push(`  await page.mouse.wheel(0, ${Number(step.value || 1200)});`);
        break;
      case "WAIT_FOR":
        lines.push(`  await ${loc}.first().waitFor({ state: "visible", timeout: 10000 });`);
        break;
      case "ASSERT":
        lines.push(`  if (!(await ${loc}.first().isVisible())) {`);
        lines.push(`    throw new Error(${JSON.stringify(`Assertion failed: ${step.description}`)});`);
        lines.push("  }");
        break;
      case "SCREENSHOT":
        lines.push(`  await page.screenshot({ path: ${JSON.stringify(`screenshot_${step.id}.png`)}, fullPage: true });`);
        break;
      case "EXTRACT":
        lines.push(`  console.log("Extracting target data fields using schema...");`);
        lines.push(`  const extractedData = await page.evaluate(() => {`);
        lines.push(`    return Array.from(document.querySelectorAll("article, [class*='product'], [class*='card'], [class*='item']")).map(el => ({`);
        lines.push(`      title: el.querySelector("h1, h2, h3, a, [class*='title']")?.textContent?.trim() || "",`);
        lines.push(`      price: el.querySelector("[class*='price'], [class*='amount']")?.textContent?.trim() || "",`);
        lines.push(`      link: (el.querySelector("a") as HTMLAnchorElement)?.href || ""`);
        lines.push(`    })).filter(x => x.title);`);
        lines.push(`  });`);
        lines.push(`  console.log("Extracted Data:", JSON.stringify(extractedData, null, 2));`);
        break;
      case "DONE":
        lines.push('  console.log("Automation task completed successfully!");');
        break;
      default:
        lines.push(`  // Executed action: ${step.type}`);
    }

    // Capture diagnostic screenshot after each automated action step
    lines.push(`  await page.screenshot({ path: "screenshot_step_${i + 1}_${step.type.toLowerCase()}.png" });`);
    lines.push("");
  }

  lines.push("  await browser.close();");
  lines.push("})();");
  return lines.join("\n");
}
