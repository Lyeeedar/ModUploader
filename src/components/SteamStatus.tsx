import React, { useState, useEffect } from 'react';
import { SteamStatus as SteamStatusType } from '../types';

interface SteamStatusProps {
  onRetry?: () => void;
}

export const SteamStatus: React.FC<SteamStatusProps> = ({ onRetry }) => {
  const [status, setStatus] = useState<SteamStatusType | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getSteamStatus();
      setStatus(result);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    // Listen for Steam initialization
    const unsubscribe = window.electronAPI.onSteamInitialized(() => {
      checkStatus();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="steam-status connecting">
        <span className="steam-status-icon">⏳</span>
        <span className="steam-status-text">Connecting to Steam...</span>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="steam-status disconnected">
        <span className="steam-status-icon">🔌</span>
        <span className="steam-status-text">Steam not connected</span>
        {onRetry && (
          <button className="steam-retry-btn" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="steam-status connected">
      <span className="steam-status-icon">✓</span>
      <span className="steam-status-text">
        Connected as <strong>{status.userName}</strong>
      </span>
    </div>
  );
};
