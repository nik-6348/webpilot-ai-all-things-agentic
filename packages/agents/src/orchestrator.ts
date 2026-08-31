import { type WorkflowSpec, type WorkflowStep } from "@webpilot/contracts";

export type AgentRole = "PLANNER" | "NAVIGATOR" | "RECOVERY" | "VERIFIER";

export interface OrchestrationContext {
  runId: string;
  goal: string;
  targetUrl: string;
  allowedDomains: string[];
  credentials?: Record<string, string>;
  history: WorkflowStep[];
  extractedRecords: any[];
  currentStepIndex: number;
  status: "INIT" | "PLANNING" | "EXECUTING" | "RECOVERING" | "VERIFYING" | "COMPLETED" | "FAILED";
  error?: string;
}

export interface IAgent {
  role: AgentRole;
  execute(context: OrchestrationContext, payload: any): Promise<any>;
}

export type OrchestrationEventCallback = (
  event: "phase_changed" | "step_executed" | "agent_invoked" | "error" | "completed",
  data: {
    runId: string;
    phase?: string;
    agentRole?: AgentRole;
    message?: string;
    metadata?: any;
  }
) => void;

/**
 * Enterprise Multi-Agent Orchestrator
 * Coordinates Planner, Navigator, Recovery, and Verifier agents using Registry and Saga state patterns.
 */
export class MultiAgentOrchestrator {
  private registry = new Map<AgentRole, IAgent>();
  private activeSessions = new Map<string, OrchestrationContext>();
  private listeners: OrchestrationEventCallback[] = [];

  constructor() {}

  /**
   * Register a specialized agent role.
   */
  public registerAgent(role: AgentRole, agent: IAgent): this {
    if (this.registry.has(role)) {
      console.warn(`[Orchestrator] Warning: Overwriting registered agent for role: ${role}`);
    }
    this.registry.set(role, agent);
    return this;
  }

