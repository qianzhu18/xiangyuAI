import { randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";

export type SecondMeTokenPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope: string[];
};

export type SecondMeSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
};

export type SecondMeContext = {
  connected: boolean;
  userInfo: Record<string, unknown> | null;
  shades: unknown[];
  softMemories: Array<Record<string, unknown>>;
};

type CookieStoreLike = {
  get: (name: string) => { value: string } | undefined;
};

export const SECONDME_COOKIES = {
  accessToken: "yue_sm_at",
  refreshToken: "yue_sm_rt",
  expiresAt: "yue_sm_exp",
  scope: "yue_sm_scope",
  oauthState: "yue_sm_state",
  returnTo: "yue_sm_return_to",
};

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

export function getSecondMeConfig() {
  const clientId = process.env.SECONDME_CLIENT_ID;
  const clientSecret = process.env.SECONDME_CLIENT_SECRET;
  const oauthBaseUrl =
    process.env.SECONDME_OAUTH_BASE_URL ?? "https://api.mindverse.com/gate/lab";
  const apiBaseUrl =
    process.env.SECONDME_API_BASE_URL ?? "https://api.mindverse.com/gate/lab";
  const redirectUri =
    process.env.SECONDME_REDIRECT_URI ??
    "http://localhost:3002/api/secondme/oauth/callback";
  const appId = process.env.SECONDME_APP_ID ?? "general";

  return {
    enabled: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    oauthBaseUrl,
    apiBaseUrl,
    redirectUri,
    appId,
  };
}

export function buildSecondMeAuthUrl(state: string) {
  const config = getSecondMeConfig();
  const params = new URLSearchParams({
    client_id: config.clientId ?? "",
    redirect_uri: config.redirectUri,
    response_type: "code",
    state,
  });

  return `https://go.second.me/oauth/?${params.toString()}`;
}

export function buildSecondMeState() {
  return randomUUID();
}

export function readSecondMeSession(cookieStore: CookieStoreLike): SecondMeSession | null {
  const accessToken = cookieStore.get(SECONDME_COOKIES.accessToken)?.value;
  const refreshToken = cookieStore.get(SECONDME_COOKIES.refreshToken)?.value;
  const expiresAtRaw = cookieStore.get(SECONDME_COOKIES.expiresAt)?.value;
  const scopeRaw = cookieStore.get(SECONDME_COOKIES.scope)?.value;

  if (!accessToken || !refreshToken) {
    return null;
  }

  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : Date.now() + 60 * 60 * 1000;
  const scope = scopeRaw ? scopeRaw.split(",").filter(Boolean) : [];

  return {
    accessToken,
    refreshToken,
    expiresAt,
    scope,
  };
}

