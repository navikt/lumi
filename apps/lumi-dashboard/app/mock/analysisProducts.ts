import { createHash, randomUUID } from "node:crypto";
import {
  type AnalysisCatalog,
  AnalysisConfirmationSchema,
  type AnalysisDocument,
  AnalysisDocumentSchema,
  type AnalysisPreview,
  type AnalysisProduct,
  type AnalysisRelease,
  type AnalysisResource,
} from "~/types/analysisProducts";

// Isolated local UI double. Never a replacement for the Kotlin compiler.
const products = new Map<string, AnalysisProduct>();
const releases = new Map<
  string,
  { release: AnalysisRelease; confirmation: unknown }
>();
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sourceApp = "demo-app";
const sourceSurveyId = "opplevelse-v2";
export function mockAnalysisCatalog(team: string): AnalysisCatalog {
  return {
    demo: true,
    schemaVersion: 1,
    team,
    catalogRevision: "demo-catalog",
    sources: [
      {
        app: sourceApp,
        surveyId: sourceSurveyId,
        archived: false,
        definitionStatus: "REGISTERED",
        flowStatus: "PINNED",
        warnings: [],
        fields: [
          {
            fieldId: "vurdering",
            fieldType: "RATING",
            label: null,
            labelSource: "UNKNOWN",
            ratingScale: 5,
            optionIds: null,
            flowDependencies: [],
          },
          {
            fieldId: "rolle",
            fieldType: "SINGLE_CHOICE",
            label: null,
            labelSource: "UNKNOWN",
            ratingScale: null,
            optionIds: ["privatperson", "arbeidsgiver"],
            flowDependencies: [],
          },
          {
            fieldId: "kommentar",
            fieldType: "TEXT",
            label: null,
            labelSource: "UNKNOWN",
            ratingScale: null,
            optionIds: null,
            flowDependencies: [],
          },
        ],
      },
    ],
    dimensions: [
      {
        key: "deviceType",
        description: "Enhetstype",
        allowedValues: ["desktop", "mobile", "tablet"],
      },
    ],
  };
}

function demoPreview(product: AnalysisProduct): AnalysisPreview {
  const draft = product.draft;
  if (!draft) throw new Error("No demo draft");
  const document = draft.document;
  const catalog = mockAnalysisCatalog(product.team);
  const issues: AnalysisPreview["issues"] = [];
  if (!document.sources.length)
    issues.push({ code: "SOURCE_SELECTION_EMPTY", severity: "BLOCKER" });
  for (const source of document.sources) {
    if (source.app !== sourceApp || source.surveyId !== sourceSurveyId)
      issues.push({ code: "SOURCE_UNAVAILABLE", severity: "BLOCKER" });
    for (const fieldId of source.fieldIds) {
      if (
        !catalog.sources[0].fields.some(
          (field) => field.fieldId === fieldId && field.fieldType !== "TEXT",
        )
      )
        issues.push({
          code: "FIELD_NOT_ALLOWED",
          severity: "BLOCKER",
          fieldId,
        });
    }
  }
  const columns: AnalysisResource["columns"] = [
    {
      logicalId: "response_key",
      name: "response_key",
      type: "STRING",
      nullable: false,
      description: "Syntetisk svarnøkkel",
    },
    {
      logicalId: "submitted_date",
      name: "submitted_date",
      type: "DATE",
      nullable: false,
      description: "Dato",
    },
  ];
  const row: Record<string, string | number | boolean | null> = {
    response_key: "demo-response",
    submitted_date: "2000-01-01",
  };
  if (document.includeSubmittedHour) {
    columns.push({
      logicalId: "submitted_hour",
      name: "submitted_hour",
      type: "TIMESTAMP",
      nullable: false,
      description: "Innsendt tidspunkt avrundet til time",
    });
    row.submitted_hour = "2000-01-01T12:00:00Z";
  }
  for (const id of document.sources[0]?.fieldIds ?? []) {
    columns.push({
      logicalId: `field:${id}`,
      name: `demo_${id}`,
      type: id === "vurdering" ? "INT64" : "STRING",
      nullable: true,
      description: id,
    });
    row[`demo_${id}`] = id === "vurdering" ? 4 : "privatperson";
  }
  for (const key of document.dimensionKeys) {
    columns.push({
      logicalId: `dimension:${key}`,
      name: `demo_${key}`,
      type: "STRING",
      nullable: true,
      description: key,
    });
    row[`demo_${key}`] = "desktop";
  }
  const resources: AnalysisResource[] = document.sources.length
    ? [
        {
          name: "demo_responses_wide_v1",
          kind: "WIDE",
          rowMeaning: "Én rad per svar (forenklet lokal demo)",
          sourceApp,
          sourceSurveyId,
          columns,
          syntheticRows: [row],
        },
      ]
    : [];
  return {
    schemaVersion: 2,
    dataOrigin: "SYNTHETIC",
    productId: product.id,
    draftId: draft.id,
    draftRevision: draft.revision,
    documentHash: draft.documentHash,
    catalogRevision: `demo-selection:${digest(document.sources)}`,
    publicationSpecificationDigest: issues.length ? null : digest(document),
    status: issues.length ? "BLOCKED" : "READY",
    resources,
    issues,
    excludedDataCategories: ["TEXT_ANSWERS", "RAW_JSON", "CLIENT_LABELS"],
  };
}

