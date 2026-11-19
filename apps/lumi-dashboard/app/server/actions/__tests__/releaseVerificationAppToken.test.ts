import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "~/server/middleware/auth";
import {
  fetchReleaseVerificationRunServerFn,
  submitAppTokenProbeServerFn,
} from "../releaseVerification";

const surveyId = "lumi-release-verification-20261119-8a0dc3b1";
const receiptId = "43c7c910-27ab-4c0e-bf41-c269f15f0367";
const azpName = "dev-gcp:team-esyfo:lumi-dashboard";
const doubles = vi.hoisted(() => ({
  request: vi.fn(),
  issueToken: vi.fn(),
  env: {
    NAIS_CLUSTER_NAME: "dev-gcp" as string | undefined,
    LUMI_LOCAL_AUTH_BYPASS: "true",
    LUMI_API_AUDIENCE: "api://dev-gcp.team-esyfo.lumi-api/.default",
  },
  context: { backendUrl: "http://lumi-api", oboToken: "delegated" },
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: (middleware: unknown[]) => {
      const handler = (
        fn: (args: {
          data: unknown;
          context: typeof doubles.context;
        }) => unknown,
      ) =>
        Object.assign(
          (args: { data: unknown }) =>
            fn({ ...args, context: doubles.context }),
          { middleware },
        );
      return { handler, validator: () => ({ handler }) };
    },
  }),
}));
vi.mock("~/server/middleware/auth", () => ({ authMiddleware: {} }));
vi.mock("~/server/lumiApiFetch", () => ({ lumiApiFetch: doubles.request }));
vi.mock("~/serverEnv", () => ({ serverEnv: doubles.env }));
vi.mock("~/server/utils", async (original) => ({
  ...(await original<typeof import("~/server/utils")>()),
  isMockMode: () => false,
}));
vi.mock("@navikt/oasis", () => ({
  requestAzureClientCredentialsToken: doubles.issueToken,
}));

function tokenFor(claims: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}
const claims = {
  azp_name: azpName,
  idtyp: "app",
  roles: ["access_as_application"],
  name: "private value",
};

