export type PlanLlmRequestMode = "generate" | "refine";

export type PlanLlmRequestMessage = {
  role: string;
  content: string;
};

export type PlanLlmRequestRecord = {
  provider: string;
  model: string;
  temperature: number;
  timestamp: string;
  contractId: string;
  mode: PlanLlmRequestMode;
  messages: PlanLlmRequestMessage[];
};

const DEFAULT_MAX_MESSAGE_LENGTH = 4000;
const REDACTED_API_KEY = "[REDACTED_API_KEY]";
const OPENAI_API_KEY_PATTERN = /sk-[A-Za-z0-9_-]{10,}/g;
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9._-]{10,}/gi;
const GENERIC_API_KEY_ASSIGNMENT_PATTERN = /(API_KEY\s*[:=]\s*)([^\s"'`]+)/gi;

function clampMaxMessageLength(raw?: number) {
  if (!Number.isFinite(raw)) {
    return DEFAULT_MAX_MESSAGE_LENGTH;
  }
  return Math.max(1, Math.floor(raw as number));
}

function redactKnownSecrets(input: string, secrets: string[]) {
  let output = input;
  for (const secret of secrets) {
    if (!secret) {
      continue;
    }
    output = output.split(secret).join(REDACTED_API_KEY);
  }
  return output;
}

function redactApiKeys(input: string) {
  let output = input.replace(OPENAI_API_KEY_PATTERN, REDACTED_API_KEY);
  output = output.replace(BEARER_TOKEN_PATTERN, `Bearer ${REDACTED_API_KEY}`);
  output = output.replace(
    GENERIC_API_KEY_ASSIGNMENT_PATTERN,
    (_match, prefix) => `${prefix}${REDACTED_API_KEY}`
  );
  return output;
}

function truncateMessage(input: string, maxMessageLength: number) {
  if (input.length <= maxMessageLength) {
    return input;
  }
  const truncatedCount = input.length - maxMessageLength;
  return `${input.slice(0, maxMessageLength)}...[TRUNCATED ${truncatedCount} chars]`;
}

export function sanitizePlanLlmRequestRecord(
  record: PlanLlmRequestRecord,
  options: { secrets?: string[]; maxMessageLength?: number } = {}
) {
  const secrets = (options.secrets || []).map((secret) => String(secret || "")).filter(Boolean);
  const maxMessageLength = clampMaxMessageLength(options.maxMessageLength);

  return {
    provider: String(record.provider || ""),
    model: String(record.model || ""),
    temperature: Number(record.temperature),
    timestamp: String(record.timestamp || ""),
    contractId: String(record.contractId || ""),
    mode: record.mode,
    messages: (record.messages || []).map((message) => {
      const role = String(message?.role || "");
      let content = String(message?.content || "");
      content = redactKnownSecrets(content, secrets);
      content = redactApiKeys(content);
      content = truncateMessage(content, maxMessageLength);
      return { role, content };
    }),
  } as PlanLlmRequestRecord;
}
