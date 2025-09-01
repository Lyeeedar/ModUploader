import React, { useEffect, useRef } from 'react';
import { DebugMessage } from '../hooks/useDebugLog';

interface DebugConsoleProps {
  messages: DebugMessage[];
  onClear: () => void;
}

export const DebugConsole: React.FC<DebugConsoleProps> = ({ messages, onClear }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="debug-console">
      <div className="debug-header">
        <span>Debug Console</span>
        <button className="debug-btn" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="debug-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`debug-message ${msg.type}`}>
            <span className="timestamp">[{msg.timestamp}]</span> {msg.message}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};