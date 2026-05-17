import { vi, describe, it, expect, beforeEach } from "vitest";

const mockTerminate = vi.hoisted(() => vi.fn(async () => {}));
const mockRecognize = vi.hoisted(() => vi.fn(async () => []));

const mockPdfDocument = { numPages: 1 };
const mockPages = [
  {
    pageNum: 1,
    width: 612,
    height: 792,
    textItems: [],
    paths: [],
    images: [{ x: 0, y: 0, width: 100, height: 100 }],
    annotations: [],
  },
];

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
      loadDocument = vi.fn().mockResolvedValue(mockPdfDocument);
      extractAllPages = vi.fn().mockResolvedValue(mockPages);
      renderPageImage = vi.fn(async () => Buffer.from([1, 2, 3]));
      close = vi.fn(async () => {});
    }
  ),
}));

vi.mock("../engines/ocr/tesseract.js", () => ({
  TesseractEngine: vi.fn(
    class {
      terminate = mockTerminate;
      recognize = mockRecognize;
    }
  ),
}));

vi.mock("../processing/grid.js", () => ({
  projectPagesToGrid: vi.fn(async (pages: unknown[]) => pages),
}));

vi.mock("../processing/bbox.js", () => ({
  buildBoundingBoxes: vi.fn(() => []),
}));

vi.mock("../output/json.js", () => ({
  formatJSON: vi.fn(() => '{"pages":[]}'),
}));

import { LiteParse } from "./parser";

describe("Tesseract worker lifecycle", () => {
  beforeEach(() => {
    mockTerminate.mockClear();
    mockRecognize.mockClear();
  });

  it("does not terminate Tesseract workers after each parse()", async () => {
    const parser = new LiteParse({ ocrEnabled: true, outputFormat: "text" });

    await parser.parse("doc1.pdf");
    await parser.parse("doc2.pdf");

    expect(mockTerminate).not.toHaveBeenCalled();
    expect(mockRecognize).toHaveBeenCalled();
  });

  it("terminates Tesseract workers when destroy() is called", async () => {
    const parser = new LiteParse({ ocrEnabled: true, outputFormat: "text" });

    await parser.parse("doc1.pdf");
    await parser.destroy();

    expect(mockTerminate).toHaveBeenCalledTimes(1);
  });

  it("destroy() is safe when OCR is disabled", async () => {
    const parser = new LiteParse({ ocrEnabled: false });
    await expect(parser.destroy()).resolves.toBeUndefined();
    expect(mockTerminate).not.toHaveBeenCalled();
  });
});
