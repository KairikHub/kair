import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { runWithOpenClaw } from "../../src/core/runner/openclaw_runner";
import type { ExecutionRequest } from "../../src/core/runner/types";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kair-openclaw-artifacts-"));
}

describe("integration: openclaw runner artifacts", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("runner evidence paths include openclaw-config.json", async () => {
    const root = makeTempDir();
    const artifactsDir = path.join(root, "artifacts");
    fs.mkdirSync(artifactsDir, { recursive: true });

    const openclawStubPath = path.join(root, "openclaw-stub.sh");
    fs.writeFileSync(
      openclawStubPath,
      "#!/usr/bin/env sh\nprintf '%s' '{\"payloads\":[{\"text\":\"integration completed\"}],\"meta\":{}}'\n",
      { mode: 0o755 }
    );

    process.env.KAIR_OPENAI_API_KEY = "test-openai-key";
    process.env.KAIR_OPENCLAW_BIN = openclawStubPath;
    process.env.KAIR_LLM_PROVIDER = "openai";
    process.env.KAIR_LLM_MODEL = "gpt-5.1";

    const request: ExecutionRequest = {
      contractId: "integration_contract",
      intent: "Integration openclaw artifact check",
      plan: {
        version: "kair.plan.v1",
        title: "Integration plan",
        steps: [
          {
            id: "step-1",
            summary: "Run integration step",
          },
        ],
      },
      grants: ["local:read"],
      expectedEvidence: ["step-1"],
      artifactsDir,
    };

    const result = await runWithOpenClaw(request);
    expect(result.status).toBe("completed");

    const configPath = path.join(artifactsDir, "openclaw-config.json");
    expect(fs.existsSync(configPath)).toBe(true);
    expect(Array.isArray(result.evidencePaths)).toBe(true);
    expect(result.evidencePaths).toContain(configPath);
  });
});
