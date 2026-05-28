import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function verifyApiSession(req: Request): Promise<{ valid: boolean; userId?: string }> {
  try {
    const authHeader = req.headers.get("x-session-token");
    const userIdHeader = req.headers.get("x-user-id");

    if (!authHeader || !userIdHeader) {
      return { valid: false };
    }

    const { data } = await supabase
      .from("sessions")
      .select("session_token, expires_at")
      .eq("user_id", userIdHeader)
      .maybeSingle();

    if (!data || data.session_token !== authHeader) {
      return { valid: false };
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { valid: false };
    }

    return { valid: true, userId: userIdHeader };
  } catch {
    return { valid: false };
  }
}
