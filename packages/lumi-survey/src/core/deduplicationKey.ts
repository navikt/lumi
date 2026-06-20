/**
 * Generates a deduplication key for submission idempotency.
 * Must match backend rules: 16-128 characters, pattern ^[A-Za-z0-9._:-]+$
 *
 * Uses crypto.randomUUID() which produces a v4 UUID (36 chars with hyphens).
 * Hyphens are allowed by the backend pattern, so UUID is used directly.
 */
export function generateDeduplicationKey(): string {
  return crypto.randomUUID();
}
