import {
  PlanLlmRequestRecord,
  sanitizePlanLlmRequestRecord,
} from "../../src/core/llm/plan_request_record";

function buildRecordWithMessage(content: string): PlanLlmRequestRecord {
  return {
    provider: "openai",
    model: "gpt-5.1",
    temperature: 0.1,
    timestamp: "2026-02-11T00:00:00.000Z",
    contractId: "contract_test",
    mode: "generate",
    messages: [
      {
        role: "user",
        content,
      },
    ],
  };
}

describe("plan llm request record sanitizer", () => {
  test("redacts explicit secrets and common api key patterns", () => {
    const secret = "sk-REAL_SECRET_VALUE_123456";
    const content = [
      `Authorization: Bearer ${secret}`,
      `KAIR_OPENAI_API_KEY=${secret}`,
      `raw: ${secret}`,
      "another key sk-abcdef1234567890",
    ].join("\n");
    const record = buildRecordWithMessage(content);
    record.changeRequestText = `Use key ${secret} only for local testing.`;

    const sanitized = sanitizePlanLlmRequestRecord(record, {
      secrets: [secret],
      maxMessageLength: 4000,
    });
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("sk-abcdef1234567890");
    expect(serialized).toContain("[REDACTED_API_KEY]");
    expect(sanitized.messages[0].content).toContain("Bearer [REDACTED_API_KEY]");
    expect(sanitized.messages[0].content).toContain("KAIR_OPENAI_API_KEY=[REDACTED_API_KEY]");
    expect(sanitized.changeRequestText).toContain("[REDACTED_API_KEY]");
  });

  test("truncates message content to safe length", () => {
    const oversized = `${"x".repeat(4100)}sk-overflow-secret-1234567890`;
    const record = buildRecordWithMessage(oversized);

    const sanitized = sanitizePlanLlmRequestRecord(record, { maxMessageLength: 4000 });

    expect(sanitized.messages[0].content.length).toBeGreaterThan(4000);
    expect(sanitized.messages[0].content.startsWith("x".repeat(4000))).toBe(true);
    expect(sanitized.messages[0].content).toContain("...[TRUNCATED");
    expect(sanitized.messages[0].content).not.toContain("sk-overflow-secret-1234567890");
  });

  test("does not mutate original record", () => {
    const original = buildRecordWithMessage("token sk-original-secret-1234567890");
    const originalClone = JSON.parse(JSON.stringify(original));

    const sanitized = sanitizePlanLlmRequestRecord(original);

    expect(original).toEqual(originalClone);
    expect(sanitized.messages[0].content).not.toContain("sk-original-secret-1234567890");
  });
});
