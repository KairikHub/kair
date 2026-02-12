import { DPC_VERSION } from "../../src/core/dpc/schema";
import { parseAndValidateDpcJson } from "../../src/core/dpc/validate";

function buildValidDpcJson() {
  return JSON.stringify({
    version: DPC_VERSION,
    topic: "Plan replay across executors",
    assumptions: ["Replay requires stable plan snapshots"],
    constraints: ["Must remain local-first"],
    decisions: [
      {
        id: "d-1",
        decision: "Use strict schema validation for DPC payloads",
        rationale: "Prevents drift and silent schema mismatches",
        status: "active",
      },
    ],
    open_questions: [
      {
        id: "q-1",
        question: "Can sidecar DPCs stay under 2KB median?",
        impact: "Affects long-term readability and review flow",
      },
    ],
    evidence: [
      {
        id: "e-1",
        kind: "file",
        ref: "docs/IDEAS.md",
        note: "Initial parked-idea examples",
      },
    ],
    updated_at: "2026-02-12T00:00:00Z",
    parent_dpc_id: "dpc-root",
  });
}

describe("dpc schema validator", () => {
  test("valid dpc passes and returns normalized DpcV1 object", () => {
    const parsed = parseAndValidateDpcJson(buildValidDpcJson());
    expect(parsed).toEqual({
      version: DPC_VERSION,
      topic: "Plan replay across executors",
      assumptions: ["Replay requires stable plan snapshots"],
      constraints: ["Must remain local-first"],
      decisions: [
        {
          id: "d-1",
          decision: "Use strict schema validation for DPC payloads",
          rationale: "Prevents drift and silent schema mismatches",
          status: "active",
        },
      ],
      open_questions: [
        {
          id: "q-1",
          question: "Can sidecar DPCs stay under 2KB median?",
          impact: "Affects long-term readability and review flow",
        },
      ],
      evidence: [
        {
          id: "e-1",
          kind: "file",
          ref: "docs/IDEAS.md",
          note: "Initial parked-idea examples",
        },
      ],
      updated_at: "2026-02-12T00:00:00Z",
      parent_dpc_id: "dpc-root",
    });
  });

  test('invalid JSON throws "Invalid JSON" message', () => {
    expect(() => parseAndValidateDpcJson("{invalid")).toThrow(/Invalid JSON/);
  });

  test("wrong version throws", () => {
    const raw = JSON.stringify({
      version: "kair.dpc.v0",
      topic: "Bad version",
      assumptions: [],
      constraints: [],
      decisions: [],
      open_questions: [],
      evidence: [],
      updated_at: "2026-02-12T00:00:00Z",
    });
    expect(() => parseAndValidateDpcJson(raw)).toThrow("Dpc.version must equal kair.dpc.v1");
  });

  test("unknown top-level key throws", () => {
    const raw = JSON.stringify({
      version: DPC_VERSION,
      topic: "Unknown key",
      assumptions: [],
      constraints: [],
      decisions: [],
      open_questions: [],
      evidence: [],
      updated_at: "2026-02-12T00:00:00Z",
      xyz: true,
    });
    expect(() => parseAndValidateDpcJson(raw)).toThrow("Dpc contains unknown top-level key: xyz");
  });

  test("invalid decision status throws", () => {
    const raw = JSON.stringify({
      version: DPC_VERSION,
      topic: "Bad decision status",
      assumptions: [],
      constraints: [],
      decisions: [{ id: "d-1", decision: "A decision", status: "pending" }],
      open_questions: [],
      evidence: [],
      updated_at: "2026-02-12T00:00:00Z",
    });
    expect(() => parseAndValidateDpcJson(raw)).toThrow(
      "Dpc.decisions[0].status must be one of: active, superseded"
    );
  });

  test("evidence kind enforces enum values", () => {
    const raw = JSON.stringify({
      version: DPC_VERSION,
      topic: "Bad evidence kind",
      assumptions: [],
      constraints: [],
      decisions: [],
      open_questions: [],
      evidence: [{ id: "e-1", kind: "log", ref: "artifacts/log.txt" }],
      updated_at: "2026-02-12T00:00:00Z",
    });
    expect(() => parseAndValidateDpcJson(raw)).toThrow(
      "Dpc.evidence[0].kind must be one of: prompt, plan, diff, file, url"
    );
  });
});
