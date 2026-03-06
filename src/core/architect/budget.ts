import { createInterface } from "node:readline/promises";

import { recordHistory } from "../contracts/history";
import {
  DEFAULT_LLM_BUDGET_LIMITS,
  ensureBudgetInitialized,
  normalizeContractBudget,
} from "../llm/budget_guard";
import { now } from "../time";
import type { LlmBudgetLimits } from "../llm/budget_guard";

export const DEFAULT_ARCHITECT_BUDGET: LlmBudgetLimits = { ...DEFAULT_LLM_BUDGET_LIMITS };

function parsePositiveNumber(raw: string) {
  const parsed = Number((raw || "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function promptBudget(defaults: LlmBudgetLimits) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const maxTokensRaw = await rl.question(
      `Architect budget max_tokens [default: ${defaults.max_tokens}]: `
    );
    const maxCostRaw = await rl.question(
      `Architect budget total_max_cost_usd [default: ${defaults.total_max_cost_usd}]: `
    );
    const maxTokens = parsePositiveNumber(maxTokensRaw) || defaults.max_tokens;
    const maxCost = parsePositiveNumber(maxCostRaw) || defaults.total_max_cost_usd;
    return {
      max_tokens: maxTokens,
      total_max_cost_usd: maxCost,
    } as LlmBudgetLimits;
  } finally {
    rl.close();
  }
}

export async function ensureArchitectBudget(params: {
  contract: any;
  allowPrompt: boolean;
  actor?: string;
}) {
  const hasExisting = Boolean(params.contract?.budget);
  if (hasExisting) {
    const budget = ensureBudgetInitialized(params.contract, DEFAULT_ARCHITECT_BUDGET);
    return {
      budget,
      source: "existing",
    } as const;
  }

  const chosen = params.allowPrompt && process.stdin.isTTY && process.stdout.isTTY
    ? await promptBudget(DEFAULT_ARCHITECT_BUDGET)
    : { ...DEFAULT_ARCHITECT_BUDGET };

  params.contract.budget = normalizeContractBudget(chosen, DEFAULT_ARCHITECT_BUDGET);
  recordHistory(
    params.contract,
    params.contract.current_state,
    `Architect budget set (max_tokens=${chosen.max_tokens}, total_max_cost_usd=${chosen.total_max_cost_usd}) at ${now()}.`,
    params.actor
  );
  const budget = ensureBudgetInitialized(params.contract, DEFAULT_ARCHITECT_BUDGET);

  return {
    budget,
    source: params.allowPrompt ? "prompt-or-default" : "default",
  } as const;
}
