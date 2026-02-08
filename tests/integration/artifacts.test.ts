import * as fs from "node:fs";
import * as path from "node:path";

import { writeArtifact } from "../../src/core/contracts/artifacts";
import { makeTempRoot } from "../helpers/tmp";

describe("integration: artifact writer", () => {
  test("writes run artifact files into override artifacts directory", () => {
    const tmp = makeTempRoot();
    const previousArtifactsDir = process.env.KAIR_ARTIFACTS_DIR;
    process.env.KAIR_ARTIFACTS_DIR = tmp.artifactsDir;

    try {
      const contract: any = {
        id: "contract_artifact_it",
        activeVersion: 2,
        controlsApproved: ["local:write"],
        artifacts: [],
      };

      writeArtifact(contract, {
        intent: "Artifact test intent",
        plan: "Artifact test plan",
      });

      const artifactContractDir = path.join(tmp.artifactsDir, contract.id);
      expect(fs.existsSync(artifactContractDir)).toBe(true);
      const files = fs.readdirSync(artifactContractDir);
      expect(files.length).toBeGreaterThan(0);
      expect(contract.artifacts.length).toBeGreaterThan(0);
      expect(contract.artifacts[0].content.startsWith(artifactContractDir)).toBe(true);
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
