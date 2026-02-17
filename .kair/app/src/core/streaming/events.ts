import * as fs from "node:fs";
import * as path from "node:path";

import { getArtifactsDir } from "../store/paths";
import { now } from "../time";

export type StreamPhase = "plan" | "run";
export type StreamLevel = "info" | "warn" | "error";

export type StreamEvent = {
  ts: string;
  phase: StreamPhase;
  level: StreamLevel;
  event: string;
  message: string;
  data: Record<string, unknown>;
};

export function getStreamLogPath(contractId: string) {
  return path.join(getArtifactsDir(), contractId, "run", "stream.jsonl");
}

export function appendStreamEvent(params: {
  contractId: string;
  phase: StreamPhase;
  level?: StreamLevel;
  event: string;
  message: string;
  data?: Record<string, unknown>;
  print?: boolean;
  jsonOutput?: boolean;
}) {
  const entry: StreamEvent = {
    ts: now(),
    phase: params.phase,
    level: params.level || "info",
    event: params.event,
    message: params.message,
    data: params.data || {},
  };

  const streamPath = getStreamLogPath(params.contractId);
  fs.mkdirSync(path.dirname(streamPath), { recursive: true });
  fs.appendFileSync(streamPath, `${JSON.stringify(entry)}\n`);

  if (params.print && !params.jsonOutput) {
    console.log(`[${entry.phase}] ${entry.message}`);
  }

  return { streamPath, entry };
}
