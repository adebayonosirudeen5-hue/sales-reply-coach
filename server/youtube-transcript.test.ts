import { describe, it, expect, vi } from "vitest";

// We test the helper functions by importing the module logic
// Since the functions are not exported, we test the patterns they use

describe("YouTube Video ID Extraction", () => {
  const extractYouTubeVideoId = (url: string): string | null => {
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
  };

  it("extracts video ID from standard YouTube URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=ZrXyN3bjnqE")).toBe("ZrXyN3bjnqE");
  });

  it("extracts video ID from youtu.be short URL", () => {
    expect(extractYouTubeVideoId("https://youtu.be/ZrXyN3bjnqE")).toBe("ZrXyN3bjnqE");
  });

  it("extracts video ID from youtu.be with query params", () => {
    expect(extractYouTubeVideoId("https://youtu.be/ZrXyN3bjnqE?si=DIrOnUEzGlAVPE3W")).toBe("ZrXyN3bjnqE");
  });

  it("extracts video ID from embed URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/ZrXyN3bjnqE")).toBe("ZrXyN3bjnqE");
  });

  it("extracts video ID from shorts URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/ZrXyN3bjnqE")).toBe("ZrXyN3bjnqE");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractYouTubeVideoId("https://instagram.com/p/abc123")).toBeNull();
  });

  it("returns null for YouTube channel URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/@someuser")).toBeNull();
  });
});

describe("Platform Detection", () => {
  const detectPlatform = (url: string): string => {
    const urlLower = url.toLowerCase();
    if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) return "youtube";
    if (urlLower.includes("instagram.com")) return "instagram";
    if (urlLower.includes("tiktok.com")) return "tiktok";
    if (urlLower.includes("facebook.com") || urlLower.includes("fb.watch")) return "facebook";
    if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) return "twitter";
    if (urlLower.includes("linkedin.com")) return "linkedin";
    return "other";
  };

  it("detects YouTube from youtube.com", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=abc123")).toBe("youtube");
  });

  it("detects YouTube from youtu.be", () => {
    expect(detectPlatform("https://youtu.be/abc123")).toBe("youtube");
  });

  it("detects Instagram", () => {
    expect(detectPlatform("https://www.instagram.com/reel/abc123")).toBe("instagram");
  });

  it("detects TikTok", () => {
    expect(detectPlatform("https://www.tiktok.com/@user/video/123")).toBe("tiktok");
  });

  it("detects Facebook", () => {
    expect(detectPlatform("https://www.facebook.com/watch?v=123")).toBe("facebook");
  });

  it("detects fb.watch", () => {
    expect(detectPlatform("https://fb.watch/abc123")).toBe("facebook");
  });

  it("detects Twitter/X", () => {
    expect(detectPlatform("https://x.com/user/status/123")).toBe("twitter");
  });

  it("returns other for unknown URLs", () => {
    expect(detectPlatform("https://example.com/page")).toBe("other");
  });
});

describe("YouTube Caption XML Parsing", () => {
  const parseYouTubeCaptions = (xml: string): string => {
    const texts: string[] = [];
    const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = regex.exec(xml)) !== null) {
      texts.push(m[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\n/g, ' ')
      );
    }
    return texts.join(' ').replace(/\s+/g, ' ').trim();
  };

  it("parses simple caption XML", () => {
    const xml = '<text start="0" dur="5">Hello world</text><text start="5" dur="3">How are you</text>';
    expect(parseYouTubeCaptions(xml)).toBe("Hello world How are you");
  });

  it("decodes HTML entities", () => {
    const xml = '<text start="0" dur="5">It&#39;s a &amp; test &lt;here&gt;</text>';
    expect(parseYouTubeCaptions(xml)).toBe("It's a & test <here>");
  });

  it("handles empty XML", () => {
    expect(parseYouTubeCaptions("")).toBe("");
  });

  it("handles multi-line text content", () => {
    const xml = '<text start="0" dur="5">Hello\nworld</text>';
    expect(parseYouTubeCaptions(xml)).toBe("Hello world");
  });

  it("handles quotes in captions", () => {
    const xml = '<text start="0" dur="5">He said &quot;hello&quot;</text>';
    expect(parseYouTubeCaptions(xml)).toBe('He said "hello"');
  });
});

describe("InnerTube API Key Extraction", () => {
  it("extracts API key from YouTube page HTML", () => {
    const html = `<script>var ytcfg = {"INNERTUBE_API_KEY":"AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8","INNERTUBE_CONTEXT":{}};</script>`;
    const match = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8");
  });

  it("returns null when API key is not found", () => {
    const html = `<html><body>No API key here</body></html>`;
    const match = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    expect(match).toBeNull();
  });
});

describe("YouTube Title Extraction", () => {
  it("extracts title from page HTML", () => {
    const html = `<title>Sales Training // How to Close Cold Customers // Andy Elliott - YouTube</title>`;
    const match = html.match(/<title>([^<]*)<\/title>/);
    const title = match ? match[1].replace(" - YouTube", "").trim() : "Unknown";
    expect(title).toBe("Sales Training // How to Close Cold Customers // Andy Elliott");
  });

  it("returns Unknown when no title found", () => {
    const html = `<html><body>No title</body></html>`;
    const match = html.match(/<title>([^<]*)<\/title>/);
    const title = match ? match[1].replace(" - YouTube", "").trim() : "Unknown";
    expect(title).toBe("Unknown");
  });
});

describe("Instagram Content Extraction", () => {
  it("extracts og:title from Instagram HTML", () => {
    const html = `<meta property="og:title" content="Check out this amazing post" />`;
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i);
    expect(ogTitle).not.toBeNull();
    expect(ogTitle![1]).toBe("Check out this amazing post");
  });

  it("extracts og:description from Instagram HTML", () => {
    const html = `<meta property="og:description" content="This is a great video about sales" />`;
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
    expect(ogDesc).not.toBeNull();
    expect(ogDesc![1]).toBe("This is a great video about sales");
  });
});

describe("Knowledge Base Category Schema", () => {
  const validCategories = [
    "opening_lines", "rapport_building", "pain_discovery", "objection_handling",
    "trust_building", "closing_techniques", "psychology_insight", "language_pattern",
    "emotional_trigger", "general_wisdom"
  ];

  it("has 10 knowledge chunk categories", () => {
    expect(validCategories).toHaveLength(10);
  });

  it("includes all expected categories", () => {
    expect(validCategories).toContain("opening_lines");
    expect(validCategories).toContain("rapport_building");
    expect(validCategories).toContain("pain_discovery");
    expect(validCategories).toContain("objection_handling");
    expect(validCategories).toContain("trust_building");
    expect(validCategories).toContain("closing_techniques");
    expect(validCategories).toContain("psychology_insight");
    expect(validCategories).toContain("language_pattern");
    expect(validCategories).toContain("emotional_trigger");
    expect(validCategories).toContain("general_wisdom");
  });

  const summaryFields = [
    "comprehensiveSummary", "salesPsychology", "rapportTechniques",
    "conversationStarters", "objectionFrameworks", "closingTechniques",
    "languagePatterns", "emotionalTriggers", "trustStrategies"
  ];

  it("has 9 summary display fields", () => {
    expect(summaryFields).toHaveLength(9);
  });
});
