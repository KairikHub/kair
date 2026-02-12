import { renderDpcPretty } from "../../src/cli/render_dpc";
import { DPC_VERSION, DpcV1 } from "../../src/core/dpc/schema";

describe("dpc pretty renderer", () => {
  test("includes topic and required section headings in compact output", () => {
    const dpc: DpcV1 = {
      version: DPC_VERSION,
      topic: "Replay comparison decisions",
      assumptions: ["A1", "A2"],
      constraints: ["C1"],
      decisions: [
        {
          id: "d-active",
          decision: "Keep DPC optional in v1",
          rationale: "Avoid adding governance friction",
          status: "active",
        },
        {
          id: "d-old",
          decision: "Store sidecars as markdown",
          status: "superseded",
        },
      ],
      open_questions: [
        {
          id: "q1",
          question: "Can DPC remain under 2KB median?",
          impact: "Affects review readability",
        },
      ],
      evidence: [
        {
          id: "e1",
          kind: "file",
          ref: "docs/IDEAS.md",
          note: "Current idea set",
        },
      ],
      updated_at: "2026-02-12T00:00:00Z",
    };

    const output = renderDpcPretty(dpc);
    expect(output).toContain("DPC (kair.dpc.v1) — Replay comparison decisions");
    expect(output).toContain("updated_at: 2026-02-12T00:00:00Z");
    expect(output).toContain("Assumptions (2)");
    expect(output).toContain("Constraints (1)");
    expect(output).toContain("Decisions (2)");
    expect(output).toContain("Active (1)");
    expect(output).toContain("Superseded (1)");
    expect(output).toContain("Open Questions (1)");
    expect(output).toContain("Evidence (1)");
    expect(output).toContain("file: docs/IDEAS.md");
    expect(output).toContain("note: Current idea set");
  });
});
