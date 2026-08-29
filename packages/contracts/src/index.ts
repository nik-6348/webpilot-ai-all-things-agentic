import { z } from "zod";

export const LocatorSchema = z.object({
  strategy: z.enum(["role", "label", "placeholder", "testId", "text", "css"]),
  value: z.string().optional(),
  role: z.string().optional(),
  name: z.string().optional(),
});
export type Locator = z.infer<typeof LocatorSchema>;

export const ExtractionFieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "date", "url", "array"]),
  required: z.boolean().default(false),
  description: z.string().optional(),
});
export const ExtractionSchemaSchema = z.object({ fields: z.array(ExtractionFieldSchema).min(1) });
export type ExtractionSchema = z.infer<typeof ExtractionSchemaSchema>;

export const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["NAVIGATE", "CLICK", "TYPE", "SELECT", "CHECK", "UNCHECK", "SCROLL", "WAIT_FOR", "EXTRACT", "DOWNLOAD", "UPLOAD", "ASSERT", "SCREENSHOT", "DONE"]),
  description: z.string().min(1),
  locator: LocatorSchema.optional(),
  value: z.string().optional(),
  url: z.string().url().optional(),
  credentialRef: z.string().optional(),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSpecSchema = z.object({
  version: z.literal(1),
  goal: z.string().min(3),
  startUrl: z.string().url(),
  allowedDomains: z.array(z.string().min(1)).min(1),
  extractionSchema: ExtractionSchemaSchema,
  steps: z.array(WorkflowStepSchema).max(40),
});
export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>;

export const PlanSchema = z.object({
  summary: z.string(),
  requiresApproval: z.boolean().default(true),
  workflow: WorkflowSpecSchema,
});
export type Plan = z.infer<typeof PlanSchema>;

export const BrowserDecisionSchema = z.object({
  action: WorkflowStepSchema,
  done: z.boolean(),
  rationale: z.string(),
});
export type BrowserDecision = z.infer<typeof BrowserDecisionSchema>;

export const WorkflowPatchSchema = z.object({
  failedStepId: z.string(),
  replacement: WorkflowStepSchema,
  diagnosis: z.string(),
  confidence: z.number().min(0).max(1),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
});
export type WorkflowPatch = z.infer<typeof WorkflowPatchSchema>;

export const VerificationSchema = z.object({
  verdict: z.enum(["PASS", "FAIL", "HUMAN_REVIEW"]),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});
export type Verification = z.infer<typeof VerificationSchema>;

export const RunStatus = z.enum([
  "CREATED", "PLANNING", "WAITING_PLAN_APPROVAL", "QUEUED", "RUNNING_DISCOVERY", "RUNNING_FAST_PATH",
  "VALIDATING", "RECOVERING", "VERIFYING_RECOVERY", "WAITING_RECOVERY_APPROVAL", "WAITING_HIGH_RISK_APPROVAL",
  "WAITING_HUMAN_VERIFICATION", "COMPLETED", "FAILED", "CANCELLED", "REJECTED"
]);
export type RunStatus = z.infer<typeof RunStatus>;

export const RunTrigger = z.enum(["MANUAL", "SCHEDULE", "SLACK", "EMAIL", "API"]);
export type RunTrigger = z.infer<typeof RunTrigger>;

export type RunEventInput = { type: string; message: string; source: string; metadata?: Record<string, unknown> };
