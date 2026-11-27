/**
 * The value an object holds under a key of its own. Answers and metadata are
 * plain objects, and a question id or a metadata key such as `constructor` or
 * `toString` names a property every object inherits. That is no answer.
 * Without an object, as when plain JavaScript passes `null` as metadata, there
 * is no value either.
 */
export function ownValue<T>(
  record: Readonly<Record<string, T>> | null | undefined,
  key: string,
): T | undefined {
  return record != null && Object.hasOwn(record, key) ? record[key] : undefined;
}

/**
 * Sets a key of the object's own. Assigning to `__proto__` would change the
 * object's prototype instead.
 */
export function setOwnValue<T>(
  record: Record<string, T>,
  key: string,
  value: T,
): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}
