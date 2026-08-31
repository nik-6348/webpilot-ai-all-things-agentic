import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { AuthGuard } from "./common/auth.guard.js";
import { HealthController } from "./modules/health.controller.js";
import { WorkspacesController } from "./modules/workspaces.controller.js";
import { AgentsController } from "./modules/agents.controller.js";
import { RunsController } from "./modules/runs.controller.js";
import { ApprovalsController } from "./modules/approvals.controller.js";
import { SchedulesController } from "./modules/schedules.controller.js";
import { ConnectionsController } from "./modules/connections.controller.js";
import { IntegrationsController } from "./modules/integrations.controller.js";
import { AdminController } from "./modules/admin.controller.js";
import { AuthController } from "./modules/auth.controller.js";
import { EmailService } from "./modules/email.service.js";

@Module({
  controllers: [
    HealthController,
    AuthController,
    WorkspacesController,
    AgentsController,
    RunsController,
    ApprovalsController,
    SchedulesController,
    ConnectionsController,
    IntegrationsController,
    AdminController,
  ],
  providers: [Reflector, EmailService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
