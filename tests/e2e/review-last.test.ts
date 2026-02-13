import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

function loadContract(dataDir: string, contractId: string) {
  const storePath = path.join(dataDir, "contracts.json");
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(raw);
  return (parsed.contracts || []).find((item: any) => item.id === contractId);
}

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

      const contracts = runCli(["contracts"], env);
      expect(contracts.status).toBe(0);
      expect(contracts.stdout).toContain(contractId);

      const accept = runCli(["accept", contractId, "--actor", "e2e-actor"], env);
      expect(accept.status).toBe(0);

      const emit = runCli(["emit", contractId], env);
      expect(emit.status).toBe(0);
      expect(emit.stdout).toContain("EVIDENCE CHECKLIST");
      expect(emit.stdout).toContain("diff.patch");

      const emitDefault = runCli(["emit"], env);
      expect(emitDefault.status).toBe(0);
      expect(emitDefault.stdout).toContain("EVIDENCE CHECKLIST");
      expect(emitDefault.stdout).toContain(contractId);

      const emitLast = runCli(["emit", "--last"], env);
      expect(emitLast.status).toBe(0);
      expect(emitLast.stdout).toContain("EVIDENCE CHECKLIST");
      expect(emitLast.stdout).toContain(contractId);

      const emitConflict = runCli(["emit", contractId, "--last"], env);
      expect(emitConflict.status).not.toBe(0);
      expect(emitConflict.stderr).toContain("Specify either a contract id or --last, not both.");

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

      const oldTopLevelList = runCli(["list"], env);
      expect(oldTopLevelList.status).not.toBe(0);
      expect(oldTopLevelList.stderr).toContain('Unknown command "list".');
    } finally {
      tmp.cleanup();
    }
  });

  test("approve defaults to last and supports --last", () => {
    const tmp = makeTempRoot();
    const firstId = "approve_first";
    const secondId = "approve_second";
    const thirdId = "approve_third";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const firstSetup = [
        ["contract", "create", "--id", firstId, "Approve first"],
        ["contract", "plan", firstId, "Plan first"],
        ["contract", "request-approval", firstId],
      ] as string[][];
      for (const args of firstSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const secondSetup = [
        ["contract", "create", "--id", secondId, "Approve second"],
        ["contract", "plan", secondId, "Plan second"],
        ["contract", "request-approval", secondId],
      ] as string[][];
      for (const args of secondSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const approveDefault = runCli(["approve", "--actor", "e2e-actor"], env);
      expect(approveDefault.status).toBe(0);

      const firstAfterDefault = loadContract(tmp.dataDir, firstId);
      const secondAfterDefault = loadContract(tmp.dataDir, secondId);
      expect(firstAfterDefault.current_state).toBe("AWAITING_APPROVAL");
      expect(secondAfterDefault.current_state).toBe("APPROVED");

      const thirdSetup = [
        ["contract", "create", "--id", thirdId, "Approve third"],
        ["contract", "plan", thirdId, "Plan third"],
        ["contract", "request-approval", thirdId],
      ] as string[][];
      for (const args of thirdSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const approveLast = runCli(["approve", "--last", "--actor", "e2e-actor"], env);
      expect(approveLast.status).toBe(0);

      const thirdAfterLast = loadContract(tmp.dataDir, thirdId);
      expect(thirdAfterLast.current_state).toBe("APPROVED");

      const approveExplicit = runCli(["approve", firstId, "--actor", "e2e-actor"], env);
      expect(approveExplicit.status).toBe(0);

      const firstAfterExplicit = loadContract(tmp.dataDir, firstId);
      expect(firstAfterExplicit.current_state).toBe("APPROVED");
    } finally {
      tmp.cleanup();
    }
  });

  test("request-approval defaults to last and supports --last", () => {
    const tmp = makeTempRoot();
    const firstId = "request_first";
    const secondId = "request_second";
    const thirdId = "request_third";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const firstSetup = [
        ["contract", "create", "--id", firstId, "Request first"],
        ["contract", "plan", firstId, "Plan first"],
      ] as string[][];
      for (const args of firstSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const secondSetup = [
        ["contract", "create", "--id", secondId, "Request second"],
        ["contract", "plan", secondId, "Plan second"],
      ] as string[][];
      for (const args of secondSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const requestDefault = runCli(["request-approval"], env);
      expect(requestDefault.status).toBe(0);

      const firstAfterDefault = loadContract(tmp.dataDir, firstId);
      const secondAfterDefault = loadContract(tmp.dataDir, secondId);
      expect(firstAfterDefault.current_state).toBe("PLANNED");
      expect(secondAfterDefault.current_state).toBe("AWAITING_APPROVAL");

      const thirdSetup = [
        ["contract", "create", "--id", thirdId, "Request third"],
        ["contract", "plan", thirdId, "Plan third"],
      ] as string[][];
      for (const args of thirdSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const requestLast = runCli(["contract", "request-approval", "--last"], env);
      expect(requestLast.status).toBe(0);

      const thirdAfterLast = loadContract(tmp.dataDir, thirdId);
      expect(thirdAfterLast.current_state).toBe("AWAITING_APPROVAL");

      const requestExplicit = runCli(["request-approval", firstId], env);
      expect(requestExplicit.status).toBe(0);

      const firstAfterExplicit = loadContract(tmp.dataDir, firstId);
      expect(firstAfterExplicit.current_state).toBe("AWAITING_APPROVAL");

      const requestConflict = runCli(["request-approval", thirdId, "--last"], env);
      expect(requestConflict.status).not.toBe(0);
      expect(requestConflict.stderr).toContain(
        "Specify either a contract id or --last, not both."
      );
    } finally {
      tmp.cleanup();
    }
  });

  test("run defaults to last and supports --last", () => {
    const tmp = makeTempRoot();
    const firstId = "run_first";
    const secondId = "run_second";
    const thirdId = "run_third";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const firstSetup = [
        ["contract", "create", "--id", firstId, "Run first"],
        ["contract", "plan", firstId, "Plan first"],
        ["contract", "request-approval", firstId],
        ["approve", firstId, "--actor", "e2e-actor"],
      ] as string[][];
      for (const args of firstSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const secondSetup = [
        ["contract", "create", "--id", secondId, "Run second"],
        ["contract", "plan", secondId, "Plan second"],
        ["contract", "request-approval", secondId],
        ["approve", secondId, "--actor", "e2e-actor"],
      ] as string[][];
      for (const args of secondSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const runDefault = runCli(["run"], env);
      expect(runDefault.status).toBe(0);

      const firstAfterDefault = loadContract(tmp.dataDir, firstId);
      const secondAfterDefault = loadContract(tmp.dataDir, secondId);
      expect(firstAfterDefault.current_state).toBe("APPROVED");
      expect(secondAfterDefault.current_state).toBe("COMPLETED");

      const thirdSetup = [
        ["contract", "create", "--id", thirdId, "Run third"],
        ["contract", "plan", thirdId, "Plan third"],
        ["contract", "request-approval", thirdId],
        ["approve", thirdId, "--actor", "e2e-actor"],
      ] as string[][];
      for (const args of thirdSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const runLast = runCli(["contract", "run", "--last"], env);
      expect(runLast.status).toBe(0);

      const thirdAfterLast = loadContract(tmp.dataDir, thirdId);
      expect(thirdAfterLast.current_state).toBe("COMPLETED");

      const runConflict = runCli(["run", thirdId, "--last"], env);
      expect(runConflict.status).not.toBe(0);
      expect(runConflict.stderr).toContain("Specify either a contract id or --last, not both.");
    } finally {
      tmp.cleanup();
    }
  });

  test("pause defaults to last and supports --last", () => {
    const tmp = makeTempRoot();
    const firstId = "pause_first";
    const secondId = "pause_second";
    const thirdId = "pause_third";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const firstSetup = [
        ["contract", "create", "--id", firstId, "Pause first"],
        ["contract", "plan", firstId, "Plan first"],
        ["contract", "request-approval", firstId],
        ["approve", firstId, "--actor", "e2e-actor"],
      ] as string[][];
      for (const args of firstSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const secondSetup = [
        ["contract", "create", "--id", secondId, "Pause second"],
        ["contract", "plan", secondId, "Plan second"],
        ["contract", "request-approval", secondId],
        ["approve", secondId, "--actor", "e2e-actor"],
        ["run", secondId, "--pause-at", "checkpoint_1"],
      ] as string[][];
      for (const args of secondSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const pauseDefault = runCli(["pause"], env);
      expect(pauseDefault.status).not.toBe(0);
      expect(pauseDefault.stderr).toContain(`Contract "${secondId}"`);
      expect(pauseDefault.stderr).toContain("state is PAUSED");

      const thirdSetup = [
        ["contract", "create", "--id", thirdId, "Pause third"],
        ["contract", "plan", thirdId, "Plan third"],
        ["contract", "request-approval", thirdId],
        ["approve", thirdId, "--actor", "e2e-actor"],
        ["run", thirdId, "--pause-at", "checkpoint_1"],
      ] as string[][];
      for (const args of thirdSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const pauseLast = runCli(["contract", "pause", "--last"], env);
      expect(pauseLast.status).not.toBe(0);
      expect(pauseLast.stderr).toContain(`Contract "${thirdId}"`);
      expect(pauseLast.stderr).toContain("state is PAUSED");

      const pauseConflict = runCli(["pause", thirdId, "--last"], env);
      expect(pauseConflict.status).not.toBe(0);
      expect(pauseConflict.stderr).toContain("Specify either a contract id or --last, not both.");
    } finally {
      tmp.cleanup();
    }
  });

  test("resume defaults to last and supports --last", () => {
    const tmp = makeTempRoot();
    const firstId = "resume_first";
    const secondId = "resume_second";
    const thirdId = "resume_third";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const firstSetup = [
        ["contract", "create", "--id", firstId, "Resume first"],
        ["contract", "plan", firstId, "Plan first"],
        ["contract", "request-approval", firstId],
        ["approve", firstId, "--actor", "e2e-actor"],
      ] as string[][];
      for (const args of firstSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const secondSetup = [
        ["contract", "create", "--id", secondId, "Resume second"],
        ["contract", "plan", secondId, "Plan second"],
        ["contract", "request-approval", secondId],
        ["approve", secondId, "--actor", "e2e-actor"],
        ["run", secondId, "--pause-at", "checkpoint_1"],
      ] as string[][];
      for (const args of secondSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const resumeDefault = runCli(["resume"], env);
      expect(resumeDefault.status).toBe(0);

      const firstAfterDefault = loadContract(tmp.dataDir, firstId);
      const secondAfterDefault = loadContract(tmp.dataDir, secondId);
      expect(firstAfterDefault.current_state).toBe("APPROVED");
      expect(secondAfterDefault.current_state).toBe("COMPLETED");

      const thirdSetup = [
        ["contract", "create", "--id", thirdId, "Resume third"],
        ["contract", "plan", thirdId, "Plan third"],
        ["contract", "request-approval", thirdId],
        ["approve", thirdId, "--actor", "e2e-actor"],
        ["run", thirdId, "--pause-at", "checkpoint_1"],
      ] as string[][];
      for (const args of thirdSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const resumeLast = runCli(["contract", "resume", "--last"], env);
      expect(resumeLast.status).toBe(0);

      const thirdAfterLast = loadContract(tmp.dataDir, thirdId);
      expect(thirdAfterLast.current_state).toBe("COMPLETED");

      const resumeConflict = runCli(["resume", thirdId, "--last"], env);
      expect(resumeConflict.status).not.toBe(0);
      expect(resumeConflict.stderr).toContain("Specify either a contract id or --last, not both.");
    } finally {
      tmp.cleanup();
    }
  });

  test("rewind defaults to last and supports --last", () => {
    const tmp = makeTempRoot();
    const firstId = "rewind_first";
    const secondId = "rewind_second";
    const thirdId = "rewind_third";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const firstSetup = [
        ["contract", "create", "--id", firstId, "Rewind first"],
        ["contract", "plan", firstId, "Plan first"],
        ["contract", "request-approval", firstId],
        ["approve", firstId, "--actor", "e2e-actor"],
      ] as string[][];
      for (const args of firstSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const secondSetup = [
        ["contract", "create", "--id", secondId, "Rewind second"],
        ["contract", "plan", secondId, "Plan second"],
        ["contract", "request-approval", secondId],
        ["approve", secondId, "--actor", "e2e-actor"],
        ["run", secondId],
      ] as string[][];
      for (const args of secondSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const rewindDefault = runCli(["rewind"], env);
      expect(rewindDefault.status).toBe(0);

      const firstAfterDefault = loadContract(tmp.dataDir, firstId);
      const secondAfterDefault = loadContract(tmp.dataDir, secondId);
      expect(firstAfterDefault.current_state).toBe("APPROVED");
      expect(secondAfterDefault.current_state).toBe("REWOUND");

      const thirdSetup = [
        ["contract", "create", "--id", thirdId, "Rewind third"],
        ["contract", "plan", thirdId, "Plan third"],
        ["contract", "request-approval", thirdId],
        ["approve", thirdId, "--actor", "e2e-actor"],
        ["run", thirdId],
      ] as string[][];
      for (const args of thirdSetup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const rewindLast = runCli(["contract", "rewind", "--last"], env);
      expect(rewindLast.status).toBe(0);

      const thirdAfterLast = loadContract(tmp.dataDir, thirdId);
      expect(thirdAfterLast.current_state).toBe("REWOUND");

      const rewindConflict = runCli(["rewind", thirdId, "--last"], env);
      expect(rewindConflict.status).not.toBe(0);
      expect(rewindConflict.stderr).toContain("Specify either a contract id or --last, not both.");
    } finally {
      tmp.cleanup();
    }
  });
});
