import { vi, describe, it, expect, beforeEach } from "vitest";
import { OcrRecognitionError, OcrProcessingError } from "../engines/ocr/errors.js";

const { mockRenderPageImage, recognize } = vi.hoisted(() => ({
  mockRenderPageImage: vi.fn(async () => Buffer.from([1, 2, 3])),
  recognize: vi.fn(),
}));

const mockPdfDocument = { numPages: 1, data: new Uint8Array([1, 2, 3]) };

/** Page that triggers OCR: sparse text and an embedded image. */
const mockOcrPage = {
  pageNum: 1,
  width: 612,
  height: 792,
  textItems: [],
  paths: [],
  images: [{ x: 0, y: 0, width: 100, height: 50 }],
  annotations: [],
};

const mockParsedPage = {
  pageNum: 1,
  width: 612,
  height: 792,
  text: "",
  textItems: [],
};

vi.mock("../conversion/convertToPdf.js", async () => {
  const actual = await vi.importActual<typeof import("../conversion/convertToPdf.js")>(
    "../conversion/convertToPdf.js"
  );
  return {
    ...actual,
    convertToPdf: vi.fn(async () => ({
      pdfPath: "/tmp/test.pdf",
      originalExtension: ".pdf",
    })),
    cleanupConversionFiles: vi.fn(async () => {}),
  };
});

vi.mock("../engines/pdf/pdfjs.js", () => ({
  PdfJsEngine: vi.fn(
    class {
      loadDocument = vi.fn().mockResolvedValue(mockPdfDocument);
      extractAllPages = vi.fn().mockResolvedValue([mockOcrPage]);
      renderPageImage = mockRenderPageImage;
      close = vi.fn(async () => {});
    }
  ),
}));

vi.mock("../processing/grid.js", () => ({
  projectPagesToGrid: vi.fn(async (pages: Array<{ ocrFailed?: boolean; ocrError?: string }>) => [
    {
      ...mockParsedPage,
      ocrFailed: pages[0]?.ocrFailed,
      ocrError: pages[0]?.ocrError,
    },
  ]),
}));

vi.mock("../processing/bbox.js", () => ({
  buildBoundingBoxes: vi.fn().mockReturnValue([]),
}));

vi.mock("../engines/ocr/tesseract.js", () => ({
  TesseractEngine: vi.fn(
    class {
      terminate = vi.fn(async () => {});
      recognize = recognize;
    }
  ),
}));

import { LiteParse } from "./parser.js";

describe("LiteParse OCR failures", () => {
  beforeEach(() => {
    recognize.mockReset();
    mockRenderPageImage.mockReset();
    mockRenderPageImage.mockResolvedValue(Buffer.from([1, 2, 3]));
  });

  it("records ocrFailed and ocrWarnings when OCR fails (default)", async () => {
    recognize.mockRejectedValueOnce(
      new OcrRecognitionError("Tesseract OCR failed for <buffer>: boom")
    );

    const parser = new LiteParse({ ocrEnabled: true, outputFormat: "text" });
    const result = await parser.parse("scan.pdf");

    expect(result.ocrWarnings).toEqual([
      { page: 1, message: "Tesseract OCR failed for <buffer>: boom" },
    ]);
    expect(result.pages[0]?.ocrFailed).toBe(true);
    expect(result.pages[0]?.ocrError).toContain("boom");
  });

  it("includes ocrWarnings in JSON output", async () => {
    recognize.mockRejectedValueOnce(new OcrRecognitionError("HTTP OCR down"));

    const parser = new LiteParse({ ocrEnabled: true, outputFormat: "json" });
    const result = await parser.parse("scan.pdf");

    expect(result.json?.ocrWarnings).toEqual([{ page: 1, message: "HTTP OCR down" }]);
    expect(result.json?.pages[0]?.ocrFailed).toBe(true);
  });

  it("throws OcrProcessingError when failOnOcrError is true", async () => {
    recognize.mockRejectedValueOnce(new OcrRecognitionError("worker crashed"));

    const parser = new LiteParse({ ocrEnabled: true, failOnOcrError: true });

    await expect(parser.parse("scan.pdf")).rejects.toBeInstanceOf(OcrProcessingError);
  });

  it("marks page when renderPageImage fails", async () => {
    mockRenderPageImage.mockRejectedValueOnce(new Error("render failed"));

    const parser = new LiteParse({ ocrEnabled: true });
    const result = await parser.parse("scan.pdf");

    expect(recognize).not.toHaveBeenCalled();
    expect(result.ocrWarnings?.[0]?.message).toContain("render failed");
  });
});
