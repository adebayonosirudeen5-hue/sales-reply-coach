import { describe, it, expect } from "vitest";
import { sendVerificationEmail, generateVerificationCode } from "./_core/email";

describe("Email Sending", () => {
  it("should send verification email successfully", async () => {
    const testEmail = "benlewis4767@gmail.com"; // Must use verified email in Resend testing mode
    const code = generateVerificationCode();
    
    console.log("Testing email send to:", testEmail);
    console.log("Verification code:", code);
    
    const result = await sendVerificationEmail(testEmail, code);
    
    expect(result).toBe(true);
    expect(code).toMatch(/^\d{6}$/); // Verify code is 6 digits
  }, 10000); // 10 second timeout for API call
});
