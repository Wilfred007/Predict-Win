import { useEffect, useRef, useState } from 'react';

const REFRESH_INTERVAL = 30_000;
import { claimWinnings, formatCELO, getMarket, getUserBets } from '../lib/predictionMarket';
import type { Market, UserBet } from '../types';
import { Outcome, OutcomeLabel } from '../types';

interface MyBetsPageProps {
  connectedAccount: string | null;
}

type BetWithMarket = UserBet & { market: Market };

function getBetStatus(bet: UserBet, market: Market): 'Pending' | 'Won' | 'Lost' | 'Claimed' {
  if (bet.claimed) return 'Claimed';
  if (!market.resolved) return 'Pending';
  return bet.outcome === market.result ? 'Won' : 'Lost';
}

const statusClass: Record<string, string> = {
  Won: 'bet-status-won', Lost: 'bet-status-lost', Pending: 'bet-status-pending', Claimed: 'bet-status-claimed',
};

export default function MyBetsPage({ connectedAccount }: MyBetsPageProps) {
  const [bets,       setBets]       = useState<BetWithMarket[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState('');
  const [claimMsg,   setClaimMsg]   = useState<Record<string, string>>({});
  const [claiming,   setClaiming]   = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (account: string, silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const rawBets = await getUserBets(account);
      const marketIds = [...new Set(rawBets.map((b) => b.marketId))];
      const markets = await Promise.all(marketIds.map((id) => getMarket(id)));
      const marketMap = Object.fromEntries(markets.map((m) => [m.id, m]));
      setBets(rawBets.map((b) => ({ ...b, market: marketMap[b.marketId] })));
    } catch (err) {
      if (!silent) setError((err as Error).message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (connectedAccount) {
      load(connectedAccount);
      // Poll every 30s so "Pending" bets flip to "Won/Lost" automatically when resolved
      timerRef.current = setInterval(() => load(connectedAccount, true), REFRESH_INTERVAL);
    } else {
      setBets([]);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAccount]);


  const handleClaim = async (marketId: number) => {
    const key = String(marketId);
    setClaiming((p) => ({ ...p, [key]: true }));
    setClaimMsg((p) => ({ ...p, [key]: '' }));
    try {
      const hash = await claimWinnings(marketId);
      setClaimMsg((p) => ({ ...p, [key]: `Claimed! Tx: ${hash}` }));
      if (connectedAccount) await load(connectedAccount);
    } catch (err) {
      setClaimMsg((p) => ({ ...p, [key]: `Failed: ${(err as Error).message}` }));
    } finally {
      setClaiming((p) => ({ ...p, [key]: false }));
    }
  };

  if (!connectedAccount) {
    return (
      <div className="my-bets-page">
        <h2>My Bets</h2>
        <p className="empty-msg">Connect your wallet to see your bets.</p>
      </div>
    );
  }

  return (
    <div className="my-bets-page">
      <h2>My Bets</h2>

      {isLoading && <p className="loading-msg">Loading your bets…</p>}
      {error     && <p className="contract-msg" style={{ color: 'var(--red)' }}>{error}</p>}

      {!isLoading && !error && bets.length === 0 && (
        <p className="empty-msg">No bets placed yet. Head to Markets to get started.</p>
      )}

      {!isLoading && !error && bets.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="bets-table">
            <thead>
              <tr>
                <th>Match</th>
                <th>Outcome</th>
                <th>Staked</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((bet) => {
                const betStatus = getBetStatus(bet, bet.market);
                const canClaim  = bet.market.resolved && bet.outcome === bet.market.result && !bet.claimed;
                const key       = String(bet.marketId);

                return (
                  <tr key={`${bet.marketId}-${bet.outcome}`}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{bet.market.homeTeam} vs {bet.market.awayTeam}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{bet.market.league}</div>
                    </td>
                    <td>{OutcomeLabel[bet.outcome as Outcome]}</td>
                    <td>{formatCELO(bet.amount)} CELO</td>
                    <td>
                      <span className={statusClass[betStatus]}>{betStatus}</span>
                    </td>
                    <td>
                      {canClaim && (
                        <button
                          className="primary-button"
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                          disabled={claiming[key]}
                          onClick={() => handleClaim(bet.marketId)}
                        >
                          {claiming[key] ? 'Claiming…' : 'Claim'}
                        </button>
                      )}
                      {claimMsg[key] && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{claimMsg[key]}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
