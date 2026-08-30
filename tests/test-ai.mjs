import { planWorkflow } from "../packages/agents/dist/index.js";

console.log("🚀 Testing Live AI Model Call (planWorkflow)...");
console.log(`☁️ GOOGLE_GENAI_USE_VERTEXAI = ${process.env.GOOGLE_GENAI_USE_VERTEXAI}`);
console.log(`📁 GOOGLE_CLOUD_PROJECT = ${process.env.GOOGLE_CLOUD_PROJECT}`);
console.log(`📍 GOOGLE_CLOUD_LOCATION = ${process.env.GOOGLE_CLOUD_LOCATION}`);

try {
  const result = await planWorkflow({
    goal: "Open purchase orders and extract ID, supplier, status, ETA and amount.",
    targetUrl: "https://www.flipkart.com",
    allowedDomains: ["*"],
  });

  console.log("\n🎉 [SUCCESS] Live AI Plan Generated Successfully!");
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("\n❌ [ERROR] Live AI Call Failed:", err);
}
