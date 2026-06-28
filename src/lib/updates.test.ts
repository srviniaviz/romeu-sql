import { describe, expect, it } from "vitest";
import { compareVersions, normalizeVersion } from "./updates";

describe("update version helpers", () => {
  it("normalizes MSI numeric prerelease versions to the alpha tag format", () => {
    expect(normalizeVersion("0.1.0-13")).toBe("0.1.0-alpha.13");
    expect(normalizeVersion("v0.1.0-alpha.13")).toBe("0.1.0-alpha.13");
  });

  it("treats the local MSI version and GitHub alpha tag as the same release", () => {
    expect(compareVersions("0.1.0-alpha.13", "0.1.0-13")).toBe(0);
    expect(compareVersions("0.1.0-alpha.14", "0.1.0-13")).toBeGreaterThan(0);
  });
});
