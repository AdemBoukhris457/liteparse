import { vi, describe, it, expect } from "vitest";

vi.mock("../conversion/convertToPdf.js", async () => {
  const actual = await vi.importActual<typeof import("../conversion/convertToPdf.js")>(
    "../conversion/convertToPdf.js"
  );
  return {
    ...actual,
    convertToPdf: vi.fn(async () => ({ content: "Hello from notes.txt" })),
    cleanupConversionFiles: vi.fn(async () => {}),
  };
});

vi.mock("../engines/pdf/pdfjs.js", () => ({
  PdfJsEngine: vi.fn(
    class {
      loadDocument = vi.fn();
      close = vi.fn(async () => {});
    }
  ),
}));

import { LiteParse } from "./parser.js";

describe("LiteParse text passthrough", () => {
  it("returns result.json when outputFormat is json (default)", async () => {
    const parser = new LiteParse({ ocrEnabled: false, outputFormat: "json" });
    const result = await parser.parse("notes.txt");

    expect(result.text).toBe("Hello from notes.txt");
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.pageNum).toBe(1);
    expect(result.json?.pages[0]?.text).toBe("Hello from notes.txt");
  });

  it("returns no result.json when outputFormat is text", async () => {
    const parser = new LiteParse({ ocrEnabled: false, outputFormat: "text" });
    const result = await parser.parse("notes.txt");

    expect(result.text).toBe("Hello from notes.txt");
    expect(result.pages).toHaveLength(1);
    expect(result.json).toBeUndefined();
  });
});
