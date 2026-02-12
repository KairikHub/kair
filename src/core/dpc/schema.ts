export const DPC_VERSION = "kair.dpc.v1";

export type DpcDecisionStatus = "active" | "superseded";

export type DpcEvidenceKind = "prompt" | "plan" | "diff" | "file" | "url";

export type DpcDecision = {
  id: string;
  decision: string;
  rationale?: string;
  status: DpcDecisionStatus;
};

export type DpcOpenQuestion = {
  id: string;
  question: string;
  impact?: string;
};

export type DpcEvidence = {
  id: string;
  kind: DpcEvidenceKind;
  ref: string;
  note?: string;
};

export type DpcV1 = {
  version: typeof DPC_VERSION;
  topic: string;
  assumptions: string[];
  constraints: string[];
  decisions: DpcDecision[];
  open_questions: DpcOpenQuestion[];
  evidence: DpcEvidence[];
  updated_at: string;
  parent_dpc_id?: string;
};
