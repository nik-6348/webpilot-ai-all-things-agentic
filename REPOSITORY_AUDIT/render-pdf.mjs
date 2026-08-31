import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(dir, "architecture-report.html");
const pdfPath = path.join(dir, "WebPilot-AI-Architecture.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => {
  const nodes = document.querySelectorAll(".mermaid-wrap");
  return Array.from(nodes).every((n) => n.querySelector("svg"));
}, { timeout: 30000 });
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  margin: { top: "0", bottom: "0", left: "0", right: "0" },
});
await browser.close();
console.log("PDF written to", pdfPath);
