// One-off: create a demo admin user + workspace for hackathon judges to
// sign in with email/password instead of needing their own Google account.
// Run inside the api image (has the compiled @webpilot/database package
// and a live Cloud SQL connection) via a Cloud Run Job execution.
import crypto from "node:crypto";
import { prisma } from "@webpilot/database";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const email = "admin@webpilot.ai";
const password = "admin@123";

const existing = await prisma.user.findUnique({ where: { email } });
let user;
if (existing) {
  user = await prisma.user.update({
    where: { email },
    data: { passwordHash: hashPassword(password), isActive: true },
  });
  console.log("Updated existing user:", user.id);
} else {
  user = await prisma.user.create({
    data: {
      identityProviderUid: `demo-admin-${Date.now()}`,
      email,
      displayName: "Demo Admin",
      passwordHash: hashPassword(password),
      isActive: true,
    },
  });
  console.log("Created user:", user.id);
}

const existingMembership = await prisma.workspaceMember.findFirst({ where: { userId: user.id } });
if (!existingMembership) {
  const ws = await prisma.workspace.create({
    data: {
      name: "Hackathon Demo",
      slug: `hackathon-demo-${Date.now()}`,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await prisma.workspaceSetting.create({ data: { workspaceId: ws.id } });
  console.log("Created workspace:", ws.id);
} else {
  console.log("User already has a workspace membership, skipping workspace creation");
}

console.log("DONE");
process.exit(0);
