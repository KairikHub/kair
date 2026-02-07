import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function makeTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kairik-"));
  const dataDir = path.join(root, "data");
  const artifactsDir = path.join(root, "artifacts");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(artifactsDir, { recursive: true });
  return {
    root,
    dataDir,
    artifactsDir,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
