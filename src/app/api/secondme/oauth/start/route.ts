import { NextResponse } from "next/server";
import {
  SECONDME_COOKIES,
  buildSecondMeAuthUrl,
  buildSecondMeState,
  getSecondMeConfig,
} from "@/lib/secondme";

export async function GET(request: Request) {
  const config = getSecondMeConfig();

  if (!config.enabled) {
    return NextResponse.json(
      {
        error: "SECONDME_NOT_CONFIGURED",
      },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/match";
  const state = buildSecondMeState();
  const authUrl = buildSecondMeAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(SECONDME_COOKIES.oauthState, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  response.cookies.set(SECONDME_COOKIES.returnTo, returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
