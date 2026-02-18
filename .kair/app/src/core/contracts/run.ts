import * as fs from "node:fs";
import * as path from "node:path";

import type { Plan } from "../plans/schema";
import { getContractArtifactsDir } from "../store/paths";
import { now } from "../time";
import { fail } from "../errors";
import { enforceControls } from "./controls";
import { recordHistory, transition } from "./history";
import { runWithNativeRunner } from "../runner/native_runner";
import type { ExecutionRequest, RunnerResult } from "../runner/types";
import { appendStreamEvent } from "../streaming/events";

export type RunContractOptions = {
  provider?: string;
  model?: string;
  force?: boolean;
  actor?: string;
  dryRun?: boolean;
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
  outOfScopeClaimedEvidencePaths: string[];
  evidenceValidationFailed: boolean;
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

function isPathWithinDirectory(candidatePath: string, directoryPath: string) {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedDirectory = path.resolve(directoryPath);
  return (
    resolvedCandidate === resolvedDirectory ||
    resolvedCandidate.startsWith(`${resolvedDirectory}${path.sep}`)
  );
}

export function classifyClaimedEvidencePaths(
  claimedEvidencePaths: string[],
  runDir: string,
  existsFn: (candidatePath: string) => boolean = (candidatePath) => fs.existsSync(candidatePath)
) {
  const validExistingPaths: string[] = [];
  const missingPaths: string[] = [];
  const outOfScopePaths: string[] = [];
  for (const evidencePath of claimedEvidencePaths) {
    const resolvedEvidencePath = path.resolve(evidencePath);
    if (!isPathWithinDirectory(resolvedEvidencePath, runDir)) {
      outOfScopePaths.push(resolvedEvidencePath);
      continue;
    }
    if (existsFn(resolvedEvidencePath)) {
      validExistingPaths.push(resolvedEvidencePath);
    } else {
      missingPaths.push(resolvedEvidencePath);
    }
  }
  return { validExistingPaths, missingPaths, outOfScopePaths };
}

export async function runContract(
  contract: any,
  options: RunContractOptions = {}
): Promise<RunContractOutcome> {
  if (contract.current_state === "RUNNING" || contract.current_state === "PAUSED") {
    fail(`Cannot run Contract "${contract.id}" because state is ${contract.current_state}.`);
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
  } else if (contract.current_state === "FAILED") {
    fail(`Contract "${contract.id}" is FAILED. Use --force to rerun.`);
  }
  if (!enforceControls(contract, "execution", { fatal: true })) {
    throw new Error(`Contract "${contract.id}" blocked due to missing controls.`);
  }

  contract.pauseContext = null;
  transition(contract, "RUNNING", "Execution started for the approved Contract.");
  appendStreamEvent({
    contractId: contract.id,
    phase: "run",
    event: "step.start",
    message: "Run started.",
  });

  const runDir = path.join(getContractArtifactsDir(contract.id), "run");
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
  } else if (options.dryRun) {
    result = {
      status: "completed",
      summary: "Dry-run completed. Execution was skipped; no workspace changes were applied.",
      outputs: {
        mode: "dry-run",
      },
      evidencePaths: [],
    };
  } else {
    result = await runWithNativeRunner(executionRequest, {
      provider: options.provider,
      model: options.model,
    });
  }

  const runnerSummary = result.summary;
  const claimedEvidencePaths = normalizeClaimedEvidencePaths(result.evidencePaths);
  const evidenceClassification = classifyClaimedEvidencePaths(claimedEvidencePaths, runDir);
  let evidenceValidationFailed = false;
  let failureReason: string | null = null;
  if (result.status === "completed" && !options.dryRun) {
    const logsRef = result.logsPath || "run-result.json";
    if (claimedEvidencePaths.length === 0) {
      failureReason = `Runner did not claim any evidence paths. See logs: ${logsRef}.`;
    } else if (evidenceClassification.outOfScopePaths.length > 0) {
      failureReason = `Runner claimed evidence outside allowed run directory: ${evidenceClassification.outOfScopePaths.join(
        ", "
      )}. See logs: ${logsRef}.`;
    } else if (evidenceClassification.missingPaths.length > 0) {
      failureReason = `Runner claimed evidence paths that do not exist: ${evidenceClassification.missingPaths.join(
        ", "
      )}. See logs: ${logsRef}.`;
    }
  }
  if (failureReason) {
    evidenceValidationFailed = true;
    result = {
      ...result,
      status: "failed",
      summary: failureReason,
      evidencePaths: evidenceClassification.validExistingPaths,
      outputs: {
        ...(result?.outputs && typeof result.outputs === "object" ? result.outputs : {}),
        claimedEvidencePaths,
        missingEvidencePaths: evidenceClassification.missingPaths,
        outOfScopeClaimedEvidencePaths: evidenceClassification.outOfScopePaths,
      },
      errors: {
        ...(result?.errors && typeof result.errors === "object" ? result.errors : {}),
        reason: failureReason,
        missingEvidencePaths: evidenceClassification.missingPaths,
        outOfScopeClaimedEvidencePaths: evidenceClassification.outOfScopePaths,
      },
    };
  } else {
    result = {
      ...result,
      evidencePaths: evidenceClassification.validExistingPaths,
      outputs: {
        ...(result?.outputs && typeof result.outputs === "object" ? result.outputs : {}),
        claimedEvidencePaths,
        missingEvidencePaths: evidenceClassification.missingPaths,
        outOfScopeClaimedEvidencePaths: evidenceClassification.outOfScopePaths,
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
    missingEvidencePaths: evidenceClassification.missingPaths,
    claimedEvidencePaths,
    outOfScopeClaimedEvidencePaths: evidenceClassification.outOfScopePaths,
    logsPath: result.logsPath || null,
  });
  appendRunArtifacts(contract, { requestPath, resultPath, result });

  if (result.status === "completed") {
    transition(contract, "COMPLETED", `Execution completed via native runner. ${result.summary}`);
    appendStreamEvent({
      contractId: contract.id,
      phase: "run",
      event: "step.done",
      message: "Run completed.",
      data: {
        status: result.status,
      },
    });
  } else {
    transition(contract, "FAILED", `Execution failed via native runner. Reason: "${failureReason}".`);
    appendStreamEvent({
      contractId: contract.id,
      phase: "run",
      level: "error",
      event: "summary",
      message: `Run failed: ${failureReason || result.summary || "unknown reason"}`,
    });
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
    missingEvidencePaths: evidenceClassification.missingPaths,
    claimedEvidencePaths,
    outOfScopeClaimedEvidencePaths: evidenceClassification.outOfScopePaths,
    evidenceValidationFailed,
  };
}

export async function resumeContract(_contract: any) {
  throw new Error("Resume is not supported for the native runner yet.");
}
