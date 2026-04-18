import { AIProvider } from "@/contexts/AISettingsContext";

const SETTINGS_KEY = "ob_outbound_settings";

export interface AppSettings {
  apiKeys: {
    apollo: string;
    clay: string;
    instantly: string;
  };
  aiProvider: {
    selected: AIProvider;
    anthropicKey: string;
    anthropicModel: string;
    openaiKey: string;
    openaiModel: string;
    geminiKey: string;
    geminiModel: string;
  };
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    throw new Error("Failed to save settings");
  }
}

export function loadSettings(): AppSettings | null {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function getApiKey(service: "apollo" | "clay" | "instantly"): string {
  const settings = loadSettings();
  return settings?.apiKeys?.[service] || "";
}

export function getAIConfig(): { provider: AIProvider; apiKey: string; model: string } {
  const settings = loadSettings();
  if (!settings?.aiProvider) return { provider: "anthropic", apiKey: "", model: "" };
  const p = settings.aiProvider;
  switch (p.selected) {
    case "anthropic":
      return { provider: "anthropic", apiKey: p.anthropicKey, model: p.anthropicModel };
    case "openai":
      return { provider: "openai", apiKey: p.openaiKey, model: p.openaiModel };
    case "gemini":
      return { provider: "gemini", apiKey: p.geminiKey, model: p.geminiModel };
    default:
      return { provider: "anthropic", apiKey: "", model: "" };
  }
}

export async function validateApolloKey(key: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
      method: "POST",
      headers: { "X-Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ per_page: 1, page: 1 }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function validateAnthropicKey(key: string, model: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function validateOpenAIKey(key: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function validateGeminiKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    );
    return res.ok;
  } catch {
    return false;
  }
}
