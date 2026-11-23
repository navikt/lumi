import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod";
import { LumiApiTimeoutError } from "~/server/lumiApiFetch";
import { authMiddleware } from "~/server/middleware/auth";
import { LUMI_API_WRITE_TIMEOUT_MESSAGE } from "~/utils/apiErrorMessages";
import { createReleaseVerificationReport } from "~/utils/releaseVerification";
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
      const withSchema = (schema?: ZodType) => ({
        handler: (
          fn: (args: {
            data: unknown;
            context: typeof doubles.context;
          }) => unknown,
        ) =>
          Object.assign(
            async (args: { data: unknown }) =>
              fn({
                data: schema ? schema.parse(args.data) : args.data,
                context: doubles.context,
              }),
            { middleware },
          ),
      });
      return { ...withSchema(), validator: withSchema };
    },
  }),
}));
vi.mock("~/server/middleware/auth", () => ({ authMiddleware: {} }));
vi.mock("~/server/lumiApiFetch", async (original) => ({
  ...(await original<typeof import("~/server/lumiApiFetch")>()),
  lumiApiFetch: doubles.request,
}));
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
    const report = createReleaseVerificationReport({
      profile: "dev-authenticated-roundtrip",
      environment: "dev-gcp",
      surveyId,
      now: readback.submittedAt,
      holdDurationMs: 900000,
      preflight: {
        status: "passed",
        checkedAt: readback.submittedAt,
        app: readback.app,
        team: "team-esyfo",
      },
      appProbe: evidence,
    });
    const check = report.checks.find(({ id }) => id === "app-token-round-trip");
    expect(check?.status).toBe("passed");
    expect(check?.detail).toContain(
      `Før innsending kontrollerte dashboardet azp_name=${claims.azp_name}, idtyp=${claims.idtyp} og rollen ${claims.roles[0]}.`,
    );
    expect(check?.detail).toContain(
      `callId=${post[1].headers["X-Correlation-ID"]}`,
    );
    for (const sensitive of [tokenFor(claims), claims.name, "delegated"]) {
      expect(JSON.stringify(report)).not.toContain(sensitive);
      expect(post[1].body).not.toContain(sensitive);
    }
  });

  it.each(["prod-gcp", undefined])(
    "refuses token acquisition outside dev-gcp (%s)",
    async (cluster) => {
      doubles.env.NAIS_CLUSTER_NAME = cluster;
      await expect(
        submitAppTokenProbeServerFn({ data: { surveyId } }),
      ).rejects.toMatchObject({ status: 403 });
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
      ).rejects.toMatchObject({ status });
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
    [{ ...claims, idtyp: "user" }, "idtyp har en annen verdi enn app"],
    [
      { ...claims, roles: "access_as_application" },
      "roles mangler access_as_application",
    ],
    [
      {},
      "azp_name mangler. idtyp mangler. roles mangler access_as_application",
    ],
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
  it("rejects invalid run IDs before preflight or token acquisition", async () => {
    await expect(
      submitAppTokenProbeServerFn({
        data: { surveyId: "lumi-release-verification-incorrect" },
      }),
    ).rejects.toThrow();
    expect(doubles.request).not.toHaveBeenCalled();
    expect(doubles.issueToken).not.toHaveBeenCalled();
  });

  it.each([
    [
      { ok: false, error: "private value" },
      "Kunne ikke hente app-token fra Entra ID.",
    ],
    [
      { ok: true, token: "private value" },
      "Kunne ikke lese feltene i app-tokenet.",
    ],
    [
      { ok: true, token: "header.invalid.signature" },
      "Kunne ikke lese feltene i app-tokenet.",
    ],
  ])(
    "returns a safe message when token acquisition or decoding fails",
    async (result, message) => {
      doubles.request.mockResolvedValueOnce(Response.json({}));
      doubles.issueToken.mockResolvedValueOnce(result);
      await expect(
        submitAppTokenProbeServerFn({ data: { surveyId } }),
      ).rejects.toMatchObject({ status: 502, message });
      expect(doubles.request).toHaveBeenCalledTimes(1);
    },
  );

  it("does not forward token acquisition errors", async () => {
    doubles.request.mockResolvedValue(Response.json({}));
    doubles.issueToken.mockRejectedValueOnce(new Error("private value"));
    await expect(
      submitAppTokenProbeServerFn({ data: { surveyId } }),
    ).rejects.toThrow(/^Kunne ikke hente app-token fra Entra ID\.$/);
  });

  it.each([401, 403, 429, 503])(
    "maps app-token submission HTTP %i to 502 without the body",
    async (status) => {
      doubles.request
        .mockResolvedValueOnce(Response.json({}))
        .mockResolvedValueOnce(new Response("private value", { status }));
      await expect(
        submitAppTokenProbeServerFn({ data: { surveyId } }),
      ).rejects.toMatchObject({
        status: 502,
        message: `Lumi API svarte ${status} på innsendingen med app-token.`,
      });
    },
  );

  it.each([
    Response.json({ id: "private value" }),
    new Response("invalid json"),
  ])("sanitizes invalid receipts", async (response) => {
    doubles.request
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(response);
    await expect(
      submitAppTokenProbeServerFn({ data: { surveyId } }),
    ).rejects.toMatchObject({
      status: 502,
      message: "Lumi API returnerte en ugyldig kvittering.",
    });
    expect(doubles.request).toHaveBeenCalledTimes(2);
  });

  it("preserves the uncertain write result on timeout", async () => {
    doubles.request
      .mockResolvedValueOnce(Response.json({}))
      .mockRejectedValueOnce(new LumiApiTimeoutError("POST"));
    await expect(
      submitAppTokenProbeServerFn({ data: { surveyId } }),
    ).rejects.toMatchObject({
      status: 504,
      message: LUMI_API_WRITE_TIMEOUT_MESSAGE,
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

  it.each([401, 403, 429])(
    "keeps the receipt when readback returns HTTP %i",
    async (status) => {
      doubles.request
        .mockResolvedValueOnce(Response.json({}))
        .mockResolvedValueOnce(
          Response.json({ id: receiptId }, { status: 201 }),
        )
        .mockResolvedValueOnce(new Response(null, { status }));
      const evidence = await submitAppTokenProbeServerFn({
        data: { surveyId },
      });
      expect(evidence).toMatchObject({
        receiptId,
        status: "unavailable",
        storedAt: null,
      });
      expect(doubles.request).toHaveBeenCalledTimes(3);
    },
  );

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
