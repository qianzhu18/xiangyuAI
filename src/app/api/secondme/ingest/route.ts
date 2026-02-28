import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isSecondMeTokenExpired,
  readSecondMeSession,
  refreshSecondMeToken,
  secondMeApiJson,
  setSecondMeSessionCookies,
} from "@/lib/secondme";

const ingestSchema = z.object({
  action: z.string().min(1),
  displayText: z.string().min(1),
  eventDesc: z.string().min(1),
  refs: z.array(z.string()).optional(),
  importance: z.number().min(0).max(10).optional(),
  payload: z.record(z.string(), z.any()).optional(),
  startTimestamp: z.number().int().optional(),
  chatId: z.string().optional(),
  channel: z.enum(["Chat", "Feed", "App"]).optional(),
});

async function postIngest(accessToken: string, body: unknown) {
  return secondMeApiJson("/api/secondme/agent_memory/ingest", accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => ({}));
  const parsed = ingestSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 400 });
  }

  const session = readSecondMeSession(request.cookies);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "not_connected" }, { status: 200 });
  }

  let result = await postIngest(session.accessToken, parsed.data);
  let refreshedPayload: Awaited<ReturnType<typeof refreshSecondMeToken>> | null = null;

  if (
    (result.payload?.code ?? -1) !== 0 &&
    isSecondMeTokenExpired(result.response.status, result.payload) &&
    session.refreshToken
  ) {
    try {
      refreshedPayload = await refreshSecondMeToken(session.refreshToken);
      result = await postIngest(refreshedPayload.accessToken, parsed.data);
    } catch {
      refreshedPayload = null;
    }
  }

  const response = NextResponse.json(
    {
      ok: (result.payload?.code ?? -1) === 0,
      data: result.payload?.data ?? null,
      message: result.payload?.message ?? null,
    },
    { status: 200 },
  );

  if (refreshedPayload) {
    setSecondMeSessionCookies(response, refreshedPayload);
  }

  return response;
}
