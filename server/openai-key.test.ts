import { describe, it, expect } from "vitest";

describe("OpenAI API Key Validation", () => {
  it("should validate OpenAI API key with a lightweight models endpoint call", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey!.startsWith("sk-")).toBe(true);

    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    // Check that whisper-1 model is available
    const whisperModel = data.data.find((m: any) => m.id === "whisper-1");
    expect(whisperModel).toBeDefined();
  }, 15000);
});
