import { beforeEach, describe, expect, it, vi } from "vitest";
import { redactFeedbackServerFn } from "../redactFeedback";

const doubles = vi.hoisted(() => ({
  request: vi.fn(),
  mock: vi.fn(),
  mockMode: false,
  env: {} as { NAIS_CLUSTER_NAME?: string },
  context: { backendUrl: "https://backend.example", oboToken: "delegated" },
}));
vi.mock("@tanstack/react-start", () => ({
  getGlobalStartContext: () => ({ serverFnHttpCall: true }),
  createServerFn: () => ({
    middleware: () => ({
      validator: () => ({
        handler:
          (
            handler: (input: {
              data: unknown;
              context: typeof doubles.context;
            }) => Promise<unknown>,
          ) =>
          (input: { data: unknown }) =>
            handler({ ...input, context: doubles.context }),
      }),
    }),
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({ setResponseStatus: vi.fn() }));
vi.mock("~/server/middleware/auth", () => ({ authMiddleware: {} }));
vi.mock("~/server/lumiApiFetch", () => ({ lumiApiFetch: doubles.request }));
vi.mock("~/serverEnv", () => ({ serverEnv: doubles.env }));
vi.mock("~/server/utils", async (original) => ({
  ...(await original<typeof import("~/server/utils")>()),
  isMockMode: () => doubles.mockMode,
}));
vi.mock("~/server/actions/fetchFilterBootstrap", () => ({
  assertMockTeamAccess: vi.fn(),
}));
vi.mock("~/mock/mockData", () => ({ redactMockFeedback: doubles.mock }));

const input = {
  id: "id/with slash",
  team: "team-test",
  fieldId: "comment",
  expectedTextHash: "a".repeat(64),
  ranges: [{ start: 3, end: 8 }],
};
beforeEach(() => {
  vi.clearAllMocks();
  doubles.mockMode = false;
  delete doubles.env.NAIS_CLUSTER_NAME;
  doubles.request.mockResolvedValue(new Response(null, { status: 204 }));
});

describe("permanent text masking transport", () => {
  it("uses the delegated token and explicit team and sends no original or replacement text", async () => {
    await expect(redactFeedbackServerFn({ data: input })).resolves.toEqual({
      success: true,
    });
    const { id: _id, team: _team, ...body } = input;
    expect(doubles.request).toHaveBeenCalledExactlyOnceWith(
      "https://backend.example/api/v1/intern/feedback/id%2Fwith%20slash/redact?team=team-test",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer delegated",
        },
        body: JSON.stringify(body),
      },
    );
  });
  it("keeps a conflict as an API error rather than reporting success", async () => {
    doubles.request.mockResolvedValue(
      Response.json(
        {
          status: 409,
          type: "CONFLICT",
          message: "Svaret er endret",
          timestamp: "2026-10-28T15:00:00Z",
        },
        { status: 409 },
      ),
    );
    await expect(redactFeedbackServerFn({ data: input })).rejects.toMatchObject(
      { error: { status: 409 } },
    );
  });
  it("refuses writes in the public mock demo before calling a store or backend", async () => {
    doubles.mockMode = true;
    doubles.env.NAIS_CLUSTER_NAME = "dev-gcp";
    await expect(redactFeedbackServerFn({ data: input })).rejects.toMatchObject(
      { status: 403 },
    );
    expect(doubles.request).not.toHaveBeenCalled();
    expect(doubles.mock).not.toHaveBeenCalled();
  });
});
