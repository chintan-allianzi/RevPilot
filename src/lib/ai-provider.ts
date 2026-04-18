export interface AIProviderConfig {
  provider: "anthropic" | "openai" | "gemini";
  apiKey: string;
  model: string;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export async function callAIProvider(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: AIMessage[]
): Promise<string> {
  const { provider, apiKey, model } = config;

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Anthropic API error");
    return data.content?.[0]?.text || "Sorry, I couldn't generate a response.";
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "OpenAI API error");
    return data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Gemini API error");
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
  }

  throw new Error(`Unknown AI provider: ${provider}`);
}
