import * as path from "node:path";

import { getArtifactsDir, getDataDir } from "../../src/core/store/paths";

describe("integration: path override env vars", () => {
  test("supports KAIR_DATA_DIR and falls back to KAIRIK_DATA_DIR", () => {
    const previousKairDataDir = process.env.KAIR_DATA_DIR;
    const previousKairikDataDir = process.env.KAIRIK_DATA_DIR;

    try {
      process.env.KAIR_DATA_DIR = "/tmp/kair-data";
      expect(getDataDir()).toBe("/tmp/kair-data");

      process.env.KAIR_DATA_DIR = "relative-kair-data";
      expect(getDataDir()).toBe(path.join(process.cwd(), "relative-kair-data"));

      delete process.env.KAIR_DATA_DIR;
      process.env.KAIRIK_DATA_DIR = "/tmp/kairik-data";
      expect(getDataDir()).toBe("/tmp/kairik-data");
    } finally {
      if (previousKairDataDir === undefined) {
        delete process.env.KAIR_DATA_DIR;
      } else {
        process.env.KAIR_DATA_DIR = previousKairDataDir;
      }
      if (previousKairikDataDir === undefined) {
        delete process.env.KAIRIK_DATA_DIR;
      } else {
        process.env.KAIRIK_DATA_DIR = previousKairikDataDir;
      }
    }
  });

  test("supports KAIR_ARTIFACTS_DIR and falls back to KAIRIK_ARTIFACTS_DIR", () => {
    const previousKairArtifactsDir = process.env.KAIR_ARTIFACTS_DIR;
    const previousKairikArtifactsDir = process.env.KAIRIK_ARTIFACTS_DIR;

    try {
      process.env.KAIR_ARTIFACTS_DIR = "/tmp/kair-artifacts";
      expect(getArtifactsDir()).toBe("/tmp/kair-artifacts");

      process.env.KAIR_ARTIFACTS_DIR = "relative-kair-artifacts";
      expect(getArtifactsDir()).toBe(path.join(process.cwd(), "relative-kair-artifacts"));

      delete process.env.KAIR_ARTIFACTS_DIR;
      process.env.KAIRIK_ARTIFACTS_DIR = "/tmp/kairik-artifacts";
      expect(getArtifactsDir()).toBe("/tmp/kairik-artifacts");
    } finally {
      if (previousKairArtifactsDir === undefined) {
        delete process.env.KAIR_ARTIFACTS_DIR;
      } else {
        process.env.KAIR_ARTIFACTS_DIR = previousKairArtifactsDir;
      }
      if (previousKairikArtifactsDir === undefined) {
        delete process.env.KAIRIK_ARTIFACTS_DIR;
      } else {
        process.env.KAIRIK_ARTIFACTS_DIR = previousKairikArtifactsDir;
      }
    }
  });
});
