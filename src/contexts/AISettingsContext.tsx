import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loadSettings, saveSettings, AppSettings } from "@/lib/settings-storage";

export type AIProvider = "anthropic" | "openai" | "gemini";

export const AI_MODELS: Record<AIProvider, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-opus-4-0-20250514", label: "Claude Opus 4" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  ],
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
};

interface AISettingsContextType {
  aiProvider: AIProvider;
  setAiProvider: (p: AIProvider) => void;
  aiKeys: Record<AIProvider, string>;
  setAiKey: (provider: AIProvider, key: string) => void;
  aiModel: Record<AIProvider, string>;
  setAiModel: (provider: AIProvider, model: string) => void;
  getActiveKey: () => string;
  getActiveModel: () => string;
  serviceKeys: Record<string, string>;
  setServiceKey: (service: string, key: string) => void;
  persistAll: () => void;
}

const AISettingsContext = createContext<AISettingsContextType | null>(null);

export function AISettingsProvider({ children }: { children: React.ReactNode }) {
  const [aiProvider, setAiProvider] = useState<AIProvider>("anthropic");
  const [aiKeys, setAiKeys] = useState<Record<AIProvider, string>>({ anthropic: "", openai: "", gemini: "" });
  const [aiModel, setAiModelState] = useState<Record<AIProvider, string>>({
    anthropic: "claude-sonnet-4-20250514",
    openai: "gpt-4o",
    gemini: "gemini-2.5-flash",
  });
  const [serviceKeys, setServiceKeys] = useState<Record<string, string>>({
    apollo: "",
    clay: "",
    instantly: "",
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadSettings();
    if (saved) {
      setAiProvider(saved.aiProvider.selected);
      setAiKeys({
        anthropic: saved.aiProvider.anthropicKey || "",
        openai: saved.aiProvider.openaiKey || "",
        gemini: saved.aiProvider.geminiKey || "",
      });
      setAiModelState({
        anthropic: saved.aiProvider.anthropicModel || "claude-sonnet-4-20250514",
        openai: saved.aiProvider.openaiModel || "gpt-4o",
        gemini: saved.aiProvider.geminiModel || "gemini-2.5-flash",
      });
      setServiceKeys({
        apollo: saved.apiKeys.apollo || "",
        clay: saved.apiKeys.clay || "",
        instantly: saved.apiKeys.instantly || "",
      });
    }
  }, []);

  const setAiKey = (provider: AIProvider, key: string) =>
    setAiKeys((prev) => ({ ...prev, [provider]: key }));

  const setAiModel = (provider: AIProvider, model: string) =>
    setAiModelState((prev) => ({ ...prev, [provider]: model }));

  const setServiceKey = (service: string, key: string) =>
    setServiceKeys((prev) => ({ ...prev, [service]: key }));

  const getActiveKey = () => aiKeys[aiProvider];
  const getActiveModel = () => aiModel[aiProvider];

  const persistAll = useCallback(() => {
    const settings: AppSettings = {
      apiKeys: {
        apollo: serviceKeys.apollo || "",
        clay: serviceKeys.clay || "",
        instantly: serviceKeys.instantly || "",
      },
      aiProvider: {
        selected: aiProvider,
        anthropicKey: aiKeys.anthropic || "",
        anthropicModel: aiModel.anthropic || "claude-sonnet-4-20250514",
        openaiKey: aiKeys.openai || "",
        openaiModel: aiModel.openai || "gpt-4o",
        geminiKey: aiKeys.gemini || "",
        geminiModel: aiModel.gemini || "gemini-2.5-flash",
      },
    };
    saveSettings(settings);
  }, [aiProvider, aiKeys, aiModel, serviceKeys]);

  return (
    <AISettingsContext.Provider
      value={{ aiProvider, setAiProvider, aiKeys, setAiKey, aiModel, setAiModel, getActiveKey, getActiveModel, serviceKeys, setServiceKey, persistAll }}
    >
      {children}
    </AISettingsContext.Provider>
  );
}

export function useAISettings() {
  const ctx = useContext(AISettingsContext);
  if (!ctx) throw new Error("useAISettings must be used within AISettingsProvider");
  return ctx;
}
