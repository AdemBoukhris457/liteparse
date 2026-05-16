import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { OcrEngine, OcrOptions, OcrResult } from "./interface.js";
import { OcrRecognitionError } from "./errors.js";

interface HttpOcrResponseItem {
  text: string;
  bbox: [number, number, number, number];
  confidence: number;
}

/**
 * HTTP-based OCR engine that conforms to LiteParse OCR API specification.
 *
 * The server must implement the API defined in OCR_API_SPEC.md:
 * - POST /ocr endpoint
 * - Accepts multipart/form-data with 'file' and 'language' fields
 * - Returns JSON: { results: [{ text, bbox: [x1,y1,x2,y2], confidence }] }
 *
 * See ocr/easyocr/ and ocr/paddleocr/ for example server implementations.
 */
export class HttpOcrEngine implements OcrEngine {
  name = "http-ocr";
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async recognize(image: string | Buffer, options: OcrOptions): Promise<OcrResult[]> {
    try {
      // Prepare request
      const formData = new FormData();
      if (typeof image === "string") {
        formData.append("file", fs.createReadStream(image));
      } else {
        formData.append("file", image, { filename: "image.png", contentType: "image/png" });
      }

      const language = Array.isArray(options.language) ? options.language[0] : options.language;
      formData.append("language", language);

      // Make HTTP request
      const response = await axios.post(this.serverUrl, formData, {
        headers: formData.getHeaders(),
        timeout: 60000,
      });

      // Parse response (conforming to OCR_API_SPEC.md)
      const { results } = response.data;

      if (!Array.isArray(results)) {
        throw new OcrRecognitionError(
          `OCR server response missing results array for ${typeof image === "string" ? image : "<buffer>"}`
        );
      }

      return results.map((item: HttpOcrResponseItem) => ({
        text: item.text,
        bbox: item.bbox,
        confidence: item.confidence,
      }));
    } catch (error) {
      if (error instanceof OcrRecognitionError) {
        throw error;
      }
      const label = typeof image === "string" ? image : "<buffer>";
      if (axios.isAxiosError(error)) {
        const detail =
          (error.response?.data as { error?: string } | undefined)?.error || error.message;
        const status = error.response?.status;
        const statusPart = status !== undefined ? ` (HTTP ${status})` : "";
        throw new OcrRecognitionError(`OCR HTTP request failed for ${label}${statusPart}: ${detail}`, {
          cause: error,
        });
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new OcrRecognitionError(`OCR failed for ${label}: ${message}`, { cause: error });
    }
  }

  async recognizeBatch(images: (string | Buffer)[], options: OcrOptions): Promise<OcrResult[][]> {
    const results: OcrResult[][] = [];
    for (const image of images) {
      const result = await this.recognize(image, options);
      results.push(result);
    }
    return results;
  }
}
