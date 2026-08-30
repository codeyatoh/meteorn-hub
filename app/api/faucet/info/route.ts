import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Fetch all user stats to calculate global pool size
    const { data: usersData } = await supabase.from("faucet_user_stats").select("total_donated, total_claimed");
    
    let global_total_donated = 0;
    let global_total_claimed = 0;
    
    if (usersData) {
      global_total_donated = usersData.reduce((acc, u) => acc + (Number(u.total_donated) || 0), 0);
      global_total_claimed = usersData.reduce((acc, u) => acc + (Number(u.total_claimed) || 0), 0);
    }
    
    // Total capacity of the pool is all donations.
    // The current available balance is roughly what hasn't been claimed back.
    // But since users can only claim 70% of what they donate, the real pool balance is actually higher.
    // We'll just return these raw global numbers for the UI to represent the "Global Pool".
    const global_pool_claimable = Math.max(0, global_total_donated - global_total_claimed);

    const privateKey = process.env.FAUCET_HOT_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ 
        address: "Not configured",
        global_total_donated,
        global_pool_claimable
      });
    }
    const wallet = new ethers.Wallet(privateKey);
    return NextResponse.json({ 
      address: wallet.address,
      global_total_donated,
      global_pool_claimable
    });
  } catch (error) {
    console.error("Faucet info error:", error);
    return NextResponse.json({ address: "Error loading wallet" }, { status: 500 });
  }
}
