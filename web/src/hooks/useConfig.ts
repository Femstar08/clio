import { useState, useEffect, useCallback } from "react";

export interface TokenStatus {
  set: boolean;
  masked: string;
}

export interface AppConfig {
  provider: string;
  onboarded: boolean;
  providers: {
    claude: Record<string, unknown>;
    codex: Record<string, unknown>;
    openai: { model?: string };
    openrouter: { model?: string };
    ollama: { model?: string; baseUrl?: string };
  };
  channels: {
    active: string;
    web: { port: number; host: string };
    telegram: { allowedChatIds?: string[] };
    [key: string]: unknown;
  };
  heartbeat: {
    enabled: boolean;
    intervalMinutes: number;
    activeHours: { start: string; end: string };
  };
  memory: {
    mode: "full" | "simple" | "none";
    embeddings: { enabled: boolean; provider: string };
  };
  tokenStatus?: Record<string, TokenStatus>;
}

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setConfig(data);
      setError(null);
    } catch {
      setError("Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: AppConfig) => {
    try {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      setConfig(newConfig);
      setError(null);
    } catch {
      setError("Failed to save config");
    }
  }, []);

  const updateTokens = useCallback(
    async (tokens: Record<string, string>) => {
      try {
        const res = await fetch("/api/tokens", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tokens),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Failed to save tokens");
        }
        // Refetch config to get updated tokenStatus
        await fetchConfig();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save tokens");
      }
    },
    [fetchConfig],
  );

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  return { config, loading, error, updateConfig, updateTokens, refetch: fetchConfig };
}
