import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import type { ExecutionRequest, RunnerResult } from "./types";

type OpenClawRunnerOptions = {
  model?: string;
  provider?: string;
};

type PendingToolCall = {
  id: string;
  name: string;
  args: Record<string, any>;
};

type ToolCallResult = {
  id: string;
  name: string;
  args: Record<string, any>;
  ok: boolean;
  result?: any;
  error?: string;
};

const MAX_TOOL_HANDOFFS = 8;
const MAX_READ_CHARS = 100_000;
const MAX_FETCH_CHARS = 20_000;

function failed(summary: string, details: any = {}): RunnerResult {
  return {
    status: "failed",
    summary,
    outputs: details,
    errors: details,
  };
}

function resolvePathInsideArtifacts(artifactsDir: string, rawPath: string) {
  const trimmed = String(rawPath || "").trim();
  if (!trimmed) {
    throw new Error("path is required.");
  }
  const resolved = path.resolve(artifactsDir, trimmed);
  const relative = path.relative(artifactsDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("path must stay within artifactsDir.");
  }
  return resolved;
}

function buildClientToolDefinitions(enabledTools: Set<string>) {
  const definitions: any[] = [];
  if (enabledTools.has("fs_read")) {
    definitions.push({
      type: "function",
      function: {
        name: "fs_read",
        description: "Read UTF-8 text content from a file path under artifactsDir.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
      },
    });
  }
  if (enabledTools.has("fs_write")) {
    definitions.push({
      type: "function",
      function: {
        name: "fs_write",
        description: "Write UTF-8 text content to a file path under artifactsDir.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
          required: ["path", "content"],
        },
      },
    });
  }
  if (enabledTools.has("web_fetch")) {
    definitions.push({
      type: "function",
      function: {
        name: "web_fetch",
        description: "Fetch an HTTP(S) URL with GET and return status plus response body text.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            url: { type: "string" },
          },
          required: ["url"],
        },
      },
    });
  }
  return definitions;
}

function buildExecutionPrompt(request: ExecutionRequest, enabledTools: string[]) {
  const steps = request.plan.steps.map((step: any, index: number) => ({
    order: index + 1,
    id: step.id,
    summary: step.summary,
    details: step.details,
  }));
  return [
    "You are executing an approved Kair Contract.",
    "Follow the plan steps in order and keep output deterministic.",
    "You may use only explicitly available tools.",
    "Write any generated evidence under artifactsDir.",
    "At the end, provide a concise completion summary.",
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
      },
      null,
      2
    ),
  ].join("\n");
}

function buildToolResultPrompt(results: ToolCallResult[]) {
  return [
    "Tool results from your previous call:",
    JSON.stringify(results, null, 2),
    "Continue execution. If more tools are needed, call them now.",
    "If done, return a concise completion summary.",
  ].join("\n");
}

function collectSummaryText(response: any) {
  const payloads = Array.isArray(response?.payloads) ? response.payloads : [];
  const text = payloads
    .map((item: any) => (typeof item?.text === "string" ? item.text.trim() : ""))
    .filter(Boolean)
    .join("\n");
  if (text) {
    return text;
  }
  return "";
}

function parsePendingToolCalls(response: any): PendingToolCall[] {
  const pending = Array.isArray(response?.meta?.pendingToolCalls) ? response.meta.pendingToolCalls : [];
  const parsed: PendingToolCall[] = [];
  for (const entry of pending) {
    const id = String(entry?.id || "").trim() || `call_${Date.now()}`;
    const name = String(entry?.name || "").trim();
    if (!name) {
      continue;
    }
    let args: Record<string, any> = {};
    const rawArgs = entry?.arguments;
    if (typeof rawArgs === "string" && rawArgs.trim()) {
      try {
        const value = JSON.parse(rawArgs);
        if (value && typeof value === "object" && !Array.isArray(value)) {
          args = value;
        }
      } catch {
        args = {};
      }
    } else if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
      args = rawArgs;
    }
    parsed.push({ id, name, args });
  }
  return parsed;
}

