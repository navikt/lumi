import { afterEach, describe, expect, it, vi } from "vitest";

import exitAfterShutdown from "../exitAfterShutdown";

type NitroApp = Parameters<typeof exitAfterShutdown>[0];

function createNitroApp() {
  const closeHooks: Array<() => void> = [];
  const hook = vi.fn((name: string, fn: () => void) => {
    if (name === "close") closeHooks.push(fn);
    return () => {};
  });
  const app = { fetch: vi.fn(), hooks: { hook } } as unknown as NitroApp;
  return { app, hook, closeHooks };
}

describe("exitAfterShutdown", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("exits with code 0 once the production server has closed", () => {
    vi.stubEnv("NODE_ENV", "production");
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const { app, closeHooks } = createNitroApp();

    exitAfterShutdown(app);

    expect(exit).not.toHaveBeenCalled();
    expect(closeHooks).toHaveLength(1);

    closeHooks[0]();

    expect(exit).toHaveBeenCalledWith(0);
  });

  it("leaves the Vite dev server running", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { app, hook } = createNitroApp();

    exitAfterShutdown(app);

    expect(hook).not.toHaveBeenCalled();
  });
});
