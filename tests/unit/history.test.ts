import { appendApprovalVersion, appendRewindVersion } from "../../src/core/contracts/versioning";

function buildContract() {
  return {
    id: "contract_unit",
    intent: "Unit testing contract",
    plan: "Test invariants",
    approvals: [] as any[],
    controlsApproved: ["local:read"],
    versions: [
      {
        version: 1,
        kind: "approval",
        at: "2026-02-07T00:00:00.000Z",
        note: "Approved by Damien.",
        controlsApproved: ["local:read"],
        plan: "Initial plan",
        intent: "Initial intent",
      },
    ] as any[],
    activeVersion: 1 as number | null,
    history: [
      {
        at: "2026-02-07T00:00:00.000Z",
        state: "APPROVED",
        message: "Initial approval",
      },
    ] as any[],
  };
}

describe("core versioning invariants", () => {
  test("approve appends a new immutable version entry", () => {
    const contract = buildContract();
    const initialVersionSnapshot = { ...contract.versions[0] };

    appendApprovalVersion(contract, "UnitActor");

    expect(contract.approvals).toHaveLength(1);
    expect(contract.activeVersion).toBe(2);
    expect(contract.versions).toHaveLength(2);
    expect(contract.versions[0]).toEqual(initialVersionSnapshot);
    expect(contract.versions[1]).toMatchObject({
      version: 2,
      kind: "approval",
      note: "Approved by UnitActor.",
      intent: contract.intent,
      plan: contract.plan,
      controlsApproved: [...contract.controlsApproved],
    });
  });

  test("rewind appends superseding version and advances active version", () => {
    const contract = buildContract();
    appendApprovalVersion(contract, "UnitActor");
    const previousActive = contract.activeVersion;
    const previousLength = contract.versions.length;

    const result = appendRewindVersion(contract, "UnitActor");

    expect(result.previousVersion).toBe(previousActive);
    expect(contract.activeVersion).toBe((previousActive || 0) + 1);
    expect(contract.versions).toHaveLength(previousLength + 1);
    expect(contract.versions[contract.versions.length - 1]).toMatchObject({
      version: contract.activeVersion,
      kind: "rewind",
      note: `Rewound by UnitActor. Supersedes v${previousActive}.`,
    });
  });

  test("append-only invariant holds for versions and existing history entries are not removed", () => {
    const contract = buildContract();
    const initialHistory = [...contract.history];
    const initialVersions = contract.versions.length;

    appendApprovalVersion(contract, "UnitActor");
    appendRewindVersion(contract, "UnitActor");

    expect(contract.versions.length).toBeGreaterThan(initialVersions);
    expect(contract.history).toEqual(initialHistory);
    expect(contract.versions[0]).toMatchObject({
      version: 1,
      kind: "approval",
    });
  });
});
