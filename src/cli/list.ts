import { contractStore } from "../core/store/contracts_store";

export function listContracts() {
  const contracts = [...contractStore.contracts.values()];
  if (contracts.length === 0) {
    console.log("No Contracts found.");
    return;
  }
  const sorted = contracts.sort((a: any, b: any) => {
    const aTime = new Date(a.timestamps?.created_at || 0).getTime();
    const bTime = new Date(b.timestamps?.created_at || 0).getTime();
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return String(a.id).localeCompare(String(b.id));
  });
  for (const contract of sorted) {
    console.log(contract.id);
  }
}

