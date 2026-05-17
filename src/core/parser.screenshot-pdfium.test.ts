import { vi, describe, it, expect, beforeEach } from "vitest";

const mockLoadDocument = vi.hoisted(() => vi.fn(async () => {}));
const mockGetPageCount = vi.hoisted(() => vi.fn(() => 2));
const mockRenderPage = vi.hoisted(() =>
  vi.fn(async (_pdfInput: string | Uint8Array, pageNumber: number) => ({
    imageBuffer: Buffer.from([pageNumber]),
    width: 100 * pageNumber,
    height: 200 * pageNumber,
  }))
);
const mockClose = vi.hoisted(() => vi.fn(async () => {}));
const mockPdfJsLoadDocument = vi.hoisted(() => vi.fn());

vi.mock("../conversion/convertToPdf.js", async () => {
  const actual = await vi.importActual<typeof import("../conversion/convertToPdf.js")>(
    "../conversion/convertToPdf.js"
  );
  return {
    ...actual,
    convertToPdf: vi.fn(async (input: string) => ({
      pdfPath: input,
      originalExtension: ".pdf",
    })),
    cleanupConversionFiles: vi.fn(async () => {}),
  };
});

vi.mock("../engines/pdf/pdfjs.js", () => ({
  PdfJsEngine: vi.fn(
    class {
      loadDocument = mockPdfJsLoadDocument;
      close = vi.fn(async () => {});
    }
  ),
}));

vi.mock("../engines/pdf/pdfium-renderer.js", () => ({
  PdfiumRenderer: vi.fn(
    class {
      loadDocument = mockLoadDocument;
      getPageCount = mockGetPageCount;
      renderPage = mockRenderPage;
      close = mockClose;
    }
  ),
}));

import { LiteParse } from "./parser";

describe("screenshot() PDFium-only path", () => {
  beforeEach(() => {
    mockLoadDocument.mockClear();
    mockGetPageCount.mockClear();
    mockRenderPage.mockClear();
    mockClose.mockClear();
    mockPdfJsLoadDocument.mockClear();
  });

  it("does not load the PDF with PDF.js", async () => {
    const parser = new LiteParse({ ocrEnabled: false });
    const results = await parser.screenshot("document.pdf", [1, 2]);

    expect(mockPdfJsLoadDocument).not.toHaveBeenCalled();
    expect(mockLoadDocument).toHaveBeenCalledTimes(1);
    expect(mockGetPageCount).toHaveBeenCalledTimes(1);
    expect(mockRenderPage).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      { pageNum: 1, width: 100, height: 200, imageBuffer: Buffer.from([1]) },
      { pageNum: 2, width: 200, height: 400, imageBuffer: Buffer.from([2]) },
    ]);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
