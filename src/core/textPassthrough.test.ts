import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG } from "./config.js";
import { buildTextPassthroughPages, buildTextPassthroughResult } from "./textPassthrough.js";

describe("buildTextPassthroughPages", () => {
  it("returns one synthetic page with the full text", () => {
    const pages = buildTextPassthroughPages("Hello\nWorld");
    expect(pages).toHaveLength(1);
    expect(pages[0]?.pageNum).toBe(1);
    expect(pages[0]?.text).toBe("Hello\nWorld");
    expect(pages[0]?.textItems[0]?.str).toBe("Hello\nWorld");
  });
});

describe("buildTextPassthroughResult", () => {
  it("includes result.json when outputFormat is json", () => {
    const result = buildTextPassthroughResult("Plain text file.", {
      ...DEFAULT_CONFIG,
      outputFormat: "json",
    });

    expect(result.text).toBe("Plain text file.");
    expect(result.pages).toHaveLength(1);
    expect(result.json).toBeDefined();
    expect(result.json?.pages).toHaveLength(1);
    expect(result.json?.pages[0]?.text).toBe("Plain text file.");
    expect(result.json?.pages[0]?.textItems[0]?.text).toBe("Plain text file.");
  });

  it("omits result.json when outputFormat is text", () => {
    const result = buildTextPassthroughResult("Plain text file.", {
      ...DEFAULT_CONFIG,
      outputFormat: "text",
    });

    expect(result.text).toBe("Plain text file.");
    expect(result.pages).toHaveLength(1);
    expect(result.json).toBeUndefined();
  });
});
