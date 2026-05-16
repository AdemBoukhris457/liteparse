import { ParseResult, ParsedPage, ParseResultJson } from "../core/types.js";

/**
 * Build JSON output from parsed pages
 */
export function buildJSON(
  pages: ParsedPage[],
  ocrWarnings?: ParseResultJson["ocrWarnings"]
): ParseResultJson {
  const json: ParseResultJson = {
    pages: pages.map((page) => ({
      page: page.pageNum,
      width: page.width,
      height: page.height,
      text: page.text,
      textItems: page.textItems.map((item) => ({
        text: item.str,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        fontName: item.fontName,
        fontSize: item.fontSize,
        confidence: item.confidence ?? 1.0,
      })),
      boundingBoxes: page.boundingBoxes || [],
      ...(page.ocrFailed !== undefined ? { ocrFailed: page.ocrFailed } : {}),
      ...(page.ocrError !== undefined ? { ocrError: page.ocrError } : {}),
    })),
  };
  if (ocrWarnings && ocrWarnings.length > 0) {
    json.ocrWarnings = ocrWarnings;
  }
  return json;
}

/**
 * Format result as JSON string
 */
export function formatJSON(result: ParseResult): string {
  const jsonData = buildJSON(result.pages, result.ocrWarnings);
  return JSON.stringify(jsonData, null, 2);
}
