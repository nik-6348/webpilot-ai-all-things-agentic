import "dotenv/config";
import { prisma } from "../src/index.js";
const user = await prisma.user.upsert({
  where: { email: "demo@webpilot.local" },
  update: {},
  create: {
    identityProviderUid: "local-demo-user",
    email: "demo@webpilot.local",
    displayName: "Demo User",
  },
});
const ws = await prisma.workspace.upsert({
  where: { slug: "demo" },
  update: {},
  create: { name: "Demo Workspace", slug: "demo" },
});
await prisma.workspaceMember.upsert({
  where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } },
  update: { role: "OWNER" },
  create: { workspaceId: ws.id, userId: user.id, role: "OWNER" },
});
await prisma.workspaceSetting.upsert({
  where: { workspaceId: ws.id },
  update: {},
  create: { workspaceId: ws.id },
});
console.log({ userId: user.id, workspaceId: ws.id });
await prisma.$disconnect();

