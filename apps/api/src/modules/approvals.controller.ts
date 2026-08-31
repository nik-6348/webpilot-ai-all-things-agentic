import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { prisma, type Prisma } from "@webpilot/database";
import { TaskQueue } from "@webpilot/gcp";
import { requireWorkspace, audit } from "../common/context.js";
import { EmailService } from "./email.service.js";
import { assertSafeUrl } from "@webpilot/security";

@Controller("approvals")
export class ApprovalsController {
  constructor(private emailService: EmailService) {}

  @Get() async list(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    return prisma.approval.findMany({
      where: { workspaceId: m.workspaceId, status: "PENDING" },
      include: { run: { include: { agent: true } } },
      orderBy: { requestedAt: "desc" },
    });
  }

  @Post(":id/approve") async approve(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body?: { correctedUrl?: string },
  ) {
    const ap = await prisma.approval.findUniqueOrThrow({
      where: { id },
      include: { run: { include: { agent: true } } },
    });
    await requireWorkspace(req.user.id, ap.workspaceId, [
      "OWNER",
      "ADMIN",
      "OPERATOR",
    ]);
    if (ap.status !== "PENDING") return ap;

    // A HUMAN_VERIFICATION pause means the run got challenged at whatever
    // URL it started from -- if that was a bad auto-guessed default (e.g.
    // "google.com" itself triggers a bot-verification wall) rather than
    // the real target, resuming with the same URL just repeats the same
    // failure. Let the approver correct it here, applied before the run
    // is re-dispatched.
    if (ap.type === "HUMAN_VERIFICATION" && body?.correctedUrl && ap.run) {
      const correctedUrl = body.correctedUrl.trim();
      await assertSafeUrl(correctedUrl, ap.run.agent.allowedDomains as string[]);
      await prisma.agent.update({
        where: { id: ap.run.agentId },
        data: { targetUrl: correctedUrl },
      });
    }

    if (ap.type === "ONBOARDING") {
      const payload: any = ap.payload || {};
      const email = (payload.email || "").toLowerCase();
      const name = payload.name || "Enterprise User";
      const wsName = payload.requestedWorkspaceName || `${name}'s Workspace`;

      if (!email) throw new Error("Invalid onboarding payload: email missing");

      let targetUser = await prisma.user.findUnique({ where: { email } });
      if (!targetUser) {
        targetUser = await prisma.user.create({
          data: {
            identityProviderUid: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            email,
            displayName: name,
            passwordHash: payload.passwordHash || null,
            isActive: true,
          },
        });
      } else {
        await prisma.user.update({
          where: { id: targetUser.id },
          data: { isActive: true },
        });
      }

      const slug = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newWs = await prisma.workspace.create({
        data: {
          name: wsName,
          slug,
          members: {
            create: {
              userId: targetUser.id,
              role: "OWNER",
            },
          },
        },
      });

      await prisma.workspaceSetting.create({
        data: { workspaceId: newWs.id },
      });

      await prisma.approval.update({
        where: { id },
        data: {
          status: "APPROVED",
          resolvedBy: req.user.id,
          resolvedAt: new Date(),
        },
      });

      // Send confirmation email via Resend
      await this.emailService.sendEmail({
        to: email,
        subject: `🎉 Onboarding Request Approved — Welcome to WebPilot AI!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
            <h2 style="color: #0284c7;">🎉 Access Request Approved!</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your onboarding request for WebPilot AI has been <strong>Approved</strong> by the administrator.</p>
            <p><strong>Your Workspace:</strong> ${wsName}</p>
            <p>You can now log in to access your autonomous RPA workspace using your registered credentials.</p>
            <a href="${process.env.API_PUBLIC_URL || "http://localhost:3000"}/login" style="display: inline-block; padding: 12px 24px; background: #0284c7; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px;">Login to Workspace &rarr;</a>
          </div>
        `,
      });

      await audit(ap.workspaceId, req.user.id, "ONBOARDING_APPROVED", "workspace", newWs.id, { userId: targetUser.id });
      return { ok: true, workspaceId: newWs.id };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.approval.update({
        where: { id },
        data: {
          status: "APPROVED",
          resolvedBy: req.user.id,
          resolvedAt: new Date(),
        },
      });
      if (ap.runId)
        await tx.run.update({
          where: { id: ap.runId },
          data: { status: "QUEUED" },
        });
    });
    if (ap.runId) await new TaskQueue().enqueueRun(ap.runId);
    await audit(
      ap.workspaceId,
      req.user.id,
      "APPROVAL_APPROVED",
      "approval",
      id,
    );
    return { ok: true };
  }

  @Post(":id/reject") async reject(@Req() req: any, @Param("id") id: string) {
    const ap = await prisma.approval.findUniqueOrThrow({
      where: { id },
      include: { run: true },
    });
    await requireWorkspace(req.user.id, ap.workspaceId, [
      "OWNER",
      "ADMIN",
      "OPERATOR",
    ]);
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.approval.update({
        where: { id },
        data: {
          status: "REJECTED",
          resolvedBy: req.user.id,
          resolvedAt: new Date(),
        },
      });
      if (ap.runId)
        await tx.run.update({
          where: { id: ap.runId },
          data: { status: "REJECTED" },
        });
    });

    if (ap.type === "ONBOARDING") {
      const payload: any = ap.payload || {};
      if (payload.email) {
        await this.emailService.sendEmail({
          to: payload.email,
          subject: `WebPilot AI — Onboarding Request Status Update`,
          html: `<p>Hello ${payload.name || "Applicant"},</p><p>Your onboarding request was reviewed and could not be approved at this time. Please contact your organization administrator for details.</p>`,
        });
      }
    }

    return { ok: true };
  }
}
