import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CLAIM_AMOUNT = 0.05;

function getMaxDailyClaims(totalDonated: number) {
  if (totalDonated >= 10) return 60;
  if (totalDonated >= 5) return 30;
  if (totalDonated >= 3) return 18;
  if (totalDonated >= 2) return 12;
  if (totalDonated >= 1) return 6;
  return 0;
}

export async function POST(req: NextRequest) {
  try {
    const { addresses, userId } = await req.json();

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0 || !userId) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const rpcUrl = process.env.POLYGON_RPC_URL;
    const privateKey = process.env.FAUCET_HOT_WALLET_PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
      return NextResponse.json({ error: "Faucet not configured." }, { status: 500 });
    }

    // 1. Fetch User Stats
    const { data: stats } = await supabaseAdmin
      .from("faucet_user_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    const totalDonated = stats?.total_donated || 0;
    const totalClaimed = stats?.total_claimed || 0;
    const claimsToday = stats?.claims_today || 0;

    // 2. Verify Global Quota (70% Rule)
    const claimableBalance = (totalDonated * 0.7) - totalClaimed;
    const totalRequestedAmount = addresses.length * CLAIM_AMOUNT;

    if (claimableBalance < totalRequestedAmount) {
      return NextResponse.json({ 
        error: `Insufficient claimable balance. You are requesting ${totalRequestedAmount} POL but only have ${claimableBalance.toFixed(2)} POL left to claim. Please donate to increase your quota.` 
      }, { status: 403 });
    }

    // 3. Verify Daily Velocity Limit
    const maxDailyClaims = getMaxDailyClaims(totalDonated);
    if (claimsToday + addresses.length > maxDailyClaims) {
      return NextResponse.json({
        error: `Daily limit exceeded. You can only claim ${maxDailyClaims} addresses per day based on your Tier. You have ${maxDailyClaims - claimsToday} claims left today.`
      }, { status: 429 });
    }

    // 4. Verify Addresses haven't been claimed before
    const lowerAddresses = addresses.map((a: string) => a.toLowerCase());
    const { data: existingClaims } = await supabaseAdmin
      .from("faucet_claims")
      .select("wallet_address")
      .in("wallet_address", lowerAddresses);

    if (existingClaims && existingClaims.length > 0) {
      const duplicates = existingClaims.map((c) => c.wallet_address).join(", ");
      return NextResponse.json({
        error: `The following addresses have already been funded by this faucet globally: ${duplicates}`
      }, { status: 400 });
    }

    // 5. Execute Transactions
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    let nonce = await wallet.getNonce();
    const results = [];
    const dbPayload = [];

    // Process sequentially to avoid nonce clashes or RPC rate limits
    for (const address of lowerAddresses) {
      try {
        const tx = await wallet.sendTransaction({
          to: address,
          value: ethers.parseEther(CLAIM_AMOUNT.toString()),
          nonce: nonce++,
        });
        
        results.push({ address, txHash: tx.hash, status: "success" });
        dbPayload.push({
          user_id: userId,
          wallet_address: address,
          amount: CLAIM_AMOUNT,
          tx_hash: tx.hash,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Tx Failed";
        console.error(`Failed to send to ${address}:`, err);
        results.push({ address, error: errorMessage, status: "failed" });
        // Stop batch if a transaction fails to prevent missing nonces
        break; 
      }
    }

    // 6. Save successful records to Database
    if (dbPayload.length > 0) {
      await supabaseAdmin.from("faucet_claims").insert(dbPayload);
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${dbPayload.length} claims.`,
      results,
    });

  } catch (error: unknown) {
    console.error("[Claim API] Internal Error:", error);
    return NextResponse.json({ error: "An unexpected error occurred processing the claim." }, { status: 500 });
  }
}
