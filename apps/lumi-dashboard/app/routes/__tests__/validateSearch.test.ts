import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { routeTree } from "~/routeTree.gen";

type Validate = (value: unknown) => unknown;

/**
 * The validate function of a Standard Schema, such as a zod 4 schema. Routes
 * with another kind of validateSearch are left out.
 */
function standardValidate(validator: unknown): Validate | undefined {
  if (
    (typeof validator !== "object" && typeof validator !== "function") ||
    validator === null ||
    !("~standard" in validator)
  ) {
    return undefined;
  }
  const standard = validator["~standard"] as { validate?: unknown };
  return typeof standard.validate === "function"
    ? (standard.validate as Validate)
    : undefined;
}

function shapeKeys(schema: unknown): string[] {
  if (schema instanceof z.ZodPipe) return shapeKeys(schema.in);
  if (schema instanceof z.ZodObject) return Object.keys(schema.shape);
  return [];
}

const searchValidators = Object.values(createRouter({ routeTree }).routesById)
  .map((route) => {
    const validator = (route.options as { validateSearch?: unknown })
      .validateSearch;
    return {
      id: route.id,
      validate: standardValidate(validator),
      keys: shapeKeys(validator),
    };
  })
  .filter(
    (route): route is { id: string; validate: Validate; keys: string[] } =>
      route.validate !== undefined,
  );

const hugeString = "a".repeat(1_000_000);

/** Values a hand-written address, a bad link or a script could pass. */
const garbageValues: unknown[] = [
  undefined,
  null,
  true,
  0,
  -1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  10n,
  "",
  " ",
  "foo",
  "123",
  hugeString,
  [],
  ["a", 1],
  [[["nested"]]],
  {},
  { nested: { deeper: [1, { x: "y" }] } },
  JSON.parse('{"__proto__": {"polluted": true}}'),
  JSON.parse('{"toString": 1, "valueOf": 2, "constructor": 3}'),
  Object.create(null),
  () => "function",
  Symbol("search"),
];

function garbageSearches(keys: string[]): unknown[] {
  const searches: unknown[] = [...garbageValues];
  const allKeys = [...keys, "__proto__", "constructor", "toString"];
  for (const value of garbageValues) {
    searches.push(Object.fromEntries(allKeys.map((key) => [key, value])));
    for (const key of allKeys) {
      const search = Object.fromEntries([[key, value]]);
      searches.push(search);
      // The router's own parser gives objects without a prototype.
      searches.push(Object.assign(Object.create(null), search));
    }
  }
  return searches;
}

function describeSearch(search: unknown): string {
  if (typeof search !== "object" || search === null) return typeof search;
  return Object.entries(search)
    .map(([key, value]) => `${key}: ${typeof value}`)
    .join(", ");
}

describe("validateSearch", () => {
  it("covers the routes that validate search params", () => {
    expect(searchValidators.map((route) => route.id)).toEqual(
      expect.arrayContaining([
        "/",
        "/feedback",
        "/export",
        "/survey-preview",
        "/surveyverksted/",
        "/analyseprodukter",
      ]),
    );
  });

  // Since zod 4 schemas go straight into validateSearch, the router calls
  // ~standard.validate. It must answer synchronously: the router refuses a
  // Promise with "Async validation not supported", and nothing handles the
  // Promise.
  it.each(searchValidators)(
    "$id answers garbage synchronously and never throws",
    ({ validate, keys }) => {
      const failures: string[] = [];
      for (const search of garbageSearches(keys)) {
        try {
          const result = validate(search);
          if (result instanceof Promise) {
            result.catch(() => undefined);
            failures.push(`Promise for { ${describeSearch(search)} }`);
          }
        } catch (error) {
          failures.push(
            `Threw ${String(error)} for { ${describeSearch(search)} }`,
          );
        }
      }
      expect(failures).toEqual([]);
    },
  );

  it("would catch a schema that throws while parsing", async () => {
    const throwing = z.object({ team: z.string() }).transform(() => {
      throw new Error("boom");
    });

    const result = throwing["~standard"].validate({ team: "flex" });

    expect(result).toBeInstanceOf(Promise);
    await expect(result).rejects.toThrow("boom");
  });
});
