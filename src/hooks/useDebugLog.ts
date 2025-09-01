import { useState, useCallback } from 'react';

export interface DebugMessage {
  id: string;
  timestamp: string;
  type: 'error' | 'info' | 'success';
  message: string;
}

export const useDebugLog = () => {
  const [messages, setMessages] = useState<DebugMessage[]>([]);

  const log = useCallback((type: 'error' | 'info' | 'success', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const newMessage: DebugMessage = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp,
      type,
      message
    };

    setMessages(prev => {
      const updated = [...prev, newMessage];
      // Keep only last 100 messages
      if (updated.length > 100) {
        return updated.slice(-100);
      }
      return updated;
    });

    // Also log to console for development
    if (type === 'error') {
      console.error(message);
    } else {
      console.log(message);
    }
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, log, clear };
};