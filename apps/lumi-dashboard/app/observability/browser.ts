import { getWebInstrumentations } from "@grafana/faro-web-sdk";
import { type InitOptions, init } from "@nais/apm";

import {
  BROWSER_APM_APP,
  BROWSER_APM_NAMESPACE,
  BROWSER_SESSION_SAMPLING_RATE,
  UNKNOWN_PAGE_ID,
} from "~/observability/contract";
import { publicEnv } from "~/publicEnv";

export {
  BROWSER_APM_APP,
  BROWSER_APM_NAMESPACE,
  BROWSER_SESSION_SAMPLING_RATE,
  UNKNOWN_PAGE_ID,
} from "~/observability/contract";

const ENABLED_HOSTS = new Set([
  "lumi-dashboard.ansatt.dev.nav.no",
  "lumi-dashboard.ansatt.nav.no",
]);

const SAFE_EVENT_NAMES = new Set([
  "navigation",
  "route_change",
  "session_extend",
  "session_resume",
  "session_start",
  "view_changed",
]);
const SAFE_EVENT_DOMAINS = new Set(["browser"]);

const SAFE_MEASUREMENT_TYPES = new Set(["web-vitals"]);
const SAFE_WEB_VITAL_RATINGS = new Set(["good", "needs-improvement", "poor"]);
const SAFE_NAVIGATION_TYPES = new Set([
  "back-forward",
  "back-forward-cache",
  "navigate",
  "prerender",
  "reload",
  "restore",
  "soft-navigation",
]);
const SAFE_MEASUREMENT_VALUES = new Set([
  "cache_duration",
  "cls",
  "connection_duration",
  "delta",
  "dns_duration",
  "element_render_delay",
  "fcp",
  "first_byte_to_fcp",
  "inp",
  "input_delay",
  "interaction_time",
  "largest_shift_time",
  "largest_shift_value",
  "lcp",
  "next_paint_time",
  "presentation_delay",
  "processing_duration",
  "request_duration",
  "resource_load_delay",
  "resource_load_duration",
  "time_to_first_byte",
  "ttfb",
  "waiting_duration",
]);

const SAFE_EXCEPTION_VALUES = new Set([
  "Lumi browser observability canary",
  "Unexpected Lumi dashboard error",
]);

const SAFE_API_EXCEPTION =
  /^Lumi dashboard API error \([1-5][0-9]{2} [A-Z_]+\)$/;
const SAFE_LABEL = /^[A-Za-z][A-Za-z0-9_.:/ -]{0,127}$/;
const SAFE_META_VALUE = /^[A-Za-z0-9][A-Za-z0-9_.:/ -]{0,127}$/;
const SAFE_EXCEPTION_TYPE = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;
const SAFE_STACK_FUNCTION = /^[A-Za-z0-9_.$/<>{}()[\]: -]{1,200}$/;
const SAFE_FINGERPRINTS = new Set(["lumi-dashboard-route-error"]);
const SAFE_SESSION_ID = /^[A-Za-z0-9]{10}$/;
const SAFE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const CDN_ASSET_PATH =
  /^\/team-esyfo\/lumi-dashboard\/client\/assets\/[A-Za-z0-9._-]+\.js$/;

const routes: Array<[RegExp, string]> = [
  [/^\/$/, "/"],
  [/^\/feedback\/?$/, "/feedback"],
  [/^\/export\/?$/, "/export"],
  [/^\/survey-preview\/?$/, "/survey-preview"],
  [/^\/release-verification\/?$/, "/release-verification"],
  [/^\/surveyverksted\/?$/, "/surveyverksted"],
  [
    /^\/surveyverksted\/revisions\/[^/]+\/?$/,
    "/surveyverksted/revisions/{revisionId}",
  ],
  [/^\/surveyverksted\/[^/]+\/?$/, "/surveyverksted/{projectId}"],
];

type BeforeSend = NonNullable<InitOptions["beforeSend"]>;
type TelemetryItem = Parameters<BeforeSend>[0];
type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function pathnameFrom(value: string): string {
  try {
    return new URL(value, "https://lumi.invalid").pathname;
  } catch {
    return value.split(/[?#]/, 1)[0] || "/";
  }
}

export function normalizeBrowserPath(value: string): string {
  const pathname = pathnameFrom(value);
  return (
    routes.find(([pattern]) => pattern.test(pathname))?.[1] ?? UNKNOWN_PAGE_ID
  );
}

export function normalizeBrowserUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return UNKNOWN_PAGE_ID;
    }
    return `${url.origin}${normalizeBrowserPath(url.pathname)}`;
  } catch {
    return normalizeBrowserPath(value);
  }
}

