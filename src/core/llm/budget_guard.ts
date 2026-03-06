import { now } from "../time";

export type LlmBudgetLimits = {
  max_tokens: number;
  total_max_cost_usd: number;
};

export type LlmBudgetPolicy = {
  scope: "lifetime_contract";
  enforcement: "post_usage_exact";
  precheck: "none";
  overshoot: "allow_then_stop";
};

export type LlmModelPricing = {
  input_usd_per_1m_tokens: number;
  output_usd_per_1m_tokens: number;
};

export type LlmPricingSnapshot = Record<string, Record<string, LlmModelPricing>>;

export type LlmBudgetUsage = {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  calls: number;
};

export type ContractLlmBudget = {
  limits: LlmBudgetLimits;
  policy: LlmBudgetPolicy;
  pricing_snapshot: LlmPricingSnapshot;
  usage: LlmBudgetUsage;
  status: "ok" | "exhausted";
  exhausted_at: string | null;
  last_updated_at: string;
};

export type BudgetUsageRecord = {
  provider: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens?: number;
  };
};

export const DEFAULT_LLM_BUDGET_LIMITS: LlmBudgetLimits = {
  max_tokens: 120000,
  total_max_cost_usd: 15,
};

const DEFAULT_POLICY: LlmBudgetPolicy = {
  scope: "lifetime_contract",
  enforcement: "post_usage_exact",
  precheck: "none",
  overshoot: "allow_then_stop",
};

const DEFAULT_PRICING_CATALOG: LlmPricingSnapshot = {
  openai: {
    "gpt-5.1": {
      input_usd_per_1m_tokens: 2,
      output_usd_per_1m_tokens: 8,
    },
  },
  claude: {
    "claude-sonnet-4-5": {
      input_usd_per_1m_tokens: 3,
      output_usd_per_1m_tokens: 15,
    },
  },
  mock: {
    "mock-default": {
      input_usd_per_1m_tokens: 0,
      output_usd_per_1m_tokens: 0,
    },
  },
};

function persistStore() {
  try {
    // Lazy-load to avoid module cycle with contracts_store normalization paths.
    const store = require("../store/contracts_store");
    if (store && typeof store.saveStore === "function") {
      store.saveStore();
    }
  } catch {
    // no-op for early bootstrapping paths
  }
}

