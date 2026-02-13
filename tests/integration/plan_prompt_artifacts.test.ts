import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

function readPromptArtifacts(promptsDir: string) {
  const files = fs.readdirSync(promptsDir).sort();
  return files.map((file) => {
    const fullPath = path.join(promptsDir, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    return {
      file,
      path: fullPath,
      raw,
      json: JSON.parse(raw),
    };
  });
}

describe("integration: plan prompt artifacts", () => {
  test("writes generate/refine prompt artifacts as valid JSON under prompts directory", () => {
    const tmp = makeTempRoot();
    const contractId = "plan_prompt_artifacts_it";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: "",
      KAIRIK_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Prompt artifact contract"],
        env
      );
      expect(create.status).toBe(0);

      const generate = runCli(
        [
          "plan",
          contractId,
          "--interactive=false",
          "--provider",
          "mock",
          "--instructions",
          "Generate initial plan",
        ],
        env
      );
      expect(generate.status).toBe(0);

      const refine = runCli(
        [
          "plan",
          contractId,
          "--interactive=false",
          "--provider",
          "mock",
          "--instructions",
          "Refine with rollback validation",
        ],
        env
      );
      expect(refine.status).toBe(0);

      const promptsDir = path.join(tmp.artifactsDir, contractId, "prompts");
      expect(fs.existsSync(promptsDir)).toBe(true);

      const artifacts = readPromptArtifacts(promptsDir);
      expect(artifacts.length).toBeGreaterThanOrEqual(2);
      expect(artifacts.some((artifact) => artifact.file.endsWith("-plan-generate.json"))).toBe(true);
      expect(artifacts.some((artifact) => artifact.file.endsWith("-plan-refine.json"))).toBe(true);

      for (const artifact of artifacts) {
        expect(() => JSON.parse(artifact.raw)).not.toThrow();
        expect(artifact.json.contractId).toBe(contractId);
        expect(["generate", "refine"]).toContain(artifact.json.mode);
        expect(Array.isArray(artifact.json.messages)).toBe(true);
      }

      const refineArtifacts = artifacts.filter((artifact) => artifact.file.endsWith("-plan-refine.json"));
      expect(refineArtifacts.length).toBeGreaterThan(0);
      for (const artifact of refineArtifacts) {
        expect(typeof artifact.json.changeRequestText).toBe("string");
        expect(artifact.json.changeRequestText.length).toBeGreaterThan(0);
      }
    } finally {
      tmp.cleanup();
    }
  });
});
