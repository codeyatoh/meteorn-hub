import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Fetch all users to get their nicknames
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Extract unique nicknames
    const nicknames = Array.from(new Set(
      users
        .map(u => u.user_metadata?.nickname)
        .filter(nickname => nickname && typeof nickname === "string")
    ));

    return NextResponse.json({ nicknames });
  } catch (err) {
    console.error("Unexpected error fetching nicknames:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
