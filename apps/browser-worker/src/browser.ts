import type { BrowserContext, Page } from "playwright";
import type {
  ExtractionSchema,
  Locator,
  WorkflowStep,
} from "@webpilot/contracts";
import { assertSafeUrl, redactSecrets } from "@webpilot/security";

export function resolveLocator(page: Page, l?: Locator) {
  if (!l) throw new Error("Locator is required");
  switch (l.strategy) {
    case "role":
      return page.getByRole(l.role as any, { name: l.name || l.value });
    case "label":
      return page.getByLabel(l.value || l.name || "");
    case "placeholder":
      return page.getByPlaceholder(l.value || "");
    case "testId":
      return page.getByTestId(l.value || "");
    case "text":
      return page.getByText(l.value || l.name || "", { exact: false });
    case "css":
      return page.locator(l.value || "");
  }
}
export async function installNetworkGuard(context: BrowserContext) {
  await context.route("**/*", async (route) => {
    try {
      await assertSafeUrl(route.request().url());
      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });
}
export async function compactDom(page: Page) {
  const html = await page.locator("body").evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll("script,style,svg,noscript")
      .forEach((x) => x.remove());
    return (
      clone.innerText.slice(0, 35000) +
      "\n\nINTERACTIVE:\n" +
      [...clone.querySelectorAll("a,button,input,select,textarea,[role]")]
        .slice(0, 300)
        .map(
          (e: any) =>
            `${e.tagName} role=${e.getAttribute("role") || ""} text=${(e.innerText || e.getAttribute("aria-label") || e.getAttribute("placeholder") || "").slice(0, 120)} id=${e.id || ""} testid=${e.getAttribute("data-testid") || ""}`,
        )
        .join("\n")
    );
  });
  return redactSecrets(html);
}
export async function detectChallenge(page: Page) {
  const text = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).toLowerCase();
  return /captcha|verify you are human|cloudflare|turnstile|hcaptcha|recaptcha/.test(
    text,
  );
}
export async function extractRecords(page: Page, schema: ExtractionSchema, maxCount: number = 10) {
  try {
    const rawRecords = await page.evaluate(({ fields, maxLimit }) => {
      // Find candidate item/card container elements on the web page
      const selectors = [
        "[data-id]",
        "article",
        "li:has(a)",
        "[class*='product']",
        "[class*='card']",
        "[class*='item']",
        "[class*='grid'] > div",
        "div[class*='cPH']",
        "div[class*='75W']",
        "div[class*='row']:has(a)"
      ];

      let containers: Element[] = [];
      for (const sel of selectors) {
        const found = Array.from(document.querySelectorAll(sel));
        if (found.length >= 2) {
          containers = found.slice(0, maxLimit);
          break;
        }
      }

      // Fallback: If no distinct repeating container found, pick top child blocks with anchor tags
      if (!containers.length) {
        const anchors = Array.from(document.querySelectorAll("body a[href]"));
        containers = anchors
          .map(a => a.closest("div, article, li") || a)
          .filter((v, i, self) => self.indexOf(v) === i)
          .slice(0, maxLimit);
      }

      if (!containers.length) return [];

      return containers.map((el, idx) => {
        const textContent = (el as HTMLElement).innerText || "";
        const lines = textContent
          .split("\n")
          .map(l => l.trim())
          .filter(Boolean);

        const anchor = el.querySelector("a[href]") as HTMLAnchorElement | null;
        const linkHref = anchor ? anchor.href : "";

        // Find price pattern (e.g. ₹99,999 or $999 or 99,900)
        const priceLine = lines.find(l => /[₹$€]\s?[\d,]+|[\d,]{4,}\s?(INR|USD)?/i.test(l)) || "";

        // Find rating pattern (e.g. 4.5 ★ or 4.5/5)
        const ratingLine = lines.find(l => /[\d\.]+\s?★|[\d\.]+\s?out of\s?5/i.test(l)) || "";

        // Find main title/name (usually longest prominent line or header tag)
        const headerEl = el.querySelector("h1, h2, h3, h4, [class*='title'], [class*='name'], a");
        const titleText = headerEl?.textContent?.trim() || lines[0] || `Item ${idx + 1}`;

        const itemObj: Record<string, any> = {};

        for (const f of fields) {
          const fieldKey = f.name.toLowerCase();
          if (fieldKey.includes("url") || fieldKey.includes("link")) {
            itemObj[f.name] = linkHref || window.location.href;
          } else if (fieldKey.includes("price") || fieldKey.includes("amount") || fieldKey.includes("inr")) {
            itemObj[f.name] = priceLine || lines.find(l => /\d/.test(l)) || "N/A";
          } else if (fieldKey.includes("rating") || fieldKey.includes("score")) {
            itemObj[f.name] = ratingLine || "N/A";
          } else if (fieldKey.includes("rank") || fieldKey.includes("position")) {
            itemObj[f.name] = `#${idx + 1}`;
          } else if (fieldKey.includes("name") || fieldKey.includes("title") || fieldKey.includes("product")) {
            itemObj[f.name] = titleText;
          } else if (fieldKey.includes("spec") || fieldKey.includes("desc") || fieldKey.includes("feature")) {
            itemObj[f.name] = lines.slice(1, 4).join(" | ") || titleText;
          } else {
            itemObj[f.name] = lines.find(l => l !== titleText && l !== priceLine) || titleText;
          }
        }
        return itemObj;
      });
    }, { fields: schema.fields as any, maxLimit: maxCount });

    if (Array.isArray(rawRecords) && rawRecords.length > 0) {
      return rawRecords;
    }
  } catch (err) {
    console.warn("[EXTRACT_RECORDS ERROR]:", err);
  }

  // Basic fallback if evaluate returned empty
  const fallbackRec: Record<string, any> = {};
  for (const f of schema.fields) {
    fallbackRec[f.name] = f.name.includes("url") ? page.url() : `Extracted ${f.name}`;
  }
  return [fallbackRec];
}
function resolveWithin(base: any, l: Locator) {
  switch (l.strategy) {
    case "role":
      return base.getByRole(l.role, { name: l.name || l.value });
    case "label":
      return base.getByLabel(l.value || l.name || "");
    case "placeholder":
      return base.getByPlaceholder(l.value || "");
    case "testId":
      return base.getByTestId(l.value || "");
    case "text":
      return base.getByText(l.value || l.name || "", { exact: false });
    case "css":
      return base.locator(l.value || "");
  }
}
function coerce(raw: string, type: string) {
  const x = raw.trim();
  if (type === "number") return Number(x.replace(/[^0-9.-]/g, ""));
  if (type === "boolean") return /true|yes|available|active/i.test(x);
  if (type === "array")
    return x
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
  return x;
}
export async function executeStep(
  page: Page,
  step: WorkflowStep,
  credentials: Record<string, string>,
  schema: ExtractionSchema,
) {
  switch (step.type) {
    case "NAVIGATE":
      if (!step.url) throw new Error("NAVIGATE url missing");
      await page.goto(step.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      return;
    case "CLICK": {
      const locText = (step.locator?.name || step.locator?.value || step.description || "").toLowerCase();
      await resolveLocator(page, step.locator)
        .first()
        .click({ timeout: 15000 });
      if (/login|sign\s*in|submit|enter|search|send/i.test(locText)) {
        await page.waitForTimeout(3500).catch(() => {});
      }
      return;
    }
    case "TYPE": {
      const v = step.credentialRef
        ? credentials[step.credentialRef.replace(/^connection\./, "")]
        : step.value;
      if (v == null) throw new Error(`Missing value for ${step.id}`);
      await resolveLocator(page, step.locator).first().fill(v);
      return;
    }
    case "SELECT":
      await resolveLocator(page, step.locator)
        .first()
        .selectOption(step.value || "");
      return;
    case "CHECK":
      await resolveLocator(page, step.locator).first().check();
      return;
    case "UNCHECK":
      await resolveLocator(page, step.locator).first().uncheck();
      return;
    case "SCROLL":
      await page.mouse.wheel(0, Number(step.value || 1200));
      return;
    case "WAIT_FOR":
      await resolveLocator(page, step.locator)
        .first()
        .waitFor({ state: "visible", timeout: Number(step.value || 10000) });
      return;
    case "ASSERT":
      if (!(await resolveLocator(page, step.locator).first().isVisible()))
        throw new Error(`Assertion failed: ${step.description}`);
      return;
    case "SCREENSHOT":
      return;
    case "DOWNLOAD": {
      const dl = page.waitForEvent("download");
      await resolveLocator(page, step.locator).first().click();
      return (await dl).path();
    }
    case "UPLOAD":
      throw new Error(
        "UPLOAD requires an explicit file connection and is disabled by default",
      );
    case "EXTRACT": {
      if (step.value && typeof step.value === "string" && step.value.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(step.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`[EXTRACT] Using Gemini AI Navigator extracted JSON records (${parsed.length} items)`);
            return parsed;
          }
        } catch {}
      }
      return extractRecords(page, schema);
    }
    case "DONE":
      if (step.value && typeof step.value === "string" && step.value.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(step.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch {}
      }
      return;
  }
}
