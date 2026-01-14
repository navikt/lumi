import { z } from "zod";

const clientSchema = z.object({
  VITE_MOCK_DATA: z.enum(["true", "false"]).optional(),
});

/**
 * Validated client-side environment variables.
 * Safe to use in components.
 */
export const publicEnv = (() => {
  // Check if import.meta.env exists (Vite)
  if (typeof import.meta === "undefined" || !import.meta.env) {
    return {} as z.infer<typeof clientSchema>;
  }

  const result = clientSchema.safeParse(import.meta.env);

  if (!result.success) {
    console.error(
      "❌ Invalid client environment variables:",
      result.error.flatten(),
    );
    throw new Error("Invalid client environment variables");
  }

  return result.data;
})();
