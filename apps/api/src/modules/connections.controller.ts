import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { prisma } from "@webpilot/database";
import { SecretVault } from "@webpilot/gcp";
import { requireWorkspace, audit } from "../common/context.js";
import { z } from "zod";

const Create = z.object({
  workspaceId: z.string(),
  name: z.string(),
  allowedDomains: z.array(z.string()).min(1),
  credentials: z.record(z.string(), z.string()),
});

const Update = z.object({
  name: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
});

@Controller("connections")
export class ConnectionsController {
  @Get() async list(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    const rows = await prisma.connection.findMany({
      where: { workspaceId: m.workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(({ secretManagerRef, ...x }: any) => ({
      ...x,
      configured: true,
    }));
  }

  @Post() async create(@Req() req: any, @Body() body: unknown) {
    const x = Create.parse(body);
    await requireWorkspace(req.user.id, x.workspaceId, ["OWNER", "ADMIN", "OPERATOR"]);
    const ref = await new SecretVault().put(
      `connection-${x.workspaceId}-${crypto.randomUUID()}`,
      JSON.stringify(x.credentials),
    );
    const row = await prisma.connection.create({
      data: {
        workspaceId: x.workspaceId,
        name: x.name,
        allowedDomains: x.allowedDomains,
        credentialFields: Object.keys(x.credentials),
        secretManagerRef: ref,
      },
    });
    await audit(
      x.workspaceId,
      req.user.id,
      "CONNECTION_CREATED",
      "connection",
      row.id,
    );
    return { ...row, secretManagerRef: undefined, configured: true };
  }

  @Patch(":id") async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const conn = await prisma.connection.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, conn.workspaceId, ["OWNER", "ADMIN", "OPERATOR"]);
    const x = Update.parse(body);

    let ref = conn.secretManagerRef;
    if (x.credentials) {
      ref = await new SecretVault().put(
        `connection-${conn.workspaceId}-${crypto.randomUUID()}`,
        JSON.stringify(x.credentials),
      );
    }

    const updated = await prisma.connection.update({
      where: { id },
      data: {
        ...(x.name ? { name: x.name } : {}),
        ...(x.allowedDomains ? { allowedDomains: x.allowedDomains } : {}),
        ...(x.credentials ? { credentialFields: Object.keys(x.credentials), secretManagerRef: ref } : {}),
      },
    });

    await audit(conn.workspaceId, req.user.id, "CONNECTION_UPDATED", "connection", id);
    return { ...updated, secretManagerRef: undefined, configured: true };
  }

  @Delete(":id") async delete(@Req() req: any, @Param("id") id: string) {
    const conn = await prisma.connection.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, conn.workspaceId, ["OWNER", "ADMIN", "OPERATOR"]);
    await prisma.connection.delete({ where: { id } });
    await audit(conn.workspaceId, req.user.id, "CONNECTION_DELETED", "connection", id);
    return { success: true };
  }
}
