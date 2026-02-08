import { loadStore } from "../core/store/contracts_store";
import { printTopHelp } from "./help";
import { executeCommand } from "./execute";

export async function main() {
  let rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "kair") {
    rawArgs = rawArgs.slice(1);
  }
  if (rawArgs.length === 0) {
    printTopHelp();
    return;
  }
  if (rawArgs.length === 1 && (rawArgs[0] === "-h" || rawArgs[0] === "--help")) {
    printTopHelp();
    return;
  }

  loadStore();

  const commandGroups: string[][] = [];
  let current: string[] = [];
  for (const arg of rawArgs) {
    if (arg === "--") {
      if (current.length > 0) {
        commandGroups.push(current);
        current = [];
      }
      continue;
    }
    current.push(arg);
  }
  if (current.length > 0) {
    commandGroups.push(current);
  }

  const allowPrompt = process.stdin.isTTY && process.stdout.isTTY;
  const isChained = commandGroups.length > 1;

  for (const group of commandGroups) {
    await executeCommand(group, { allowPrompt, isChained });
  }
}
