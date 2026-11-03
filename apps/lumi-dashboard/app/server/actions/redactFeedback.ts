import { createServerFn } from "@tanstack/react-start";
import { handleApiResponse } from "~/server/fetchUtils";
import { lumiApiFetch } from "~/server/lumiApiFetch";
import { type AuthContext, authMiddleware } from "~/server/middleware/auth";
import { refuseWriteInPublicDemo } from "~/server/publicDemo";
import { buildUrl, getHeaders, isMockMode } from "~/server/utils";
import { RedactFeedbackSchema } from "~/utils/textRedaction";
import { assertMockTeamAccess } from "./fetchFilterBootstrap";

export const redactFeedbackServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(RedactFeedbackSchema)
  .handler(async ({ data, context }): Promise<{ success: true }> => {
    refuseWriteInPublicDemo();
    const { id, team, ...input } = data;
    if (isMockMode()) {
      assertMockTeamAccess(team);
      const { redactMockFeedback } = await import("~/mock/mockData");
      await redactMockFeedback(data);
      return { success: true };
    }
    const { backendUrl, oboToken } = context as AuthContext;
    const response = await lumiApiFetch(
      buildUrl(
        backendUrl,
        `/api/v1/intern/feedback/${encodeURIComponent(id)}/redact`,
        { team },
      ),
      {
        method: "POST",
        headers: getHeaders(oboToken),
        body: JSON.stringify(input),
      },
    );
    await handleApiResponse(response);
    return { success: true };
  });
