import React, { useState, useEffect } from 'react';

type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'ready' };

export const UpdateNotification: React.FC = () => {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubAvailable = window.electronAPI.onUpdateAvailable((info) => {
      setState({ status: 'available', version: info.version });
      setDismissed(false);
    });

    const unsubProgress = window.electronAPI.onUpdateDownloadProgress((info) => {
      setState({ status: 'downloading', percent: info.percent });
    });

    const unsubDownloaded = window.electronAPI.onUpdateDownloaded(() => {
      setState({ status: 'ready' });
    });

    return () => {
      unsubAvailable();
      unsubProgress();
      unsubDownloaded();
    };
  }, []);

  if (state.status === 'idle' || dismissed) return null;

  return (
    <div className="update-banner">
      {state.status === 'available' && (
        <>
          <span className="update-text">
            Version {state.version} is available
          </span>
          <div className="update-actions">
            <button
              className="update-btn update-btn-primary"
              onClick={() => {
                setState({ status: 'downloading', percent: 0 });
                window.electronAPI.downloadUpdate();
              }}
            >
              Download
            </button>
            <button
              className="update-btn update-btn-dismiss"
              onClick={() => setDismissed(true)}
            >
              Later
            </button>
          </div>
        </>
      )}

      {state.status === 'downloading' && (
        <>
          <span className="update-text">Downloading update...</span>
          <div className="update-progress-container">
            <div
              className="update-progress-bar"
              style={{ width: `${state.percent}%` }}
            />
          </div>
          <span className="update-percent">{state.percent}%</span>
        </>
      )}

      {state.status === 'ready' && (
        <>
          <span className="update-text">Update ready to install</span>
          <button
            className="update-btn update-btn-primary"
            onClick={() => window.electronAPI.installUpdate()}
          >
            Restart Now
          </button>
          <button
            className="update-btn update-btn-dismiss"
            onClick={() => setDismissed(true)}
          >
            Later
          </button>
        </>
      )}
    </div>
  );
};
