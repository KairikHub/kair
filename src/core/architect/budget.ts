import { createInterface } from "node:readline/promises";

import { recordHistory } from "../contracts/history";
import { now } from "../time";
import type { ArchitectBudget } from "./types";

export const DEFAULT_ARCHITECT_BUDGET: ArchitectBudget = {
  max_tokens: 120000,
  total_max_cost_usd: 15,
};

function parsePositiveNumber(raw: string) {
  const parsed = Number((raw || "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeBudget(raw: any): ArchitectBudget | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const maxTokens = parsePositiveNumber(String(raw.max_tokens ?? ""));
  const maxCost = parsePositiveNumber(String(raw.total_max_cost_usd ?? ""));
  if (!maxTokens || !maxCost) {
    return null;
  }
  return {
    max_tokens: maxTokens,
    total_max_cost_usd: maxCost,
  };
}

async function promptBudget(defaults: ArchitectBudget) {
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
    } as ArchitectBudget;
  } finally {
    rl.close();
  }
}

export async function ensureArchitectBudget(params: {
  contract: any;
  allowPrompt: boolean;
  actor?: string;
}) {
  const existing = normalizeBudget(params.contract?.budget);
  if (existing) {
    return {
      budget: existing,
      source: "existing",
    } as const;
  }

  const chosen = params.allowPrompt && process.stdin.isTTY && process.stdout.isTTY
    ? await promptBudget(DEFAULT_ARCHITECT_BUDGET)
    : { ...DEFAULT_ARCHITECT_BUDGET };

  params.contract.budget = chosen;
  recordHistory(
    params.contract,
    params.contract.current_state,
    `Architect budget set (max_tokens=${chosen.max_tokens}, total_max_cost_usd=${chosen.total_max_cost_usd}) at ${now()}.`,
    params.actor
  );

  return {
    budget: chosen,
    source: params.allowPrompt ? "prompt-or-default" : "default",
  } as const;
}
