import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    const privateKey = process.env.FAUCET_HOT_WALLET_PRIVATE_KEY;
    const polygonscanKey = process.env.POLYGONSCAN_API_KEY;

    if (!privateKey) {
      return NextResponse.json({ error: "Faucet Hot Wallet is not configured." }, { status: 500 });
    }

    if (!polygonscanKey) {
       return NextResponse.json({ error: "Polygonscan API Key is not configured." }, { status: 500 });
    }

    const hotWalletAddress = new ethers.Wallet(privateKey).address.toLowerCase();

    // 1. Get User's Wallet Address
    const { data: userAccount } = await supabaseAdmin
      .from("user_accounts")
      .select("wallet_address")
      .eq("user_id", userId)
      .single();

    if (!userAccount || !userAccount.wallet_address) {
      return NextResponse.json({ error: "No wallet address linked to this account. Please update your profile." }, { status: 400 });
    }

    const userWallet = userAccount.wallet_address.toLowerCase();

    // 2. Fetch Transactions from Polygonscan (Normal Transactions)
    // We fetch the last 100 txs for the hot wallet.
    const apiUrl = `https://api.polygonscan.com/api?module=account&action=txlist&address=${hotWalletAddress}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${polygonscanKey}`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== "1" || !data.result) {
       // Status 0 means either no txs found, or rate limited. 
       // If message says "No transactions found", we just return success with 0 synced.
       if (data.message === "No transactions found") {
           return NextResponse.json({ success: true, syncedCount: 0, message: "No transactions found on the blockchain." });
       }
       throw new Error(data.result || "Polygonscan API error");
    }

    interface PolygonscanTx {
      to: string;
      from: string;
      isError: string;
      hash: string;
      value: string;
    }

    const transactions: PolygonscanTx[] = data.result;
    
    // Filter transactions:
    // 1. tx.to == hotWalletAddress
    // 2. tx.from == userWallet
    // 3. isError == "0" (successful)
    const incomingTxs = transactions.filter((tx: PolygonscanTx) => 
       tx.to.toLowerCase() === hotWalletAddress && 
       tx.from.toLowerCase() === userWallet && 
       tx.isError === "0"
    );

    if (incomingTxs.length === 0) {
       return NextResponse.json({ success: true, syncedCount: 0, message: "No new donations found." });
    }

    // 3. Filter out transactions that are already in the database
    const txHashes = incomingTxs.map((tx: PolygonscanTx) => tx.hash.toLowerCase());
    
    const { data: existingDonations } = await supabaseAdmin
      .from("faucet_donations")
      .select("tx_hash")
      .in("tx_hash", txHashes);

    const existingHashSet = new Set(existingDonations?.map(d => d.tx_hash) || []);

    const newTxs = incomingTxs.filter((tx: PolygonscanTx) => !existingHashSet.has(tx.hash.toLowerCase()));

    if (newTxs.length === 0) {
      return NextResponse.json({ success: true, syncedCount: 0, message: "All donations are already synced." });
    }

    // 4. Insert new transactions
    const insertPayload = newTxs.map((tx: PolygonscanTx) => {
        const amountInPol = ethers.formatEther(tx.value);
        return {
            user_id: userId,
            tx_hash: tx.hash.toLowerCase(),
            amount: Number(amountInPol),
            sender_address: userWallet,
        };
    });

    const { error: insertError } = await supabaseAdmin
      .from("faucet_donations")
      .insert(insertPayload);

    if (insertError) {
      console.error("[Auto-Sync API] Database Error:", insertError);
      return NextResponse.json({ error: "Failed to save synced donations." }, { status: 500 });
    }

    const totalSyncedPol = insertPayload.reduce((acc: number, curr: { amount: number }) => acc + curr.amount, 0);

    return NextResponse.json({ 
       success: true, 
       syncedCount: newTxs.length,
       message: `Successfully synced ${newTxs.length} donation(s) totaling ${totalSyncedPol} POL!`,
    });

  } catch (error: unknown) {
    console.error("[Auto-Sync API] Error:", error);
    return NextResponse.json({ error: "Failed to auto-sync transactions." }, { status: 500 });
  }
}
