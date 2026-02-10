import * as path from "node:path";

function readOverride(
  names: Array<"KAIRIK_DATA_DIR" | "KAIR_DATA_DIR" | "KAIRIK_ARTIFACTS_DIR" | "KAIR_ARTIFACTS_DIR">
) {
  for (const name of names) {
    const value = (process.env[name] || "").trim();
    if (!value) {
      continue;
    }
    return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
  }
  return null;
}

export function getDataDir() {
  return readOverride(["KAIRIK_DATA_DIR", "KAIR_DATA_DIR"]) || path.join(process.cwd(), "data");
}

export function getDataFile() {
  return path.join(getDataDir(), "contracts.json");
}

export function getArtifactsDir() {
  return (
    readOverride(["KAIRIK_ARTIFACTS_DIR", "KAIR_ARTIFACTS_DIR"]) || path.join(process.cwd(), "artifacts")
  );
}
