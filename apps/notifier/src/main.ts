import Fastify from "fastify";
import { google } from "googleapis";
import { prisma } from "@webpilot/database";
import { SecretVault } from "@webpilot/gcp";
const app = Fastify({ logger: true });
const vault = new SecretVault();
async function slack(workspaceId: string, text: string) {
  const i = await prisma.integration.findFirst({
    where: { workspaceId, provider: "SLACK", status: "CONNECTED" },
  });
  if (!i?.secretManagerRef) return;
  const secret = JSON.parse(await vault.get(i.secretManagerRef));
  const channel = (i.metadata as any)?.defaultChannel;
  if (!channel) return;
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });
}
async function chat(text: string) {
  if (!process.env.GOOGLE_CHAT_WEBHOOK) return;
  await fetch(process.env.GOOGLE_CHAT_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}
async function gmail(subject: string, text: string) {
  if (!process.env.GMAIL_OAUTH_SECRET_REF || !process.env.GMAIL_SENDER) return;
  const c = JSON.parse(await vault.get(process.env.GMAIL_OAUTH_SECRET_REF));
  const oauth = new google.auth.OAuth2(
    c.clientId,
    c.clientSecret,
    c.redirectUri,
  );
  oauth.setCredentials({ refresh_token: c.refreshToken });
  const api = google.gmail({ version: "v1", auth: oauth });
  const msg = [
    `From: ${process.env.GMAIL_SENDER}`,
    `To: ${c.recipient || process.env.GMAIL_SENDER}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
  ].join("\r\n");
  await api.users.messages.send({
    userId: "me",
    requestBody: { raw: Buffer.from(msg).toString("base64url") },
  });
}
async function notify(payload: any) {
  const run = payload.runId
    ? await prisma.run.findUnique({
        where: { id: payload.runId },
        include: { agent: true },
      })
    : null;
  if (!run) return;
  const text = `WebPilot • ${run.agent.name}\n${payload.type}: ${payload.message}\nRun: ${run.id}`;
  await Promise.allSettled([
    slack(run.workspaceId, text),
    chat(text),
    gmail(`WebPilot: ${payload.type}`, text),
  ]);
}
app.get("/health/live", async () => ({ ok: true, service: "notifier" }));
app.post("/internal/events", async (req: any) => {
  const envelope = req.body?.message?.data
    ? JSON.parse(Buffer.from(req.body.message.data, "base64").toString())
    : req.body;
  await notify(envelope);
  return { ok: true };
});
await app.listen({ port: Number(process.env.PORT || 4300), host: "0.0.0.0" });
