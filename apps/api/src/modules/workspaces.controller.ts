import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, ForbiddenException } from "@nestjs/common";
import { prisma } from "@webpilot/database";
import { z } from "zod";
import { audit, requireWorkspace } from "../common/context.js";
import { hashPassword } from "./auth.controller.js";

const Create = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
});

const AddMemberSchema = z.object({
  workspaceId: z.string().optional(),
  email: z.string().email(),
  displayName: z.string().optional(),
  role: z.enum(["OWNER", "ADMIN", "OPERATOR", "VIEWER"]).default("OPERATOR"),
  password: z.string().optional(),
});

const UpdateStatusSchema = z.object({
  workspaceId: z.string().optional(),
  isActive: z.boolean(),
});

const SetPasswordSchema = z.object({
  workspaceId: z.string().optional(),
  password: z.string().min(4),
});

@Controller("workspaces")
export class WorkspacesController {
  @Get() async list(@Req() req: any) {
    return prisma.workspaceMember.findMany({
      where: { userId: req.user.id },
      include: { workspace: true },
    });
  }

  @Get("members") async listMembers(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    return prisma.workspaceMember.findMany({
      where: { workspaceId: m.workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: { user: { createdAt: "desc" } },
    });
  }

  @Post("members") async addMember(
    @Req() req: any,
    @Body() body: unknown,
  ) {
    const data = AddMemberSchema.parse(body);
    const m = await requireWorkspace(req.user.id, data.workspaceId, ["OWNER", "ADMIN"]);

    const email = data.email.toLowerCase();
    let targetUser = await prisma.user.findUnique({ where: { email } });

    if (!targetUser) {
      targetUser = await prisma.user.create({
        data: {
          identityProviderUid: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          email,
          displayName: data.displayName || email.split("@")[0],
          passwordHash: data.password ? hashPassword(data.password) : null,
          isActive: true,
        },
      });
    } else if (data.password) {
      await prisma.user.update({
        where: { id: targetUser.id },
        data: { passwordHash: hashPassword(data.password) },
      });
    }

    const member = await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: m.workspaceId,
          userId: targetUser.id,
        },
      },
      update: { role: data.role },
      create: {
        workspaceId: m.workspaceId,
        userId: targetUser.id,
        role: data.role,
      },
      include: { user: true },
    });

    await audit(m.workspaceId, req.user.id, "MEMBER_ADDED", "user", targetUser.id, { role: data.role });
    return member;
  }

  @Patch("members/:userId/status") async updateMemberStatus(
    @Req() req: any,
    @Param("userId") userId: string,
    @Body() body: unknown,
  ) {
    const data = UpdateStatusSchema.parse(body);
    const m = await requireWorkspace(req.user.id, data.workspaceId, ["OWNER", "ADMIN"]);

    if (userId === req.user.id) {
      throw new ForbiddenException("You cannot deactivate your own account.");
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: data.isActive },
    });

    await audit(m.workspaceId, req.user.id, data.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", "user", userId);
    return { success: true, user: updatedUser };
  }

  @Post("members/:userId/password") async setMemberPassword(
    @Req() req: any,
    @Param("userId") userId: string,
    @Body() body: unknown,
  ) {
    const data = SetPasswordSchema.parse(body);
    const m = await requireWorkspace(req.user.id, data.workspaceId, ["OWNER", "ADMIN"]);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(data.password) },
    });

    await audit(m.workspaceId, req.user.id, "PASSWORD_RESET", "user", userId);
    return { success: true, message: "Password updated successfully." };
  }

  @Delete("members/:userId") async removeMember(
    @Req() req: any,
    @Param("userId") userId: string,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId, ["OWNER", "ADMIN"]);

    if (userId === req.user.id) {
      throw new ForbiddenException("You cannot remove yourself from the workspace.");
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId: m.workspaceId,
          userId,
        },
      },
    });

    await audit(m.workspaceId, req.user.id, "MEMBER_REMOVED", "user", userId);
    return { success: true, message: "Member removed from workspace." };
  }

  @Get("audit") async listAuditLogs(
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

  @Post() async create(@Req() req: any, @Body() body: unknown) {
    const x = Create.parse(body);
    const ws = await prisma.workspace.create({
      data: {
        ...x,
        members: { create: { userId: req.user.id, role: "OWNER" } },
      },
    });
    await prisma.workspaceSetting.create({ data: { workspaceId: ws.id } });
    await audit(ws.id, req.user.id, "WORKSPACE_CREATED", "workspace", ws.id);
    return ws;
  }

  @Patch(":id") async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const m = await requireWorkspace(req.user.id, id, ["OWNER", "ADMIN"]);
    const schema = z.object({
      name: z.string().min(2).optional(),
      slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
    });
    const data = schema.parse(body);

    const updated = await prisma.workspace.update({
      where: { id: m.workspaceId },
      data,
    });

    await audit(m.workspaceId, req.user.id, "WORKSPACE_UPDATED", "workspace", m.workspaceId, data);
    return updated;
  }

  @Delete(":id") async delete(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const m = await requireWorkspace(req.user.id, id, ["OWNER"]);
    
    const userMemberships = await prisma.workspaceMember.count({
      where: { userId: req.user.id },
    });

    if (userMemberships <= 1) {
      throw new ForbiddenException("You cannot delete your only workspace. Create another workspace first.");
    }

    await prisma.workspace.delete({
      where: { id: m.workspaceId },
    });

    return { success: true, message: "Workspace deleted successfully." };
  }
}
