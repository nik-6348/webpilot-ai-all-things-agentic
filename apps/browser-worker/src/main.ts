import Fastify from "fastify";
import { executeRun } from "./engine.js";
const app = Fastify({ logger: true, connectionTimeout: 600000, requestTimeout: 600000 });
app.get("/health/live", async () => ({ ok: true, service: "browser-worker" }));
app.get("/health/ready", async () => ({ ok: true }));
app.post<{ Params: { runId: string } }>(
  "/internal/runs/:runId/execute",
  async (req, reply) => {
    if (
      process.env.LOCAL_TASKS === "true" &&
      req.headers["x-internal-token"] !== process.env.INTERNAL_WORKER_TOKEN
    )
      return reply.code(401).send({ error: "unauthorized" });
    try {
      return await executeRun(req.params.runId);
    } catch (e: any) {
      reply.code(500);
      return { error: e.message };
    }
  },
);
await app.listen({ port: Number(process.env.PORT || 4100), host: "0.0.0.0" });
