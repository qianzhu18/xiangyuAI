import { NextResponse } from "next/server";
import {
  SECONDME_COOKIES,
  exchangeCodeForSecondMeToken,
  getSecondMeConfig,
  setSecondMeSessionCookies,
} from "@/lib/secondme";

export async function GET(request: Request) {
  const config = getSecondMeConfig();

  if (!config.enabled) {
    return NextResponse.redirect(new URL("/match?secondme=not-configured", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const stateCookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SECONDME_COOKIES.oauthState}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  const returnToCookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SECONDME_COOKIES.returnTo}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  const returnTo = decodeURIComponent(returnToCookie ?? "/match");

  if (error) {
    return NextResponse.redirect(new URL(`${returnTo}?secondme=oauth-error`, request.url));
  }

  if (!code || !state || !stateCookie || state !== decodeURIComponent(stateCookie)) {
    return NextResponse.redirect(new URL(`${returnTo}?secondme=state-mismatch`, request.url));
  }

  try {
    const tokenPayload = await exchangeCodeForSecondMeToken(code);
    const response = NextResponse.redirect(
      new URL(`${returnTo}?secondme=connected`, request.url),
    );

    setSecondMeSessionCookies(response, tokenPayload);
    response.cookies.delete(SECONDME_COOKIES.oauthState);
    response.cookies.delete(SECONDME_COOKIES.returnTo);

    return response;
  } catch {
    return NextResponse.redirect(new URL(`${returnTo}?secondme=token-failed`, request.url));
  }
}
