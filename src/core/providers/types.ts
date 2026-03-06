import type { Plan } from "../plans/schema";

export type ProviderName = string;

export type PlanRequest = {
  contractId: string;
  intent: string;
  currentPlanJson?: Plan | null;
  currentPlanText?: string | null;
  instructions?: string | null;
  model?: string | null;
};

export type ProviderUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export type PlanProviderResponse = {
  text: string;
  usage: ProviderUsage;
  provider: string;
  model: string;
};

export type Provider = {
  name: string;
  isInstalled(): boolean;
  requireApiKey(): string;
  planJson(request: PlanRequest): Promise<PlanProviderResponse>;
};
