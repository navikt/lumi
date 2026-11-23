export function decodeJwtPayload(
  payload: string | undefined,
): Record<string, unknown> | null {
  if (!payload) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return claims && typeof claims === "object" && !Array.isArray(claims)
      ? claims
      : null;
  } catch {
    return null;
  }
}
