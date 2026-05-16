import { LiteParseConfig, ParseResult, ParsedPage, TextItem } from "./types.js";
import { buildJSON } from "../output/json.js";

/** Nominal page size (US Letter in PDF points) for text-only passthrough results. */
const TEXT_PASSTHROUGH_PAGE_WIDTH = 612;
const TEXT_PASSTHROUGH_PAGE_HEIGHT = 792;

/**
 * Build a single synthetic page for text-based passthrough inputs (.txt, .csv, etc.).
 */
export function buildTextPassthroughPages(content: string): ParsedPage[] {
  const textItem: TextItem = {
    str: content,
    x: 0,
    y: 0,
    width: TEXT_PASSTHROUGH_PAGE_WIDTH,
    height: TEXT_PASSTHROUGH_PAGE_HEIGHT,
    w: TEXT_PASSTHROUGH_PAGE_WIDTH,
    h: TEXT_PASSTHROUGH_PAGE_HEIGHT,
    fontName: "Text",
    fontSize: 12,
    confidence: 1.0,
  };

  return [
    {
      pageNum: 1,
      width: TEXT_PASSTHROUGH_PAGE_WIDTH,
      height: TEXT_PASSTHROUGH_PAGE_HEIGHT,
      text: content,
      textItems: [textItem],
      boundingBoxes: [],
    },
  ];
}

/**
 * Build a {@link ParseResult} for text-based passthrough, honoring {@link LiteParseConfig.outputFormat}.
 */
export function buildTextPassthroughResult(content: string, config: LiteParseConfig): ParseResult {
  const pages = buildTextPassthroughPages(content);
  const result: ParseResult = {
    pages,
    text: content,
  };

  if (config.outputFormat === "json") {
    result.json = buildJSON(pages);
  }

  return result;
}
