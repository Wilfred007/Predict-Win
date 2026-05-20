import { formatEther, parseEther } from 'ethers';
import { useEffect, useState } from 'react';
import { calcPotentialWinnings, claimWinnings, formatCELO, getMarket, placeBet, resolveMarket } from '../lib/predictionMarket';
import type { Market } from '../types';
import { Outcome, OutcomeLabel } from '../types';

interface MarketDetailPageProps {
  marketId: number;
  connectedAccount: string | null;
  isOwner: boolean;
  onBack: () => void;
  pendingResolve: { marketId: number; outcome: Outcome } | null;
  onPendingResolveClear: () => void;
  onMarketLoaded: (market: Market) => void;
}

function formatKickoff(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function calcPct(pool: bigint, total: bigint): number {
  if (total === 0n) return 33;
  return Math.round(Number((pool * 100n) / total));
}

function OddsBar({ label, pool, total }: { label: string; pool: bigint; total: bigint }) {
  const pct = calcPct(pool, total);
  return (
    <div className="odds-bar-row">
      <span className="odds-bar-label" style={{ width: 80 }}>{label}</span>
      <div className="odds-bar-track" style={{ flex: 1 }}>
        <div className="odds-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="odds-bar-pct">{pct}%</span>
      <span style={{ width: 90, textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {total > 0n ? `${formatCELO(pool)} CELO` : '—'}
      </span>
    </div>
  );
}

export default function MarketDetailPage({
  marketId,
  connectedAccount,
  isOwner,
  onBack,
  pendingResolve,
  onPendingResolveClear,
  onMarketLoaded,
}: MarketDetailPageProps) {
  const [market,         setMarket]         = useState<Market | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [betAmount,      setBetAmount]      = useState('0.1');
  const [isPlacingBet,   setIsPlacingBet]   = useState(false);
  const [betStatus,      setBetStatus]      = useState('');
  const [isResolving,    setIsResolving]    = useState(false);
  const [resolveStatus,  setResolveStatus]  = useState('');
  const [isClaiming,     setIsClaiming]     = useState(false);
  const [claimStatus,    setClaimStatus]    = useState('');

  const load = async () => {
    try {
      const m = await getMarket(marketId);
      setMarket(m);
      onMarketLoaded(m);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { load(); }, [marketId]);

  // Execute AI-triggered resolve
  useEffect(() => {
    if (!pendingResolve || pendingResolve.marketId !== marketId || !market || market.resolved) return;

    const execute = async () => {
      setIsResolving(true);
      setResolveStatus('Sending resolve transaction…');
      try {
        const hash = await resolveMarket(pendingResolve.marketId, pendingResolve.outcome);
        setResolveStatus(`Market resolved. Tx: ${hash}`);
        await load();
      } catch (err) {
        setResolveStatus(`Resolve failed: ${(err as Error).message}`);
      } finally {
        setIsResolving(false);
        onPendingResolveClear();
      }
    };

    execute();
  }, [pendingResolve]);

  const handlePlaceBet = async () => {
    if (!market || selectedOutcome === null || !connectedAccount) return;
    const now = Math.floor(Date.now() / 1000);
    if (now >= market.kickoff) { setBetStatus('Betting is closed — the match has started.'); return; }
    if (market.resolved)       { setBetStatus('Market is already resolved.');              return; }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { setBetStatus('Enter a valid amount.'); return; }

    setIsPlacingBet(true);
    setBetStatus('');
    try {
      const hash = await placeBet(market.id, selectedOutcome, betAmount);
      setBetStatus(`Bet placed! Tx: ${hash}`);
      setSelectedOutcome(null);
      setBetAmount('0.1');
      await load();
    } catch (err) {
      setBetStatus(`Bet failed: ${(err as Error).message}`);
    } finally {
      setIsPlacingBet(false);
    }
  };

  const handleClaim = async () => {
    if (!market) return;
    setIsClaiming(true);
    setClaimStatus('');
    try {
      const hash = await claimWinnings(market.id);
      setClaimStatus(`Winnings claimed! Tx: ${hash}`);
      await load();
    } catch (err) {
      setClaimStatus(`Claim failed: ${(err as Error).message}`);
    } finally {
      setIsClaiming(false);
    }
  };

  const potentialWinnings = (() => {
    if (!market || selectedOutcome === null || !betAmount) return null;
    try {
      const betWei = parseEther(betAmount);
      const pool   = selectedOutcome === Outcome.Home ? market.homePool
                   : selectedOutcome === Outcome.Draw ? market.drawPool
                   : market.awayPool;
      const win = calcPotentialWinnings(betWei, pool, market.totalPool);
      return parseFloat(formatEther(win)).toFixed(4);
    } catch { return null; }
  })();

  const now = Math.floor(Date.now() / 1000);
  const bettingOpen = market && !market.resolved && now < market.kickoff;
  const status = !market ? '' : market.resolved ? 'Resolved' : now >= market.kickoff ? 'Live' : 'Upcoming';

  if (!market) {
    return (
      <div className="market-detail">
        <button className="secondary-button" style={{ marginBottom: 16 }} onClick={onBack}>← Back to Markets</button>
        <p style={{ color: 'var(--text-muted)' }}>Loading market…</p>
      </div>
    );
  }

  return (
    <div className="market-detail">
      <button className="secondary-button" style={{ marginBottom: 16, padding: '8px 16px' }} onClick={onBack}>
        ← Back to Markets
      </button>

      {/* Match header */}
      <div className="detail-header">
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
          {market.league}
          <span style={{ marginLeft: 10 }} className={`status-badge status-${status.toLowerCase()}`}>{status}</span>
        </p>
        <div className="match-header">
          <span className="team-name">{market.homeTeam}</span>
          <span className="vs-divider">VS</span>
          <span className="team-name">{market.awayTeam}</span>
        </div>
        <p className="match-meta">{formatKickoff(market.kickoff)}</p>
        {market.resolved && (
          <p style={{ marginTop: 12, fontWeight: 600, color: 'var(--accent)' }}>
            Result: {OutcomeLabel[market.result]}
          </p>
        )}
      </div>

      <div className="detail-body">
        {/* Bet panel */}
        <div className="bet-panel">
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Place a Bet</h3>

          {!connectedAccount && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Connect your wallet to place a bet.</p>
          )}

          {bettingOpen && (
            <>
              <div className="outcome-selector">
                {([Outcome.Home, Outcome.Draw, Outcome.Away] as const).map((o) => (
                  <button
                    key={o}
                    className={`outcome-btn${selectedOutcome === o ? ' selected' : ''}`}
                    onClick={() => setSelectedOutcome(o)}
                    disabled={!connectedAccount}
                  >
                    <div style={{ fontWeight: 600 }}>{o === Outcome.Home ? market.homeTeam : o === Outcome.Away ? market.awayTeam : 'Draw'}</div>
                    <div style={{ fontSize: '0.72rem', marginTop: 2, opacity: 0.7 }}>
                      {calcPct(o === Outcome.Home ? market.homePool : o === Outcome.Draw ? market.drawPool : market.awayPool, market.totalPool)}%
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Amount (CELO)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  disabled={!connectedAccount || isPlacingBet}
                  style={{
                    width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)',
                    borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
                  }}
                />
              </div>

              {potentialWinnings && (
                <p className="potential-winnings">
                  Potential return: <span>~{potentialWinnings} CELO</span>
                </p>
              )}

              <button
                className="primary-button"
                onClick={handlePlaceBet}
                disabled={!connectedAccount || !selectedOutcome || isPlacingBet}
                style={{ width: '100%' }}
              >
                {isPlacingBet ? 'Submitting…' : 'Place Bet'}
              </button>

              {betStatus && <p className="contract-msg">{betStatus}</p>}
            </>
          )}

          {market.resolved && (
            <>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                This market is resolved. If you won, claim your winnings below.
              </p>
              <button className="primary-button" onClick={handleClaim} disabled={!connectedAccount || isClaiming} style={{ width: '100%' }}>
                {isClaiming ? 'Claiming…' : 'Claim Winnings'}
              </button>
              {claimStatus && <p className="contract-msg">{claimStatus}</p>}
            </>
          )}

          {!bettingOpen && !market.resolved && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Match has started. Betting is closed.</p>
          )}

          {/* Admin resolve confirmation (triggered by AI) */}
          {pendingResolve && isOwner && (
            <div className="resolve-confirm-panel" style={{ marginTop: 8 }}>
              <p style={{ flex: 1, fontSize: '0.82rem', margin: 0 }}>
                AI is resolving market as <strong>{OutcomeLabel[pendingResolve.outcome]}</strong>…
              </p>
              {isResolving && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pending…</span>}
            </div>
          )}
          {resolveStatus && <p className="contract-msg">{resolveStatus}</p>}
        </div>

        {/* Market stats */}
        <div className="market-stats">
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Market Stats</h3>

          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pool Breakdown
            </p>
            <div className="odds-bars" style={{ gap: 10 }}>
              <OddsBar label={market.homeTeam} pool={market.homePool} total={market.totalPool} />
              <OddsBar label="Draw"            pool={market.drawPool} total={market.totalPool} />
              <OddsBar label={market.awayTeam} pool={market.awayPool} total={market.totalPool} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total pool</span>
              <span style={{ fontWeight: 600 }}>{formatCELO(market.totalPool)} CELO</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Platform fee</span>
              <span>5%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Prize pool (after fee)</span>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                {formatCELO(market.totalPool > 0n ? market.totalPool - (market.totalPool * 500n) / 10_000n : 0n)} CELO
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Winners share the prize pool proportionally to their stake. Use the AI assistant to analyse this match.
          </p>
        </div>
      </div>
    </div>
  );
}
