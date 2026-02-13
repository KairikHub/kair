/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup.ts"],
  roots: ["<rootDir>/tests"],
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  verbose: false,
  clearMocks: true,
  testTimeout: 60000,
  maxWorkers: "50%",
  modulePathIgnorePatterns: ["<rootDir>/.pnpm-store/"],
  watchPathIgnorePatterns: ["<rootDir>/.pnpm-store/"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
  },
};
