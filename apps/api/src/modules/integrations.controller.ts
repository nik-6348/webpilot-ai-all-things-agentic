import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Patch,
  Param,
  Query,
  Req,
} from "@nestjs/common";
import crypto from "node:crypto";
import { prisma } from "@webpilot/database";
import { SecretVault, TaskQueue } from "@webpilot/gcp";
import { requireWorkspace } from "../common/context.js";
import { Public } from "../common/public.decorator.js";

function slackSignature(raw: string, ts: string) {
  return (
    "v0=" +
    crypto
      .createHmac("sha256", process.env.SLACK_SIGNING_SECRET || "")
      .update(`v0:${ts}:${raw}`)
      .digest("hex")
  );
}
function verifySlack(raw: string, ts: string, sig: string) {
  const secret = process.env.SLACK_SIGNING_SECRET || "";
  if (!secret || !ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300)
    return false;
  const expected = slackSignature(raw, ts);
  const a = Buffer.from(expected),
    b = Buffer.from(sig || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function signState(workspaceId: string) {
  const payload = Buffer.from(
    JSON.stringify({ workspaceId, exp: Date.now() + 10 * 60_000 }),
  ).toString("base64url");
  const key =
    process.env.SLACK_STATE_SECRET || process.env.SLACK_CLIENT_SECRET || "";
  if (!key) throw new Error("SLACK_STATE_SECRET is not configured");
  const sig = crypto
    .createHmac("sha256", key)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}
function verifyState(state: string) {
  const [payload, sig] = String(state || "").split(".");
  const key =
    process.env.SLACK_STATE_SECRET || process.env.SLACK_CLIENT_SECRET || "";
  if (!payload || !sig || !key) throw new Error("Invalid Slack OAuth state");
  const expected = crypto
    .createHmac("sha256", key)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(expected),
    b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    throw new Error("Invalid Slack OAuth state");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (parsed.exp < Date.now()) throw new Error("Slack OAuth state expired");
  return parsed.workspaceId as string;
}
@Controller("integrations")
export class IntegrationsController {
  @Get() async list(
    @Req() req: any,
    @Query("workspaceId") workspaceId?: string,
  ) {
    const m = await requireWorkspace(req.user.id, workspaceId);
    return prisma.integration.findMany({
      where: { workspaceId: m.workspaceId },
      select: {
        id: true,
        workspaceId: true,
        provider: true,
        status: true,
        displayName: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  @Patch(":id") async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const i = await prisma.integration.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(req.user.id, i.workspaceId, ["OWNER", "ADMIN"]);
    return prisma.integration.update({
      where: { id },
      data: { metadata: { ...((i.metadata as any) || {}), ...body.metadata } },
    });
  }
  @Post("slack/connect") async slackConnect(
    @Req() req: any,
    @Body() body: any,
  ) {
    await requireWorkspace(req.user.id, body.workspaceId, ["OWNER", "ADMIN"]);
    const state = signState(body.workspaceId);
    return {
      url: `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(process.env.SLACK_CLIENT_ID || "")}&scope=commands,chat:write,app_mentions:read&redirect_uri=${encodeURIComponent(process.env.SLACK_REDIRECT_URI || "")}&state=${encodeURIComponent(state)}`,
    };
  }
  @Public() @Get("slack/callback") async callback(
    @Query("code") code: string,
    @Query("state") state: string,
  ) {
    const workspaceId = verifyState(state);
    const r = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID || "",
        client_secret: process.env.SLACK_CLIENT_SECRET || "",
        redirect_uri: process.env.SLACK_REDIRECT_URI || "",
      }),
    });
    const data: any = await r.json();
    if (!data.ok) throw new Error(data.error);
    const ref = await new SecretVault().put(
      `slack-${workspaceId}`,
      JSON.stringify({ accessToken: data.access_token }),
    );
    await prisma.integration.upsert({
      where: { id: `slack-${workspaceId}` },
      update: {
        status: "CONNECTED",
        metadata: { team: data.team },
        secretManagerRef: ref,
      },
      create: {
        id: `slack-${workspaceId}`,
        workspaceId,
        provider: "SLACK",
        status: "CONNECTED",
        displayName: data.team?.name || "Slack",
        metadata: { team: data.team },
        secretManagerRef: ref,
      },
    });
    return { ok: true, workspaceId };
  }
  @Public() @Post("slack/command") async command(
    @Req() req: any,
    @Headers("x-slack-request-timestamp") ts: string,
    @Headers("x-slack-signature") sig: string,
  ) {
    const raw =
      typeof req.body === "string"
        ? req.body
        : new URLSearchParams(req.body).toString();
    if (!verifySlack(raw, ts, sig))
      return { response_type: "ephemeral", text: "Invalid signature" };
    const body: any =
      typeof req.body === "string"
        ? Object.fromEntries(new URLSearchParams(req.body))
        : req.body;
    const connected = await prisma.integration.findMany({
      where: { provider: "SLACK", status: "CONNECTED" },
    });
    const integration = connected.find(
      (i: any) => (i.metadata as any)?.team?.id === body.team_id,
    );
    if (!integration)
      return {
        response_type: "ephemeral",
        text: "This Slack workspace is not connected to WebPilot",
      };
    const query = String(body.text || "")
      .replace(/^run\s+/i, "")
      .trim();
    const agent = await prisma.agent.findFirst({
      where: {
        workspaceId: integration.workspaceId,
        name: { contains: query, mode: "insensitive" },
      },
    });
    if (!agent)
      return {
        response_type: "ephemeral",
        text: "Agent not found in this workspace",
      };
    const run = await prisma.run.create({
      data: {
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        versionId: agent.activeVersionId,
        triggerType: "SLACK",
        status: "QUEUED",
        executionMode: agent.activeVersionId ? "FAST_PATH" : "DISCOVERY",
        idempotencyKey: `slack-${crypto.randomUUID()}`,
      },
    });
    await new TaskQueue().enqueueRun(run.id);
    return {
      response_type: "in_channel",
      text: `WebPilot started ${agent.name}. Run ${run.id}`,
    };
  }
}
