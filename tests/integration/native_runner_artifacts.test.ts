import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { runWithNativeRunner } from "../../src/core/runner/native_runner";

describe("integration: native runner artifacts", () => {
  test("native runner writes logs and evidence paths", async () => {
    const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), "kair-native-artifacts-"));
    const previous = process.env.KAIR_OPENAI_API_KEY;

    try {
      process.env.KAIR_OPENAI_API_KEY = "integration-test-key";
      const result = await runWithNativeRunner(
        {
          contractId: "native_integration",
          intent: "Integration native runner",
          plan: {
            version: "kair.plan.v1",
            title: "Native integration plan",
            steps: [{ id: "step-1", summary: "Write integration evidence" }],
          },
          grants: [],
          expectedEvidence: ["step-1"],
          artifactsDir,
        },
        {
          provider: "openai",
          model: "gpt-5.1",
        }
      );

      expect(result.status).toBe("completed");
      expect(result.backend).toBe("native");
      expect(fs.existsSync(path.join(artifactsDir, "native-summary.md"))).toBe(true);
      expect(fs.existsSync(path.join(artifactsDir, "native-run.log"))).toBe(true);
      expect(Array.isArray(result.evidencePaths)).toBe(true);
      expect(result.evidencePaths?.[0]).toBe(path.join(artifactsDir, "native-summary.md"));
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
