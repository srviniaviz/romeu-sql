import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import pt from "./locales/pt.json";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value)
    .flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe("locale dictionaries", () => {
  it("keeps English and Portuguese keys in sync", () => {
    expect(flattenKeys(pt)).toEqual(flattenKeys(en));
  });

  it("does not leave empty translation values", () => {
    for (const [locale, dictionary] of Object.entries({ en, pt })) {
      const emptyKeys = flattenKeys(dictionary).filter((key) => {
        const value = key.split(".").reduce<unknown>((current, part) => {
          if (!current || typeof current !== "object") return undefined;
          return (current as Record<string, unknown>)[part];
        }, dictionary);

        return typeof value === "string" && value.trim().length === 0;
      });

      expect(emptyKeys, `${locale} has empty translation values`).toEqual([]);
    }
  });
});
