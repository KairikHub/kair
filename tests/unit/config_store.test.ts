import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { getConfigPath, getDefaultProvider, readConfig, setDefaultProvider } from "../../src/core/store/config";

describe("unit: config store", () => {
  test("readConfig returns empty object when config is missing", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kair-config-test-"));
    const previous = process.env.KAIR_CONFIG_PATH;
    const configPath = path.join(root, "config.json");
    process.env.KAIR_CONFIG_PATH = configPath;
    try {
      expect(getConfigPath()).toBe(configPath);
      expect(readConfig()).toEqual({});
      expect(getDefaultProvider()).toBeNull();
    } finally {
      if (previous === undefined) {
        delete process.env.KAIR_CONFIG_PATH;
      } else {
        process.env.KAIR_CONFIG_PATH = previous;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("setDefaultProvider persists supported provider value", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kair-config-test-"));
    const previous = process.env.KAIR_CONFIG_PATH;
    const configPath = path.join(root, "config.json");
    process.env.KAIR_CONFIG_PATH = configPath;
    try {
      setDefaultProvider("claude");
      expect(fs.existsSync(configPath)).toBe(true);
      expect(getDefaultProvider()).toBe("claude");
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
      expect(parsed.defaultProvider).toBe("claude");
    } finally {
      if (previous === undefined) {
        delete process.env.KAIR_CONFIG_PATH;
      } else {
        process.env.KAIR_CONFIG_PATH = previous;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
