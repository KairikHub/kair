import { spawnSync } from "node:child_process";

function readGitActor() {
  try {
    const result = spawnSync("git", ["config", "user.name"], { encoding: "utf8" });
    if (result.status === 0) {
      const name = String(result.stdout || "").trim();
      if (name) {
        return name;
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

function readWhoAmI() {
  try {
    const result = spawnSync("whoami", [], { encoding: "utf8" });
    if (result.status === 0) {
      const name = String(result.stdout || "").trim();
      if (name) {
        return name;
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

export function resolveActor(explicit?: string) {
  const explicitActor = (explicit || "").trim();
  if (explicitActor) {
    return explicitActor;
  }
  const envActor = (process.env.KAIRIK_ACTOR || "").trim();
  if (envActor) {
    return envActor;
  }
  const gitActor = readGitActor();
  if (gitActor) {
    return gitActor;
  }
  const envUser = (process.env.USER || process.env.USERNAME || "").trim();
  if (envUser) {
    return envUser;
  }
  const whoami = readWhoAmI();
  if (whoami) {
    return whoami;
  }
  return "unknown";
}

