import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers';
import { getLegacyOverrides, isMiniPay } from './miniPay';
import type { Market, Outcome, UserBet } from '../types';

const PM_ADDRESS = import.meta.env.VITE_PREDICTION_MARKET_ADDRESS || '';

const ABI = [
  {
    inputs: [
      { name: 'homeTeam', type: 'string' },
      { name: 'awayTeam', type: 'string' },
      { name: 'league',   type: 'string' },
      { name: 'kickoff',  type: 'uint256' },
    ],
    name: 'createMarket',
    outputs: [{ name: 'marketId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'outcome',  type: 'uint8' },
    ],
    name: 'placeBet',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'result',   type: 'uint8' },
    ],
    name: 'resolveMarket',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'marketId', type: 'uint256' }],
    name: 'claimWinnings',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'withdrawFees',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'marketId', type: 'uint256' }],
    name: 'getMarket',
    outputs: [
      {
        components: [
          { name: 'homeTeam',  type: 'string'  },
          { name: 'awayTeam',  type: 'string'  },
          { name: 'league',    type: 'string'  },
          { name: 'kickoff',   type: 'uint256' },
          { name: 'resolved',  type: 'bool'    },
          { name: 'result',    type: 'uint8'   },
          { name: 'totalPool', type: 'uint256' },
          { name: 'homePool',  type: 'uint256' },
          { name: 'drawPool',  type: 'uint256' },
          { name: 'awayPool',  type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'user',     type: 'address' },
      { name: 'outcome',  type: 'uint8'   },
    ],
    name: 'getUserStake',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'marketCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'accumulatedFees',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'address' },
    ],
    name: 'claimed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: 'marketId', type: 'uint256' },
      { indexed: false, name: 'homeTeam', type: 'string'  },
      { indexed: false, name: 'awayTeam', type: 'string'  },
      { indexed: false, name: 'league',   type: 'string'  },
      { indexed: false, name: 'kickoff',  type: 'uint256' },
    ],
    name: 'MarketCreated',
    type: 'event',
  },
];

function getBrowserProvider() {
  if (!window.ethereum) throw new Error('No browser wallet detected. Install MetaMask or open in MiniPay.');
  return new BrowserProvider(window.ethereum as never);
}

function getReadContract(): Contract {
  if (!PM_ADDRESS) throw new Error('VITE_PREDICTION_MARKET_ADDRESS not set.');
  return new Contract(PM_ADDRESS, ABI, getBrowserProvider());
}

async function getWriteContract(): Promise<{ contract: Contract; provider: BrowserProvider }> {
  if (!PM_ADDRESS) throw new Error('VITE_PREDICTION_MARKET_ADDRESS not set.');
  const provider = getBrowserProvider();
  const signer = await provider.getSigner();
  return { contract: new Contract(PM_ADDRESS, ABI, signer), provider };
}

function rawToMarket(id: number, raw: Awaited<ReturnType<Contract['getMarket']>>): Market {
  return {
    id,
    homeTeam:  raw.homeTeam  as string,
    awayTeam:  raw.awayTeam  as string,
    league:    raw.league    as string,
    kickoff:   Number(raw.kickoff),
    resolved:  raw.resolved  as boolean,
    result:    Number(raw.result) as Outcome,
    totalPool: raw.totalPool as bigint,
    homePool:  raw.homePool  as bigint,
    drawPool:  raw.drawPool  as bigint,
    awayPool:  raw.awayPool  as bigint,
  };
}

export async function getMarkets(): Promise<Market[]> {
  const contract = getReadContract();
  const count = Number(await contract.marketCount());
  const results = await Promise.all(
    Array.from({ length: count }, (_, i) => contract.getMarket(i).then((r: unknown) => rawToMarket(i, r as Parameters<typeof rawToMarket>[1])))
  );
  return results;
}

export async function getMarket(id: number): Promise<Market> {
  const contract = getReadContract();
  const raw = await contract.getMarket(id);
  return rawToMarket(id, raw);
}

export async function placeBet(
  marketId: number,
  outcome: Outcome,
  amountEther: string,
): Promise<string> {
  const { contract, provider } = await getWriteContract();
  const extra = isMiniPay() ? await getLegacyOverrides(provider) : {};
  const tx = await contract.placeBet(marketId, outcome, { value: parseEther(amountEther), ...extra });
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction failed');
  return tx.hash as string;
}

export async function resolveMarket(marketId: number, outcome: Outcome): Promise<string> {
  const { contract, provider } = await getWriteContract();
  const extra = isMiniPay() ? await getLegacyOverrides(provider) : {};
  const tx = await contract.resolveMarket(marketId, outcome, extra);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction failed');
  return tx.hash as string;
}

export async function claimWinnings(marketId: number): Promise<string> {
  const { contract, provider } = await getWriteContract();
  const extra = isMiniPay() ? await getLegacyOverrides(provider) : {};
  const tx = await contract.claimWinnings(marketId, extra);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction failed');
  return tx.hash as string;
}

export async function createMarket(
  homeTeam: string,
  awayTeam: string,
  league: string,
  kickoffUnixSec: number,
): Promise<number> {
  const { contract, provider } = await getWriteContract();
  const extra = isMiniPay() ? await getLegacyOverrides(provider) : {};
  const tx = await contract.createMarket(homeTeam, awayTeam, league, kickoffUnixSec, extra);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction failed');

  const iface = contract.interface;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === 'MarketCreated') {
        return Number(parsed.args.marketId);
      }
    } catch {
      // skip unparseable logs
    }
  }
  throw new Error('MarketCreated event not found in receipt');
}

export async function getOwner(): Promise<string> {
  const contract = getReadContract();
  return (await contract.owner()) as string;
}

export async function getUserBets(userAddress: string): Promise<UserBet[]> {
  const contract = getReadContract();
  const count = Number(await contract.marketCount());
  if (count === 0) return [];

  const outcomes = [1, 2, 3] as const; // Home, Draw, Away
  const bets: UserBet[] = [];

  for (let marketId = 0; marketId < count; marketId++) {
    const [isClaimed, ...stakes] = await Promise.all([
      contract.claimed(marketId, userAddress),
      ...outcomes.map((o) => contract.getUserStake(marketId, userAddress, o)),
    ]);

    for (let i = 0; i < outcomes.length; i++) {
      const amount = stakes[i] as bigint;
      if (amount > 0n) {
        bets.push({
          marketId,
          outcome: outcomes[i] as Outcome,
          amount,
          claimed: isClaimed as boolean,
        });
      }
    }
  }

  return bets;
}

export async function getAccumulatedFees(): Promise<bigint> {
  const contract = getReadContract();
  return (await contract.accumulatedFees()) as bigint;
}

export async function withdrawFees(): Promise<string> {
  const { contract, provider } = await getWriteContract();
  const extra = isMiniPay() ? await getLegacyOverrides(provider) : {};
  const tx = await contract.withdrawFees(extra);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction failed');
  return tx.hash as string;
}

export function formatCELO(wei: bigint, decimals = 4): string {
  return parseFloat(formatEther(wei)).toFixed(decimals);
}

export function calcPotentialWinnings(
  betWei: bigint,
  outcomePool: bigint,
  totalPool: bigint,
): bigint {
  const newOutcomePool = outcomePool + betWei;
  const newTotal       = totalPool  + betWei;
  const fee            = (newTotal * 500n) / 10_000n;
  const prize          = newTotal - fee;
  return (betWei * prize) / newOutcomePool;
}
