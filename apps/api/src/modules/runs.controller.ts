import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { prisma } from "@webpilot/database";
import { TaskQueue } from "@webpilot/gcp";
import { requireWorkspace, audit } from "../common/context.js";
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
        agent: true,
        version: true,
        events: { orderBy: { createdAt: "asc" } },
        steps: { orderBy: { sequenceNumber: "asc" } },
        recoveries: true,
        modelInvocations: true,
        approvals: true,
      },
    });
    await requireWorkspace(req.user.id, run.workspaceId);
    return run;
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
}
