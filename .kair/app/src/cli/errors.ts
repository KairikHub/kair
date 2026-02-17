import { printContractHelp, printProposeHelp, printTopHelp } from "./help";

export function failWithHelp(message: string, context: "top" | "contract" | "propose" = "top") {
  if (context === "contract") {
    printContractHelp();
  } else if (context === "propose") {
    printProposeHelp();
  } else {
    printTopHelp();
  }
  console.error(`Error: ${message}`);
  process.exit(1);
}
