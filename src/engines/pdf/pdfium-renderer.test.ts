import { vi, describe, it, expect, beforeEach } from "vitest";
import { PdfiumRenderer } from "./pdfium-renderer";

const mockPDFiumPageRender = {
  width: 612,
  height: 792,
  originalWidth: 612,
  originalHeight: 792,
  data: new Uint8Array(612 * 792 * 4),
};

const mockPdfiumPage = {
  render: vi.fn(
    async (options: {
      render: (renderOptions: {
        width: number;
        height: number;
        data: Uint8Array;
      }) => Promise<unknown>;
    }) => {
      await options.render({
        width: mockPDFiumPageRender.width,
        height: mockPDFiumPageRender.height,
        data: mockPDFiumPageRender.data,
      });
      return mockPDFiumPageRender;
    }
  ),
};

const mockPdfiumDoc = {
  getPage: vi.fn(() => {
    return mockPdfiumPage;
  }),
  getPageCount: vi.fn(() => 3),
  destroy: vi.fn(),
};

const mockLoadDocument = vi.fn(async () => mockPdfiumDoc);

const mockPdfiumLibrary = {
  loadDocument: mockLoadDocument,
  close: vi.fn(async () => {}),
  destroy: vi.fn(),
};

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    promises: {
      readFile: vi.fn(async () => {
        return Buffer.from("mock file content");
      }),
    },
  };
});

vi.mock("@hyzyla/pdfium", async () => {
  const actual = await vi.importActual<typeof import("@hyzyla/pdfium")>("@hyzyla/pdfium");
  return {
    ...actual,
    PDFiumLibrary: vi.fn(
      class {
        constructor() {}

        static init() {
          return mockPdfiumLibrary;
        }

        loadDocument = mockLoadDocument;
        close = vi.fn(async () => {});
        destroy = vi.fn();
      }
    ),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadDocument.mockImplementation(async () => mockPdfiumDoc);
});

describe("test renderPageToBuffer", () => {
  it("test success", async () => {
    const renderer = new PdfiumRenderer();
    const result = await renderer.renderPageToBuffer("test.pdf", 1);
    expect(result).toStrictEqual(Buffer.from(mockPDFiumPageRender.data));
  });

  it("renderPage returns pixel dimensions from the render callback", async () => {
    const renderer = new PdfiumRenderer();
    const result = await renderer.renderPage("test.pdf", 1, 150);
    expect(result.width).toBe(612);
    expect(result.height).toBe(792);
    expect(result.imageBuffer).toStrictEqual(Buffer.from(mockPDFiumPageRender.data));
  });

  it("test error propagation", async () => {
    mockLoadDocument.mockImplementationOnce(async () => {
      throw new Error("loading error");
    });
    const renderer = new PdfiumRenderer();
    await expect(renderer.renderPageToBuffer("test.pdf", 1)).rejects.toThrow("loading error");
  });
});

describe("document caching", () => {
  it("loadDocument caches and reuses the document across multiple renderPageToBuffer calls", async () => {
    const renderer = new PdfiumRenderer();
    await renderer.loadDocument("test.pdf");

    expect(mockLoadDocument).toHaveBeenCalledTimes(1);

    await renderer.renderPageToBuffer("test.pdf", 1);
    await renderer.renderPageToBuffer("test.pdf", 2);
    await renderer.renderPageToBuffer("test.pdf", 3);

    // loadDocument was only called once (during the explicit loadDocument call),
    // not again for each renderPageToBuffer
    expect(mockLoadDocument).toHaveBeenCalledTimes(1);
    expect(mockPdfiumDoc.destroy).not.toHaveBeenCalled();

    await renderer.close();
    expect(mockPdfiumDoc.destroy).toHaveBeenCalledTimes(1);
  });

  it("without loadDocument, each call creates and destroys a temporary document", async () => {
    const renderer = new PdfiumRenderer();

    await renderer.renderPageToBuffer("test.pdf", 1);
    await renderer.renderPageToBuffer("test.pdf", 2);

    // Each call loads its own document
    expect(mockLoadDocument).toHaveBeenCalledTimes(2);
    // Each call destroys its temporary document
    expect(mockPdfiumDoc.destroy).toHaveBeenCalledTimes(2);
  });

  it("closeDocument destroys cached document", async () => {
    const renderer = new PdfiumRenderer();
    await renderer.loadDocument("test.pdf");

    expect(mockPdfiumDoc.destroy).not.toHaveBeenCalled();
    renderer.closeDocument();
    expect(mockPdfiumDoc.destroy).toHaveBeenCalledTimes(1);
  });

  it("close() also cleans up cached document", async () => {
    const renderer = new PdfiumRenderer();
    await renderer.loadDocument("test.pdf");

    await renderer.close();
    expect(mockPdfiumDoc.destroy).toHaveBeenCalledTimes(1);
  });

  it("getPageCount reads from the cached document", async () => {
    const renderer = new PdfiumRenderer();
    await renderer.loadDocument("test.pdf");
    expect(renderer.getPageCount()).toBe(3);
    expect(mockPdfiumDoc.getPageCount).toHaveBeenCalled();
  });

  it("getPageCount throws when no document is loaded", () => {
    const renderer = new PdfiumRenderer();
    expect(() => renderer.getPageCount()).toThrow(/loadDocument/i);
  });
});
