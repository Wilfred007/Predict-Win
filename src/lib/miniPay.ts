import { BrowserProvider, parseUnits } from 'ethers';

// Extend the window.ethereum type to include MiniPay's flag
declare global {
  interface Window {
    ethereum?: {
      isMiniPay?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      [key: string]: unknown;
    };
  }
}

export function isMiniPay(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum?.isMiniPay;
}

// MiniPay only accepts legacy (type 0) transactions — EIP-1559 is not supported.
// Returns overrides to spread into any ethers contract call when inside MiniPay.
export async function getLegacyOverrides(provider: BrowserProvider) {
  const feeData = await provider.getFeeData();
  return {
    type:     0 as const,
    gasPrice: feeData.gasPrice ?? parseUnits('5', 'gwei'),
  };
}
