import * as fs from "node:fs";
import * as path from "node:path";

import type { ExecutionRequest, RunnerResult } from "./types";

type NativeRunnerOptions = {
  model?: string;
  provider?: string;
};

const DEFAULT_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-5.1";
const SUPPORTED_PROVIDERS = new Set(["openai", "claude"]);

function failed(summary: string, outputs: any = {}, extras: Partial<RunnerResult> = {}): RunnerResult {
  return {
    status: "failed",
    summary,
    backend: "native",
    outputs,
    errors: outputs,
    ...extras,
  };
}

function resolveEffectiveProvider(options: NativeRunnerOptions) {
  return String(options.provider || process.env.KAIR_LLM_PROVIDER || DEFAULT_PROVIDER)
    .trim()
    .toLowerCase();
}

function resolveEffectiveModel(options: NativeRunnerOptions, effectiveProvider: string) {
  const raw = String(options.model || process.env.KAIR_LLM_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  if (raw.includes("/")) {
    return raw;
  }
  return `${effectiveProvider}/${raw}`;
}

function resolveProviderApiKey(provider: string) {
  if (provider === "openai") {
    return String(process.env.KAIR_OPENAI_API_KEY || "").trim();
  }
  if (provider === "claude") {
    return String(process.env.KAIR_CLAUDE_API_KEY || "").trim();
  }
  return "";
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function buildExecutionSummary(request: ExecutionRequest, provider: string, model: string) {
  const lines = [
    "# Kair Native Run Summary",
    "",
    `- Provider: ${provider}`,
    `- Model: ${model}`,
    `- Contract: ${request.contractId}`,
    `- Intent: ${request.intent}`,
    "",
    "## Plan Steps",
  ];
  for (const step of request.plan.steps) {
    lines.push(`- ${step.id}: ${step.summary}`);
    if (step.details && step.details.trim()) {
      lines.push(`  - details: ${step.details.trim()}`);
    }
  }
  lines.push("");
  lines.push("Native runner executed with deterministic local artifact generation.");
  return `${lines.join("\n")}\n`;
}

export async function runWithNativeRunner(
  request: ExecutionRequest,
  options: NativeRunnerOptions = {}
): Promise<RunnerResult> {
  const effectiveProvider = resolveEffectiveProvider(options);
  const effectiveModel = resolveEffectiveModel(options, effectiveProvider);

  if (!SUPPORTED_PROVIDERS.has(effectiveProvider)) {
    return failed(
      `Unsupported run provider \"${effectiveProvider}\". kair run currently supports only providers \"openai\" and \"claude\".`,
      {
        backend: "native",
        effectiveProvider,
        effectiveModel,
      }
    );
  }

  const apiKey = resolveProviderApiKey(effectiveProvider);
  if (!apiKey) {
    return failed(
      effectiveProvider === "claude"
        ? "Missing KAIR_CLAUDE_API_KEY. Run `kair login --provider claude` or set it before running `kair run`."
        : "Missing KAIR_OPENAI_API_KEY. Run `kair login --provider openai` or set it before running `kair run`.",
      {
        backend: "native",
        effectiveProvider,
        effectiveModel,
      }
    );
  }

  const summaryPath = path.join(request.artifactsDir, "native-summary.md");
  const logsPath = path.join(request.artifactsDir, "native-run.log");
  const summaryContent = buildExecutionSummary(request, effectiveProvider, effectiveModel);
  writeFile(summaryPath, summaryContent);
  writeFile(
    logsPath,
    [
      `[native-runner] contract=${request.contractId}`,
      `[native-runner] provider=${effectiveProvider}`,
      `[native-runner] model=${effectiveModel}`,
      `[native-runner] status=completed`,
      `[native-runner] evidence=${summaryPath}`,
    ].join("\n") + "\n"
  );

  return {
    status: "completed",
    backend: "native",
    summary: "Execution completed via native Kair runner.",
    logsPath,
    evidencePaths: [summaryPath],
    outputs: {
      backend: "native",
      effectiveProvider,
      effectiveModel,
      summaryPath,
      logsPath,
      enabledTools: [],
    },
  };
}
