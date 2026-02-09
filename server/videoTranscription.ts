/**
 * Video Transcription Service
 * 
 * Downloads audio from YouTube/Instagram/TikTok videos and transcribes
 * using OpenAI Whisper API to get the full spoken content.
 */
import { ENV } from "./_core/env";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

// Check if yt-dlp is available
let ytDlpAvailable: boolean | null = null;
async function isYtDlpAvailable(): Promise<boolean> {
  if (ytDlpAvailable !== null) return ytDlpAvailable;
  try {
    await execAsync("which yt-dlp", { timeout: 5000 });
    ytDlpAvailable = true;
  } catch {
    console.warn("[VideoTranscript] yt-dlp not found. Video transcription will be limited.");
    ytDlpAvailable = false;
  }
  return ytDlpAvailable;
}

// ============ YOUTUBE TRANSCRIPT ============

/**
 * Get full transcript from a YouTube video.
 * Strategy:
 * 1. Try YouTube's built-in captions via yt-dlp --write-subs
 * 2. If no captions, download audio and transcribe with OpenAI Whisper
 */
export async function getYouTubeTranscript(videoUrl: string): Promise<{
  transcript: string;
  title: string;
  method: "captions" | "whisper" | "failed";
}> {
  const videoId = extractYouTubeVideoId(videoUrl);
  if (!videoId) {
    return { transcript: "", title: "Unknown", method: "failed" };
  }

  // Check if yt-dlp is available
  if (!(await isYtDlpAvailable())) {
    console.warn("[VideoTranscript] yt-dlp not available, cannot transcribe YouTube video");
    return { transcript: "", title: "Unknown", method: "failed" };
  }

  const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-"));

  try {
    // First, get the video title
    let title = "Unknown";
    try {
      const { stdout } = await execAsync(
        `yt-dlp --get-title "${normalizedUrl}" 2>/dev/null`,
        { timeout: 30000 }
      );
      title = stdout.trim() || "Unknown";
    } catch {
      console.log("[VideoTranscript] Could not get video title");
    }

    // Strategy 1: Try to get existing captions/subtitles
    console.log(`[VideoTranscript] Trying to get captions for ${videoId}...`);
    try {
      const subsFile = path.join(tmpDir, "subs");
      await execAsync(
        `yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format vtt -o "${subsFile}" "${normalizedUrl}" 2>/dev/null`,
        { timeout: 60000 }
      );

      // Look for the downloaded subtitle file
      const files = fs.readdirSync(tmpDir);
      const subFile = files.find(f => f.endsWith(".vtt") || f.endsWith(".srt"));
      if (subFile) {
        const subContent = fs.readFileSync(path.join(tmpDir, subFile), "utf-8");
        const transcript = parseVTTToText(subContent);
        if (transcript.length > 100) {
          console.log(`[VideoTranscript] Got captions: ${transcript.length} chars`);
          return { transcript, title, method: "captions" };
        }
      }
    } catch (e) {
      console.log("[VideoTranscript] No captions available, will try Whisper");
    }

    // Strategy 2: Download audio and transcribe with OpenAI Whisper
    console.log(`[VideoTranscript] Downloading audio for Whisper transcription...`);
    const audioPath = path.join(tmpDir, "audio.mp3");
    
    try {
      // Download audio only, convert to mp3, limit to 15 minutes for Whisper
      await execAsync(
        `yt-dlp -f "bestaudio[ext=m4a]/bestaudio" --extract-audio --audio-format mp3 --audio-quality 5 --postprocessor-args "-t 900" -o "${audioPath}" "${normalizedUrl}" 2>/dev/null`,
        { timeout: 120000 }
      );

      // Check if audio file was created
      if (!fs.existsSync(audioPath)) {
        // yt-dlp might have saved with different name
        const files = fs.readdirSync(tmpDir);
        const audioFile = files.find(f => f.endsWith(".mp3") || f.endsWith(".m4a") || f.endsWith(".webm"));
        if (audioFile) {
          fs.renameSync(path.join(tmpDir, audioFile), audioPath);
        }
      }

      if (fs.existsSync(audioPath)) {
        const stats = fs.statSync(audioPath);
        const sizeMB = stats.size / (1024 * 1024);
        console.log(`[VideoTranscript] Audio downloaded: ${sizeMB.toFixed(1)}MB`);

        if (sizeMB > 24) {
          // Split into chunks for large files
          const transcript = await transcribeLargeAudio(audioPath, tmpDir);
          return { transcript, title, method: "whisper" };
        } else {
          const transcript = await transcribeWithOpenAIWhisper(audioPath);
          return { transcript, title, method: "whisper" };
        }
      }
    } catch (e) {
      console.error("[VideoTranscript] Audio download failed:", e instanceof Error ? e.message : e);
    }

    return { transcript: "", title, method: "failed" };
  } finally {
    // Clean up temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

// ============ INSTAGRAM TRANSCRIPT ============

/**
 * Get content from an Instagram video/reel.
 * Strategy:
 * 1. Try yt-dlp to download video audio
 * 2. Transcribe with Whisper
 * 3. Fallback to oEmbed metadata
 */
export async function getInstagramTranscript(url: string): Promise<{
  transcript: string;
  title: string;
  method: "whisper" | "metadata" | "failed";
}> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ig-"));
  const hasYtDlp = await isYtDlpAvailable();

  try {
    // Strategy 1: Try yt-dlp to download Instagram video audio (if available)
    if (hasYtDlp) {
      console.log(`[VideoTranscript] Trying yt-dlp for Instagram: ${url}`);
      const audioPath = path.join(tmpDir, "audio.mp3");

      try {
        await execAsync(
          `yt-dlp -f "bestaudio/best" --extract-audio --audio-format mp3 --audio-quality 5 -o "${audioPath}" "${url}" 2>/dev/null`,
          { timeout: 120000 }
        );

        // Check for downloaded file
        if (!fs.existsSync(audioPath)) {
          const files = fs.readdirSync(tmpDir);
          const audioFile = files.find(f => f.endsWith(".mp3") || f.endsWith(".m4a") || f.endsWith(".webm") || f.endsWith(".mp4"));
          if (audioFile) {
            // Convert to mp3 if needed
            const srcPath = path.join(tmpDir, audioFile);
            if (!audioFile.endsWith(".mp3")) {
              await execAsync(`ffmpeg -i "${srcPath}" -vn -acodec libmp3lame -q:a 5 "${audioPath}" 2>/dev/null`, { timeout: 60000 });
            } else {
              fs.renameSync(srcPath, audioPath);
            }
          }
        }

        if (fs.existsSync(audioPath)) {
          const stats = fs.statSync(audioPath);
          console.log(`[VideoTranscript] Instagram audio downloaded: ${(stats.size / (1024 * 1024)).toFixed(1)}MB`);
          
          const transcript = await transcribeWithOpenAIWhisper(audioPath);
          if (transcript.length > 50) {
            // Try to get title from yt-dlp
            let title = "Instagram Video";
            try {
              const { stdout } = await execAsync(`yt-dlp --get-title "${url}" 2>/dev/null`, { timeout: 15000 });
              title = stdout.trim() || "Instagram Video";
            } catch {}
            
            return { transcript, title, method: "whisper" };
          }
        }
      } catch (e) {
        console.log("[VideoTranscript] yt-dlp Instagram download failed:", e instanceof Error ? e.message : e);
      }
    }

    // Strategy 2: Fallback to oEmbed metadata
    console.log("[VideoTranscript] Falling back to Instagram oEmbed");
    try {
      const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&omitscript=true`;
      const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const data = await response.json();
        let content = "";
        if (data.title) content += data.title;
        if (data.author_name) content += `\nBy: ${data.author_name}`;
        return { transcript: content, title: data.title || "Instagram Post", method: "metadata" };
      }
    } catch {}

    return { transcript: "", title: "Instagram Video", method: "failed" };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

// ============ TIKTOK TRANSCRIPT ============

export async function getTikTokTranscript(url: string): Promise<{
  transcript: string;
  title: string;
  method: "whisper" | "metadata" | "failed";
}> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tt-"));
  const hasYtDlp = await isYtDlpAvailable();

  try {
    // Try yt-dlp for TikTok (if available)
    if (hasYtDlp) {
      console.log(`[VideoTranscript] Trying yt-dlp for TikTok: ${url}`);
      const audioPath = path.join(tmpDir, "audio.mp3");

      try {
        await execAsync(
          `yt-dlp -f "bestaudio/best" --extract-audio --audio-format mp3 --audio-quality 5 -o "${audioPath}" "${url}" 2>/dev/null`,
          { timeout: 120000 }
        );

        if (!fs.existsSync(audioPath)) {
          const files = fs.readdirSync(tmpDir);
          const audioFile = files.find(f => f.endsWith(".mp3") || f.endsWith(".m4a") || f.endsWith(".webm") || f.endsWith(".mp4"));
          if (audioFile) {
            const srcPath = path.join(tmpDir, audioFile);
            if (!audioFile.endsWith(".mp3")) {
              await execAsync(`ffmpeg -i "${srcPath}" -vn -acodec libmp3lame -q:a 5 "${audioPath}" 2>/dev/null`, { timeout: 60000 });
            } else {
              fs.renameSync(srcPath, audioPath);
            }
          }
        }

        if (fs.existsSync(audioPath)) {
          const transcript = await transcribeWithOpenAIWhisper(audioPath);
          if (transcript.length > 50) {
            let title = "TikTok Video";
            try {
              const { stdout } = await execAsync(`yt-dlp --get-title "${url}" 2>/dev/null`, { timeout: 15000 });
              title = stdout.trim() || "TikTok Video";
            } catch {}
            return { transcript, title, method: "whisper" };
          }
        }
      } catch (e) {
        console.log("[VideoTranscript] yt-dlp TikTok download failed:", e instanceof Error ? e.message : e);
      }
    }

    // Fallback to oEmbed
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const data = await response.json();
        return { transcript: data.title || "", title: data.title || "TikTok Video", method: "metadata" };
      }
    } catch {}

    return { transcript: "", title: "TikTok Video", method: "failed" };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

// ============ OPENAI WHISPER TRANSCRIPTION ============

/**
 * Transcribe an audio file using OpenAI's Whisper API
 */
async function transcribeWithOpenAIWhisper(audioFilePath: string): Promise<string> {
  const apiKey = ENV.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[VideoTranscript] OPENAI_API_KEY not configured");
    return "";
  }

  try {
    const audioBuffer = fs.readFileSync(audioFilePath);
    const fileName = path.basename(audioFilePath);
    const mimeType = fileName.endsWith(".mp3") ? "audio/mpeg" : 
                     fileName.endsWith(".m4a") ? "audio/mp4" :
                     fileName.endsWith(".webm") ? "audio/webm" : "audio/mpeg";

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", audioBlob, fileName);
    formData.append("model", "whisper-1");
    formData.append("response_format", "text");
    formData.append("language", "en");

    console.log(`[VideoTranscript] Sending ${(audioBuffer.length / (1024 * 1024)).toFixed(1)}MB to Whisper API...`);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VideoTranscript] Whisper API error: ${response.status} ${errorText}`);
      return "";
    }

    const transcript = await response.text();
    console.log(`[VideoTranscript] Whisper transcription: ${transcript.length} chars`);
    return transcript.trim();
  } catch (error) {
    console.error("[VideoTranscript] Whisper transcription failed:", error);
    return "";
  }
}

