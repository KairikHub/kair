import type { Plan } from "../plans/schema";
import type { ContractLlmBudget } from "../llm/budget_guard";

export type ArchitectAgentName = "architect" | "critic" | "integrator" | "validator";

export type AgentRoutingConfig = {
  provider: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
};

export type AgentSoul = {
  name: ArchitectAgentName;
  routing: AgentRoutingConfig;
  prompt: string;
  filePath: string;
};

export type ArchitectSessionStatus = "running" | "awaiting_human" | "completed" | "blocked";

export type ArchitectBudget = ContractLlmBudget;

export type ArchitectSession = {
  contract_id: string;
  status: ArchitectSessionStatus;
  round: number;
  active_agent: ArchitectAgentName;
  max_rounds: number;
  provider_override?: string;
  model_override?: string;
  budget: ArchitectBudget;
  budget_status?: ArchitectBudget["status"];
  budget_usage?: ArchitectBudget["usage"];
  instructions?: string;
  pending_human_prompt?: string;
  working_plan?: Plan;
  validation?: ArchitectValidationResult;
  updated_at: string;
};

export type ArchitectTurnLog = {
  ts: string;
  contract_id: string;
  round: number;
  agent: ArchitectAgentName;
  provider: string;
  model?: string;
  message: string;
  plan_step_count: number;
};

export type ArchitectDecisionLog = {
  ts: string;
  contract_id: string;
  round: number;
  agent: ArchitectAgentName;
  decision: string;
  rationale: string;
  open_questions?: string[];
};

export type ArchitectValidationResult = {
  plan_schema_valid: boolean;
  milestone_keyword_present: boolean;
  milestone_steps: string[];
  validator_passed: boolean;
  retries_used: number;
  final_pass: boolean;
  message: string;
};
