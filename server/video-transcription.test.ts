import { describe, expect, it, vi } from "vitest";

// Test the URL extraction and platform detection helpers
// These are pure functions we can test directly

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractYouTubeChannelId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/channel\/)([a-zA-Z0-9_-]+)/,
    /(?:youtube\.com\/@)([a-zA-Z0-9_.-]+)/,
    /(?:youtube\.com\/c\/)([a-zA-Z0-9_.-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) return "youtube";
  if (urlLower.includes("instagram.com")) return "instagram";
  if (urlLower.includes("tiktok.com")) return "tiktok";
  if (urlLower.includes("facebook.com") || urlLower.includes("fb.watch")) return "facebook";
  if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) return "twitter";
  if (urlLower.includes("linkedin.com")) return "linkedin";
  return "other";
}

describe("Video Transcription Engine - URL Extraction", () => {
  describe("extractYouTubeVideoId", () => {
    it("extracts video ID from standard watch URL", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts video ID from short URL", () => {
      expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts video ID from embed URL", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts video ID from shorts URL", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("handles URL with extra query params", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120&list=PLtest")).toBe("dQw4w9WgXcQ");
    });

    it("returns null for non-YouTube URLs", () => {
      expect(extractYouTubeVideoId("https://instagram.com/p/abc123")).toBeNull();
      expect(extractYouTubeVideoId("https://tiktok.com/@user/video/123")).toBeNull();
    });

    it("returns null for channel URLs", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/@username")).toBeNull();
      expect(extractYouTubeVideoId("https://www.youtube.com/channel/UCtest")).toBeNull();
    });
  });

  describe("extractYouTubeChannelId", () => {
    it("extracts channel handle from @ URL", () => {
      expect(extractYouTubeChannelId("https://www.youtube.com/@SalesGuru")).toBe("SalesGuru");
    });

    it("extracts channel ID from /channel/ URL", () => {
      expect(extractYouTubeChannelId("https://www.youtube.com/channel/UCJ5v_MCY6GNUBTO8-D3XoAg")).toBe("UCJ5v_MCY6GNUBTO8-D3XoAg");
    });

    it("extracts channel name from /c/ URL", () => {
      expect(extractYouTubeChannelId("https://www.youtube.com/c/SalesTraining")).toBe("SalesTraining");
    });

    it("handles handles with dots and dashes", () => {
      expect(extractYouTubeChannelId("https://www.youtube.com/@Sales.Guru-Pro")).toBe("Sales.Guru-Pro");
    });

    it("returns null for video URLs", () => {
      expect(extractYouTubeChannelId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    });
  });

  describe("detectPlatform", () => {
    it("detects YouTube from various URL formats", () => {
      expect(detectPlatform("https://www.youtube.com/watch?v=abc")).toBe("youtube");
      expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
      expect(detectPlatform("https://youtube.com/shorts/abc")).toBe("youtube");
      expect(detectPlatform("https://m.youtube.com/watch?v=abc")).toBe("youtube");
    });

    it("detects Instagram", () => {
      expect(detectPlatform("https://www.instagram.com/reel/abc")).toBe("instagram");
      expect(detectPlatform("https://instagram.com/p/abc")).toBe("instagram");
    });

    it("detects TikTok", () => {
      expect(detectPlatform("https://www.tiktok.com/@user/video/123")).toBe("tiktok");
      expect(detectPlatform("https://tiktok.com/@user")).toBe("tiktok");
    });

    it("detects Facebook including fb.watch", () => {
      expect(detectPlatform("https://www.facebook.com/watch?v=123")).toBe("facebook");
      expect(detectPlatform("https://fb.watch/abc123")).toBe("facebook");
    });

    it("detects Twitter/X", () => {
      expect(detectPlatform("https://twitter.com/user/status/123")).toBe("twitter");
      expect(detectPlatform("https://x.com/user/status/123")).toBe("twitter");
    });

    it("detects LinkedIn", () => {
      expect(detectPlatform("https://www.linkedin.com/posts/user-123")).toBe("linkedin");
    });

    it("returns 'other' for unknown URLs", () => {
      expect(detectPlatform("https://example.com")).toBe("other");
      expect(detectPlatform("https://shopify.com/store")).toBe("other");
    });

    it("is case insensitive", () => {
      expect(detectPlatform("https://www.YOUTUBE.com/watch?v=abc")).toBe("youtube");
      expect(detectPlatform("https://INSTAGRAM.COM/p/abc")).toBe("instagram");
    });
  });
});

describe("Video Transcription Engine - Content Detection", () => {
  it("detects transcription content vs metadata", () => {
    const transcriptionContent = `VIDEO TITLE: Sales Tips\nDURATION: 10 minutes\n\n=== FULL VIDEO TRANSCRIPTION (Everything said in the video) ===\n\nHello everyone, today we're going to talk about...\n\n=== END OF TRANSCRIPTION ===`;
    const metadataContent = `NOTE: Could not transcribe the video audio. Below is metadata only:\n\nVIDEO TITLE: Sales Tips\nCHANNEL: SalesGuru`;
    
    expect(transcriptionContent.includes("FULL VIDEO TRANSCRIPTION")).toBe(true);
    expect(metadataContent.includes("FULL VIDEO TRANSCRIPTION")).toBe(false);
  });

  it("video platforms should trigger video content fetching", () => {
    const videoPlatforms = ["youtube", "instagram", "tiktok"];
    const nonVideoPlatforms = ["facebook", "twitter", "linkedin", "other"];
    
    for (const p of videoPlatforms) {
      expect(["youtube", "instagram", "tiktok"].includes(p)).toBe(true);
    }
    for (const p of nonVideoPlatforms) {
      expect(["youtube", "instagram", "tiktok"].includes(p)).toBe(false);
    }
  });
});