export function setSecondMeSessionCookies(
  response: NextResponse,
  payload: SecondMeTokenPayload,
) {
  const maxAge = Math.max(60, payload.expiresIn);
  const expiresAt = Date.now() + maxAge * 1000;

  response.cookies.set(SECONDME_COOKIES.accessToken, payload.accessToken, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  response.cookies.set(SECONDME_COOKIES.refreshToken, payload.refreshToken, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  response.cookies.set(SECONDME_COOKIES.expiresAt, String(expiresAt), {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  response.cookies.set(SECONDME_COOKIES.scope, payload.scope.join(","), {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSecondMeSessionCookies(response: NextResponse) {
  response.cookies.delete(SECONDME_COOKIES.accessToken);
  response.cookies.delete(SECONDME_COOKIES.refreshToken);
  response.cookies.delete(SECONDME_COOKIES.expiresAt);
  response.cookies.delete(SECONDME_COOKIES.scope);
  response.cookies.delete(SECONDME_COOKIES.oauthState);
  response.cookies.delete(SECONDME_COOKIES.returnTo);
}

export async function exchangeCodeForSecondMeToken(code: string) {
  const config = getSecondMeConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error("SECONDME_OAUTH_NOT_CONFIGURED");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(`${config.oauthBaseUrl}/api/oauth/token/code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        code?: number;
        message?: string;
        data?: {
          accessToken?: string;
          refreshToken?: string;
          expiresIn?: number;
          tokenType?: string;
          scope?: string[];
        };
      }
    | null;

  if (!response.ok || payload?.code !== 0 || !payload?.data?.accessToken) {
    throw new Error(payload?.message ?? "SECONDME_EXCHANGE_TOKEN_FAILED");
  }

  return {
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken ?? "",
    expiresIn: payload.data.expiresIn ?? 7200,
    tokenType: payload.data.tokenType ?? "Bearer",
    scope: payload.data.scope ?? [],
  } satisfies SecondMeTokenPayload;
}

export async function refreshSecondMeToken(refreshToken: string) {
  const config = getSecondMeConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error("SECONDME_OAUTH_NOT_CONFIGURED");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(`${config.oauthBaseUrl}/api/oauth/token/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        code?: number;
        message?: string;
        data?: {
          accessToken?: string;
          refreshToken?: string;
          expiresIn?: number;
          tokenType?: string;
          scope?: string[];
        };
      }
    | null;

  if (!response.ok || payload?.code !== 0 || !payload?.data?.accessToken) {
    throw new Error(payload?.message ?? "SECONDME_REFRESH_TOKEN_FAILED");
  }

  return {
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken ?? refreshToken,
    expiresIn: payload.data.expiresIn ?? 7200,
    tokenType: payload.data.tokenType ?? "Bearer",
    scope: payload.data.scope ?? [],
  } satisfies SecondMeTokenPayload;
}

export async function secondMeApiJson(
  path: string,
  accessToken: string,
  init?: RequestInit,
) {
  const config = getSecondMeConfig();

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        code?: number;
        message?: string;
        subCode?: string;
        data?: unknown;
      }
    | null;

  return {
    response,
    payload,
  };
}

export function isSecondMeTokenExpired(
  responseStatus: number,
  payload?: { subCode?: string; message?: string } | null,
) {
  if (responseStatus === 401) {
    return true;
  }

  const subCode = payload?.subCode ?? "";
  const message = payload?.message ?? "";

  return (
    subCode.includes("oauth2.token.expired") ||
    subCode.includes("oauth2.refresh_token") ||
    message.toLowerCase().includes("token")
  );
}

export async function secondMeChatOnce(
  accessToken: string,
  body: {
    message: string;
    sessionId?: string;
    systemPrompt?: string;
    model?: string;
    enableWebSearch?: boolean;
  },
) {
  const config = getSecondMeConfig();

  const response = await fetch(`${config.apiBaseUrl}/api/secondme/chat/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-App-Id": config.appId,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`SECONDME_CHAT_FAILED:${response.status}:${text.slice(0, 120)}`);
  }

  const streamText = await response.text();
  const lines = streamText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let sessionId = body.sessionId;
  let text = "";

  for (const line of lines) {
    if (!line.startsWith("data:")) {
      continue;
    }

    const dataPart = line.slice(5).trim();

    if (dataPart === "[DONE]") {
      continue;
    }

    try {
      const json = JSON.parse(dataPart) as {
        sessionId?: string;
        choices?: Array<{ delta?: { content?: string } }>;
      };

      if (json.sessionId) {
        sessionId = json.sessionId;
      }

      const deltaText = json.choices?.[0]?.delta?.content;
      if (deltaText) {
        text += deltaText;
      }
    } catch {
      continue;
    }
  }

  return {
    sessionId,
    text: text.trim(),
  };
}

export async function loadSecondMeContextFromAccessToken(
  accessToken: string,
): Promise<SecondMeContext> {
  const [infoResult, shadesResult, memoryResult] = await Promise.all([
    secondMeApiJson("/api/secondme/user/info", accessToken),
    secondMeApiJson("/api/secondme/user/shades", accessToken),
    secondMeApiJson("/api/secondme/user/softmemory?pageNo=1&pageSize=20", accessToken),
  ]);

  const userInfo =
    infoResult.payload?.code === 0 &&
    infoResult.payload.data &&
    typeof infoResult.payload.data === "object"
      ? (infoResult.payload.data as Record<string, unknown>)
      : null;

  const shadesData =
    shadesResult.payload?.code === 0 && shadesResult.payload.data
      ? shadesResult.payload.data
      : [];

  const memoryData =
    memoryResult.payload?.code === 0 &&
    memoryResult.payload.data &&
    typeof memoryResult.payload.data === "object"
      ? ((memoryResult.payload.data as { list?: unknown[] }).list ?? [])
      : [];

  return {
    connected: Boolean(userInfo),
    userInfo,
    shades: Array.isArray(shadesData) ? shadesData : [],
    softMemories: Array.isArray(memoryData)
      ? (memoryData as Array<Record<string, unknown>>)
      : [],
  };
}
