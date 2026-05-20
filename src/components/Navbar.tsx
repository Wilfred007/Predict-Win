import { isMiniPay } from '../lib/miniPay';
import type { Page } from '../types';

interface NavbarProps {
  page: Page;
  onNavigate: (page: Page) => void;
  connectedAccount: string | null;
  isOwner: boolean;
  onConnectWallet: () => void;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Navbar({ page, onNavigate, connectedAccount, isOwner, onConnectWallet }: NavbarProps) {
  const inMiniPay = isMiniPay();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon" />
        <h1>Celo Predict</h1>
        {inMiniPay && <span className="minipay-badge">MiniPay</span>}
      </div>

      <div className="navbar-links">
        <button
          className={`nav-link${page === 'markets' || page === 'market-detail' ? ' active' : ''}`}
          onClick={() => onNavigate('markets')}
        >
          Markets
        </button>
        <button
          className={`nav-link${page === 'my-bets' ? ' active' : ''}`}
          onClick={() => onNavigate('my-bets')}
        >
          My Bets
        </button>
        <button
          className={`nav-link${page === 'onboarding' ? ' active' : ''}`}
          onClick={() => onNavigate('onboarding')}
        >
          Onboarding
        </button>
      </div>

      <div className="navbar-actions">
        {isOwner && <span className="admin-badge">Admin</span>}

        {/* In MiniPay the wallet is implicit — show address only, no button */}
        {inMiniPay ? (
          connectedAccount ? (
            <span className="wallet-address-chip">{truncateAddress(connectedAccount)}</span>
          ) : (
            <span className="wallet-address-chip connecting">Connecting…</span>
          )
        ) : (
          <button
            className="primary-button"
            style={{ padding: '8px 16px', fontSize: '0.825rem' }}
            onClick={onConnectWallet}
          >
            {connectedAccount ? truncateAddress(connectedAccount) : 'Connect Wallet'}
          </button>
        )}
      </div>
    </nav>
  );
}
