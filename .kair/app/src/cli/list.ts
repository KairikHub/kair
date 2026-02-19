import { contractStore } from "../core/store/contracts_store";
import { listProviderConfigSnapshots } from "../core/auth/session";

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

export async function listLogins() {
  const snapshots = await listProviderConfigSnapshots();
  const header = "provider  configured  source    default";
  const divider = "--------  ----------  --------  -------";
  console.log(header);
  console.log(divider);
  for (const entry of snapshots) {
    const configured = entry.configured ? "yes" : "no";
    const source = entry.source;
    const defaultMark = entry.default ? "*" : "";
    console.log(
      `${entry.provider.padEnd(8)}  ${configured.padEnd(10)}  ${source.padEnd(8)}  ${defaultMark}`
    );
  }

  const configuredCount = snapshots.filter((entry) => entry.configured).length;
  const hasDefaultConfigured = snapshots.some((entry) => entry.default && entry.configured);

  if (configuredCount === 0) {
    console.log("");
    console.log("No providers are configured.");
    console.log("Run `kair login --provider <openai|claude>` to configure a provider.");
    return;
  }

  if (configuredCount > 1 && !hasDefaultConfigured && !String(process.env.KAIR_LLM_PROVIDER || "").trim()) {
    console.log("");
    console.log("Multiple providers are configured with no explicit default.");
    console.log("`kair plan` will prompt in interactive mode or require `--provider` in non-interactive mode.");
  }
}
