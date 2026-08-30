import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    let { txHash, userId } = await req.json();
    txHash = txHash?.toLowerCase().trim();

    if (!txHash || !userId) {
      return NextResponse.json(
        { error: "Transaction hash and User ID are required." },
        { status: 400 },
      );
    }

    // 1. Setup Ethers Provider
    const rpcUrl = process.env.POLYGON_RPC_URL;
    const privateKey = process.env.FAUCET_HOT_WALLET_PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
      return NextResponse.json(
        { error: "Faucet is currently not configured." },
        { status: 500 },
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const hotWalletAddress = wallet.address.toLowerCase();

    // 2. Check if this txHash was already used
    const { data: existingDonation } = await supabaseAdmin
      .from("faucet_donations")
      .select("id")
      .eq("tx_hash", txHash)
      .single();

    if (existingDonation) {
      return NextResponse.json(
        { error: "This transaction has already been verified and claimed." },
        { status: 400 },
      );
    }

    // 3. Fetch Transaction from Blockchain
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return NextResponse.json(
        { error: "Transaction not found on the blockchain." },
        { status: 400 },
      );
    }

    // 3.5 Verify Strict Sender-Wallet Binding
    const { data: { user: dbUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    const savedWallet = dbUser?.user_metadata?.wallet_address;
    
    if (!savedWallet) {
      return NextResponse.json(
        { error: "Security Error: You must set your Personal Wallet Address in your Account Settings before claiming donations." },
        { status: 400 },
      );
    }

    if (tx.from.toLowerCase() !== savedWallet.toLowerCase()) {
      return NextResponse.json(
        { error: "Security Error: This transaction was not sent from your saved Personal Wallet Address. You cannot claim someone else's donation." },
        { status: 400 },
      );
    }

    // 4. Verify the recipient is our Hot Wallet
    if (!tx.to || tx.to.toLowerCase() !== hotWalletAddress) {
      return NextResponse.json(
        { error: `Transaction was not sent to the correct Hot Wallet address (${wallet.address}).` },
        { status: 400 },
      );
    }

    // 5. Verify the transaction was successful (receipt status === 1)
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return NextResponse.json(
        { error: "Transaction failed or is still pending on the blockchain." },
        { status: 400 },
      );
    }

    // 6. Get the amount donated in POL
    const amountInPol = ethers.formatEther(tx.value);

    // 7. Save to Database
    const { error: dbError } = await supabaseAdmin
      .from("faucet_donations")
      .insert({
        user_id: userId,
        tx_hash: txHash,
        amount: Number(amountInPol),
        sender_address: tx.from.toLowerCase(),
      });

    if (dbError) {
      console.error("[Donate API] Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to save donation record." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      amount: amountInPol,
      message: `Successfully verified donation of ${amountInPol} POL!`,
    });
  } catch (error: unknown) {
    console.error("[Donate API] Internal Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred verifying the transaction. Make sure the TxID is valid." },
      { status: 500 },
    );
  }
}
