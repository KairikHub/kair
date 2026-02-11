export type ProviderName = string;

export type PlanRequest = {
  contractId: string;
  intent: string;
  currentPlanText?: string | null;
  model?: string | null;
};

export type Provider = {
  name: string;
  isInstalled(): boolean;
  requireApiKey(): string;
  planJson(request: PlanRequest): Promise<string>;
};
