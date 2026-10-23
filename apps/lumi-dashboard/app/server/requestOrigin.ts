/**
 * The origin the browser sees for this request. TLS ends in front of the pod,
 * so the app gets plain HTTP with `X-Forwarded-Proto: https` from the ingress,
 * passed on by Wonderwall. Since srvx 1, `request.url` uses that header only
 * for trusted proxies, and Nitro cannot configure those yet, so the scheme is
 * read here. The host still comes from the Host header.
 */
export function getExpectedOrigin(request: Request): string {
  const url = new URL(request.url);
  if (request.headers.get("x-forwarded-proto") === "https") {
    url.protocol = "https:";
  }
  return url.origin;
}
