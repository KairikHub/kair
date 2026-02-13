import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import type { ExecutionRequest, RunnerResult } from "./types";

type OpenClawRunnerOptions = {
  model?: string;
  provider?: string;
};

const DEFAULT_TIMEOUT_SECONDS = 120;
const MAX_LOG_SUMMARY_CHARS = 1200;
const DEFAULT_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-5.1";

function failed(summary: string, outputs: any = {}, extras: Partial<RunnerResult> = {}): RunnerResult {
  return {
    status: "failed",
    summary,
    outputs,
    errors: outputs,
    ...extras,
  };
}

function trimSummary(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= MAX_LOG_SUMMARY_CHARS) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_LOG_SUMMARY_CHARS)}...[truncated]`;
}

function firstUsefulLine(value: string) {
  const lines = String(value || "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[0] || "";
}

function resolveEnabledTools(grants: string[]) {
  const grantSet = new Set((grants || []).map((grant) => String(grant || "").trim()));
  const enabled: string[] = [];
  if (grantSet.has("local:read")) {
    enabled.push("fs_read");
  }
  if (grantSet.has("local:write")) {
    enabled.push("fs_write");
  }
  if (grantSet.has("web:fetch")) {
    enabled.push("web_fetch");
  }
  return enabled;
}

function resolveEffectiveProvider(options: OpenClawRunnerOptions) {
  return String(options.provider || process.env.KAIR_LLM_PROVIDER || DEFAULT_PROVIDER)
    .trim()
    .toLowerCase();
}

function resolveEffectiveModel(options: OpenClawRunnerOptions, effectiveProvider: string) {
  const raw = String(options.model || process.env.KAIR_LLM_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  if (raw.includes("/")) {
    return raw;
  }
  return `${effectiveProvider}/${raw}`;
}

function resolveOpenClawStateDir(artifactsDir: string) {
  const explicit = String(process.env.OPENCLAW_STATE_DIR || "").trim();
  if (explicit) {
    return explicit;
  }
  const mountedDefault = "/home/node/.openclaw";
  if (fs.existsSync(mountedDefault)) {
    return mountedDefault;
  }
  return path.join(artifactsDir, ".openclaw-state");
}

function writeOpenClawConfigFile(configPath: string, effectiveModel: string) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        agents: {
          defaults: {
            model: {
              primary: effectiveModel,
            },
          },
        },
      },
      null,
      2
    ),
    "utf8"
  );
}

function buildExecutionPrompt(
  request: ExecutionRequest,
  enabledTools: string[],
  params: {
    requestedProvider: string | null;
    requestedModel: string | null;
    effectiveProvider: string;
    effectiveModel: string;
  }
) {
  const steps = request.plan.steps.map((step: any, index: number) => ({
    order: index + 1,
    id: step.id,
    summary: step.summary,
    details: step.details,
  }));

  return [
    "You are executing an approved Kair Contract.",
    "Follow plan steps in order and keep output deterministic.",
    "Use tools only when explicitly allowed in availableTools.",
    "If writing files, keep them under artifactsDir.",
    "Return a concise completion summary.",
    "",
    "Execution payload:",
    JSON.stringify(
      {
        contractId: request.contractId,
        intent: request.intent,
        planTitle: request.plan.title,
        planSteps: steps,
        expectedEvidence: request.expectedEvidence,
        artifactsDir: request.artifactsDir,
        availableTools: enabledTools,
        toolPolicy: {
          fs_read: "requires local:read",
          fs_write: "requires local:write",
          web_fetch: "requires web:fetch",
        },
        requestedProvider: params.requestedProvider,
        requestedModel: params.requestedModel,
        effectiveProvider: params.effectiveProvider,
        effectiveModel: params.effectiveModel,
      },
      null,
      2
    ),
  ].join("\n");
}

function resolveOpenClawBinaryPath() {
  const override = (process.env.KAIR_OPENCLAW_BIN || "").trim();
  if (override) {
    return override;
  }

  const appBin = "/app/node_modules/.bin/openclaw";
  if (fs.existsSync(appBin)) {
    return appBin;
  }

  const localBin = path.join(process.cwd(), "node_modules", ".bin", "openclaw");
  if (fs.existsSync(localBin)) {
    return localBin;
  }

  return "openclaw";
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function writeOpenClawDiagnostics(params: {
  artifactsDir: string;
  commandPath: string;
  commandArgs: string[];
  stdoutRaw: string;
  stderrRaw: string;
  envView: Record<string, string>;
}) {
  fs.mkdirSync(params.artifactsDir, { recursive: true });
  const commandArtifactPath = path.join(params.artifactsDir, "openclaw-command.json");
  const stdoutLogPath = path.join(params.artifactsDir, "openclaw-stdout.log");
  const stderrLogPath = path.join(params.artifactsDir, "openclaw-stderr.log");

  writeFile(
    commandArtifactPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        command: params.commandPath,
        args: params.commandArgs,
        cwd: process.cwd(),
        env: params.envView,
      },
      null,
      2
    )
  );
  writeFile(stdoutLogPath, params.stdoutRaw);
  writeFile(stderrLogPath, params.stderrRaw);

  return {
    commandArtifactPath,
    stdoutLogPath,
    stderrLogPath,
  };
}

function collectPayloadSummary(payloads: any[]) {
  return payloads
    .map((item) => (typeof item?.text === "string" ? item.text.trim() : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function runWithOpenClaw(
  request: ExecutionRequest,
  options: OpenClawRunnerOptions = {}
): Promise<RunnerResult> {
  const effectiveProvider = resolveEffectiveProvider(options);
  const effectiveModel = resolveEffectiveModel(options, effectiveProvider);
  const openclawStateDir = resolveOpenClawStateDir(request.artifactsDir);
  const openclawConfigPath = path.join(request.artifactsDir, "openclaw-config.json");

  if (effectiveProvider !== DEFAULT_PROVIDER) {
    return failed(
      `Unsupported run provider "${effectiveProvider}". kair run currently supports only provider "openai".`,
      {
        parserMode: "preflight",
        effectiveProvider,
        effectiveModel,
        openclawStateDir,
        openclawConfigPath,
      }
    );
  }

  const apiKey = (process.env.KAIR_OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return failed(
      "Missing KAIR_OPENAI_API_KEY. Set it before running `kair run` with the OpenClaw runner.",
      {
        parserMode: "preflight",
        effectiveProvider,
        effectiveModel,
        openclawStateDir,
        openclawConfigPath,
      }
    );
  }

  try {
    fs.mkdirSync(openclawStateDir, { recursive: true });
    writeOpenClawConfigFile(openclawConfigPath, effectiveModel);
  } catch (error: any) {
    return failed(
      `Failed to prepare OpenClaw runtime config: ${trimSummary(error?.message || String(error))}`,
      {
        parserMode: "preflight",
        effectiveProvider,
        effectiveModel,
        openclawStateDir,
        openclawConfigPath,
      }
    );
  }

  const enabledTools = resolveEnabledTools(request.grants);
  const prompt = buildExecutionPrompt(request, enabledTools, {
    requestedProvider: options.provider ? String(options.provider).trim() : null,
    requestedModel: options.model ? String(options.model).trim() : null,
    effectiveProvider,
    effectiveModel,
  });
  const openclawPath = resolveOpenClawBinaryPath();
  const timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;
  const commandArgs = [
    "agent",
    "--local",
    "--json",
    "--session-id",
    request.contractId,
    "--message",
    prompt,
    "--timeout",
    String(timeoutSeconds),
  ];

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    OPENCLAW_STATE_DIR: openclawStateDir,
    OPENCLAW_CONFIG_PATH: openclawConfigPath,
  };
  if (!String(childEnv.OPENAI_API_KEY || "").trim()) {
    childEnv.OPENAI_API_KEY = apiKey;
  }

  const subprocess = spawnSync(openclawPath, commandArgs, {
    cwd: process.cwd(),
    env: childEnv,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: (timeoutSeconds + 5) * 1000,
  });

  const stdoutRaw = String(subprocess.stdout || "");
  const stderrRaw = String(subprocess.stderr || "");

  const diagnostics = writeOpenClawDiagnostics({
    artifactsDir: request.artifactsDir,
    commandPath: openclawPath,
    commandArgs,
    stdoutRaw,
    stderrRaw,
    envView: {
      KAIR_OPENAI_API_KEY: apiKey ? "[set]" : "[missing]",
      OPENAI_API_KEY: String(childEnv.OPENAI_API_KEY || "").trim() ? "[set]" : "[missing]",
      KAIR_OPENCLAW_BIN: (process.env.KAIR_OPENCLAW_BIN || "").trim() ? "[set]" : "[default]",
      OPENCLAW_STATE_DIR: openclawStateDir,
      OPENCLAW_CONFIG_PATH: openclawConfigPath,
      effectiveProvider,
      effectiveModel,
    },
  });

  const outputBase = {
    enabledTools,
    commandPath: openclawPath,
    commandArgs,
    stdoutLogPath: diagnostics.stdoutLogPath,
    stderrLogPath: diagnostics.stderrLogPath,
    effectiveProvider,
    effectiveModel,
    openclawStateDir,
    openclawConfigPath,
  };
  const evidencePaths = [
    openclawConfigPath,
    diagnostics.commandArtifactPath,
    diagnostics.stdoutLogPath,
    diagnostics.stderrLogPath,
  ];

  if (subprocess.error) {
    const code = (subprocess.error as any).code;
    if (code === "ENOENT") {
      return failed(
        `OpenClaw CLI not found at "${openclawPath}". Install openclaw or set KAIR_OPENCLAW_BIN to a valid binary.`,
        {
          ...outputBase,
          parserMode: "spawn_error",
          spawnError: trimSummary(subprocess.error.message || String(subprocess.error)),
        },
        {
          logsPath: diagnostics.stderrLogPath,
          evidencePaths,
        }
      );
    }

    return failed(
      `Failed to execute OpenClaw CLI: ${trimSummary(subprocess.error.message || String(subprocess.error))}`,
      {
        ...outputBase,
        parserMode: "spawn_error",
        spawnError: trimSummary(subprocess.error.message || String(subprocess.error)),
      },
      {
        logsPath: diagnostics.stderrLogPath,
        evidencePaths,
      }
    );
  }

  const exitCode = typeof subprocess.status === "number" ? subprocess.status : 1;
  if (exitCode !== 0) {
    const summary =
      firstUsefulLine(stderrRaw) ||
      firstUsefulLine(stdoutRaw) ||
      `OpenClaw CLI exited with code ${exitCode}.`;
    return failed(
      trimSummary(summary),
      {
        ...outputBase,
        parserMode: "raw",
        exitCode,
        stdoutPreview: trimSummary(stdoutRaw),
        stderrPreview: trimSummary(stderrRaw),
      },
      {
        logsPath: diagnostics.stderrLogPath,
        evidencePaths,
      }
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(stdoutRaw);
  } catch {
    return failed(
      "OpenClaw CLI returned non-JSON output in --json mode.",
      {
        ...outputBase,
        parserMode: "parse_error",
        stdoutPreview: trimSummary(stdoutRaw),
        stderrPreview: trimSummary(stderrRaw),
      },
      {
        logsPath: diagnostics.stdoutLogPath,
        evidencePaths,
      }
    );
  }

  const payloads = Array.isArray(parsed?.payloads) ? parsed.payloads : [];
  const payloadSummary = collectPayloadSummary(payloads);
  const payloadHasError = payloads.some((item: any) => item && item.isError === true);
  const metaErrorText =
    parsed?.meta?.error && typeof parsed.meta.error.message === "string"
      ? parsed.meta.error.message.trim()
      : "";

  if (payloadHasError || metaErrorText) {
    return failed(
      trimSummary(payloadSummary || metaErrorText || "OpenClaw CLI reported execution error."),
      {
        ...outputBase,
        parserMode: "json",
        rawResponse: parsed,
      },
      {
        logsPath: diagnostics.stderrLogPath,
        evidencePaths,
      }
    );
  }

  return {
    status: "completed",
    summary: trimSummary(payloadSummary || "Execution completed via OpenClaw CLI runner."),
    outputs: {
      ...outputBase,
      parserMode: "json",
      rawResponse: parsed,
    },
    logsPath: diagnostics.stdoutLogPath,
    evidencePaths,
  };
}
