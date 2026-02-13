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

describe("e2e: grant command", () => {
  test("grant supports list/help, defaults to last contract, validates format, and is idempotent", () => {
    const tmp = makeTempRoot();
    const firstId = "grant_first";
    const secondId = "grant_second";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const createFirst = runCli(["contract", "--id", firstId, "Grant first"], env);
      expect(createFirst.status).toBe(0);

      const createSecond = runCli(["contract", "--id", secondId, "Grant second"], env);
      expect(createSecond.status).toBe(0);

      const grantHelp = runCli(["grant"], env);
      expect(grantHelp.status).toBe(0);
      expect(grantHelp.stdout).toContain("Kair Grant Commands");

      const grantList = runCli(["grant", "list"], env);
      expect(grantList.status).toBe(0);
      expect(grantList.stdout).toContain("local:read");
      expect(grantList.stdout).toContain("local:write");
      expect(grantList.stdout).toContain("local:exec");
      expect(grantList.stdout).toContain("network:read");
      expect(grantList.stdout).toContain("network:write");

      const grantDefaultLast = runCli(["grant", "local:read"], env);
      expect(grantDefaultLast.status).toBe(0);

      const firstAfterDefault = loadContract(tmp.dataDir, firstId);
      const secondAfterDefault = loadContract(tmp.dataDir, secondId);
      expect(firstAfterDefault.controlsApproved).not.toContain("local:read");
      expect(secondAfterDefault.controlsApproved).toContain("local:read");

      const grantDuplicate = runCli(["grant", secondId, "local:read"], env);
      expect(grantDuplicate.status).toBe(0);

      const secondAfterDuplicate = loadContract(tmp.dataDir, secondId);
      const grantCount = secondAfterDuplicate.controlsApproved.filter(
        (grant: string) => grant === "local:read"
      ).length;
      expect(grantCount).toBe(1);

      const invalidGrant = runCli(["grant", secondId, "badgrant"], env);
      expect(invalidGrant.status).not.toBe(0);
      expect(invalidGrant.stderr).toContain(
        "Invalid grant format. Expected <namespace>:<permission> (example: local:write)."
      );

      const removedAddControl = runCli(["add-control", secondId, "local:read"], env);
      expect(removedAddControl.status).not.toBe(0);
      expect(removedAddControl.stderr).toContain('Unknown command "add-control".');
    } finally {
      tmp.cleanup();
    }
  });
});
