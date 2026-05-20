import { useMemo, useState } from 'react';
import { getAssistantMessage, getWelcomeAssistantMessage } from '../lib/agent';
import { connectWallet, getContractAddress, isOnboarded, registerOnboarded } from '../lib/contract';
import { getOwner } from '../lib/predictionMarket';
import { createWallet, importWallet, isValidMnemonic } from '../lib/wallet';
import type { ChatMessage, OnboardingStep, WalletInfo } from '../types';
import ChatAgent from '../components/ChatAgent';

const persistedWallet =
  typeof window !== 'undefined' ? localStorage.getItem('celo-wallet') : null;

const STEPS = [
  { id: 'welcome',  label: 'Get started'    },
  { id: 'wallet',   label: 'Wallet setup'   },
  { id: 'confirm',  label: 'Confirm phrase' },
  { id: 'dashboard',label: 'Dashboard'      },
];

const stepToIndex: Record<OnboardingStep, number> = {
  welcome: 0, create: 1, import: 1, backup: 1, confirm: 2, dashboard: 3,
};

interface OnboardingPageProps {
  onWalletConnected: (address: string, isOwner: boolean) => void;
}

export default function OnboardingPage({ onWalletConnected }: OnboardingPageProps) {
  const [step,           setStep]           = useState<OnboardingStep>('welcome');
  const [wallet,         setWallet]         = useState<WalletInfo | null>(() => {
    if (!persistedWallet) return null;
    try { return JSON.parse(persistedWallet) as WalletInfo; } catch { return null; }
  });
  const [mnemonicInput,  setMnemonicInput]  = useState('');
  const [confirmInput,   setConfirmInput]   = useState('');
  const [messages,       setMessages]       = useState<ChatMessage[]>([
    { role: 'assistant', text: getWelcomeAssistantMessage() },
  ]);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [onboardedStatus, setOnboardedStatus]   = useState<'unknown' | 'onboarded' | 'not_onboarded'>('unknown');
  const [contractMessage, setContractMessage]   = useState('');

  const contractAddress = getContractAddress();
  const currentStepIndex = stepToIndex[step];

  const activeStepLabel = useMemo(() => {
    const labels: Record<OnboardingStep, string> = {
      welcome: 'Get started', create: 'Create wallet', import: 'Import wallet',
      backup: 'Back up phrase', confirm: 'Confirm phrase', dashboard: 'Dashboard',
    };
    return labels[step];
  }, [step]);

  const handleCreate = () => {
    const newWallet = createWallet();
    setWallet(newWallet);
    setStep('backup');
    setMessages((prev) => [...prev, { role: 'assistant', text: 'Your wallet is ready. Save this recovery phrase in a safe place, then confirm it on the next screen.' }]);
  };

  const handleImport = () => {
    setStep('import');
    setMessages((prev) => [...prev, { role: 'assistant', text: 'Paste your 12-word recovery phrase below to restore an existing wallet.' }]);
  };

  const handleImportSubmit = () => {
    if (!isValidMnemonic(mnemonicInput)) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'That phrase looks invalid. Please check it and try again.' }]);
      return;
    }
    const imported = importWallet(mnemonicInput);
    setWallet(imported);
    localStorage.setItem('celo-wallet', JSON.stringify(imported));
    setStep('dashboard');
    setMessages((prev) => [...prev, { role: 'assistant', text: 'Nice! Your wallet has been restored. You can now explore the dashboard.' }]);
  };

  const handleConfirm = () => {
    if (!wallet) return;
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (norm(confirmInput) !== norm(wallet.mnemonic)) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'The phrase does not match. Please try again carefully, one word at a time.' }]);
      return;
    }
    localStorage.setItem('celo-wallet', JSON.stringify(wallet));
    setStep('dashboard');
    setMessages((prev) => [...prev, { role: 'assistant', text: 'Great job! Your wallet is secured and you can now use the app.' }]);
  };

  const handleConnectWallet = async () => {
    try {
      const address = await connectWallet();
      setConnectedAccount(address);
      setMessages((prev) => [...prev, { role: 'assistant', text: `Connected wallet ${address}. You can now claim your on-chain onboarding badge.` }]);
      const onboarded = await isOnboarded(address);
      setOnboardedStatus(onboarded ? 'onboarded' : 'not_onboarded');
      setContractMessage('');

      const owner = await getOwner().catch(() => '');
      onWalletConnected(address, address.toLowerCase() === owner.toLowerCase());
    } catch (err) {
      setContractMessage(`Unable to connect wallet: ${(err as Error).message}`);
    }
  };

  const handleRegisterOnboarded = async () => {
    try {
      setContractMessage('Sending onboarding registration transaction…');
      const txHash = await registerOnboarded();
      setOnboardedStatus('onboarded');
      setContractMessage(`On-chain badge claimed. Tx: ${txHash}`);
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Your onboarding has been registered on-chain. Nice work!' }]);
    } catch (err) {
      setContractMessage(`Contract registration failed: ${(err as Error).message}`);
    }
  };

  const handleAskAgent = async (message: string) => {
    setMessages((prev) => [...prev, { role: 'user', text: message }]);
    setIsAgentLoading(true);
    try {
      const text = await getAssistantMessage(messages, message, step);
      setMessages((prev) => [...prev, { role: 'assistant', text }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: `Sorry, I couldn't reach the assistant: ${(err as Error).message}` }]);
    } finally {
      setIsAgentLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon" />
          <h1>Celo Agent</h1>
        </div>
        <p className="sidebar-desc">Beginner-friendly wallet setup with AI guidance for Celo.</p>

        <div className="step-list">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`step-item${i === currentStepIndex ? ' active' : i < currentStepIndex ? ' done' : ''}`}
            >
              <div className="step-pip" />
              {s.label}
            </div>
          ))}
        </div>

        <div className="status-card">
          <div className="status-label-row">
            <span className="status-heading">Current step</span>
            <span className="status-badge">{activeStepLabel}</span>
          </div>
          {wallet ? <code>{wallet.address}</code> : <p className="status-no-wallet">No wallet yet</p>}
        </div>
      </aside>

      <main className="main-panel">
        <section className="hero-card">
          <h2>Simple wallet onboarding for Celo</h2>
          <p>Create or import your wallet, back up your recovery phrase, and register your onboarding on-chain.</p>
        </section>

        <section className="flow-card">
          {step === 'welcome' && (
            <div className="welcome-grid">
              <button className="primary-button" onClick={handleCreate}>Create new wallet</button>
              <button className="secondary-button" onClick={handleImport}>Import existing wallet</button>
            </div>
          )}

          {step === 'backup' && wallet && (
            <div className="backup-panel">
              <h3>Write down your recovery phrase</h3>
              <p>This is the only way to restore your wallet if you lose access. Never share it with anyone.</p>
              <pre className="mnemonic-block">{wallet.mnemonic}</pre>
              <button className="primary-button" onClick={() => setStep('confirm')}>I saved it safely</button>
            </div>
          )}

          {step === 'confirm' && wallet && (
            <div className="confirm-panel">
              <h3>Confirm your phrase</h3>
              <p>Type your recovery phrase exactly to continue.</p>
              <textarea value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} placeholder="Enter the full 12-word phrase" rows={4} />
              <button className="primary-button" onClick={handleConfirm}>Confirm phrase</button>
            </div>
          )}

          {step === 'import' && (
            <div className="import-panel">
              <h3>Import wallet</h3>
              <p>Paste your recovery phrase to restore your wallet.</p>
              <textarea value={mnemonicInput} onChange={(e) => setMnemonicInput(e.target.value)} placeholder="Enter your 12-word phrase" rows={4} />
              <button className="primary-button" onClick={handleImportSubmit}>Restore wallet</button>
            </div>
          )}

          {step === 'dashboard' && wallet && (
            <div className="dashboard-panel">
              <h3>Wallet dashboard</h3>
              <p>Your wallet is ready. Connect a browser wallet to register your onboarding on-chain.</p>
              <div className="dashboard-grid">
                <div><strong>Local wallet</strong><code>{wallet.address}</code></div>
                <div><strong>Contract</strong><code>{contractAddress}</code></div>
              </div>
              <div className="dashboard-grid">
                <div><strong>Connected wallet</strong><p>{connectedAccount ?? 'Not connected'}</p></div>
                <div><strong>On-chain status</strong><p>{onboardedStatus === 'unknown' ? '—' : onboardedStatus}</p></div>
              </div>
              <button className="primary-button" onClick={handleConnectWallet}>Connect browser wallet</button>
              <button className="secondary-button" onClick={handleRegisterOnboarded} disabled={!connectedAccount || onboardedStatus === 'onboarded'}>
                Claim onboarding badge
              </button>
              {contractMessage && <p className="contract-msg">{contractMessage}</p>}
            </div>
          )}
        </section>

        <section className="assistant-card">
          <ChatAgent messages={messages} onSend={handleAskAgent} isLoading={isAgentLoading} />
        </section>
      </main>
    </div>
  );
}
