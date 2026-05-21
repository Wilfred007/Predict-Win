import { useEffect, useRef, useState } from 'react';
import AdminCreateMarket from '../components/AdminCreateMarket';
import AdminOraclePanel from '../components/AdminOraclePanel';
import MarketCard from '../components/MarketCard';
import { getMarket, getMarkets } from '../lib/predictionMarket';
import type { Market } from '../types';

const REFRESH_INTERVAL = 30_000; // 30 seconds

interface MarketsPageProps {
  isOwner: boolean;
  connectedAccount: string | null;
  onSelectMarket: (id: number) => void;
}

export default function MarketsPage({ isOwner, connectedAccount, onSelectMarket }: MarketsPageProps) {
  const [markets,   setMarkets]   = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState('');
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      setMarkets(await getMarkets());
      setLastRefresh(Date.now());
    } catch (err) {
      if (!silent) setError((err as Error).message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Poll silently every 30 seconds so resolved markets appear automatically
    timerRef.current = setInterval(() => load(true), REFRESH_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleMarketCreated = async (id: number) => {
    try {
      const newMarket = await getMarket(id);
      setMarkets((prev) => [...prev, newMarket]);
    } catch {
      await load();
    }
  };

  // Count markets that are past kickoff but unresolved ("awaiting result")
  const now = Math.floor(Date.now() / 1000);
  const awaitingResult = markets.filter(m => !m.resolved && m.kickoff < now).length;

  return (
    <div className="markets-page">
      {isOwner && (
        <>
          <AdminOraclePanel onSettled={() => load()} />
          <AdminCreateMarket onMarketCreated={handleMarketCreated} />
        </>
      )}

      <div className="markets-header">
        <h2>Prediction Markets</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {awaitingResult > 0 && !isOwner && (
            <span className="awaiting-badge">{awaitingResult} awaiting result</span>
          )}
          {connectedAccount ? null : (
            <p className="markets-hint">Connect your wallet to place bets.</p>
          )}
        </div>
      </div>

      {isLoading && <p className="loading-msg">Loading markets…</p>}

      {error && (
        <p className="contract-msg" style={{ color: 'var(--red)' }}>
          {error.includes('not set') ? 'Contract not deployed yet. Set VITE_PREDICTION_MARKET_ADDRESS in .env.' : error}
        </p>
      )}

      {!isLoading && !error && markets.length === 0 && (
        <p className="empty-msg">
          {isOwner ? 'No markets yet. Create the first one above.' : 'No markets available yet. Check back soon.'}
        </p>
      )}

      {!isLoading && !error && markets.length > 0 && (
        <>
          <div className="market-grid">
            {markets.map((m) => (
              <MarketCard key={m.id} market={m} onClick={onSelectMarket} />
            ))}
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: 8 }}>
            Last updated {new Date(lastRefresh).toLocaleTimeString()}
          </p>
        </>
      )}
    </div>
  );
}
