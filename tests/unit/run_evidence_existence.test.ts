import { checkEvidencePathExistence } from "../../src/core/contracts/run";

describe("run evidence existence checks", () => {
  test("empty evidence paths does not force missing", () => {
    const result = checkEvidencePathExistence([]);
    expect(result.existingPaths).toEqual([]);
    expect(result.missingPaths).toEqual([]);
  });

  test("all claimed evidence paths existing", () => {
    const paths = ["/tmp/a", "/tmp/b"];
    const result = checkEvidencePathExistence(paths, () => true);
    expect(result.existingPaths).toEqual(paths);
    expect(result.missingPaths).toEqual([]);
  });

  test("missing claimed evidence paths are returned", () => {
    const paths = ["/tmp/a", "/tmp/missing", "/tmp/b"];
    const result = checkEvidencePathExistence(paths, (candidatePath) => candidatePath !== "/tmp/missing");
    expect(result.existingPaths).toEqual(["/tmp/a", "/tmp/b"]);
    expect(result.missingPaths).toEqual(["/tmp/missing"]);
  });
});
