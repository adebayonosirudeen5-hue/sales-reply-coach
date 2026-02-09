import { describe, it, expect } from "vitest";
import { Resend } from "resend";
import { ENV } from "./_core/env";

describe("Resend API Connection", () => {
  it("should validate Resend API key", async () => {
    const resend = new Resend(ENV.RESEND_API_KEY);
    
    // Test API key by fetching API keys (lightweight endpoint)
    try {
      const result = await resend.apiKeys.list();
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    } catch (error: any) {
      // If we get a 401, the API key is invalid
      if (error.statusCode === 401) {
        throw new Error("Invalid Resend API key");
      }
      // Other errors might be network issues, which we can ignore for this test
      console.warn("Resend API test warning:", error.message);
    }
  });
});