/**
 * Transcribe large audio files by splitting into chunks
 */
async function transcribeLargeAudio(audioPath: string, tmpDir: string): Promise<string> {
  console.log("[VideoTranscript] Splitting large audio into chunks...");
  
  try {
    // Split into 10-minute chunks (Whisper has 25MB limit)
    await execAsync(
      `ffmpeg -i "${audioPath}" -f segment -segment_time 600 -c copy "${tmpDir}/chunk_%03d.mp3" 2>/dev/null`,
      { timeout: 120000 }
    );

    const files = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith("chunk_") && f.endsWith(".mp3"))
      .sort();

    const transcripts: string[] = [];
    for (const file of files) {
      console.log(`[VideoTranscript] Transcribing chunk: ${file}`);
      const chunkPath = path.join(tmpDir, file);
      const transcript = await transcribeWithOpenAIWhisper(chunkPath);
      if (transcript) {
        transcripts.push(transcript);
      }
    }

    return transcripts.join(" ").trim();
  } catch (error) {
    console.error("[VideoTranscript] Large audio transcription failed:", error);
    // Try transcribing the original file directly (might get truncated)
    return await transcribeWithOpenAIWhisper(audioPath);
  }
}

// ============ OPENAI GPT FALLBACK LLM ============

/**
 * Call OpenAI GPT as a fallback when the built-in LLM fails.
 * Used for PDF processing and content analysis.
 */
