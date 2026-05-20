import type { ChatMessage } from '../types';

interface ChatAgentProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export default function ChatAgent({ messages, onSend, isLoading = false }: ChatAgentProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('message') as HTMLTextAreaElement;
    const message = input.value.trim();
    if (!message) return;
    onSend(message);
    input.value = '';
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-dot" />
        <h3>Onboarding assistant</h3>
      </div>

      <div className="chat-history">
        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.role}`}>
            {message.text}
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">Thinking…</div>
        )}
      </div>

      <form className="message-input" onSubmit={handleSubmit}>
        <textarea name="message" placeholder="Ask the agent a question…" disabled={isLoading} />
        <div className="message-input-row">
          <button className="primary-button" type="submit" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
