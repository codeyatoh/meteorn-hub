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
  { min: 0,  faucetLimit: 0,  tempMailLimit: 100 },
  { min: 1,  faucetLimit: 6,  tempMailLimit: 250 },
  { min: 2,  faucetLimit: 12, tempMailLimit: 500 },
  { min: 3,  faucetLimit: 18, tempMailLimit: 1000 },
  { min: 5,  faucetLimit: 30, tempMailLimit: 2500 },
  { min: 10, faucetLimit: 60, tempMailLimit: 10000 },
];
