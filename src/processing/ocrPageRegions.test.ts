import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  cropPageImageToRegions,
  offsetOcrResults,
  overlapsImageRegions,
  resolveOcrPlan,
} from "./ocrPageRegions.js";

describe("resolveOcrPlan", () => {
  it("selective: full page only when text is sparse", () => {
    expect(resolveOcrPlan("selective", 50, 3, 2)).toEqual({
      needsFullPageOcr: true,
      needsImageRegionOcr: false,
    });
  });

  it("selective: image regions when text-heavy page has images", () => {
    expect(resolveOcrPlan("selective", 500, 2, 1)).toEqual({
      needsFullPageOcr: false,
      needsImageRegionOcr: true,
    });
  });

  it("selective: skip OCR when text-heavy and no filtered images", () => {
    expect(resolveOcrPlan("selective", 500, 0, 0)).toEqual({
      needsFullPageOcr: false,
      needsImageRegionOcr: false,
    });
  });

  it("full: legacy behavior triggers full page when images exist", () => {
    expect(resolveOcrPlan("full", 500, 1, 1)).toEqual({
      needsFullPageOcr: true,
      needsImageRegionOcr: false,
    });
  });
});

describe("offsetOcrResults", () => {
  it("shifts bounding boxes by crop offset", () => {
    const results = offsetOcrResults(
      [{ text: "hi", bbox: [10, 20, 30, 40], confidence: 0.9 }],
      100,
      50
    );
    expect(results[0]?.bbox).toEqual([110, 70, 130, 90]);
  });
});

describe("overlapsImageRegions", () => {
  it("detects overlap between OCR box and image region", () => {
    const scaleFactor = 72 / 150;
    const images = [{ x: 100, y: 200, width: 80, height: 40 }];
    const ocrBboxPx = [100 / scaleFactor, 200 / scaleFactor, 150 / scaleFactor, 240 / scaleFactor];
    expect(overlapsImageRegions(ocrBboxPx, images, scaleFactor)).toBe(true);
  });
});

describe("cropPageImageToRegions", () => {
  it("extracts image-sized crops from a page render", async () => {
    const pageWidthPt = 612;
    const pageHeightPt = 792;
    const dpi = 150;
    const pageWidthPx = Math.round((pageWidthPt * dpi) / 72);
    const pageHeightPx = Math.round((pageHeightPt * dpi) / 72);

    const pageBuffer = await sharp({
      create: {
        width: pageWidthPx,
        height: pageHeightPx,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const crops = await cropPageImageToRegions(pageBuffer, pageWidthPt, pageHeightPt, dpi, [
      { x: 50, y: 60, width: 120, height: 80 },
    ]);

    expect(crops).toHaveLength(1);
    const meta = await sharp(crops[0]!.buffer).metadata();
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
    expect(crops[0]!.offsetXPx).toBeGreaterThanOrEqual(0);
    expect(crops[0]!.offsetYPx).toBeGreaterThanOrEqual(0);
  });
});
