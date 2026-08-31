import { Controller, Get, Patch, Post, Query, Req, Body } from "@nestjs/common";
import { prisma } from "@webpilot/database";
import { requireWorkspace, audit } from "../common/context.js";
import { z } from "zod";
const Settings = z.object({
  defaultModel: z.string().optional(),
  maxRunDuration: z.number().int().min(60).max(3600).optional(),
  maxRecoveryAttempts: z.number().int().min(0).max(5).optional(),
  retentionDays: z.number().int().min(7).max(365).optional(),
  autoPromoteLowRisk: z.boolean().optional(),
  allowGoogleLogin: z.boolean().optional(),
  allowEmailPasswordLogin: z.boolean().optional(),
  allowPublicOnboarding: z.boolean().optional(),
});
@Controller()
export class AdminController {
  @Get("analytics") async analytics(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    const runs = await prisma.run.findMany({
      where: { workspaceId: m.workspaceId },
      include: { agent: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const completed = runs.filter((r: any) => r.status === "COMPLETED");
    const directScriptRuns = runs.filter((r: any) => r.executionMode === "FAST_PATH" || r.modelCallCount === 0);
    const aiAgentRuns = runs.filter((r: any) => r.executionMode === "DISCOVERY" && r.modelCallCount > 0);

    const getDurationSec = (r: any) => {
      if (r.completedAt && r.startedAt) {
        const d = (new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000;
        if (d > 0) return d;
      }
      if ((r.result as any)?.totalDurationSec) {
        const parsed = parseFloat((r.result as any).totalDurationSec);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      return 0;
    };

    const directScriptLatencies = directScriptRuns.map(getDurationSec).filter((d: number) => d > 0);
    const aiAgentLatencies = aiAgentRuns.map(getDurationSec).filter((d: number) => d > 0);

    const avgScriptLatVal = directScriptLatencies.length > 0
      ? (directScriptLatencies.reduce((a: number, b: number) => a + b, 0) / directScriptLatencies.length)
      : 0;

    const avgAiLatVal = aiAgentLatencies.length > 0
      ? (aiAgentLatencies.reduce((a: number, b: number) => a + b, 0) / aiAgentLatencies.length)
      : 0;

    const avgScriptLatStr = avgScriptLatVal > 0 ? `${avgScriptLatVal.toFixed(1)}s` : "--";
    const avgAiLatStr = avgAiLatVal > 0 ? `${avgAiLatVal.toFixed(1)}s` : "--";

    const speedupMultiplier = (avgScriptLatVal > 0 && avgAiLatVal > 0)
      ? `${(avgAiLatVal / avgScriptLatVal).toFixed(1)}x`
      : null;

    const activeRun = runs.find((r: any) => ["IN_PROGRESS", "QUEUED", "WAITING_PLAN_APPROVAL"].includes(r.status));

    return {
      totalRuns: runs.length,
      completedRuns: completed.length,
      directScriptRunsCount: directScriptRuns.length,
      aiAgentRunsCount: aiAgentRuns.length,
      avgScriptLatStr,
      avgAiLatStr,
      speedupMultiplier,
      successRate: runs.length > 0 ? ((completed.length / runs.length) * 100).toFixed(0) : "0",
      activeRun: activeRun ? {
        id: activeRun.id,
        agentName: activeRun.agent?.name || "Autonomous Agent",
        goal: activeRun.agent?.goal || activeRun.id,
        status: activeRun.status,
      } : null,
      recentRuns: runs.slice(0, 10).map((r: any) => ({
        id: r.id,
        agentName: r.agent?.name || "Autonomous Scraper Agent",
        goal: r.agent?.goal || r.id,
        status: r.status,
        executionMode: r.executionMode,
        modelCallCount: r.modelCallCount,
        durationSec: getDurationSec(r).toFixed(2),
        createdAt: r.createdAt,
      })),
    };
  }
  @Get("audit") async audit(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    return prisma.auditLog.findMany({
      where: { workspaceId: m.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  @Get("settings") async settings(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    return prisma.workspaceSetting.upsert({
      where: { workspaceId: m.workspaceId },
      update: {},
      create: { workspaceId: m.workspaceId },
    });
  }
  @Patch("settings") async update(
    @Req() req: any,
    @Query("workspaceId") workspaceId: string,
    @Body() body: unknown,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId, [
      "OWNER",
      "ADMIN",
    ]);
    return prisma.workspaceSetting.update({
      where: { workspaceId: m.workspaceId },
      data: Settings.parse(body),
    });
  }

  @Post("purge") async purgeData(
    @Req() req: any,
    @Query("workspaceId") workspaceId: string,
    @Body() body: { target: "RUNS" | "FACTORY_RESET"; retentionDays?: number },
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId, ["OWNER"]);
    const target = body?.target || "RUNS";
    // Only RUNS and FACTORY_RESET are implemented and reachable from the
    // UI. The type used to also declare AGENTS/SCHEDULES, which fell
    // through to this same code with no matching branch — a silent no-op
    // that still returned {ok:true} and wrote an audit log claiming the
    // purge happened.
    if (target !== "RUNS" && target !== "FACTORY_RESET")
      throw new Error(`Unsupported purge target: ${target}`);
    let count = 0;

    if (target === "RUNS") {
      const days = body.retentionDays || 30;
      const cutoff = new Date(Date.now() - days * 86400 * 1000);
      const oldRuns = await prisma.run.findMany({
        where: { workspaceId: m.workspaceId, createdAt: { lt: cutoff } },
        select: { id: true },
      });
      const ids = oldRuns.map((r: any) => r.id);
      if (ids.length) {
        await prisma.$transaction([
          prisma.runEvent.deleteMany({ where: { runId: { in: ids } } }),
          prisma.runStep.deleteMany({ where: { runId: { in: ids } } }),
          prisma.approval.deleteMany({ where: { runId: { in: ids } } }),
          prisma.modelInvocation.deleteMany({ where: { runId: { in: ids } } }),
          prisma.run.deleteMany({ where: { id: { in: ids } } }),
        ]);
        count = ids.length;
      }
    } else if (target === "FACTORY_RESET") {
      const allRuns = await prisma.run.findMany({ where: { workspaceId: m.workspaceId }, select: { id: true } });
      const ids = allRuns.map((r: any) => r.id);
      if (ids.length) {
        await prisma.$transaction([
          prisma.runEvent.deleteMany({ where: { runId: { in: ids } } }),
          prisma.runStep.deleteMany({ where: { runId: { in: ids } } }),
          prisma.approval.deleteMany({ where: { runId: { in: ids } } }),
          prisma.modelInvocation.deleteMany({ where: { runId: { in: ids } } }),
          prisma.run.deleteMany({ where: { workspaceId: m.workspaceId } }),
        ]);
      }
      await prisma.schedule.deleteMany({ where: { workspaceId: m.workspaceId } });
      await prisma.agentVersion.deleteMany({ where: { agent: { workspaceId: m.workspaceId } } });
      await prisma.agent.deleteMany({ where: { workspaceId: m.workspaceId } });
      count = ids.length;
    }

    await audit(m.workspaceId, req.user.id, `PURGE_${target}`, "workspace", m.workspaceId);
    return { ok: true, target, purgedCount: count };
  }
}
