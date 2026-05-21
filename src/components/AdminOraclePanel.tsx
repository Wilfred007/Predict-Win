import { useState } from 'react';
import { BrowserProvider } from 'ethers';

interface OracleResult {
  resolved: { marketId: number; homeTeam: string; awayTeam: string; outcome: string; txHash: string }[];
  skipped:  string[];
  errors:   string[];
}

interface AdminOraclePanelProps {
  onSettled: () => void;
}

export default function AdminOraclePanel({ onSettled }: AdminOraclePanelProps) {
  const [running,  setRunning]  = useState(false);
  const [result,   setResult]   = useState<OracleResult | null>(null);
  const [error,    setError]    = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleSettle = async () => {
    setRunning(true);
    setResult(null);
    setError('');

    try {
      if (!window.ethereum) throw new Error('No wallet connected');
      const provider = new BrowserProvider(window.ethereum as never);
      const signer   = await provider.getSigner();

      // Timestamped message — server rejects if older than 5 minutes
      const message   = `oracle-trigger:${Date.now()}`;
      const signature = await signer.signMessage(message);

      const res = await fetch('/api/oracle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });

      // Vercel API routes don't run locally — catch that early
      if (res.status === 404) {
        throw new Error('Oracle endpoint not found. Deploy to Vercel first — api/ routes only run in production.');
      }

      const text = await res.text();
      if (!text) throw new Error('Oracle returned an empty response. Check Vercel function logs.');

      let data: OracleResult & { ok: boolean; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Oracle returned non-JSON (status ${res.status}). Check Vercel function logs.`);
      }

      if (!data.ok) throw new Error(data.error ?? 'Oracle failed');

      setResult(data);
      if (data.resolved.length > 0) onSettled();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="oracle-panel">
      <div className="oracle-panel-header">
        <div>
          <p className="oracle-panel-title">Auto-Settle Markets</p>
          <p className="oracle-panel-desc">
            Checks finished matches via football-data.org and resolves them on-chain automatically.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={handleSettle}
          disabled={running}
          style={{ whiteSpace: 'nowrap', padding: '10px 20px' }}
        >
          {running ? 'Checking…' : '⚡ Settle Now'}
        </button>
      </div>

      {error && (
        <p className="contract-msg" style={{ color: 'var(--red)', marginTop: 12 }}>{error}</p>
      )}

      {result && (
        <div style={{ marginTop: 14 }}>
          {result.resolved.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.resolved.map((r) => (
                <div key={r.marketId} className="oracle-resolved-row">
                  <span style={{ fontWeight: 600 }}>{r.homeTeam} vs {r.awayTeam}</span>
                  <span className="oracle-outcome-chip">{r.outcome}</span>
                  <a
                    href={`https://celoscan.io/tx/${r.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--accent)' }}
                  >
                    View tx ↗
                  </a>
                </div>
              ))}
            </div>
          )}

          {result.resolved.length === 0 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              No markets ready to settle right now.
            </p>
          )}

          {(result.skipped.length > 0 || result.errors.length > 0) && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', marginTop: 8, padding: 0 }}
            >
              {expanded ? '▲ Hide' : '▼ Show'} details ({result.skipped.length} skipped, {result.errors.length} errors)
            </button>
          )}

          {expanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.skipped.map((s, i) => (
                <p key={i} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>↷ {s}</p>
              ))}
              {result.errors.map((e, i) => (
                <p key={i} style={{ fontSize: '0.72rem', color: 'var(--red)', margin: 0 }}>✗ {e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
