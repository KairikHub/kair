import * as fs from "node:fs";
import * as path from "node:path";

import { now } from "../time";
import { getArchitectSessionPath } from "./paths";
import type { ArchitectSession } from "./types";

export function loadArchitectSession(contractId: string): ArchitectSession | null {
  const sessionPath = getArchitectSessionPath(contractId);
  try {
    const raw = fs.readFileSync(sessionPath, "utf8");
    return JSON.parse(raw) as ArchitectSession;
  } catch (error: any) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function saveArchitectSession(session: ArchitectSession) {
  const sessionPath = getArchitectSessionPath(session.contract_id);
  const dir = path.dirname(sessionPath);
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    ...session,
    updated_at: now(),
  };
  const tmpPath = path.join(dir, `session.json.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
  fs.renameSync(tmpPath, sessionPath);
  return sessionPath;
}
