/**
 * Centralized Donation Tier Limits
 * Used across Faucet, Temp Mail, and Admin pages to ensure consistency.
 */

export interface TierLimits {
  faucetLimit: number;    // Max daily faucet claims
  tempMailLimit: number;  // Max daily temp email generations
}

/**
 * Returns the Faucet and Temp Mail daily limits based on the user's lifetime donated amount (in POL).
 */
export function getTierLimits(totalDonated: number): TierLimits {
  if (totalDonated >= 10) return { faucetLimit: 60, tempMailLimit: 10000 };
  if (totalDonated >= 5)  return { faucetLimit: 30, tempMailLimit: 2500 };
  if (totalDonated >= 3)  return { faucetLimit: 18, tempMailLimit: 1000 };
  if (totalDonated >= 2)  return { faucetLimit: 12, tempMailLimit: 500 };
  if (totalDonated >= 1)  return { faucetLimit: 6,  tempMailLimit: 250 };
  return                         { faucetLimit: 0,  tempMailLimit: 100 };
}

/** Ordered tier table for display in modals/tables */
export const TIER_TABLE = [
  { min: 0,  faucetLimit: 0,  tempMailLimit: 100, name: "Shoshin (Beginner)" },
  { min: 1,  faucetLimit: 6,  tempMailLimit: 250, name: "Minarai (Apprentice)" },
  { min: 2,  faucetLimit: 12, tempMailLimit: 500, name: "Tatsujin (Expert)" },
  { min: 3,  faucetLimit: 18, tempMailLimit: 1000, name: "Kakusei (Awakening)" },
  { min: 5,  faucetLimit: 30, tempMailLimit: 2500, name: "Mugen (Infinity)" },
  { min: 10, faucetLimit: 60, tempMailLimit: 10000, name: "Shinwa (Myth)" },
];

export interface TierDetails {
  name: string;
  colorClass: string;
  effectClass: string;
}

/**
 * Returns the tier name, color, and CSS effect class based on donated amount.
 */
export function getTierDetails(totalDonated: number): TierDetails {
  if (totalDonated >= 10) return { name: "Shinwa (Myth)", colorClass: "text-purple-500 dark:text-purple-400", effectClass: "effect-mythic" };
  if (totalDonated >= 5)  return { name: "Mugen (Infinity)", colorClass: "text-blue-500 dark:text-blue-400", effectClass: "effect-rgb-glitch" };
  if (totalDonated >= 3)  return { name: "Kakusei (Awakening)", colorClass: "text-red-500 dark:text-red-400", effectClass: "effect-lightning" };
  if (totalDonated >= 2)  return { name: "Tatsujin (Expert)", colorClass: "text-orange-500 dark:text-orange-400", effectClass: "effect-glitch" };
  if (totalDonated >= 1)  return { name: "Minarai (Apprentice)", colorClass: "text-emerald-500 dark:text-emerald-400", effectClass: "effect-pulse" };
  return                  { name: "Shoshin (Beginner)", colorClass: "text-zinc-500 dark:text-zinc-400", effectClass: "effect-mist" };
}
