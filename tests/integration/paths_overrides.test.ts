import * as path from "node:path";

import { getArtifactsDir, getDataDir } from "../../src/core/store/paths";

describe("integration: path override env vars", () => {
  test("supports KAIRIK_DATA_DIR and prefers it over KAIR_DATA_DIR", () => {
    const previousKairikDataDir = process.env.KAIRIK_DATA_DIR;
    const previousKairDataDir = process.env.KAIR_DATA_DIR;

    try {
      process.env.KAIR_DATA_DIR = "/tmp/kair-data";
      delete process.env.KAIRIK_DATA_DIR;
      expect(getDataDir()).toBe("/tmp/kair-data");

      process.env.KAIRIK_DATA_DIR = "/tmp/kairik-data";
      expect(getDataDir()).toBe("/tmp/kairik-data");

      process.env.KAIRIK_DATA_DIR = "relative-kairik-data";
      expect(getDataDir()).toBe(path.join(process.cwd(), "relative-kairik-data"));
    } finally {
      if (previousKairikDataDir === undefined) {
        delete process.env.KAIRIK_DATA_DIR;
      } else {
        process.env.KAIRIK_DATA_DIR = previousKairikDataDir;
      }
      if (previousKairDataDir === undefined) {
        delete process.env.KAIR_DATA_DIR;
      } else {
        process.env.KAIR_DATA_DIR = previousKairDataDir;
      }
    }
  });

  test("supports KAIRIK_ARTIFACTS_DIR and prefers it over KAIR_ARTIFACTS_DIR", () => {
    const previousKairikArtifactsDir = process.env.KAIRIK_ARTIFACTS_DIR;
    const previousKairArtifactsDir = process.env.KAIR_ARTIFACTS_DIR;

    try {
      process.env.KAIR_ARTIFACTS_DIR = "/tmp/kair-artifacts";
      delete process.env.KAIRIK_ARTIFACTS_DIR;
      expect(getArtifactsDir()).toBe("/tmp/kair-artifacts");

      process.env.KAIRIK_ARTIFACTS_DIR = "/tmp/kairik-artifacts";
      expect(getArtifactsDir()).toBe("/tmp/kairik-artifacts");

      process.env.KAIRIK_ARTIFACTS_DIR = "relative-kairik-artifacts";
      expect(getArtifactsDir()).toBe(path.join(process.cwd(), "relative-kairik-artifacts"));
    } finally {
      if (previousKairikArtifactsDir === undefined) {
        delete process.env.KAIRIK_ARTIFACTS_DIR;
      } else {
        process.env.KAIRIK_ARTIFACTS_DIR = previousKairikArtifactsDir;
      }
      if (previousKairArtifactsDir === undefined) {
        delete process.env.KAIR_ARTIFACTS_DIR;
      } else {
        process.env.KAIR_ARTIFACTS_DIR = previousKairArtifactsDir;
      }
    }
  });
});
