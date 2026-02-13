import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { ExecutionRequest } from "../../src/core/runner/types";

const spawnSyncMock = jest.fn();

jest.mock("node:child_process", () => ({
  spawnSync: (...args: any[]) => spawnSyncMock(...args),
}));

import { runWithOpenClaw } from "../../src/core/runner/openclaw_runner";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kair-openclaw-runner-"));
}

function makeRequest(artifactsDir: string): ExecutionRequest {
  return {
    contractId: "runner_contract",
    intent: "Execute unit-test runner payload",
    plan: {
      version: "kair.plan.v1",
      title: "Runner unit test plan",
      steps: [
        {
          id: "step-1",
          summary: "Do one thing",
        },
      ],
    },
    grants: ["local:read", "local:write"],
    expectedEvidence: ["step-1"],
    artifactsDir,
  };
}

describe("openclaw runner subprocess adapter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    spawnSyncMock.mockReset();
    process.env = { ...originalEnv };
    process.env.KAIR_OPENAI_API_KEY = "test-kair-openai-key";
    process.env.KAIR_OPENCLAW_BIN = "openclaw";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("missing KAIR_OPENAI_API_KEY fails before subprocess execution", async () => {
    delete process.env.KAIR_OPENAI_API_KEY;
    const artifactsDir = makeTempDir();

    const result = await runWithOpenClaw(makeRequest(artifactsDir));

    expect(result.status).toBe("failed");
    expect(result.summary).toContain("Missing KAIR_OPENAI_API_KEY");
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  test("ENOENT from subprocess reports OpenClaw CLI not found", async () => {
    const artifactsDir = makeTempDir();
    process.env.KAIR_OPENCLAW_BIN = "/missing/openclaw";
    const enoent: any = new Error("spawn /missing/openclaw ENOENT");
    enoent.code = "ENOENT";
    spawnSyncMock.mockReturnValue({
      status: null,
      stdout: "",
      stderr: "",
      error: enoent,
    });

    const result = await runWithOpenClaw(makeRequest(artifactsDir));

    expect(result.status).toBe("failed");
    expect(result.summary).toContain("OpenClaw CLI not found");
    expect(result.outputs.commandPath).toBe("/missing/openclaw");
    expect(result.outputs.parserMode).toBe("spawn_error");
    expect(fs.existsSync(path.join(artifactsDir, "openclaw-command.json"))).toBe(true);
    expect(fs.existsSync(path.join(artifactsDir, "openclaw-stderr.log"))).toBe(true);
  });

  test("exit 0 with valid JSON stdout maps to completed result", async () => {
    const artifactsDir = makeTempDir();
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: JSON.stringify({
        payloads: [{ text: "Execution done" }],
        meta: {},
      }),
      stderr: "",
      error: undefined,
    });

    const result = await runWithOpenClaw(makeRequest(artifactsDir));

    expect(result.status).toBe("completed");
    expect(result.summary).toContain("Execution done");
    expect(result.logsPath).toBe(path.join(artifactsDir, "openclaw-stdout.log"));
    expect(result.outputs.parserMode).toBe("json");
    expect(result.outputs.enabledTools).toEqual(["fs_read", "fs_write"]);
    expect(fs.existsSync(path.join(artifactsDir, "openclaw-command.json"))).toBe(true);
  });

  test("non-zero exit returns failed summary with stderr and logs", async () => {
    const artifactsDir = makeTempDir();
    spawnSyncMock.mockReturnValue({
      status: 2,
      stdout: "",
      stderr: "invalid openclaw config\nmore details",
      error: undefined,
    });

    const result = await runWithOpenClaw(makeRequest(artifactsDir));

    expect(result.status).toBe("failed");
    expect(result.summary).toContain("invalid openclaw config");
    expect(result.outputs.parserMode).toBe("raw");
    expect(result.logsPath).toBe(path.join(artifactsDir, "openclaw-stderr.log"));
    expect(fs.readFileSync(path.join(artifactsDir, "openclaw-stderr.log"), "utf8")).toContain(
      "invalid openclaw config"
    );
  });

  test("exit 0 with invalid JSON stdout returns parse error", async () => {
    const artifactsDir = makeTempDir();
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: "not-json-output",
      stderr: "",
      error: undefined,
    });

    const result = await runWithOpenClaw(makeRequest(artifactsDir));

    expect(result.status).toBe("failed");
    expect(result.summary).toContain("non-JSON output");
    expect(result.outputs.parserMode).toBe("parse_error");
    expect(result.logsPath).toBe(path.join(artifactsDir, "openclaw-stdout.log"));
  });
});
