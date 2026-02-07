import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

describe("Supabase Connection", () => {
  it("should connect to Supabase with valid credentials", async () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    expect(supabaseUrl).toBeDefined();
    expect(supabaseKey).toBeDefined();

    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Test connection by fetching database health
    const { data, error } = await supabase.from("users").select("count").limit(0);

    // Should not have authentication errors
    expect(error?.message).not.toContain("Invalid API key");
    expect(error?.message).not.toContain("JWT");
  });
});
