import React, { useEffect, useRef, useState } from 'react';
import { DebugMessage } from '../hooks/useDebugLog';

interface DebugConsoleProps {
  messages: DebugMessage[];
  onClear: () => void;
}

export const DebugConsole: React.FC<DebugConsoleProps> = ({ messages, onClear }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive (only if not collapsed)
    if (!isCollapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`debug-console ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="debug-header" onClick={toggleCollapse}>
        <span>Debug Console {isCollapsed ? '▲' : '▼'}</span>
        <button 
          className="debug-btn" 
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering the collapse toggle
            onClear();
          }}
        >
          Clear
        </button>
      </div>
      {!isCollapsed && (
        <div className="debug-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`debug-message ${msg.type}`}>
              <span className="timestamp">[{msg.timestamp}]</span> {msg.message}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
};