import { BrowserProvider, Contract, ethers, type BrowserProvider as BrowserProviderType } from 'ethers';

const CONTRACT_ADDRESS = import.meta.env.VITE_ONBOARDING_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

const CONTRACT_ABI = [
  {
    inputs: [],
    name: 'registerOnboarded',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'user',
        type: 'address',
      },
    ],
    name: 'isOnboarded',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

function getBrowserProvider(): BrowserProviderType {
  if (!window.ethereum) {
    throw new Error('Browser wallet not detected. Install MetaMask or a Celo-compatible wallet.');
  }

  return new BrowserProvider(window.ethereum as any);
}

export async function connectWallet(): Promise<string> {
  const provider = getBrowserProvider();
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  return signer.getAddress();
}

export async function getContract(signerOrProvider?: BrowserProviderType | ethers.Signer): Promise<Contract> {
  const client = signerOrProvider ?? getBrowserProvider();
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, client);
}

export async function isOnboarded(address: string): Promise<boolean> {
  const contract = await getContract();
  return contract.isOnboarded(address);
}

export async function registerOnboarded(): Promise<string> {
  const provider = getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = await getContract(signer);
  const tx = await contract.registerOnboarded();
  await tx.wait();
  return tx.hash;
}

export function getContractAddress(): string {
  return CONTRACT_ADDRESS;
}
