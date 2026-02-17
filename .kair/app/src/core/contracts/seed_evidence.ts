import * as fs from "node:fs";
import * as path from "node:path";

import { now } from "../time";
import { EvidenceItem, getEvidenceDir, loadEvidenceIndex, saveEvidenceIndex } from "./evidence";
import { writeEvidenceFile } from "./evidence_files";

type SeedContract = {
  id: string;
  intent: string;
  plan?: string | null;
};

function toSafeSlug(input: string) {
  return input.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function ensureUniqueFilename(contractId: string, requested: string) {
  const evidenceDir = getEvidenceDir(contractId);
  const ext = path.extname(requested);
  const base = path.basename(requested, ext);
  let candidate = requested;
  let counter = 1;
  while (fs.existsSync(path.join(evidenceDir, candidate))) {
    candidate = `${base}-${counter}${ext}`;
    counter += 1;
  }
  return candidate;
}

export function seedMockEvidence(contract: SeedContract) {
  const existing = loadEvidenceIndex(contract.id);
  if (existing.length > 0) {
    return;
  }

  const plan = contract.plan || "No plan captured.";
  const createdAt = now();
  const contentByFile: Array<{
    filename: string;
    type: EvidenceItem["type"];
    label: string;
    content: string;
  }> = [
    {
      filename: "diff.patch",
      type: "diff",
      label: "Mock patch excerpt",
      content: [
        "diff --git a/src/app.ts b/src/app.ts",
        "index 1111111..2222222 100644",
        "--- a/src/app.ts",
        "+++ b/src/app.ts",
        "@@ -1,3 +1,6 @@",
        "+// mock evidence patch for demo",
        " export function run() {",
        "+  const audit = true;",
        "   return 'ok';",
        " }",
      ].join("\n"),
    },
    {
      filename: "codex-session.log",
      type: "log",
      label: "Mock execution log",
      content: [
        "[mock] session started",
        `[mock] contract=${contract.id}`,
        `[mock] intent=${contract.intent}`,
        "[mock] checkpoint_1 passed",
        "[mock] checkpoint_2 passed",
        "[mock] execution completed",
      ].join("\n"),
    },
    {
      filename: "prompt.txt",
      type: "prompt",
      label: "Mock planning prompt",
      content: [
        "You are assisting with a governed contract run.",
        `Contract ID: ${contract.id}`,
        `Intent: ${contract.intent}`,
        `Plan: ${plan}`,
        "Return a concise, safe execution summary.",
      ].join("\n"),
    },
    {
      filename: "jest-output.txt",
      type: "test_output",
      label: "Mock test output",
      content: [
        "> npm test",
        "PASS tests/unit/history.test.ts",
        "PASS tests/integration/persistence.test.ts",
        "PASS tests/e2e/cli-flow.test.ts",
        "Test Suites: 3 passed, 3 total",
      ].join("\n"),
    },
    {
      filename: "summary.md",
      type: "summary",
      label: "Mock run summary",
      content: [
        "# Mock Evidence Summary",
        "",
        `- Contract: ${contract.id}`,
        `- Intent: ${contract.intent}`,
        `- Plan: ${plan}`,
        `- Seeded At: ${createdAt}`,
        "",
        "This evidence bundle is seeded mock content for demo runs.",
      ].join("\n"),
    },
  ];

  const items: EvidenceItem[] = [];
  for (const file of contentByFile) {
    const filename = ensureUniqueFilename(contract.id, toSafeSlug(file.filename));
    const relativePath = writeEvidenceFile(contract.id, filename, file.content);
    items.push({
      type: file.type,
      label: file.label,
      path: relativePath,
      source: "mock",
      created_at: now(),
    });
  }
  saveEvidenceIndex(contract.id, items);
}
