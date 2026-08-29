import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { prisma } from "@webpilot/database";
import { z } from "zod";
import { planWorkflow } from "@webpilot/agents";
import { assertSafeUrl } from "@webpilot/security";
import { requireWorkspace, audit } from "../common/context.js";
import { TaskQueue } from "@webpilot/gcp";
import { WorkflowSpecSchema } from "@webpilot/contracts";
const Create = z.object({
  workspaceId: z.string(),
  name: z.string().min(2),
  description: z.string().optional(),
  goal: z.string().min(5),
  targetUrl: z.string().url(),
  allowedDomains: z.array(z.string()).min(1),
  connectionId: z.string().optional(),
  requirePlanApproval: z.boolean().default(true),
});
async function validateConnection(
  workspaceId: string,
  connectionId: string | undefined,
  targetUrl: string,
) {
  if (!connectionId) return undefined;
  const connection = await prisma.connection.findUniqueOrThrow({
    where: { id: connectionId },
  });
  if (connection.workspaceId !== workspaceId)
    throw new Error("Connection does not belong to this workspace");
  await assertSafeUrl(targetUrl, connection.allowedDomains as string[]);
  return connection;
}

@Controller("agents")
export class AgentsController {
  @Get() async list(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    return prisma.agent.findMany({
      where: { workspaceId: m.workspaceId },
      include: {
        versions: { orderBy: { createdAt: "desc" }, take: 3 },
        schedules: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
  @Get(":id") async get(@Req() req: any, @Param("id") id: string) {
    const a = await prisma.agent.findUniqueOrThrow({
      where: { id },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        runs: { take: 20, orderBy: { createdAt: "desc" } },
      },
    });
    await requireWorkspace(req.user.id, a.workspaceId);
    return a;
  }
  @Post() async create(@Req() req: any, @Body() body: unknown) {
    const x = Create.parse(body);
    await requireWorkspace(req.user.id, x.workspaceId, [
      "OWNER",
      "ADMIN",
      "OPERATOR",
    ]);
    await assertSafeUrl(x.targetUrl, x.allowedDomains);
    const connection = await validateConnection(
      x.workspaceId,
      x.connectionId,
      x.targetUrl,
    );
    const a = await prisma.agent.create({
      data: {
        workspaceId: x.workspaceId,
        name: x.name,
        description: x.description,
        goal: x.goal,
        targetUrl: x.targetUrl,
        allowedDomains: x.allowedDomains,
        connectionId: x.connectionId,
      },
    });
    await audit(x.workspaceId, req.user.id, "AGENT_CREATED", "agent", a.id);
    const planStarted = Date.now();
    const plan = await planWorkflow({
      goal: x.goal,
      targetUrl: x.targetUrl,
      allowedDomains: x.allowedDomains,
      credentialFields: connection?.credentialFields as string[] | undefined,
    });
    // Enforce user-approved URL/domain boundary over model output.
    plan.workflow.startUrl = x.targetUrl;
    plan.workflow.allowedDomains = x.allowedDomains;
    const version = await prisma.agentVersion.create({
      data: {
        agentId: a.id,
        label: "v1.0-draft",
        source: "AI_DISCOVERY",
        status: "DRAFT",
        workflowSpec: plan.workflow as any,
        extractionSchema: plan.workflow.extractionSchema as any,
        riskLevel: plan.workflow.steps.some((s) => s.risk === "HIGH")
          ? "HIGH"
          : "LOW",
      },
    });
    const run = await prisma.run.create({
      data: {
        workspaceId: x.workspaceId,
        agentId: a.id,
        versionId: version.id,
        triggerType: "MANUAL",
        status: x.requirePlanApproval ? "WAITING_PLAN_APPROVAL" : "QUEUED",
        executionMode: "DISCOVERY",
        idempotencyKey: `plan-${a.id}-${Date.now()}`,
      },
    });
    await prisma.modelInvocation.create({
      data: {
        runId: run.id,
        agentType: "PLANNER",
        model: process.env.GEMINI_MODEL || "gemini-3.7-flash",
        latencyMs: Date.now() - planStarted,
        success: true,
      },
    });
    await prisma.run.update({
      where: { id: run.id },
      data: { modelCallCount: { increment: 1 } },
    });
    if (x.requirePlanApproval)
      await prisma.approval.create({
        data: {
          workspaceId: x.workspaceId,
          runId: run.id,
          type: "PLAN",
          reason: "Approve AI-generated workflow plan",
          payload: plan as any,
          riskLevel: "MEDIUM",
        },
      });
    else await new TaskQueue().enqueueRun(run.id);
    return { agent: a, plan, version, run };
  }
  @Patch(":id/versions/:versionId") async editVersion(
    @Req() req: any,
    @Param("id") id: string,
    @Param("versionId") versionId: string,
    @Body() body: any,
  ) {
    const a = await prisma.agent.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, a.workspaceId, [
      "OWNER",
      "ADMIN",
      "OPERATOR",
    ]);
    const v = await prisma.agentVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    if (v.agentId !== id || v.status !== "DRAFT")
      throw new Error("Only draft versions can be edited");
    const spec = WorkflowSpecSchema.parse(body.workflowSpec);
    spec.allowedDomains = a.allowedDomains as string[];
    spec.startUrl = a.targetUrl;
    const out = await prisma.agentVersion.update({
      where: { id: versionId },
      data: {
        workflowSpec: spec as any,
        extractionSchema: spec.extractionSchema as any,
        source: "USER_EDIT",
      },
    });
    await audit(
      a.workspaceId,
      req.user.id,
      "VERSION_EDITED",
      "agent_version",
      versionId,
    );
    return out;
  }
  @Post(":id/versions/:versionId/activate") async activate(
    @Req() req: any,
    @Param("id") id: string,
    @Param("versionId") versionId: string,
  ) {
    const a = await prisma.agent.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, a.workspaceId, ["OWNER", "ADMIN"]);
    const v = await prisma.agentVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    if (v.agentId !== id) throw new Error("Version mismatch");
    await prisma.$transaction([
      prisma.agentVersion.updateMany({
        where: { agentId: id, status: "PRODUCTION" },
        data: { status: "ARCHIVED" },
      }),
      prisma.agentVersion.update({
        where: { id: versionId },
        data: { status: "PRODUCTION", promotedAt: new Date() },
      }),
      prisma.agent.update({
        where: { id },
        data: { activeVersionId: versionId },
      }),
    ]);
    await audit(
      a.workspaceId,
      req.user.id,
      "VERSION_ACTIVATED",
      "agent_version",
      versionId,
    );
    return { ok: true };
  }
  @Post(":id/versions/:versionId/run") async runVersion(
    @Req() req: any,
    @Param("id") id: string,
    @Param("versionId") versionId: string,
  ) {
    const a = await prisma.agent.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, a.workspaceId, [
      "OWNER",
      "ADMIN",
      "OPERATOR",
    ]);
    const v = await prisma.agentVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    if (v.agentId !== id) throw new Error("Version mismatch");
    const run = await prisma.run.create({
      data: {
        workspaceId: a.workspaceId,
        agentId: id,
        versionId,
        triggerType: "MANUAL",
        status: "QUEUED",
        executionMode: "FAST_PATH",
        idempotencyKey: `version-${versionId}-${crypto.randomUUID()}`,
      },
    });
    await new TaskQueue().enqueueRun(run.id);
    return run;
  }

  @Patch(":id") async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const a = await prisma.agent.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, a.workspaceId, ["OWNER", "ADMIN"]);
    const targetUrl = body.targetUrl || a.targetUrl;
    const domains = body.allowedDomains || (a.allowedDomains as string[]);
    await assertSafeUrl(targetUrl, domains);
    if (body.connectionId !== undefined)
      await validateConnection(
        a.workspaceId,
        body.connectionId || undefined,
        targetUrl,
      );
    const out = await prisma.agent.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        status: body.status,
        targetUrl: body.targetUrl,
        allowedDomains: body.allowedDomains,
        connectionId: body.connectionId,
        rowVersion: { increment: 1 },
      },
    });
    await audit(a.workspaceId, req.user.id, "AGENT_UPDATED", "agent", id);
    return out;
  }
}