function sanitizeResourceUrl(value: unknown): string {
  if (typeof value !== "string") return "[resource]";

  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "cdn.nav.no" &&
      CDN_ASSET_PATH.test(url.pathname)
    ) {
      return `${url.origin}${url.pathname}`;
    }
    return normalizeBrowserUrl(value);
  } catch {
    return normalizeBrowserPath(value);
  }
}

function sanitizePageMeta(meta: UnknownRecord): UnknownRecord {
  const sanitized: UnknownRecord = {};

  const app = asRecord(meta.app);
  if (app) {
    sanitized.app = copySafeMetaFields(app, [
      "bundleId",
      "environment",
      "gitHash",
      "name",
      "namespace",
      "release",
      "version",
    ]);
  }

  const browser = asRecord(meta.browser);
  if (browser) {
    sanitized.browser = copySafeMetaFields(browser, [
      "mobile",
      "name",
      "os",
      "version",
      "viewportHeight",
      "viewportWidth",
    ]);
  }

  const device = asRecord(meta.device);
  if (device) {
    sanitized.device = copySafeMetaFields(device, [
      "brand",
      "is_physical",
      "manufacturer",
      "model_identifier",
      "model_name",
      "type",
    ]);
  }

  const os = asRecord(meta.os);
  if (os) {
    sanitized.os = copySafeMetaFields(os, [
      "build_id",
      "detail",
      "name",
      "version",
    ]);
  }

  const sdk = asRecord(meta.sdk);
  if (sdk) {
    sanitized.sdk = copySafeMetaFields(sdk, ["name", "version"]);
  }

  const page = asRecord(meta.page);
  if (page) {
    const rawUrl = typeof page.url === "string" ? page.url : undefined;
    const rawId = typeof page.id === "string" ? page.id : rawUrl;
    sanitized.page = {
      id: normalizeBrowserPath(rawId ?? UNKNOWN_PAGE_ID),
      ...(rawUrl ? { url: normalizeBrowserUrl(rawUrl) } : {}),
    };
  }

  const view = asRecord(meta.view);
  if (view && typeof view.name === "string") {
    sanitized.view = { name: normalizeBrowserPath(view.name) };
  }

  const session = asRecord(meta.session);
  if (session) {
    sanitized.session =
      typeof session.id === "string" && SAFE_SESSION_ID.test(session.id)
        ? { id: session.id }
        : {};
  }

  return sanitized;
}

