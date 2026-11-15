// Request proxy: rejects cross-origin state-changing requests and sets a nonce-based CSP.
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/server/security/csp";
import { isAllowedOrigin } from "@/server/security/origin";

export function proxy(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (
    !isAllowedOrigin(request.method, request.nextUrl.pathname, request.headers.get("origin"), host)
  ) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|labels/).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
