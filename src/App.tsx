import { useState } from 'react';
import FloatingChat from './components/FloatingChat';
import Navbar from './components/Navbar';
import { connectWallet } from './lib/contract';
import { getOwner } from './lib/predictionMarket';
import MarketDetailPage from './pages/MarketDetailPage';
import MarketsPage from './pages/MarketsPage';
import MyBetsPage from './pages/MyBetsPage';
import OnboardingPage from './pages/OnboardingPage';
import type { AgentContext, Market, Outcome, Page, WalletInfo } from './types';

const persistedWallet =
  typeof window !== 'undefined' ? localStorage.getItem('celo-wallet') : null;

export default function App() {
  const [page,             setPage]             = useState<Page>('markets');
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [isOwner,          setIsOwner]          = useState(false);
  const [currentMarket,    setCurrentMarket]    = useState<Market | null>(null);
  const [pendingResolve,   setPendingResolve]   = useState<{ marketId: number; outcome: Outcome } | null>(null);
  const [wallet] = useState<WalletInfo | null>(() => {
    if (!persistedWallet) return null;
    try { return JSON.parse(persistedWallet) as WalletInfo; } catch { return null; }
  });

  const handleNavbarConnect = async () => {
    try {
      const address = await connectWallet();
      const owner   = await getOwner().catch(() => '');
      setConnectedAccount(address);
      setIsOwner(address.toLowerCase() === owner.toLowerCase());
    } catch (err) {
      console.error('Wallet connect failed:', (err as Error).message);
    }
  };

  const handleWalletConnected = (address: string, ownerStatus: boolean) => {
    setConnectedAccount(address);
    setIsOwner(ownerStatus);
  };

  const navigate = (newPage: Page, marketId?: number) => {
    setPage(newPage);
    if (marketId !== undefined) setSelectedMarketId(marketId);
    if (newPage !== 'market-detail') setCurrentMarket(null);
    setPendingResolve(null);
  };

  const agentContext: AgentContext = {
    page,
    market:          page === 'market-detail' ? (currentMarket ?? undefined) : undefined,
    isAdmin:         isOwner,
    onboardingStep:  page === 'onboarding' ? 'welcome' : undefined,
  };

  return (
    <div className="app-shell-v2">
      <Navbar
        page={page}
        onNavigate={navigate}
        connectedAccount={connectedAccount}
        isOwner={isOwner}
        onConnectWallet={handleNavbarConnect}
      />

      <main className="page-content">
        {page === 'markets' && (
          <MarketsPage
            isOwner={isOwner}
            connectedAccount={connectedAccount}
            onSelectMarket={(id) => navigate('market-detail', id)}
          />
        )}

        {page === 'market-detail' && selectedMarketId !== null && (
          <MarketDetailPage
            marketId={selectedMarketId}
            connectedAccount={connectedAccount}
            isOwner={isOwner}
            onBack={() => navigate('markets')}
            pendingResolve={pendingResolve}
            onPendingResolveClear={() => setPendingResolve(null)}
            onMarketLoaded={setCurrentMarket}
          />
        )}

        {page === 'my-bets' && (
          <MyBetsPage connectedAccount={connectedAccount} />
        )}

        {page === 'onboarding' && (
          <OnboardingPage onWalletConnected={handleWalletConnected} />
        )}
      </main>

      <FloatingChat
        context={agentContext}
        onResolveMarket={(marketId, outcome) => setPendingResolve({ marketId, outcome })}
      />
    </div>
  );
}
