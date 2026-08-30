import { createServerFn } from "@tanstack/react-start";

import {
  BROWSER_APM_APP,
  BROWSER_APM_NAMESPACE,
} from "~/observability/contract";
import { publicEnv } from "~/publicEnv";

/** Public deployment metadata transported from the NAIS pod to the browser. */
export const fetchBrowserObservabilityMetaServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const { getNaisMetaTags } = await import("@nais/apm");
  return getNaisMetaTags({
    app: BROWSER_APM_APP,
    namespace: BROWSER_APM_NAMESPACE,
    version: publicEnv.VITE_LUMI_RELEASE,
  });
});
