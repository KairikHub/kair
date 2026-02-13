import * as fs from "node:fs";
import * as path from "node:path";

import type { Plan } from "../plans/schema";
import { getArtifactsDir } from "../store/paths";
import { now } from "../time";
import { enforceControls } from "./controls";
import { assertState, transition } from "./history";
import { runWithOpenClaw } from "../runner/openclaw_runner";
import type { ExecutionRequest, RunnerResult } from "../runner/types";

export type RunContractOptions = {
  provider?: string;
  model?: string;
};

export type RunContractOutcome = {
  request: ExecutionRequest | null;
  requestPath: string;
  resultPath: string;
  result: RunnerResult;
  enabledTools: string[];
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

export async function runContract(
  contract: any,
  options: RunContractOptions = {}
): Promise<RunContractOutcome> {
  assertState(contract, ["APPROVED"], "run");
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

  writeJson(resultPath, {
    generated_at: now(),
    result,
  });
  appendRunArtifacts(contract, { requestPath, resultPath, result });

  if (result.status === "completed") {
    transition(contract, "COMPLETED", `Execution completed via OpenClaw runner. ${result.summary}`);
  } else {
    transition(contract, "FAILED", `Execution failed via OpenClaw runner. ${result.summary}`);
  }

  const enabledTools =
    Array.isArray(result?.outputs?.enabledTools) ? result.outputs.enabledTools.map((item: any) => String(item)) : [];

  return {
    request: executionRequest,
    requestPath,
    resultPath,
    result,
    enabledTools,
  };
}

export async function resumeContract(_contract: any) {
  throw new Error("Resume is not supported for OpenClaw runner yet.");
}
