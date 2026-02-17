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

export type Provider = {
  name: string;
  isInstalled(): boolean;
  requireApiKey(): string;
  planJson(request: PlanRequest): Promise<string>;
};