function buildToolExecutor(params: { artifactsDir: string; enabledTools: Set<string> }) {
  const writtenFiles = new Set<string>();

  async function executeCall(call: PendingToolCall): Promise<ToolCallResult> {
    try {
      if (call.name === "fs_read") {
        if (!params.enabledTools.has("fs_read")) {
          throw new Error("fs_read is not enabled for this run.");
        }
        const target = resolvePathInsideArtifacts(params.artifactsDir, String(call.args.path || ""));
        const content = fs.readFileSync(target, "utf8");
        const truncated = content.length > MAX_READ_CHARS ? `${content.slice(0, MAX_READ_CHARS)}\n...[TRUNCATED]` : content;
        return {
          id: call.id,
          name: call.name,
          args: call.args,
          ok: true,
          result: {
            path: target,
            chars: content.length,
            content: truncated,
          },
        };
      }

      if (call.name === "fs_write") {
        if (!params.enabledTools.has("fs_write")) {
          throw new Error("fs_write is not enabled for this run.");
        }
        const target = resolvePathInsideArtifacts(params.artifactsDir, String(call.args.path || ""));
        const content = String(call.args.content ?? "");
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, "utf8");
        writtenFiles.add(target);
        return {
          id: call.id,
          name: call.name,
          args: call.args,
          ok: true,
          result: {
            path: target,
            chars: content.length,
          },
        };
      }

      if (call.name === "web_fetch") {
        if (!params.enabledTools.has("web_fetch")) {
          throw new Error("web_fetch is not enabled for this run.");
        }
        const rawUrl = String(call.args.url || "").trim();
        if (!rawUrl) {
          throw new Error("url is required.");
        }
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("url must use http or https.");
        }
        const response = await fetch(parsed.toString(), { method: "GET" });
        const bodyRaw = await response.text();
        const body = bodyRaw.length > MAX_FETCH_CHARS ? `${bodyRaw.slice(0, MAX_FETCH_CHARS)}\n...[TRUNCATED]` : bodyRaw;
        return {
          id: call.id,
          name: call.name,
          args: call.args,
          ok: true,
          result: {
            url: parsed.toString(),
            status: response.status,
            ok: response.ok,
            body,
          },
        };
      }

      throw new Error(`Unsupported tool "${call.name}".`);
    } catch (error: any) {
      return {
        id: call.id,
        name: call.name,
        args: call.args,
        ok: false,
        error: error && error.message ? error.message : String(error),
      };
    }
  }

  return {
    executeCall,
    getWrittenFiles: () => [...writtenFiles],
  };
}

function resolveEnabledTools(grants: string[]) {
  const grantSet = new Set((grants || []).map((grant) => String(grant || "").trim()));
  const enabled = new Set<string>();
  if (grantSet.has("local:read")) {
    enabled.add("fs_read");
  }
  if (grantSet.has("local:write")) {
    enabled.add("fs_write");
  }
  if (grantSet.has("web:fetch")) {
    enabled.add("web_fetch");
  }
  return enabled;
}

function resolveRunEmbeddedPiAgentModule() {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const openclawEntry = require.resolve("openclaw");
  const distDir = path.dirname(openclawEntry);
  const replyModuleFile = fs.readdirSync(distDir).find((name) => /^reply-.*\.js$/.test(name));
  if (!replyModuleFile) {
    throw new Error("Unable to locate OpenClaw embedded runner module.");
  }
  return pathToFileURL(path.join(distDir, replyModuleFile)).href;
}

