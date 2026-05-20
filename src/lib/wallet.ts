import { Wallet } from 'ethers';
import type { WalletInfo } from '../types';

export function createWallet(): WalletInfo {
  const wallet = Wallet.createRandom();
  if (!wallet.mnemonic) throw new Error('Failed to generate mnemonic');
  return {
    address: wallet.address,
    mnemonic: wallet.mnemonic.phrase,
  };
}

export function importWallet(mnemonic: string): WalletInfo {
  const normalized = mnemonic.trim().replace(/\s+/g, ' ').toLowerCase();
  const wallet = Wallet.fromPhrase(normalized);
  if (!wallet.mnemonic) throw new Error('Failed to parse mnemonic');
  return {
    address: wallet.address,
    mnemonic: wallet.mnemonic.phrase,
  };
}

export function isValidMnemonic(mnemonic: string): boolean {
  try {
    importWallet(mnemonic);
    return true;
  } catch {
    return false;
  }
}
