import { describe, expect, it } from "vitest";

// Test the YouTube URL extraction helpers
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
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("facebook.com") || url.includes("fb.com")) return "facebook";
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (url.includes("linkedin.com")) return "linkedin";
  return "website";
}

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

  it("extracts video ID with extra query params", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractYouTubeVideoId("https://instagram.com/p/abc123")).toBeNull();
  });

  it("returns null for channel URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/@username")).toBeNull();
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

  it("returns null for video URLs", () => {
    expect(extractYouTubeChannelId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractYouTubeChannelId("https://instagram.com/username")).toBeNull();
  });
});

describe("detectPlatform", () => {
  it("detects YouTube", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
  });

  it("detects Instagram", () => {
    expect(detectPlatform("https://www.instagram.com/p/abc")).toBe("instagram");
  });

  it("detects TikTok", () => {
    expect(detectPlatform("https://www.tiktok.com/@user/video/123")).toBe("tiktok");
  });

  it("detects Facebook", () => {
    expect(detectPlatform("https://www.facebook.com/page")).toBe("facebook");
  });

  it("detects Twitter/X", () => {
    expect(detectPlatform("https://twitter.com/user/status/123")).toBe("twitter");
    expect(detectPlatform("https://x.com/user/status/123")).toBe("twitter");
  });

  it("detects LinkedIn", () => {
    expect(detectPlatform("https://www.linkedin.com/in/user")).toBe("linkedin");
  });

  it("defaults to website for unknown URLs", () => {
    expect(detectPlatform("https://example.com")).toBe("website");
  });
});
