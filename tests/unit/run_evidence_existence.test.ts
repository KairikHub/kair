import { classifyClaimedEvidencePaths } from "../../src/core/contracts/run";

describe("run evidence existence checks", () => {
  const runDir = "/tmp/kair/run";

  test("empty evidence paths does not force missing", () => {
    const result = classifyClaimedEvidencePaths([], runDir);
    expect(result.validExistingPaths).toEqual([]);
    expect(result.missingPaths).toEqual([]);
    expect(result.outOfScopePaths).toEqual([]);
  });

  test("all claimed evidence paths existing", () => {
    const paths = ["/tmp/kair/run/a.txt", "/tmp/kair/run/b.txt"];
    const result = classifyClaimedEvidencePaths(paths, runDir, () => true);
    expect(result.validExistingPaths).toEqual(paths);
    expect(result.missingPaths).toEqual([]);
    expect(result.outOfScopePaths).toEqual([]);
  });

  test("missing claimed evidence paths are returned", () => {
    const paths = ["/tmp/kair/run/a.txt", "/tmp/kair/run/missing.txt", "/tmp/kair/run/b.txt"];
    const result = classifyClaimedEvidencePaths(
      paths,
      runDir,
      (candidatePath) => candidatePath !== "/tmp/kair/run/missing.txt"
    );
    expect(result.validExistingPaths).toEqual(["/tmp/kair/run/a.txt", "/tmp/kair/run/b.txt"]);
    expect(result.missingPaths).toEqual(["/tmp/kair/run/missing.txt"]);
    expect(result.outOfScopePaths).toEqual([]);
  });

  test("out-of-scope claimed evidence paths are classified separately", () => {
    const result = classifyClaimedEvidencePaths(
      ["/tmp/kair/run/in-scope.txt", "/tmp/other/out-of-scope.txt"],
      runDir,
      () => true
    );
    expect(result.validExistingPaths).toEqual(["/tmp/kair/run/in-scope.txt"]);
    expect(result.missingPaths).toEqual([]);
    expect(result.outOfScopePaths).toEqual(["/tmp/other/out-of-scope.txt"]);
  });
});
