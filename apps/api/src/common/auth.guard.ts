import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@webpilot/database";
import { PUBLIC_KEY } from "./public.decorator.js";
if (!getApps().length && process.env.LOCAL_AUTH_BYPASS !== "true")
  initializeApp({
    credential: applicationDefault(),
    projectId:
      process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
  });
@Injectable()
export class AuthGuard implements CanActivate {
  private reflector: Reflector;
  constructor(reflector?: Reflector) {
    this.reflector = reflector || new Reflector();
  }
  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest();
    let uid: string,
      email: string,
      name: string | undefined,
      picture: string | undefined;
    if (process.env.LOCAL_AUTH_BYPASS === "true") {
      uid = "local-demo-user";
      email = process.env.LOCAL_USER_EMAIL || "demo@webpilot.local";
      name = "Demo User";
    } else {
      const header = String(req.headers.authorization || "");
      if (!header.startsWith("Bearer ")) throw new UnauthorizedException();
      const token = await getAuth().verifyIdToken(header.slice(7));
      uid = token.uid;
      email = token.email || `${uid}@unknown`;
      name = token.name;
      picture = token.picture;
    }
    // Users can be pre-created (workspace "Add Member", or an approved
    // onboarding request) with a synthetic identityProviderUid before they
    // ever sign in via Firebase. Upserting on identityProviderUid alone
    // would then try to CREATE a second row on first real sign-in and crash
    // on the unique email constraint. Reconcile by email first.
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    const user =
      existingByEmail && existingByEmail.identityProviderUid !== uid
        ? await prisma.user.update({
            where: { id: existingByEmail.id },
            data: { identityProviderUid: uid, displayName: name, avatarUrl: picture },
          })
        : await prisma.user.upsert({
            where: { identityProviderUid: uid },
            update: { email, displayName: name, avatarUrl: picture },
            create: {
              identityProviderUid: uid,
              email,
              displayName: name,
              avatarUrl: picture,
            },
          });
    req.user = user;
    return true;
  }
}
