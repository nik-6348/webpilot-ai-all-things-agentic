import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import { prisma } from "@webpilot/database";
import { TaskQueue, ArtifactStore } from "@webpilot/gcp";
import { requireWorkspace, audit } from "../common/context.js";
import { compileAuditArtifact } from "@webpilot/workflow-engine";
import { Public } from "../common/public.decorator.js";
import { z } from "zod";

const Start = z.object({
  agentId: z.string(),
  triggerType: z
    .enum(["MANUAL", "API", "SLACK", "EMAIL", "SCHEDULE"])
    .default("MANUAL"),
  forceLiveAi: z.boolean().optional(),
});

@Controller("runs")
export class RunsController {
  @Get() async list(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    return prisma.run.findMany({
      where: { workspaceId: m.workspaceId },
      include: { agent: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Get(":id/export") async exportRun(
    @Req() req: any,
    @Param("id") id: string,
    @Query("format") format = "json",
  ) {
    const run = await prisma.run.findUniqueOrThrow({
      where: { id },
      include: { agent: true },
    });
    await requireWorkspace(req.user.id, run.workspaceId);
    const records = ((run.result as any)?.records || []) as any[];
    if (format === "csv") {
      const keys = [...new Set(records.flatMap((r) => Object.keys(r)))];
      const esc = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`;
      return {
        filename: `${run.agent.name}-${run.id}.csv`,
        contentType: "text/csv",
        content: [
          keys.join(","),
          ...records.map((r) => keys.map((k) => esc(r[k])).join(",")),
        ].join("\n"),
      };
    }
    if (format === "md") {
      return {
        filename: `${run.agent.name}-${run.id}.md`,
        contentType: "text/markdown",
        content: `# ${run.agent.name}\n\nRun: ${run.id}\n\nRecords: ${records.length}\n\n\`\`\`json\n${JSON.stringify(records, null, 2)}\n\`\`\``,
      };
    }
    return {
      filename: `${run.agent.name}-${run.id}.json`,
      contentType: "application/json",
      content: JSON.stringify(run.result, null, 2),
    };
  }

  @Get(":id") async get(@Req() req: any, @Param("id") id: string) {
    const run = await prisma.run.findUniqueOrThrow({
      where: { id },
      include: {
        agent: {
          include: {
            versions: { orderBy: { createdAt: "desc" } }
          }
        },
        version: true,
        events: { orderBy: { createdAt: "asc" } },
        steps: { orderBy: { sequenceNumber: "asc" } },
        recoveries: true,
        modelInvocations: true,
        approvals: true,
      },
    });
    await requireWorkspace(req.user.id, run.workspaceId);
    let scriptCode = "// No compiled Playwright script available";
    if (run.version?.workflowSpec) {
      try {
        scriptCode = compileAuditArtifact(run.version.workflowSpec as any);
      } catch (err) {
        console.warn("Failed to compile audit artifact script:", err);
      }
    }

    const apiBase = process.env.API_PUBLIC_URL || process.env.API_URL || "http://localhost:4000";
    const toPublicUrl = (ref?: string) => {
      if (!ref) return null;
      if (ref.startsWith("http://") || ref.startsWith("https://")) return ref;
      return `${apiBase}/api/v1/runs/${run.id}/artifact?path=${encodeURIComponent(ref)}`;
    };

    const formattedEvents = run.events.map((evt: any) => {
      if (evt.metadata && typeof evt.metadata === "object") {
        const meta = evt.metadata as any;
        if (meta.screenshot) {
          return {
            ...evt,
            metadata: {
              ...meta,
              screenshot: toPublicUrl(meta.screenshot),
              rawScreenshotRef: meta.screenshot,
            },
          };
        }
      }
      return evt;
    });

    const formattedSteps = run.steps.map((step: any) => {
      if (step.metadata && typeof step.metadata === "object") {
        const meta = step.metadata as any;
        if (meta.screenshot) {
          return {
            ...step,
            metadata: {
              ...meta,
              screenshot: toPublicUrl(meta.screenshot),
              rawScreenshotRef: meta.screenshot,
            },
          };
        }
      }
      return step;
    });

    return {
      ...run,
      events: formattedEvents,
      steps: formattedSteps,
      scriptCode,
    };
  }

  @Post() async start(@Req() req: any, @Body() body: unknown) {
    const x = Start.parse(body);
    const a = await prisma.agent.findUniqueOrThrow({
      where: { id: x.agentId },
    });
    await requireWorkspace(req.user.id, a.workspaceId, [
      "OWNER",
      "ADMIN",
      "OPERATOR",
    ]);
    const version = (a.activeVersionId && !x.forceLiveAi)
      ? await prisma.agentVersion.findUnique({
          where: { id: a.activeVersionId },
        })
      : null;
    const run = await prisma.run.create({
      data: {
        workspaceId: a.workspaceId,
        agentId: a.id,
        versionId: version?.id,
        triggerType: x.triggerType,
        status: "QUEUED",
        executionMode: (version && !x.forceLiveAi) ? "FAST_PATH" : "DISCOVERY",
        idempotencyKey: `${a.id}-${crypto.randomUUID()}`,
      },
    });
    await new TaskQueue().enqueueRun(run.id);
    await audit(a.workspaceId, req.user.id, "RUN_CREATED", "run", run.id);
    return run;
  }

  @Post(":id/cancel") async cancel(@Req() req: any, @Param("id") id: string) {
    const run = await prisma.run.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, run.workspaceId, [
      "OWNER",
      "ADMIN",
      "OPERATOR",
    ]);
    return prisma.run.update({ where: { id }, data: { status: "CANCELLED" } });
  }

  @Public()
  @Get(":id/artifact") async getArtifact(
    @Req() req: any,
    @Param("id") id: string,
    @Query("path") artifactPath: string,
    @Res() res: any,
  ) {
    const run = await prisma.run.findUnique({ where: { id } });
    if (!run) return res.status(404).send("Run not found");
    
    if (req.user?.id) {
      try {
        await requireWorkspace(req.user.id, run.workspaceId);
      } catch (e) {
        // Allow public image viewing for run viewport captures
      }
    }

    if (!artifactPath) return res.status(400).send("Path query parameter required");

    const store = new ArtifactStore();
    try {
      const buf = await store.get(artifactPath);
      const isJpeg = artifactPath.endsWith(".jpg") || artifactPath.endsWith(".jpeg");
      const isPng = artifactPath.endsWith(".png");
      const contentType = isJpeg ? "image/jpeg" : isPng ? "image/png" : "application/octet-stream";
      
      if (typeof res.setHeader === "function") {
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (typeof res.set === "function") {
        res.set("Content-Type", contentType);
        res.set("Cache-Control", "public, max-age=86400");
      } else if (typeof res.header === "function") {
        res.header("Content-Type", contentType);
        res.header("Cache-Control", "public, max-age=86400");
      }

      if (typeof res.send === "function") {
        return res.send(buf);
      }
      return res.end ? res.end(buf) : buf;
    } catch (e: any) {
      return res.status(404).send(`Artifact not found: ${e.message}`);
    }
  }

  @Delete(":id") async deleteRun(@Req() req: any, @Param("id") id: string) {
    const run = await prisma.run.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, run.workspaceId, ["OWNER", "ADMIN"]);

    await prisma.$transaction([
      prisma.runEvent.deleteMany({ where: { runId: id } }),
      prisma.runStep.deleteMany({ where: { runId: id } }),
      prisma.approval.deleteMany({ where: { runId: id } }),
      prisma.modelInvocation.deleteMany({ where: { runId: id } }),
      prisma.run.delete({ where: { id } }),
    ]);

    await audit(run.workspaceId, req.user.id, "RUN_DELETED", "run", id);
    return { ok: true, id };
  }

  @Post("batch-delete") async batchDelete(@Req() req: any, @Body() body: { runIds: string[] }) {
    if (!Array.isArray(body?.runIds) || !body.runIds.length) {
      return { ok: true, deletedCount: 0 };
    }
    const runs = await prisma.run.findMany({ where: { id: { in: body.runIds } } });
    if (!runs.length) return { ok: true, deletedCount: 0 };

    await requireWorkspace(req.user.id, runs[0].workspaceId, ["OWNER", "ADMIN"]);

    await prisma.$transaction([
      prisma.runEvent.deleteMany({ where: { runId: { in: body.runIds } } }),
      prisma.runStep.deleteMany({ where: { runId: { in: body.runIds } } }),
      prisma.approval.deleteMany({ where: { runId: { in: body.runIds } } }),
      prisma.modelInvocation.deleteMany({ where: { runId: { in: body.runIds } } }),
      prisma.run.deleteMany({ where: { id: { in: body.runIds } } }),
    ]);

    await audit(runs[0].workspaceId, req.user.id, "RUNS_BATCH_DELETED", "run", body.runIds.join(","));
    return { ok: true, deletedCount: body.runIds.length };
  }
}
