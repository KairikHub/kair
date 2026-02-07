import { now } from "../time";

type ContractLike = {
  approvals: Array<Record<string, unknown>>;
  versions: Array<Record<string, unknown>>;
  activeVersion: number | null;
  controlsApproved: string[];
  plan: string | null;
  intent: string;
};

export function appendApprovalVersion(contract: ContractLike, actor: string) {
  contract.approvals.push({ at: now(), approver: actor, actor });
  const version = contract.versions.length + 1;
  contract.activeVersion = version;
  contract.versions.push({
    version,
    kind: "approval",
    at: now(),
    note: `Approved by ${actor}.`,
    controlsApproved: [...contract.controlsApproved],
    plan: contract.plan,
    intent: contract.intent,
  });
  return version;
}

export function appendRewindVersion(contract: ContractLike, actor: string) {
  const previousVersion = contract.activeVersion;
  const version = contract.versions.length + 1;
  contract.activeVersion = version;
  contract.versions.push({
    version,
    kind: "rewind",
    at: now(),
    note: `Rewound by ${actor}. Supersedes v${previousVersion ?? "none"}.`,
    controlsApproved: [...contract.controlsApproved],
    plan: contract.plan,
    intent: contract.intent,
  });
  return { previousVersion, version };
}
