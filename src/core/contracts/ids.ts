const MAX_ID_LENGTH = 80;
const ID_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;
const RESERVED_CONTRACT_IDS = new Set(["help"]);

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function formatTimestampForId(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}`;
}

export function suggestContractId(intent: string) {
  const stamp = formatTimestampForId();
  const words = intent
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  const slugBase = slugify(words.join(" ")) || "contract";
  const maxSlugLength = Math.max(8, MAX_ID_LENGTH - stamp.length - 1);
  const slug = slugBase.slice(0, maxSlugLength);
  return `${slug}-${stamp}`.slice(0, MAX_ID_LENGTH);
}

export function validateContractId(id: string) {
  if (!id) {
    return "Contract id cannot be empty.";
  }
  if (RESERVED_CONTRACT_IDS.has(id)) {
    return `Contract id "${id}" is reserved.`;
  }
  if (id.length > MAX_ID_LENGTH) {
    return `Contract id must be ${MAX_ID_LENGTH} characters or fewer.`;
  }
  if (!ID_PATTERN.test(id)) {
    return "Contract id must use only lowercase letters, numbers, hyphens, or underscores.";
  }
  return null;
}
