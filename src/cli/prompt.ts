import { createInterface } from "node:readline/promises";

import { suggestContractId, validateContractId } from "../core/contracts/ids";
import { contractStore } from "../core/store/contracts_store";

export async function promptForProposeInput({ intent, idRaw }: { intent: string; idRaw: string }) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    let finalIntent = intent;
    while (!finalIntent) {
      const answer = await rl.question("What is the intent of your proposed contract? ");
      finalIntent = answer.trim();
    }

    let finalId = idRaw;
    if (!finalId) {
      const suggested = suggestContractId(finalIntent);
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

    return { intent: finalIntent, id: finalId };
  } finally {
    rl.close();
  }
}

