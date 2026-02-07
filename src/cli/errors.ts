import { printContractHelp, printTopHelp } from "./help";

export function failWithHelp(message: string, context: "top" | "contract" = "top") {
  if (context === "contract") {
    printContractHelp();
  } else {
    printTopHelp();
  }
  console.error(`Error: ${message}`);
  process.exit(1);
}

