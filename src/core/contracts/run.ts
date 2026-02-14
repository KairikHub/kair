import * as fs from "node:fs";
import * as path from "node:path";

import type { Plan } from "../plans/schema";
import { getArtifactsDir } from "../store/paths";
import { now } from "../time";
import { fail } from "../errors";
import { enforceControls } from "./controls";
import { assertState, recordHistory, transition } from "./history";
import { runWithOpenClaw } from "../runner/openclaw_runner";
import type { ExecutionRequest, RunnerResult } from "../runner/types";

export type RunContractOptions = {
  provider?: string;
  model?: string;
  force?: boolean;
  actor?: string;
};

export type RunContractOutcome = {
  request: ExecutionRequest | null;
  requestPath: string;
  resultPath: string;
  result: RunnerResult;
  enabledTools: string[];
  runnerSummary: string;
  failureReason: string | null;
  missingEvidencePaths: string[];
  claimedEvidencePaths: string[];
};

function resolveStructuredPlan(contract: any): Plan | null {
  if (contract?.plan_v1 && contract.plan_v1.version === "kair.plan.v1") {
    return contract.plan_v1;
  }
  if (contract?.planJson && contract.planJson.version === "kair.plan.v1") {
    return contract.planJson;
  }
  return null;
}

function writeJson(filePath: string, payload: any) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function buildExecutionRequest(contract: any, runDir: string): ExecutionRequest | null {
  const plan = resolveStructuredPlan(contract);
  if (!plan) {
    return null;
  }
  return {
    contractId: contract.id,
    intent: contract.intent,
    plan,
    grants: Array.isArray(contract.controlsApproved) ? [...contract.controlsApproved] : [],
    expectedEvidence: Array.isArray(plan.steps) ? plan.steps.map((step: any) => String(step.id)) : [],
    artifactsDir: runDir,
  };
}

function appendRunArtifacts(contract: any, params: { requestPath: string; resultPath: string; result: RunnerResult }) {
  contract.artifacts.push({
    type: "run_request",
    content: params.requestPath,
  });
  contract.artifacts.push({
    type: "run_result",
    content: params.resultPath,
  });
  if (params.result.logsPath) {
    contract.artifacts.push({
      type: "run_log",
      content: params.result.logsPath,
    });
  }
  if (Array.isArray(params.result.evidencePaths)) {
    for (const evidencePath of params.result.evidencePaths) {
      contract.artifacts.push({
        type: "run_evidence",
        content: evidencePath,
      });
    }
  }
  contract.artifacts.push({
    type: "summary",
    content: params.result.summary,
  });
}

function normalizeClaimedEvidencePaths(evidencePaths: any) {
  if (!Array.isArray(evidencePaths)) {
    return [];
  }
  const unique = new Set<string>();
  const normalized: string[] = [];
  for (const item of evidencePaths) {
    const candidate = String(item || "").trim();
    if (!candidate || !path.isAbsolute(candidate) || unique.has(candidate)) {
      continue;
    }
    unique.add(candidate);
    normalized.push(candidate);
  }
  return normalized;
}

export function checkEvidencePathExistence(
  evidencePaths: string[],
  existsFn: (candidatePath: string) => boolean = (candidatePath) => fs.existsSync(candidatePath)
) {
  const existingPaths: string[] = [];
  const missingPaths: string[] = [];
  for (const evidencePath of evidencePaths) {
    if (existsFn(evidencePath)) {
      existingPaths.push(evidencePath);
    } else {
      missingPaths.push(evidencePath);
    }
  }
  return { existingPaths, missingPaths };
}

