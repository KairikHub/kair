import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

function readContractFromStore(dataDir: string, contractId: string) {
  const storePath = path.join(dataDir, "contracts.json");
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(raw);
  const contract = (parsed.contracts || []).find((item: any) => item.id === contractId);
  return { contract, parsed };
}

function prepareApprovedContract(params: {
  contractId: string;
  dataDir: string;
  artifactsDir: string;
  actor: string;
}) {
  const planJson = JSON.stringify({
    version: "kair.plan.v1",
    title: "Run force flow",
    steps: [
      {
        id: "step-1",
        summary: "Execute once",
      },
    ],
  });
  const env = {
    KAIR_DATA_DIR: params.dataDir,
    KAIR_ARTIFACTS_DIR: params.artifactsDir,
    KAIR_ACTOR: params.actor,
    KAIR_TEST_MODE: "1",
  };
  const setup = [
    ["contract", "--id", params.contractId, "Run force contract"],
    ["plan", params.contractId, "--interactive=false", planJson],
    ["propose", params.contractId],
    ["approve", params.contractId, "--actor", params.actor],
  ] as string[][];
  for (const args of setup) {
    const result = runCli(args, env);
    expect(result.status).toBe(0);
  }
  return env;
}

function writeOpenClawStub(params: {
  scriptPath: string;
  payloadText: string;
  setupCommands?: string[];
}) {
  const setupBlock = params.setupCommands && params.setupCommands.length > 0
    ? `${params.setupCommands.join("\n")}\n`
    : "";
  const response = JSON.stringify({
    payloads: [{ text: params.payloadText }],
    meta: {},
  });
  fs.writeFileSync(
    params.scriptPath,
    `#!/usr/bin/env sh\nset -e\n${setupBlock}printf '%s' '${response}'\n`,
    { mode: 0o755 }
  );
}

