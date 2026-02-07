import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: review surface", () => {
  test("review --last and contract review/accept commands render one-screen summary", () => {
    const tmp = makeTempRoot();
    const contractId = "review_demo";
    const env = {
      KAIRIK_DATA_DIR: tmp.dataDir,
      KAIRIK_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIRIK_ACTOR: "e2e-actor",
      KAIRIK_TEST_MODE: "1",
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
      expect(reviewLast.stdout).toContain("KAIRIK REVIEW");
      expect(reviewLast.stdout).toContain(contractId);
      expect(reviewLast.stdout).toContain("EVIDENCE");
      expect(reviewLast.stdout).toContain("diff.patch");

      const accept = runCli(["contract", "accept", contractId, "--actor", "e2e-actor"], env);
      expect(accept.status).toBe(0);

      const evidence = runCli(["contract", "evidence", contractId], env);
      expect(evidence.status).toBe(0);
      expect(evidence.stdout).toContain("EVIDENCE CHECKLIST");
      expect(evidence.stdout).toContain("diff.patch");

      const reviewContract = runCli(["contract", "review", contractId], env);
      expect(reviewContract.status).toBe(0);
      expect(reviewContract.stdout).toContain("DECISIONS");
      expect(reviewContract.stdout).toContain("Accept responsibility");
      expect(reviewContract.stdout).toContain("Contract:");
      expect(reviewContract.stdout).toContain("State:");
    } finally {
      tmp.cleanup();
    }
  });
});
