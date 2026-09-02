import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role key to bypass RLS for admin dashboard
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: usersData, error } = await supabase.from("faucet_user_stats").select("*");

    if (error) {
      throw error;
    }

    return NextResponse.json(usersData);
  } catch (error) {
    console.error("Error fetching faucet users:", error);
    return NextResponse.json({ error: "Failed to fetch faucet users" }, { status: 500 });
  }
}
