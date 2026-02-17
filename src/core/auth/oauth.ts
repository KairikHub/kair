import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";

function resolveProviderOAuthConfig(provider: string) {
  const upper = provider.toUpperCase();
  const clientId = (process.env[`KAIR_${upper}_OAUTH_CLIENT_ID`] || "").trim();
  const clientSecret = (process.env[`KAIR_${upper}_OAUTH_CLIENT_SECRET`] || "").trim();
  const authorizeUrl = (
    process.env[`KAIR_${upper}_OAUTH_AUTHORIZE_URL`] ||
    (provider === "openai"
      ? "https://auth.openai.com/oauth/authorize"
      : "https://console.anthropic.com/oauth/authorize")
  ).trim();
  const tokenUrl = (
    process.env[`KAIR_${upper}_OAUTH_TOKEN_URL`] ||
    (provider === "openai"
      ? "https://auth.openai.com/oauth/token"
      : "https://console.anthropic.com/oauth/token")
  ).trim();

  if (!clientId) {
    throw new Error(`Missing KAIR_${upper}_OAUTH_CLIENT_ID for OAuth login.`);
  }

  return { clientId, clientSecret, authorizeUrl, tokenUrl };
}

function base64Url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createPkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function openBrowser(url: string) {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    return;
  }
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    return;
  }
  spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

async function waitForOAuthCode(port: number) {
  return await new Promise<{ code: string; state: string }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("OAuth callback timed out after 120 seconds."));
    }, 120_000);

    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
      const code = url.searchParams.get("code") || "";
      const state = url.searchParams.get("state") || "";
      if (!code || !state) {
        res.statusCode = 400;
        res.end("Missing OAuth code/state.");
        return;
      }
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end("<html><body><h1>Kair login complete.</h1><p>You can return to the terminal.</p></body></html>");
      clearTimeout(timeout);
      server.close();
      resolve({ code, state });
    });

    server.listen(port, "127.0.0.1", () => {
      // no-op
    });
  });
}

async function exchangeCodeForToken(params: {
  tokenUrl: string;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  codeVerifier: string;
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  });
  if (params.clientSecret) {
    body.set("client_secret", params.clientSecret);
  }

  const response = await fetch(params.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth token exchange failed (${response.status}): ${text.slice(0, 500)}`);
  }
  const parsed = await response.json();
  const token = String(parsed?.access_token || "").trim();
  if (!token) {
    throw new Error("OAuth token response did not include access_token.");
  }
  return token;
}

export async function runBrowserOAuth(provider: "openai" | "claude") {
  const config = resolveProviderOAuthConfig(provider);
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = createPkcePair();
  const port = Number(process.env.KAIR_OAUTH_CALLBACK_PORT || 53841);
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "openid profile email offline_access");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  openBrowser(authorizeUrl.toString());

  const callback = await waitForOAuthCode(port);
  if (callback.state !== state) {
    throw new Error("OAuth state mismatch; refusing token exchange.");
  }

  return await exchangeCodeForToken({
    tokenUrl: config.tokenUrl,
    code: callback.code,
    redirectUri,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    codeVerifier: verifier,
  });
}
