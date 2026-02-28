import * as fs from "node:fs";
import * as path from "node:path";

import { getProvider } from "../providers/registry";
import type { Provider } from "../providers/types";
import type { Plan } from "../plans/schema";
import { parseAndValidatePlanJson } from "../plans/validate";
import { now } from "../time";
import { appendArchitectDecision, appendArchitectTurn } from "./log";
import { getArchitectHumanInputPath, getArchitectValidationPath } from "./paths";
import { loadArchitectSouls } from "./soul";
import { loadArchitectSession, saveArchitectSession } from "./session";
import { collectMilestoneSteps, validateArchitectPlan } from "./validate";
import type {
  AgentSoul,
  ArchitectAgentName,
  ArchitectSession,
  ArchitectValidationResult,
} from "./types";

const MAIN_LOOP_AGENTS: ArchitectAgentName[] = ["architect", "critic", "integrator"];

function nextAgent(current: ArchitectAgentName) {
  const idx = MAIN_LOOP_AGENTS.indexOf(current);
  if (idx < 0 || idx === MAIN_LOOP_AGENTS.length - 1) {
    return MAIN_LOOP_AGENTS[0];
  }
  return MAIN_LOOP_AGENTS[idx + 1];
}

function inferRoleDecision(agent: ArchitectAgentName, beforePlan: Plan | null, afterPlan: Plan) {
  const beforeCount = beforePlan?.steps?.length || 0;
  const afterCount = afterPlan.steps.length;
  const milestoneCount = collectMilestoneSteps(afterPlan).length;
  const changeDelta = afterCount - beforeCount;

  if (agent === "architect") {
    return {
      decision: "Generated/updated initial milestone task plan.",
      rationale: `Architect produced plan with ${afterCount} step(s) (${changeDelta >= 0 ? "+" : ""}${changeDelta} vs prior) and ${milestoneCount} milestone-marked step(s).`,
    };
  }
  if (agent === "critic") {
    return {
      decision: "Refined plan for risk coverage and testability.",
      rationale: `Critic adjusted plan to ${afterCount} step(s); milestone-marked steps: ${milestoneCount}.`,
    };
  }
  if (agent === "integrator") {
    return {
      decision: "Integrated planning updates into implementation-ready sequence.",
      rationale: `Integrator produced consolidated plan with ${afterCount} step(s) and ${milestoneCount} milestone-marked step(s).`,
    };
  }
  return {
    decision: "Validated plan quality.",
    rationale: `Validator inspected plan with ${afterCount} step(s).`,
  };
}

function buildAgentInstructions(params: {
  agentSoul: AgentSoul;
  contractId: string;
  intent: string;
  round: number;
  userInstructions?: string;
  priorValidationFailures?: string;
}) {
  const sections = [
    `Agent role: ${params.agentSoul.name}`,
    `Contract: ${params.contractId}`,
    `Round: ${params.round}`,
    "",
    "Contract intent:",
    params.intent,
    "",
    "Role instructions from SOUL:",
    params.agentSoul.prompt,
    "",
    "Non-negotiable output requirements:",
    "- Output ONLY valid plan.v1 JSON.",
    "- Include at least one milestone step (summary/details/tags should contain 'milestone').",
    "- Include explicit verification/acceptance criteria in details.",
    "- Preserve existing step ids where reasonable.",
  ];

  if (params.userInstructions && params.userInstructions.trim()) {
    sections.push("", "User-supplied architect instructions:", params.userInstructions.trim());
  }

  if (params.priorValidationFailures && params.priorValidationFailures.trim()) {
    sections.push("", "Validation feedback from previous attempt:", params.priorValidationFailures.trim());
  }

  return sections.join("\n");
}

async function requestPlanFromAgent(params: {
  provider: Provider;
  providerName: string;
  model?: string;
  contractId: string;
  intent: string;
  currentPlan: Plan | null;
  instructions: string;
}) {
  const raw = await params.provider.planJson({
    contractId: params.contractId,
    intent: params.intent,
    currentPlanJson: params.currentPlan,
    currentPlanText: params.currentPlan ? JSON.stringify(params.currentPlan) : null,
    instructions: params.instructions,
    model: params.model || null,
  });
  try {
    return parseAndValidatePlanJson(raw);
  } catch (error: any) {
    throw new Error(
      `Agent provider ${params.providerName} returned invalid plan JSON: ${error?.message || String(error)}`
    );
  }
}

function saveValidationResult(contractId: string, validation: ArchitectValidationResult) {
  const filePath = getArchitectValidationPath(contractId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(validation, null, 2));
  return filePath;
}

