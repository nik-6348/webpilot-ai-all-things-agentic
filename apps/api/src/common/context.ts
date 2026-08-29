import { ForbiddenException } from "@nestjs/common";
import { prisma } from "@webpilot/database";
export async function requireWorkspace(
  userId: string,
  workspaceId?: string,
  roles?: string[],
) {
  let membership;
  if (workspaceId)
    membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: true },
    });
  else
    membership = await prisma.workspaceMember.findFirst({
      where: { userId },
      include: { workspace: true },
      orderBy: { id: "asc" },
    });
  if (!membership || (roles && !roles.includes(membership.role)))
    throw new ForbiddenException("Workspace access denied");
  return membership;
}
export async function audit(
  workspaceId: string,
  actorId: string | undefined,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: unknown,
) {
  await prisma.auditLog.create({
    data: {
      workspaceId,
      actorId,
      action,
      resourceType,
      resourceId,
      metadata: metadata as any,
    },
  });
}
