import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockRenderPageImage, recognize } = vi.hoisted(() => ({
  mockRenderPageImage: vi.fn(async () => Buffer.from([1, 2, 3, 4, 5])),
  recognize: vi.fn(),
}));

const mockPdfDocument = { numPages: 1, data: new Uint8Array([1, 2, 3]) };

/** Text-heavy page with one embedded image (triggers old full-page OCR). */
const mockTextHeavyPageWithImage = {
  pageNum: 1,
  width: 612,
  height: 792,
  textItems: [{ str: "A".repeat(500), x: 10, y: 10, width: 400, height: 12 }],
  paths: [],
  images: [{ x: 50, y: 60, width: 120, height: 80 }],
  annotations: [],
};

const mockParsedPage = {
  pageNum: 1,
  width: 612,
  height: 792,
  text: "A".repeat(500),
  textItems: [],
};

vi.mock("../conversion/convertToPdf.js", async () => {
  const actual = await vi.importActual<typeof import("../conversion/convertToPdf.js")>(
    "../conversion/convertToPdf.js"
  );
  return {
    ...actual,
    convertToPdf: vi.fn(async () => ({ pdfPath: "/tmp/test.pdf", originalExtension: ".pdf" })),
    cleanupConversionFiles: vi.fn(async () => {}),
  };
});

vi.mock("../engines/pdf/pdfjs.js", () => ({
  PdfJsEngine: vi.fn(
    class {
      loadDocument = vi.fn().mockResolvedValue(mockPdfDocument);
      extractAllPages = vi.fn().mockResolvedValue([mockTextHeavyPageWithImage]);
      renderPageImage = mockRenderPageImage;
      close = vi.fn(async () => {});
    }
  ),
}));

vi.mock("../processing/grid.js", () => ({
  projectPagesToGrid: vi.fn(async () => [structuredClone(mockParsedPage)]),
}));

vi.mock("../processing/bbox.js", async () => {
  const actual =
    await vi.importActual<typeof import("../processing/bbox.js")>("../processing/bbox.js");
  return {
    ...actual,
    buildBoundingBoxes: vi.fn().mockReturnValue([]),
  };
});

vi.mock("../processing/ocrPageRegions.js", async () => {
  const actual = await vi.importActual<typeof import("../processing/ocrPageRegions.js")>(
    "../processing/ocrPageRegions.js"
  );
  return {
    ...actual,
    cropPageImageToRegions: vi.fn(async () => [
      { buffer: Buffer.from("crop-a"), offsetXPx: 10, offsetYPx: 20 },
      { buffer: Buffer.from("crop-b"), offsetXPx: 200, offsetYPx: 30 },
    ]),
  };
});

vi.mock("../engines/ocr/tesseract.js", () => ({
  TesseractEngine: vi.fn(
    class {
      terminate = vi.fn(async () => {});
      recognize = recognize;
    }
  ),
}));

import { LiteParse } from "./parser.js";
import { cropPageImageToRegions } from "../processing/ocrPageRegions.js";

describe("LiteParse selective OCR", () => {
  beforeEach(() => {
    recognize.mockReset();
    mockRenderPageImage.mockClear();
    recognize.mockResolvedValue([{ text: "LogoCo", bbox: [0, 0, 50, 20], confidence: 0.95 }]);
    vi.mocked(cropPageImageToRegions).mockClear();
  });

  it("OCRs image regions only on text-heavy pages (selective default)", async () => {
    const parser = new LiteParse({ ocrEnabled: true, ocrScope: "selective" });
    await parser.parse("deck.pdf");

    expect(mockRenderPageImage).toHaveBeenCalledTimes(1);
    expect(cropPageImageToRegions).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledTimes(2);
    expect(recognize.mock.calls[0]?.[0]).toEqual(Buffer.from("crop-a"));
    expect(recognize.mock.calls[1]?.[0]).toEqual(Buffer.from("crop-b"));
    expect(recognize).not.toHaveBeenCalledWith(Buffer.from([1, 2, 3, 4, 5]), expect.any(Object));
  });

  it("uses full-page OCR on text-heavy pages when ocrScope is full", async () => {
    const parser = new LiteParse({ ocrEnabled: true, ocrScope: "full" });
    await parser.parse("deck.pdf");

    expect(cropPageImageToRegions).not.toHaveBeenCalled();
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledWith(Buffer.from([1, 2, 3, 4, 5]), expect.any(Object));
  });
});
