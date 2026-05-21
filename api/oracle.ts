import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ethers } from 'ethers';

const CELO_RPC   = 'https://forno.celo.org';
const PM_ADDRESS = process.env.VITE_PREDICTION_MARKET_ADDRESS ?? '';
const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY ?? '';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

// ── Contract ABI (only what the oracle needs) ────────────────────────────────
const ABI = [
  { inputs: [], name: 'marketCount', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'owner', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ name: 'marketId', type: 'uint256' }],
    name: 'getMarket',
    outputs: [{
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
      name: '', type: 'tuple',
    }],
    stateMutability: 'view', type: 'function',
  },
  {
    inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'result', type: 'uint8' }],
    name: 'resolveMarket', outputs: [], stateMutability: 'nonpayable', type: 'function',
  },
];

// ── Team name fuzzy matching ─────────────────────────────────────────────────
function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fc|cf|afc|sc|ac|rc|cd|ud|rcd|sd|uc|us|as|ss|ssc|sporting|club|city|united|rovers|wanderers|hotspur|county|town|albion|athletic|atletico|real|deportivo|dynamo|dynamo|bsc|fk|sk|1\.)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamsMatch(apiName: string, contractName: string): boolean {
  const a = normalizeTeam(apiName);
  const b = normalizeTeam(contractName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length > 4 && b.includes(a)) return true;
  if (b.length > 4 && a.includes(b)) return true;
  // First meaningful word match (e.g. "arsenal" in both)
  const wa = a.split(' ').find(w => w.length > 3);
  const wb = b.split(' ').find(w => w.length > 3);
  return !!wa && !!wb && wa === wb;
}

// Outcome: 1=Home 2=Draw 3=Away
function getOutcome(homeGoals: number, awayGoals: number): 1 | 2 | 3 {
  if (homeGoals > awayGoals) return 1;
  if (homeGoals === awayGoals) return 2;
  return 3;
}

// ── Football-data.org API ────────────────────────────────────────────────────
interface FDMatch {
  id: number;
  status: string;
  homeTeam: { name: string; shortName: string };
  awayTeam: { name: string; shortName: string };
  score: { fullTime: { home: number | null; away: number | null } };
  utcDate: string;
}

async function fetchMatches(dateStr: string): Promise<FDMatch[]> {
  const url = `https://api.football-data.org/v4/matches?dateFrom=${dateStr}&dateTo=${dateStr}`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': FD_API_KEY } });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  const data = await res.json() as { matches: FDMatch[] };
  return data.matches ?? [];
}

