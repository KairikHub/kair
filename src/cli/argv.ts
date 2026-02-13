import { fail } from "../core/errors";
import { RUN_CHECKPOINT_IDS, RUN_CHECKPOINTS } from "../core/contracts/constants";

export function parseContractCommand(tokens: string[]) {
  const command = tokens[0];
  const args = tokens.slice(1);
  return { command, args };
}

export function requireArgs(args: string[], minCount: number, usage: string) {
  if (args.length < minCount) {
    fail(`Missing arguments. Usage: ${usage}`);
  }
}

export function extractActorFlags(args: string[]) {
  const remaining: string[] = [];
  let actorRaw = "";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--actor" || args[i] === "--by") {
      actorRaw = args[i + 1] || "";
      i += 1;
      continue;
    }
    remaining.push(args[i]);
  }
  return { remaining, actorRaw };
}

export function extractProposeOptions(args: string[]) {
  const remaining: string[] = [];
  let idRaw = "";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--id") {
      idRaw = args[i + 1] || "";
      i += 1;
      continue;
    }
    remaining.push(args[i]);
  }
  return { remaining, idRaw };
}

export function extractRunOptions(args: string[]) {
  const remaining: string[] = [];
  let pauseAt = "";
  let pauseAuthority = "";
  let pauseReason = "";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--pause-at") {
      pauseAt = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (args[i] === "--pause-authority") {
      pauseAuthority = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (args[i] === "--pause-reason") {
      pauseReason = args[i + 1] || "";
      i += 1;
      continue;
    }
    remaining.push(args[i]);
  }
  return { remaining, pauseAt, pauseAuthority, pauseReason };
}

export function normalizePauseAt(pauseAtRaw: string) {
  if (!pauseAtRaw) {
    return null;
  }
  const pauseAt = pauseAtRaw.trim();
  if (!pauseAt) {
    return null;
  }
  if (!RUN_CHECKPOINT_IDS.has(pauseAt)) {
    fail(
      `Unknown pause checkpoint "${pauseAt}". Allowed: ${RUN_CHECKPOINTS.map(
        (checkpoint) => checkpoint.id
      ).join(", ")}.`
    );
  }
  return pauseAt;
}
