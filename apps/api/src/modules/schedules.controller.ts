import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { prisma } from "@webpilot/database";
import { SchedulerService } from "@webpilot/gcp";
import { requireWorkspace } from "../common/context.js";
import { z } from "zod";
import { Public } from "../common/public.decorator.js";
import { OAuth2Client } from "google-auth-library";
const Create = z.object({
  workspaceId: z.string(),
  agentId: z.string(),
  name: z.string(),
  cronExpression: z.string(),
  timezone: z.string().default("UTC"),
});
@Controller("schedules")
export class SchedulesController {
  @Get() async list(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    return prisma.schedule.findMany({
      where: { workspaceId: m.workspaceId },
      include: { agent: true },
    });
  }
  @Post() async create(@Req() req: any, @Body() body: unknown) {
    const x = Create.parse(body);
    await requireWorkspace(req.user.id, x.workspaceId, ["OWNER", "ADMIN"]);
    const row = await prisma.schedule.create({
      data: {
        workspaceId: x.workspaceId,
        agentId: x.agentId,
        name: x.name,
        cronExpression: x.cronExpression,
        timezone: x.timezone,
      },
    });
    const api = process.env.API_PUBLIC_URL || "http://localhost:4000";
    const job = await new SchedulerService().upsert(
      `webpilot-${row.id}`,
      x.cronExpression,
      x.timezone,
      `${api}/api/v1/schedules/${row.id}/trigger`,
    );
    return prisma.schedule.update({
      where: { id: row.id },
      data: { schedulerJobName: job },
    });
  }
  @Public() @Post(":id/trigger") async trigger(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    if (process.env.LOCAL_SCHEDULER !== "true") {
      const token = String(req.headers.authorization || "").replace(
        /^Bearer /,
        "",
      );
      if (!token) throw new Error("Missing scheduler OIDC token");
      const audience =
        process.env.SCHEDULER_AUDIENCE ||
        `${process.env.API_PUBLIC_URL}/api/v1/schedules/${id}/trigger`;
      await new OAuth2Client().verifyIdToken({ idToken: token, audience });
    }
    const s = await prisma.schedule.findUniqueOrThrow({
      where: { id },
      include: { agent: true },
    });
    // A disabled schedule's Cloud Scheduler job may still fire while the
    // remove/re-upsert call below is propagating — this is the actual
    // enforcement point, so it must always be checked here regardless.
    if (!s.enabled) return { ok: true, skipped: true, reason: "schedule disabled" };
    const run = await prisma.run.create({
      data: {
        workspaceId: s.workspaceId,
        agentId: s.agentId,
        versionId: s.agent.activeVersionId,
        triggerType: "SCHEDULE",
        status: "QUEUED",
        executionMode: s.agent.activeVersionId ? "FAST_PATH" : "DISCOVERY",
        idempotencyKey: `schedule-${s.id}-${Date.now()}`,
      },
    });
    await new (await import("@webpilot/gcp")).TaskQueue().enqueueRun(run.id);
    return { ok: true, runId: run.id };
  }
  @Post(":id/trigger-manual") async triggerManual(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const s = await prisma.schedule.findUniqueOrThrow({
      where: { id },
      include: { agent: true },
    });
    await requireWorkspace(req.user.id, s.workspaceId, [
      "OWNER",
      "ADMIN",
      "OPERATOR",
    ]);

    const run = await prisma.run.create({
      data: {
        workspaceId: s.workspaceId,
        agentId: s.agentId,
        versionId: s.agent.activeVersionId,
        triggerType: "SCHEDULE",
        status: "QUEUED",
        executionMode: s.agent.activeVersionId ? "FAST_PATH" : "DISCOVERY",
        idempotencyKey: `manual-schedule-${s.id}-${Date.now()}`,
      },
    });

    await new (await import("@webpilot/gcp")).TaskQueue().enqueueRun(run.id);
    return { ok: true, runId: run.id };
  }

  @Patch(":id") async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await prisma.schedule.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, s.workspaceId, ["OWNER", "ADMIN"]);
    const updated = await prisma.schedule.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.cronExpression !== undefined && { cronExpression: body.cronExpression }),
        ...(body.enabled !== undefined && { enabled: Boolean(body.enabled) }),
        ...(body.timezone !== undefined && { timezone: body.timezone }),
      },
      include: { agent: true },
    });

    // Editing a schedule previously only touched the DB row — the real
    // Cloud Scheduler job kept firing on its original cron forever, and
    // disabling never removed it. Re-sync it here so the DB row and the
    // actual scheduled job never drift apart.
    const cronOrTzChanged = body.cronExpression !== undefined || body.timezone !== undefined;
    const enabledChanged = body.enabled !== undefined;
    if (!updated.enabled && (enabledChanged || cronOrTzChanged) && updated.schedulerJobName) {
      await new SchedulerService().remove(updated.schedulerJobName);
    } else if (updated.enabled && (cronOrTzChanged || enabledChanged)) {
      const api = process.env.API_PUBLIC_URL || "http://localhost:4000";
      const job = await new SchedulerService().upsert(
        `webpilot-${updated.id}`,
        updated.cronExpression,
        updated.timezone,
        `${api}/api/v1/schedules/${updated.id}/trigger`,
      );
      if (job !== updated.schedulerJobName) {
        return prisma.schedule.update({
          where: { id },
          data: { schedulerJobName: job },
          include: { agent: true },
        });
      }
    }
    return updated;
  }

  @Delete(":id") async remove(@Req() req: any, @Param("id") id: string) {
    const s = await prisma.schedule.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, s.workspaceId, ["OWNER", "ADMIN"]);
    if (s.schedulerJobName)
      await new SchedulerService().remove(s.schedulerJobName);
    await prisma.schedule.delete({ where: { id } });
    return { ok: true };
  }
}
