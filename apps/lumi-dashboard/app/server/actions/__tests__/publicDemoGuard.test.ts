import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_DEMO_READ_ONLY_MESSAGE } from "~/utils/publicDemo";

const doubles = vi.hoisted(() => ({
  setResponseStatus: vi.fn(),
  context: { backendUrl: "https://backend.example", oboToken: null },
}));

// Every server function records its HTTP method, so the test can find the
// writes without a list that has to be kept up to date by hand.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: (options?: { method?: string }) => {
    const method = options?.method ?? "GET";
    const builder = {
      middleware: () => builder,
      validator: () => builder,
      handler: (
        fn: (input: {
          data: unknown;
          context: typeof doubles.context;
        }) => Promise<unknown>,
      ) =>
        Object.assign(
          (input: { data?: unknown } = {}) =>
            fn({ data: input.data ?? {}, context: doubles.context }),
          { serverFnMethod: method },
        ),
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  setResponseStatus: doubles.setResponseStatus,
}));
vi.mock("~/server/middleware/auth", () => ({ authMiddleware: {} }));
vi.mock("~/serverEnv", () => ({
  serverEnv: { NAIS_CLUSTER_NAME: "dev-gcp" },
}));
vi.mock("~/server/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/utils")>()),
  isMockMode: () => true,
  mockDelay: async () => undefined,
}));

/**
 * POST functions that are allowed to run in the public demo. A new write
 * belongs here only if it cannot change what other visitors see.
 */
const ALLOWED_IN_DEMO: Record<string, string> = {
  exportServerFn: "builds a file from the answers and stores nothing",
  submitReleaseVerificationServerFn:
    "already refuses in mock mode, which the demo always runs in",
};

type ServerFn = ((input?: { data?: unknown }) => Promise<unknown>) & {
  serverFnMethod: string;
};

function isServerFn(value: unknown): value is ServerFn {
  return typeof value === "function" && "serverFnMethod" in value;
}

const modules = import.meta.glob<Record<string, unknown>>([
  "../*.ts",
  "!../index.ts",
]);
const serverFns: Array<{ name: string; fn: ServerFn }> = [];
for (const load of Object.values(modules)) {
  for (const [name, value] of Object.entries(await load())) {
    if (isServerFn(value)) serverFns.push({ name, fn: value });
  }
}
const writes = serverFns.filter(({ fn }) => fn.serverFnMethod === "POST");
const guardedWrites = writes.filter(({ name }) => !(name in ALLOWED_IN_DEMO));

beforeEach(() => {
  doubles.setResponseStatus.mockClear();
});

describe("every write in server/actions", () => {
  it("finds the server functions", () => {
    expect(serverFns.length).toBeGreaterThan(20);
    expect(guardedWrites.length).toBeGreaterThan(10);
  });

  it("lists only exceptions that still exist as writes", () => {
    const writeNames = writes.map(({ name }) => name);
    for (const name of Object.keys(ALLOWED_IN_DEMO)) {
      expect(writeNames).toContain(name);
    }
  });

  it("keeps release verification closed in the demo", async () => {
    const release = writes.find(
      ({ name }) => name === "submitReleaseVerificationServerFn",
    );
    await expect(release?.fn()).rejects.toThrow(
      "Release-verifikasjon er bare tilgjengelig i dev",
    );
  });

  it.each(
    guardedWrites.map(({ name, fn }) => [name, fn] as const),
  )("%s is refused in the public demo", async (_name, fn) => {
    await expect(fn()).rejects.toThrow(PUBLIC_DEMO_READ_ONLY_MESSAGE);
    expect(doubles.setResponseStatus).toHaveBeenCalledExactlyOnceWith(403);
  });
});
