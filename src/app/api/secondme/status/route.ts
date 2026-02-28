import { NextRequest, NextResponse } from "next/server";
import {
  getSecondMeConfig,
  isSecondMeTokenExpired,
  loadSecondMeContextFromAccessToken,
  readSecondMeSession,
  refreshSecondMeToken,
  secondMeApiJson,
  setSecondMeSessionCookies,
} from "@/lib/secondme";

async function loadStatus(accessToken: string) {
  const userInfoResult = await secondMeApiJson("/api/secondme/user/info", accessToken);

  if (
    userInfoResult.payload?.code === 0 &&
    userInfoResult.payload.data &&
    typeof userInfoResult.payload.data === "object"
  ) {
    const context = await loadSecondMeContextFromAccessToken(accessToken);
    return {
      ok: true,
      context,
      unauthorized: false,
    };
  }

  return {
    ok: false,
    context: null,
    unauthorized: isSecondMeTokenExpired(
      userInfoResult.response.status,
      userInfoResult.payload,
    ),
  };
}

export async function GET(request: NextRequest) {
  const config = getSecondMeConfig();

  if (!config.enabled) {
    return NextResponse.json(
      {
        configured: false,
        connected: false,
      },
      { status: 200 },
    );
  }

  const session = readSecondMeSession(request.cookies);

  if (!session) {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
      },
      { status: 200 },
    );
  }

  let status = await loadStatus(session.accessToken);
  let refreshed = false;
  let refreshedPayload:
    | Awaited<ReturnType<typeof refreshSecondMeToken>>
    | null = null;

  if (!status.ok && status.unauthorized && session.refreshToken) {
    try {
      refreshedPayload = await refreshSecondMeToken(session.refreshToken);
      status = await loadStatus(refreshedPayload.accessToken);
      refreshed = status.ok;
    } catch {
      refreshed = false;
    }
  }

  if (!status.ok || !status.context) {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
      },
      { status: 200 },
    );
  }

  const response = NextResponse.json(
    {
      configured: true,
      connected: true,
      userInfo: status.context.userInfo,
      shadesCount: status.context.shades.length,
      memoryCount: status.context.softMemories.length,
      memories: status.context.softMemories.slice(0, 5),
    },
    { status: 200 },
  );

  if (refreshed && refreshedPayload) {
    setSecondMeSessionCookies(response, refreshedPayload);
  }

  return response;
}
