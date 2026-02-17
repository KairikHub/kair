export const APPROVAL_VERSION = "kair.approval.v1" as const;

export type ApprovalSource = "manual" | "ci";

export type ApprovalArtifact = {
  version: typeof APPROVAL_VERSION;
  contract_id: string;
  plan_hash: string;
  plan_ref: string;
  approved_by: string;
  approved_at: string;
  source: ApprovalSource;
  notes?: string;
};
