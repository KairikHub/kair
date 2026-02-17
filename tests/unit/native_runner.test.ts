import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { runWithNativeRunner } from "../../src/core/runner/native_runner";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kair-native-runner-"));
}

function makeRequest(artifactsDir: string) {
  return {
    contractId: "native_runner_contract",
    intent: "Native runner test",
    plan: {
      version: "kair.plan.v1" as const,
      title: "Native plan",
      steps: [{ id: "step-1", summary: "Run native" }],
    },
    grants: [],
    expectedEvidence: ["step-1"],
    artifactsDir,
  };
}

describe("native runner", () => {
  test("fails when provider api key is missing", async () => {
    const artifactsDir = tempDir();
    const previous = process.env.KAIR_OPENAI_API_KEY;
    try {
      delete process.env.KAIR_OPENAI_API_KEY;
      const result = await runWithNativeRunner(makeRequest(artifactsDir), { provider: "openai" });
      expect(result.status).toBe("failed");
      expect(result.summary).toContain("Missing KAIR_OPENAI_API_KEY");
    } finally {
      if (previous === undefined) {
        delete process.env.KAIR_OPENAI_API_KEY;
      } else {
        process.env.KAIR_OPENAI_API_KEY = previous;
      }
      fs.rmSync(artifactsDir, { recursive: true, force: true });
    }
  });

  test("completes and writes native evidence artifacts", async () => {
    const artifactsDir = tempDir();
    const previous = process.env.KAIR_OPENAI_API_KEY;
    try {
      process.env.KAIR_OPENAI_API_KEY = "unit-test-key";
      const result = await runWithNativeRunner(makeRequest(artifactsDir), { provider: "openai" });
      expect(result.status).toBe("completed");
      expect(result.backend).toBe("native");
      expect(Array.isArray(result.evidencePaths)).toBe(true);
      expect(result.evidencePaths && result.evidencePaths.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(artifactsDir, "native-summary.md"))).toBe(true);
      expect(fs.existsSync(path.join(artifactsDir, "native-run.log"))).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.KAIR_OPENAI_API_KEY;
      } else {
        process.env.KAIR_OPENAI_API_KEY = previous;
      }
      fs.rmSync(artifactsDir, { recursive: true, force: true });
    }
  });
});
