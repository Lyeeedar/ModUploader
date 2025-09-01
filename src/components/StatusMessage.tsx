import React, { useEffect } from 'react';

interface StatusMessageProps {
  message: {
    type: 'success' | 'error' | 'info';
    text: string;
  } | null;
  onDismiss: () => void;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({ message, onDismiss }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className={`status-message ${message.type}`}>
      {message.text}
    </div>
  );
};