function copySafeMetaFields(
  source: UnknownRecord,
  keys: readonly string[],
): UnknownRecord {
  const result: UnknownRecord = {};
  for (const key of keys) {
    const value = source[key];
    if (
      typeof value === "boolean" ||
      typeof value === "number" ||
      (typeof value === "string" && SAFE_META_VALUE.test(value))
    ) {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeRouteAttributes(
  value: unknown,
): Record<string, string> | undefined {
  const attributes = asRecord(value);
  if (!attributes) return undefined;

  const sanitized: Record<string, string> = {};
  for (const key of ["fromUrl", "toRoute", "toUrl"] as const) {
    const raw = attributes[key];
    if (typeof raw === "string") {
      sanitized[key] = normalizeBrowserPath(raw);
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeStacktrace(value: unknown): UnknownRecord | undefined {
  const stacktrace = asRecord(value);
  if (!stacktrace || !Array.isArray(stacktrace.frames)) return undefined;

  const frames = stacktrace.frames.flatMap((candidate) => {
    const frame = asRecord(candidate);
    if (!frame) return [];

    return [
      {
        filename: sanitizeResourceUrl(frame.filename),
        function:
          typeof frame.function === "string" &&
          SAFE_STACK_FUNCTION.test(frame.function)
            ? frame.function
            : "[anonymous]",
        ...(typeof frame.colno === "number" && Number.isFinite(frame.colno)
          ? { colno: frame.colno }
          : {}),
        ...(typeof frame.lineno === "number" && Number.isFinite(frame.lineno)
          ? { lineno: frame.lineno }
          : {}),
        ...(typeof frame.bundleid === "string" &&
        SAFE_LABEL.test(frame.bundleid)
          ? { bundleid: frame.bundleid }
          : {}),
      },
    ];
  });

  return frames.length > 0 ? { frames } : undefined;
}

function safeExceptionValue(value: unknown): string {
  if (typeof value !== "string") return "Unexpected browser error";
  if (SAFE_EXCEPTION_VALUES.has(value) || SAFE_API_EXCEPTION.test(value)) {
    return value;
  }
  return "Unexpected browser error";
}

function sanitizePayload(type: string, value: unknown): UnknownRecord | null {
  const payload = asRecord(value);
  if (!payload) return null;

  if (type === "event") {
    const name = typeof payload.name === "string" ? payload.name : "";
    if (!SAFE_EVENT_NAMES.has(name)) return null;
    const routeAttributes = sanitizeRouteAttributes(payload.attributes);
    return {
      name,
      ...(typeof payload.timestamp === "string" &&
      SAFE_TIMESTAMP.test(payload.timestamp)
        ? { timestamp: payload.timestamp }
        : {}),
      ...(typeof payload.domain === "string" &&
      SAFE_EVENT_DOMAINS.has(payload.domain)
        ? { domain: payload.domain }
        : {}),
      ...(name === "route_change" && routeAttributes
        ? { attributes: routeAttributes }
        : {}),
    };
  }

  if (type === "exception") {
    const stacktrace = sanitizeStacktrace(payload.stacktrace);
    const exceptionType =
      typeof payload.type === "string" && SAFE_EXCEPTION_TYPE.test(payload.type)
        ? payload.type
        : "Error";
    const fingerprint =
      typeof payload.fingerprint === "string" &&
      SAFE_FINGERPRINTS.has(payload.fingerprint)
        ? payload.fingerprint
        : undefined;

    return {
      type: exceptionType,
      value: safeExceptionValue(payload.value),
      ...(typeof payload.timestamp === "string" &&
      SAFE_TIMESTAMP.test(payload.timestamp)
        ? { timestamp: payload.timestamp }
        : {}),
      ...(payload.fatal === true ? { fatal: true } : {}),
      ...(fingerprint ? { fingerprint } : {}),
      ...(stacktrace ? { stacktrace } : {}),
    };
  }

  if (type === "measurement") {
    const measurementType =
      typeof payload.type === "string" ? payload.type : "";
    if (!SAFE_MEASUREMENT_TYPES.has(measurementType)) return null;
    const values = asRecord(payload.values);
    const numericValues = Object.fromEntries(
      Object.entries(values ?? {}).filter(
        ([key, entry]) =>
          SAFE_MEASUREMENT_VALUES.has(key) &&
          typeof entry === "number" &&
          Number.isFinite(entry),
      ),
    );
    const context = sanitizeMeasurementContext(payload.context);

    return {
      type: measurementType,
      values: numericValues,
      ...(context ? { context } : {}),
      ...(typeof payload.timestamp === "string" &&
      SAFE_TIMESTAMP.test(payload.timestamp)
        ? { timestamp: payload.timestamp }
        : {}),
    };
  }

  // Logs, traces and unknown/custom payloads are intentionally not exported.
  return null;
}

function sanitizeMeasurementContext(
  value: unknown,
): Record<string, string> | undefined {
  const context = asRecord(value);
  if (!context) return undefined;

  const sanitized: Record<string, string> = {};
  if (
    typeof context.rating === "string" &&
    SAFE_WEB_VITAL_RATINGS.has(context.rating)
  ) {
    sanitized.rating = context.rating;
  }
  if (
    typeof context.navigation_type === "string" &&
    SAFE_NAVIGATION_TYPES.has(context.navigation_type)
  ) {
    sanitized.navigation_type = context.navigation_type;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export const sanitizeBrowserTelemetry: BeforeSend = (item) => {
  const type = String(item.type);
  const payload = sanitizePayload(type, item.payload);
  if (!payload) return null;

  return {
    type: item.type,
    payload,
    meta: sanitizePageMeta(asRecord(item.meta) ?? {}),
  } as TelemetryItem;
};

export function isBrowserObservabilityHost(hostname: string): boolean {
  return ENABLED_HOSTS.has(hostname.toLowerCase());
}

export function isBrowserObservabilityEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    publicEnv.VITE_MOCK_DATA !== "true" &&
    isBrowserObservabilityHost(window.location.hostname)
  );
}

export function createBrowserApmOptions(): InitOptions {
  return {
    app: BROWSER_APM_APP,
    namespace: BROWSER_APM_NAMESPACE,
    version: publicEnv.VITE_LUMI_RELEASE,
    beforeSend: sanitizeBrowserTelemetry,
    dangerouslyDisablePiiScrubbing: false,
    faro: {
      // Lumi is an internal analytics surface. Console arguments can contain
      // survey responses, so only explicit and uncaught exceptions are kept.
      instrumentations: getWebInstrumentations({ captureConsole: false }),
      pageTracking: {
        generatePageId: (location) => normalizeBrowserPath(location.pathname),
      },
      sessionTracking: {
        samplingRate: BROWSER_SESSION_SAMPLING_RATE,
      },
    },
    tracing: false,
    sessionReplay: { enabled: false },
    screenshotOnError: false,
  };
}

export function initBrowserObservability() {
  if (!isBrowserObservabilityEnabled()) return undefined;
  return init(createBrowserApmOptions());
}