export async function runArchitectLoop(params: {
  contract: any;
  allowPrompt: boolean;
  maxRounds: number;
  providerOverride?: string;
  modelOverride?: string;
  resume: boolean;
  instructions?: string;
}) {
  const souls = loadArchitectSouls(params.contract.id, {
    provider: params.providerOverride,
    model: params.modelOverride,
  });

  let session = loadArchitectSession(params.contract.id);
  if (!session || !params.resume) {
    session = {
      contract_id: params.contract.id,
      status: "running",
      round: 0,
      active_agent: "architect",
      max_rounds: params.maxRounds,
      provider_override: params.providerOverride,
      model_override: params.modelOverride,
      budget: params.contract.budget,
      instructions: params.instructions,
      updated_at: now(),
      working_plan: params.contract.plan_v1 || params.contract.planJson || undefined,
    };
  }

  let workingPlan: Plan | null = (session.working_plan as Plan) || params.contract.plan_v1 || params.contract.planJson || null;
  let priorValidationFailures = "";

  if (session.status === "awaiting_human" && session.pending_human_prompt) {
    if (params.allowPrompt && process.stdin.isTTY && process.stdout.isTTY) {
      const { createInterface } = await import("node:readline/promises");
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const response = (await rl.question(`${session.pending_human_prompt}\n> `)).trim();
        if (response) {
          session.instructions = `${session.instructions || ""}\n${response}`.trim();
        }
        session.pending_human_prompt = undefined;
        session.status = "running";
      } finally {
        rl.close();
      }
    } else {
      return {
        status: "awaiting_human" as const,
        session,
        plan: workingPlan,
      };
    }
  }

  while (session.round < session.max_rounds) {
    const agentName = session.active_agent;
    const soul = souls[agentName];
    const provider = getProvider(soul.routing.provider);

    const instructions = buildAgentInstructions({
      agentSoul: soul,
      contractId: params.contract.id,
      intent: params.contract.intent,
      round: session.round + 1,
      userInstructions: session.instructions,
      priorValidationFailures,
    });

    const beforePlan = workingPlan;
    const nextPlan = await requestPlanFromAgent({
      provider,
      providerName: soul.routing.provider,
      model: soul.routing.model,
      contractId: params.contract.id,
      intent: params.contract.intent,
      currentPlan: workingPlan,
      instructions,
    });

    workingPlan = nextPlan;
    session.round += 1;

    const decision = inferRoleDecision(agentName, beforePlan, nextPlan);
    appendArchitectTurn({
      ts: now(),
      contract_id: params.contract.id,
      round: session.round,
      agent: agentName,
      provider: soul.routing.provider,
      model: soul.routing.model,
      message: decision.decision,
      plan_step_count: nextPlan.steps.length,
    });
    appendArchitectDecision({
      ts: now(),
      contract_id: params.contract.id,
      round: session.round,
      agent: agentName,
      decision: decision.decision,
      rationale: decision.rationale,
    });

    session.working_plan = nextPlan;

    if (agentName === "integrator") {
      const validatorSoul = souls.validator;
      const validatorProvider = getProvider(validatorSoul.routing.provider);
      let validatedPlan = nextPlan;
      let retries = 0;
      let validation = validateArchitectPlan(validatedPlan);

      while (!validation.final_pass && retries < 3) {
        retries += 1;
        const retryInstructions = buildAgentInstructions({
          agentSoul: validatorSoul,
          contractId: params.contract.id,
          intent: params.contract.intent,
          round: session.round,
          userInstructions: session.instructions,
          priorValidationFailures: validation.message,
        });
        validatedPlan = await requestPlanFromAgent({
          provider: validatorProvider,
          providerName: validatorSoul.routing.provider,
          model: validatorSoul.routing.model,
          contractId: params.contract.id,
          intent: params.contract.intent,
          currentPlan: validatedPlan,
          instructions: retryInstructions,
        });
        validation = {
          ...validateArchitectPlan(validatedPlan),
          retries_used: retries,
        };
      }

      validation.retries_used = retries;
      session.validation = validation;
      session.working_plan = validatedPlan;
      saveValidationResult(params.contract.id, validation);

      appendArchitectDecision({
        ts: now(),
        contract_id: params.contract.id,
        round: session.round,
        agent: "validator",
        decision: validation.final_pass ? "Validation passed." : "Validation failed.",
        rationale: validation.message,
      });

      if (validation.final_pass) {
        session.status = "completed";
        saveArchitectSession(session);
        return {
          status: "completed" as const,
          session,
          plan: validatedPlan,
          validation,
        };
      }

      priorValidationFailures = validation.message;

      if (params.allowPrompt && process.stdin.isTTY && process.stdout.isTTY) {
        const { createInterface } = await import("node:readline/promises");
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        try {
          const answer = (await rl.question("Architect validation failed. Provide additional instructions to continue (blank to stop): ")).trim();
          if (!answer) {
            session.status = "blocked";
            saveArchitectSession(session);
            return {
              status: "blocked" as const,
              session,
              plan: validatedPlan,
              validation,
            };
          }
          session.instructions = `${session.instructions || ""}\n${answer}`.trim();
        } finally {
          rl.close();
        }
      } else {
        session.status = "awaiting_human";
        session.pending_human_prompt = "Architect validation failed. Re-run with --resume and provide additional instructions.";
        const humanPath = getArchitectHumanInputPath(params.contract.id);
        fs.mkdirSync(path.dirname(humanPath), { recursive: true });
        fs.writeFileSync(humanPath, JSON.stringify({
          at: now(),
          contract_id: params.contract.id,
          prompt: session.pending_human_prompt,
          validation,
        }, null, 2));
        saveArchitectSession(session);
        return {
          status: "awaiting_human" as const,
          session,
          plan: validatedPlan,
          validation,
        };
      }
    }

    session.active_agent = nextAgent(agentName);
    saveArchitectSession(session);
  }

  session.status = "blocked";
  session.pending_human_prompt = `Reached max rounds (${session.max_rounds}) before passing validation. Provide additional instructions and rerun with --resume.`;
  saveArchitectSession(session);
  return {
    status: "blocked" as const,
    session,
    plan: workingPlan,
  };
}
