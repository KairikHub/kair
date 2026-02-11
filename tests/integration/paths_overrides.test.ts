import * as path from "node:path";

import { getArtifactsDir, getDataDir } from "../../src/core/store/paths";

describe("integration: path override env vars", () => {
  test("supports KAIR_DATA_DIR and prefers it over KAIR_DATA_DIR", () => {
    const previousKairDataDir = process.env.KAIR_DATA_DIR;

    try {
      process.env.KAIR_DATA_DIR = "/tmp/kair-data";
      expect(getDataDir()).toBe("/tmp/kair-data");

      process.env.KAIR_DATA_DIR = "relative-kair-data";
      expect(getDataDir()).toBe(path.join(process.cwd(), "relative-kair-data"));
    } finally {
      if (previousKairDataDir === undefined) {
        delete process.env.KAIR_DATA_DIR;
      } else {
        process.env.KAIR_DATA_DIR = previousKairDataDir;
      }
    }
  });

  test("supports KAIR_ARTIFACTS_DIR and prefers it over KAIR_ARTIFACTS_DIR", () => {
    const previousKairArtifactsDir = process.env.KAIR_ARTIFACTS_DIR;

    try {
      process.env.KAIR_ARTIFACTS_DIR = "/tmp/kair-artifacts";
      expect(getArtifactsDir()).toBe("/tmp/kair-artifacts");

      process.env.KAIR_ARTIFACTS_DIR = "relative-kair-artifacts";
      expect(getArtifactsDir()).toBe(path.join(process.cwd(), "relative-kair-artifacts"));
    } finally {
      if (previousKairArtifactsDir === undefined) {
        delete process.env.KAIR_ARTIFACTS_DIR;
      } else {
        process.env.KAIR_ARTIFACTS_DIR = previousKairArtifactsDir;
      }
    }
  });
});
