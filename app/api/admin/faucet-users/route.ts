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

    // Fetch faucet stats
    const { data: usersData, error: statsError } = await supabase.from("faucet_user_stats").select("*");
    if (statsError) throw statsError;

    // Fetch auth users using admin API
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    // Merge the data
    const mergedData = (usersData || []).map((stat: { user_id: string; total_donated: number; total_claimed: number; claims_today: number }) => {
      const user = authData.users.find((u) => u.id === stat.user_id);
      return {
        ...stat,
        email: user?.email || null,
        nickname: user?.user_metadata?.nickname || null,
      };
    });

    return NextResponse.json(mergedData);
  } catch (error) {
    console.error("Error fetching faucet users:", error);
    return NextResponse.json({ error: "Failed to fetch faucet users" }, { status: 500 });
  }
}
