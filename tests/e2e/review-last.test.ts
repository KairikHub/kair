import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: review surface", () => {
  test("review defaults to last and top-level review/accept/emit render one-screen summary", () => {
    const tmp = makeTempRoot();
    const contractId = "review_demo";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const setupSteps = [
        ["contract", "create", "--id", contractId, "Review demo contract"],
        ["contract", "plan", contractId, "Execute review demo flow"],
        ["contract", "request-approval", contractId],
        ["contract", "approve", contractId, "--actor", "e2e-actor"],
        ["contract", "run", contractId],
      ] as string[][];

      for (const args of setupSteps) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const reviewLast = runCli(["review", "--last"], env);
      expect(reviewLast.status).toBe(0);
      expect(reviewLast.stdout).toContain("KAIR REVIEW");
      expect(reviewLast.stdout).toContain(contractId);
      expect(reviewLast.stdout).toContain("EVIDENCE");
      expect(reviewLast.stdout).toContain("diff.patch");

      const reviewDefault = runCli(["review"], env);
      expect(reviewDefault.status).toBe(0);
      expect(reviewDefault.stdout).toContain("KAIR REVIEW");
      expect(reviewDefault.stdout).toContain(contractId);

      const statusDefault = runCli(["status"], env);
      expect(statusDefault.status).toBe(0);
      expect(statusDefault.stdout).toContain("Contract Summary");
      expect(statusDefault.stdout).toContain(`Contract: ${contractId}`);

      const statusLast = runCli(["status", "--last"], env);
      expect(statusLast.status).toBe(0);
      expect(statusLast.stdout).toContain("Contract Summary");
      expect(statusLast.stdout).toContain(`Contract: ${contractId}`);

      const statusById = runCli(["status", contractId], env);
      expect(statusById.status).toBe(0);
      expect(statusById.stdout).toContain("Contract Summary");
      expect(statusById.stdout).toContain(`Contract: ${contractId}`);

      const accept = runCli(["accept", contractId, "--actor", "e2e-actor"], env);
      expect(accept.status).toBe(0);

      const emit = runCli(["emit", contractId], env);
      expect(emit.status).toBe(0);
      expect(emit.stdout).toContain("EVIDENCE CHECKLIST");
      expect(emit.stdout).toContain("diff.patch");

      const emitLast = runCli(["emit", "--last"], env);
      expect(emitLast.status).toBe(0);
      expect(emitLast.stdout).toContain("EVIDENCE CHECKLIST");
      expect(emitLast.stdout).toContain(contractId);

      const reviewContract = runCli(["review", contractId], env);
      expect(reviewContract.status).toBe(0);
      expect(reviewContract.stdout).toContain("DECISIONS");
      expect(reviewContract.stdout).toContain("Accept responsibility");
      expect(reviewContract.stdout).toContain(`kair accept ${contractId} --actor <name>`);
      expect(reviewContract.stdout).toContain(`kair grant ${contractId} <namespace>:<permission>`);
      expect(reviewContract.stdout).toContain(`kair emit ${contractId}`);
      expect(reviewContract.stdout).toContain("Contract:");
      expect(reviewContract.stdout).toContain("State:");

      const oldContractReview = runCli(["contract", "review", contractId], env);
      expect(oldContractReview.status).not.toBe(0);

      const oldContractAccept = runCli(["contract", "accept", contractId], env);
      expect(oldContractAccept.status).not.toBe(0);

      const oldContractEvidence = runCli(["contract", "evidence", contractId], env);
      expect(oldContractEvidence.status).not.toBe(0);

      const oldTopLevelEvidence = runCli(["evidence", contractId], env);
      expect(oldTopLevelEvidence.status).not.toBe(0);
    } finally {
      tmp.cleanup();
    }
  });
});