describe("e2e: run force", () => {
  test("run --force allows rerun from FAILED and records history", () => {
    const tmp = makeTempRoot();
    const contractId = "run_force";
    const claimedPath = path.join(tmp.artifactsDir, contractId, "run", "hello_world.py");
    const openclawStubPath = path.join(tmp.root, "openclaw-stub.sh");
    writeOpenClawStub({
      scriptPath: openclawStubPath,
      payloadText: JSON.stringify({
        summary: "forced rerun completed",
        claimedEvidencePaths: [claimedPath],
      }),
      setupCommands: [
        `mkdir -p \"${path.dirname(claimedPath)}\"`,
        `printf 'print(\"hello world\")\\n' > \"${claimedPath}\"`,
      ],
    });

    try {
      const envBase = prepareApprovedContract({
        contractId,
        dataDir: tmp.dataDir,
        artifactsDir: tmp.artifactsDir,
        actor: "e2e-actor",
      });
      const firstRun = runCli(["run", contractId], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "",
      });
      expect(firstRun.status).not.toBe(0);
      expect(firstRun.stderr).toContain("Missing KAIR_OPENAI_API_KEY");

      const secondRun = runCli(["run", contractId], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "test-openai-key",
        KAIR_OPENCLAW_BIN: openclawStubPath,
      });
      expect(secondRun.status).not.toBe(0);
      expect(secondRun.stderr).toContain("state is FAILED");

      const forcedRun = runCli(["run", contractId, "--force"], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "test-openai-key",
        KAIR_OPENCLAW_BIN: openclawStubPath,
      });
      expect(forcedRun.status).toBe(0);
      expect(forcedRun.stdout).toContain("Run status: completed");
      expect(forcedRun.stdout).toContain("forced rerun completed");

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract.current_state).toBe("COMPLETED");
      expect(
        after.contract.history.some((entry: any) =>
          String(entry.message).includes("Force run override requested; allowing rerun from FAILED.")
        )
      ).toBe(true);

      const runDir = path.join(tmp.artifactsDir, contractId, "run");
      expect(fs.existsSync(path.join(runDir, "openclaw-config.json"))).toBe(true);
      expect(fs.existsSync(claimedPath)).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  test("run fails when runner claims no evidence paths", () => {
    const tmp = makeTempRoot();
    const contractId = "run_no_claims";
    const openclawStubPath = path.join(tmp.root, "openclaw-stub-no-claims.sh");
    writeOpenClawStub({
      scriptPath: openclawStubPath,
      payloadText: JSON.stringify({
        summary: "ran without claims",
        claimedEvidencePaths: [],
      }),
    });

    try {
      const envBase = prepareApprovedContract({
        contractId,
        dataDir: tmp.dataDir,
        artifactsDir: tmp.artifactsDir,
        actor: "e2e-actor",
      });
      const run = runCli(["run", contractId, "--debug"], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "test-openai-key",
        KAIR_OPENCLAW_BIN: openclawStubPath,
      });
      expect(run.status).not.toBe(0);
      expect(run.stdout).toContain("FAILED: runner evidence validation failed.");
      expect(run.stderr).toContain("Runner did not claim any evidence paths.");

      const runResultPath = path.join(tmp.artifactsDir, contractId, "run", "run-result.json");
      const parsedRunResult = JSON.parse(fs.readFileSync(runResultPath, "utf8"));
      expect(parsedRunResult.failureReason).toContain("Runner did not claim any evidence paths.");
      expect(parsedRunResult.claimedEvidencePaths).toEqual([]);
      expect(parsedRunResult.missingEvidencePaths).toEqual([]);

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract.current_state).toBe("FAILED");
    } finally {
      tmp.cleanup();
    }
  });

  test("run fails when claimed evidence paths are missing", () => {
    const tmp = makeTempRoot();
    const contractId = "run_missing_evidence";
    const missingPath = path.join(tmp.artifactsDir, contractId, "run", "missing-file.txt");
    const openclawStubPath = path.join(tmp.root, "openclaw-stub-missing.sh");
    writeOpenClawStub({
      scriptPath: openclawStubPath,
      payloadText: JSON.stringify({
        summary: "claimed missing evidence",
        claimedEvidencePaths: [missingPath],
      }),
    });

    try {
      const envBase = prepareApprovedContract({
        contractId,
        dataDir: tmp.dataDir,
        artifactsDir: tmp.artifactsDir,
        actor: "e2e-actor",
      });
      const run = runCli(["run", contractId, "--debug"], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "test-openai-key",
        KAIR_OPENCLAW_BIN: openclawStubPath,
      });
      expect(run.status).not.toBe(0);
      expect(run.stdout).toContain("FAILED: runner evidence validation failed.");
      expect(run.stdout).toContain("Missing evidence paths:");
      expect(run.stderr).toContain("Runner claimed evidence paths that do not exist");

      const runResultPath = path.join(tmp.artifactsDir, contractId, "run", "run-result.json");
      const parsedRunResult = JSON.parse(fs.readFileSync(runResultPath, "utf8"));
      expect(parsedRunResult.failureReason).toContain("Runner claimed evidence paths that do not exist");
      expect(parsedRunResult.missingEvidencePaths).toEqual([missingPath]);

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract.current_state).toBe("FAILED");
    } finally {
      tmp.cleanup();
    }
  });

  test("run fails when claimed evidence paths are out of scope", () => {
    const tmp = makeTempRoot();
    const contractId = "run_out_of_scope";
    const outOfScopePath = path.join(tmp.root, "outside.txt");
    const openclawStubPath = path.join(tmp.root, "openclaw-stub-out-of-scope.sh");
    writeOpenClawStub({
      scriptPath: openclawStubPath,
      payloadText: JSON.stringify({
        summary: "claimed out of scope evidence",
        claimedEvidencePaths: [outOfScopePath],
      }),
      setupCommands: [
        `mkdir -p \"${path.dirname(outOfScopePath)}\"`,
        `printf 'outside scope\n' > \"${outOfScopePath}\"`,
      ],
    });

    try {
      const envBase = prepareApprovedContract({
        contractId,
        dataDir: tmp.dataDir,
        artifactsDir: tmp.artifactsDir,
        actor: "e2e-actor",
      });
      const run = runCli(["run", contractId, "--debug"], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "test-openai-key",
        KAIR_OPENCLAW_BIN: openclawStubPath,
      });
      expect(run.status).not.toBe(0);
      expect(run.stdout).toContain("FAILED: runner evidence validation failed.");
      expect(run.stdout).toContain("Out-of-scope evidence paths:");
      expect(run.stderr).toContain("Runner claimed evidence outside allowed run directory");

      const runResultPath = path.join(tmp.artifactsDir, contractId, "run", "run-result.json");
      const parsedRunResult = JSON.parse(fs.readFileSync(runResultPath, "utf8"));
      expect(parsedRunResult.failureReason).toContain("Runner claimed evidence outside allowed run directory");
      expect(parsedRunResult.outOfScopeClaimedEvidencePaths).toEqual([outOfScopePath]);

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract.current_state).toBe("FAILED");
    } finally {
      tmp.cleanup();
    }
  });
});
