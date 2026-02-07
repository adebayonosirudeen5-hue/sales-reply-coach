import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_KEY);

export interface SupabaseUser {
  id: string;
  email: string;
  name?: string;
}

/**
 * Verify Supabase JWT token and return user info
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseUser | null> {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email!,
      name: data.user.user_metadata?.name || data.user.email?.split("@")[0],
    };
  } catch (error) {
    console.error("[Supabase Auth] Token verification failed:", error);
    return null;
  }
}

/**
 * Get or create user from Supabase auth
 */
export async function getOrCreateSupabaseUser(supabaseUser: SupabaseUser) {
  const { upsertUser, getUserByOpenId } = await import("../db");
  
  const openId = `supabase:${supabaseUser.id}`;
  
  // Upsert the user
  await upsertUser({
    openId,
    name: supabaseUser.name,
    email: supabaseUser.email,
    loginMethod: "supabase",
  });
  
  // Fetch and return the user
  const user = await getUserByOpenId(openId);
  if (!user) {
    throw new Error("Failed to create user");
  }
  
  return user;
}