function findMatch(apiMatches: FDMatch[], homeTeam: string, awayTeam: string): FDMatch | null {
  return apiMatches.find(m =>
    (teamsMatch(m.homeTeam.name, homeTeam) || teamsMatch(m.homeTeam.shortName, homeTeam)) &&
    (teamsMatch(m.awayTeam.name, awayTeam) || teamsMatch(m.awayTeam.shortName, awayTeam))
  ) ?? null;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
function isCronRequest(req: VercelRequest): boolean {
  return !!CRON_SECRET && req.headers.authorization === `Bearer ${CRON_SECRET}`;
}

async function isAdminRequest(req: VercelRequest): Promise<boolean> {
  const { message, signature } = (req.body ?? {}) as { message?: string; signature?: string };
  if (!message || !signature) return false;

  // Reject messages older than 5 minutes (replay protection)
  const ts = Number(message.split(':')[1]);
  if (Date.now() - ts > 5 * 60 * 1000) return false;

  try {
    const provider = new ethers.JsonRpcProvider(CELO_RPC);
    const contract = new ethers.Contract(PM_ADDRESS, ABI, provider);
    const owner    = (await contract.owner()) as string;
    const signer   = ethers.verifyMessage(message, signature);
    return signer.toLowerCase() === owner.toLowerCase();
  } catch {
    return false;
  }
}

// ── Main oracle logic ────────────────────────────────────────────────────────
interface ResolvedMarket {
  marketId: number;
  homeTeam: string;
  awayTeam: string;
  outcome: 'Home' | 'Draw' | 'Away';
  txHash: string;
}

async function runOracle(): Promise<{ resolved: ResolvedMarket[]; skipped: string[]; errors: string[] }> {
  if (!PM_ADDRESS) throw new Error('VITE_PREDICTION_MARKET_ADDRESS not set');
  if (!FD_API_KEY)  throw new Error('FOOTBALL_DATA_API_KEY not set');

  const rawKey = process.env.PRIVATE_KEY ?? '';
  if (!rawKey) throw new Error('PRIVATE_KEY not set');
  const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;

  const provider = new ethers.JsonRpcProvider(CELO_RPC);
  const wallet   = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(PM_ADDRESS, ABI, wallet);

  const count    = Number(await contract.marketCount());
  const now      = Math.floor(Date.now() / 1000);
  const TWO_HOURS = 2 * 60 * 60;

  const resolved: ResolvedMarket[] = [];
  const skipped:  string[]         = [];
  const errors:   string[]         = [];

  // Cache API responses by date so we don't hammer the API
  const cache = new Map<string, FDMatch[]>();

  for (let id = 0; id < count; id++) {
    const raw = await contract.getMarket(id);
    const kickoff  = Number(raw.kickoff);
    const isResolved = raw.resolved as boolean;

    if (isResolved) continue;
    if (kickoff + TWO_HOURS > now) {
      skipped.push(`Market #${id}: kickoff not 2h past yet`);
      continue;
    }

    const homeTeam = raw.homeTeam as string;
    const awayTeam = raw.awayTeam as string;
    const dateStr  = new Date(kickoff * 1000).toISOString().slice(0, 10);

    if (!cache.has(dateStr)) {
      try {
        cache.set(dateStr, await fetchMatches(dateStr));
      } catch (e) {
        errors.push(`API fetch failed for ${dateStr}: ${(e as Error).message}`);
        continue;
      }
    }

    const apiMatches = cache.get(dateStr)!;
    const match      = findMatch(apiMatches, homeTeam, awayTeam);

    if (!match) {
      skipped.push(`Market #${id}: ${homeTeam} vs ${awayTeam} not found in API for ${dateStr}`);
      continue;
    }

    if (match.status !== 'FINISHED') {
      skipped.push(`Market #${id}: ${homeTeam} vs ${awayTeam} status is ${match.status}`);
      continue;
    }

    const { home, away } = match.score.fullTime;
    if (home === null || away === null) {
      skipped.push(`Market #${id}: score not available yet`);
      continue;
    }

    const outcome    = getOutcome(home, away);
    const outcomeStr = outcome === 1 ? 'Home' : outcome === 2 ? 'Draw' : 'Away';

    try {
      const feeData = await provider.getFeeData();
      const maxFee  = ((feeData.gasPrice ?? ethers.parseUnits('200', 'gwei')) * 125n) / 100n;
      const tx = await contract.resolveMarket(id, outcome, {
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: ethers.parseUnits('2.5', 'gwei'),
      });
      await tx.wait();
      resolved.push({ marketId: id, homeTeam, awayTeam, outcome: outcomeStr, txHash: tx.hash });
      console.log(`Resolved market #${id}: ${homeTeam} vs ${awayTeam} → ${outcomeStr} | tx: ${tx.hash}`);
    } catch (e) {
      errors.push(`Market #${id} resolve failed: ${(e as Error).message}`);
    }
  }

  return { resolved, skipped, errors };
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cron  = isCronRequest(req);
  const admin = !cron && (await isAdminRequest(req));

  if (!cron && !admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await runOracle();
    return res.status(200).json({ ok: true, triggeredBy: cron ? 'cron' : 'admin', ...result });
  } catch (e) {
    console.error('Oracle error:', e);
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }
}
