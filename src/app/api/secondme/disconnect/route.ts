import { NextResponse } from "next/server";
import { clearSecondMeSessionCookies } from "@/lib/secondme";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  clearSecondMeSessionCookies(response);
  return response;
}
