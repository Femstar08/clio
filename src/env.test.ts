import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readEnvFile, writeEnvValue, maskToken, getNestedValue, deleteNestedValue } from "./env.js";

const tmpDir = join(import.meta.dirname, "..", ".test-tmp");

describe("readEnvFile", () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses KEY=VALUE pairs", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "FOO=bar\nBAZ=qux\n");
    const result = readEnvFile(envPath);
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("handles quoted values", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "KEY=\"value with spaces\"\nKEY2='single quoted'\n");
    const result = readEnvFile(envPath);
    expect(result.KEY).toBe("value with spaces");
    expect(result.KEY2).toBe("single quoted");
  });

  it("skips comments and empty lines", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "# comment\n\nFOO=bar\n");
    const result = readEnvFile(envPath);
    expect(result).toEqual({ FOO: "bar" });
  });

  it("returns empty object for missing file", () => {
    const result = readEnvFile(join(tmpDir, "nope"));
    expect(result).toEqual({});
  });

  it("filters to requested keys", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "A=1\nB=2\nC=3\n");
    const result = readEnvFile(envPath, ["A", "C"]);
    expect(result).toEqual({ A: "1", C: "3" });
  });
});

describe("writeEnvValue", () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates file and writes key", () => {
    const envPath = join(tmpDir, ".env");
    writeEnvValue(envPath, "FOO", "bar");
    const content = readFileSync(envPath, "utf-8");
    expect(content).toContain("FOO=bar");
    expect(readEnvFile(envPath)).toEqual({ FOO: "bar" });
  });

  it("updates existing key", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "FOO=old\nBAZ=keep\n");
    writeEnvValue(envPath, "FOO", "new");
    const result = readEnvFile(envPath);
    expect(result.FOO).toBe("new");
    expect(result.BAZ).toBe("keep");
  });

  it("appends new key to existing file", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "FOO=bar\n");
    writeEnvValue(envPath, "BAZ", "qux");
    const result = readEnvFile(envPath);
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("preserves comments", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "# My config\nFOO=bar\n");
    writeEnvValue(envPath, "FOO", "updated");
    const content = readFileSync(envPath, "utf-8");
    expect(content).toContain("# My config");
    expect(readEnvFile(envPath).FOO).toBe("updated");
  });
});

describe("maskToken", () => {
  it("masks normal token", () => {
    expect(maskToken("sk-test-1234567890")).toBe("sk-te***");
  });

  it("masks short token", () => {
    expect(maskToken("short")).toBe("***");
  });

  it("masks empty string", () => {
    expect(maskToken("")).toBe("***");
  });

  it("masks token of exactly 8 chars", () => {
    expect(maskToken("12345678")).toBe("***");
  });

  it("masks token of 9 chars", () => {
    expect(maskToken("123456789")).toBe("12345***");
  });
});

describe("getNestedValue", () => {
  it("gets deeply nested value", () => {
    const obj = { a: { b: { c: "found" } } };
    expect(getNestedValue(obj, ["a", "b", "c"])).toBe("found");
  });

  it("returns undefined for missing path", () => {
    const obj = { a: { b: 1 } };
    expect(getNestedValue(obj, ["a", "x", "y"])).toBeUndefined();
  });
});

describe("deleteNestedValue", () => {
  it("deletes deeply nested value", () => {
    const obj = { a: { b: { c: "delete-me", d: "keep" } } };
    const deleted = deleteNestedValue(obj, ["a", "b", "c"]);
    expect(deleted).toBe(true);
    expect(obj.a.b).toEqual({ d: "keep" });
  });

  it("returns false for missing path", () => {
    const obj = { a: { b: 1 } };
    expect(deleteNestedValue(obj, ["a", "x", "y"])).toBe(false);
  });
});
