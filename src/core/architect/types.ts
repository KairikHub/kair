import type { Plan } from "../plans/schema";

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

export type ArchitectBudget = {
  max_tokens: number;
  total_max_cost_usd: number;
};

export type ArchitectSession = {
  contract_id: string;
  status: ArchitectSessionStatus;
  round: number;
  active_agent: ArchitectAgentName;
  max_rounds: number;
  provider_override?: string;
  model_override?: string;
  budget: ArchitectBudget;
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
