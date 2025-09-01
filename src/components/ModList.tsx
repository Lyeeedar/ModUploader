import React, { useState, useEffect } from 'react';
import { WorkshopItem, WorkshopItemsResult } from '../types';

interface ModListProps {
  onCreateNew: () => void;
  onLog: (type: 'error' | 'info' | 'success', message: string) => void;
}

export const ModList: React.FC<ModListProps> = ({ onCreateNew, onLog }) => {
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
        <header>
          <h1>Steam Workshop Manager</h1>
          <p className="subtitle">Ascend from Nine Mountains</p>
        </header>
        <main>
          <div className="section">
            <div className="loading">Loading Steam Workshop...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>Steam Workshop Manager</h1>
        <p className="subtitle">Ascend from Nine Mountains</p>
      </header>

      <main>
        <div className="section">
          <h2>Steam Workshop</h2>
          
          <div className="mod-list">
            {/* Create New Mod - Always at top */}
            <div className="mod-item create-new" onClick={onCreateNew}>
              <div className="mod-info">
                <h3>+ Upload New Mod</h3>
                <p className="mod-description">
                  Upload a new mod to the Steam Workshop
                </p>
              </div>
              <div className="mod-actions">
                <div className="mod-status create">Upload</div>
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
                  onLog={onLog}
                />
              )) : []
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

interface WorkshopItemCardProps {
  item: WorkshopItem;
  onLog: (type: 'error' | 'info' | 'success', message: string) => void;
}

const WorkshopItemCard: React.FC<WorkshopItemCardProps> = ({ item, onLog }) => {
  const handleViewOnSteam = () => {
    const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${item.publishedFileId}`;
    onLog('info', `Opening workshop item in browser: ${item.title}`);
    // In Electron, we could use shell.openExternal, but for now just log
    window.open(url, '_blank');
  };

  return (
    <div className="mod-item">
      <div className="mod-info">
        <h3>{item.title}</h3>
        <p className="mod-description">
          {item.description || 'No description available'}
        </p>
        <div className="mod-metadata">
          <span>Updated: {new Date(item.updatedDate * 1000).toLocaleDateString()}</span>
          <span className="workshop-stats">
            👥 {item.subscriptions || 0} subscribers
          </span>
          <span className="workshop-stats">
            ⭐ {item.favorited || 0} favorites
          </span>
          <span className="workshop-stats">
            👁 {item.views || 0} views
          </span>
        </div>
      </div>
      <div className="mod-actions">
        <button 
          className="game-button small"
          onClick={handleViewOnSteam}
          title="View on Steam Workshop"
        >
          View on Steam
        </button>
        <div className="mod-status published">
          Published
        </div>
      </div>
    </div>
  );
};