export async function callOpenAIFallback(params: {
  messages: Array<{ role: string; content: any }>;
  response_format?: any;
  max_tokens?: number;
}): Promise<any> {
  const apiKey = ENV.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const payload: any = {
    model: "gpt-4o-mini",
    messages: params.messages,
    max_tokens: params.max_tokens || 16384,
  };

  if (params.response_format) {
    payload.response_format = params.response_format;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

// ============ HELPERS ============

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

/**
 * Parse VTT subtitle format to plain text
 */
function parseVTTToText(vtt: string): string {
  const lines = vtt.split("\n");
  const textLines: string[] = [];
  let prevLine = "";

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headers, timestamps, and empty lines
    if (!trimmed) continue;
    if (trimmed === "WEBVTT") continue;
    if (trimmed.startsWith("Kind:") || trimmed.startsWith("Language:")) continue;
    if (/^\d{2}:\d{2}/.test(trimmed)) continue; // Timestamp line
    if (/^\d+$/.test(trimmed)) continue; // Sequence number
    if (trimmed.startsWith("NOTE")) continue;

    // Remove HTML tags from caption text
    const cleanText = trimmed
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');

    // Deduplicate consecutive identical lines (common in auto-generated subs)
    if (cleanText && cleanText !== prevLine) {
      textLines.push(cleanText);
      prevLine = cleanText;
    }
  }

  return textLines.join(" ").replace(/\s+/g, " ").trim();
}
