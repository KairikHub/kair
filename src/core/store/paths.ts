import * as path from "node:path";

function readOverride(name: "KAIR_DATA_DIR" | "KAIR_ARTIFACTS_DIR") {
  const value = (process.env[name] || "").trim();
  if (!value) {
    return null;
  }
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

export function getDataDir() {
  return readOverride("KAIR_DATA_DIR") || path.join(process.cwd(), "data");
}

export function getDataFile() {
  return path.join(getDataDir(), "contracts.json");
}

export function getArtifactsDir() {
  return readOverride("KAIR_ARTIFACTS_DIR") || path.join(process.cwd(), "artifacts");
}
