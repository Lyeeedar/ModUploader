import React, { useState, useCallback } from 'react';
import { ModList } from './components/ModList';
import { ModEditor } from './components/ModEditor';
import { DebugConsole } from './components/DebugConsole';
import { StatusMessage } from './components/StatusMessage';
import { useDebugLog } from './hooks/useDebugLog';
import { ModUploadData } from './types';
import { NavigationState, LocalMod } from './types/navigation';

interface StatusMsg {
  type: 'success' | 'error' | 'info';
  text: string;
}

const App: React.FC = () => {
  const { messages, log, clear } = useDebugLog();
  const [statusMessage, setStatusMessage] = useState<StatusMsg | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState>({ screen: 'list' });

  const showStatus = useCallback((message: StatusMsg) => {
    setStatusMessage(message);
  }, []);

  const dismissStatus = useCallback(() => {
    setStatusMessage(null);
  }, []);

  // Remove mod selection since we're not scanning local mods anymore

  const handleCreateNew = useCallback(() => {
    setNavigationState({ screen: 'create' });
  }, []);

  const handleBack = useCallback(() => {
    setNavigationState({ screen: 'list' });
  }, []);

  const handleUpload = useCallback(async (uploadData: ModUploadData) => {
    try {
      const result = await window.electronAPI.uploadToWorkshop(uploadData);
      
      if (result.success) {
        log('success', `Upload successful! Workshop ID: ${result.publishedFileId}`);
        showStatus({
          type: 'success',
          text: `Successfully uploaded to Workshop! ID: ${result.publishedFileId}`
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log('error', `Upload failed: ${errorMsg}`);
      
      // Provide helpful message if Steam is not running
      if (errorMsg.includes('Steam is not initialized') || errorMsg.includes('Steam is probably not running')) {
        log('error', 'Please start Steam and make sure you are logged in, then try again');
        showStatus({
          type: 'error',
          text: 'Steam is not running. Please start Steam and try again.'
        });
      } else {
        showStatus({
          type: 'error',
          text: `Upload failed: ${errorMsg}`
        });
      }
      
      throw error; // Re-throw so ModEditor can handle loading state
    }
  }, [log, showStatus]);

  // Log initial message
  React.useEffect(() => {
    log('info', 'Mod Manager initialized');
  }, [log]);

  const renderCurrentScreen = () => {
    switch (navigationState.screen) {
      case 'list':
        return (
          <ModList
            onCreateNew={handleCreateNew}
            onLog={log}
          />
        );
      
      // Removed edit mode since we're not scanning local mods
      
      case 'create':
        return (
          <ModEditor
            onBack={handleBack}
            onUpload={handleUpload}
            onLog={log}
            onShowStatus={showStatus}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      {renderCurrentScreen()}

      <StatusMessage
        message={statusMessage}
        onDismiss={dismissStatus}
      />

      <DebugConsole
        messages={messages}
        onClear={clear}
      />
    </>
  );
};

export default App;