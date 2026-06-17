import { NextResponse } from "next/server";
import { rewriteSetCookieForProxy, isSecureRequest } from "@/core/cookies";

// Same-origin login proxy. The default `/api/*` rewrite in next.config.ts is a
// transparent pass-through and cannot transform headers — but the backend's
// session cookie needs its attributes relaxed to survive over http://localhost
// (see core/cookies.ts). So this one route handler shadows the rewrite for
// `/api/auth/login`: it forwards the request to the backend, then re-emits the
// backend's Set-Cookie with proxy-friendly flags so the session actually
// persists and `@Secured` endpoints stop 401-ing right after login.
//
// Fail-safe: when the backend returns no Set-Cookie (e.g. a 401 for a bad
// token), the response is byte-for-byte what the rewrite would have produced.

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://localhost:8080";

export async function POST(req: Request) {
  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });
  } catch {
    return NextResponse.json(
      { error: "Bad Gateway", details: "The authentication backend is unreachable." },
      { status: 502 },
    );
  }

  const payload = await upstream.text();
  const res = new NextResponse(payload, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });

  const secure = isSecureRequest(req);
  for (const cookie of upstream.headers.getSetCookie()) {
    res.headers.append("set-cookie", rewriteSetCookieForProxy(cookie, secure));
  }
  return res;
}
