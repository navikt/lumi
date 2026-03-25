import { afterEach, describe, expect, it } from "vitest";
import { detectDeviceType } from "../deviceDetection.js";

describe("detectDeviceType", () => {
  const originalUserAgent = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "userAgent",
  );
  const originalUserAgentData = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "userAgentData",
  );

  afterEach(() => {
    if (originalUserAgent === undefined) {
      Reflect.deleteProperty(Navigator.prototype, "userAgent");
    } else {
      Object.defineProperty(
        Navigator.prototype,
        "userAgent",
        originalUserAgent,
      );
    }

    if (originalUserAgentData === undefined) {
      Reflect.deleteProperty(Navigator.prototype, "userAgentData");
    } else {
      Object.defineProperty(
        Navigator.prototype,
        "userAgentData",
        originalUserAgentData,
      );
    }
  });

  it("resolves to mobile for iPhone when Client Hints say mobile", () => {
    Object.defineProperty(Navigator.prototype, "userAgentData", {
      value: { mobile: true, platform: "iOS" },
      configurable: true,
    });
    Object.defineProperty(Navigator.prototype, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      configurable: true,
    });

    expect(detectDeviceType(390)).toBe("mobile");
  });

  it("resolves to tablet for Android tablet even when Client Hints say non-mobile", () => {
    Object.defineProperty(Navigator.prototype, "userAgentData", {
      value: { mobile: false, platform: "Android" },
      configurable: true,
    });
    Object.defineProperty(Navigator.prototype, "userAgent", {
      value:
        "Mozilla/5.0 (Linux; Android 14; SM-X616B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      configurable: true,
    });

    expect(detectDeviceType(1280)).toBe("tablet");
  });

  it("trusts Client Hints mobile signal even when UA does not match known patterns", () => {
    Object.defineProperty(Navigator.prototype, "userAgentData", {
      value: { mobile: true, platform: "Unknown" },
      configurable: true,
    });
    Object.defineProperty(Navigator.prototype, "userAgent", {
      value: "SomeFutureBrowser/1.0",
      configurable: true,
    });

    expect(detectDeviceType(1440)).toBe("mobile");
  });

  it("detects desktop from UA string when no Client Hints available", () => {
    Object.defineProperty(Navigator.prototype, "userAgentData", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(Navigator.prototype, "userAgent", {
      value:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      configurable: true,
    });

    expect(detectDeviceType(500)).toBe("desktop");
  });

  it("falls back to viewport width when user agent signals are unavailable", () => {
    Object.defineProperty(Navigator.prototype, "userAgentData", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(Navigator.prototype, "userAgent", {
      value: "",
      configurable: true,
    });

    expect(detectDeviceType(500)).toBe("mobile");
    expect(detectDeviceType(900)).toBe("tablet");
    expect(detectDeviceType(1440)).toBe("desktop");
  });
});
