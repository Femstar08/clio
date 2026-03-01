import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readEnvFile } from "../env.js";
import { setupApiRoutes } from "./web.js";

const tmpDir = join(import.meta.dirname, "../../.test-tmp-web");

describe("web adapter HTTP API", () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, "guides"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createTestApp(configOverrides?: Record<string, unknown>) {
    const configPath = join(tmpDir, "config.json");
    const envPath = join(tmpDir, ".env");
    const baseConfig = { provider: "claude", onboarded: false, ...configOverrides };
    writeFileSync(configPath, JSON.stringify(baseConfig));
    const app = new Hono();
    setupApiRoutes(app, { configPath, guidesDir: join(tmpDir, "guides"), envPath });
    return { app, configPath, envPath };
  }

  it("GET /api/health returns ok", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("GET /api/config returns config", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("claude");
  });

  it("PUT /api/config writes config file", async () => {
    const { app, configPath } = createTestApp();
    const newConfig = { provider: "openai", onboarded: true };
    const res = await app.request("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newConfig),
    });
    expect(res.status).toBe(200);
    const saved = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(saved.provider).toBe("openai");
    expect(saved.onboarded).toBe(true);
  });

  it("GET /api/docs lists available docs", async () => {
    writeFileSync(join(tmpDir, "guides", "getting-started.md"), "# Getting Started");
    writeFileSync(join(tmpDir, "guides", "commands.md"), "# Commands");
    const { app } = createTestApp();
    const res = await app.request("/api/docs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.docs).toContain("getting-started");
    expect(body.docs).toContain("commands");
  });

  it("GET /api/docs/:slug returns doc content", async () => {
    writeFileSync(join(tmpDir, "guides", "commands.md"), "# Commands\nList of commands");
    const { app } = createTestApp();
    const res = await app.request("/api/docs/commands");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("commands");
    expect(body.content).toContain("# Commands");
  });

  it("GET /api/docs/:slug returns 404 for missing doc", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/docs/nonexistent");
    expect(res.status).toBe(404);
  });

  it("GET /api/docs/:slug rejects path traversal", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/docs/..%2F..%2Fetc%2Fpasswd");
    expect(res.status).toBe(404);
  });

  it("PUT /api/config rejects non-object body", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify("not an object"),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/config strips tokens and includes tokenStatus", async () => {
    const { app } = createTestApp({
      providers: { openai: { apiKey: "sk-test-1234567890", model: "gpt-4o" } },
    });
    const res = await app.request("/api/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    // apiKey should be stripped
    expect(body.providers?.openai?.apiKey).toBeUndefined();
    // tokenStatus should exist with masking
    expect(body.tokenStatus).toBeDefined();
    expect(body.tokenStatus.OPENAI_API_KEY.set).toBe(true);
    expect(body.tokenStatus.OPENAI_API_KEY.masked).toBe("sk-te***");
  });

  it("GET /api/config shows env tokens in tokenStatus", async () => {
    const { app, envPath } = createTestApp();
    writeFileSync(envPath, "OPENAI_API_KEY=sk-env-secret-key\n");
    const res = await app.request("/api/config");
    const body = await res.json();
    expect(body.tokenStatus.OPENAI_API_KEY.set).toBe(true);
    expect(body.tokenStatus.OPENAI_API_KEY.masked).toBe("sk-en***");
  });

  it("PUT /api/config strips tokens from saved JSON", async () => {
    const { app, configPath } = createTestApp();
    const newConfig = {
      provider: "openai",
      onboarded: true,
      providers: { openai: { apiKey: "sk-should-be-stripped", model: "gpt-4o" } },
    };
    const res = await app.request("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newConfig),
    });
    expect(res.status).toBe(200);
    const saved = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(saved.providers?.openai?.apiKey).toBeUndefined();
    expect(saved.providers?.openai?.model).toBe("gpt-4o");
  });

  it("PUT /api/tokens writes to .env", async () => {
    const { app, envPath } = createTestApp();
    const res = await app.request("/api/tokens", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ OPENAI_API_KEY: "sk-new-key-123" }),
    });
    expect(res.status).toBe(200);
    const env = readEnvFile(envPath);
    expect(env.OPENAI_API_KEY).toBe("sk-new-key-123");
  });

  it("PUT /api/tokens rejects unknown keys", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/tokens", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ UNKNOWN_KEY: "value" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unknown token keys");
  });
});
