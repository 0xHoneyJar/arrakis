/**
 * Shared utility functions for Sietch Unified
 */

/**
 * Sleep for a given number of milliseconds
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Truncate an Ethereum address for display
 */
export const truncateAddress = (address: string, chars = 4): string => {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

/**
 * Format a timestamp to a relative time string
 */
export const formatRelativeTime = (date: Date | string): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
};

/**
 * Validate an Ethereum address
 */
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Get tier badge color
 */
export const getTierColor = (tier: 'naib' | 'fedaykin' | 'none'): string => {
  switch (tier) {
    case 'naib':
      return '#FFD700'; // Gold
    case 'fedaykin':
      return '#C0C0C0'; // Silver
    default:
      return '#808080'; // Gray
  }
};

/**
 * Format a large number with K/M/B suffixes
 */
export const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
};

/**
 * Calculate days between two dates
 */
export const daysBetween = (start: Date, end: Date = new Date()): number => {
  const diffMs = end.getTime() - new Date(start).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Get tenure label based on days
 */
export const getTenureLabel = (joinedAt: Date): string => {
  const days = daysBetween(joinedAt);
  if (days < 30) return 'New';
  if (days < 90) return 'Member';
  if (days < 180) return 'Veteran';
  return 'OG';
};
