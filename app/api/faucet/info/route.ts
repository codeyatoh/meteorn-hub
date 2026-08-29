import { NextResponse } from "next/server";
import { ethers } from "ethers";

export async function GET() {
  try {
    const privateKey = process.env.FAUCET_HOT_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ address: "Not configured" });
    }
    const wallet = new ethers.Wallet(privateKey);
    return NextResponse.json({ address: wallet.address });
  } catch (error) {
    return NextResponse.json({ address: "Error loading wallet" }, { status: 500 });
  }
}
