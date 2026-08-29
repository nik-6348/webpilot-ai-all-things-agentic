import { trace } from "@opentelemetry/api";
export const tracer = trace.getTracer("webpilot");
export function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      severity: "INFO",
      event,
      ...fields,
      ts: new Date().toISOString(),
    }),
  );
}
export function error(event: string, fields: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      severity: "ERROR",
      event,
      ...fields,
      ts: new Date().toISOString(),
    }),
  );
}