  /**
   * Subscribe to orchestrator lifecycle and state events.
   */
  public subscribe(callback: OrchestrationEventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify(
    event: Parameters<OrchestrationEventCallback>[0],
    data: Parameters<OrchestrationEventCallback>[1]
  ) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error(`[Orchestrator] Listener callback error:`, err);
      }
    }
  }

  /**
   * Run the orchestration flow (Saga Lifecycle) for a given execution goal.
   */
  public async orchestrate(
    runId: string,
    goal: string,
    targetUrl: string,
    allowedDomains: string[],
    credentials?: Record<string, string>
  ): Promise<OrchestrationContext> {
    console.log(`[Orchestrator] Starting orchestration saga for runId="${runId}"`);
    
    const context: OrchestrationContext = {
      runId,
      goal,
      targetUrl,
      allowedDomains,
      credentials: credentials || {},
      history: [],
      extractedRecords: [],
      currentStepIndex: 0,
      status: "INIT",
    };

    this.activeSessions.set(runId, context);
    this.notify("phase_changed", { runId, phase: "INIT", message: "Orchestration saga initialized" });

    try {
      // 1. PLANNING PHASE
      context.status = "PLANNING";
      this.notify("phase_changed", { runId, phase: "PLANNING", message: "Starting planning phase" });
      
      const planner = this.registry.get("PLANNER");
      if (!planner) {
        throw new Error("No agent registered for role: PLANNER");
      }

      this.notify("agent_invoked", { runId, agentRole: "PLANNER", message: "Invoking Planner Agent" });
      const plan = await planner.execute(context, { targetUrl });
      this.notify("step_executed", {
        runId,
        phase: "PLANNING",
        message: "Planner generated initial spec outline",
        metadata: { plan },
      });

      // 2. EXECUTION / NAVIGATION PHASE
      context.status = "EXECUTING";
      this.notify("phase_changed", { runId, phase: "EXECUTING", message: "Starting navigation phase" });

      const navigator = this.registry.get("NAVIGATOR");
      if (!navigator) {
        throw new Error("No agent registered for role: NAVIGATOR");
      }

      let done = false;
      let attemptCount = 0;
      const maxAttempts = 25;

      while (!done && attemptCount < maxAttempts) {
        attemptCount++;
        context.currentStepIndex = attemptCount;

        this.notify("agent_invoked", {
          runId,
          agentRole: "NAVIGATOR",
          message: `Invoking Navigator Agent - Step ${attemptCount}`,
        });

        const decision = await navigator.execute(context, { stepIndex: attemptCount });
        
        if (decision.step) {
          context.history.push(decision.step);
          
          this.notify("step_executed", {
            runId,
            phase: "EXECUTING",
            message: `Completed Step ${attemptCount}: ${decision.step.type} - ${decision.step.description}`,
            metadata: { step: decision.step },
          });

          // Handle self-healing triggers if navigation step failed
          if (decision.failed) {
            await this.handleFailureSaga(context, decision.step);
          }
        }

        if (decision.extracted) {
          context.extractedRecords = decision.extracted;
        }

        done = Boolean(decision.done);
      }

      if (attemptCount >= maxAttempts) {
        throw new Error("Execution terminated: Exceeded maximum allowed navigation steps (25)");
      }

      // 3. COMPLETE PHASE
      context.status = "COMPLETED";
      this.notify("phase_changed", { runId, phase: "COMPLETED", message: "Saga completed successfully" });
      this.notify("completed", {
        runId,
        message: `Execution complete. Extracted ${context.extractedRecords.length} items.`,
        metadata: { recordsCount: context.extractedRecords.length },
      });

    } catch (err: any) {
      context.status = "FAILED";
      context.error = err?.message || String(err);
      this.notify("error", { runId, message: context.error });
      this.notify("phase_changed", { runId, phase: "FAILED", message: "Orchestration saga failed" });
    } finally {
      this.activeSessions.delete(runId);
    }

    return context;
  }

  /**
   * Self-Healing Sub-Saga: Resolves step failures using Recovery and Verifier Agents.
   */
  private async handleFailureSaga(context: OrchestrationContext, failedStep: WorkflowStep): Promise<void> {
    context.status = "RECOVERING";
    this.notify("phase_changed", {
      runId: context.runId,
      phase: "RECOVERING",
      message: `Initiating self-healing protocol for failed step: ${failedStep.id}`,
    });

    const recoveryAgent = this.registry.get("RECOVERY");
    if (!recoveryAgent) {
      throw new Error(`Self-healing failed: No agent registered for role: RECOVERY`);
    }

    this.notify("agent_invoked", {
      runId: context.runId,
      agentRole: "RECOVERY",
      message: "Invoking Recovery Agent to diagnose UI drift",
    });

    const patch = await recoveryAgent.execute(context, { failedStep });

    if (!patch || !patch.replacement) {
      throw new Error(`Self-healing failed: Recovery Agent was unable to propose a suitable replacement`);
    }

    // Invoke Verifier Agent to validate recovery proposal
    context.status = "VERIFYING";
    this.notify("phase_changed", {
      runId: context.runId,
      phase: "VERIFYING",
      message: "Initiating validation on proposed recovery step",
    });

    const verifierAgent = this.registry.get("VERIFIER");
    if (!verifierAgent) {
      throw new Error(`Self-healing validation failed: No agent registered for role: VERIFIER`);
    }

    this.notify("agent_invoked", {
      runId: context.runId,
      agentRole: "VERIFIER",
      message: "Invoking Verifier Agent to review repair path",
    });

    const verificationResult = await verifierAgent.execute(context, { patch });

    if (verificationResult.verdict !== "PASS") {
      throw new Error(
        `Self-healing validation failed: Verifier verdict was "${verificationResult.verdict}". Reason: ${verificationResult.reason}`
      );
    }

    // Apply the verified patch
    const idx = context.history.findIndex((s) => s.id === failedStep.id);
    if (idx !== -1) {
      context.history[idx] = { ...patch.replacement, id: failedStep.id };
    }

    context.status = "EXECUTING";
    this.notify("phase_changed", {
      runId: context.runId,
      phase: "EXECUTING",
      message: `Successfully verified and applied patch for step: ${failedStep.id}`,
    });
  }

  /**
   * Retrieve session context for a running orchestrator.
   */
  public getSession(runId: string): OrchestrationContext | undefined {
    return this.activeSessions.get(runId);
  }

  /**
   * Dispatch a single registered agent through the orchestrator's registry
   * with real lifecycle events, without running the full multi-step saga in
   * `orchestrate()`. The browser-worker execution engine owns its own run
   * state machine (checkpoints, anti-loop guard, approval gates) and calls
   * this once per model invocation so every Planner/Navigator/Recovery/
   * Verifier call is genuinely registry-dispatched and observable instead
   * of a bare function call.
   */
  public async invokeAgent<T = any>(
    role: AgentRole,
    context: OrchestrationContext,
    payload: any,
  ): Promise<T> {
    const agent = this.registry.get(role);
    if (!agent) throw new Error(`No agent registered for role: ${role}`);
    this.notify("agent_invoked", {
      runId: context.runId,
      agentRole: role,
      message: `Invoking ${role} agent`,
    });
    try {
      const result = await agent.execute(context, payload);
      this.notify("step_executed", {
        runId: context.runId,
        agentRole: role,
        message: `${role} agent completed`,
      });
      return result as T;
    } catch (err: any) {
      this.notify("error", {
        runId: context.runId,
        agentRole: role,
        message: err?.message || String(err),
      });
      throw err;
    }
  }
}
