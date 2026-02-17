import type { Plan } from "../plans/schema";

export type ExecutionRequest = {
  contractId: string;
  intent: string;
  plan: Plan;
  grants: string[];
  expectedEvidence: string[];
  artifactsDir: string;
};

export type RunnerResult = {
  status: "completed" | "failed";
  summary: string;
  outputs: any;
  backend?: "native";
  logsPath?: string;
  evidencePaths?: string[];
  errors?: any;
};
