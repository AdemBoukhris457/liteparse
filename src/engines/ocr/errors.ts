/**
 * Thrown when an OCR engine fails to recognize text from an image.
 */
export class OcrRecognitionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "OcrRecognitionError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown when {@link LiteParseConfig.failOnOcrError} is enabled and one or more pages fail OCR.
 */
export class OcrProcessingError extends Error {
  readonly failedPages: Array<{ page: number; message: string }>;

  constructor(failedPages: Array<{ page: number; message: string }>) {
    const summary = failedPages.map((f) => `page ${f.page}`).join(", ");
    super(`OCR failed on ${failedPages.length} page(s): ${summary}`);
    this.name = "OcrProcessingError";
    this.failedPages = failedPages;
  }
}
