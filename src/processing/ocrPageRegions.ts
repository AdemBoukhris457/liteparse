import sharp from "sharp";
import type { Image } from "../engines/pdf/interface.js";
import type { OcrResult } from "../engines/ocr/interface.js";

/** How broadly to run OCR on a page. */
export type OcrScope = "selective" | "full";

export interface PageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageImageCrop {
  buffer: Buffer;
  /** Crop origin in full-page render pixels (top-left). */
  offsetXPx: number;
  offsetYPx: number;
}

const REGION_MATCH_TOLERANCE_PT = 5;

/**
 * Decide full-page vs per-image OCR for a page.
 */
export function resolveOcrPlan(
  ocrScope: OcrScope,
  textLength: number,
  rawImageCount: number,
  filteredImageCount: number
): { needsFullPageOcr: boolean; needsImageRegionOcr: boolean } {
  if (ocrScope === "full") {
    return {
      needsFullPageOcr: textLength < 100 || rawImageCount > 0,
      needsImageRegionOcr: false,
    };
  }

  return {
    needsFullPageOcr: textLength < 100,
    needsImageRegionOcr: textLength >= 100 && filteredImageCount > 0,
  };
}

/**
 * Crop embedded image regions from a full-page render for selective OCR.
 */
export async function cropPageImageToRegions(
  pageBuffer: Buffer,
  pageWidthPt: number,
  pageHeightPt: number,
  dpi: number,
  images: Image[]
): Promise<PageImageCrop[]> {
  if (images.length === 0) {
    return [];
  }

  const metadata = await sharp(pageBuffer).metadata();
  const pageWidthPx = metadata.width ?? Math.max(1, Math.round((pageWidthPt * dpi) / 72));
  const pageHeightPx = metadata.height ?? Math.max(1, Math.round((pageHeightPt * dpi) / 72));

  const scaleX = pageWidthPx / pageWidthPt;
  const scaleY = pageHeightPx / pageHeightPt;

  const crops: PageImageCrop[] = [];

  for (const image of images) {
    const left = Math.max(0, Math.floor(image.x * scaleX));
    const top = Math.max(0, Math.floor(image.y * scaleY));
    const width = Math.min(pageWidthPx - left, Math.max(1, Math.ceil(image.width * scaleX)));
    const height = Math.min(pageHeightPx - top, Math.max(1, Math.ceil(image.height * scaleY)));

    if (width < 1 || height < 1) {
      continue;
    }

    const buffer = await sharp(pageBuffer).extract({ left, top, width, height }).png().toBuffer();

    crops.push({ buffer, offsetXPx: left, offsetYPx: top });
  }

  return crops;
}

/**
 * Map OCR bounding boxes from crop space into full-page render pixel space.
 */
export function offsetOcrResults(
  results: OcrResult[],
  offsetXPx: number,
  offsetYPx: number
): OcrResult[] {
  if (offsetXPx === 0 && offsetYPx === 0) {
    return results;
  }

  return results.map((result) => ({
    ...result,
    bbox: [
      result.bbox[0] + offsetXPx,
      result.bbox[1] + offsetYPx,
      result.bbox[2] + offsetXPx,
      result.bbox[3] + offsetYPx,
    ] as [number, number, number, number],
  }));
}

/**
 * Whether an OCR box (full-page render pixels) overlaps any image region (PDF points).
 */
export function overlapsImageRegions(
  ocrBboxPx: number[],
  images: Image[],
  scaleFactor: number,
  tolerancePt: number = REGION_MATCH_TOLERANCE_PT
): boolean {
  const ocrX = ocrBboxPx[0] * scaleFactor;
  const ocrY = ocrBboxPx[1] * scaleFactor;
  const ocrW = (ocrBboxPx[2] - ocrBboxPx[0]) * scaleFactor;
  const ocrH = (ocrBboxPx[3] - ocrBboxPx[1]) * scaleFactor;

  for (const image of images) {
    const overlapX =
      ocrX < image.x + image.width + tolerancePt && ocrX + ocrW > image.x - tolerancePt;
    const overlapY =
      ocrY < image.y + image.height + tolerancePt && ocrY + ocrH > image.y - tolerancePt;
    if (overlapX && overlapY) {
      return true;
    }
  }

  return false;
}

/**
 * Whether an OCR box (full-page render pixels) overlaps a rectangular region (PDF points).
 */
export function overlapsPageRegions(
  ocrBboxPx: number[],
  regions: PageRegion[],
  scaleFactor: number,
  tolerancePt: number = REGION_MATCH_TOLERANCE_PT
): boolean {
  const ocrX = ocrBboxPx[0] * scaleFactor;
  const ocrY = ocrBboxPx[1] * scaleFactor;
  const ocrW = (ocrBboxPx[2] - ocrBboxPx[0]) * scaleFactor;
  const ocrH = (ocrBboxPx[3] - ocrBboxPx[1]) * scaleFactor;

  for (const region of regions) {
    const overlapX =
      ocrX < region.x + region.width + tolerancePt && ocrX + ocrW > region.x - tolerancePt;
    const overlapY =
      ocrY < region.y + region.height + tolerancePt && ocrY + ocrH > region.y - tolerancePt;
    if (overlapX && overlapY) {
      return true;
    }
  }

  return false;
}
