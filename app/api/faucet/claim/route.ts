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
    
    const hotWalletAddress = new ethers.Wallet(privateKey).address.toLowerCase();
    if (lowerAddresses.includes(hotWalletAddress)) {
      return NextResponse.json({
        error: "Security Error: You cannot claim funds back to the Faucet Hot Wallet."
      }, { status: 400 });
    }
    
    // Check if any address belongs to another user in user_accounts
    const { data: userAccounts } = await supabaseAdmin
      .from("user_accounts")
      .select("wallet_address, user_id")
      .in("wallet_address", lowerAddresses);

    if (userAccounts && userAccounts.length > 0) {
      const lockedToOthers = userAccounts.filter(acc => acc.user_id !== userId);
      if (lockedToOthers.length > 0) {
        return NextResponse.json({
          error: "Security Error: One or more requested addresses are locked to another user's personal account."
        }, { status: 400 });
      }
    }

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

    // 5. Insert "processing" records FIRST (one per address)
    const processingPayload = lowerAddresses.map((address: string) => ({
      user_id: userId,
      wallet_address: address,
      amount: CLAIM_AMOUNT,
      tx_hash: "pending",
      status: "processing",
    }));

    const { data: insertedRows, error: insertError } = await supabaseAdmin
      .from("faucet_claims")
      .insert(processingPayload)
      .select("id, wallet_address");

    if (insertError || !insertedRows) {
      console.error("[Claim API] Failed to insert processing records:", insertError);
      return NextResponse.json({ error: "Failed to initialize claim records." }, { status: 500 });
    }

    // Map address -> row id for later updates
    const addressToId: Record<string, string> = {};
    for (const row of insertedRows) {
      addressToId[row.wallet_address] = row.id;
    }

    // 6. Execute Transactions
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    let nonce = await wallet.getNonce();
    const results = [];
    const successAddresses: string[] = [];

    // Process sequentially to avoid nonce clashes or RPC rate limits
    for (const address of lowerAddresses) {
      const rowId = addressToId[address];
      try {
        const tx = await wallet.sendTransaction({
          to: address,
          value: ethers.parseEther(CLAIM_AMOUNT.toString()),
          nonce: nonce++,
        });
        
        results.push({ address, txHash: tx.hash, status: "success" });
        successAddresses.push(address);

        // Update DB record to success with tx_hash
        await supabaseAdmin
          .from("faucet_claims")
          .update({ status: "success", tx_hash: tx.hash })
          .eq("id", rowId);

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Tx Failed";
        console.error(`Failed to send to ${address}:`, err);
        results.push({ address, error: errorMessage, status: "failed" });

        // Update DB record to failed
        await supabaseAdmin
          .from("faucet_claims")
          .update({ status: "failed", tx_hash: null, error_message: errorMessage })
          .eq("id", rowId);

        // Stop batch if a transaction fails to prevent missing nonces
        break; 
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${successAddresses.length} claim(s) successfully.`,
      results,
    });

  } catch (error: unknown) {
    console.error("[Claim API] Internal Error:", error);
    return NextResponse.json({ error: "An unexpected error occurred processing the claim." }, { status: 500 });
  }
}
