import * as fs from "node:fs";
import * as path from "node:path";

import { fail } from "../errors";
import { now } from "../time";
import { getAgentSoulPath } from "./paths";
import type { AgentRoutingConfig, AgentSoul, ArchitectAgentName } from "./types";

const AGENTS: ArchitectAgentName[] = ["architect", "critic", "integrator", "validator"];

function parseFrontmatter(raw: string) {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---\n")) {
    return { meta: {} as Record<string, string>, body: raw.trim() };
  }
  const secondMarker = trimmed.indexOf("\n---\n", 4);
  if (secondMarker < 0) {
    return { meta: {} as Record<string, string>, body: raw.trim() };
  }
  const frontmatterText = trimmed.slice(4, secondMarker).trim();
  const body = trimmed.slice(secondMarker + 5).trim();
  const meta: Record<string, string> = {};
  for (const line of frontmatterText.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key) {
      meta[key] = value;
    }
  }
  return { meta, body };
}

function toNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function loadAgentSoul(contractId: string, agentName: ArchitectAgentName, overrides?: {
  provider?: string;
  model?: string;
}) {
  const filePath = getAgentSoulPath(contractId, agentName);
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error: any) {
    if (error && error.code === "ENOENT") {
      fail(
        `Missing SOUL definition for agent "${agentName}" at ${filePath}. Run \`kair architect init-agents --contract ${contractId}\`.`
      );
    }
    throw error;
  }
  const { meta, body } = parseFrontmatter(raw);
  const provider = (overrides?.provider || meta.provider || "").trim();
  if (!provider) {
    fail(
      `Agent "${agentName}" is missing provider routing in ${filePath}. Add frontmatter: provider: <openai|claude|mock>.`
    );
  }
  const routing: AgentRoutingConfig = {
    provider,
    model: (overrides?.model || meta.model || "").trim() || undefined,
    baseUrl: (meta.base_url || "").trim() || undefined,
    temperature: toNumber(meta.temperature),
    maxTokens: toNumber(meta.max_tokens),
  };
  return {
    name: agentName,
    routing,
    prompt: body,
    filePath,
  } as AgentSoul;
}

export function loadArchitectSouls(contractId: string, overrides?: {
  provider?: string;
  model?: string;
}) {
  const output: Record<ArchitectAgentName, AgentSoul> = {
    architect: loadAgentSoul(contractId, "architect", overrides),
    critic: loadAgentSoul(contractId, "critic", overrides),
    integrator: loadAgentSoul(contractId, "integrator", overrides),
    validator: loadAgentSoul(contractId, "validator", overrides),
  };
  return output;
}

function defaultSoul(agent: ArchitectAgentName, provider: string, model?: string) {
  const header = [
    "---",
    `provider: ${provider}`,
    model ? `model: ${model}` : "",
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const prompts: Record<ArchitectAgentName, string> = {
    architect: [
      "You are the Architect agent.",
      "Generate or improve a kair.plan.v1 plan from intent.",
      "Favor milestone-based end-to-end task lists.",
      "Ensure each milestone has concrete verification steps.",
    ].join("\n"),
    critic: [
      "You are the Critic agent.",
      "Refine the current plan to close risks, gaps, and ambiguities.",
      "Enforce testability and explicit acceptance criteria.",
      "Preserve step ids where possible.",
    ].join("\n"),
    integrator: [
      "You are the Integrator agent.",
      "Merge prior agent improvements into a coherent end-to-end plan.",
      "Output should be implementation-ready with clear sequencing.",
      "Preserve prior valid work and remove contradictions.",
    ].join("\n"),
    validator: [
      "You are the Validator agent.",
      "Refine only if needed so the plan clearly includes milestone outcomes and validation steps.",
      "Do not reduce coverage; preserve mandatory gates and test steps.",
    ].join("\n"),
  };

  return `${header}\n${prompts[agent]}\n`;
}

export function initDefaultSouls(contractId: string, params: { provider: string; model?: string }) {
  const written: string[] = [];
  for (const agent of AGENTS) {
    const filePath = getAgentSoulPath(contractId, agent);
    if (fs.existsSync(filePath)) {
      continue;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, defaultSoul(agent, params.provider, params.model));
    written.push(filePath);
  }
  return {
    written,
    ts: now(),
  };
}
