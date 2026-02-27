import { printArchitectHelp, printContractHelp, printProposeHelp, printTopHelp } from "./help";

export function failWithHelp(message: string, context: "top" | "contract" | "propose" | "architect" = "top") {
  if (context === "contract") {
    printContractHelp();
  } else if (context === "propose") {
    printProposeHelp();
  } else if (context === "architect") {
    printArchitectHelp();
  } else {
    printTopHelp();
  }
  console.error(`Error: ${message}`);
  process.exit(1);
}
