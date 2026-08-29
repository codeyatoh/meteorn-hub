import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const { data: existingClaim, error } = await supabaseAdmin
      .from("faucet_claims")
      .select("id")
      .eq("wallet_address", address.toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[Check Address API] Database Error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({
      used: !!existingClaim,
    });
  } catch (error) {
    console.error("[Check Address API] Internal Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