export async function runContract(
  contract: any,
  options: RunContractOptions = {}
): Promise<RunContractOutcome> {
  if (contract.current_state === "APPROVED") {
    // default happy path
  } else if (options.force) {
    if (contract.current_state !== "FAILED") {
      fail(`--force is only allowed when state is FAILED (current: ${contract.current_state}).`);
    }
    const actor = options.actor;
    recordHistory(
      contract,
      "FAILED",
      `Force run override requested; allowing rerun from FAILED.${actor ? ` Actor: ${actor}.` : ""}`,
      actor
    );
  } else {
    assertState(contract, ["APPROVED"], "run");
  }
  if (!enforceControls(contract, "execution", { fatal: true })) {
    throw new Error(`Contract "${contract.id}" blocked due to missing controls.`);
  }

  contract.pauseContext = null;
  transition(contract, "RUNNING", "Execution started for the approved Contract.");

  const runDir = path.join(getArtifactsDir(), contract.id, "run");
  const requestPath = path.join(runDir, "run-request.json");
  const resultPath = path.join(runDir, "run-result.json");
  const executionRequest = buildExecutionRequest(contract, runDir);

  writeJson(requestPath, {
    generated_at: now(),
    request: executionRequest,
    contract: {
      id: contract.id,
      intent: contract.intent,
      activeVersion: contract.activeVersion,
      controlsApproved: Array.isArray(contract.controlsApproved) ? [...contract.controlsApproved] : [],
    },
  });

  let result: RunnerResult;
  if (!executionRequest) {
    result = {
      status: "failed",
      summary: "Structured plan required; run `kair plan` first.",
      outputs: {
        reason: "missing_structured_plan",
      },
      errors: "missing_structured_plan",
    };
  } else {
    result = await runWithOpenClaw(executionRequest, {
      provider: options.provider,
      model: options.model,
    });
  }

  const runnerSummary = result.summary;
  const claimedEvidencePaths = normalizeClaimedEvidencePaths(result.evidencePaths);
  const existence = checkEvidencePathExistence(claimedEvidencePaths);
  let failureReason: string | null = null;
  if (existence.missingPaths.length > 0) {
    const logsRef = result.logsPath || "run-result.json";
    failureReason = `Runner claimed evidence paths that do not exist: ${existence.missingPaths.join(
      ", "
    )}. See logs: ${logsRef}.`;
    result = {
      ...result,
      status: "failed",
      summary: failureReason,
      evidencePaths: existence.existingPaths,
      outputs: {
        ...(result?.outputs && typeof result.outputs === "object" ? result.outputs : {}),
        claimedEvidencePaths,
        missingEvidencePaths: existence.missingPaths,
      },
      errors: {
        ...(result?.errors && typeof result.errors === "object" ? result.errors : {}),
        reason: failureReason,
        missingEvidencePaths: existence.missingPaths,
      },
    };
  } else {
    result = {
      ...result,
      evidencePaths: existence.existingPaths,
      outputs: {
        ...(result?.outputs && typeof result.outputs === "object" ? result.outputs : {}),
        claimedEvidencePaths,
        missingEvidencePaths: [],
      },
    };
  }
  if (result.status !== "completed" && !failureReason) {
    failureReason = result.summary || "Execution failed.";
  }
  // TODO: Future auto-rerun can inject failureReason into refine/run prompts for bounded retries.

  writeJson(resultPath, {
    generated_at: now(),
    result,
    runnerSummary,
    failureReason,
    missingEvidencePaths: existence.missingPaths,
    logsPath: result.logsPath || null,
  });
  appendRunArtifacts(contract, { requestPath, resultPath, result });

  if (result.status === "completed") {
    transition(contract, "COMPLETED", `Execution completed via OpenClaw runner. ${result.summary}`);
  } else {
    transition(contract, "FAILED", `Execution failed via OpenClaw runner. Reason: "${failureReason}".`);
  }

  const enabledTools =
    Array.isArray(result?.outputs?.enabledTools) ? result.outputs.enabledTools.map((item: any) => String(item)) : [];

  return {
    request: executionRequest,
    requestPath,
    resultPath,
    result,
    enabledTools,
    runnerSummary,
    failureReason,
    missingEvidencePaths: existence.missingPaths,
    claimedEvidencePaths,
  };
}

export async function resumeContract(_contract: any) {
  throw new Error("Resume is not supported for OpenClaw runner yet.");
}
