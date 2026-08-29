import { Controller, Get, Patch, Query, Req, Body } from "@nestjs/common";
import { prisma } from "@webpilot/database";
import { requireWorkspace } from "../common/context.js";
import { z } from "zod";
const Settings = z.object({
  defaultModel: z.string().optional(),
  maxRunDuration: z.number().int().min(60).max(3600).optional(),
  maxRecoveryAttempts: z.number().int().min(0).max(5).optional(),
  retentionDays: z.number().int().min(7).max(365).optional(),
  autoPromoteLowRisk: z.boolean().optional(),
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
      select: { status: true, executionMode: true, modelCallCount: true },
    });
    return {
      runs: runs.length,
      completed: runs.filter((r: any) => r.status === "COMPLETED").length,
      fastPath: runs.filter((r: any) => r.executionMode === "FAST_PATH").length,
      zeroLlm: runs.filter((r: any) => r.modelCallCount === 0).length,
      modelCalls: runs.reduce((n: number, r: any) => n + r.modelCallCount, 0),
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
}
