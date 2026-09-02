import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

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

    const mode = req.nextUrl.searchParams.get("mode");

    if (mode !== "settings") {
      const { data: existingClaims, error } = await supabaseAdmin
        .from("faucet_claims")
        .select("id")
        .eq("wallet_address", address.toLowerCase());

      if (error) {
        console.error("[Check Address API] Database Error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      if (existingClaims && existingClaims.length >= 2) {
        return NextResponse.json({ used: true, message: "Address already funded by faucet." });
      }
    }

    // Check if it's the hot wallet
    const privateKey = process.env.FAUCET_HOT_WALLET_PRIVATE_KEY;
    if (privateKey) {
      const ethers = (await import('ethers')).ethers;
      const hotWallet = new ethers.Wallet(privateKey);
      if (address.toLowerCase() === hotWallet.address.toLowerCase()) {
        return NextResponse.json({ used: true, message: "Security Error: Cannot claim to the Faucet Hot Wallet." });
      }
    }

    // Check if this wallet is linked to another user's profile metadata
    const userId = req.nextUrl.searchParams.get("userId");
    const { data: isUsedByAnother } = await supabaseAdmin.rpc("check_wallet_in_use", {
      check_wallet: address,
      exclude_user_id: userId || null
    });

    if (isUsedByAnother) {
      return NextResponse.json({ used: true, message: "Security Error: This address is locked to another user." });
    }

    return NextResponse.json({
      used: false,
      message: "Valid and eligible!"
    });
  } catch (error) {
    console.error("[Check Address API] Internal Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
