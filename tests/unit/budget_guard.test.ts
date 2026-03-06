import {
  assertBudgetAllowsCall,
  ensureBudgetInitialized,
  normalizeContractBudget,
  recordUsageAndEnforce,
} from "../../src/core/llm/budget_guard";
import { contractStore, setProjectName } from "../../src/core/store/contracts_store";
import { makeTempRoot } from "../helpers/tmp";

function resetStore() {
  contractStore.contracts.clear();
  contractStore.nextId = 1;
  setProjectName("");
}

describe("unit: llm budget guard", () => {
  test("normalizes legacy budget shape into deterministic ledger schema", () => {
    const normalized = normalizeContractBudget({
      max_tokens: 4321,
      total_max_cost_usd: 9,
    });

    expect(normalized.limits.max_tokens).toBe(4321);
    expect(normalized.limits.total_max_cost_usd).toBe(9);
    expect(normalized.policy.scope).toBe("lifetime_contract");
    expect(normalized.usage.total_tokens).toBe(0);
    expect(normalized.status).toBe("ok");
  });

  test("records exact usage and transitions to exhausted after crossing call", () => {
    const tmp = makeTempRoot();
    const previousDataDir = process.env.KAIR_DATA_DIR;
    const previousPricing = process.env.KAIR_LLM_PRICING_JSON;
    process.env.KAIR_DATA_DIR = tmp.dataDir;
    process.env.KAIR_LLM_PRICING_JSON = JSON.stringify({
      mock: {
        "mock-default": {
          input_usd_per_1m_tokens: 1,
          output_usd_per_1m_tokens: 1,
        },
      },
    });

    try {
      resetStore();
      const contract: any = {
        id: "budget_unit_crossing",
        budget: {
          max_tokens: 10,
          total_max_cost_usd: 10,
        },
      };

      const first = recordUsageAndEnforce(contract, {
        provider: "mock",
        model: "mock-default",
        usage: {
          input_tokens: 4,
          output_tokens: 4,
        },
      });
      expect(first.exhausted).toBe(false);
      expect(contract.budget.usage.total_tokens).toBe(8);
      expect(contract.budget.status).toBe("ok");

      const second = recordUsageAndEnforce(contract, {
        provider: "mock",
        model: "mock-default",
        usage: {
          input_tokens: 3,
          output_tokens: 2,
        },
      });
      expect(second.exhausted).toBe(true);
      expect(contract.budget.usage.total_tokens).toBe(13);
      expect(contract.budget.status).toBe("exhausted");
      expect(typeof contract.budget.exhausted_at).toBe("string");
    } finally {
      if (previousDataDir === undefined) {
        delete process.env.KAIR_DATA_DIR;
      } else {
        process.env.KAIR_DATA_DIR = previousDataDir;
      }
      if (previousPricing === undefined) {
        delete process.env.KAIR_LLM_PRICING_JSON;
      } else {
        process.env.KAIR_LLM_PRICING_JSON = previousPricing;
      }
      resetStore();
      tmp.cleanup();
    }
  });

  test("blocks pre-send when contract budget is already exhausted", () => {
    const contract: any = {
      id: "budget_unit_block",
      budget: {
        limits: {
          max_tokens: 100,
          total_max_cost_usd: 1,
        },
        policy: {
          scope: "lifetime_contract",
          enforcement: "post_usage_exact",
          precheck: "none",
          overshoot: "allow_then_stop",
        },
        pricing_snapshot: {},
        usage: {
          total_input_tokens: 101,
          total_output_tokens: 0,
          total_tokens: 101,
          total_cost_usd: 0,
          calls: 1,
        },
        status: "exhausted",
        exhausted_at: "2026-01-01T00:00:00.000Z",
        last_updated_at: "2026-01-01T00:00:00.000Z",
      },
    };

    expect(() => assertBudgetAllowsCall(contract)).toThrow(/budget exhausted/i);
  });

  test("pricing snapshot remains deterministic even if env pricing changes later", () => {
    const tmp = makeTempRoot();
    const previousDataDir = process.env.KAIR_DATA_DIR;
    const previousPricing = process.env.KAIR_LLM_PRICING_JSON;
    process.env.KAIR_DATA_DIR = tmp.dataDir;

    try {
      resetStore();
      const contract: any = { id: "budget_unit_pricing" };
      ensureBudgetInitialized(contract);

      process.env.KAIR_LLM_PRICING_JSON = JSON.stringify({
        mock: {
          "mock-default": {
            input_usd_per_1m_tokens: 1,
            output_usd_per_1m_tokens: 2,
          },
        },
      });

      recordUsageAndEnforce(contract, {
        provider: "mock",
        model: "mock-default",
        usage: {
          input_tokens: 100,
          output_tokens: 100,
        },
      });
      const firstCost = contract.budget.usage.total_cost_usd;

      process.env.KAIR_LLM_PRICING_JSON = JSON.stringify({
        mock: {
          "mock-default": {
            input_usd_per_1m_tokens: 100,
            output_usd_per_1m_tokens: 100,
          },
        },
      });

      recordUsageAndEnforce(contract, {
        provider: "mock",
        model: "mock-default",
        usage: {
          input_tokens: 100,
          output_tokens: 100,
        },
      });

      expect(contract.budget.pricing_snapshot.mock["mock-default"].input_usd_per_1m_tokens).toBe(1);
      expect(contract.budget.pricing_snapshot.mock["mock-default"].output_usd_per_1m_tokens).toBe(2);
      expect(contract.budget.usage.total_cost_usd).toBe(firstCost * 2);
    } finally {
      if (previousDataDir === undefined) {
        delete process.env.KAIR_DATA_DIR;
      } else {
        process.env.KAIR_DATA_DIR = previousDataDir;
      }
      if (previousPricing === undefined) {
        delete process.env.KAIR_LLM_PRICING_JSON;
      } else {
        process.env.KAIR_LLM_PRICING_JSON = previousPricing;
      }
      resetStore();
      tmp.cleanup();
    }
  });

  test("fails closed when provider/model pricing is missing", () => {
    const contract: any = { id: "budget_missing_price", budget: { max_tokens: 100, total_max_cost_usd: 100 } };
    const previousPricing = process.env.KAIR_LLM_PRICING_JSON;
    process.env.KAIR_LLM_PRICING_JSON = JSON.stringify({
      mock: {
        "mock-default": {
          input_usd_per_1m_tokens: 0,
          output_usd_per_1m_tokens: 0,
        },
      },
    });

    try {
      expect(() =>
        recordUsageAndEnforce(contract, {
          provider: "unknown-provider",
          model: "unknown-model",
          usage: {
            input_tokens: 1,
            output_tokens: 1,
          },
        })
      ).toThrow(/No pricing configured/);
    } finally {
      if (previousPricing === undefined) {
        delete process.env.KAIR_LLM_PRICING_JSON;
      } else {
        process.env.KAIR_LLM_PRICING_JSON = previousPricing;
      }
    }
  });
});
