import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UnauthorizedException,
  ForbiddenException
} from "@nestjs/common";
import { prisma } from "@webpilot/database";
import { Public } from "../common/public.decorator.js";
import { z } from "zod";
import crypto from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { EmailService } from "./email.service.js";

const LoginEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SignupRequestSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  workspaceName: z.string().optional(),
  reason: z.string().optional(),
  password: z.string().min(8).optional(),
});

// scrypt with a random per-user salt, stored as "salt:hash" — replaces a
// previous unsalted SHA-256 scheme that shared one hardcoded salt across
// every deployment.
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

export { hashPassword };

@Controller("api/v1/auth")
export class AuthController {
  constructor(private emailService: EmailService) {}

  @Public()
  @Get("methods")
  async getMethods() {
    const setting = await prisma.workspaceSetting.findFirst();
    return {
      allowGoogleLogin: setting?.allowGoogleLogin ?? true,
      allowEmailPasswordLogin: setting?.allowEmailPasswordLogin ?? true,
      allowPublicOnboarding: setting?.allowPublicOnboarding ?? true,
    };
  }

  @Public()
  @Post("login-email")
  async loginEmail(@Body() body: unknown) {
    const { email, password } = LoginEmailSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          include: { workspace: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.isActive === false) {
      throw new ForbiddenException("Account disabled. Please contact your workspace administrator.");
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException("Email/password login not enabled for this account. Please use Google Login.");
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Mint a real Firebase session so the frontend can call every other
    // API route the normal way (Authorization: Bearer <idToken>). Password
    // login previously returned a bare JSON object with no session at all,
    // so every subsequent request 401'd and the user was silently bounced
    // back to /login.
    let customToken: string | undefined;
    if (process.env.LOCAL_AUTH_BYPASS !== "true") {
      customToken = await getAuth().createCustomToken(user.identityProviderUid, {
        email: user.email,
      });
    }

    return {
      customToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
      },
      workspaces: user.memberships.map((m: any) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
      })),
    };
  }

  @Public()
  @Post("signup-request")
  async signupRequest(@Body() body: unknown) {
    const data = SignupRequestSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ForbiddenException("An account with this email already exists.");
    }

    const defaultWorkspace = await prisma.workspace.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!defaultWorkspace) {
      throw new NotFoundException("No active workspace found to process onboarding request.");
    }

    const approval = await prisma.approval.create({
      data: {
        workspaceId: defaultWorkspace.id,
        type: "ONBOARDING",
        riskLevel: "LOW",
        reason: `Onboarding Access Request from ${data.name} (${data.email})`,
        payload: {
          name: data.name,
          email: data.email.toLowerCase(),
          requestedWorkspaceName: data.workspaceName || `${data.name}'s Workspace`,
          reason: data.reason || "Autonomous RPA Access Request",
          passwordHash: data.password ? hashPassword(data.password) : null,
        } as any,
        status: "PENDING",
      },
    });

    // Notify administrator via email
    await this.emailService.sendEmail({
      to: process.env.ADMIN_NOTIFY_EMAIL || "admin@webpilot.ai",
      subject: `🔔 New Onboarding Access Request: ${data.name} (${data.email})`,
      html: `
        <h2>🔔 WebPilot AI — New Onboarding Request</h2>
        <p><strong>Applicant Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Requested Workspace:</strong> ${data.workspaceName || "Default Workspace"}</p>
        <p><strong>Reason:</strong> ${data.reason || "N/A"}</p>
        <p>Review and approve this request in your <strong>Approvals Queue</strong> inside WebPilot AI Dashboard.</p>
      `,
    });

    return {
      success: true,
      message: "Onboarding access request submitted successfully. Administrator has been notified.",
      requestId: approval.id,
    };
  }
}