export async function runWithOpenClaw(
  request: ExecutionRequest,
  options: OpenClawRunnerOptions = {}
): Promise<RunnerResult> {
  const apiKey = (process.env.KAIR_OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return failed(
      "Missing KAIR_OPENAI_API_KEY. Set it before running `kair run` with the OpenClaw runner."
    );
  }

  if (!(process.env.OPENAI_API_KEY || "").trim()) {
    process.env.OPENAI_API_KEY = apiKey;
  }

  let openclaw: any;
  let runEmbeddedPiAgent: any;
  try {
    openclaw = await import("openclaw");
    const replyModuleUrl = resolveRunEmbeddedPiAgentModule();
    const replyModule: any = await import(replyModuleUrl);
    runEmbeddedPiAgent = replyModule.runEmbeddedPiAgent;
  } catch (error: any) {
    return failed(
      `Failed to load OpenClaw runner modules: ${error && error.message ? error.message : String(error)}`
    );
  }

  if (typeof runEmbeddedPiAgent !== "function") {
    return failed("OpenClaw embedded runner API is unavailable in this package version.");
  }

  if (typeof openclaw?.loadConfig !== "function") {
    return failed("OpenClaw loadConfig API is unavailable in this package version.");
  }

  const enabledTools = resolveEnabledTools(request.grants);
  const enabledToolNames = [...enabledTools];
  const clientTools = buildClientToolDefinitions(enabledTools);
  const toolExecutor = buildToolExecutor({
    artifactsDir: request.artifactsDir,
    enabledTools,
  });
  const toolCalls: ToolCallResult[] = [];
  const responses: any[] = [];

  fs.mkdirSync(request.artifactsDir, { recursive: true });
  const sessionId = `${request.contractId}-run-${Date.now()}`;
  const sessionFile = path.join(request.artifactsDir, "openclaw-session.jsonl");
  let config: any;
  try {
    config = openclaw.loadConfig();
  } catch (error: any) {
    return failed(
      `Failed to load OpenClaw configuration: ${error && error.message ? error.message : String(error)}`
    );
  }
  let prompt = buildExecutionPrompt(request, enabledToolNames);
  let lastPendingCount = 0;
  let exhaustedHandoffs = false;

  try {
    for (let handoff = 0; handoff < MAX_TOOL_HANDOFFS; handoff += 1) {
      const response = await runEmbeddedPiAgent({
        sessionId,
        runId: `${sessionId}-${handoff + 1}`,
        sessionFile,
        workspaceDir: request.artifactsDir,
        config,
        prompt,
        provider: options.provider || undefined,
        model: options.model || undefined,
        disableTools: true,
        clientTools: clientTools.length > 0 ? clientTools : undefined,
        timeoutMs: 120_000,
        verboseLevel: "off",
        reasoningLevel: "off",
        toolResultFormat: "plain",
      });
      responses.push(response);

      const pending = parsePendingToolCalls(response);
      lastPendingCount = pending.length;
      if (pending.length === 0) {
        break;
      }

      const results: ToolCallResult[] = [];
      for (const call of pending) {
        const result = await toolExecutor.executeCall(call);
        results.push(result);
      }
      toolCalls.push(...results);
      prompt = buildToolResultPrompt(results);

      if (handoff === MAX_TOOL_HANDOFFS - 1) {
        exhaustedHandoffs = true;
      }
    }
  } catch (error: any) {
    return {
      status: "failed",
      summary: error && error.message ? error.message : String(error),
      outputs: {
        responses,
        toolCalls,
        enabledTools: enabledToolNames,
      },
      logsPath: sessionFile,
      evidencePaths: toolExecutor.getWrittenFiles(),
      errors: error && error.message ? error.message : String(error),
    };
  }

  const lastResponse = responses.length ? responses[responses.length - 1] : null;
  const lastText = collectSummaryText(lastResponse);
  const payloadHasError = Array.isArray(lastResponse?.payloads)
    ? lastResponse.payloads.some((item: any) => item && item.isError === true)
    : false;
  const metaErrorText =
    lastResponse?.meta?.error && typeof lastResponse.meta.error.message === "string"
      ? lastResponse.meta.error.message
      : "";

  if (exhaustedHandoffs && lastPendingCount > 0) {
    return {
      status: "failed",
      summary: "OpenClaw runner exceeded tool handoff limit without reaching completion.",
      outputs: {
        responses,
        toolCalls,
        enabledTools: enabledToolNames,
      },
      logsPath: sessionFile,
      evidencePaths: toolExecutor.getWrittenFiles(),
      errors: "tool_handoff_limit_exceeded",
    };
  }

  if (payloadHasError || metaErrorText) {
    return {
      status: "failed",
      summary: lastText || metaErrorText || "OpenClaw runner reported an execution error.",
      outputs: {
        responses,
        toolCalls,
        enabledTools: enabledToolNames,
      },
      logsPath: sessionFile,
      evidencePaths: toolExecutor.getWrittenFiles(),
      errors: metaErrorText || lastText || "runner_error",
    };
  }

  return {
    status: "completed",
    summary: lastText || "Execution completed via OpenClaw runner.",
    outputs: {
      responses,
      toolCalls,
      enabledTools: enabledToolNames,
    },
    logsPath: sessionFile,
    evidencePaths: toolExecutor.getWrittenFiles(),
  };
}