function parsePositiveNumber(raw: unknown) {
  const parsed = Number(String(raw ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(raw: unknown) {
  const parsed = Number(String(raw ?? "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseNonNegativeInteger(raw: unknown) {
  const parsed = Number(String(raw ?? "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function clonePricingSnapshot(snapshot: LlmPricingSnapshot): LlmPricingSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as LlmPricingSnapshot;
}

function roundUsd(value: number) {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function normalizeProvider(providerRaw: string) {
  return String(providerRaw || "").trim().toLowerCase();
}

function normalizeModel(modelRaw: string) {
  return String(modelRaw || "").trim();
}

function normalizeLimits(raw: any, defaults: LlmBudgetLimits): LlmBudgetLimits {
  const maxTokens = parsePositiveNumber(raw?.max_tokens);
  const maxCost = parsePositiveNumber(raw?.total_max_cost_usd);
  return {
    max_tokens: maxTokens || defaults.max_tokens,
    total_max_cost_usd: maxCost || defaults.total_max_cost_usd,
  };
}

function normalizeUsage(raw: any): LlmBudgetUsage {
  const totalInput = parseNonNegativeInteger(raw?.total_input_tokens) || 0;
  const totalOutput = parseNonNegativeInteger(raw?.total_output_tokens) || 0;
  const derivedTotal = totalInput + totalOutput;
  const totalTokens = parseNonNegativeInteger(raw?.total_tokens);
  return {
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    total_tokens: totalTokens === null ? derivedTotal : totalTokens,
    total_cost_usd: parseNonNegativeNumber(raw?.total_cost_usd) || 0,
    calls: parseNonNegativeInteger(raw?.calls) || 0,
  };
}

function normalizePricingSnapshot(raw: any): LlmPricingSnapshot {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const output: LlmPricingSnapshot = {};
  for (const [providerNameRaw, modelsRaw] of Object.entries(raw)) {
    const providerName = normalizeProvider(providerNameRaw);
    if (!providerName || !modelsRaw || typeof modelsRaw !== "object") {
      continue;
    }
    for (const [modelNameRaw, priceRaw] of Object.entries(modelsRaw as Record<string, any>)) {
      const modelName = normalizeModel(modelNameRaw);
      const inputPrice = parseNonNegativeNumber((priceRaw as any)?.input_usd_per_1m_tokens);
      const outputPrice = parseNonNegativeNumber((priceRaw as any)?.output_usd_per_1m_tokens);
      if (!modelName || inputPrice === null || outputPrice === null) {
        continue;
      }
      if (!output[providerName]) {
        output[providerName] = {};
      }
      output[providerName][modelName] = {
        input_usd_per_1m_tokens: inputPrice,
        output_usd_per_1m_tokens: outputPrice,
      };
    }
  }
  return output;
}

function mergePricing(base: LlmPricingSnapshot, overlay: LlmPricingSnapshot) {
  const merged = clonePricingSnapshot(base);
  for (const [provider, models] of Object.entries(overlay)) {
    if (!merged[provider]) {
      merged[provider] = {};
    }
    for (const [model, pricing] of Object.entries(models)) {
      merged[provider][model] = pricing;
    }
  }
  return merged;
}

function loadPricingCatalog() {
  const envRaw = (process.env.KAIR_LLM_PRICING_JSON || "").trim();
  if (!envRaw) {
    return clonePricingSnapshot(DEFAULT_PRICING_CATALOG);
  }
  let parsed: any = null;
  try {
    parsed = JSON.parse(envRaw);
  } catch (error: any) {
    throw new Error(
      `Invalid KAIR_LLM_PRICING_JSON: ${error?.message || String(error)}. Expected JSON object keyed by provider/model.`
    );
  }
  const overlay = normalizePricingSnapshot(parsed);
  return mergePricing(DEFAULT_PRICING_CATALOG, overlay);
}

function buildDefaultBudget(limits: LlmBudgetLimits): ContractLlmBudget {
  const ts = now();
  return {
    limits,
    policy: { ...DEFAULT_POLICY },
    pricing_snapshot: {},
    usage: {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0,
      total_cost_usd: 0,
      calls: 0,
    },
    status: "ok",
    exhausted_at: null,
    last_updated_at: ts,
  };
}

export function normalizeContractBudget(
  rawBudget: any,
  defaults: LlmBudgetLimits = DEFAULT_LLM_BUDGET_LIMITS
): ContractLlmBudget {
  if (!rawBudget || typeof rawBudget !== "object") {
    return buildDefaultBudget(defaults);
  }

  const raw = rawBudget as Record<string, any>;
  const looksLikeLegacy = "max_tokens" in raw || "total_max_cost_usd" in raw;
  if (looksLikeLegacy) {
    const budget = buildDefaultBudget(normalizeLimits(raw, defaults));
    budget.last_updated_at = String(raw.last_updated_at || raw.exhausted_at || now());
    return budget;
  }

  const limits = normalizeLimits(raw.limits || {}, defaults);
  const normalized = buildDefaultBudget(limits);
  normalized.policy = {
    scope: "lifetime_contract",
    enforcement: "post_usage_exact",
    precheck: "none",
    overshoot: "allow_then_stop",
  };
  normalized.pricing_snapshot = normalizePricingSnapshot(raw.pricing_snapshot);
  normalized.usage = normalizeUsage(raw.usage || {});
  normalized.status = raw.status === "exhausted" ? "exhausted" : "ok";
  normalized.exhausted_at = raw.exhausted_at ? String(raw.exhausted_at) : null;
  normalized.last_updated_at = String(raw.last_updated_at || now());

  return normalized;
}

export function ensureBudgetInitialized(
  contract: any,
  defaults: LlmBudgetLimits = DEFAULT_LLM_BUDGET_LIMITS
) {
  const normalized = normalizeContractBudget(contract?.budget, defaults);
  const before = JSON.stringify(contract?.budget || null);
  const after = JSON.stringify(normalized);
  contract.budget = normalized;
  if (before !== after) {
    persistStore();
  }
  return normalized;
}

export function assertBudgetAllowsCall(contract: any) {
  const budget = ensureBudgetInitialized(contract);
  if (budget.status !== "exhausted") {
    return budget;
  }
  throw new Error(
    [
      `Contract "${contract.id}" budget exhausted at ${budget.exhausted_at || "unknown"}.`,
      `Consumed tokens=${budget.usage.total_tokens}/${budget.limits.max_tokens}, cost_usd=${budget.usage.total_cost_usd}/${budget.limits.total_max_cost_usd}.`,
      "Increase budget limits on the contract to continue provider-backed prompts.",
    ].join(" ")
  );
}

function resolveSnapshotPrice(
  budget: ContractLlmBudget,
  providerRaw: string,
  modelRaw: string
): LlmModelPricing {
  const provider = normalizeProvider(providerRaw);
  const model = normalizeModel(modelRaw);
  if (!provider || !model) {
    throw new Error("Provider and model are required for budget accounting.");
  }

  if (budget.pricing_snapshot?.[provider]?.[model]) {
    return budget.pricing_snapshot[provider][model];
  }

  const catalog = loadPricingCatalog();
  const catalogEntry = catalog?.[provider]?.[model];
  if (!catalogEntry) {
    throw new Error(
      `No pricing configured for provider/model "${provider}/${model}". Set KAIR_LLM_PRICING_JSON with input_usd_per_1m_tokens and output_usd_per_1m_tokens.`
    );
  }

  if (!budget.pricing_snapshot[provider]) {
    budget.pricing_snapshot[provider] = {};
  }
  budget.pricing_snapshot[provider][model] = {
    input_usd_per_1m_tokens: catalogEntry.input_usd_per_1m_tokens,
    output_usd_per_1m_tokens: catalogEntry.output_usd_per_1m_tokens,
  };
  return budget.pricing_snapshot[provider][model];
}

export function computeCostFromSnapshot(params: {
  budget: ContractLlmBudget;
  provider: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}) {
  const pricing = resolveSnapshotPrice(params.budget, params.provider, params.model);
  const inputCost = (params.usage.input_tokens / 1_000_000) * pricing.input_usd_per_1m_tokens;
  const outputCost = (params.usage.output_tokens / 1_000_000) * pricing.output_usd_per_1m_tokens;
  return roundUsd(inputCost + outputCost);
}

export function recordUsageAndEnforce(contract: any, record: BudgetUsageRecord) {
  const budget = ensureBudgetInitialized(contract);
  const inputTokens = Math.max(0, Math.floor(Number(record.usage?.input_tokens || 0)));
  const outputTokens = Math.max(0, Math.floor(Number(record.usage?.output_tokens || 0)));
  const totalTokens = Math.max(
    inputTokens + outputTokens,
    Math.floor(Number(record.usage?.total_tokens || 0))
  );

  const callCostUsd = computeCostFromSnapshot({
    budget,
    provider: record.provider,
    model: record.model,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  });

  budget.usage.total_input_tokens += inputTokens;
  budget.usage.total_output_tokens += outputTokens;
  budget.usage.total_tokens += totalTokens;
  budget.usage.total_cost_usd = roundUsd(budget.usage.total_cost_usd + callCostUsd);
  budget.usage.calls += 1;

  const isExhausted =
    budget.usage.total_tokens > budget.limits.max_tokens
    || budget.usage.total_cost_usd > budget.limits.total_max_cost_usd;

  if (isExhausted && budget.status !== "exhausted") {
    budget.status = "exhausted";
    budget.exhausted_at = now();
  }

  if (!isExhausted) {
    budget.status = "ok";
    budget.exhausted_at = null;
  }

  budget.last_updated_at = now();
  contract.budget = budget;
  persistStore();

  return {
    budget,
    call: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      cost_usd: callCostUsd,
    },
    exhausted: budget.status === "exhausted",
  };
}
