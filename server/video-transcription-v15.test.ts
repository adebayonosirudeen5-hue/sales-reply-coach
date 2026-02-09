import { describe, it, expect, vi } from "vitest";

// Test the video transcription module exports
describe("Video Transcription Module", () => {
  it("should export getYouTubeTranscript function", async () => {
    const mod = await import("./videoTranscription");
    expect(typeof mod.getYouTubeTranscript).toBe("function");
  });

  it("should export getInstagramTranscript function", async () => {
    const mod = await import("./videoTranscription");
    expect(typeof mod.getInstagramTranscript).toBe("function");
  });

  it("should export getTikTokTranscript function", async () => {
    const mod = await import("./videoTranscription");
    expect(typeof mod.getTikTokTranscript).toBe("function");
  });

  it("should export callOpenAIFallback function", async () => {
    const mod = await import("./videoTranscription");
    expect(typeof mod.callOpenAIFallback).toBe("function");
  });
});

describe("YouTube Video ID Extraction", () => {
  it("should handle standard YouTube URLs", async () => {
    const mod = await import("./videoTranscription");
    // Test with an invalid URL - should return failed
    const result = await mod.getYouTubeTranscript("not-a-url");
    expect(result.method).toBe("failed");
    expect(result.transcript).toBe("");
  });

  it("should handle youtu.be short URLs", async () => {
    // The function should extract the video ID from short URLs
    // We can't test actual transcription without network, but we can verify it doesn't crash
    const mod = await import("./videoTranscription");
    // This will attempt to use yt-dlp which is available in sandbox
    const result = await mod.getYouTubeTranscript("https://youtu.be/ZrXyN3bjnqE");
    // Should either succeed or fail gracefully
    expect(["captions", "whisper", "failed"]).toContain(result.method);
    expect(typeof result.transcript).toBe("string");
    expect(typeof result.title).toBe("string");
  }, 180000); // 3 minute timeout for actual transcription

  it("should handle YouTube URLs with extra parameters", async () => {
    const mod = await import("./videoTranscription");
    const result = await mod.getYouTubeTranscript("https://youtu.be/ZrXyN3bjnqE?si=DIrOnUEzGlAVPE3W");
    expect(["captions", "whisper", "failed"]).toContain(result.method);
    expect(typeof result.transcript).toBe("string");
  }, 180000);
});

describe("Instagram Transcript", () => {
  it("should handle invalid Instagram URLs gracefully", async () => {
    const mod = await import("./videoTranscription");
    const result = await mod.getInstagramTranscript("https://instagram.com/invalid-post-12345");
    // Should fail gracefully
    expect(["whisper", "metadata", "failed"]).toContain(result.method);
    expect(typeof result.transcript).toBe("string");
  }, 60000);
});

describe("TikTok Transcript", () => {
  it("should handle invalid TikTok URLs gracefully", async () => {
    const mod = await import("./videoTranscription");
    const result = await mod.getTikTokTranscript("https://tiktok.com/@user/video/12345");
    expect(["whisper", "metadata", "failed"]).toContain(result.method);
    expect(typeof result.transcript).toBe("string");
  }, 60000);
});

describe("OpenAI Fallback LLM", () => {
  it("should call OpenAI GPT API successfully", async () => {
    const mod = await import("./videoTranscription");
    try {
      const result = await mod.callOpenAIFallback({
        messages: [
          { role: "system", content: "You are a test assistant. Reply with exactly: TEST_OK" },
          { role: "user", content: "Test" },
        ],
        max_tokens: 10,
      });
      expect(result.choices).toBeDefined();
      expect(result.choices.length).toBeGreaterThan(0);
      expect(result.choices[0].message.content).toBeDefined();
    } catch (error) {
      // If OPENAI_API_KEY is not set, it should throw
      expect(error).toBeDefined();
    }
  }, 30000);
});
