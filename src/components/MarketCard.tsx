import { formatCELO } from '../lib/predictionMarket';
import type { Market } from '../types';
import { Outcome, OutcomeLabel } from '../types';

interface MarketCardProps {
  market: Market;
  onClick: (id: number) => void;
}

function calcPct(pool: bigint, total: bigint): number {
  if (total === 0n) return 33;
  return Math.round(Number((pool * 100n) / total));
}

function getStatus(market: Market): { label: string; cls: string } {
  if (market.resolved) {
    return { label: `${OutcomeLabel[market.result]}`, cls: 'status-resolved' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (now >= market.kickoff) return { label: 'Live', cls: 'status-live' };
  return { label: 'Upcoming', cls: 'status-upcoming' };
}

function formatKickoff(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MarketCard({ market, onClick }: MarketCardProps) {
  const status = getStatus(market);
  const homePct = calcPct(market.homePool, market.totalPool);
  const drawPct = calcPct(market.drawPool, market.totalPool);
  const awayPct = calcPct(market.awayPool, market.totalPool);

  return (
    <div className="market-card" onClick={() => onClick(market.id)}>
      <div className="card-header">
        <span className="league-badge">{market.league}</span>
        <span className={`status-badge ${status.cls}`}>{status.label}</span>
      </div>

      <div className="teams-row">
        <span>{market.homeTeam}</span>
        <span className="vs-divider">vs</span>
        <span>{market.awayTeam}</span>
      </div>

      <div className="kickoff-row">{formatKickoff(market.kickoff)}</div>

      <div className="odds-bars">
        {([
          { label: 'H', pct: homePct, outcome: Outcome.Home },
          { label: 'D', pct: drawPct, outcome: Outcome.Draw },
          { label: 'A', pct: awayPct, outcome: Outcome.Away },
        ] as const).map(({ label, pct }) => (
          <div key={label} className="odds-bar-row">
            <span className="odds-bar-label">{label}</span>
            <div className="odds-bar-track">
              <div className="odds-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="odds-bar-pct">{pct}%</span>
          </div>
        ))}
      </div>

      <div className="pools-row">
        {market.totalPool > 0n
          ? `Pool: ${formatCELO(market.totalPool)} CELO`
          : 'No bets yet'}
      </div>
    </div>
  );
}
