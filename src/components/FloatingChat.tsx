import { useEffect, useState } from 'react';
import { getAgentResponse } from '../lib/agent';
import type { AgentContext, AgentResponse, ChatMessage, Outcome } from '../types';
import { OutcomeLabel } from '../types';
import ChatAgent from './ChatAgent';

interface FloatingChatProps {
  context: AgentContext;
  onResolveMarket?: (marketId: number, outcome: Outcome) => void;
}

export default function FloatingChat({ context, onResolveMarket }: FloatingChatProps) {
  const [isOpen,         setIsOpen]         = useState(false);
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [isLoading,      setIsLoading]      = useState(false);
  const [pendingResolve, setPendingResolve] = useState<AgentResponse['resolveMarket']>(undefined);

  // Reset conversation when page changes
  useEffect(() => {
    setMessages([]);
    setPendingResolve(undefined);
  }, [context.page, context.market?.id]);

  const handleSend = async (message: string) => {
    setMessages((prev) => [...prev, { role: 'user', text: message }]);
    setIsLoading(true);
    setPendingResolve(undefined);

    try {
      const response = await getAgentResponse(messages, message, context);
      setMessages((prev) => [...prev, { role: 'assistant', text: response.text }]);

      if (response.resolveMarket && onResolveMarket) {
        setPendingResolve(response.resolveMarket);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Error: ${(err as Error).message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmResolve = () => {
    if (pendingResolve && onResolveMarket) {
      onResolveMarket(pendingResolve.marketId, pendingResolve.outcome);
      setPendingResolve(undefined);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Transaction submitted. Check the market status.' },
      ]);
    }
  };

  return (
    <div className="floating-chat">
      {isOpen && (
        <div className="floating-chat-panel">
          <div className="floating-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="chat-header-dot" />
              <h3>AI Assistant</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {pendingResolve && (
            <div className="resolve-confirm-panel" style={{ margin: '8px 12px', borderRadius: 10 }}>
              <div style={{ flex: 1, fontSize: '0.82rem' }}>
                Resolve market #{pendingResolve.marketId} as{' '}
                <strong>{OutcomeLabel[pendingResolve.outcome]}</strong>?
              </div>
              <button className="primary-button" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={handleConfirmResolve}>
                Confirm
              </button>
              <button className="secondary-button" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={() => setPendingResolve(undefined)}>
                Cancel
              </button>
            </div>
          )}

          <div style={{ flex: 1, overflow: 'hidden', padding: '0 12px 12px' }}>
            <ChatAgent messages={messages} onSend={handleSend} isLoading={isLoading} />
          </div>
        </div>
      )}

      <button className="chat-fab" onClick={() => setIsOpen((o) => !o)} title="AI Assistant">
        💬
      </button>
    </div>
  );
}
