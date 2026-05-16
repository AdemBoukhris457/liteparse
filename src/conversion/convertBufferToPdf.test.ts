import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { convertBufferToPdf, convertToPdf, getTmpDir } from "./convertToPdf.js";

describe("convertBufferToPdf temp cleanup", () => {
  let previousTmpDir: string | undefined;
  let testTmpRoot: string;

  afterEach(async () => {
    if (previousTmpDir === undefined) {
      delete process.env.LITEPARSE_TMPDIR;
    } else {
      process.env.LITEPARSE_TMPDIR = previousTmpDir;
    }
    await fs.rm(testTmpRoot, { recursive: true, force: true }).catch(() => {});
  });

  async function withIsolatedTmpDir<T>(fn: () => Promise<T>): Promise<T> {
    previousTmpDir = process.env.LITEPARSE_TMPDIR;
    testTmpRoot = path.join(os.tmpdir(), `liteparse-cleanup-test-${Date.now()}`);
    await fs.mkdir(testTmpRoot, { recursive: true });
    process.env.LITEPARSE_TMPDIR = testTmpRoot;
    return fn();
  }

  async function listLiteparseDirs(): Promise<string[]> {
    const entries = await fs.readdir(testTmpRoot, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && e.name.startsWith("liteparse-")).map((e) => e.name);
  }

  it("removes staging temp dir on text passthrough", async () => {
    await withIsolatedTmpDir(async () => {
      const result = await convertBufferToPdf(Buffer.from("Hello, world\n", "utf-8"));
      expect(result).toEqual({ content: "Hello, world\n" });
      expect(await listLiteparseDirs()).toEqual([]);
    });
  });

  it("does not leave extra temp dirs for path-based text passthrough", async () => {
    await withIsolatedTmpDir(async () => {
      const txtPath = path.join(testTmpRoot, "sample.txt");
      await fs.writeFile(txtPath, "plain text content");

      const result = await convertToPdf(txtPath);
      expect(result).toEqual({ content: "plain text content" });
      expect(await listLiteparseDirs()).toEqual([]);
    });
  });
});

describe("getTmpDir", () => {
  it("respects LITEPARSE_TMPDIR", () => {
    const custom = path.join(os.tmpdir(), "custom-liteparse-root");
    const prev = process.env.LITEPARSE_TMPDIR;
    process.env.LITEPARSE_TMPDIR = custom;
    expect(getTmpDir()).toBe(custom);
    if (prev === undefined) {
      delete process.env.LITEPARSE_TMPDIR;
    } else {
      process.env.LITEPARSE_TMPDIR = prev;
    }
  });
});
