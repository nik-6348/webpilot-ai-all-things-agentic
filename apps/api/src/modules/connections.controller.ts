import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
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
@Controller("connections")
export class ConnectionsController {
  @Get() async list(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    const rows = await prisma.connection.findMany({
      where: { workspaceId: m.workspaceId },
    });
    return rows.map(({ secretManagerRef, ...x }: any) => ({
      ...x,
      configured: true,
    }));
  }
  @Post() async create(@Req() req: any, @Body() body: unknown) {
    const x = Create.parse(body);
    await requireWorkspace(req.user.id, x.workspaceId, ["OWNER", "ADMIN"]);
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
}
