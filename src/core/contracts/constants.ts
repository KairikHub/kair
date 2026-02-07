export const STATES = [
  "DRAFT",
  "PLANNED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "RUNNING",
  "PAUSED",
  "FAILED",
  "COMPLETED",
  "REWOUND",
];

export const CONTROL_REGISTRY = new Set([
  "cloudflare:read",
  "cloudflare:write",
  "github:read",
  "github:write",
  "schwab:read",
  "local:read",
  "local:write",
]);

export const RUN_CHECKPOINTS = [
  { id: "checkpoint_1", message: "Checkpoint: execution is underway." },
  { id: "checkpoint_2", message: "Checkpoint: validation completed." },
];
export const RUN_CHECKPOINT_IDS = new Set(RUN_CHECKPOINTS.map((checkpoint) => checkpoint.id));