export function mockAnalysisRequest(
  team: string,
  path: string,
  method: string,
  body: unknown,
): Response {
  if (team !== "team-esyfo")
    return Response.json({ error: "Unavailable" }, { status: 403 });
  const json = (value: unknown, status = 200) =>
    Response.json(value, { status });
  if (path === "/catalog") return json(mockAnalysisCatalog(team));
  if (path === "" && method === "GET")
    return json([...products.values()].filter((p) => p.team === team));
  if (path === "" && method === "POST") {
    const document = AnalysisDocumentSchema.parse(body);
    if ([...products.values()].filter((p) => p.team === team).length >= 10)
      return json({}, 429);
    const product: AnalysisProduct = {
      id: randomUUID(),
      team,
      lifecycleState: "DRAFT",
      lastReleaseNumber: 0,
      activeReleaseNumber: null,
      desiredReleaseNumber: null,
      updatedAt: new Date().toISOString(),
      draft: {
        id: randomUUID(),
        revision: 1,
        documentHash: digest(document),
        document,
      },
    };
    products.set(product.id, product);
    return json(product, 201);
  }
  const [, id, operation] = path.split("/");
  const product = products.get(id);
  if (!product || product.team !== team) return json({}, 404);
  if (!operation) return json(product);
  if (operation === "releases" && method === "GET")
    return json(releases.has(id) ? [releases.get(id)?.release] : []);
  if (operation === "preview")
    return product.draft ? json(demoPreview(product)) : json({}, 404);
  if (operation === "draft" && method === "PUT") {
    if (!product.draft)
      return json({ error: "ANALYSIS_PRODUCT_NOT_EDITABLE" }, 409);
    const input = body as {
      draftId: string;
      draftRevision: number;
      document: AnalysisDocument;
    };
    if (
      input.draftId !== product.draft.id ||
      input.draftRevision !== product.draft.revision
    )
      return json({ error: "ANALYSIS_PREVIEW_CHANGED" }, 409);
    const document = AnalysisDocumentSchema.parse(input.document);
    product.draft = {
      ...product.draft,
      revision: product.draft.revision + 1,
      document,
      documentHash: digest(document),
    };
    product.updatedAt = new Date().toISOString();
    return json(product);
  }
  if (operation === "releases" && method === "POST") {
    const confirmation = AnalysisConfirmationSchema.parse(body);
    const previous = releases.get(id);
    if (previous)
      return digest(previous.confirmation) === digest(confirmation)
        ? json(previous.release)
        : json({ error: "ANALYSIS_PREVIEW_CHANGED" }, 409);
    if (!product.draft)
      return json({ error: "ANALYSIS_PRODUCT_NOT_EDITABLE" }, 409);
    const preview = demoPreview(product);
    if (preview.status === "BLOCKED") return json(preview.issues, 422);
    if (
      Object.entries(confirmation).some(
        ([key, value]) => preview[key as keyof AnalysisPreview] !== value,
      )
    )
      return json({ error: "ANALYSIS_PREVIEW_CHANGED" }, 409);
    const release: AnalysisRelease = {
      id: randomUUID(),
      productId: id,
      releaseNumber: 1,
      sourceDocument: product.draft.document,
      publishedAt: new Date().toISOString(),
    };
    releases.set(id, { release, confirmation });
    product.draft = null;
    product.lastReleaseNumber = 1;
    return json(release, 201);
  }
  return json({}, 404);
}