const readback = {
  id: receiptId,
  surveyId,
  submittedAt: "2026-11-19T10:00:00Z",
  app: "lumi-dashboard",
  surveyType: "rating",
  context: {
    tags: {
      purpose: "release-verification",
      phase: "app-token",
      channel: "azure-client-credentials",
    },
  },
  answers: [
    {
      fieldId: "rating",
      fieldType: "RATING",
      value: { type: "rating", rating: 4 },
    },
    {
      fieldId: "control-code",
      fieldType: "SINGLE_CHOICE",
      value: { type: "singleChoice", selectedOptionId: "rv-8a0dc3b1" },
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  doubles.env.NAIS_CLUSTER_NAME = "dev-gcp";
  doubles.issueToken.mockResolvedValue({ ok: true, token: tokenFor(claims) });
});

describe("innsending med app-token", () => {
  it("uses OBO for team access and exact readback, and the app token only for submission", async () => {
    doubles.request
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({ id: receiptId }, { status: 201 }))
      .mockResolvedValueOnce(Response.json(readback));
    expect(submitAppTokenProbeServerFn).toHaveProperty("middleware", [
      authMiddleware,
    ]);
    const evidence = await submitAppTokenProbeServerFn({ data: { surveyId } });
    expect(doubles.issueToken).toHaveBeenCalledExactlyOnceWith(
      doubles.env.LUMI_API_AUDIENCE,
    );
    const [preflight, post, read] = doubles.request.mock.calls;
    expect(new URL(preflight[0]).searchParams.get("team")).toBe("team-esyfo");
    expect(preflight[1].headers.Authorization).toBe("Bearer delegated");
    expect(post[0]).toBe("http://lumi-api/api/azure/v1/feedback");
    expect(post[1]).toMatchObject({
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenFor(claims)}`,
        "X-Correlation-ID": `${surveyId}-app-token`,
      },
    });
    expect(JSON.parse(post[1].body)).toMatchObject({
      surveyId,
      context: readback.context,
      deduplicationKey: `${surveyId}-app-token`,
      answers: readback.answers,
    });
    expect(read[0]).toBe(
      `http://lumi-api/api/v1/intern/feedback/${receiptId}?team=team-esyfo`,
    );
    expect(read[1].headers.Authorization).toBe("Bearer delegated");
    expect(evidence).toMatchObject({
      status: "verified",
      phase: "app-token",
      receiptId,
    });
    for (const sensitive of [tokenFor(claims), claims.name, "delegated"]) {
      expect(JSON.stringify(evidence)).not.toContain(sensitive);
      expect(post[1].body).not.toContain(sensitive);
    }
  });

  it.each(["prod-gcp", undefined])(
    "refuses token acquisition outside dev-gcp (%s)",
    async (cluster) => {
      doubles.env.NAIS_CLUSTER_NAME = cluster;
      await expect(
        submitAppTokenProbeServerFn({ data: { surveyId } }),
      ).rejects.toThrow();
      expect(doubles.issueToken).not.toHaveBeenCalled();
      expect(doubles.request).not.toHaveBeenCalled();
    },
  );
  it.each([403, 503])(
    "stops before token acquisition on preflight HTTP %i",
    async (status) => {
      doubles.request.mockResolvedValueOnce(new Response(null, { status }));
      await expect(
        submitAppTokenProbeServerFn({ data: { surveyId } }),
      ).rejects.toThrow();
      expect(doubles.issueToken).not.toHaveBeenCalled();
      expect(doubles.request).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    [{ ...claims, azp_name: undefined }, "azp_name mangler"],
    [
      { ...claims, azp_name: "private value" },
      "azp_name avviker fra dashboardets navn",
    ],
    [{ ...claims, idtyp: undefined }, "idtyp mangler"],
    [
      { ...claims, roles: ["private value"] },
      "roles mangler access_as_application",
    ],
  ] as const)(
    "reports only the failed claim check",
    async (payload, message) => {
      doubles.request.mockResolvedValueOnce(Response.json({}));
      doubles.issueToken.mockResolvedValueOnce({
        ok: true,
        token: tokenFor(payload),
      });
      await expect(
        submitAppTokenProbeServerFn({ data: { surveyId } }),
      ).rejects.toMatchObject({ message });
      expect(doubles.request).toHaveBeenCalledTimes(1);
    },
  );
  it("does not forward token acquisition errors or backend response bodies", async () => {
    doubles.request.mockResolvedValue(Response.json({}));
    doubles.issueToken.mockRejectedValueOnce(new Error("private value"));
    await expect(
      submitAppTokenProbeServerFn({ data: { surveyId } }),
    ).rejects.toThrow(/^Kunne ikke hente app-token fra Entra ID\.$/);
    doubles.request
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(new Response("private value", { status: 403 }));
    await expect(
      submitAppTokenProbeServerFn({ data: { surveyId } }),
    ).rejects.toMatchObject({
      status: 403,
      message: "Lumi API svarte 403 på innsendingen med app-token.",
    });
  });
  it("keeps transport errors containing request details on the server", async () => {
    doubles.request
      .mockResolvedValueOnce(Response.json({}))
      .mockRejectedValueOnce(new Error(tokenFor(claims)));
    await expect(
      submitAppTokenProbeServerFn({ data: { surveyId } }),
    ).rejects.toMatchObject({
      message: "Fikk ikke svar fra Lumi API på innsendingen med app-token.",
    });
  });

  it("rebuilds a shared app receipt with OBO and rejects a receipt from the OBO probe", async () => {
    doubles.request
      .mockResolvedValueOnce(Response.json(readback))
      .mockResolvedValueOnce(
        Response.json({
          ...readback,
          context: {
            tags: {
              purpose: "release-verification",
              phase: "initial",
              channel: "azure-obo",
            },
          },
        }),
      );
    const data = { surveyId, appReceiptId: receiptId };
    expect(
      (await fetchReleaseVerificationRunServerFn({ data })).appToken?.status,
    ).toBe("verified");
    expect(
      (await fetchReleaseVerificationRunServerFn({ data })).appToken,
    ).toMatchObject({
      status: "mismatch",
      mismatches: ["context-phase", "context-channel"],
    });
    expect(doubles.issueToken).not.toHaveBeenCalled();
  });
});
