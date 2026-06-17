// Helpers for re-emitting the backend's session cookie through the same-origin
// /api proxy so it actually persists in the browser during local development.
//
// The Mathify JAX-RS backend is configured for cross-site, credentialed calls
// (every response carries `Access-Control-Allow-Origin: *` +
// `Access-Control-Allow-Credentials: true`), which means its session cookie is
// almost certainly issued as `SameSite=None; Secure`. A `Secure` cookie is
// silently dropped by the browser over plain `http://localhost`, so the session
// never sticks — and every `@Secured` endpoint 401s immediately after a
// "successful" login. Because we proxy `/api/*` from the same origin, we can
// safely relax those attributes for the proxy hop without weakening anything.

/**
 * Rewrite one backend `Set-Cookie` header value so the browser will store it as
 * a first-party cookie on the proxy origin.
 *
 * - drops `Secure` when the proxy is being served over http (keeps it on https),
 * - downgrades `SameSite=None` to `Lax` (same-origin needs nothing stricter),
 * - strips any `Domain` so the cookie is host-only for the proxy origin.
 *
 * The cookie name, value, `Path`, `HttpOnly`, `Max-Age` and `Expires` are left
 * exactly as the backend set them, so a normal `JSESSIONID=…; Path=/; HttpOnly`
 * round-trips unchanged.
 */
export function rewriteSetCookieForProxy(setCookie: string, secureRequest: boolean): string {
  const parts = setCookie.split(";").map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  parts.forEach((part, i) => {
    if (i === 0) {
      out.push(part); // name=value
      return;
    }
    const lower = part.toLowerCase();
    if (lower === "secure") {
      if (secureRequest) out.push(part);
      return;
    }
    if (lower.startsWith("samesite=")) {
      out.push(lower.slice("samesite=".length) === "none" ? "SameSite=Lax" : part);
      return;
    }
    if (lower.startsWith("domain=")) return; // host-only on the proxy origin
    out.push(part);
  });
  return out.join("; ");
}

/** True when the inbound request reached the proxy over https. */
export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}
