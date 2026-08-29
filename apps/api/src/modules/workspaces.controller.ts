import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { prisma } from "@webpilot/database";
import { z } from "zod";
import { audit } from "../common/context.js";
const Create = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
});
@Controller("workspaces")
export class WorkspacesController {
  @Get() async list(@Req() req: any) {
    return prisma.workspaceMember.findMany({
      where: { userId: req.user.id },
      include: { workspace: true },
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
}
