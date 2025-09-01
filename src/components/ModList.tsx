import React, { useState, useEffect } from 'react';
import { WorkshopItem, WorkshopItemsResult } from '../types';
import { DebugMessage } from '../hooks/useDebugLog';
import { GameTitle } from './GameTitle';
import { DebugConsole } from './DebugConsole';

interface ModListProps {
  onCreateNew: () => void;
  onEditItem?: (item: WorkshopItem) => void;
  onLog: (type: 'error' | 'info' | 'success', message: string) => void;
  debugMessages: DebugMessage[];
  onClearDebug: () => void;
}

export const ModList: React.FC<ModListProps> = ({ onCreateNew, onEditItem, onLog, debugMessages, onClearDebug }) => {
  const [workshopItems, setWorkshopItems] = useState<WorkshopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [status, setStatus] = useState<'success' | 'steam_not_connected' | 'error'>('success');

  useEffect(() => {
    // Wait a bit longer for Steam to initialize, or listen for Steam initialization
    const timer = setTimeout(() => {
      loadWorkshopItems();
    }, 2000); // Wait 2 seconds for Steam to initialize

    return () => clearTimeout(timer);
  }, []);

  const loadWorkshopItems = async () => {
    setLoading(true);
    try {
      onLog('info', 'Loading your Steam Workshop items...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<WorkshopItemsResult>((resolve) => {
        setTimeout(() => resolve({
          items: [],
          status: 'error',
          message: 'Request timed out - Steam may not be responding'
        }), 5000);
      });
      
      const result = await Promise.race([
        window.electronAPI.getWorkshopItems(),
        timeoutPromise
      ]);
      
      setWorkshopItems(Array.isArray(result.items) ? result.items : []);
      setStatus(result.status);
      setStatusMessage(result.message || '');
      
      if (result.status === 'success') {
        if (result.items && result.items.length > 0) {
          onLog('success', `Loaded ${result.items.length} workshop items`);
        } else {
          onLog('info', result.message || 'No workshop items found');
        }
      } else if (result.status === 'steam_not_connected') {
        onLog('error', result.message || 'Steam is not connected');
      } else {
        onLog('error', result.message || 'Failed to load workshop items');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      onLog('error', `Failed to load workshop items: ${errorMsg}`);
      setWorkshopItems([]);
      setStatus('error');
      setStatusMessage(`Failed to load workshop items: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <GameTitle 
          subtitle="Steam Workshop Manager"
        />
        <main>
          <div className="section">
            <div className="loading">Loading Steam Workshop...</div>
          </div>
          
          <DebugConsole
            messages={debugMessages}
            onClear={onClearDebug}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="container">
      <GameTitle 
        subtitle="Steam Workshop Manager"
      />

      <main>
        <div className="section">
          <div className="mod-list-container">
            <div className="mod-list">
            {/* Create New Mod - Always at top */}
            <div className="mod-item create-new single-row" onClick={onCreateNew}>
              <div className="mod-info-compact">
                <h3 className="mod-title-compact">+ Upload New Mod</h3>
              </div>
            </div>

            {/* Workshop Items */}
            {workshopItems.length === 0 ? (
              <div className="no-mods">
                <p>
                  {status === 'steam_not_connected' 
                    ? '🔌 Steam Connection Issue'
                    : status === 'error'
                    ? '❌ Error Loading Items'
                    : '📦 No Workshop Items'
                  }
                </p>
                <p>{statusMessage || 'No workshop items found.'}</p>
                {status === 'steam_not_connected' && (
                  <button 
                    className="game-button small" 
                    onClick={loadWorkshopItems}
                    style={{ marginTop: '10px' }}
                  >
                    Retry Connection
                  </button>
                )}
              </div>
            ) : (
              Array.isArray(workshopItems) ? workshopItems.map(item => (
                <WorkshopItemCard 
                  key={item.publishedFileId} 
                  item={item}
                  onEdit={onEditItem}
                  onLog={onLog}
                />
              )) : []
            )}
            </div>
          </div>
        </div>
        
        <DebugConsole
          messages={debugMessages}
          onClear={onClearDebug}
        />
      </main>
    </div>
  );
};

interface WorkshopItemCardProps {
  item: WorkshopItem;
  onEdit?: (item: WorkshopItem) => void;
  onLog: (type: 'error' | 'info' | 'success', message: string) => void;
}

const WorkshopItemCard: React.FC<WorkshopItemCardProps> = ({ item, onEdit, onLog }) => {
  const handleEdit = () => {
    if (onEdit) {
      onEdit(item);
      onLog('info', `Editing workshop item: ${item.title}`);
    }
  };

  return (
    <div className="mod-item workshop-item single-row" onClick={handleEdit}>
      <div className="mod-info-compact">
        <h3 className="mod-title-compact">{item.title}</h3>
        <div className="mod-stats-compact">
          <span className="stat-compact" title="Subscribers">
            <span className="stat-icon">👥</span>
            {item.subscriptions || 0}
          </span>
          <span className="stat-compact" title="Favorites">
            <span className="stat-icon">⭐</span>
            {item.favorited || 0}
          </span>
          <span className="stat-compact" title="Views">
            <span className="stat-icon">👁</span>
            {item.views || 0}
          </span>
          <span className="mod-visibility-badge-compact">
            {item.visibility}
          </span>
        </div>
      </div>
    </div>
  );
};