import * as fs from "node:fs";
import * as path from "node:path";

import { DPC_VERSION, DpcV1 } from "../../src/core/dpc/schema";
import { getDpcPath, loadDpcV1, saveDpcV1 } from "../../src/core/dpc/storage";
import { makeTempRoot } from "../helpers/tmp";

function buildDpc(): DpcV1 {
  return {
    version: DPC_VERSION,
    topic: "DPC persistence test",
    assumptions: ["Assumption A"],
    constraints: ["Constraint A"],
    decisions: [{ id: "d-1", decision: "Decision A", status: "active" }],
    open_questions: [{ id: "q-1", question: "Question A" }],
    evidence: [{ id: "e-1", kind: "file", ref: "docs/IDEAS.md" }],
    updated_at: "2026-02-12T00:00:00Z",
  };
}

describe("integration: dpc storage", () => {
  test("uses artifacts override and round-trips save/load", () => {
    const tmp = makeTempRoot();
    const previousArtifactsDir = process.env.KAIR_ARTIFACTS_DIR;
    process.env.KAIR_ARTIFACTS_DIR = tmp.artifactsDir;
    const contractId = "contract_dpc_storage_it";
    const dpc = buildDpc();

    try {
      saveDpcV1(contractId, dpc);

      const expectedPath = path.join(tmp.artifactsDir, contractId, "dpc", "dpc_v1.json");
      expect(getDpcPath(contractId)).toBe(expectedPath);
      expect(fs.existsSync(expectedPath)).toBe(true);

      const loaded = loadDpcV1(contractId);
      expect(loaded).toEqual(dpc);
    } finally {
      if (previousArtifactsDir === undefined) {
        delete process.env.KAIR_ARTIFACTS_DIR;
      } else {
        process.env.KAIR_ARTIFACTS_DIR = previousArtifactsDir;
      }
      tmp.cleanup();
    }
  });

  test("missing file returns null", () => {
    const tmp = makeTempRoot();
    const previousArtifactsDir = process.env.KAIR_ARTIFACTS_DIR;
    process.env.KAIR_ARTIFACTS_DIR = tmp.artifactsDir;

    try {
      expect(loadDpcV1("contract_missing_dpc_it")).toBeNull();
    } finally {
      if (previousArtifactsDir === undefined) {
        delete process.env.KAIR_ARTIFACTS_DIR;
      } else {
        process.env.KAIR_ARTIFACTS_DIR = previousArtifactsDir;
      }
      tmp.cleanup();
    }
  });

  test("invalid JSON throws clear error", () => {
    const tmp = makeTempRoot();
    const previousArtifactsDir = process.env.KAIR_ARTIFACTS_DIR;
    process.env.KAIR_ARTIFACTS_DIR = tmp.artifactsDir;
    const contractId = "contract_invalid_dpc_it";
    const dpcPath = path.join(tmp.artifactsDir, contractId, "dpc", "dpc_v1.json");

    try {
      fs.mkdirSync(path.dirname(dpcPath), { recursive: true });
      fs.writeFileSync(dpcPath, "{invalid");

      expect(() => loadDpcV1(contractId)).toThrow(`DPC file at "${dpcPath}" is invalid JSON`);
    } finally {
      if (previousArtifactsDir === undefined) {
        delete process.env.KAIR_ARTIFACTS_DIR;
      } else {
        process.env.KAIR_ARTIFACTS_DIR = previousArtifactsDir;
      }
      tmp.cleanup();
    }
  });
});
