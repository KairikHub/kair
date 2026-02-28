import { createInterface } from "node:readline/promises";

import { normalizeProjectName, suggestContractId, validateContractId } from "../core/contracts/ids";
import { contractStore, getProjectName } from "../core/store/contracts_store";

export async function promptForProposeInput({
  intent,
  idRaw,
  projectRaw,
}: {
  intent: string;
  idRaw: string;
  projectRaw: string;
}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    let finalProject = projectRaw;
    if (!finalProject) {
      const existing = getProjectName();
      if (existing) {
        finalProject = existing;
      }
    }
    while (!finalProject) {
      const answer = await rl.question("What is the Project Name? ");
      const normalized = normalizeProjectName(answer);
      if (!normalized) {
        console.log("Project Name cannot be empty.");
        continue;
      }
      finalProject = normalized;
    }

    let finalIntent = intent;
    while (!finalIntent) {
      const answer = await rl.question("What is the intent of your proposed contract? ");
      finalIntent = answer.trim();
    }

    let finalId = idRaw;
    if (!finalId) {
      const suggested = suggestContractId(finalProject);
      while (true) {
        const answer = await rl.question(`Contract id [${suggested}]: `);
        const candidate = (answer.trim() || suggested).trim();
        const error = validateContractId(candidate);
        if (error) {
          console.log(error);
          continue;
        }
        if (contractStore.contracts.has(candidate)) {
          console.log(`Contract id "${candidate}" already exists. Choose a different id.`);
          continue;
        }
        finalId = candidate;
        break;
      }
    }

    return { project: finalProject, intent: finalIntent, id: finalId };
  } finally {
    rl.close();
  }
}
