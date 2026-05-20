import { useEffect, useState } from 'react';
import AdminCreateMarket from '../components/AdminCreateMarket';
import MarketCard from '../components/MarketCard';
import { getMarket, getMarkets } from '../lib/predictionMarket';
import type { Market } from '../types';

interface MarketsPageProps {
  isOwner: boolean;
  connectedAccount: string | null;
  onSelectMarket: (id: number) => void;
}

export default function MarketsPage({ isOwner, connectedAccount, onSelectMarket }: MarketsPageProps) {
  const [markets,   setMarkets]   = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setMarkets(await getMarkets());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleMarketCreated = async (id: number) => {
    try {
      const newMarket = await getMarket(id);
      setMarkets((prev) => [...prev, newMarket]);
    } catch {
      await load();
    }
  };

  return (
    <div className="markets-page">
      {isOwner && <AdminCreateMarket onMarketCreated={handleMarketCreated} />}

      <div className="markets-header">
        <h2>Prediction Markets</h2>
        {connectedAccount ? null : (
          <p className="markets-hint">Connect your wallet to place bets.</p>
        )}
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
        <div className="market-grid">
          {markets.map((m) => (
            <MarketCard key={m.id} market={m} onClick={onSelectMarket} />
          ))}
        </div>
      )}
    </div>
  );
}
