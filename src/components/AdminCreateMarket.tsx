import { useState } from 'react';
import { createMarket } from '../lib/predictionMarket';

interface AdminCreateMarketProps {
  onMarketCreated: (marketId: number) => void;
}

export default function AdminCreateMarket({ onMarketCreated }: AdminCreateMarketProps) {
  const [homeTeam,   setHomeTeam]   = useState('');
  const [awayTeam,   setAwayTeam]   = useState('');
  const [league,     setLeague]     = useState('');
  const [kickoff,    setKickoff]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!homeTeam || !awayTeam || !league || !kickoff) {
      setError('All fields are required.');
      return;
    }

    const kickoffMs = new Date(kickoff).getTime();
    if (isNaN(kickoffMs) || kickoffMs <= Date.now()) {
      setError('Kickoff must be a future date and time.');
      return;
    }

    setSubmitting(true);
    try {
      const kickoffSec = Math.floor(kickoffMs / 1000);
      const id = await createMarket(homeTeam, awayTeam, league, kickoffSec);
      setSuccess(`Market #${id} created: ${homeTeam} vs ${awayTeam}`);
      setHomeTeam('');
      setAwayTeam('');
      setLeague('');
      setKickoff('');
      onMarketCreated(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="admin-panel">
      <p className="admin-panel-title">Admin — Create Market</p>
      <form className="admin-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Home Team"
          value={homeTeam}
          onChange={(e) => setHomeTeam(e.target.value)}
          disabled={submitting}
        />
        <input
          type="text"
          placeholder="Away Team"
          value={awayTeam}
          onChange={(e) => setAwayTeam(e.target.value)}
          disabled={submitting}
        />
        <input
          type="text"
          placeholder="League (e.g. Premier League)"
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          className="admin-form-full"
          disabled={submitting}
        />
        <input
          type="datetime-local"
          value={kickoff}
          onChange={(e) => setKickoff(e.target.value)}
          className="admin-form-full"
          disabled={submitting}
        />
        <div className="admin-form-full">
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Market'}
          </button>
        </div>
      </form>
      {error   && <p className="contract-msg" style={{ color: 'var(--red)',   marginTop: 10 }}>{error}</p>}
      {success && <p className="contract-msg" style={{ color: 'var(--green)', marginTop: 10 }}>{success}</p>}
    </section>
  );
}
